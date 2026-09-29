/**
 * A JANELA "SEUS MAPAS" (28/09/2026) — a caca medida e o Explorar.
 *
 * Contrato: `docs/CONTRATO-CACA-MEDIDA.md` (repositorio do servidor), secoes
 * 4, 5 e 6. Quatro partes, cada uma medida do jeito que da:
 *
 *  1. a metade PURA (`formatoDaCacaMedida.js`): leitura do pacote, selo,
 *     ordem do seletor, numeros e o HTML de cada estado;
 *  2. o CONTROLADOR no jsdom, com o HTML REAL da janela e um relogio manual:
 *     abrir, fechar, o `pedir` de 15 s que para ao fechar, um desenho por
 *     pacote e nada com a janela fechada;
 *  3. o COMPONENTE de verdade (`CacaMedidaIdle.js`), com rede e renderizador
 *     falsos: o pacote com `abrir` abre pelo `toggle()` sem pedir de novo, e
 *     o `toggle()` que fecha desliga o relogio;
 *  4. a COSTURA com o protocolo e o MapEngine, lendo o fonte (o MapEngine nao
 *     carrega no jsdom).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	CRITERIO,
	INTERVALO_DO_PEDIDO_MS,
	formatarNumero,
	lerCacaMedida,
	montarHtmlDaCacaMedida,
	ordenarMapas,
	seloDoMapa,
	textoDoCandidato,
	textoDoTempo
} from 'UI/Components/CacaMedidaIdle/formatoDaCacaMedida.js';
import { criarControladorDaCacaMedida } from 'UI/Components/CacaMedidaIdle/controladorDaCacaMedida.js';
import {
	estadoComMapas,
	estadoConcluido,
	estadoExplorando,
	estadoVazio,
	mapaMedido
} from '../fixtures/cacaMedidaEstado.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');
const HTML = ler('src/UI/Components/CacaMedidaIdle/CacaMedidaIdle.html');

/** O corpo desenhado, como DOM, para perguntar por seletor. */
function corpoDe(dados, criterio = CRITERIO.EXP) {
	const div = document.createElement('div');
	div.innerHTML = montarHtmlDaCacaMedida(dados, criterio);
	return div;
}

/* ================================================================== */
/* 1. A metade pura                                                    */
/* ================================================================== */

describe('lerCacaMedida: so o que e deste contrato vira estado', () => {
	it('le o payload do contrato', () => {
		const dados = lerCacaMedida(JSON.stringify(estadoComMapas()));
		expect(dados.mapas).toHaveLength(3);
		expect(dados.explorar.estado).toBe('parado');
	});

	it('JSON quebrado, outra versao ou sem `mapas` viram null', () => {
		expect(lerCacaMedida('{nao e json')).toBeNull();
		expect(lerCacaMedida(JSON.stringify({ ...estadoVazio(), v: 2 }))).toBeNull();
		expect(lerCacaMedida(JSON.stringify({ v: 1, explorar: { estado: 'parado' } }))).toBeNull();
	});

	it('um estado de Explorar ilegivel cai no "parado", sem perder os mapas', () => {
		const dados = lerCacaMedida(JSON.stringify({ ...estadoComMapas(), explorar: { estado: 'voando' } }));
		expect(dados.explorar).toEqual({ estado: 'parado' });
		expect(dados.mapas).toHaveLength(3);
	});
});

describe('seloDoMapa: Seguro / Cuidado / Arriscado', () => {
	it('zero mortes e Seguro', () => {
		expect(seloDoMapa(mapaMedido({ mortes: 0, mortesPorHora: 0 })).chave).toBe('seguro');
	});

	it('uma morte com taxa arredondada a 0/h NAO e Seguro — e Cuidado', () => {
		// Uma morte em 3 horas arredonda para 0/h: quem morreu la nao le "Seguro".
		expect(seloDoMapa(mapaMedido({ mortes: 1, mortesPorHora: 0 })).chave).toBe('cuidado');
	});

	it('abaixo de 2 mortes por hora e Cuidado; 2 ja e Arriscado (a fronteira)', () => {
		expect(seloDoMapa(mapaMedido({ mortes: 1, mortesPorHora: 1 })).chave).toBe('cuidado');
		expect(seloDoMapa(mapaMedido({ mortes: 2, mortesPorHora: 2 })).chave).toBe('arriscado');
		expect(seloDoMapa(mapaMedido({ mortes: 17, mortesPorHora: 32 })).rotulo).toBe('Arriscado');
	});
});

describe('ordenarMapas: o seletor Mais EXP | Mais zeny', () => {
	const nomes = lista => lista.map(m => m.mapa);

	it('Mais EXP ordena por expBasePorHora, do maior para o menor', () => {
		expect(nomes(ordenarMapas(estadoComMapas().mapas, CRITERIO.EXP))).toEqual(['orcsdun02', 'cmd_fild06', 'pay_dun00']);
	});

	it('Mais zeny ordena por zenyPorHora — a ordem INVERTE entre os dois medidos', () => {
		expect(nomes(ordenarMapas(estadoComMapas().mapas, CRITERIO.ZENY))).toEqual(['cmd_fild06', 'orcsdun02', 'pay_dun00']);
	});

	it('o que ainda esta medindo vem DEPOIS, mesmo com a maior taxa', () => {
		// pay_dun00 tem 99999/h em 4 minutos: ruido nao passa na frente de medida.
		const ordenada = ordenarMapas(estadoComMapas().mapas, CRITERIO.EXP);
		expect(ordenada[ordenada.length - 1].mapa).toBe('pay_dun00');
	});

	it('empate desempata pelo rotulo, e a lista original nao e mexida', () => {
		const mapas = [
			mapaMedido({ mapa: 'b', rotulo: 'Bosque', expBasePorHora: 100 }),
			mapaMedido({ mapa: 'a', rotulo: 'Areal', expBasePorHora: 100 })
		];
		expect(nomes(ordenarMapas(mapas, CRITERIO.EXP))).toEqual(['a', 'b']);
		expect(nomes(mapas)).toEqual(['b', 'a']);
	});

	it('criterio desconhecido cai no Mais EXP', () => {
		expect(nomes(ordenarMapas(estadoComMapas().mapas, 'qualquer'))).toEqual(['orcsdun02', 'cmd_fild06', 'pay_dun00']);
	});
});

describe('os textos', () => {
	it('numero com ponto de milhar, e travessao para o ausente', () => {
		expect(formatarNumero(16293)).toBe('16.293');
		expect(formatarNumero(1234567)).toBe('1.234.567');
		expect(formatarNumero(999)).toBe('999');
		expect(formatarNumero(0)).toBe('0');
		expect(formatarNumero(null)).toBe('—');
		expect(formatarNumero(undefined)).toBe('—');
	});

	it('"medido em N min" e "medindo N de 10 min"', () => {
		expect(textoDoTempo(mapaMedido({ minutos: 32, medido: true }))).toBe('medido em 32 min');
		expect(textoDoTempo(mapaMedido({ minutos: 4, medido: false }))).toBe('medindo 4 de 10 min');
	});

	it('o estado de cada candidato do Explorar', () => {
		expect(textoDoCandidato({ estado: 'esperando' })).toBe('Na fila');
		expect(textoDoCandidato({ estado: 'medindo', minutos: 6 })).toBe('Caçando agora · 6 de 10 min');
		expect(textoDoCandidato({ estado: 'medido', expBasePorHora: 14500 })).toBe('Sem mortes · 14.500 EXP/h');
		expect(textoDoCandidato({ estado: 'arriscado' })).toBe('Morreu aqui');
	});
});

describe('montarHtmlDaCacaMedida: os estados da janela', () => {
	it('antes do primeiro pacote: Carregando', () => {
		expect(corpoDe(null).textContent).toContain('Carregando');
	});

	it('VAZIO: "Ainda nao medimos sua caca" + a sugestao da escada + o Explorar', () => {
		const corpo = corpoDe(estadoVazio());
		expect(corpo.querySelector('.cm-vazio-titulo').textContent).toBe('Ainda não medimos sua caça');
		expect(corpo.querySelector('.cm-vazio-sugestao').textContent).toContain('Campos de Prontera');
		expect(corpo.querySelector('[data-acao="explorar"]').textContent).toBe('Explorar mapas para meu nível');
		expect(corpo.querySelectorAll('.cm-cartao')).toHaveLength(0);
	});

	it('vazio SEM sugestao nao inventa linha', () => {
		const corpo = corpoDe({ ...estadoVazio(), sugestaoDaEscada: null });
		expect(corpo.querySelector('.cm-vazio')).not.toBeNull();
		expect(corpo.querySelector('.cm-vazio-sugestao')).toBeNull();
	});

	it('so mapas MEDINDO continua mostrando o vazio, e o cartao parcial embaixo', () => {
		const dados = { ...estadoVazio(), mapas: [mapaMedido({ medido: false, minutos: 4 })] };
		const corpo = corpoDe(dados);
		expect(corpo.querySelector('.cm-vazio')).not.toBeNull();
		expect(corpo.querySelectorAll('.cm-cartao.is-medindo')).toHaveLength(1);
	});

	it('COM MAPAS: um cartao por mapa, com os seis numeros e o selo', () => {
		const corpo = corpoDe(estadoComMapas());
		expect(corpo.querySelector('.cm-vazio')).toBeNull();
		const cartoes = corpo.querySelectorAll('.cm-cartao');
		expect(cartoes).toHaveLength(3);
		const primeiro = cartoes[0];
		expect(primeiro.querySelector('.cm-nome').textContent).toBe('Masmorra dos Orcs');
		expect(primeiro.querySelector('.cm-tempo').textContent).toBe('medido em 32 min');
		const numeros = [...primeiro.querySelectorAll('.cm-numero dd')].map(dd => dd.textContent);
		expect(numeros).toEqual(['16.293', '9.100', '9.800', '1.448']);
		expect(primeiro.querySelector('.cm-selo').textContent).toBe('Arriscado');
		expect(corpo.querySelector('[data-mapa="cmd_fild06"] .cm-selo').textContent).toBe('Seguro');
		expect(corpo.querySelector('[data-mapa="pay_dun00"] .cm-selo').textContent).toBe('Cuidado');
	});

	it('o numero do criterio escolhido ganha destaque (e so ele)', () => {
		const exp = corpoDe(estadoComMapas(), CRITERIO.EXP).querySelector('.cm-cartao');
		expect([...exp.querySelectorAll('.cm-numero.is-destaque dt')].map(d => d.textContent)).toEqual(['EXP base/h']);
		const zeny = corpoDe(estadoComMapas(), CRITERIO.ZENY).querySelector('.cm-cartao');
		expect([...zeny.querySelectorAll('.cm-numero.is-destaque dt')].map(d => d.textContent)).toEqual(['Zeny/h']);
	});

	it('o mapa onde o jogador esta leva a marca "Voce esta aqui"', () => {
		const corpo = corpoDe(estadoComMapas());
		expect(corpo.querySelector('[data-mapa="cmd_fild06"]').classList.contains('is-atual')).toBe(true);
		expect(corpo.querySelectorAll('.cm-marca--aqui')).toHaveLength(1);
	});

	it('fichaAtual falso leva a marca "ficha anterior"; verdadeiro nao', () => {
		const dados = { ...estadoVazio(), mapas: [mapaMedido({ fichaAtual: false }), mapaMedido({ mapa: 'x', fichaAtual: true })] };
		const corpo = corpoDe(dados);
		expect(corpo.querySelectorAll('.cm-marca--anterior')).toHaveLength(1);
		expect(corpo.querySelector('[data-mapa="orcsdun02"] .cm-marca--anterior').textContent).toBe('ficha anterior');
	});

	it('EXPLORANDO: os candidatos com o estado de cada um, o em curso marcado, e Cancelar', () => {
		const corpo = corpoDe(estadoExplorando());
		const itens = corpo.querySelectorAll('.cm-candidato');
		expect(itens).toHaveLength(3);
		expect([...itens].map(i => i.querySelector('.cm-candidato-estado').textContent)).toEqual([
			'Morreu aqui',
			'Caçando agora · 6 de 10 min',
			'Na fila'
		]);
		expect(itens[1].classList.contains('is-em-curso')).toBe(true);
		expect(corpo.querySelectorAll('.is-em-curso')).toHaveLength(1);
		expect(corpo.querySelector('[data-acao="cancelar"]').textContent).toBe('Cancelar');
		// Durante a exploracao nao ha um segundo "Explorar" para apertar.
		expect(corpo.querySelector('[data-acao="explorar"]')).toBeNull();
	});

	it('CONCLUIDO com escolhido: diz onde ficou e marca o escolhido', () => {
		const corpo = corpoDe(estadoConcluido('cmd_fild06'));
		expect(corpo.querySelector('.cm-explorar-fim').textContent).toContain('Campos de Comodo');
		expect(corpo.querySelector('.cm-candidato.is-escolhido .cm-candidato-nome').textContent).toBe('Campos de Comodo');
		expect(corpo.querySelector('[data-acao="cancelar"]')).toBeNull();
		expect(corpo.querySelector('[data-acao="explorar"]')).not.toBeNull();
	});

	it('CONCLUIDO sem escolhido: avisa que ficou onde estava', () => {
		const corpo = corpoDe(estadoConcluido(null));
		expect(corpo.querySelector('.cm-explorar-fim').textContent).toBe('Nenhum mapa passou sem mortes. Você continua onde estava.');
		expect(corpo.querySelector('.is-escolhido')).toBeNull();
	});

	it('RESULTADO de erro e de sucesso aparecem com a classe certa', () => {
		const erro = corpoDe({ ...estadoVazio(), resultado: { ok: false, texto: 'Termine a missão ativa antes de explorar.' } });
		expect(erro.querySelector('.cm-resultado.is-erro').textContent).toBe('Termine a missão ativa antes de explorar.');
		const ok = corpoDe({ ...estadoVazio(), resultado: { ok: true, texto: 'Exploração cancelada.' } });
		expect(ok.querySelector('.cm-resultado.is-ok')).not.toBeNull();
		expect(corpoDe(estadoVazio()).querySelector('.cm-resultado')).toBeNull();
	});

	it('texto do servidor e ESCAPADO — rotulo nao vira HTML', () => {
		const dados = { ...estadoVazio(), mapas: [mapaMedido({ rotulo: '<img src=x onerror=alert(1)>' })] };
		const corpo = corpoDe(dados);
		expect(corpo.querySelector('img')).toBeNull();
		expect(corpo.querySelector('.cm-nome').textContent).toBe('<img src=x onerror=alert(1)>');
	});

	it('nenhuma imagem no corpo: a janela nao pede arte (secao 6)', () => {
		expect(montarHtmlDaCacaMedida(estadoComMapas(), CRITERIO.EXP)).not.toMatch(/<img/);
	});
});

/* ================================================================== */
/* 2. O controlador, com o HTML real e um relogio manual               */
/* ================================================================== */

function relogioManual() {
	const r = {
		proximo: 0,
		vivos: new Map(),
		limpos: [],
		setInterval(f, ms) {
			r.proximo += 1;
			r.vivos.set(r.proximo, { f, ms });
			return r.proximo;
		},
		clearInterval(id) {
			r.limpos.push(id);
			r.vivos.delete(id);
		},
		/** Um tique de 15 s em todo intervalo vivo. */
		tique() {
			for (const { f } of [...r.vivos.values()]) {
				f();
			}
		}
	};
	return r;
}

describe('o controlador da janela', () => {
	let raiz;
	let enviados;
	let relogio;
	let ctrl;
	let escritas;

	beforeEach(() => {
		raiz = document.createElement('div');
		raiz.innerHTML = HTML;
		enviados = [];
		relogio = relogioManual();
		ctrl = criarControladorDaCacaMedida({ raiz: () => raiz, enviar: a => enviados.push(a), relogio });
		// Conta as escritas no corpo: a regra e UM innerHTML por pacote.
		escritas = 0;
		const corpo = raiz.querySelector('.cm-corpo');
		const descritor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
		Object.defineProperty(corpo, 'innerHTML', {
			configurable: true,
			get() {
				return descritor.get.call(this);
			},
			set(v) {
				escritas += 1;
				descritor.set.call(this, v);
			}
		});
	});

	it('nasce fechada, sem relogio', () => {
		expect(ctrl.estaAberta()).toBe(false);
		expect(ctrl.relogioLigado).toBe(false);
	});

	it('abrir pede o estado na hora e liga o relogio de 15 s', () => {
		ctrl.abrir();
		expect(ctrl.estaAberta()).toBe(true);
		expect(enviados).toEqual(['pedir']);
		expect([...relogio.vivos.values()][0].ms).toBe(INTERVALO_DO_PEDIDO_MS);
		expect(INTERVALO_DO_PEDIDO_MS).toBe(15000);
		relogio.tique();
		relogio.tique();
		expect(enviados).toEqual(['pedir', 'pedir', 'pedir']);
	});

	it('FECHAR para o relogio: nenhum pedir depois', () => {
		ctrl.abrir();
		ctrl.fechar();
		expect(ctrl.relogioLigado).toBe(false);
		expect(relogio.vivos.size).toBe(0);
		relogio.tique();
		expect(enviados).toEqual(['pedir']);
	});

	it('quem tirar o is-open por fora desliga o relogio no proximo tique, sem pedir', () => {
		ctrl.abrir();
		raiz.querySelector('.cm-window').classList.remove('is-open');
		relogio.tique();
		expect(enviados).toEqual(['pedir']);
		expect(ctrl.relogioLigado).toBe(false);
	});

	it('abrir duas vezes nao empilha dois relogios', () => {
		ctrl.abrir();
		ctrl.abrir({ pedir: false });
		expect(relogio.vivos.size).toBe(1);
	});

	it('pacote com a janela FECHADA e sem abrir: ignorado, sem desenho', () => {
		expect(ctrl.receber(estadoComMapas())).toBe('ignorado');
		expect(escritas).toBe(0);
		expect(ctrl.dados).toBeNull();
	});

	it('pacote com abrir e a janela fechada: guarda e manda abrir, sem desenhar ainda', () => {
		expect(ctrl.receber({ ...estadoComMapas(), abrir: true })).toBe('abrir');
		expect(escritas).toBe(0);
		ctrl.abrir({ pedir: false });
		expect(escritas).toBe(1);
		expect(enviados).toEqual([]);
		expect(raiz.querySelectorAll('.cm-cartao')).toHaveLength(3);
	});

	it('com a janela ABERTA, cada pacote e UM desenho', () => {
		ctrl.abrir({ pedir: false });
		const antes = escritas;
		expect(ctrl.receber(estadoComMapas())).toBe('desenhou');
		expect(escritas - antes).toBe(1);
		ctrl.receber(estadoExplorando());
		expect(escritas - antes).toBe(2);
		expect(raiz.querySelectorAll('.cm-candidato')).toHaveLength(3);
	});

	it('o seletor reordena e marca o botao ativo', () => {
		ctrl.abrir({ pedir: false });
		ctrl.receber(estadoComMapas());
		const primeiro = () => raiz.querySelector('.cm-cartao').dataset.mapa;
		expect(primeiro()).toBe('orcsdun02');
		ctrl.trocarCriterio(CRITERIO.ZENY);
		expect(primeiro()).toBe('cmd_fild06');
		const ativo = raiz.querySelector('.cm-criterio.is-active');
		expect(ativo.dataset.criterio).toBe('zeny');
		expect(ativo.getAttribute('aria-pressed')).toBe('true');
		expect(raiz.querySelector('.cm-criterio[data-criterio="exp"]').getAttribute('aria-pressed')).toBe('false');
	});

	it('o criterio lembrado volta na criacao, e a troca avisa quem guarda', () => {
		const guardados = [];
		const outro = criarControladorDaCacaMedida({
			raiz: () => raiz,
			enviar: () => {},
			relogio,
			criterioInicial: CRITERIO.ZENY,
			aoTrocarCriterio: c => guardados.push(c)
		});
		expect(outro.criterio).toBe('zeny');
		outro.trocarCriterio(CRITERIO.EXP);
		outro.trocarCriterio(CRITERIO.EXP);
		expect(guardados).toEqual(['exp']);
	});

	it('o clique no Explorar manda o verbo UMA vez e desliga o botao', () => {
		ctrl.abrir({ pedir: false });
		ctrl.receber(estadoVazio());
		const botao = raiz.querySelector('[data-acao="explorar"]');
		ctrl.aoClicarNoCorpo({ target: botao });
		ctrl.aoClicarNoCorpo({ target: botao });
		expect(enviados).toEqual(['explorar']);
		expect(botao.disabled).toBe(true);
	});

	it('o clique no Cancelar manda cancelar', () => {
		ctrl.abrir({ pedir: false });
		ctrl.receber(estadoExplorando());
		ctrl.aoClicarNoCorpo({ target: raiz.querySelector('[data-acao="cancelar"]') });
		expect(enviados).toEqual(['cancelar']);
	});

	it('clique fora de botao nao manda nada', () => {
		ctrl.abrir({ pedir: false });
		ctrl.receber(estadoComMapas());
		ctrl.aoClicarNoCorpo({ target: raiz.querySelector('.cm-cartao') });
		expect(enviados).toEqual([]);
	});

	it('esquecer (troca de personagem) para o relogio e larga o dado', () => {
		ctrl.abrir({ pedir: false });
		ctrl.receber(estadoComMapas());
		ctrl.esquecer();
		expect(ctrl.relogioLigado).toBe(false);
		expect(ctrl.dados).toBeNull();
	});
});

/* ================================================================== */
/* 3. O componente de verdade, com rede e renderizador falsos          */
/* ================================================================== */

const mocks = vi.hoisted(() => ({ enviados: [], hooks: [] }));

vi.mock('Network/NetworkManager.js', () => ({
	default: {
		sendPacket: p => mocks.enviados.push(p),
		hookPacket: (pkt, cb) => mocks.hooks.push({ pkt, cb })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), vsync: [], width: 1280, height: 800 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));

describe('o componente CacaMedidaIdle', () => {
	let CacaMedidaIdle;
	let PACKET;

	beforeEach(async () => {
		vi.useFakeTimers();
		({ default: CacaMedidaIdle } = await import('UI/Components/CacaMedidaIdle/CacaMedidaIdle.js'));
		({ default: PACKET } = await import('Network/PacketStructure.js'));
		CacaMedidaIdle._host = document.createElement('div');
		CacaMedidaIdle._host.innerHTML = HTML;
		CacaMedidaIdle._shadow = null;
		CacaMedidaIdle.__active = true;
		CacaMedidaIdle.focus = () => {};
		CacaMedidaIdle.limparEstadoDoPersonagem();
		mocks.enviados.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const acoes = () => mocks.enviados.map(p => JSON.parse(p.json).acao);
	const chegar = dados => {
		const gancho = mocks.hooks.find(h => h.pkt === PACKET.ZC.RAGIDLE_CACA_MEDIDA);
		gancho.cb({ json: JSON.stringify(dados) });
	};

	it('fisga o 0x0fb5 e manda o verbo no 0x0fb4', () => {
		expect(mocks.hooks.some(h => h.pkt === PACKET.ZC.RAGIDLE_CACA_MEDIDA)).toBe(true);
		CacaMedidaIdle.toggle();
		expect(mocks.enviados[0]).toBeInstanceOf(PACKET.CZ.RAGIDLE_CACA_MEDIDA);
		const bytes = mocks.enviados[0].build();
		expect(bytes.buffer ? new DataView(bytes.buffer).getUint16(0, true) : null).toBe(0x0fb4);
	});

	it('o pacote com abrir ABRE pelo toggle, sem pedir de novo o que acabou de chegar', () => {
		const toggle = vi.spyOn(CacaMedidaIdle, 'toggle');
		chegar({ ...estadoComMapas(), abrir: true });
		expect(toggle).toHaveBeenCalledTimes(1);
		expect(CacaMedidaIdle.controlador.estaAberta()).toBe(true);
		expect(acoes()).toEqual([]);
		expect(CacaMedidaIdle._host.querySelectorAll('.cm-cartao')).toHaveLength(3);
		toggle.mockRestore();
	});

	it('sem abrir e com a janela fechada, o pacote nao abre nem desenha', () => {
		chegar(estadoComMapas());
		expect(CacaMedidaIdle.controlador.estaAberta()).toBe(false);
		expect(CacaMedidaIdle._host.querySelectorAll('.cm-cartao')).toHaveLength(0);
	});

	it('aberta: pede a cada 15 s; o X (toggle) fecha e o pedir PARA', () => {
		CacaMedidaIdle.toggle();
		expect(acoes()).toEqual(['pedir']);
		vi.advanceTimersByTime(15000);
		vi.advanceTimersByTime(15000);
		expect(acoes()).toEqual(['pedir', 'pedir', 'pedir']);
		CacaMedidaIdle.toggle();
		expect(CacaMedidaIdle.controlador.estaAberta()).toBe(false);
		vi.advanceTimersByTime(60000);
		expect(acoes()).toEqual(['pedir', 'pedir', 'pedir']);
	});

	it('a troca de personagem fecha, esquece e para o relogio', () => {
		CacaMedidaIdle.toggle();
		chegar(estadoComMapas());
		CacaMedidaIdle.limparEstadoDoPersonagem();
		expect(CacaMedidaIdle.controlador.estaAberta()).toBe(false);
		expect(CacaMedidaIdle.controlador.relogioLigado).toBe(false);
		expect(CacaMedidaIdle._host.querySelectorAll('.cm-cartao')).toHaveLength(0);
	});

	it('onRemove (troca de mapa) para o relogio; onAppend de janela aberta pede e religa', () => {
		CacaMedidaIdle.toggle();
		CacaMedidaIdle.onRemove();
		expect(CacaMedidaIdle.controlador.relogioLigado).toBe(false);
		mocks.enviados.length = 0;
		CacaMedidaIdle.onAppend();
		expect(acoes()).toEqual(['pedir']);
		expect(CacaMedidaIdle.controlador.relogioLigado).toBe(true);
		CacaMedidaIdle.toggle();
	});
});

/* ================================================================== */
/* 4. A costura, lida no fonte                                         */
/* ================================================================== */

describe('a costura com o protocolo e o MapEngine', () => {
	const registro = ler('src/Network/PacketRegister.js');
	const tamanhos = ler('src/Network/Packets/packets2021_len_main.js');
	const mapEngine = ler('src/Engine/MapEngine.js');
	const componente = ler('src/UI/Components/CacaMedidaIdle/CacaMedidaIdle.js');
	const css = ler('src/UI/Components/CacaMedidaIdle/CacaMedidaIdle.css');

	it('o 0x0fb5 e registrado para o ZC, e os dois tem tamanho variavel', () => {
		expect(registro).toMatch(/0x0fb5: PACKET\.ZC\.RAGIDLE_CACA_MEDIDA/);
		expect(tamanhos).toMatch(/length_list\[0x0fb4\] = -1;/);
		expect(tamanhos).toMatch(/length_list\[0x0fb5\] = -1;/);
	});

	it('a janela entra na pilha, na limpeza da troca de personagem e e anexada', () => {
		expect(mapEngine).toContain("['caca-medida', CacaMedidaIdle, '.cm-window']");
		expect(mapEngine).toMatch(/\t\tCacaMedidaIdle,\r?\n/);
		expect(mapEngine).toContain('CacaMedidaIdle.append();');
		expect(mapEngine).toContain('CacaMedidaIdle.prepare();');
	});

	it('D-993: o append NAO fica antes do CZ_NOTIFY_ACTORINIT', () => {
		const aperto = mapEngine.indexOf('Network.sendPacket(new PACKET.CZ.NOTIFY_ACTORINIT())');
		expect(aperto).toBeGreaterThan(-1);
		expect(mapEngine.indexOf('CacaMedidaIdle.append();')).toBeGreaterThan(aperto);
	});

	it('usa a limpeza compartilhada, e nao uma copia', () => {
		expect(componente).toContain("from '../limpezaDeJanelaIdle.js'");
		expect(componente).toMatch(/limparEstadoDoPersonagem = function limparEstadoDoPersonagem\(\) \{[\s\S]*?fecharEEsquecer\(/);
	});

	it('mobile: os criterios da HUD (a marca .ri-vertical e pointer: coarse) e alvo de 44px', () => {
		// A marca que o hudVertical carimba DENTRO do shadow; `:host-context` o
		// Safari do iPhone nao implementa.
		expect(css).toContain('.ri-vertical #CacaMedidaIdle');
		expect(css).not.toMatch(/^:host-context/m);
		expect(css).toContain('@media (pointer: coarse)');
		expect(css).toMatch(/min-height: var\(--hit-touch, 44px\)/);
		// Nenhum criterio de mobile novo: nada de matchMedia escrito aqui.
		expect(componente).not.toContain('matchMedia');
	});
});
