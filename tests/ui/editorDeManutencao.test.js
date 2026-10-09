/**
 * AS ABAS SOBREVIVENCIA, SUPORTE E COLETA do menu do Bot (Fase 6,
 * 07/10/2026), no DOM do jsdom:
 *  - o desenho so oferece as pocoes do eixo certo (com a quantidade), so as
 *    skills que o servidor marcou como suporte (com o tipo), "No grupo" so com
 *    `alcancaGrupo`, e cada gesto vira uma edicao pura do rascunho;
 *  - a COSTURA (a janela real montada): secao que o servidor nao anunciou nao
 *    aparece; a anunciada aparece, e editar suja o RASCUNHO sem mandar nada ate
 *    o Aplicar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desenharColeta, desenharSobrevivencia, desenharSuporte } from 'UI/Components/BotMenu/editorDeManutencao.js';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('DB/DBManager.js', () => ({
	default: { getItemInfo: id => (id === 909 ? { identifiedDisplayName: 'Jellopy' } : { identifiedDisplayName: 'Unknown Item' }) }
}));

const html = readFileSync(join(__dirname, '..', '..', 'src', 'UI', 'Components', 'BotMenu', 'BotMenu.html'), 'utf8');

const POCOES = [
	{ itemId: 501, nome: 'Poção Vermelha', hp: true, sp: false, quantidade: 12 },
	{ itemId: 505, nome: 'Poção Azul', hp: false, sp: true, quantidade: 3 },
	{ itemId: 607, nome: 'Fruto de Yggdrasil', hp: true, sp: true, quantidade: 1 }
];
const SKILLS = [
	{ skillId: 5, nome: 'Golpe Fulminante', aprendido: 10, aceita: true, suporte: null, alcancaGrupo: false },
	{ skillId: 29, nome: 'Aumentar Agilidade', aprendido: 10, aceita: false, suporte: 'buff', alcancaGrupo: false },
	{ skillId: 34, nome: 'Bênção', aprendido: 5, aceita: false, suporte: 'buff', alcancaGrupo: true },
	{ skillId: 28, nome: 'Curar', aprendido: 10, aceita: false, suporte: 'cura', alcancaGrupo: true }
];

let MOCHILA_DA_COLETA = [];

function configVazia() {
	return {
		v: 1,
		cacar: true,
		raioDePercepcao: 12,
		especiesVetadas: [],
		modoDeAtaque: 'skills-e-basico',
		skills: { geral: [], porSkill: {}, porMonstro: {} },
		sobrevivencia: {
			pocoesHp: { itens: [], abaixoDe: 0 },
			pocoesSp: { itens: [], abaixoDe: 0 },
			descanso: { sentarHpAbaixoDe: 0, sentarSpAbaixoDe: 0, levantarEm: 100 }
		},
		suporte: { lista: [] },
		coleta: { ligada: false, raio: 5, ignorar: [] }
	};
}

function mudar(input, valor, evento = 'change') {
	input.value = String(valor);
	input.dispatchEvent(new Event(evento));
}

const opcoes = select => [...select.options].map(o => o.textContent);

describe('o desenho das abas de manutencao', () => {
	let config;
	beforeEach(() => {
		document.body.innerHTML = html;
		config = configVazia();
	});

	describe('Sobrevivência', () => {
		let secao;
		function desenhar(pocoes = POCOES, teto = 6) {
			desenharSobrevivencia(secao, { config, pocoes, teto, nomeDoItem: () => null }, fn => {
				config = fn(config);
				desenhar(pocoes, teto);
			});
		}
		beforeEach(() => {
			secao = document.querySelector('[data-secao="sobrevivencia"]');
		});

		it('so oferece as pocoes do eixo certo, com a quantidade', () => {
			desenhar();
			const hp = secao.querySelector('[data-eixo="hp"] .bm-nova-pocao');
			const sp = secao.querySelector('[data-eixo="sp"] .bm-nova-pocao');
			expect(opcoes(hp)).toEqual(['Poção Vermelha (12)', 'Fruto de Yggdrasil (1)']);
			expect(opcoes(sp)).toEqual(['Poção Azul (3)', 'Fruto de Yggdrasil (1)']);
		});

		it('adicionar, ordenar e remover editam a lista do eixo; a oferta nao repete', () => {
			desenhar();
			const bloco = secao.querySelector('[data-eixo="hp"]');
			bloco.querySelector('.bm-add-pocao').click();
			bloco.querySelector('.bm-add-pocao').click();
			expect(config.sobrevivencia.pocoesHp.itens).toEqual([501, 607]);
			expect(config.sobrevivencia.pocoesSp.itens).toEqual([]);
			expect(bloco.querySelectorAll('.bm-nova-pocao option')).toHaveLength(0);
			expect(bloco.querySelector('.bm-add-pocao').disabled).toBe(true);
			expect(bloco.querySelector('[data-item="501"] .bm-quantidade').textContent).toBe('12 un.');
			bloco.querySelector('[data-item="607"] .bm-sobe').click();
			expect(config.sobrevivencia.pocoesHp.itens).toEqual([607, 501]);
			bloco.querySelector('[data-item="607"] .bm-remove').click();
			expect(config.sobrevivencia.pocoesHp.itens).toEqual([501]);
		});

		it('pocao da lista que acabou na mochila aparece "sem estoque"', () => {
			config.sobrevivencia.pocoesSp.itens = [505];
			desenhar(POCOES.filter(p => p.itemId !== 505));
			const li = secao.querySelector('[data-eixo="sp"] [data-item="505"]');
			expect(li.querySelector('.bm-item-nome').textContent).toBe('#505');
			expect(li.querySelector('.bm-quantidade').textContent).toBe('sem estoque');
		});

		it('o teto da lista desliga o Adicionar', () => {
			desenhar(POCOES, 1);
			secao.querySelector('[data-eixo="hp"] .bm-add-pocao').click();
			expect(secao.querySelector('[data-eixo="hp"] .bm-add-pocao').disabled).toBe(true);
		});

		it('limiares e descanso chegam ao rascunho; levantar abaixo do sentar avisa', () => {
			desenhar();
			mudar(secao.querySelector('[data-eixo="sp"] .bm-limiar'), 30);
			expect(config.sobrevivencia.pocoesSp.abaixoDe).toBe(30);
			mudar(secao.querySelector('[data-eixo="hp"] .bm-limiar'), 250);
			expect(config.sobrevivencia.pocoesHp.abaixoDe).toBe(99);
			expect(secao.querySelector('.bm-descanso-aviso').hidden).toBe(true);
			mudar(secao.querySelector('.bm-sentar-hp'), 40);
			mudar(secao.querySelector('.bm-levantar'), 35);
			expect(config.sobrevivencia.descanso).toEqual({ sentarHpAbaixoDe: 40, sentarSpAbaixoDe: 0, levantarEm: 35 });
			expect(secao.querySelector('.bm-descanso-aviso').hidden).toBe(false);
		});
	});

	describe('Suporte', () => {
		let secao;
		function desenhar(skills = SKILLS, teto = 8) {
			desenharSuporte(secao, { config, skills, teto }, fn => {
				config = fn(config);
				desenhar(skills, teto);
			});
		}
		beforeEach(() => {
			secao = document.querySelector('[data-secao="suporte"]');
		});

		it('so oferece skills com tipo de suporte, mostrando o tipo', () => {
			desenhar();
			expect(opcoes(secao.querySelector('.bm-novo-suporte'))).toEqual([
				'Aumentar Agilidade (Buff)',
				'Bênção (Buff)',
				'Curar (Cura)'
			]);
			expect(secao.querySelector('.bm-sem-suporte').hidden).toBe(true);
		});

		it('sem nenhuma skill de suporte: diz isso e esconde o Adicionar', () => {
			desenhar([SKILLS[0]]);
			expect(secao.querySelector('.bm-sem-suporte').hidden).toBe(false);
			expect(secao.querySelector('.bm-adicionar').hidden).toBe(true);
		});

		it('adicionar cura usa gatilho hp/60 e mostra o limiar; buff fica manter/0 sem limiar', () => {
			desenhar();
			const nova = secao.querySelector('.bm-novo-suporte');
			nova.value = '28';
			secao.querySelector('.bm-add-suporte').click();
			nova.value = '34';
			secao.querySelector('.bm-add-suporte').click();
			expect(config.suporte.lista).toEqual([
				{ skillId: 28, nivel: 'aprendido', destino: 'eu', gatilho: 'hp', limiar: 60 },
				{ skillId: 34, nivel: 'aprendido', destino: 'eu', gatilho: 'manter', limiar: 0 }
			]);
			const cura = secao.querySelector('[data-indice="0"]');
			expect(cura.querySelector('.bm-tipo').textContent).toBe('Cura');
			expect(cura.querySelector('.bm-limiar').value).toBe('60');
			mudar(cura.querySelector('.bm-limiar'), 35);
			expect(config.suporte.lista[0].limiar).toBe(35);
			const buff = secao.querySelector('[data-indice="1"]');
			expect(buff.querySelector('.bm-tipo').textContent).toBe('Buff');
			expect(buff.querySelector('.bm-limiar')).toBeNull();
		});

		it('"No grupo" so aparece para skill que alcanca o grupo', () => {
			desenhar();
			const nova = secao.querySelector('.bm-novo-suporte');
			nova.value = '29';
			secao.querySelector('.bm-add-suporte').click();
			nova.value = '34';
			secao.querySelector('.bm-add-suporte').click();
			const agi = secao.querySelector('[data-indice="0"] .bm-destino');
			expect(opcoes(agi)).toEqual(['Em mim']);
			expect(agi.disabled).toBe(true);
			const bencao = secao.querySelector('[data-indice="1"] .bm-destino');
			expect(opcoes(bencao)).toEqual(['Em mim', 'No grupo']);
			mudar(bencao, 'grupo');
			expect(config.suporte.lista[1].destino).toBe('grupo');
			// Livre "em mim" de novo, a Bencao volta a ser oferecida (agora para mim).
			expect(opcoes(secao.querySelector('.bm-novo-suporte'))).toContain('Bênção (Buff)');
		});

		it('nivel, ordem e remocao chegam ao rascunho; o teto desliga o Adicionar', () => {
			desenhar(SKILLS, 2);
			const nova = secao.querySelector('.bm-novo-suporte');
			nova.value = '29';
			secao.querySelector('.bm-add-suporte').click();
			nova.value = '34';
			secao.querySelector('.bm-add-suporte').click();
			expect(secao.querySelector('.bm-add-suporte').disabled).toBe(true);
			const nivel = secao.querySelector('[data-indice="1"] .bm-skill-nivel');
			expect(opcoes(nivel)).toEqual(['Aprendido', 'Nv 1', 'Nv 2', 'Nv 3', 'Nv 4', 'Nv 5']);
			mudar(nivel, 3);
			expect(config.suporte.lista[1].nivel).toBe(3);
			secao.querySelector('[data-indice="1"] .bm-sobe').click();
			expect(config.suporte.lista.map(e => e.skillId)).toEqual([34, 29]);
			secao.querySelector('[data-indice="0"] .bm-remove').click();
			expect(config.suporte.lista.map(e => e.skillId)).toEqual([29]);
		});
	});

	describe('Coleta', () => {
		let secao;
		function desenhar(teto = 300) {
			desenharColeta(
				secao,
				{
					config,
					teto,
					raioMinimo: 1,
					raioMaximo: 15,
					nomeDoItem: id => (id === 909 ? 'Jellopy' : null),
					mochila: () => MOCHILA_DA_COLETA
				},
				fn => {
					config = fn(config);
					desenhar(teto);
				}
			);
		}
		beforeEach(() => {
			secao = document.querySelector('[data-secao="coleta"]');
			// Fora da ordem do nome e com o 909 em duas pilhas: o seletor ordena e nao repete.
			MOCHILA_DA_COLETA = [
				{ itemId: 501, nome: 'Poção Vermelha', quantidade: 5 },
				{ itemId: 909, nome: 'Jellopy', quantidade: 3 },
				{ itemId: 7001, quantidade: 1 },
				{ itemId: 909, nome: 'Jellopy', quantidade: 9 }
			];
		});

		it('interruptor e raio chegam ao rascunho, dentro de 1..15', () => {
			desenhar();
			const liga = secao.querySelector('.bm-coletar');
			liga.checked = true;
			liga.dispatchEvent(new Event('change'));
			expect(config.coleta.ligada).toBe(true);
			const raio = secao.querySelector('.bm-raio-coleta');
			expect([raio.min, raio.max]).toEqual(['1', '15']);
			mudar(raio, 9, 'input');
			expect(config.coleta.raio).toBe(9);
			expect(secao.querySelector('.bm-raio-coleta-valor').textContent).toBe('9');
		});

		it('ignorar escolhe o item da mochila pelo nome (sem campo de ID), sem repetir, e voltar a coletar', () => {
			desenhar();
			expect(secao.querySelector('.bm-novo-ignorado'), 'o campo de ID digitado nao existe mais').toBeNull();
			expect(secao.textContent).not.toMatch(/\bID\b/);
			const abrir = secao.querySelector('.bm-escolher-ignorado .bm-escolher');
			abrir.click();
			const opcoes = () => [...secao.querySelectorAll('.bm-escolher-ignorado .bm-opcao-item .bm-item-nome')].map(n => n.textContent);
			// Ordem do nome; o 7001 sem nome (nem no cliente nem na janela) nao e oferecido.
			expect(opcoes()).toEqual(['Jellopy', 'Poção Vermelha']);
			// A primeira pilha vale (x3); a repetida nao sobrescreve.
			expect(secao.querySelector('.bm-escolher-ignorado .bm-opcao-item .bm-quantidade').textContent).toBe('x3');
			secao.querySelector('.bm-escolher-ignorado .bm-opcao-item').click();
			expect(config.coleta.ignorar).toEqual([909]);
			const nomes = [...secao.querySelectorAll('.bm-ignorado .bm-item-nome')].map(n => n.textContent);
			expect(nomes).toEqual(['Jellopy']);
			// O ja ignorado nao volta como candidato.
			secao.querySelector('.bm-escolher-ignorado .bm-escolher').click();
			expect(opcoes()).toEqual(['Poção Vermelha']);
			secao.querySelector('[data-item="909"] .bm-remove').click();
			expect(config.coleta.ignorar).toEqual([]);
		});

		it('mochila vazia: o seletor explica o motivo', () => {
			MOCHILA_DA_COLETA = [];
			desenhar();
			secao.querySelector('.bm-escolher-ignorado .bm-escolher').click();
			expect(secao.querySelector('.bm-escolher-ignorado .bm-seletor-vazio').textContent).toMatch(/Nenhum item na mochila/);
		});

		it('o teto da lista desliga o botao de escolher', () => {
			config.coleta.ignorar = [909];
			desenhar(1);
			expect(secao.querySelector('.bm-escolher-ignorado .bm-escolher').disabled).toBe(true);
		});
	});
});

describe('a costura das abas de manutencao na janela real', () => {
	async function montar() {
		vi.resetModules();
		localStorage.clear();
		const { default: Network } = await import('Network/NetworkManager.js');
		const { default: BotMenu } = await import('UI/Components/BotMenu/BotMenu.js');
		BotMenu._host = document.createElement('div');
		BotMenu._host.innerHTML = html;
		BotMenu._shadow = null;
		BotMenu.draggable = () => {};
		BotMenu.init();
		const chamada = Network.hookPacket.mock.calls.at(-1);
		const receber = d => chamada[1]({ json: JSON.stringify(d) });
		return { BotMenu, Network, receber };
	}

	function status(secoes, extra = {}) {
		return {
			v: 1,
			tipo: 'status',
			requestId: null,
			personagemId: 7,
			mapa: 'prt_fild08',
			ok: true,
			erro: null,
			problemas: [],
			revisao: 0,
			config: configVazia(),
			ligado: false,
			situacao: 'desligado',
			status: { codigo: 'controle-manual', alvo: null },
			statusRevision: 0,
			capacidades: {
				contrato: 1,
				versaoDaConfig: 1,
				limites: {
					raioMinimo: 3,
					raioMaximo: 30,
					pocoesPorLista: 6,
					skillsDeSuporte: 8,
					itensIgnoradosNaColeta: 300,
					raioDeColetaMinimo: 1,
					raioDeColetaMaximo: 15
				},
				secoes
			},
			monstros: [],
			skills: SKILLS,
			pocoes: POCOES,
			...extra
		};
	}

	const abas = host => [...host.querySelectorAll('.bm-abas .ri-tab')].map(b => b.textContent);
	const secaoVisivel = host => [...host.querySelectorAll('.bm-secao')].filter(s => !s.hidden).map(s => s.dataset.secao);

	it('secao que o servidor nao anunciou nao aparece', async () => {
		const { BotMenu, receber } = await montar();
		receber(status(['cacada', 'ataque']));
		expect(abas(BotMenu._host)).toEqual(['Caçada', 'Ataque']);
		expect(secaoVisivel(BotMenu._host)).toEqual(['cacada']);
		// Nem desenhada: a oferta de pocoes fica vazia.
		expect(BotMenu._host.querySelectorAll('.bm-nova-pocao option')).toHaveLength(0);
	});

	it('anunciada, a aba aparece; editar suja o RASCUNHO e nada vai ao servidor ate o Aplicar', async () => {
		const { BotMenu, Network, receber } = await montar();
		receber(status(['cacada', 'ataque', 'sobrevivencia', 'suporte', 'coleta']));
		const host = BotMenu._host;
		// A ordem da barra e a do mockup do dono (08/10/2026), nao a do anuncio.
		expect(abas(host)).toEqual(['Caçada', 'Ataque', 'Suporte', 'Sobrevivência', 'Coleta']);
		expect(BotMenu._estado.estado().pocoes).toEqual(POCOES);
		[...host.querySelectorAll('.bm-abas .ri-tab')].find(b => b.textContent === 'Sobrevivência').click();
		expect(secaoVisivel(host)).toEqual(['sobrevivencia']);

		const enviadosAntes = Network.sendPacket.mock.calls.length;
		host.querySelector('[data-eixo="hp"] .bm-add-pocao').click();
		const novo = host.querySelector('.bm-novo-suporte');
		novo.value = '28';
		host.querySelector('.bm-add-suporte').click();
		const coletar = host.querySelector('.bm-coletar');
		coletar.checked = true;
		coletar.dispatchEvent(new Event('change'));

		const s = BotMenu._estado.estado();
		expect(s.dirty).toBe(true);
		expect(s.editConfig.sobrevivencia.pocoesHp.itens).toEqual([501]);
		expect(s.editConfig.suporte.lista[0]).toMatchObject({ skillId: 28, gatilho: 'hp', limiar: 60 });
		expect(s.editConfig.coleta.ligada).toBe(true);
		expect(s.serverConfig.coleta.ligada).toBe(false);
		expect(Network.sendPacket.mock.calls.length).toBe(enviadosAntes);
		expect(host.querySelector('.bm-aplicar').disabled).toBe(false);

		host.querySelector('.bm-aplicar').click();
		const pkt = Network.sendPacket.mock.calls.at(-1)[0];
		const corpo = JSON.parse(pkt.json);
		expect(corpo.verbo).toBe('aplicar');
		expect(corpo.config.coleta.ligada).toBe(true);
	});
});
