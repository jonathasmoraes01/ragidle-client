/**
 * UI/Components/BotMenu/edicaoDeArmazem.js
 *
 * A EDICAO DO ARMAZEM E DO REABASTECIMENTO DO BOT (Fase 9, 08/10/2026), sem
 * DOM: funcoes puras sobre o bloco `armazem` da config v1
 * (`servidor/bot/config-do-bot.ts`). Nenhuma muta a config recebida. O cliente
 * impede o obvio (faixas, repeticao, tetos); o servidor valida a cidade, os
 * itens e as regras, e devolve `problemas` por campo.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

export const ARMAZEM_PADRAO = Object.freeze({
	ligado: false,
	cidade: null,
	pesoAcimaDe: 0,
	depositar: Object.freeze([]),
	reservas: Object.freeze([]),
	repor: Object.freeze([]),
	tetoDeGasto: 0,
	voltar: true
});

/**
 * OS CANDIDATOS DO SELETOR (correcoes pos-QA, 08/10/2026; contrato 05 secao 3: a interface nao expoe IDs).
 * Guardar escolhe da MOCHILA; repor escolhe da mochila, das pocoes e das municoes que o servidor ja lista.
 * Sem repetir item, sem o que a lista ja tem, ordenados pelo nome. O nome e o do cliente (a tabela do
 * GRF) e, sem ele, o que o servidor mandou; item sem nome nenhum fica de fora (so daria para mostrar o id).
 *
 * @param {'depositar'|'repor'} lista
 * @param {object} config a config (o rascunho) com o bloco `armazem`
 * @param {{mochila?: Array<{itemId: number, quantidade?: number}>, pocoes?: Array<{itemId: number, nome?: string, quantidade?: number}>|null,
 *          municoes?: Array<{itemId: number, nome?: string, quantidade?: number}>|null}} fontes
 * @param {(id: number) => string|null} [nomeDoItem] o nome local do cliente
 * @returns {Array<{itemId: number, nome: string, quantidade?: number}>}
 */
export function candidatosDoArmazem(lista, config, fontes, nomeDoItem) {
	const a = lerArmazem(config);
	const ja = new Set(lista === 'depositar' ? a.depositar : a.repor.map(r => r.itemId));
	const origens = lista === 'depositar' ? [fontes.mochila] : [fontes.mochila, fontes.pocoes, fontes.municoes];
	const porId = new Map();
	for (const origem of origens) {
		for (const it of origem || []) {
			const id = it && it.itemId;
			if (!Number.isInteger(id) || id <= 0 || ja.has(id)) {
				continue;
			}
			const nome = (nomeDoItem && nomeDoItem(id)) || (typeof it.nome === 'string' && it.nome.trim()) || null;
			if (nome === null) {
				continue;
			}
			const antes = porId.get(id);
			const qtd = typeof it.quantidade === 'number' ? it.quantidade : undefined;
			if (antes === undefined) {
				porId.set(id, qtd === undefined ? { itemId: id, nome } : { itemId: id, nome, quantidade: qtd });
			} else if (qtd !== undefined && antes.quantidade === undefined) {
				porId.set(id, { ...antes, quantidade: qtd });
			}
		}
	}
	return [...porId.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR') || x.itemId - y.itemId);
}

function inteiroNaFaixa(valor, min, max) {
	const n = Math.round(Number(valor));
	if (!Number.isFinite(n)) {
		return min;
	}
	return Math.min(max, Math.max(min, n));
}

export function lerArmazem(config) {
	const a = (config && config.armazem) || {};
	return {
		ligado: typeof a.ligado === 'boolean' ? a.ligado : ARMAZEM_PADRAO.ligado,
		cidade: typeof a.cidade === 'string' ? a.cidade : null,
		pesoAcimaDe: typeof a.pesoAcimaDe === 'number' ? a.pesoAcimaDe : 0,
		depositar: Array.isArray(a.depositar) ? a.depositar : ARMAZEM_PADRAO.depositar,
		reservas: Array.isArray(a.reservas) ? a.reservas : ARMAZEM_PADRAO.reservas,
		repor: Array.isArray(a.repor) ? a.repor : ARMAZEM_PADRAO.repor,
		tetoDeGasto: typeof a.tetoDeGasto === 'number' ? a.tetoDeGasto : 0,
		voltar: typeof a.voltar === 'boolean' ? a.voltar : true
	};
}

function comArmazem(config, fn) {
	return { ...config, armazem: fn(lerArmazem(config)) };
}

export function ligarArmazem(config, ligado) {
	return comArmazem(config, a => ({ ...a, ligado: !!ligado }));
}

export function definirCidade(config, cidade) {
	return comArmazem(config, a => ({ ...a, cidade: typeof cidade === 'string' && cidade ? cidade : null }));
}

export function definirPesoDoGatilho(config, pct) {
	return comArmazem(config, a => ({ ...a, pesoAcimaDe: inteiroNaFaixa(pct, 0, 99) }));
}

export function definirTetoDeGasto(config, zeny, max = 1000000000) {
	return comArmazem(config, a => ({ ...a, tetoDeGasto: inteiroNaFaixa(zeny, 0, max) }));
}

export function definirVoltar(config, voltar) {
	return comArmazem(config, a => ({ ...a, voltar: !!voltar }));
}

/** Liga/desliga um item na lista de depositar (sem repetir, ate o teto). */
export function alternarDeposito(config, itemId, teto) {
	const a = lerArmazem(config);
	if (!Number.isInteger(itemId) || itemId <= 0) {
		return config;
	}
	if (a.depositar.includes(itemId)) {
		return comArmazem(config, x => ({ ...x, depositar: x.depositar.filter(i => i !== itemId) }));
	}
	if (typeof teto === 'number' && a.depositar.length >= teto) {
		return config;
	}
	return comArmazem(config, x => ({ ...x, depositar: [...x.depositar, itemId] }));
}

/** A reserva do item (quantidade que fica na mochila); 0 remove a reserva. */
export function definirReserva(config, itemId, quantidade, teto) {
	const a = lerArmazem(config);
	const q = inteiroNaFaixa(quantidade, 0, 30000);
	const sem = a.reservas.filter(r => r.itemId !== itemId);
	if (q === 0) {
		return sem.length === a.reservas.length ? config : comArmazem(config, x => ({ ...x, reservas: sem }));
	}
	if (sem.length === a.reservas.length && typeof teto === 'number' && a.reservas.length >= teto) {
		return config;
	}
	return comArmazem(config, x => ({ ...x, reservas: [...sem, { itemId, quantidade: q }] }));
}

/** Acrescenta um item a reposicao (padrao: repor abaixo de 5 ate 20). */
export function adicionarReposicao(config, itemId, teto) {
	const a = lerArmazem(config);
	if (!Number.isInteger(itemId) || itemId <= 0 || a.repor.some(r => r.itemId === itemId)) {
		return config;
	}
	if (typeof teto === 'number' && a.repor.length >= teto) {
		return config;
	}
	return comArmazem(config, x => ({ ...x, repor: [...x.repor, { itemId, minimo: 5, ate: 20 }] }));
}

export function removerReposicao(config, itemId) {
	const a = lerArmazem(config);
	if (!a.repor.some(r => r.itemId === itemId)) {
		return config;
	}
	return comArmazem(config, x => ({ ...x, repor: x.repor.filter(r => r.itemId !== itemId) }));
}

/** `campo`: 'minimo' | 'ate'. O `ate` fica sempre acima do `minimo` (a regra do servidor). */
export function definirReposicao(config, itemId, campo, valor) {
	const a = lerArmazem(config);
	const r = a.repor.find(x => x.itemId === itemId);
	if (!r || (campo !== 'minimo' && campo !== 'ate')) {
		return config;
	}
	let nova;
	if (campo === 'minimo') {
		const minimo = inteiroNaFaixa(valor, 0, 29999);
		nova = { ...r, minimo, ate: Math.max(r.ate, minimo + 1) };
	} else {
		nova = { ...r, ate: inteiroNaFaixa(valor, r.minimo + 1, 30000) };
	}
	return comArmazem(config, x => ({ ...x, repor: x.repor.map(e => (e.itemId === itemId ? nova : e)) }));
}
