/**
 * UI/Components/BotMenu/edicaoDeManutencao.js
 *
 * A EDICAO DA SOBREVIVENCIA, DO SUPORTE E DA COLETA DO BOT (Fase 6,
 * 07/10/2026), sem DOM: funcoes puras sobre a config v1
 * (`servidor/bot/config-do-bot.ts`). A janela so desenha e chama estas
 * funcoes dentro de `estado.editar(...)`. Nenhuma muta a config recebida:
 * devolvem uma NOVA (ou a mesma, quando o gesto nao muda nada).
 *
 * O cliente impede o obvio (teto, repeticao, faixa, gatilho pelo tipo, grupo
 * so com `alcancaGrupo`); o servidor continua sendo a autoridade e devolve
 * `problemas` por campo.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

const SOBREVIVENCIA_PADRAO = Object.freeze({
	pocoesHp: Object.freeze({ itens: Object.freeze([]), abaixoDe: 0 }),
	pocoesSp: Object.freeze({ itens: Object.freeze([]), abaixoDe: 0 }),
	descanso: Object.freeze({ sentarHpAbaixoDe: 0, sentarSpAbaixoDe: 0, levantarEm: 100 })
});
const COLETA_PADRAO = Object.freeze({ ligada: false, raio: 5, ignorar: Object.freeze([]) });

/** Limiar de cura padrao ao adicionar uma cura (porcento de HP). */
export const LIMIAR_PADRAO_DA_CURA = 60;

function inteiroNaFaixa(valor, min, max) {
	const n = Math.round(Number(valor));
	if (!Number.isFinite(n)) {
		return min;
	}
	return Math.min(max, Math.max(min, n));
}

const CHAVE_DO_EIXO = Object.freeze({ hp: 'pocoesHp', sp: 'pocoesSp' });

export function lerSobrevivencia(config) {
	const s = config.sobrevivencia || {};
	return {
		pocoesHp: s.pocoesHp || SOBREVIVENCIA_PADRAO.pocoesHp,
		pocoesSp: s.pocoesSp || SOBREVIVENCIA_PADRAO.pocoesSp,
		descanso: s.descanso || SOBREVIVENCIA_PADRAO.descanso
	};
}

export function lerSuporte(config) {
	return (config.suporte && Array.isArray(config.suporte.lista) && config.suporte.lista) || [];
}

export function lerColeta(config) {
	const c = config.coleta || {};
	return {
		ligada: typeof c.ligada === 'boolean' ? c.ligada : COLETA_PADRAO.ligada,
		raio: typeof c.raio === 'number' ? c.raio : COLETA_PADRAO.raio,
		ignorar: Array.isArray(c.ignorar) ? c.ignorar : COLETA_PADRAO.ignorar
	};
}

/* ---------------- sobrevivencia: pocoes ---------------- */

function lerPocoes(config, eixo) {
	return lerSobrevivencia(config)[CHAVE_DO_EIXO[eixo]];
}

function comPocoes(config, eixo, lista) {
	const s = lerSobrevivencia(config);
	return { ...config, sobrevivencia: { ...s, [CHAVE_DO_EIXO[eixo]]: lista } };
}

/** Poe a pocao no fim da lista do eixo ('hp' | 'sp'); sem repetir e sem passar do teto. */
export function adicionarPocao(config, eixo, itemId, teto) {
	const lista = lerPocoes(config, eixo);
	if (!Number.isInteger(itemId) || lista.itens.includes(itemId) || (typeof teto === 'number' && lista.itens.length >= teto)) {
		return config;
	}
	return comPocoes(config, eixo, { ...lista, itens: [...lista.itens, itemId] });
}

export function removerPocao(config, eixo, itemId) {
	const lista = lerPocoes(config, eixo);
	if (!lista.itens.includes(itemId)) {
		return config;
	}
	return comPocoes(config, eixo, { ...lista, itens: lista.itens.filter(i => i !== itemId) });
}

/** Sobe (-1) ou desce (+1) uma pocao na ordem de preferencia; nos extremos nada muda. */
export function moverPocao(config, eixo, itemId, delta) {
	const lista = lerPocoes(config, eixo);
	const itens = [...lista.itens];
	const i = itens.indexOf(itemId);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= itens.length) {
		return config;
	}
	[itens[i], itens[j]] = [itens[j], itens[i]];
	return comPocoes(config, eixo, { ...lista, itens });
}

/** Beber abaixo de N% (0 = desligado, 1..99). */
export function definirLimiarDePocao(config, eixo, abaixoDe) {
	const lista = lerPocoes(config, eixo);
	return comPocoes(config, eixo, { ...lista, abaixoDe: inteiroNaFaixa(abaixoDe, 0, 99) });
}

/* ---------------- sobrevivencia: descanso ---------------- */

const FAIXA_DO_DESCANSO = Object.freeze({
	sentarHpAbaixoDe: [0, 99],
	sentarSpAbaixoDe: [0, 99],
	levantarEm: [2, 100]
});

/** `campo`: 'sentarHpAbaixoDe' | 'sentarSpAbaixoDe' | 'levantarEm'. */
export function definirDescanso(config, campo, valor) {
	const faixa = FAIXA_DO_DESCANSO[campo];
	if (!faixa) {
		return config;
	}
	const s = lerSobrevivencia(config);
	return {
		...config,
		sobrevivencia: { ...s, descanso: { ...s.descanso, [campo]: inteiroNaFaixa(valor, faixa[0], faixa[1]) } }
	};
}

/** O "levantar em" tem de ficar ACIMA dos dois limiares de sentar (a regra do servidor). */
export function descansoCoerente(config) {
	const d = lerSobrevivencia(config).descanso;
	return d.levantarEm > d.sentarHpAbaixoDe && d.levantarEm > d.sentarSpAbaixoDe;
}

/* ---------------- suporte ---------------- */

function comSuporte(config, lista) {
	return { ...config, suporte: { ...(config.suporte || {}), lista } };
}

function repetida(lista, skillId, destino, ignorarIndice) {
	return lista.some((e, i) => i !== ignorarIndice && e.skillId === skillId && e.destino === destino);
}

/**
 * Adiciona uma skill de suporte. `skill` e a entrada do servidor
 * (`{skillId, suporte: 'buff'|'cura', alcancaGrupo}`); sem tipo nao entra.
 * Padrao pelo tipo: buff -> 'manter'/0; cura -> 'hp'/60; destino 'eu'.
 */
export function adicionarSuporte(config, skill, teto) {
	if (!skill || (skill.suporte !== 'buff' && skill.suporte !== 'cura')) {
		return config;
	}
	const lista = lerSuporte(config);
	if (repetida(lista, skill.skillId, 'eu', -1) || (typeof teto === 'number' && lista.length >= teto)) {
		return config;
	}
	const cura = skill.suporte === 'cura';
	return comSuporte(config, [
		...lista,
		{
			skillId: skill.skillId,
			nivel: 'aprendido',
			destino: 'eu',
			gatilho: cura ? 'hp' : 'manter',
			limiar: cura ? LIMIAR_PADRAO_DA_CURA : 0
		}
	]);
}

export function removerSuporte(config, indice) {
	const lista = lerSuporte(config);
	if (indice < 0 || indice >= lista.length) {
		return config;
	}
	return comSuporte(
		config,
		lista.filter((_, i) => i !== indice)
	);
}

export function moverSuporte(config, indice, delta) {
	const lista = [...lerSuporte(config)];
	const j = indice + delta;
	if (indice < 0 || indice >= lista.length || j < 0 || j >= lista.length) {
		return config;
	}
	[lista[indice], lista[j]] = [lista[j], lista[indice]];
	return comSuporte(config, lista);
}

function trocarEntrada(config, indice, fn) {
	const lista = lerSuporte(config);
	if (indice < 0 || indice >= lista.length) {
		return config;
	}
	const nova = fn(lista[indice], lista);
	if (nova === lista[indice]) {
		return config;
	}
	return comSuporte(
		config,
		lista.map((e, i) => (i === indice ? nova : e))
	);
}

/** Os destinos que a skill aceita: 'grupo' so com `alcancaGrupo`. */
export function destinosDaSkill(skill) {
	return skill && skill.alcancaGrupo ? ['eu', 'grupo'] : ['eu'];
}

/** Troca o destino ('eu' | 'grupo'); 'grupo' so se a skill alcanca o grupo, e nunca repetindo skill+destino. */
export function definirDestinoDoSuporte(config, indice, destino, skill) {
	if (!destinosDaSkill(skill).includes(destino)) {
		return config;
	}
	return trocarEntrada(config, indice, (e, lista) =>
		e.destino === destino || repetida(lista, e.skillId, destino, indice) ? e : { ...e, destino }
	);
}

/** `nivel`: 'aprendido' ou inteiro (o servidor valida contra o aprendido). */
export function definirNivelDoSuporte(config, indice, nivel) {
	return trocarEntrada(config, indice, e => (e.nivel === nivel ? e : { ...e, nivel }));
}

/** O limiar de HP da CURA (1..99); buff nao tem limiar (fica 0). */
export function definirLimiarDaCura(config, indice, limiar) {
	return trocarEntrada(config, indice, e => (e.gatilho !== 'hp' ? e : { ...e, limiar: inteiroNaFaixa(limiar, 1, 99) }));
}

/* ---------------- coleta ---------------- */

function comColeta(config, fn) {
	return { ...config, coleta: fn(lerColeta(config)) };
}

export function ligarColeta(config, ligada) {
	return comColeta(config, c => ({ ...c, ligada: !!ligada }));
}

export function definirRaioDeColeta(config, raio, min = 1, max = 15) {
	return comColeta(config, c => ({ ...c, raio: inteiroNaFaixa(raio, min, max) }));
}

/** Poe o item na lista de ignorados (inteiro positivo, sem repetir, ate o teto). */
export function ignorarItem(config, itemId, teto) {
	const c = lerColeta(config);
	if (!Number.isInteger(itemId) || itemId <= 0 || c.ignorar.includes(itemId)) {
		return config;
	}
	if (typeof teto === 'number' && c.ignorar.length >= teto) {
		return config;
	}
	return comColeta(config, x => ({ ...x, ignorar: [...x.ignorar, itemId] }));
}

export function deixarDeIgnorar(config, itemId) {
	const c = lerColeta(config);
	if (!c.ignorar.includes(itemId)) {
		return config;
	}
	return comColeta(config, x => ({ ...x, ignorar: x.ignorar.filter(i => i !== itemId) }));
}
