/**
 * OS EVENTOS DE DROP E RESPAWN NO PAINEL DE ADMIN (D-1880, 01/10/2026).
 *
 * Duas metades, medidas de jeitos diferentes:
 *
 * 1. as DECISOES puras (`eventosDaEquipe.js`: o pedido, o fim no relogio local,
 *    o HTML da secao) rodam de verdade aqui;
 * 2. a COSTURA (o painel liga os botoes, o icone tem entrada e traducao, o
 *    dedo alcanca os controles) e lida no fonte — levantar a janela puxa WebGL
 *    e uma sessao logada. Quem a olha de verdade e o celular (ver o relatorio
 *    da entrega: a tela NAO foi verificada desta worktree).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import StatusInfo, { EFST_DO_EVENTO_DE_DROP, EFST_DO_EVENTO_DE_RESPAWN } from 'DB/Status/StatusInfo.js';
import { emPortugues } from 'DB/Status/StatusInfoPtBr.js';
import {
	TIPOS_DE_EVENTO_DA_EQUIPE,
	efeitoDaEquipe,
	fimLocalDaEquipe,
	htmlDosEventosDaEquipe,
	pedidoDeEncerrarDaEquipe,
	pedidoDeIniciarDaEquipe,
	rascunhoInicialDaEquipe
} from '../../src/UI/Components/AdminPanel/eventosDaEquipe.js';

const base = join(process.cwd(), 'src/UI/Components/AdminPanel');
const painel = readFileSync(join(base, 'AdminPanel.js'), 'utf8');
const css = readFileSync(join(base, 'AdminPanel.css'), 'utf8');

const HORA = 3600000;

/** O retrato que o servidor manda (`retratoDosEventosDoAdmin`). */
function retrato({ drop = null, respawn = null } = {}) {
	const um = e => (e ? { ativo: true, inicioMs: 0, fimMs: 0, porQuem: 'Admin', ...e } : { ativo: false, porcento: 0, restanteMs: 0, porQuem: '' });
	return {
		drop: um(drop),
		respawn: um(respawn),
		agoraMs: 0,
		limites: { porcento: { drop: [1, 500], respawn: [1, 90] }, horas: [1, 720] },
		duracoesSugeridasEmHoras: [1, 6, 12, 24, 48, 72, 168]
	};
}

const AJUDA = {
	escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
	rotuloDeHoras: h => (h % 24 === 0 ? `${h / 24} dia(s)` : `${h} h`),
	faltamPorExtenso: ms => `${Math.ceil(ms / 60000)}min`,
	formatarFim: ms => `fim@${ms}`
};

function html(r, rascunho = rascunhoInicialDaEquipe(), fimLocal = { drop: 0, respawn: 0 }, agoraLocal = 0) {
	return htmlDosEventosDaEquipe({ retrato: r, rascunho, fimLocal, agoraLocal, ajuda: AJUDA });
}

describe('o pedido que o painel manda — a forma que o servidor le', () => {
	it('iniciar leva o tipo, o percentual e as horas do rascunho', () => {
		expect(pedidoDeIniciarDaEquipe('drop', { porcento: 50, horas: 24 })).toEqual({
			v: 1,
			eventoDoAdmin: { tipo: 'drop', iniciar: { porcento: 50, horas: 24 } }
		});
		expect(pedidoDeIniciarDaEquipe('respawn', { porcento: 30, horas: 2 })).toEqual({
			v: 1,
			eventoDoAdmin: { tipo: 'respawn', iniciar: { porcento: 30, horas: 2 } }
		});
	});

	it('encerrar leva so o tipo e o true', () => {
		expect(pedidoDeEncerrarDaEquipe('respawn')).toEqual({ v: 1, eventoDoAdmin: { tipo: 'respawn', encerrar: true } });
	});

	it('o rascunho inicial e moderado e cabe nas faixas do servidor', () => {
		const r = rascunhoInicialDaEquipe();
		expect(r.drop.porcento).toBeGreaterThanOrEqual(1);
		expect(r.drop.porcento).toBeLessThanOrEqual(500);
		expect(r.respawn.porcento).toBeGreaterThanOrEqual(1);
		expect(r.respawn.porcento).toBeLessThanOrEqual(90);
		// Cada chamada devolve um objeto NOVO: o painel o muta campo a campo.
		expect(rascunhoInicialDaEquipe()).not.toBe(r);
	});
});

describe('o fim no relogio desta maquina', () => {
	it('chegada + o que falta; sem evento, zero', () => {
		expect(fimLocalDaEquipe({ ativo: true, restanteMs: 2 * HORA }, 1000)).toBe(1000 + 2 * HORA);
		expect(fimLocalDaEquipe({ ativo: false, restanteMs: 0 }, 1000)).toBe(0);
		expect(fimLocalDaEquipe(undefined, 1000)).toBe(0);
	});

	it('o efeito por extenso de cada tipo', () => {
		expect(efeitoDaEquipe('drop', 50)).toBe('+50% de drop');
		expect(efeitoDaEquipe('respawn', 30)).toBe('30% mais rápido');
	});
});

describe('a secao desenhada', () => {
	it('servidor sem o retrato (anterior a D-1880): sem secao, em vez de um "nenhum" que ele nunca disse', () => {
		expect(html(undefined)).toBe('');
	});

	it('os dois blocos, cada um com o SEU tipo nos seletores', () => {
		const h = html(retrato());
		for (const tipo of TIPOS_DE_EVENTO_DA_EQUIPE) {
			expect(h).toContain(`data-tipo="${tipo}"`);
			expect(h).toContain(`data-evento-da-equipe="${tipo}" data-campo="porcento"`);
			expect(h).toContain(`data-evento-da-equipe="${tipo}" data-campo="horas"`);
			expect(h).toContain(`data-horas-do-evento="${tipo}"`);
		}
		expect(h).toContain('Nenhum Evento de Drop ativo.');
		expect(h).toContain('Nenhum Evento de Respawn ativo.');
		// Sem evento valendo nao ha o que encerrar.
		expect(h).not.toContain('ap-equipe-encerrar');
		expect(h.match(/class="ap-equipe-iniciar ri-btn"/g)).toHaveLength(2);
	});

	it('as faixas do campo sao as do servidor, por tipo', () => {
		const h = html(retrato());
		expect(h).toContain('data-evento-da-equipe="drop" data-campo="porcento" min="1" max="500"');
		expect(h).toContain('data-evento-da-equipe="respawn" data-campo="porcento" min="1" max="90"');
		expect(h).toContain('min="1" max="720"');
	});

	it('com um evento valendo: o estado, o fim, quem iniciou, o encerrar e o "Substituir"', () => {
		const h = html(retrato({ drop: { porcento: 100, restanteMs: HORA, porQuem: 'Dono' } }), undefined, { drop: 5000 + HORA, respawn: 0 }, 5000);
		expect(h).toContain('Evento de Drop ativo · +100% de drop');
		expect(h).toContain(`fim@${5000 + HORA}`);
		expect(h).toContain('data-faltam-do-evento="drop">60min<');
		expect(h).toContain('Iniciado por Dono');
		expect(h).toContain('<button type="button" class="ap-equipe-encerrar ri-btn" data-tipo="drop">Encerrar</button>');
		expect(h).toContain('data-tipo="drop">Substituir</button>');
		// O outro tipo continua sem evento.
		expect(h).toContain('Nenhum Evento de Respawn ativo.');
		expect(h).toContain('data-tipo="respawn">Iniciar</button>');
	});

	it('o nome de quem iniciou e ESCAPADO — ele vem do registro dos personagens', () => {
		const h = html(retrato({ respawn: { porcento: 30, restanteMs: HORA, porQuem: '<b>x</b>' } }));
		expect(h).not.toContain('<b>x</b>');
		expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
	});

	it('o atalho de horas marcado e o do rascunho', () => {
		const rascunho = { drop: { porcento: 50, horas: 48 }, respawn: { porcento: 30, horas: 6 } };
		const h = html(retrato(), rascunho);
		expect(h).toContain('class="ap-chip ri-btn is-sel" data-horas-do-evento="drop" data-valor="48"');
		expect(h).toContain('class="ap-chip ri-btn is-sel" data-horas-do-evento="respawn" data-valor="6"');
		expect(h).not.toContain('class="ap-chip ri-btn is-sel" data-horas-do-evento="drop" data-valor="6"');
	});

	it('os seletores NAO colidem com os do evento de EXP (o EXP liga o primeiro que acha)', () => {
		const h = html(retrato({ drop: { porcento: 50, restanteMs: HORA } }));
		expect(h).not.toMatch(/data-evento="/);
		expect(h).not.toMatch(/ data-horas="/);
		expect(h).not.toContain('ap-evento-iniciar');
		expect(h).not.toContain('ap-evento-encerrar');
		expect(h).not.toContain('ap-evento-faltam');
	});
});

describe('a costura no painel', () => {
	it('a secao entra logo depois da do evento de EXP, e os botoes sao ligados', () => {
		expect(painel).toMatch(/\$\{renderEvento\(\)\}\s*\$\{renderEventosDaEquipe\(\)\}/);
		expect(painel).toContain('bindEventosDaEquipe(bodyEl);');
		expect(painel).toContain('pedidoDeIniciarDaEquipe(tipo, AdminPanel.eventosDaEquipeDraft[tipo])');
		expect(painel).toContain('pedidoDeEncerrarDaEquipe(tipo)');
	});

	it('o retrato e lido de `eventosDoAdmin`, o campo que o servidor manda, inclusive numa recusa', () => {
		expect(painel).toContain('if (data.eventosDoAdmin) {');
		expect(painel).toContain('AdminPanel.serverData.eventosDoAdmin = data.eventosDoAdmin;');
	});

	it('substituir e encerrar pedem o segundo toque, como no de EXP', () => {
		const bloco = painel.slice(painel.indexOf('function bindEventosDaEquipe('), painel.indexOf('function marcarAtalhoDaEquipe('));
		expect(bloco.match(/comConfirmacao\(/g)).toHaveLength(2);
	});

	it('o relogio da janela conta os da equipe junto do de EXP', () => {
		expect(painel).toMatch(/setInterval\(\(\) => \{\s*atualizarRelogioDoEvento\(\);\s*atualizarRelogiosDaEquipe\(\);/);
	});
});

describe('o dedo alcanca a secao (o celular em pe)', () => {
	it('a secao carrega a classe `ap-evento`, que a regra de 44px do dedo alcanca', () => {
		expect(html(retrato())).toContain('class="ap-section ri-card ap-evento ap-eventos-da-equipe"');
		const regra = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css);
		expect(regra, 'a regra do dedo sumiu do CSS').not.toBeNull();
		expect(regra[1]).toContain('#AdminPanel .ap-chip');
		expect(regra[1]).toContain('#AdminPanel .ap-evento-acoes .ri-btn');
		expect(regra[1]).toContain('#AdminPanel .ap-evento .ap-input');
		expect(regra[1]).toContain('min-height: var(--hit-touch, 44px)');
	});

	it('os botoes de acao moram em `.ap-evento-acoes` e os atalhos sao `.ap-chip` — os alvos da regra', () => {
		const h = html(retrato({ drop: { porcento: 50, restanteMs: HORA } }));
		expect(h).toMatch(/<div class="ap-evento-acoes">\s*<button type="button" class="ap-equipe-encerrar ri-btn"/);
		expect(h).toContain('class="ap-chip ri-btn');
	});

	it('o encerrar tem a cor de perigo do design system, como o do EXP', () => {
		expect(css).toMatch(/#AdminPanel \.ap-equipe-encerrar \{\s*background: var\(--red-600\);/);
	});
});

describe('os icones dos eventos na barra de status', () => {
	it('o drop e o 1904 e o respawn o 1905, os numeros do servidor, com relogio e arte do GRF', () => {
		expect(EFST_DO_EVENTO_DE_DROP).toBe(1904);
		expect(EFST_DO_EVENTO_DE_RESPAWN).toBe(1905);
		const drop = StatusInfo[EFST_DO_EVENTO_DE_DROP];
		const respawn = StatusInfo[EFST_DO_EVENTO_DE_RESPAWN];
		expect(drop.haveTimeLimit).toBe(1);
		expect(respawn.haveTimeLimit).toBe(1);
		expect(drop.icon).toBe('item_g.tga');
		expect(respawn.icon).toBe('essenceoftime.tga');
	});

	it('a dica sai em portugues', () => {
		const drop = StatusInfo[EFST_DO_EVENTO_DE_DROP];
		const respawn = StatusInfo[EFST_DO_EVENTO_DE_RESPAWN];
		expect(emPortugues(drop.descript[0][0])).toBe('Evento de Drop');
		expect(emPortugues(respawn.descript[0][0])).toBe('Evento de Respawn');
		expect(emPortugues(drop.descript[2][0])).toContain('menos cartas');
		expect(emPortugues(respawn.descript[2][0])).toContain('renascem mais rápido');
	});
});
