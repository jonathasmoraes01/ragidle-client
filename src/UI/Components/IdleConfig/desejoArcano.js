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

/* ------------------------------------------------------------------------- *
 * O DESEJO ATIVO NO CARTAO (D-2046, pedido do dono: "precisa mostrar que esta
 * ativo: X minutos restantes").
 * ------------------------------------------------------------------------- *
 *
 * O servidor manda, na resposta da config, QUANTO FALTA (`ativo.restanteMs`,
 * ou `null` = inativo) e quem o conjura de novo (`quemConjura`). Daqui para a
 * frente o relogio desce no cliente, sem empurrao por segundo: o vencimento
 * (`_venceEm`) e o instante local da resposta mais o restante.
 *
 * Com a janela aberta o Desejo entra, vence e e reconjurado sem nova resposta
 * da config — e o servidor JA conta isso ao cliente, no icone EFST_AUTOSPELL
 * (o 0983 leva o restante; o 0196 o apaga; cada cena nova reacende com o que
 * falta). `Entity.js` repassa o pacote a `aoMudarStatusDoDesejo`, e o relogio
 * se acerta com zero byte a mais no fio. Os dois canais sao do servidor; o
 * ultimo que chegou vale.
 */

/** `EFST_AUTOSPELL` (status.hpp:1522): o icone do Desejo. */
export const EFST_AUTOSPELL = 65;

/** O que a fonte manda como "sem fim" no 0983 (clif.cpp:6501-6502). */
const RELOGIO_SEM_FIM = 9999;

/** O vencimento local do Desejo (ms do relogio de quem chama), ou null = inativo. */
let _venceEm = null;

/** Quem quer saber que o relogio mudou (a janela, para redesenhar a linha). */
const _ouvintes = new Set();

/** Acerta o relogio pela resposta da config. Sem o cartao, nada muda. */
export function sincronizarRelogioDoDesejo(ctx, agora) {
	if (!temDesejoArcano(ctx)) {
		return;
	}
	const ativo = ctx.desejoArcano.ativo;
	_venceEm = ativo && typeof ativo.restanteMs === 'number' && ativo.restanteMs > 0 ? agora + ativo.restanteMs : null;
}

/**
 * O icone de status do PROPRIO jogador mudou (`Entity.js`). So o EFST do
 * Desejo interessa; devolve se o relogio mudou. O relogio "sem fim" (0 ou
 * 9999) nao e do Desejo, que sempre tem duracao: ele nao mexe no vencimento.
 */
export function aoMudarStatusDoDesejo(index, state, remainMs, agora) {
	if (index !== EFST_AUTOSPELL) {
		return false;
	}
	const ativo = state == null ? true : Boolean(state);
	if (!ativo) {
		_venceEm = null;
	} else {
		const vida = Number(remainMs);
		if (!Number.isFinite(vida) || vida <= 0 || vida === RELOGIO_SEM_FIM) {
			return false;
		}
		_venceEm = agora + vida;
	}
	for (const ouvinte of _ouvintes) {
		try {
			ouvinte();
		} catch (e) {
			// Um ouvinte quebrado nao derruba o pacote de status (que acende os icones).
			console.error('[DesejoArcano] ouvinte do relogio falhou:', e);
		}
	}
	return true;
}

/** A janela pede aviso quando o relogio muda. Devolve quem desliga. */
export function escutarRelogioDoDesejo(ouvinte) {
	_ouvintes.add(ouvinte);
	return () => _ouvintes.delete(ouvinte);
}

/** Quanto falta agora, em ms, ou null = inativo (vencido conta como inativo). */
export function restanteDoDesejoAgora(agora) {
	if (_venceEm === null) {
		return null;
	}
	const falta = _venceEm - agora;
	return falta > 0 ? falta : null;
}

/** Esquece o relogio (a troca de personagem). Os ouvintes ficam: a janela e a mesma. */
export function esquecerRelogioDoDesejo() {
	_venceEm = null;
}

/**
 * O texto do relogio. Os MINUTOS sao os inteiros que faltam (para baixo): com
 * 6 min 30 s faltando diz 6 minutos — o cartao nunca promete mais tempo do que
 * ha. Arredondar para cima (a primeira versao) dizia "2 minutos" com 61 s e
 * pulava o "1 minuto" direto para "59 segundos", o que a sonda na tela pegou.
 * Abaixo de um minuto conta os segundos (para cima: o ultimo e "1 segundo").
 * Cada frase sai inteira (o catalogo casa o modelo com o numero dentro).
 */
export function textoDoRestante(restanteMs) {
	if (restanteMs >= 60000) {
		const minutos = Math.floor(restanteMs / 60000);
		return minutos === 1 ? 'Ativo: 1 minuto restante' : `Ativo: ${minutos} minutos restantes`;
	}
	const segundos = Math.max(1, Math.ceil(restanteMs / 1000));
	return segundos === 1 ? 'Ativo: 1 segundo restante' : `Ativo: ${segundos} segundos restantes`;
}

/** Por que esta inativo, e quem o poe de pe de novo (o `quemConjura` do servidor). */
export const QUEM_CONJURA = {
	buffs: 'Está nos Buffs mantidos: a Caça automática o conjura de novo assim que puder.',
	rotacao: 'Está na Ordem de uso: sai na próxima luta, na vez dele.',
	'caca-desligada': 'Está na lista da Caça automática, mas ela só o conjura com a caça ligada num mapa de caça.',
	clique: 'Só sai pelo atalho. Para a caça mantê-lo, ponha-o em "Buffs mantidos", na aba Suporte.'
};

/** A chave que a linha de estado guarda, para so redesenhar quando o texto muda. */
export function chaveDoEstado(d, restanteMs) {
	return restanteMs === null ? `inativo:${(d && d.quemConjura) || ''}` : textoDoRestante(restanteMs);
}

/** O MIOLO da linha de estado (`.ic-desejo-estado`), ativo ou inativo. */
export function htmlDoEstadoDoDesejo(d, restanteMs, esc) {
	if (restanteMs !== null) {
		return `<span class="ri-badge ri-badge--verde ic-desejo-relogio">${esc(textoDoRestante(restanteMs))}</span>`;
	}
	const porque = (d && QUEM_CONJURA[d.quemConjura]) || '';
	return `<span class="ri-badge ri-badge--cinza">Inativo</span>${porque ? `<span class="ic-desejo-porque">${esc(porque)}</span>` : ''}`;
}

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
 * `restanteMs` (D-2046) e o que falta do Desejo AGORA (`restanteDoDesejoAgora`),
 * ou null = inativo; ausente conta como inativo.
 *
 * @param {{ cfg: object, ctx: object, escapar: (s: string) => string, nomeDaSkill: (id: string) => string, restanteMs?: number|null }} p
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
			<div class="ic-desejo-estado" data-desejo-estado="${esc(chaveDoEstado(d, p.restanteMs === undefined ? null : p.restanteMs))}">${htmlDoEstadoDoDesejo(d, p.restanteMs === undefined ? null : p.restanteMs, esc)}</div>
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
