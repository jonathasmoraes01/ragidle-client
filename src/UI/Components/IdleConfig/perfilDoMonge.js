/**
 * UI/Components/IdleConfig/perfilDoMonge.js
 *
 * RAGIDLE: OS PERFIS DE COMBATE DO MONGE NA CONFIG IDLE (06/10/2026, ordem do
 * dono: "quero que isso seja configurado/seja mostrado diretamente na
 * configuracao idle do Monge, ok? Preciso que o player veja o que nos estamos
 * fazendo, o que nos indicamos pra ele").
 *
 * O cartao mostra o perfil que o servidor usa AGORA (e por que), o que cada
 * perfil faz e o que recomendamos (o Automatico), com o seletor. Quem decide
 * e o servidor (`servidor/idle/perfil-do-monge.ts`); o contrato e o campo
 * `perfilDoMonge` da config (ausente = automatico) e o `contexto.monge`
 * (`{ perfilAtivo, motivo }`), que o servidor so manda para a linha do Monge —
 * sem ele o cartao nao existe.
 *
 * Funcoes puras, testadas em Node (`tests/ui/perfilDoMonge.test.js`); o
 * componente so as chama.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** Os tres perfis, na ordem do seletor. */
export const PERFIS_DO_MONGE = ['automatico', 'farm', 'chefe'];

/** Ausente na config = este (o padrao do servidor, e o recomendado). */
export const PERFIL_RECOMENDADO = 'automatico';

/** O rotulo de cada perfil no seletor. */
export const ROTULO_DO_PERFIL = {
	automatico: 'Automático',
	farm: 'Farm',
	chefe: 'Chefe'
};

/** O que cada perfil faz, na lingua do jogador. */
export const DESCRICAO_DO_PERFIL = {
	automatico: 'Usa o Chefe contra MVP e chefe, e o Farm no resto. É o que recomendamos.',
	farm: 'Combo Triplo, Combo Quádruplo e O Último Dragão, mantendo as esferas. Sem Asura e sem Fúria: o SP dura a caçada.',
	chefe: 'Fúria antes, e a corrente até o Asura. Contra MVP e chefe, guarda SP para o Asura: os outros golpes e buffs só saem com o SP que sobra. O Asura só sai contra MVP ou chefe, com as 5 esferas, e não sai quando o golpe passaria muito da vida que falta ao alvo.'
};

/** Por que o perfil de agora e este (o `motivo` do servidor). */
export const MOTIVO_DO_PERFIL = {
	'alvo-chefe': 'O alvo da luta é um MVP ou chefe.',
	'alvo-comum': 'O alvo da luta é um monstro comum.',
	'sem-alvo': 'Sem luta agora: a próxima começa no Farm, e vira Chefe se o alvo for MVP ou chefe.',
	escolhido: 'É o perfil que você escolheu.'
};

/** O servidor mandou a secao? (so para a linha do Monge) */
export function temPerfilDoMonge(ctx) {
	return !!(ctx && ctx.monge && (ctx.monge.perfilAtivo === 'farm' || ctx.monge.perfilAtivo === 'chefe'));
}

/** O perfil escolhido na config em edicao; ausente ou estranho = o recomendado. */
export function perfilEscolhido(cfg) {
	const v = cfg && cfg.perfilDoMonge;
	return PERFIS_DO_MONGE.includes(v) ? v : PERFIL_RECOMENDADO;
}

/**
 * O HTML do cartao, ou '' fora da linha do Monge. O seletor usa o controle
 * segmentado generico da janela (`data-set` + `data-valor`, gravado por
 * `setPath`), entao nao ha handler proprio.
 *
 * @param {{ cfg: object, ctx: object, escapar: (s: string) => string }} p
 * @returns {string}
 */
export function htmlDoPerfilDoMonge(p) {
	if (!temPerfilDoMonge(p.ctx)) {
		return '';
	}
	const escolhido = perfilEscolhido(p.cfg);
	const ativo = p.ctx.monge.perfilAtivo;
	const motivo = MOTIVO_DO_PERFIL[p.ctx.monge.motivo] || '';
	const botoes = PERFIS_DO_MONGE.map(perfil => {
		const rotulo = ROTULO_DO_PERFIL[perfil];
		const selecionado = perfil === escolhido;
		return `<button type="button" class="ic-seg-btn${selecionado ? ' is-selected' : ''}" data-set="perfilDoMonge" data-valor="${p.escapar(perfil)}" aria-pressed="${selecionado ? 'true' : 'false'}">${p.escapar(rotulo)}</button>`;
	}).join('');
	const descricoes = PERFIS_DO_MONGE.map(
		perfil => `
				<li class="ic-perfil-item${perfil === escolhido ? ' is-escolhido' : ''}">
					<strong>${p.escapar(ROTULO_DO_PERFIL[perfil])}</strong>${perfil === PERFIL_RECOMENDADO ? ' <span class="ri-badge ri-badge--verde">Recomendado</span>' : ''}
					<span>${p.escapar(DESCRICAO_DO_PERFIL[perfil])}</span>
				</li>`
	).join('');
	return `
		<div class="ic-card ic-card--perfil-do-monge">
			<h3>Perfil de combate do Monge</h3>
			<div class="ic-perfil-agora" data-perfil-ativo="${p.escapar(ativo)}">
				<span class="ic-perfil-agora-rotulo">Em uso agora:</span>
				<span class="ri-badge ${ativo === 'chefe' ? 'ri-badge--vermelho' : 'ri-badge--verde'}">${p.escapar(ROTULO_DO_PERFIL[ativo])}</span>
				<span class="ic-perfil-motivo">${p.escapar(motivo)}</span>
			</div>
			<div class="ic-seg ic-seg--perfil" role="group" aria-label="Perfil de combate do Monge">${botoes}</div>
			<ul class="ic-perfil-lista">${descricoes}</ul>
			<div class="ic-note">O Asura gasta todo o SP e corta a recuperação de SP por 5 minutos: por isso ele fica guardado para MVP e chefe.</div>
		</div>`;
}
