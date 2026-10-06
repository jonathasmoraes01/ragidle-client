/**
 * UI/Components/IdleConfig/desejoArcano.js
 *
 * RAGIDLE: O DESEJO ARCANO NA CONFIG IDLE (06/10/2026, decisao do dono: a magia
 * do SA_AUTOSPELL e escolhida aqui, e nao no menu do RO).
 *
 * No RO original, conjurar o Desejo Arcano abre um menu e o jogador escolhe a
 * magia na hora. Aqui o "menu" e este cartao: ele mostra a magia que sai, a
 * chance, o nivel, o que recomendamos e por que, e o seletor grava o campo
 * `magiaDoDesejoArcano` da config ('recomendada' = seguir a recomendacao).
 * Quem decide e o servidor (`servidor/idle/desejo-arcano.ts`); o contrato e o
 * `contexto.desejoArcano`, que so desce para quem aprendeu o Desejo — sem ele
 * o cartao nao existe.
 *
 * Funcoes puras, testadas em Node (`tests/ui/desejoArcano.test.js`); o
 * componente so as chama. Cada frase com numero mora num elemento proprio,
 * inteira, para o catalogo de idioma casar o modelo; o nome da magia vai
 * sozinho no dele (`nomeDaSkill`, que ja chega no idioma).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** O valor do seletor que segue a recomendacao (o servidor le como ausente). */
export const SEGUIR_A_RECOMENDACAO = 'recomendada';

/** Por que a recomendada e esta (o `motivo` do servidor). */
export const MOTIVO_DA_RECOMENDACAO = {
	'maior-dano-por-disparo': 'É a que mais dano dá por disparo, contra um alvo, contando o nível que cai.',
	'unica-disponivel': 'É a única magia aprendida que o Desejo pode conjurar agora.'
};

/** O servidor mandou a secao? (so para quem aprendeu o Desejo) */
export function temDesejoArcano(ctx) {
	const d = ctx && ctx.desejoArcano;
	return !!(d && Array.isArray(d.magias) && typeof d.chance === 'number');
}

/** O valor do seletor na config em edicao; ausente ou estranho = seguir a recomendacao. */
export function magiaEscolhida(cfg, ctx) {
	const v = cfg && cfg.magiaDoDesejoArcano;
	const magias = (ctx && ctx.desejoArcano && ctx.desejoArcano.magias) || [];
	if (typeof v === 'string' && (v === SEGUIR_A_RECOMENDACAO || magias.some(m => m.magia === v))) {
		return v;
	}
	// A escolhida que saiu do menu de hoje continua gravada; o seletor a mostra
	// como "a recomendada" e o aviso do cartao explica.
	return SEGUIR_A_RECOMENDACAO;
}

/**
 * O HTML do cartao, ou '' para quem nao aprendeu o Desejo. O seletor usa o
 * `data-set` + `data-valor` generico da janela (gravado por `setPath`).
 *
 * @param {{ cfg: object, ctx: object, escapar: (s: string) => string, nomeDaSkill: (id: string) => string }} p
 * @returns {string}
 */
export function htmlDoDesejoArcano(p) {
	if (!temDesejoArcano(p.ctx)) {
		return '';
	}
	const d = p.ctx.desejoArcano;
	const esc = p.escapar;
	const nome = id => esc(p.nomeDaSkill(id));
	const titulo = nome('SA_AUTOSPELL');
	if (d.magias.length === 0 || !d.efetiva) {
		return `
		<div class="ic-card ic-card--desejo-arcano">
			<h3>${titulo}</h3>
			<div class="ic-note">Nenhuma magia aprendida que o Desejo possa conjurar. Aprenda Ataque Espiritual ou uma das Lanças para ele ter o que soltar.</div>
		</div>`;
	}
	const escolhida = magiaEscolhida(p.cfg, p.ctx);
	const rec = d.recomendada;
	const botaoDaRecomendacao = `
				<button type="button" class="ic-seg-btn${escolhida === SEGUIR_A_RECOMENDACAO ? ' is-selected' : ''}" data-set="magiaDoDesejoArcano" data-valor="${SEGUIR_A_RECOMENDACAO}" aria-pressed="${escolhida === SEGUIR_A_RECOMENDACAO ? 'true' : 'false'}">
					<span class="ic-desejo-nome">Seguir a recomendação</span>
					${rec ? `<span class="ic-desejo-detalhe">${nome(rec.magia)}</span>` : ''}
				</button>`;
	const botoesDasMagias = d.magias
		.map(m => {
			const selecionado = escolhida === m.magia;
			const recomendada = rec && rec.magia === m.magia;
			return `
				<button type="button" class="ic-seg-btn${selecionado ? ' is-selected' : ''}" data-set="magiaDoDesejoArcano" data-valor="${esc(m.magia)}" aria-pressed="${selecionado ? 'true' : 'false'}">
					<span class="ic-desejo-nome">${nome(m.magia)}</span>${recomendada ? ' <span class="ri-badge ri-badge--verde">Recomendada</span>' : ''}
					<span class="ic-desejo-detalhe">${esc(`Até o nível ${m.nivelMaximo} · ${Math.round(m.razaoEsperada)}% do ataque mágico por disparo · ${m.spNoNivelMaximo} de SP`)}</span>
				</button>`;
		})
		.join('');
	const aviso = d.escolhidaIndisponivel
		? '<div class="ic-note ic-desejo-aviso">A magia que você escolheu não está no Desejo de hoje (nível dele ou da magia): sai a recomendada.</div>'
		: '';
	const motivo = rec ? MOTIVO_DA_RECOMENDACAO[rec.motivo] || '' : '';
	return `
		<div class="ic-card ic-card--desejo-arcano">
			<h3>${titulo}</h3>
			<div class="ic-perfil-agora" data-magia-efetiva="${esc(d.efetiva.magia)}">
				<span class="ic-perfil-agora-rotulo">Sai agora:</span>
				<span class="ri-badge ri-badge--verde">${nome(d.efetiva.magia)}</span>
				<span class="ic-perfil-motivo">${esc(`Chance de ${d.chance}% a cada golpe básico, com o Desejo no nível ${d.nivelDoDesejo}, por ${d.duracaoSegundos} segundos.`)}</span>
			</div>
			${aviso}
			<div class="ic-seg ic-seg--desejo" role="group" aria-label="Magia do Desejo Arcano">${botaoDaRecomendacao}${botoesDasMagias}</div>
			${motivo ? `<div class="ic-note">${esc(motivo)}</div>` : ''}
			<div class="ic-note">Com nível máximo acima de 1, a magia sai nele em 15% dos disparos, um nível abaixo em 35% e na metade em 50%. Cada disparo gasta 2/3 do SP da magia. Trocar a magia vale na próxima vez que o Desejo for conjurado.</div>
		</div>`;
}
