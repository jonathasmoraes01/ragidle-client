/**
 * UI/Components/AusenciaIdle/resumoDaAusencia.js
 *
 * RAGIDLE: o que a janela "Enquanto voce esteve fora" e a tela preta da
 * economia MOSTRAM, a partir dos numeros do SERVIDOR (frente C do segundo
 * plano, D-2565, 16/10/2026).
 *
 * Ate aqui a tela preta mostrava um DELTA calculado no cliente com os pacotes
 * que chegavam (`registroDaCaca` contra um retrato tirado ao abrir a tela): com
 * o socket morto (o celular de tela apagada) o personagem seguia cacando no
 * servidor e o numero parava. Quem conta agora e o servidor
 * (`servidor/idle/ausencia.ts`, no repositorio do jogo); este modulo so
 * FORMATA o que chegou. Puro: nada de DOM nem de rede, e por isso o teste o
 * cobre em Node.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/**
 * "1 h 23 min", "12 min", "menos de 1 min". O relogio e do servidor: o cliente
 * nao sabe quanto tempo a pagina ficou congelada.
 *
 * @param {number} ms
 * @returns {string}
 */
export function duracaoLegivel(ms) {
	const minutos = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
	if (minutos < 1) {
		return 'menos de 1 min';
	}
	const h = Math.floor(minutos / 60);
	const m = minutos % 60;
	if (h === 0) {
		return `${m} min`;
	}
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Inteiro nao negativo; o que vier torto do fio vira zero (a janela nunca mostra NaN). */
function inteiro(v) {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * O resumo pronto para desenhar. `nomeDoItem(id)` resolve o nome no idioma do
 * cliente (a tabela de itens dele); o servidor manda so o id.
 *
 * Os numeros que deram ZERO nao viram linha: "Mortes: 0" e "Niveis: 0" so
 * ocupam a tela do celular. A EXP e o tempo aparecem sempre (sao a pergunta
 * que o jogador faz ao voltar).
 *
 * @param {object} resumo o `ausencia` do `ZC_RAGIDLE_ECONOMIA`
 * @param {function(number): string} nomeDoItem
 * @param {function(number): string} [numero] formata um numero (padrao: o do navegador)
 * @returns {{id: number, duracao: string, avisos: Array<{texto: string}>,
 *   numeros: Array<{rotulo: string, valor: string}>, itens: Array<{itemId: number, nome: string, quantidade: number}>,
 *   outros: number, vazio: boolean}}
 */
export function resumoParaATela(resumo, nomeDoItem, numero = n => n.toLocaleString()) {
	const r = resumo || {};
	const avisos = (Array.isArray(r.avisos) ? r.avisos : [])
		.filter(a => a && typeof a.texto === 'string' && a.texto !== '')
		.map(a => ({ texto: inteiro(a.vezes) > 1 ? `${a.texto} (${inteiro(a.vezes)} vezes)` : a.texto }));
	const numeros = [];
	numeros.push({ rotulo: 'EXP base', valor: '+' + numero(inteiro(r.expBase)) });
	numeros.push({ rotulo: 'EXP classe', valor: '+' + numero(inteiro(r.expClasse)) });
	if (inteiro(r.niveisBase) > 0) {
		numeros.push({ rotulo: 'Níveis de base', valor: '+' + numero(inteiro(r.niveisBase)) });
	}
	if (inteiro(r.niveisClasse) > 0) {
		numeros.push({ rotulo: 'Níveis de classe', valor: '+' + numero(inteiro(r.niveisClasse)) });
	}
	if (inteiro(r.zeny) > 0) {
		numeros.push({ rotulo: 'Zeny', valor: '+' + numero(inteiro(r.zeny)) });
	}
	numeros.push({ rotulo: 'Monstros derrotados', valor: numero(inteiro(r.abates)) });
	if (inteiro(r.mortes) > 0) {
		numeros.push({ rotulo: 'Mortes', valor: numero(inteiro(r.mortes)) });
	}
	const itens = (Array.isArray(r.itens) ? r.itens : [])
		.filter(par => Array.isArray(par) && inteiro(par[0]) > 0 && inteiro(par[1]) > 0)
		.map(([itemId, quantidade]) => ({ itemId: inteiro(itemId), nome: nomeDoItem(inteiro(itemId)) || `Item ${inteiro(itemId)}`, quantidade: inteiro(quantidade) }));
	const outros = inteiro(r.outrosItens);
	return {
		id: Number(r.id) || 0,
		duracao: duracaoLegivel(r.duracaoMs),
		avisos,
		numeros,
		itens,
		outros,
		vazio: avisos.length === 0 && itens.length === 0 && outros === 0 && inteiro(r.abates) === 0 && inteiro(r.expBase) === 0
	};
}

/**
 * O texto do aviso de morte da TELA PRETA (D-2566). O de antes dizia "O Bot
 * parou, mas o relogio continua contando. Clique em 'Voltar a jogar' para nao
 * perder o resto do tempo" - e MENTIA nas duas metades: o Bot nao "para" (o
 * personagem volta a cidade em 15 s e la nao ha o que cacar), e voltar a jogar
 * nao recupera tempo nenhum. O que e verdade: ele morreu para um monstro, foi a
 * cidade, e a cacada parou ali.
 *
 * @param {string|null|undefined} morte "Voce morreu para X." (do servidor), ou nada (cliente antigo)
 * @returns {string}
 */
export function avisoDeMorteNaTelaPreta(morte) {
	const primeira = typeof morte === 'string' && morte !== '' ? morte : 'Seu personagem morreu.';
	return `⚠ ${primeira} Ele voltou à cidade e a caçada parou ali. Volte a jogar para retomar.`;
}

/**
 * A linha de numeros da tela preta, com os numeros do SERVIDOR (`parcial`).
 *
 * @param {{expBase?: number, expClasse?: number, abates?: number, itensTotal?: number}|null|undefined} parcial
 * @param {function(number): string} [numero]
 * @returns {string}
 */
export function linhaDaTelaPreta(parcial, numero = n => n.toLocaleString()) {
	const p = parcial || {};
	return (
		`EXP base +${numero(inteiro(p.expBase))} · EXP classe +${numero(inteiro(p.expClasse))} · ` +
		`Mobs mortos: ${numero(inteiro(p.abates))} · Itens: ${numero(inteiro(p.itensTotal))}`
	);
}
