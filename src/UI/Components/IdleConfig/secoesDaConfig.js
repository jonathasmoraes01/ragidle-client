/**
 * UI/Components/IdleConfig/secoesDaConfig.js
 *
 * As regras SEM DOM da Configuração idle redesenhada (D-903, 01/09/2026):
 * as cinco seções do trilho, o resumo de uma linha que cada uma mostra
 * embaixo do nome, os apelidos das abas antigas, a contagem de alterações
 * pendentes e o encaixe da cura na rotação.
 *
 * Moram fora de IdleConfig.js pelo mesmo motivo de `atlasDeCaca.js` no Mapa
 * de Caça: o que decide texto e estado dá para testar em Node, sem Shadow DOM
 * — e foi um teste desses que pegou o "70%" virando "7%" no atlas.
 */

/**
 * As seções, na ordem do trilho. `glifo` é a chave em `UI/ri-icones.js`.
 *
 * Os ids são NOVOS de propósito (D-903): a janela deixou de ser Geral / Alvos
 * / Skills / Recuperação / Itens — que era a ordem e o vocabulário do
 * Midgard Idle — e passou a se organizar pelo que o autômato FAZ: caça,
 * ataca, sustenta (a si e ao grupo), sobrevive, consome.
 */
export const SECOES = [
	{ id: 'caca', nome: 'Caçada', glifo: 'alvo' },
	{ id: 'ataque', nome: 'Ataque', glifo: 'espadas' },
	{ id: 'suporte', nome: 'Suporte', glifo: 'brilhos' },
	{ id: 'sobrevivencia', nome: 'Sobrevivência', glifo: 'coracao' },
	{ id: 'consumiveis', nome: 'Consumíveis', glifo: 'frasco' }
];

export const ABA_PADRAO = 'caca';

/**
 * As abas de ANTES, apontando para a seção que herdou o conteúdo delas. Quem
 * chama `abrirNaAba('skills')` (o medalhão do canto de combate, o slot do
 * dock) e quem tinha 'alvos' gravado no localStorage cai no lugar certo em
 * vez de na aba padrão.
 */
const ABAS_ANTIGAS = {
	geral: 'caca',
	alvos: 'caca',
	skills: 'ataque',
	recuperacao: 'sobrevivencia',
	itens: 'consumiveis'
};

/** Os ids que `abaLembrada` aceita: os novos e os antigos (traduzidos depois). */
export const ABAS_ACEITAS = SECOES.map(s => s.id).concat(Object.keys(ABAS_ANTIGAS));

/** O id canônico de uma aba — nova, antiga ou desconhecida (vira o padrão). */
export function abaCanonica(id) {
	if (SECOES.some(s => s.id === id)) {
		return id;
	}
	return ABAS_ANTIGAS[id] || ABA_PADRAO;
}

/** A entrada de cura (Curar, Primeiros Socorros) que está na rotação, ou null. */
export function curaNaRotacao(cfg, ctx) {
	const curas = new Set(((ctx && ctx.skillsDeCura) || []).map(s => s.skillId));
	return ((cfg && cfg.rotacao) || []).find(r => curas.has(r.skillId)) || null;
}

/**
 * Liga/desliga a cura automática: ela mora na ROTAÇÃO de ataque (é assim que o
 * motor a trata, D-673), então ligar é pôr a habilidade de cura na primeira
 * vaga e desligar é tirá-la. Devolve a rotação nova, ou `null` quando não há
 * como ligar — sem habilidade de cura, ou com as três vagas ocupadas (a
 * escolha de qual sai é do jogador, nunca da janela).
 */
export function alternarCura(cfg, ctx, ligar) {
	const rotacao = (cfg && cfg.rotacao) || [];
	const atual = curaNaRotacao(cfg, ctx);
	if (!ligar) {
		return atual ? rotacao.filter(r => r.skillId !== atual.skillId) : rotacao.slice();
	}
	if (atual) {
		return rotacao.slice();
	}
	const cura = ((ctx && ctx.skillsDeCura) || [])[0];
	if (!cura || rotacao.length >= 3) {
		return null;
	}
	return [{ skillId: cura.skillId, nivelDeUso: cura.aprendido }].concat(rotacao);
}

/** O alvo de uma entrada de buff: ausente = grupo (o que P2 fazia sem opção). */
export function alvoDoBuff(entrada) {
	return entrada && entrada.alvo === 'eu' ? 'eu' : 'grupo';
}

/**
 * O resumo de uma linha de cada seção, para o trilho. É o que faz a janela
 * dizer o estado inteiro do autômato sem trocar de seção — e o que o Midgard
 * não tem.
 */
export function resumoDaSecao(id, cfg, ctx) {
	if (!cfg) {
		return '';
	}
	const contexto = ctx || {};
	switch (id) {
		case 'caca': {
			if (contexto.ehCidade) {
				return 'na cidade';
			}
			const mobs = contexto.mobsDoMapa || [];
			if (!mobs.length) {
				return 'sem presas aqui';
			}
			const fora = new Set(cfg.alvosDesabilitados || []);
			const marcadas = mobs.filter(m => !fora.has(m.mobId)).length;
			return `${marcadas}/${mobs.length} presas`;
		}
		case 'ataque': {
			const n = (cfg.rotacao || []).length;
			const base = n ? `${n} ${n === 1 ? 'golpe' : 'golpes'}` : 'só o básico';
			return cfg.modoDeAtaque === 'apenas-skills' ? `${base} · sem básico` : base;
		}
		case 'suporte': {
			const buffs = (cfg.rotacaoDeBuffs || []).length;
			const partes = [];
			if (buffs) {
				partes.push(`${buffs} ${buffs === 1 ? 'buff' : 'buffs'}`);
			}
			if (curaNaRotacao(cfg, contexto)) {
				partes.push('cura');
			}
			return partes.length ? partes.join(' · ') : 'nada mantido';
		}
		case 'sobrevivencia': {
			const partes = [];
			if (cfg.descanso && cfg.descanso.ligado) {
				partes.push('senta');
			}
			if (cfg.pocaoDeHp && cfg.pocaoDeHp.ligado) {
				partes.push('poção HP');
			}
			if (cfg.pocaoDeSp && cfg.pocaoDeSp.ligado) {
				partes.push('poção SP');
			}
			return partes.length ? partes.join(' · ') : 'desligada';
		}
		case 'consumiveis':
			return cfg.usarBuffsDeItem ? 'buffs de item' : 'desligado';
		default:
			return '';
	}
}

/**
 * Quantos campos do topo da config diferem entre o que o servidor aceitou e o
 * rascunho — o "N alterações" do rodapé. Conta por CAMPO e não por clique:
 * marcar e desmarcar a mesma presa dá zero, que é o que o jogador vê.
 */
export function contarAlteracoes(servidor, rascunho) {
	if (!servidor || !rascunho) {
		return 0;
	}
	const chaves = new Set(Object.keys(servidor).concat(Object.keys(rascunho)));
	let n = 0;
	chaves.forEach(chave => {
		if (JSON.stringify(servidor[chave]) !== JSON.stringify(rascunho[chave])) {
			n++;
		}
	});
	return n;
}

/** "1 min", "30 s" — a duração de um buff, para a plaqueta. */
export function duracaoCurta(ms) {
	if (!ms || ms <= 0) {
		return '';
	}
	return ms >= 60000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`;
}
