/**
 * UI/Components/IdleConfig/curaComoAtaque.js
 *
 * RAGIDLE: A CURA COMO ATAQUE CONTRA MORTO-VIVO (04/10/2026, D-1963 — pedido do
 * dono depois do relato da Novica na Caverna de Payon).
 *
 * Um interruptor POR HABILIDADE de cura, "Usar como ataque contra
 * morto-vivo", padrao DESLIGADO. Com ele ligado, a cura sai no monstro
 * morto-vivo como golpe quando a barra esta ACIMA do limite; abaixo dele, cura
 * voce primeiro (a prioridade e do servidor: `modoDaCuraNaEscolha`). O contrato
 * e `cura.habilidades.<id>.comoAtaque` (servidor/idle/config-idle.ts), e a
 * janela so o oferece:
 *  - num servidor que o cumpre (`capacidades.curaComoAtaque`) — um servidor
 *    velho gravaria a marca sem usa-la, e a tela prometeria um ataque que nao
 *    sai;
 *  - na cura que fere morto-vivo na fonte (`fereMortoVivo`, hoje a Curar).
 *
 * Funcoes puras, testadas em Node (`tests/ui/curaComoAtaque.test.js`); o
 * componente so as chama.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

import { curaLigadaPara } from './secoesDaConfig.js';

/** O servidor entende a marca? */
export function curaComoAtaqueServida(ctx) {
	return !!(ctx && ctx.capacidades && ctx.capacidades.curaComoAtaque === true);
}

/** Esta cura ganha o interruptor? */
export function ofereceAtaqueDaCura(cura, ctx) {
	return curaComoAtaqueServida(ctx) && !!cura && cura.fereMortoVivo === true;
}

/** A marca esta ligada no ajuste desta cura? So `true` explicito. */
export function ataqueDaCuraLigado(ajuste) {
	return !!ajuste && ajuste.comoAtaque === true;
}

/**
 * O ajuste novo desta cura com o interruptor no estado pedido. Desligar APAGA a
 * marca (ausente = desligado no servidor): o payload de quem nunca ligou fica
 * igual ao de antes. Nao muda o objeto recebido.
 */
export function comAtaqueDaCura(ajuste, ligado) {
	const novo = Object.assign({}, ajuste || {});
	if (ligado) {
		novo.comoAtaque = true;
	} else {
		delete novo.comoAtaque;
	}
	return novo;
}

/**
 * O HTML do interruptor desta cura, ou '' quando ela nao o ganha. `ligada` e o
 * interruptor da propria cura: o ataque so sai com ela ligada (a cura
 * desligada nem entra na rotacao da cena), entao desligada o interruptor fica
 * apagado e travado, com o motivo escrito.
 *
 * `motivoDesligada` troca a frase da cura desligada: na aba Ataque (D-1990)
 * o interruptor da cura nao esta "acima", esta na aba Suporte.
 *
 * @param {{ cura: object, ajuste: object, ligada: boolean, ctx: object, escapar: function, motivoDesligada?: string }} p
 */
export function htmlDoAtaqueDaCura(p) {
	if (!ofereceAtaqueDaCura(p.cura, p.ctx)) {
		return '';
	}
	const ativo = ataqueDaCuraLigado(p.ajuste);
	const sub = !p.ligada
		? p.motivoDesligada || 'Ligue a cura acima para usar o ataque.'
		: ativo
			? 'Com o HP acima do limite, conjura no monstro morto-vivo como golpe. Abaixo do limite, cura você primeiro.'
			: 'Desligado: a cura só cura, mesmo contra morto-vivo.';
	return `
				<div class="ic-ataque-da-cura${p.ligada ? '' : ' is-desligada'}">
					<label class="ic-switch-row">
						<span class="ic-switch">
							<input type="checkbox" data-action="cura-ataque-toggle" data-skill="${p.escapar(p.cura.skillId)}" ${ativo ? 'checked' : ''} ${p.ligada ? '' : 'disabled'} />
							<span class="ic-switch-track"></span>
						</span>
						<span class="ic-switch-text">
							<span class="ic-switch-label">Usar como ataque contra morto-vivo</span>
							<span class="ic-switch-sub">${sub}</span>
						</span>
					</label>
				</div>`;
}

/**
 * A config de cura com a marca de UMA habilidade no estado pedido — o que o
 * interruptor grava, nas DUAS abas (D-1990: um handler so, um lugar de
 * verdade so). A cura sem ajuste proprio nasce com o que ela herdava do geral
 * (`curaLigadaPara` e o alvo), para que ligar o ataque nao mude o resto. Nao
 * muda o objeto recebido.
 */
export function curaComAtaqueAlterado(cura, skillId, ligado) {
	const habilidades = (cura && cura.habilidades) || {};
	const atual = habilidades[skillId] || {
		ligada: curaLigadaPara(cura, skillId),
		alvo: (cura && cura.alvo) || 'grupo'
	};
	return { ...cura, habilidades: { ...habilidades, [skillId]: comAtaqueDaCura(atual, ligado) } };
}

/**
 * O cartao "Cura contra morto-vivo" da aba ATAQUE (05/10/2026, D-1990 — relato
 * de uma jogadora que procurou o interruptor ao lado dos golpes). E o MESMO
 * interruptor da aba Suporte (`htmlDoAtaqueDaCura`, o mesmo `data-action`),
 * lido da MESMA config: nao ha estado da aba Ataque. So a cura que o ganha
 * (`ofereceAtaqueDaCura`) entra; sem nenhuma, '' e o cartao nao existe. O
 * interruptor da propria cura continua morando so em Suporte.
 *
 * @param {{ curas: object[], cura: object, ctx: object, escapar: function }} p
 */
export function htmlDaCuraNaAbaAtaque(p) {
	const curas = (p.curas || []).filter(c => ofereceAtaqueDaCura(c, p.ctx));
	if (!curas.length) {
		return '';
	}
	const habilidades = (p.cura && p.cura.habilidades) || {};
	const linhas = curas
		.map(c => {
			const nome = p.escapar(c.nome || c.skillId);
			const interruptor = htmlDoAtaqueDaCura({
				cura: c,
				ajuste: habilidades[c.skillId] || {},
				ligada: curaLigadaPara(p.cura, c.skillId),
				ctx: p.ctx,
				escapar: p.escapar,
				motivoDesligada: 'Ligue esta cura na seção Suporte para usar o ataque.'
			});
			return `
			<div class="ic-cura-no-ataque">
				<div class="ic-cura-no-ataque-nome">${nome}</div>
				${interruptor}
			</div>`;
		})
		.join('');
	return `
		<div class="ic-card ic-card--cura-no-ataque">
			<h3>Cura contra morto-vivo</h3>
			<div class="ic-note">Com o HP acima do limite de cura, usa a Cura no monstro morto-vivo; abaixo, cura você primeiro.</div>
			${linhas}
			<div class="ic-note">É o mesmo interruptor da seção Suporte: mudar aqui muda lá. O limite e o alvo da cura ficam em Suporte.</div>
		</div>`;
}
