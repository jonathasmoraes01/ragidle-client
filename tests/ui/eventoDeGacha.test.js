/**
 * O EVENTO DE GACHA NO PAINEL DE ADMIN (D-1900, 01/10/2026).
 *
 * Duas metades, medidas de jeitos diferentes (o molde de
 * `eventosDaEquipe.test.js`):
 *
 * 1. as DECISOES puras (`eventoDeGacha.js`: o pedido, o rascunho, o HTML da
 *    secao) rodam de verdade aqui;
 * 2. a COSTURA (o painel liga os botoes, o icone tem entrada e traducao, o
 *    dedo alcanca os controles) e lida no fonte — levantar a janela puxa WebGL
 *    e uma sessao logada. Quem a olha de verdade e o celular (ver o relatorio
 *    da entrega: a tela NAO foi verificada desta worktree).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import StatusInfo, { EFST_DO_EVENTO_DE_GACHA } from 'DB/Status/StatusInfo.js';
import { emPortugues } from 'DB/Status/StatusInfoPtBr.js';
import {
	htmlDoEventoDeGacha,
	pedidoDeEncerrarDoGacha,
	pedidoDeIniciarDoGacha,
	rascunhoDoGacha
} from '../../src/UI/Components/AdminPanel/eventoDeGacha.js';

const base = join(process.cwd(), 'src/UI/Components/AdminPanel');
const painel = readFileSync(join(base, 'AdminPanel.js'), 'utf8');
const css = readFileSync(join(base, 'AdminPanel.css'), 'utf8');

const HORA = 3600000;
const CAIXAS = [
	{ pool: 'TOP', nome: 'Caixa Topo' },
	{ pool: 'MID', nome: 'Caixa Meio' },
	{ pool: 'LOW', nome: 'Caixa Baixo' },
	{ pool: 'GARMENT', nome: 'Caixa Manto' }
];

/** O retrato que o servidor manda (`retratoDoEventoDeGacha`). */
function retrato(evento = null) {
	const sem = { ativo: false, pool: '', caixa: '', lendario: 1, raro: 1, rotulo: '', inicioMs: 0, fimMs: 0, restanteMs: 0, porQuem: '' };
	return {
		...(evento ? { ...sem, ativo: true, porQuem: 'Admin', ...evento } : sem),
		caixas: CAIXAS,
		limites: { multiplicador: [1, 10], horas: [1, 720] },
		duracoesSugeridasEmHoras: [1, 6, 12, 24, 48, 72, 168]
	};
}

const AJUDA = {
	escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
	rotuloDeHoras: h => (h % 24 === 0 ? `${h / 24} dia(s)` : `${h} h`),
	faltamPorExtenso: ms => `${Math.ceil(ms / 60000)}min`,
	formatarFim: ms => `fim@${ms}`
};

function html(r, rascunho = rascunhoDoGacha(null, r), fimLocal = 0, agoraLocal = 0) {
	return htmlDoEventoDeGacha({ retrato: r, rascunho, fimLocal, agoraLocal, ajuda: AJUDA });
}

describe('o pedido que o painel manda — a forma que o servidor le', () => {
	it('iniciar leva a caixa, os dois multiplicadores e as horas do rascunho', () => {
		expect(pedidoDeIniciarDoGacha({ pool: 'TOP', lendario: 2, raro: 1.5, horas: 3 })).toEqual({
			v: 1,
			eventoDoAdmin: { tipo: 'gacha', iniciar: { pool: 'TOP', lendario: 2, raro: 1.5, horas: 3 } }
		});
	});

	it('encerrar leva so o tipo e o true', () => {
		expect(pedidoDeEncerrarDoGacha()).toEqual({ v: 1, eventoDoAdmin: { tipo: 'gacha', encerrar: true } });
	});
});

describe('o rascunho da secao', () => {
	it('nasce Lendario 2x por 24 h na PRIMEIRA caixa que o servidor oferece', () => {
		expect(rascunhoDoGacha(null, retrato())).toEqual({ pool: 'TOP', lendario: 2, raro: 1, horas: 24 });
	});

	it('o de antes FICA (o mesmo objeto, com as edicoes) se a caixa dele ainda existe', () => {
		const meu = { pool: 'LOW', lendario: 3, raro: 2, horas: 6 };
		expect(rascunhoDoGacha(meu, retrato())).toBe(meu);
	});

	it('a caixa que saiu do catalogo volta para a primeira; sem caixa nenhuma, pool vazio', () => {
		expect(rascunhoDoGacha({ pool: 'ANTIGA', lendario: 3, raro: 1, horas: 6 }, retrato())).toEqual({
			pool: 'TOP',
			lendario: 2,
			raro: 1,
			horas: 24
		});
		expect(rascunhoDoGacha(null, { caixas: [] }).pool).toBe('');
		expect(rascunhoDoGacha(null, undefined).pool).toBe('');
	});
});

describe('a secao desenhada', () => {
	it('servidor sem o retrato (anterior a D-1900): sem secao', () => {
		expect(html(undefined, { pool: '', lendario: 2, raro: 1, horas: 24 })).toBe('');
	});

	it('as quatro caixas como chips, com a do rascunho marcada', () => {
		const h = html(retrato(), { pool: 'MID', lendario: 2, raro: 1, horas: 24 });
		for (const c of CAIXAS) expect(h).toContain(`data-gacha-caixa="${c.pool}">${c.nome}</button>`);
		expect(h).toContain('class="ap-chip ri-btn is-sel" data-gacha-caixa="MID"');
		expect(h).not.toContain('class="ap-chip ri-btn is-sel" data-gacha-caixa="TOP"');
	});

	it('os multiplicadores com a faixa do servidor e uma casa decimal; as horas com a dele', () => {
		const h = html(retrato(), { pool: 'TOP', lendario: 2.5, raro: 1, horas: 48 });
		expect(h).toContain('step="0.1" class="ap-input ri-input" data-gacha-campo="lendario" min="1" max="10" value="2.5"');
		expect(h).toContain('data-gacha-campo="raro" min="1" max="10" value="1"');
		expect(h).toContain('data-gacha-campo="horas" min="1" max="720" value="48"');
		expect(h).toContain('class="ap-chip ri-btn is-sel" data-gacha-horas="48"');
		expect(h).toContain('Nenhum Evento de Gacha ativo.');
		expect(h).not.toContain('ap-gacha-encerrar');
		expect(h).toContain('<button type="button" class="ap-gacha-iniciar ri-btn">Iniciar</button>');
	});

	it('com o evento valendo: a caixa, o MULTIPLICADOR (pronto do servidor), o fim, quem iniciou, o encerrar e o "Substituir"', () => {
		const r = retrato({ pool: 'TOP', caixa: 'Caixa Topo', rotulo: 'Lendário 2x', restanteMs: HORA, porQuem: 'Dono' });
		const h = html(r, undefined, 5000 + HORA, 5000);
		expect(h).toContain('Evento de Gacha ativo · Caixa Topo: Lendário 2x');
		expect(h).toContain(`fim@${5000 + HORA}`);
		expect(h).toContain('data-faltam-do-gacha="1">60min<');
		expect(h).toContain('Iniciado por Dono');
		expect(h).toContain('<button type="button" class="ap-gacha-encerrar ri-btn">Encerrar</button>');
		expect(h).toContain('<button type="button" class="ap-gacha-iniciar ri-btn">Substituir</button>');
		// A janela NAO recalcula a porcentagem: nenhum "%" na secao.
		expect(h).not.toContain('%');
	});

	it('o nome de quem iniciou e o da caixa sao ESCAPADOS', () => {
		const h = html(retrato({ caixa: '<i>c</i>', rotulo: 'Lendário 2x', porQuem: '<b>x</b>' }));
		expect(h).not.toContain('<b>x</b>');
		expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
		expect(h).toContain('&lt;i&gt;c&lt;/i&gt;');
	});

	it('os seletores NAO colidem com os do EXP nem com os do drop e do respawn', () => {
		const h = html(retrato({ rotulo: 'Lendário 2x', restanteMs: HORA }));
		expect(h).not.toMatch(/data-evento="/);
		expect(h).not.toMatch(/ data-horas="/);
		expect(h).not.toContain('data-evento-da-equipe');
		expect(h).not.toContain('data-horas-do-evento');
		expect(h).not.toContain('data-faltam-do-evento');
		expect(h).not.toContain('ap-evento-iniciar');
		expect(h).not.toContain('ap-equipe-iniciar');
		expect(h).not.toContain('ap-equipe-encerrar');
	});
});

describe('a costura no painel', () => {
	it('a secao entra logo depois das de drop e respawn, e os botoes sao ligados', () => {
		expect(painel).toMatch(/\$\{renderEventosDaEquipe\(\)\}\s*\$\{renderEventoDeGacha\(\)\}/);
		expect(painel).toContain('bindEventoDeGacha(bodyEl);');
		expect(painel).toContain('pedidoDeIniciarDoGacha(AdminPanel.gachaDraft)');
		expect(painel).toContain('pedidoDeEncerrarDoGacha()');
	});

	it('o retrato e o de `eventosDoAdmin.gacha`, e o rascunho e conferido a cada resposta', () => {
		expect(painel).toContain('AdminPanel.gachaFimLocal = fimLocalDaEquipe(data.eventosDoAdmin.gacha, agoraLocal);');
		expect(painel).toContain('AdminPanel.gachaDraft = rascunhoDoGacha(AdminPanel.gachaDraft, data.eventosDoAdmin.gacha);');
	});

	it('substituir e encerrar pedem o segundo toque, como nos outros', () => {
		const bloco = painel.slice(painel.indexOf('function bindEventoDeGacha('), painel.indexOf('function marcarChipsDoGacha('));
		expect(bloco.match(/comConfirmacao\(/g)).toHaveLength(2);
	});

	it('o relogio da janela conta o do gacha junto dos outros', () => {
		expect(painel).toMatch(/atualizarRelogiosDaEquipe\(\);\s*atualizarRelogioDoGacha\(\);/);
	});
});

describe('o dedo alcanca a secao (o celular em pe)', () => {
	it('a secao carrega a classe `ap-evento`, que a regra de 44px do dedo alcanca', () => {
		expect(html(retrato())).toContain('class="ap-section ri-card ap-evento ap-evento-de-gacha"');
		const regra = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css.replace(/\r\n/g, '\n'));
		expect(regra, 'a regra do dedo sumiu do CSS').not.toBeNull();
		expect(regra[1]).toContain('#AdminPanel .ap-chip');
		expect(regra[1]).toContain('#AdminPanel .ap-evento-acoes .ri-btn');
		expect(regra[1]).toContain('#AdminPanel .ap-evento .ap-input');
	});

	it('os botoes de acao moram em `.ap-evento-acoes`, as escolhas sao `.ap-chip` e os multiplicadores dividem a linha', () => {
		const h = html(retrato({ rotulo: 'Lendário 2x', restanteMs: HORA }));
		expect(h).toMatch(/<div class="ap-evento-acoes">\s*<button type="button" class="ap-gacha-encerrar ri-btn"/);
		expect(h).toContain('<div class="ap-chips"><button type="button" class="ap-chip ri-btn');
		expect(h).toContain('<div class="ap-evento-bonus">');
	});

	it('o encerrar tem a cor de perigo do design system', () => {
		expect(css.replace(/\r\n/g, '\n')).toMatch(/#AdminPanel \.ap-gacha-encerrar \{\s*background: var\(--red-600\);/);
	});
});

describe('o icone do evento na barra de status', () => {
	it('e o 1906, o numero do servidor, com relogio e a arte do GRF', () => {
		expect(EFST_DO_EVENTO_DE_GACHA).toBe(1906);
		const gacha = StatusInfo[EFST_DO_EVENTO_DE_GACHA];
		expect(gacha.haveTimeLimit).toBe(1);
		expect(gacha.icon).toBe('efst_hidden_card.tga');
	});

	it('a dica sai em portugues', () => {
		const gacha = StatusInfo[EFST_DO_EVENTO_DE_GACHA];
		expect(emPortugues(gacha.descript[0][0])).toBe('Evento de Gacha');
		expect(emPortugues(gacha.descript[2][0])).toContain('caixa da temporada');
	});
});
