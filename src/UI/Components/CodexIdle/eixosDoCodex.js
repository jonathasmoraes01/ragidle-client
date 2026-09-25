/**
 * UI/Components/CodexIdle/eixosDoCodex.js
 *
 * O CODEX EM PERCENTUAL (25/09/2026, a reforma pedida pelo dono): o placar, os
 * NOVE eixos e os desafios diario e semanal, desenhados a partir do retrato v2
 * do servidor (`retratoDoCodex`, servidor/codex.ts).
 *
 * Puro de proposito, para ser testado sem subir a janela. A regra de sempre
 * vale: **a janela nunca calcula saldo nem veredito**. O custo do proximo
 * nivel, o bonus de hoje e a recusa de cada eixo chegam PRONTOS; daqui sai so
 * o rotulo e o formato.
 *
 * A UNIDADE do bonus e o centesimo de ponto percentual (50 = 0,5%), porque o
 * dono pediu passos de 0,5% e 0,25%. A janela mostra a virgula brasileira.
 */

/** O rotulo de cada eixo. Um eixo novo do servidor aparece com a propria chave. */
export const NOME_DO_EIXO = {
	ataque: 'Ataque físico',
	ataqueMagico: 'Ataque mágico',
	defesa: 'Defesa física',
	defesaMagica: 'Defesa mágica',
	regenHp: 'Recuperação de HP',
	regenSp: 'Recuperação de SP',
	hpMax: 'HP máximo',
	spMax: 'SP máximo',
	aspd: 'Velocidade de ataque'
};

/** A frase de cada recusa que o servidor manda. */
export const MOTIVO_DA_RECUSA = {
	'eixo-no-teto': 'Este atributo já está no nível máximo',
	'sem-ponto': 'Você não tem pontos para o próximo nível'
};

function escapeHtml(v) {
	return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 50 -> "0,5%", 25 -> "0,25%", 1000 -> "10%", 0 -> "0%". */
export function formatarPorcento(centesimos) {
	const n = Number(centesimos) || 0;
	const inteiro = Math.trunc(n / 100);
	const resto = Math.abs(n % 100);
	if (resto === 0) {
		return inteiro + '%';
	}
	const decimal = String(resto).padStart(2, '0').replace(/0$/, '');
	return (n < 0 && inteiro === 0 ? '-' : '') + inteiro + ',' + decimal + '%';
}

/** O placar: o saldo e, abaixo, de onde vieram os pontos. */
export function placarHtml(estado) {
	const p = (estado && estado.pontos) || {};
	const disponiveis = Number(p.disponiveis) || 0;
	const texto = disponiveis === 1 ? 'ponto para gastar' : 'pontos para gastar';
	const fontes = [
		['Missões', p.dasEntradas],
		['Nível', p.doNivel],
		['Desafios', p.dosDesafios],
		['Devolvidos', p.devolvidos]
	]
		.filter(([, v]) => Number(v) > 0)
		.map(([rotulo, v]) => escapeHtml(rotulo) + ' ' + escapeHtml(Number(v)))
		.join(' · ');
	return (
		'<div class="cx-placar">' +
		'<span class="cx-placar-numero">' +
		escapeHtml(disponiveis) +
		'</span>' +
		'<span><div class="cx-placar-texto">' +
		texto +
		'</div><div class="cx-placar-sub">' +
		escapeHtml(Number(p.gastos) || 0) +
		' de ' +
		escapeHtml(Number(p.ganhos) || 0) +
		' já aplicados' +
		(fontes ? ' · ' + fontes : '') +
		'</div></span>' +
		'</div>'
	);
}

/** Os dois desafios, com a barra de cada um. */
export function desafiosHtml(estado) {
	const d = estado && estado.desafios;
	if (!d || !d.diario || !d.semanal) {
		return '';
	}
	const linha = (titulo, x) => {
		const abates = Number(x.abates) || 0;
		const alvo = Number(x.alvo) || 1;
		const pct = Math.min(100, Math.floor((abates * 100) / alvo));
		return (
			'<div class="cx-desafio' +
			(x.cumprido ? ' is-cumprido' : '') +
			'">' +
			'<span class="cx-desafio-titulo">' +
			escapeHtml(titulo) +
			'</span>' +
			'<span class="cx-desafio-barra"><span style="width:' +
			pct +
			'%"></span></span>' +
			'<span class="cx-desafio-conta">' +
			escapeHtml(abates) +
			'/' +
			escapeHtml(alvo) +
			'</span>' +
			'<span class="cx-desafio-premio">' +
			(x.cumprido ? 'Feito · ' : '') +
			'+' +
			escapeHtml(Number(x.pontos) || 0) +
			' pts</span>' +
			'</div>'
		);
	};
	return (
		'<div class="cx-desafios">' +
		linha('Desafio do dia (abates)', d.diario) +
		linha('Desafio da semana (abates)', d.semanal) +
		'</div>'
	);
}

/** As nove linhas de eixo, na ordem em que o servidor mandou. */
export function eixosHtml(estado) {
	const eixos = (estado && Array.isArray(estado.eixos) && estado.eixos) || null;
	/*
	 * Um retrato sem `eixos` e de um servidor ANTIGO. A resposta certa e dizer
	 * isso, e nao desenhar botoes que o servidor recusaria em silencio.
	 */
	if (!eixos) {
		return '<div class="cx-vazio">Atualize o jogo para ver os atributos do Codex.</div>';
	}
	if (eixos.length === 0) {
		return '<div class="cx-vazio">O retrato do servidor nao trouxe eixo nenhum.</div>';
	}
	const teto = Number(estado.tetoDeNivel) || 0;
	const linhas = eixos.map(e => {
		const nome = NOME_DO_EIXO[e.eixo] || e.eixo;
		const recusa = e.recusa || null;
		const noTeto = recusa === 'eixo-no-teto';
		const custo = e.custoDoProximo;
		const titulo =
			MOTIVO_DA_RECUSA[recusa] ||
			'Subir ' + nome + ' para o nível ' + (Number(e.nivel) + 1) + ' (' + custo + ' pontos)';
		return (
			'<div class="cx-eixo' +
			(noTeto ? ' is-no-teto' : '') +
			'">' +
			'<span class="cx-eixo-nome">' +
			escapeHtml(nome) +
			'<small class="cx-eixo-por-nivel">+' +
			escapeHtml(formatarPorcento(e.porNivel)) +
			' por nível</small></span>' +
			'<span class="cx-eixo-bonus' +
			(Number(e.bonus) === 0 ? ' is-zero' : '') +
			'">+' +
			escapeHtml(formatarPorcento(e.bonus)) +
			'</span>' +
			'<span class="cx-eixo-teto">Nv ' +
			escapeHtml(Number(e.nivel) || 0) +
			'/' +
			escapeHtml(teto) +
			'</span>' +
			'<span class="cx-eixo-custo">' +
			(custo === null || custo === undefined ? 'Máx.' : escapeHtml(custo) + ' pts') +
			'</span>' +
			'<button type="button" class="cx-mais ri-btn" data-eixo="' +
			escapeHtml(e.eixo) +
			'" title="' +
			escapeHtml(titulo) +
			'"' +
			(recusa !== null ? ' disabled' : '') +
			'>+</button>' +
			'</div>'
		);
	});
	return '<div class="cx-eixos">' + linhas.join('') + '</div>';
}
