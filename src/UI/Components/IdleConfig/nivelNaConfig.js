/**
 * O NIVEL DE USO NA CONFIGURACAO IDLE (D-1906) — sem DOM.
 *
 * As tres listas que a janela desenha ganham o mesmo seletor
 * `[−] Nv 7/10 · 22 SP [+]` (`UI/nivelDeUso.js`): a ordem de golpes
 * (`rotacao`), os buffs mantidos (`rotacaoDeBuffs`) e a cura
 * (`cura.habilidades.<id>`). Aqui mora o que e da JANELA: de onde sai o
 * aprendido e o SP de cada entrada, que chave cada seletor carrega, e o que um
 * clique em "−"/"+" muda no rascunho.
 *
 * O seletor so aparece com `capacidades.nivelDeUsoEscolhido` (D-1905): um
 * servidor que nao a declara aceitaria a marca sem entende-la e conjuraria no
 * aprendido, e a tela mentiria "fixo". Sem ela, o selo antigo `Nv N`, so
 * leitura — o desenho de antes.
 */

import {
	ajusteDaCuraComNivel,
	entradaComNivel,
	htmlDoSeletorDeNivel,
	lembrarNomesDasHabilidades,
	lembrarSpPorNivel,
	nivelDaCura,
	nivelEfetivoDaEntrada,
	spDoNivel
} from 'UI/nivelDeUso.js';

/** O servidor conjura no nivel escolhido? */
export function nivelEscolhidoServido(ctx) {
	return !!(ctx && ctx.capacidades && ctx.capacidades.nivelDeUsoEscolhido === true);
}

/** A lista do contexto de onde sai o aprendido de cada chave. */
function listaDoContexto(ctx, lista) {
	if (!ctx) {
		return [];
	}
	if (lista === 'rotacao') {
		return ctx.skillsAtivas || [];
	}
	if (lista === 'rotacaoDeBuffs') {
		return ctx.skillsDeBuff || [];
	}
	return ctx.skillsDeCura || [];
}

/**
 * O seletor (ou o selo antigo) de uma entrada da ROTACAO ou dos BUFFS.
 *
 * @param {object} d
 * @param {string} d.chave   `rotacao.<i>` ou `rotacaoDeBuffs.<i>`
 * @param {{skillId:string, nivelDeUso:number, nivelFixo?:boolean}} d.entrada
 * @param {{aprendido:number, custoSpPorNivel?:number[]}|undefined} d.info
 * @param {boolean} d.capaz  `nivelEscolhidoServido(ctx)`
 * @param {string} d.nome
 * @returns {string}
 */
export function seletorDaEntrada({ chave, entrada, info, capaz, nome }) {
	const aprendido = info ? info.aprendido : 0;
	if (!capaz || !(aprendido >= 1)) {
		return `<span class="ri-badge ri-badge--azul">Nv ${Number(entrada.nivelDeUso) || 0}</span>`;
	}
	const nivel = nivelEfetivoDaEntrada(entrada, aprendido);
	return htmlDoSeletorDeNivel({
		chave,
		nivel,
		aprendido,
		fixo: entrada.nivelFixo === true,
		sp: spDoNivel(info.custoSpPorNivel, nivel),
		nome,
		classe: 'ic-nivel'
	});
}

/**
 * O seletor de uma CURA, numa linha propria ("Nivel de uso"), ou '' quando a
 * cura nao tem nivel escolhido: a que gasta pocao (o nivel da Aid Potion e a
 * pocao, e no automatico a mochila escolhe — o servidor recusa o campo nela) e
 * a de um nivel so (nao ha o que escolher).
 */
export function seletorDaCura({ cura, ajuste, capaz, nome }) {
	if (!capaz || !cura || cura.gastaPocao || !(cura.aprendido > 1)) {
		return '';
	}
	const nivel = nivelDaCura(ajuste, cura.aprendido);
	return (
		'<div class="ic-field-row ic-nivel-linha"><span>Nível de uso</span>' +
		htmlDoSeletorDeNivel({
			chave: `cura.${cura.skillId}`,
			nivel,
			aprendido: cura.aprendido,
			fixo: !!(ajuste && typeof ajuste.nivelDeUso === 'number'),
			sp: spDoNivel(cura.custoSpPorNivel, nivel),
			nome,
			classe: 'ic-nivel'
		}) +
		'</div>'
	);
}

/**
 * O CLIQUE EM "−"/"+": muda o rascunho `cfg` e devolve se mudou.
 *
 * A chave diz a lista e a posicao (`rotacao.1`, `rotacaoDeBuffs.0`) ou a cura
 * (`cura.AL_HEAL`). O nivel de partida e o que a entrada conjura HOJE
 * (`nivelEfetivoDaEntrada`), e nao o numero cru gravado: o "−" de uma entrada
 * que acompanha o 10 tem de ir ao 9.
 *
 * @returns {boolean}
 */
export function aplicarPassoDeNivel(cfg, ctx, chave, passo) {
	if (!cfg || typeof chave !== 'string') {
		return false;
	}
	const ponto = chave.indexOf('.');
	const lista = chave.slice(0, ponto);
	const resto = chave.slice(ponto + 1);
	if (lista === 'cura') {
		const habilidades = (cfg.cura && cfg.cura.habilidades) || null;
		const info = listaDoContexto(ctx, 'cura').find(c => c.skillId === resto);
		if (!habilidades || !habilidades[resto] || !info || info.gastaPocao) {
			return false;
		}
		const atual = nivelDaCura(habilidades[resto], info.aprendido);
		const novo = ajusteDaCuraComNivel(habilidades[resto], atual + passo, info.aprendido);
		if (novo.nivelDeUso === habilidades[resto].nivelDeUso) {
			return false;
		}
		cfg.cura = { ...cfg.cura, habilidades: { ...habilidades, [resto]: novo } };
		return true;
	}
	if (lista !== 'rotacao' && lista !== 'rotacaoDeBuffs') {
		return false;
	}
	const entradas = cfg[lista];
	const indice = Number(resto);
	const entrada = Array.isArray(entradas) ? entradas[indice] : undefined;
	const info = entrada ? listaDoContexto(ctx, lista).find(s => s.skillId === entrada.skillId) : undefined;
	if (!entrada || !info || !(info.aprendido >= 1)) {
		return false;
	}
	const atual = nivelEfetivoDaEntrada(entrada, info.aprendido);
	const nova = entradaComNivel(entrada, atual + passo, info.aprendido);
	if (nova.nivelDeUso === entrada.nivelDeUso && nova.nivelFixo === entrada.nivelFixo) {
		return false;
	}
	entradas[indice] = nova;
	return true;
}

/**
 * Guarda o SP por nivel que o contexto trouxe, para a BARRA de atalhos dizer
 * o custo na dica do slot (`lembrarSpPorNivel`). Chamado a cada contexto novo.
 */
export function lembrarSpDoContexto(ctx) {
	if (!ctx) {
		return;
	}
	const listas = [ctx.skillsAtivas, ctx.skillsDeBuff, ctx.skillsDeCura];
	for (const lista of listas) {
		for (const s of lista || []) {
			lembrarSpPorNivel(s.skillId, s.custoSpPorNivel);
		}
	}
	// O nome que a Config mostra, para a barra dizer o mesmo (`nomeNaBarra`).
	// Num lote so: a barra refaz as dicas uma vez por contexto, e nao uma por lista.
	lembrarNomesDasHabilidades([].concat(...listas.map(l => l || [])));
}
