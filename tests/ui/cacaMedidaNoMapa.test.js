/**
 * A CACA MEDIDA DENTRO DO MAPA DE CACA (v2, 29/09/2026) e o DESEMPENHO da
 * abertura — `docs/CONTRATO-CACA-MEDIDA.md`, secoes 7 a 10 (repositorio do
 * servidor).
 *
 * Tres camadas, na ordem:
 *
 *  1. a metade PURA (`cacaMedidaNoMapa.js`): ler o bloco e o pacote, selos,
 *     ordem, textos;
 *  2. o COMPONENTE de verdade (`HuntMap.js` + `HuntMap.html`) no jsdom, com
 *     rede falsa: o portao "ausente = a tela de hoje" contra o HTML GRAVADO
 *     do codigo de 28/09 (`tests/fixtures/huntMapHtmlDeHoje.json`), o filtro,
 *     a ordem, a faixa e os verbos do Explorar;
 *  3. as regras de desempenho: nada com a janela fechada, o mesmo catalogo
 *     nao redesenha, a lista em lotes.
 *
 * O jsdom nao faz leiaute: o que e de TELA (44 px no dedo, a faixa parada no
 * topo da lista no celular) e conferido no CSS, e o resto fica para a
 * verificacao em tela (relatorio da frente G).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { catalogoPequeno, blocoDaCacaMedida, explorarEmCurso, explorarConcluido } from '../fixtures/huntMapCatalogo.js';
import {
	candidatosEmSeusMapas,
	candidatosNaFrente,
	chaveDeSeusMapas,
	fundirPacote,
	formatarNumero,
	htmlDaFaixaDoExplorar,
	htmlDaLinhaDoCartao,
	lerBlocoDaCacaMedida,
	lerPacoteDaCacaMedida,
	mapasQueMudaram,
	medidaMexeNaLista,
	ordenarPorMedida,
	seloDoRisco,
	seusMapasMudaram,
	textoDaCacaNoPainel,
	textoDosGolpes
} from 'UI/Components/HuntMap/cacaMedidaNoMapa.js';

const mocks = vi.hoisted(() => ({ hooks: [], enviados: [] }));

vi.mock('Network/NetworkManager.js', () => ({
	default: {
		sendPacket: p => mocks.enviados.push(p),
		hookPacket: (pkt, cb) => mocks.hooks.push({ pkt, cb })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), vsync: [], width: 1280, height: 800 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1, INFO: 2 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, remove: () => {}, uid: 0 } }));
vi.mock('UI/itemNaTela.js', () => ({
	aplicarIconeDoItem: () => {},
	nomeLocalDoItem: (id, fallback) => fallback
}));

const GRAVADO = JSON.parse(readFileSync('tests/fixtures/huntMapHtmlDeHoje.json', 'utf8'));
const CSS = readFileSync('src/UI/Components/HuntMap/HuntMap.css', 'utf8').replace(/\r\n/g, '\n');

/* ═════════════════════════ 1. A METADE PURA ═════════════════════════ */

describe('lerBlocoDaCacaMedida: tolerante, e ausente e a tela de hoje', () => {
	it('ausente, de outra versao ou ilegivel devolve null', () => {
		expect(lerBlocoDaCacaMedida(undefined)).toBeNull();
		expect(lerBlocoDaCacaMedida(null)).toBeNull();
		expect(lerBlocoDaCacaMedida({ ...blocoDaCacaMedida(), v: 1 })).toBeNull();
		expect(lerBlocoDaCacaMedida('texto')).toBeNull();
	});

	it('le a medida, o risco, os limites e o explorar', () => {
		const bloco = lerBlocoDaCacaMedida(blocoDaCacaMedida());
		expect(Object.keys(bloco.medida).sort()).toEqual(['pay_fild01', 'prt_fild02']);
		expect(bloco.risco.prt_fild02).toEqual([5, 'c', 1]);
		expect(bloco.limites).toEqual({ seguro: 7, cuidado: 4 });
		expect(bloco.explorar.estado).toBe('parado');
	});

	it('risco null continua null ("a conta ainda nao terminou") e entrada ilegivel some', () => {
		expect(lerBlocoDaCacaMedida(blocoDaCacaMedida({ risco: null })).risco).toBeNull();
		const bloco = lerBlocoDaCacaMedida(blocoDaCacaMedida({ risco: { a: [3, 'x', 0], b: ['?', 's', 0], c: [2, 'a', 0] } }));
		expect(bloco.risco).toEqual({ c: [2, 'a', 0] });
	});

	it('explorar de estado desconhecido vira "parado"', () => {
		expect(lerBlocoDaCacaMedida(blocoDaCacaMedida({ explorar: { estado: 'voando' } })).explorar).toEqual({ estado: 'parado' });
	});
});

describe('lerPacoteDaCacaMedida e fundirPacote', () => {
	it('so entra o que o pacote traz: o Explorar nao apaga o risco do catalogo', () => {
		const bloco = lerBlocoDaCacaMedida(blocoDaCacaMedida());
		const pacote = lerPacoteDaCacaMedida(JSON.stringify({ v: 1, explorar: explorarEmCurso() }));
		expect('risco' in pacote).toBe(false);
		const fundido = fundirPacote(bloco, pacote);
		expect(fundido.risco).toBe(bloco.risco);
		expect(fundido.explorar.estado).toBe('explorando');
	});

	it('o risco que ficou pronto chega pelo pacote e substitui o null', () => {
		const bloco = lerBlocoDaCacaMedida(blocoDaCacaMedida({ risco: null }));
		const pacote = lerPacoteDaCacaMedida(JSON.stringify({ risco: { prt_fild08: [8, 's', 0] } }));
		expect(fundirPacote(bloco, pacote).risco).toEqual({ prt_fild08: [8, 's', 0] });
	});

	it('abrir vale para true e para "mapa-de-caca", e para mais nada', () => {
		expect(lerPacoteDaCacaMedida('{"abrir":true}').abrir).toBe(true);
		expect(lerPacoteDaCacaMedida('{"abrir":"mapa-de-caca"}').abrir).toBe(true);
		expect(lerPacoteDaCacaMedida('{"abrir":"outra"}').abrir).toBe(false);
		expect(lerPacoteDaCacaMedida('{nao e json')).toBeNull();
	});

	it('a forma do SERVIDOR: o 0x0fb5 da v1 com o bloco v2 aninhado em `cacaMedida` — e o bloco que vale', () => {
		const pacote = lerPacoteDaCacaMedida(
			JSON.stringify({
				v: 1,
				abrir: 'mapa-de-caca',
				mapaAtual: 'pay_fild01',
				mapas: [{ mapa: 'ignorado', medido: true, expBasePorHora: 1 }],
				explorar: { estado: 'parado' },
				resultado: { ok: false, texto: 'recusa' },
				cacaMedida: blocoDaCacaMedida({ risco: { prt_fild08: [8, 's', 0] }, explorar: explorarEmCurso() })
			})
		);
		expect(pacote.abrir).toBe(true);
		expect(pacote.risco).toEqual({ prt_fild08: [8, 's', 0] });
		expect(Object.keys(pacote.medida).sort()).toEqual(['pay_fild01', 'prt_fild02']);
		expect(pacote.explorar.estado).toBe('explorando');
		expect(pacote.resultado).toEqual({ ok: false, texto: 'recusa' });
	});

	it('o bloco aninhado com risco null (a defesa mudou e a conta nao terminou) apaga os selos', () => {
		const pacote = lerPacoteDaCacaMedida(JSON.stringify({ v: 1, cacaMedida: blocoDaCacaMedida({ risco: null }) }));
		expect('risco' in pacote).toBe(true);
		expect(fundirPacote(lerBlocoDaCacaMedida(blocoDaCacaMedida()), pacote).risco).toBeNull();
	});

	it('mapasQueMudaram e medidaMexeNaLista: o minuto que anda nao mexe na lista', () => {
		const a = blocoDaCacaMedida().medida;
		const d = JSON.parse(JSON.stringify(a));
		d.pay_fild01.minutos = 33;
		const mudaram = mapasQueMudaram(a, d);
		expect([...mudaram]).toEqual(['pay_fild01']);
		expect(medidaMexeNaLista(a, d, mudaram, 'nivel', false)).toBe(false);
		expect(medidaMexeNaLista(a, d, mudaram, 'exp-medida', true)).toBe(false);
		d.pay_fild01.expBasePorHora = 1;
		expect(medidaMexeNaLista(a, d, mudaram, 'exp-medida', false)).toBe(true);
		expect(medidaMexeNaLista(a, d, mudaram, 'zeny-medida', false)).toBe(false);
		d.novo = { minutos: 10, medido: true, expBasePorHora: 5 };
		const comNovo = mapasQueMudaram(a, d);
		expect(medidaMexeNaLista(a, d, comNovo, 'nivel', true)).toBe(true);
		expect(medidaMexeNaLista(a, d, comNovo, 'nivel', false)).toBe(false);
	});

	it('sem bloco anterior nasce um bloco so com o que veio (o Explorar funciona antes do catalogo)', () => {
		const fundido = fundirPacote(null, lerPacoteDaCacaMedida(JSON.stringify({ explorar: explorarEmCurso() })));
		expect(fundido.risco).toBeNull();
		expect(fundido.medida).toEqual({});
		expect(fundido.explorar.estado).toBe('explorando');
	});
});

describe('selos, ordem e textos', () => {
	const bloco = lerBlocoDaCacaMedida(blocoDaCacaMedida());

	it('o selo e a LETRA do servidor, com os golpes (a marca de habilidade saiu, D-1730)', () => {
		expect(seloDoRisco(bloco, 'pay_fild01')).toEqual({ chave: 'seguro', rotulo: 'Seguro', golpes: 9 });
		// O fixture ainda traz o terceiro valor (um servidor antigo): ele e ignorado.
		expect(seloDoRisco(bloco, 'prt_fild02')).toEqual({ chave: 'cuidado', rotulo: 'Cuidado', golpes: 5 });
		expect(seloDoRisco(bloco, 'prt_sewb4').chave).toBe('arriscado');
		expect(seloDoRisco(bloco, 'pay_d03_i')).toBeNull();
		expect(seloDoRisco(lerBlocoDaCacaMedida(blocoDaCacaMedida({ risco: null })), 'pay_fild01')).toBeNull();
	});

	it('"Aguenta ~N golpes", no singular com 1', () => {
		expect(textoDosGolpes(9)).toBe('Aguenta ~9 golpes');
		expect(textoDosGolpes(1)).toBe('Aguenta ~1 golpe');
	});

	it('numero em pt-BR sem depender do ICU', () => {
		expect(formatarNumero(7740)).toBe('7.740');
		expect(formatarNumero(1234567)).toBe('1.234.567');
		expect(formatarNumero(999)).toBe('999');
		expect(formatarNumero(null)).toBe('—');
	});

	it('Sua EXP/h: medidos primeiro, do maior para o menor; o resto na ordem que chegou', () => {
		const mapas = ['a', 'pay_fild01', 'b', 'prt_fild02', 'c'].map(mapa => ({ mapa }));
		expect(ordenarPorMedida(mapas, bloco, 'exp-medida').map(m => m.mapa)).toEqual(['prt_fild02', 'pay_fild01', 'a', 'b', 'c']);
		expect(ordenarPorMedida(mapas, bloco, 'zeny-medida').map(m => m.mapa)).toEqual(['pay_fild01', 'prt_fild02', 'a', 'b', 'c']);
	});

	it('Sua EXP/h ignora a entrada que ainda esta medindo', () => {
		const medindo = lerBlocoDaCacaMedida(
			blocoDaCacaMedida({ medida: { a: { minutos: 4, medido: false, expBasePorHora: 99999 }, b: { minutos: 20, medido: true, expBasePorHora: 5 } } })
		);
		expect(ordenarPorMedida([{ mapa: 'a' }, { mapa: 'b' }], medindo, 'exp-medida').map(m => m.mapa)).toEqual(['b', 'a']);
	});

	it('a linha do painel: medido, ficha anterior e medindo', () => {
		expect(textoDaCacaNoPainel(bloco, 'pay_fild01')).toBe('Sua caça aqui (32 min): 7.740 EXP/h · 120 poções/h · 0 mortes');
		expect(textoDaCacaNoPainel(bloco, 'prt_fild02')).toBe('Sua caça aqui (14 min, ficha anterior): 9.100 EXP/h · 300 poções/h · 2 mortes');
		const medindo = lerBlocoDaCacaMedida(blocoDaCacaMedida({ medida: { x: { minutos: 4, medido: false } } }));
		expect(textoDaCacaNoPainel(medindo, 'x')).toBe('Sua caça aqui: medindo 4 de 10 min');
		expect(textoDaCacaNoPainel(bloco, 'gef_fild10')).toBeNull();
		expect(textoDaCacaNoPainel(null, 'pay_fild01')).toBeNull();
	});

	it('a linha do cartao: nada sem dado, e o que houver com dado', () => {
		expect(htmlDaLinhaDoCartao(null, 'pay_fild01')).toBe('');
		expect(htmlDaLinhaDoCartao(bloco, 'pay_d03_i')).toBe('');
		const linha = htmlDaLinhaDoCartao(bloco, 'pay_fild01');
		expect(linha).toContain('▸ Você: 7.740 EXP/h · 21.500 z/h');
		expect(linha).toContain('hm-risco--seguro');
		expect(linha).toContain('Aguenta ~9 golpes');
		expect(linha).not.toContain('usa habilidade');
		// Mesmo com o terceiro valor aceso no pacote (servidor antigo), a marca nao volta.
		expect(htmlDaLinhaDoCartao(bloco, 'prt_fild02')).not.toContain('usa habilidade');
		expect(htmlDaLinhaDoCartao(bloco, 'prt_fild02')).toContain('Aguenta ~5 golpes');
		// Sem medida e com risco: so o selo.
		expect(htmlDaLinhaDoCartao(bloco, 'gef_fild10')).not.toContain('Você:');
	});

	it('a faixa: explorando, concluido com e sem escolhido, e nada parado', () => {
		const rotulo = m => `R-${m}`;
		expect(htmlDaFaixaDoExplorar({ estado: 'parado' }, rotulo)).toBe('');
		const emCurso = lerBlocoDaCacaMedida(blocoDaCacaMedida({ explorar: explorarEmCurso() })).explorar;
		expect(htmlDaFaixaDoExplorar(emCurso, rotulo)).toContain('Explorando 2 de 3 — <strong>Floresta de Payon</strong> · 6 de 10 min');
		expect(htmlDaFaixaDoExplorar(emCurso, rotulo)).toContain('data-acao="cancelar"');
		const fim = lerBlocoDaCacaMedida(blocoDaCacaMedida({ explorar: explorarConcluido() })).explorar;
		expect(htmlDaFaixaDoExplorar(fim, rotulo)).toContain('Você ficou em <strong>Floresta de Payon</strong>');
		const semNada = lerBlocoDaCacaMedida(blocoDaCacaMedida({ explorar: explorarConcluido(null) })).explorar;
		expect(htmlDaFaixaDoExplorar(semNada, rotulo)).toContain('Nenhum mapa passou sem mortes');
	});

	it('escapa o rotulo que vem do servidor', () => {
		const explorar = { estado: 'explorando', indice: 0, candidatos: [{ mapa: 'x', rotulo: '<img onerror=1>', estado: 'medindo', minutos: 1 }] };
		expect(htmlDaFaixaDoExplorar(explorar, () => '')).not.toContain('<img');
	});
});

describe('os candidatos do Explorar em "Seus mapas" (29/09/2026)', () => {
	const ler = extra => lerBlocoDaCacaMedida(blocoDaCacaMedida(extra));

	it('explorando e concluido: os candidatos na ordem da exploracao; parado e sem bloco: nenhum', () => {
		expect(candidatosEmSeusMapas(ler({ explorar: explorarEmCurso() }))).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		expect(candidatosEmSeusMapas(ler({ explorar: explorarConcluido() }))).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		expect(candidatosEmSeusMapas(ler({ explorar: explorarConcluido(null) }))).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		expect(candidatosEmSeusMapas(ler())).toEqual([]);
		expect(candidatosEmSeusMapas(null)).toEqual([]);
	});

	it('o candidato repetido entra uma vez so, na primeira posicao', () => {
		const explorar = explorarEmCurso();
		explorar.candidatos.push({ ...explorar.candidatos[0] });
		expect(candidatosEmSeusMapas(ler({ explorar }))).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
	});

	it('candidatosNaFrente: candidatos na ordem da exploracao, o resto na ordem que chegou', () => {
		const mapas = ['a', 'gef_fild10', 'pay_fild01', 'b', 'prt_fild02'].map(mapa => ({ mapa }));
		expect(candidatosNaFrente(mapas, ['prt_fild02', 'pay_fild01', 'prt_sewb4']).map(m => m.mapa)).toEqual([
			'prt_fild02',
			'pay_fild01',
			'a',
			'gef_fild10',
			'b'
		]);
		// Sem candidato, a MESMA lista (nem copia).
		expect(candidatosNaFrente(mapas, [])).toBe(mapas);
	});

	it('seusMapasMudaram: o Explorar que comeca ou para muda; o candidato que fica medido e o minuto que anda nao', () => {
		const parado = ler({ medida: {} });
		const emCurso = ler({ medida: {}, explorar: explorarEmCurso() });
		expect(seusMapasMudaram(parado, emCurso)).toBe(true);
		expect(seusMapasMudaram(emCurso, parado)).toBe(true);
		// O minuto andou e o candidato fechou os 10 minutos: MESMO conjunto.
		const depois = JSON.parse(JSON.stringify(emCurso));
		depois.explorar.candidatos[1].minutos = 10;
		depois.medida.pay_fild01 = { minutos: 10, medido: true, expBasePorHora: 7740, zenyPorHora: 1 };
		expect(seusMapasMudaram(emCurso, depois)).toBe(false);
		// Um mapa medido FORA dos candidatos entra: muda.
		depois.medida.gef_fild10 = { minutos: 12, medido: true, expBasePorHora: 1, zenyPorHora: 1 };
		expect(seusMapasMudaram(emCurso, depois)).toBe(true);
		// Parado, o conjunto e so o dos medidos, e a entrada ainda medindo nao conta.
		expect(chaveDeSeusMapas(ler())).toBe('|pay_fild01,prt_fild02');
		expect(chaveDeSeusMapas(ler({ medida: { x: { medido: false } } }))).toBe('|');
	});
});

/* ═════════════════════════ 2. O COMPONENTE ═════════════════════════ */

let HuntMap;
let PACKET;

async function montar() {
	vi.resetModules();
	mocks.hooks.length = 0;
	mocks.enviados.length = 0;
	localStorage.clear();
	({ default: PACKET } = await import('Network/PacketStructure.js'));
	({ default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js'));
	const { default: html } = await import('UI/Components/HuntMap/HuntMap.html?raw');
	HuntMap._host = document.createElement('div');
	HuntMap._host.innerHTML = html;
	HuntMap._shadow = null;
	HuntMap.focus = () => {};
	HuntMap.draggable = () => {};
	HuntMap.init();
}

const gancho = nome => mocks.hooks.find(h => h.pkt === PACKET.ZC[nome]).cb;
const chegarCatalogo = cat => gancho('RAGIDLE_CATALOGO')({ json: JSON.stringify(cat) });
const chegarCacaMedida = dados => gancho('RAGIDLE_CACA_MEDIDA')({ json: JSON.stringify(dados) });
const q = s => HuntMap._host.querySelector(s);
const qq = s => Array.from(HuntMap._host.querySelectorAll(s));
const aberta = () => q('.hm-window').classList.contains('is-open');
const verbos = () =>
	mocks.enviados.filter(p => p instanceof PACKET.CZ.RAGIDLE_CACA_MEDIDA).map(p => JSON.parse(p.json).acao);
const foto = () => ({
	lista: q('.hm-list').innerHTML,
	count: q('.hm-count').innerHTML,
	tabs: q('.hm-tabs').innerHTML,
	voce: q('.hm-voce').innerHTML,
	painel: q('.hm-panel-scroll').innerHTML,
	rodape: q('.hm-panel-footer').innerHTML
});
function clicar(el) {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** O catalogo aberto do jeito do jogador: abre a janela e o catalogo chega. */
function abrirCom(cat) {
	HuntMap.toggle();
	chegarCatalogo(cat);
	HuntMap._terminarLista();
}

describe('SEM o bloco: a tela de hoje, byte a byte (o HTML gravado do codigo de 28/09)', () => {
	beforeEach(montar);

	it('Todos, Para mim, por nome e o clique num cartao sao IDENTICOS ao codigo de antes', () => {
		abrirCom(catalogoPequeno());
		expect(foto()).toEqual(GRAVADO.todos);
		clicar(q('.hm-seg-btn[data-modo="ideais"]'));
		expect(foto()).toEqual(GRAVADO.ideais);
		clicar(q('.hm-seg-btn[data-modo="todos"]'));
		const sort = q('.hm-sort');
		sort.value = 'nome';
		sort.dispatchEvent(new Event('change'));
		expect(foto()).toEqual(GRAVADO.porNome);
		sort.value = 'nivel';
		sort.dispatchEvent(new Event('change'));
		clicar(q('.hm-card[data-mapa="prt_fild02"]'));
		expect(foto()).toEqual(GRAVADO.cliqueNoCartao);
	});

	it('os controles novos ficam escondidos e o seletor tem so as tres ordens de sempre', () => {
		abrirCom(catalogoPequeno());
		expect(q('.hm-seg-btn[data-modo="seus"]').hidden).toBe(true);
		expect(q('.hm-explorar').hidden).toBe(true);
		expect(q('.hm-explorar-faixa').hidden).toBe(true);
		expect(qq('.hm-sort option').map(o => o.value)).toEqual(['nivel', 'nivel-recomendado', 'nome']);
		expect(qq('.hm-card-medida')).toHaveLength(0);
	});

	it('o bloco de outra versao tambem e a tela de hoje', () => {
		abrirCom(catalogoPequeno({ cacaMedida: { ...blocoDaCacaMedida(), v: 9 } }));
		expect(foto()).toEqual(GRAVADO.todos);
	});

	it('COM o bloco, o cartao sem dado nenhum e o mesmo cartao de hoje', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const molde = document.createElement('div');
		molde.innerHTML = GRAVADO.todos.lista;
		// pay_d03_i: sem medida, sem risco, fora do Explorar.
		const hoje = molde.querySelector('.hm-card[data-mapa="pay_d03_i"]').outerHTML;
		expect(q('.hm-card[data-mapa="pay_d03_i"]').outerHTML).toBe(hoje);
	});
});

describe('COM o bloco: o que entra', () => {
	beforeEach(montar);

	it('aparecem "Seus mapas" (entre "Para mim" e "Todos"), o Explorar e as duas ordens novas', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const botoes = qq('.hm-modo .hm-seg-btn').filter(b => !b.hidden).map(b => b.textContent);
		expect(botoes).toEqual(['Para mim', 'Seus mapas', 'Todos', 'Favoritos']);
		expect(q('.hm-explorar').hidden).toBe(false);
		expect(qq('.hm-sort option').map(o => o.textContent)).toEqual(['Nível', 'Para meu nível', 'Nome', 'Sua EXP/h', 'Seu zeny/h']);
	});

	it('o cartao medido ganha a linha "▸ Você" e o selo; todo mapa com risco ganha o selo de golpes', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const payon = q('.hm-card[data-mapa="pay_fild01"] .hm-card-medida');
		expect(payon.textContent).toContain('▸ Você: 7.740 EXP/h · 21.500 z/h');
		expect(payon.querySelector('.hm-risco--seguro').textContent).toBe('Seguro · Aguenta ~9 golpes');
		expect(q('.hm-card[data-mapa="gef_fild10"] .hm-risco--arriscado').textContent).toBe('Arriscado · Aguenta ~1 golpe');
		expect(q('.hm-card[data-mapa="gef_fild10"] .hm-voce-caca')).toBeNull();
		expect(q('.hm-card[data-mapa="pay_d03_i"] .hm-card-medida')).toBeNull();
	});

	it('risco null: nenhum selo de golpes, e a linha "▸ Você" continua', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ risco: null }) }));
		expect(qq('.hm-risco')).toHaveLength(0);
		expect(qq('.hm-voce-caca')).toHaveLength(2);
	});

	it('o risco que fica pronto chega pelo 0x0fb5 e os selos aparecem', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ risco: null }) }));
		chegarCacaMedida({ risco: { prt_fild08: [40, 's', 0], prt_sewb4: [2, 'a', 0] } });
		HuntMap._terminarLista();
		expect(qq('.hm-risco')).toHaveLength(2);
		expect(q('.hm-card[data-mapa="prt_sewb4"] .hm-risco--arriscado')).not.toBeNull();
	});

	it('"Seus mapas" mostra so os medidos', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		clicar(q('.hm-seg-btn[data-modo="seus"]'));
		expect(qq('.hm-card').map(c => c.dataset.mapa).sort()).toEqual(['pay_fild01', 'prt_fild02']);
		expect(q('.hm-seg-btn[data-modo="seus"]').classList.contains('is-selected')).toBe(true);
	});

	it('"Seus mapas" sem nenhum medido diz o que fazer', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		clicar(q('.hm-seg-btn[data-modo="seus"]'));
		expect(q('.hm-list-empty').textContent).toContain('Nenhum mapa medido ainda');
	});

	it('ordem "Sua EXP/h" e "Seu zeny/h"', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const sort = q('.hm-sort');
		sort.value = 'exp-medida';
		sort.dispatchEvent(new Event('change'));
		HuntMap._terminarLista();
		expect(qq('.hm-card').map(c => c.dataset.mapa).slice(0, 3)).toEqual(['prt_fild02', 'pay_fild01', 'prt_fild08']);
		sort.value = 'zeny-medida';
		sort.dispatchEvent(new Event('change'));
		HuntMap._terminarLista();
		expect(qq('.hm-card').map(c => c.dataset.mapa).slice(0, 2)).toEqual(['pay_fild01', 'prt_fild02']);
	});

	it('o quadro VOCE do dossie ganha "Sua caça aqui"', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		// O mapa atual (pay_fild01) ja vem selecionado.
		expect(q('.hm-fit-caca').textContent).toBe('Sua caça aqui (32 min): 7.740 EXP/h · 120 poções/h · 0 mortes');
		clicar(q('.hm-card[data-mapa="gef_fild10"]'));
		expect(q('.hm-fit-caca')).toBeNull();
	});

	it('o bloco que some (catalogo sem ele) leva tudo junto e devolve a ordem de nivel', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const sort = q('.hm-sort');
		sort.value = 'exp-medida';
		sort.dispatchEvent(new Event('change'));
		clicar(q('.hm-seg-btn[data-modo="seus"]'));
		chegarCatalogo(catalogoPequeno());
		HuntMap._terminarLista();
		expect(q('.hm-seg-btn[data-modo="seus"]').hidden).toBe(true);
		expect(q('.hm-sort').value).toBe('nivel');
		expect(qq('.hm-card')).toHaveLength(6);
	});
});

describe('o Explorar', () => {
	beforeEach(montar);

	it('o botao manda { acao: "explorar" } e apaga ate a resposta', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		clicar(q('.hm-explorar'));
		clicar(q('.hm-explorar'));
		expect(verbos()).toEqual(['explorar']);
		expect(q('.hm-explorar').disabled).toBe(true);
		// No celular a faixa mora no passo da lista: o toque leva ate ela.
		expect(q('.hm-window').classList.contains('is-passo-mapas')).toBe(true);
	});

	it('explorando: a faixa, os cartoes candidatos e o Cancelar', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		chegarCacaMedida({ v: 1, explorar: explorarEmCurso() });
		const faixa = q('.hm-explorar-faixa');
		expect(faixa.hidden).toBe(false);
		expect(faixa.textContent).toContain('Explorando 2 de 3 — Floresta de Payon · 6 de 10 min');
		expect(q('.hm-card[data-mapa="pay_fild01"]').classList.contains('is-cacando')).toBe(true);
		expect(q('.hm-card[data-mapa="pay_fild01"] .hm-exp-selo').textContent).toBe('caçando agora');
		expect(q('.hm-card[data-mapa="prt_sewb4"] .hm-exp-selo').textContent).toBe('na fila');
		expect(q('.hm-card[data-mapa="prt_fild02"] .hm-exp-selo').textContent).toBe('morreu aqui');
		expect(qq('.hm-card.is-candidato').map(c => c.dataset.mapa).sort()).toEqual(['pay_fild01', 'prt_fild02', 'prt_sewb4']);
		expect(q('.hm-explorar').disabled).toBe(true);
		clicar(q('.hm-explorar-cancelar'));
		clicar(q('.hm-explorar-cancelar'));
		expect(verbos()).toEqual(['cancelar']);
	});

	it('concluido: "Você ficou em", o cartao destacado, e o × dispensa a faixa', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ explorar: explorarEmCurso() }) }));
		chegarCacaMedida({ v: 1, explorar: explorarConcluido() });
		expect(q('.hm-explorar-faixa').textContent).toContain('Você ficou em Floresta de Payon');
		const escolhido = q('.hm-card[data-mapa="pay_fild01"]');
		expect(escolhido.classList.contains('is-escolhido')).toBe(true);
		expect(escolhido.classList.contains('is-cacando')).toBe(false);
		expect(escolhido.querySelector('.hm-exp-selo').textContent).toBe('Você ficou aqui');
		expect(q('.hm-card[data-mapa="prt_sewb4"] .hm-exp-selo').textContent).toBe('sem mortes: 3.100 EXP/h');
		clicar(q('.hm-explorar-dispensar'));
		expect(q('.hm-explorar-faixa').hidden).toBe(true);
		// So o aviso sai: o estado continua o do servidor.
		expect(escolhido.classList.contains('is-escolhido')).toBe(true);
		expect(verbos()).toEqual([]);
	});

	it('cancelado (volta a "parado"): a faixa e as marcas somem', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ explorar: explorarEmCurso() }) }));
		expect(qq('.hm-card.is-candidato')).toHaveLength(3);
		chegarCacaMedida({ v: 1, explorar: { estado: 'parado' } });
		expect(q('.hm-explorar-faixa').hidden).toBe(true);
		expect(qq('.hm-card.is-candidato')).toHaveLength(0);
		expect(qq('.hm-exp-selo')).toHaveLength(0);
		expect(q('.hm-explorar').disabled).toBe(false);
	});

	it('a forma do servidor: o risco pronto chega aninhado e os selos aparecem', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ risco: null }) }));
		expect(qq('.hm-risco')).toHaveLength(0);
		chegarCacaMedida({ v: 1, mapas: [], explorar: { estado: 'parado' }, cacaMedida: blocoDaCacaMedida() });
		HuntMap._terminarLista();
		expect(qq('.hm-risco')).toHaveLength(5);
	});

	it('o pedir de 30 s em que so o minuto andou NAO redesenha a lista: troca so o cartao que mudou', () => {
		// Explorar PARADO de proposito: se pay_fild01 fosse candidato, o cartao
		// dele seria trocado pelo caminho do Explorar, e o caso nao mediria o
		// caminho da medida (o mutante M31 sobreviveu assim).
		const bloco = blocoDaCacaMedida();
		abrirCom(catalogoPequeno({ cacaMedida: bloco }));
		const outro = q('.hm-card[data-mapa="prt_fild08"]');
		const payon = q('.hm-card[data-mapa="pay_fild01"]');
		const depois = JSON.parse(JSON.stringify(bloco));
		depois.medida.pay_fild01.minutos = 40;
		depois.medida.pay_fild01.zenyPorHora = 30000;
		chegarCacaMedida({ v: 1, explorar: depois.explorar, cacaMedida: depois });
		expect(q('.hm-card[data-mapa="prt_fild08"]')).toBe(outro);
		expect(q('.hm-card[data-mapa="pay_fild01"]')).toBe(payon);
		expect(payon.querySelector('.hm-voce-caca').textContent).toBe('▸ Você: 7.740 EXP/h · 30.000 z/h');
		// O dossie do mapa selecionado (o atual, pay_fild01) acompanha.
		expect(q('.hm-fit-caca').textContent).toContain('(40 min)');
	});

	it('com a ordem por EXP/h, a EXP/h que muda reordena a lista', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		const sort = q('.hm-sort');
		sort.value = 'exp-medida';
		sort.dispatchEvent(new Event('change'));
		HuntMap._terminarLista();
		expect(qq('.hm-card')[0].dataset.mapa).toBe('prt_fild02');
		const depois = blocoDaCacaMedida();
		depois.medida.pay_fild01.expBasePorHora = 99000;
		chegarCacaMedida({ v: 1, explorar: { estado: 'parado' }, cacaMedida: depois });
		HuntMap._terminarLista();
		expect(qq('.hm-card')[0].dataset.mapa).toBe('pay_fild01');
	});

	it('a recusa do servidor vai para a linha de estado', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		chegarCacaMedida({ v: 1, explorar: { estado: 'parado' }, resultado: { ok: false, texto: 'Termine a missão antes.' } });
		expect(q('.hm-status').textContent).toBe('Termine a missão antes.');
	});

	it('o @cacamedida (abrir) abre a janela FECHADA na aba "Seus mapas", pelo toggle', () => {
		const toggle = vi.spyOn(HuntMap, 'toggle');
		chegarCacaMedida({ abrir: 'mapa-de-caca', explorar: { estado: 'parado' } });
		expect(toggle).toHaveBeenCalledTimes(1);
		expect(aberta()).toBe(true);
		chegarCatalogo(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		HuntMap._terminarLista();
		expect(q('.hm-seg-btn[data-modo="seus"]').classList.contains('is-selected')).toBe(true);
		expect(qq('.hm-card').map(c => c.dataset.mapa).sort()).toEqual(['pay_fild01', 'prt_fild02']);
		expect(q('.hm-window').classList.contains('is-passo-mapas')).toBe(true);
	});

	it('o relogio do pedir so existe com a janela aberta E o Explorar em curso', () => {
		vi.useFakeTimers();
		try {
			abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
			// Nem o relogio existe (e nao so "ele nao pede"): sem Explorar em
			// curso nao ha timer nenhum rodando por conta desta janela.
			expect(vi.getTimerCount()).toBe(0);
			vi.advanceTimersByTime(65000);
			expect(verbos()).toEqual([]);
			chegarCacaMedida({ v: 1, explorar: explorarEmCurso() });
			vi.advanceTimersByTime(61000);
			expect(verbos()).toEqual(['pedir', 'pedir']);
			HuntMap.toggle(); // fecha
			vi.advanceTimersByTime(120000);
			expect(verbos()).toEqual(['pedir', 'pedir']);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('"Seus mapas" durante o Explorar: os cartoes dos candidatos (29/09/2026)', () => {
	beforeEach(montar);

	const seus = () => clicar(q('.hm-seg-btn[data-modo="seus"]'));
	const naLista = () => qq('.hm-card').map(c => c.dataset.mapa);
	const buscar = termo => {
		const campo = q('.hm-search');
		campo.value = termo;
		campo.dispatchEvent(new Event('input'));
		HuntMap._terminarLista();
	};

	it('EXPLORANDO sem nenhum medido: os tres candidatos, na ordem da exploracao, com a borda e o selo — e nao o vazio', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {}, explorar: explorarEmCurso() }) }));
		seus();
		HuntMap._terminarLista();
		expect(q('.hm-list-empty')).toBeNull();
		expect(naLista()).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		expect(q('.hm-count').textContent).toContain('3 mapas');
		expect(qq('.hm-card.is-candidato')).toHaveLength(3);
		expect(q('.hm-card[data-mapa="pay_fild01"]').classList.contains('is-cacando')).toBe(true);
		expect(q('.hm-card[data-mapa="pay_fild01"] .hm-exp-selo').textContent).toBe('caçando agora');
		expect(q('.hm-card[data-mapa="prt_sewb4"] .hm-exp-selo').textContent).toBe('na fila');
		expect(q('.hm-card[data-mapa="prt_fild02"] .hm-exp-selo').textContent).toBe('morreu aqui');
	});

	it('CONTROLE: parado e sem medido, "Seus mapas" continua com o vazio de hoje', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		seus();
		expect(naLista()).toEqual([]);
		expect(q('.hm-list-empty').textContent).toContain('Nenhum mapa medido ainda');
	});

	it('CONTROLE: parado com medidos, so os medidos (nenhum candidato)', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		seus();
		expect(naLista().sort()).toEqual(['pay_fild01', 'prt_fild02']);
		expect(qq('.hm-card.is-candidato')).toHaveLength(0);
	});

	it('os candidatos vem ANTES dos medidos, tambem com a ordem "Sua EXP/h"', () => {
		const medida = blocoDaCacaMedida().medida;
		medida.gef_fild10 = { minutos: 20, medido: true, expBasePorHora: 99999, zenyPorHora: 99999, mortes: 0 };
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida, explorar: explorarEmCurso() }) }));
		seus();
		HuntMap._terminarLista();
		expect(naLista()).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4', 'gef_fild10']);
		const sort = q('.hm-sort');
		sort.value = 'exp-medida';
		sort.dispatchEvent(new Event('change'));
		HuntMap._terminarLista();
		// gef_fild10 tem a maior EXP/h e mesmo assim fica depois dos candidatos.
		expect(naLista()).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4', 'gef_fild10']);
	});

	it('CONCLUIDO: os candidatos continuam, e o escolhido e o cartao destacado', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {}, explorar: explorarConcluido() }) }));
		seus();
		expect(naLista()).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		const escolhido = q('.hm-card[data-mapa="pay_fild01"]');
		expect(escolhido.classList.contains('is-escolhido')).toBe(true);
		expect(escolhido.querySelector('.hm-exp-selo').textContent).toBe('Você ficou aqui');
		expect(qq('.hm-card.is-escolhido')).toHaveLength(1);
	});

	it('o Explorar que COMECA com a aba aberta poe os candidatos; o que PARA os tira e volta ao vazio', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		seus();
		expect(q('.hm-list-empty')).not.toBeNull();
		chegarCacaMedida({ v: 1, explorar: explorarEmCurso() });
		HuntMap._terminarLista();
		expect(naLista()).toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
		chegarCacaMedida({ v: 1, explorar: { estado: 'parado' } });
		expect(naLista()).toEqual([]);
		expect(q('.hm-list-empty').textContent).toContain('Nenhum mapa medido ainda');
	});

	it('DESEMPENHO: o pedir de 30 s e o candidato que fecha os 10 min NAO redesenham a lista; so trocam os cartoes', () => {
		const bloco = blocoDaCacaMedida({ medida: {}, explorar: explorarEmCurso() });
		abrirCom(catalogoPequeno({ cacaMedida: bloco }));
		seus();
		HuntMap._terminarLista();
		const nos = qq('.hm-card');
		// So o minuto andou.
		const minuto = JSON.parse(JSON.stringify(bloco));
		minuto.explorar.candidatos[1].minutos = 7;
		chegarCacaMedida({ v: 1, explorar: minuto.explorar, cacaMedida: minuto });
		expect(qq('.hm-card')).toEqual(nos);
		// pay_fild01 fechou os 10 minutos: medido, e o proximo candidato comeca.
		const medido = JSON.parse(JSON.stringify(minuto));
		medido.explorar.indice = 2;
		medido.explorar.candidatos[1] = { ...medido.explorar.candidatos[1], estado: 'medido', minutos: 10, expBasePorHora: 7740 };
		medido.explorar.candidatos[2].estado = 'medindo';
		medido.medida.pay_fild01 = { minutos: 10, medido: true, expBasePorHora: 7740, zenyPorHora: 21500, mortes: 0 };
		chegarCacaMedida({ v: 1, explorar: medido.explorar, cacaMedida: medido });
		expect(qq('.hm-card')).toEqual(nos);
		expect(q('.hm-card[data-mapa="pay_fild01"] .hm-exp-selo').textContent).toBe('sem mortes: 7.740 EXP/h');
		expect(q('.hm-card[data-mapa="pay_fild01"] .hm-voce-caca').textContent).toContain('7.740 EXP/h');
		expect(q('.hm-card[data-mapa="prt_sewb4"]').classList.contains('is-cacando')).toBe(true);
	});

	it('FORA de "Seus mapas" nada muda: o Explorar que comeca em "Todos" nao redesenha a lista', () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		const nos = qq('.hm-card');
		chegarCacaMedida({ v: 1, explorar: explorarEmCurso() });
		expect(qq('.hm-card')).toEqual(nos);
		expect(qq('.hm-card.is-candidato')).toHaveLength(3);
	});

	it('FORA de "Seus mapas" nada muda: em "Todos" os candidatos NAO vao para a frente', async () => {
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		const semExplorar = naLista();
		await montar();
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {}, explorar: explorarEmCurso() }) }));
		expect(naLista()).toEqual(semExplorar);
		// Controle de que o caso mede algo: a ordem de sempre NAO comeca pelos candidatos.
		expect(semExplorar.slice(0, 3)).not.toEqual(['prt_fild02', 'pay_fild01', 'prt_sewb4']);
	});

	it('a busca continua procurando no jogo inteiro, na ordem de sempre (os candidatos nao vao para a frente)', async () => {
		// Controle: a ordem da busca SEM Explorar.
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {} }) }));
		seus();
		buscar('Campo');
		const semExplorar = naLista();
		expect(semExplorar.length).toBeGreaterThan(1);
		await montar();
		abrirCom(catalogoPequeno({ cacaMedida: blocoDaCacaMedida({ medida: {}, explorar: explorarEmCurso() }) }));
		seus();
		buscar('Campo');
		expect(naLista()).toEqual(semExplorar);
		// E o que nao e candidato nem medido aparece (a busca ignora a aba).
		buscar('Geffen');
		expect(naLista()).toEqual(['gef_fild10']);
	});
});

/* ═════════════════════════ 3. DESEMPENHO ═════════════════════════ */

/** Um catalogo com N mapas (clones do pequeno), para a lista passar do 1o lote. */
function catalogoGrande(n, extra = {}) {
	const base = catalogoPequeno(extra);
	const mapas = [];
	for (let i = 0; i < n; i++) {
		const m = JSON.parse(JSON.stringify(base.mapas[i % base.mapas.length]));
		m.mapa = `${m.mapa}_${i}`;
		m.rotulo = `${m.rotulo} ${i}`;
		mapas.push(m);
	}
	return { ...base, mapas, mapaAtual: 'prontera' };
}

describe('desempenho: as tres regras', () => {
	beforeEach(montar);
	afterEach(() => vi.useRealTimers());

	it('NADA COM A JANELA FECHADA: o catalogo que chega fechado nao desenha; a abertura desenha', () => {
		chegarCatalogo(catalogoPequeno());
		expect(qq('.hm-card')).toHaveLength(0);
		HuntMap.toggle();
		HuntMap._terminarLista();
		expect(qq('.hm-card')).toHaveLength(6);
	});

	it('NADA COM A JANELA FECHADA: o 0x0fb5 so marca, e a abertura mostra a faixa', () => {
		chegarCatalogo(catalogoPequeno({ cacaMedida: blocoDaCacaMedida() }));
		chegarCacaMedida({ v: 1, explorar: explorarEmCurso() });
		expect(q('.hm-explorar-faixa').hidden).toBe(true);
		HuntMap.toggle();
		expect(q('.hm-explorar-faixa').hidden).toBe(false);
	});

	it('O MESMO CATALOGO NAO REDESENHA: reabrir mantem os MESMOS nos do DOM', () => {
		abrirCom(catalogoPequeno());
		const antes = q('.hm-card');
		HuntMap.toggle(); // fecha
		abrirCom(catalogoPequeno());
		expect(q('.hm-card')).toBe(antes);
		// CONTROLE: um catalogo diferente redesenha.
		HuntMap.toggle();
		abrirCom(catalogoPequeno({ nivel: 21 }));
		expect(q('.hm-card')).not.toBe(antes);
	});

	it('a MESMA lista de favoritos nao redesenha; a diferente troca so a estrela', () => {
		abrirCom(catalogoPequeno());
		const cartao = q('.hm-card[data-mapa="prt_fild08"]');
		const favoritos = gancho('RAGIDLE_FAVORITOS');
		favoritos({ json: JSON.stringify({ v: 1, favoritos: ['prt_fild02'] }) });
		expect(q('.hm-card[data-mapa="prt_fild08"]')).toBe(cartao);
		// E a resposta igual (a de toda abertura) nao estraga a regra 2: o
		// mesmo catalogo, reaberto, continua sem redesenhar.
		HuntMap.toggle();
		abrirCom(catalogoPequeno());
		expect(q('.hm-card[data-mapa="prt_fild08"]')).toBe(cartao);
		favoritos({ json: JSON.stringify({ v: 1, favoritos: ['prt_fild02', 'prt_fild08'] }) });
		expect(q('.hm-card[data-mapa="prt_fild08"]')).toBe(cartao);
		expect(cartao.querySelector('.hm-card-fav').classList.contains('is-on')).toBe(true);
		expect(q('.hm-card[data-mapa="prt_fild02"] .hm-card-fav').classList.contains('is-on')).toBe(true);
	});

	it('EM LOTES: o primeiro lote sai na hora, o resto um lote por quadro, na ordem', async () => {
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		expect(qq('.hm-card')).toHaveLength(12);
		await new Promise(r => setTimeout(r, 400));
		const mapas = qq('.hm-card').map(c => c.dataset.mapa);
		expect(mapas).toHaveLength(60);
		expect(new Set(mapas).size).toBe(60);
	});

	it('EM LOTES: o DOM final e o mesmo de desenhar tudo de uma vez', async () => {
		// O mesmo catalogo desenhado pelos lotes e pelo `_terminarLista` sincrono.
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		await new Promise(r => setTimeout(r, 400));
		const porQuadros = q('.hm-list').innerHTML;
		HuntMap.limparEstadoDoPersonagem();
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		HuntMap._terminarLista();
		expect(q('.hm-list').innerHTML).toBe(porQuadros);
	});

	it('EM LOTES: fechar no meio mata o resto, e reabrir desenha a lista inteira', async () => {
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		HuntMap.toggle(); // fecha antes do 2o lote
		await new Promise(r => setTimeout(r, 200));
		expect(qq('.hm-card')).toHaveLength(12);
		HuntMap.toggle();
		HuntMap._terminarLista();
		expect(qq('.hm-card')).toHaveLength(60);
	});

	it('EM LOTES: a busca digitada no meio nao empilha a lista velha', async () => {
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		const busca = q('.hm-search');
		busca.value = 'Orc';
		busca.dispatchEvent(new Event('input'));
		await new Promise(r => setTimeout(r, 300));
		const mapas = qq('.hm-card').map(c => c.dataset.mapa);
		expect(mapas).toHaveLength(10);
		expect(mapas.every(m => m.startsWith('gef_fild10_'))).toBe(true);
	});

	it('o cartao de lote tardio responde ao clique (ouvinte delegado)', () => {
		HuntMap.toggle();
		chegarCatalogo(catalogoGrande(60));
		HuntMap._terminarLista();
		const ultimo = qq('.hm-card').pop();
		clicar(ultimo);
		expect(HuntMap.selectedMapa).toBe(ultimo.dataset.mapa);
		expect(ultimo.classList.contains('is-selected')).toBe(true);
		expect(qq('.hm-card.is-selected')).toHaveLength(1);
	});

	it('a estrela e a seta do cartao nao selecionam o mapa', () => {
		abrirCom(catalogoPequeno());
		const antes = HuntMap.selectedMapa;
		clicar(q('.hm-card[data-mapa="prt_fild08"] .hm-card-fav'));
		expect(HuntMap.selectedMapa).toBe(antes);
		const pedido = mocks.enviados.find(p => p instanceof PACKET.CZ.RAGIDLE_CACA_ACAO && JSON.parse(p.json).acao === 'alternar-favorito');
		expect(JSON.parse(pedido.json).mapa).toBe('prt_fild08');
		clicar(q('.hm-card[data-mapa="prt_fild08"] .hm-card-go'));
		const viagem = mocks.enviados.find(p => p instanceof PACKET.CZ.RAGIDLE_VIAJAR);
		expect(viagem.mapName).toBe('prt_fild08');
	});
});

/* ═══════════════════════ O CSS (o jsdom nao mede) ═══════════════════════ */

describe('CSS: escondido esconde, e o dedo tem 44 px', () => {
	it('[hidden] vence o display de autor nos tres controles novos', () => {
		expect(CSS).toMatch(/#HuntMap \.hm-seg-btn\[hidden\],\n#HuntMap \.hm-explorar\[hidden\],\n#HuntMap \.hm-explorar-faixa\[hidden\] \{\n\tdisplay: none;/);
	});

	it('no celular em pe o Explorar e o Cancelar tem 44 px, e o × tambem', () => {
		expect(CSS).toMatch(/\.ri-vertical #HuntMap \.hm-explorar,\n\.ri-vertical #HuntMap \.hm-explorar-cancelar \{\n\tmin-height: 44px;/);
		expect(CSS).toMatch(/\.ri-vertical #HuntMap \.hm-explorar-dispensar \{\n\twidth: 44px;\n\theight: 44px;/);
	});

	it('no celular em pe o botao "Seus mapas" (onde os candidatos aparecem) tem 44 px, e o cartao passa disso', () => {
		expect(CSS).toMatch(/\.ri-vertical #HuntMap \.hm-seg-btn,\n\.ri-vertical #HuntMap \.hm-sort \{\n\tmin-height: 44px;/);
		// O cartao do candidato e o cartao de sempre.
		expect(CSS).toMatch(/#HuntMap \.hm-card \{\n\tposition: relative;\n\tdisplay: flex;[^}]*min-height: 100px;/);
	});

	it('a faixa mora FORA da rolagem da lista (fica parada no topo dela)', () => {
		const html = readFileSync('src/UI/Components/HuntMap/HuntMap.html', 'utf8');
		const faixa = html.indexOf('class="hm-explorar-faixa"');
		const lista = html.indexOf('class="hm-list ri-scroll"');
		expect(faixa).toBeGreaterThan(html.indexOf('class="hm-list-wrap"'));
		expect(faixa).toBeLessThan(lista);
	});
});
