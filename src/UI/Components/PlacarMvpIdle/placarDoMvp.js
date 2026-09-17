/**
 * O PLACAR DO MVP, montado (16/09/2026, D-1533) — a parte pura.
 *
 * Recebe o JSON do `ZC_RAGIDLE_PLACAR_MVP` e devolve o HTML do placar, ou ''
 * quando nao ha disputa para mostrar. O componente (`PlacarMvpIdle.js`) so
 * cuida do pacote, de mostrar e de esconder.
 *
 * As medalhas seguem a regra de recompensa do dono: o 1o leva +15% de drop, o
 * 2o e o 3o +10% (e os tres sorteiam o premio de MVP).
 */

/** Quantas linhas o placar mostra. */
export const LINHAS_DO_PLACAR = 5;

/** Quanto tempo sem pacote ate o placar sumir sozinho (o servidor manda ~1/s). */
export const PLACAR_SOME_EM_MS = 3000;

function escapar(valor) {
	return String(valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** 1234567 -> "1.234.567" (o separador do jogo, sem depender do Intl). */
export function formatarDano(dano) {
	const inteiro = Math.max(0, Math.floor(Number(dano) || 0));
	return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** O JSON cru do pacote, ou `null` se ele nao faz sentido. */
export function lerPlacar(json) {
	try {
		const dados = JSON.parse(json);
		return dados && typeof dados === 'object' ? dados : null;
	} catch (erro) {
		return null;
	}
}

export function htmlDoPlacar(dados) {
	if (!dados || dados.ativo !== true || !Array.isArray(dados.top) || dados.top.length === 0) {
		return '';
	}
	const hp = Math.max(0, Math.min(100, Number(dados.hp) || 0));
	const linhas = dados.top.slice(0, LINHAS_DO_PLACAR).map(function (p, i) {
		const posicao = i + 1;
		// D-1543: quem saiu do mapa continua na vaga (regra B4), mas o premio
		// ja nao e dele — a linha diz isso.
		const fora = p.fora === true;
		return (
			`<li class="pm-linha pm-pos-${posicao}${fora ? ' pm-fora' : ''}">` +
			`<span class="pm-pos">${posicao}</span>` +
			`<span class="pm-nome">${escapar(p.nome)}${fora ? ' <em>(fora do mapa)</em>' : ''}</span>` +
			`<span class="pm-dano">${formatarDano(p.dano)}</span>` +
			`<span class="pm-fatia">${Math.max(0, Math.floor(Number(p.fatia) || 0))}%</span>` +
			'</li>'
		);
	});
	const eu = dados.eu;
	let minhaLinha = '';
	if (eu && Number(eu.dano) > 0) {
		const lugar = eu.posicao ? `${eu.posicao}º` : 'fora do top 10';
		minhaLinha = `<div class="pm-eu">Você: ${lugar} · ${formatarDano(eu.dano)}</div>`;
	}
	return (
		`<div class="pm-titulo">MVP · ${escapar(dados.mvp || '')}</div>` +
		`<div class="pm-vida"><span class="pm-vida-fill" style="width:${hp}%"></span><span class="pm-vida-num">${hp}%</span></div>` +
		`<ol class="pm-lista">${linhas.join('')}</ol>` +
		minhaLinha
	);
}
