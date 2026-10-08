/**
 * AS ABAS ARMAZEM E PERFIS do menu do Bot (Fase 9, 08/10/2026):
 *  - edicao pura do bloco `armazem` (liga, cidade, peso, deposito com reserva,
 *    reposicao com minimo < ate, teto), sem mutar a config recebida;
 *  - a COSTURA na janela real: as abas so com a capacidade; o armazem suja o
 *    RASCUNHO; os perfis sao verbos imediatos (salvar, usar com a revisao
 *    confirmada, renomear, excluir) e o header mostra o perfil e a postura.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	adicionarReposicao,
	alternarDeposito,
	candidatosDoArmazem,
	definirCidade,
	definirPesoDoGatilho,
	definirReposicao,
	definirReserva,
	lerArmazem,
	ligarArmazem,
	removerReposicao
} from 'UI/Components/BotMenu/edicaoDeArmazem.js';
import { fraseDoErro, fraseDoStatus } from 'UI/Components/BotMenu/estadoDoBot.js';
import { filtrarCandidatos, normalizarNome } from 'UI/Components/BotMenu/seletorDeItem.js';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('DB/DBManager.js', () => ({
	default: {
		getItemInfo: id =>
			id === 909
				? { identifiedDisplayName: 'Jellopy' }
				: id === 501
					? { identifiedDisplayName: 'Poção Vermelha' }
					: { identifiedDisplayName: 'Unknown Item' }
	}
}));
vi.mock('UI/itemNaTela.js', () => ({ aplicarIconeDoItem: (img, id) => img.setAttribute('src', '/ragidle/item/' + id + '.png') }));

const html = readFileSync(join(__dirname, '..', '..', 'src', 'UI', 'Components', 'BotMenu', 'BotMenu.html'), 'utf8');

function congelar(o) {
	if (o && typeof o === 'object') {
		Object.values(o).forEach(congelar);
		Object.freeze(o);
	}
	return o;
}

describe('edicao do armazem (pura)', () => {
	it('servidor velho sem o bloco le o padrao desligado; nada muta a recebida', () => {
		const c = congelar({ v: 1 });
		expect(lerArmazem(c)).toEqual({ ligado: false, cidade: null, pesoAcimaDe: 0, depositar: [], reservas: [], repor: [], tetoDeGasto: 0, voltar: true });
		const nova = definirPesoDoGatilho(definirCidade(ligarArmazem(c, true), 'prontera'), 150);
		expect(nova.armazem).toMatchObject({ ligado: true, cidade: 'prontera', pesoAcimaDe: 99 });
		expect(definirCidade(nova, '').armazem.cidade).toBeNull();
	});

	it('deposito com teto e reserva (0 remove)', () => {
		let c = alternarDeposito({ v: 1 }, 909, 1);
		expect(alternarDeposito(c, 910, 1)).toBe(c);
		c = definirReserva(c, 909, 10, 5);
		expect(lerArmazem(c).reservas).toEqual([{ itemId: 909, quantidade: 10 }]);
		expect(lerArmazem(definirReserva(c, 909, 0, 5)).reservas).toEqual([]);
		expect(lerArmazem(alternarDeposito(c, 909)).depositar).toEqual([]);
	});

	it('reposicao: padrao 5 ate 20, o alvo sempre acima do minimo, remover', () => {
		let c = adicionarReposicao({ v: 1 }, 501, 12);
		expect(lerArmazem(c).repor).toEqual([{ itemId: 501, minimo: 5, ate: 20 }]);
		expect(adicionarReposicao(c, 501, 12)).toBe(c);
		c = definirReposicao(c, 501, 'minimo', 30);
		expect(lerArmazem(c).repor[0]).toEqual({ itemId: 501, minimo: 30, ate: 31 });
		c = definirReposicao(c, 501, 'ate', 10);
		expect(lerArmazem(c).repor[0].ate).toBe(31);
		expect(lerArmazem(removerReposicao(c, 501)).repor).toEqual([]);
	});

	/*
	 * Correcoes pos-QA (08/10/2026; contrato 05 secao 3: a interface nao expoe IDs): o seletor do Armazem
	 * escolhe da mochila (guardar) e da mochila + pocoes + municoes do servidor (repor), pelo nome.
	 */
	it('candidatos: guardar = mochila; repor = mochila + pocoes + municoes; sem repetir, sem o que ja esta, sem item sem nome, pelo nome', () => {
		const nomeLocal = id => ({ 909: 'Jellopy', 501: 'Poção Vermelha' })[id] || null;
		const fontes = {
			mochila: [{ itemId: 909, quantidade: 3 }, { itemId: 7001, quantidade: 1 }, { itemId: 501, quantidade: 2 }],
			pocoes: [{ itemId: 501, nome: 'Red Potion', quantidade: 2 }, { itemId: 502, nome: 'Orange Potion', quantidade: 0 }],
			municoes: [{ itemId: 1750, nome: 'Arrow', quantidade: 500 }]
		};
		const c = congelar({ v: 1, armazem: { depositar: [909], repor: [{ itemId: 1750, minimo: 5, ate: 20 }] } });
		expect(candidatosDoArmazem('depositar', c, fontes, nomeLocal)).toEqual([{ itemId: 501, nome: 'Poção Vermelha', quantidade: 2 }]);
		expect(candidatosDoArmazem('repor', c, fontes, nomeLocal)).toEqual([
			{ itemId: 909, nome: 'Jellopy', quantidade: 3 },
			{ itemId: 502, nome: 'Orange Potion', quantidade: 0 },
			{ itemId: 501, nome: 'Poção Vermelha', quantidade: 2 }
		]);
		// Sem nome local, o do servidor; sem nenhum, fora (so daria para mostrar o id).
		expect(candidatosDoArmazem('repor', { v: 1 }, { pocoes: [{ itemId: 503, nome: ' ' }, { itemId: 504, nome: 'Yellow Potion' }] }, () => null)).toEqual([
			{ itemId: 504, nome: 'Yellow Potion' }
		]);
		expect(candidatosDoArmazem('depositar', { v: 1 }, { mochila: [{ itemId: 0 }, { itemId: 1.5 }, null] }, () => 'x')).toEqual([]);
	});

	it('o filtro do seletor acha pelo nome sem acento nem caixa', () => {
		expect(normalizarNome('  Poção VERMELHA ')).toBe('pocao vermelha');
		const lista = [{ itemId: 1, nome: 'Poção Vermelha' }, { itemId: 2, nome: 'Jellopy' }];
		expect(filtrarCandidatos(lista, 'pocao').map(x => x.itemId)).toEqual([1]);
		expect(filtrarCandidatos(lista, '').map(x => x.itemId)).toEqual([1, 2]);
		expect(filtrarCandidatos(lista, 'zzz')).toEqual([]);
	});

	it('as frases novas: status do armazem com o motivo e os erros de perfil', () => {
		expect(fraseDoStatus({ codigo: 'armazem-indisponivel', alvo: null, detalhe: 'sem-loja' })).toBe('Armazém indisponível: a loja não vende o que falta');
		expect(fraseDoStatus({ codigo: 'indo-ao-armazem', alvo: null })).toBe('Indo ao armazém');
		expect(fraseDoErro('perfil-invalido')).toBe('Esse perfil não vale para o personagem agora. Nada foi alterado.');
	});
});

describe('a costura das abas Armazem e Perfis na janela real', () => {
	async function montar() {
		vi.resetModules();
		localStorage.clear();
		const { default: Network } = await import('Network/NetworkManager.js');
		const { default: BotMenu } = await import('UI/Components/BotMenu/BotMenu.js');
		BotMenu._host = document.createElement('div');
		BotMenu._host.innerHTML = html;
		BotMenu._shadow = null;
		BotMenu.draggable = () => {};
		BotMenu.lerMochila = () => [{ ITID: 909, count: 3 }, { ITID: 0, count: 1 }];
		BotMenu.init();
		const chamada = Network.hookPacket.mock.calls.at(-1);
		const receber = d => chamada[1]({ json: JSON.stringify(d) });
		return { BotMenu, Network, receber };
	}
	const status = (secoes, extra = {}) => ({
		v: 1,
		tipo: 'status',
		requestId: null,
		personagemId: 7,
		mapa: 'prt_fild08',
		ok: true,
		erro: null,
		problemas: [],
		revisao: 4,
		config: {
			v: 1,
			cacar: true,
			raioDePercepcao: 12,
			especiesVetadas: [],
			modoDeAtaque: 'skills-e-basico',
			skills: { geral: [], porSkill: {}, porMonstro: {} },
			postura: { tipo: 'tank', fallbackMelee: false }
		},
		ligado: false,
		situacao: 'desligado',
		status: { codigo: 'controle-manual', alvo: null },
		statusRevision: 0,
		capacidades: { contrato: 1, versaoDaConfig: 1, limites: { itensNoDeposito: 100, reservasNoDeposito: 30, itensNaReposicao: 12 }, secoes },
		monstros: [],
		skills: [],
		pocoes: [],
		perfis: [{ nome: 'Party', classe: 7, postura: 'tank' }],
		perfilAtivo: 'Party',
		cidades: [{ mapa: 'prontera', rotulo: 'Prontera' }],
		...extra
	});
	const abas = host => [...host.querySelectorAll('.bm-abas .ri-tab')].map(b => b.textContent);
	const ultimo = Network => JSON.parse(Network.sendPacket.mock.calls.at(-1)[0].json);

	it('sem a capacidade as abas nao aparecem; com ela, o header mostra perfil e postura', async () => {
		const { BotMenu, receber } = await montar();
		receber(status(['cacada']));
		expect(abas(BotMenu._host)).not.toContain('Armazém');
		receber(status(['cacada', 'armazem', 'perfis'], { statusRevision: 1 }));
		expect(abas(BotMenu._host)).toEqual(expect.arrayContaining(['Armazém', 'Perfis']));
		expect(BotMenu._host.querySelector('.bm-perfil-ativo').textContent).toBe('Party · Tanque');
	});

	it('armazem: ligar, escolher a cidade e guardar o Jellopy sujam o RASCUNHO; nada vai ao servidor ate o Aplicar', async () => {
		const { BotMenu, Network, receber } = await montar();
		receber(status(['cacada', 'armazem']));
		const host = BotMenu._host;
		const antes = Network.sendPacket.mock.calls.length;
		const liga = host.querySelector('.bm-armazem-ligado');
		liga.checked = true;
		liga.dispatchEvent(new Event('change'));
		const cidade = host.querySelector('.bm-armazem-cidade');
		expect([...cidade.options].map(o => o.value)).toEqual(['', 'prontera']);
		cidade.value = 'prontera';
		cidade.dispatchEvent(new Event('change'));
		// Correcoes pos-QA: o Jellopy e escolhido da MOCHILA pelo nome e pelo icone (nada de ID digitado).
		const escolher = host.querySelector('.bm-escolher-deposito .bm-escolher');
		const painel = host.querySelector('.bm-escolher-deposito .bm-seletor');
		expect(painel.hidden).toBe(true);
		escolher.click();
		expect(painel.hidden).toBe(false);
		expect(escolher.getAttribute('aria-expanded')).toBe('true');
		const opcoes = [...painel.querySelectorAll('.bm-opcao-item')];
		expect(opcoes.map(o => o.querySelector('.bm-item-nome').textContent)).toEqual(['Jellopy']);
		expect(opcoes[0].querySelector('.bm-quantidade').textContent).toBe('x3');
		expect(opcoes[0].querySelector('.bm-item-icone').getAttribute('src')).toBe('/ragidle/item/909.png');
		opcoes[0].click();
		expect(painel.hidden, 'o seletor nao fechou depois da escolha').toBe(true);
		expect(host.querySelector('.bm-armazem-depositar [data-item="909"] .bm-item-nome').textContent).toBe('Jellopy');
		expect(host.querySelector('.bm-armazem-depositar [data-item="909"] .bm-item-icone').getAttribute('src')).toBe('/ragidle/item/909.png');
		// Reaberto, o que ja esta na lista nao e candidato.
		host.querySelector('.bm-escolher-deposito .bm-escolher').click();
		expect(host.querySelector('.bm-escolher-deposito .bm-seletor-vazio').textContent).toBe('Nada na mochila para guardar.');
		expect(Network.sendPacket.mock.calls.length).toBe(antes);
		expect(BotMenu._estado.estado().editConfig.armazem).toMatchObject({ ligado: true, cidade: 'prontera', depositar: [909] });
		host.querySelector('.bm-aplicar').click();
		expect(ultimo(Network).config.armazem.cidade).toBe('prontera');
	});

	it('armazem: repor escolhe da lista de pocoes do servidor e filtra pelo nome; nenhum ID aparece na secao (05 secao 3)', async () => {
		const { BotMenu, receber } = await montar();
		receber(status(['cacada', 'armazem'], { pocoes: [{ itemId: 501, nome: 'Red Potion', hp: true, sp: false, quantidade: 4 }] }));
		const host = BotMenu._host;
		const bloco = host.querySelector('.bm-escolher-reposicao');
		bloco.querySelector('.bm-escolher').click();
		const filtro = bloco.querySelector('.bm-seletor-filtro');
		filtro.value = 'espada';
		filtro.dispatchEvent(new Event('input'));
		expect(bloco.querySelector('.bm-seletor-vazio').textContent).toBe('Nenhum item com esse nome.');
		filtro.value = 'POCAO';
		filtro.dispatchEvent(new Event('input'));
		const [pocao] = bloco.querySelectorAll('.bm-opcao-item');
		expect(pocao.querySelector('.bm-item-nome').textContent).toBe('Poção Vermelha');
		pocao.click();
		expect(BotMenu._estado.estado().editConfig.armazem.repor).toEqual([{ itemId: 501, minimo: 5, ate: 20 }]);
		expect(host.querySelector('.bm-armazem-repor [data-item="501"] .bm-item-nome').textContent).toBe('Poção Vermelha');
		// O ESC e o voltar do Android fecham o seletor ANTES da janela (balao da HUD, `pilhaDeJanelas.aoEscapar`).
		const { fecharBalaoDaHud } = await import('UI/balaoDaHud.js');
		bloco.querySelector('.bm-escolher').click();
		expect(bloco.querySelector('.bm-seletor').hidden).toBe(false);
		expect(fecharBalaoDaHud(), 'o seletor aberto nao e balao da HUD (o ESC fecharia a janela)').toBe(true);
		expect(bloco.querySelector('.bm-seletor').hidden).toBe(true);
		expect(bloco.querySelector('.bm-escolher').getAttribute('aria-expanded')).toBe('false');
		expect(fecharBalaoDaHud(), 'o balao nao saiu da lista ao fechar').toBe(false);
		// Escolher um item tambem tira o seletor da lista de baloes (sem ESC orfao).
		bloco.querySelector('.bm-escolher').click();
		bloco.querySelector('.bm-opcao-item')?.click();
		expect(fecharBalaoDaHud(), 'balao orfao depois de escolher').toBe(false);
		// Nenhum texto, rotulo ou dica da secao pede ou mostra o ID do item.
		const secao = host.querySelector('[data-secao="armazem"]');
		const textos = [
			secao.textContent,
			...[...secao.querySelectorAll('[placeholder]')].map(e => e.getAttribute('placeholder')),
			...[...secao.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')),
			...[...secao.querySelectorAll('[title]')].map(e => e.getAttribute('title'))
		].join(' | ');
		expect(textos).not.toMatch(/\bID\b|#\d|\b501\b/);
		expect(secao.querySelectorAll('input[type="number"].bm-novo-deposito, input.bm-nova-reposicao').length).toBe(0);
	});

	it('armazem: o item da config que o cliente nao conhece aparece como "Item desconhecido", nunca pelo numero', async () => {
		const { BotMenu, receber } = await montar();
		const comLista = status(['cacada', 'armazem']);
		comLista.config = { ...comLista.config, armazem: { ligado: false, cidade: null, pesoAcimaDe: 0, depositar: [7001], reservas: [], repor: [], tetoDeGasto: 0, voltar: true } };
		receber(comLista);
		expect(BotMenu._host.querySelector('.bm-armazem-depositar [data-item="7001"] .bm-item-nome').textContent).toBe('Item desconhecido');
	});

	it('perfis: salvar, usar (com a revisao confirmada), renomear e excluir sao verbos imediatos', async () => {
		const { BotMenu, Network, receber } = await montar();
		receber(status(['cacada', 'perfis']));
		const host = BotMenu._host;
		const nome = host.querySelector('.bm-perfil-nome');
		nome.value = '  Solo ';
		host.querySelector('.bm-perfil-salvar').click();
		expect(ultimo(Network)).toMatchObject({ verbo: 'perfil-salvar', nome: 'Solo' });
		expect(ultimo(Network).config).toBeUndefined();
		receber({ ...status(['cacada', 'perfis']), tipo: 'resposta', requestId: ultimo(Network).requestId, statusRevision: 1 });
		host.querySelector('[data-perfil="Party"] .bm-perfil-aplicar').click();
		expect(ultimo(Network)).toMatchObject({ verbo: 'perfil-aplicar', nome: 'Party', baseRevision: 4 });
		receber({ ...status(['cacada', 'perfis']), tipo: 'resposta', requestId: ultimo(Network).requestId, statusRevision: 2 });
		nome.value = 'Grupo';
		host.querySelector('[data-perfil="Party"] .bm-perfil-renomear').click();
		expect(ultimo(Network)).toMatchObject({ verbo: 'perfil-renomear', nome: 'Party', novoNome: 'Grupo' });
		receber({ ...status(['cacada', 'perfis']), tipo: 'resposta', requestId: ultimo(Network).requestId, statusRevision: 3 });
		host.querySelector('[data-perfil="Party"] .bm-remove').click();
		expect(ultimo(Network)).toMatchObject({ verbo: 'perfil-excluir', nome: 'Party' });
		expect(BotMenu._estado.estado().dirty).toBe(false);
	});

	it('perfil recusado: a frase do erro aparece e o rascunho fica', async () => {
		const { BotMenu, Network, receber } = await montar();
		receber(status(['cacada', 'perfis']));
		BotMenu._host.querySelector('[data-perfil="Party"] .bm-perfil-aplicar').click();
		const pedido = ultimo(Network);
		receber({ ...status(['cacada', 'perfis']), tipo: 'resposta', requestId: pedido.requestId, ok: false, erro: 'perfil-invalido', problemas: [{ campo: 'armazem.cidade', mensagem: 'a cidade precisa ter Kafra' }], statusRevision: 1 });
		expect(BotMenu._host.querySelector('.bm-recado').textContent).toBe(fraseDoErro('perfil-invalido'));
		expect([...BotMenu._host.querySelectorAll('.bm-problemas li')].map(l => l.textContent)).toEqual(['a cidade precisa ter Kafra']);
	});
});
