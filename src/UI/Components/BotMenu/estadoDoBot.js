/**
 * UI/Components/BotMenu/estadoDoBot.js
 *
 * O ESTADO DO MENU DO BOT NOVO (07/10/2026, pacote "Novo Bot V5"), sem DOM e
 * sem motor: o que o servidor confirmou, o rascunho do jogador, os pedidos em
 * voo e o status operacional. A janela (`BotMenu.js`) so desenha isto.
 *
 * Contrato (servidor/bot/protocolo-do-bot.ts no rag-idle-master):
 * - `serverConfig` + `revisao`: o ultimo estado ACEITO pelo servidor;
 * - `editConfig` + `baseRevision` + `dirty`: o rascunho;
 * - `requestId` correlaciona: resposta de pedido que nao esta em voo (atrasada,
 *   de outra janela) e IGNORADA; de outro personagem tambem;
 * - `statusRevision`: status mais velho que o atual nao substitui o novo;
 * - ON/OFF e imediato e separado do Aplicar: OFF funciona com rascunho sujo e
 *   ON usa a config confirmada; a tela so afirma ligado/desligado depois da
 *   resposta;
 * - Aplicar rejeitado nao apaga o rascunho; conflito de revisao avisa e
 *   oferece recarregar.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

function clonar(v) {
	return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function iguais(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {{ enviar: (corpo: object) => void }} deps
 */
export function criarEstadoDoBot({ enviar }) {
	let proximoRequest = 1;
	/** @type {Map<number, string>} requestId -> verbo */
	const emVoo = new Map();
	let s = estadoVazio();

	function estadoVazio() {
		return {
			personagemId: null,
			mapa: null,
			carregado: false,
			serverConfig: null,
			revisao: 0,
			editConfig: null,
			baseRevision: 0,
			dirty: false,
			ligado: false,
			situacao: 'desligado',
			status: { codigo: 'controle-manual', alvo: null },
			statusRevision: -1,
			capacidades: null,
			monstros: [],
			/** As skills aprendidas com `aceita` (Fase 6); null = servidor sem skills no Bot. */
			skills: null,
			/** As pocoes de cura que o personagem tem (Fase 6); null = servidor sem a lista. */
			pocoes: null,
			pendenteLigarDesligar: null,
			pendenteAplicar: false,
			erro: null,
			problemas: [],
			conflito: false,
			mudouNoServidor: false
		};
	}

	function pedir(verbo, extra) {
		const requestId = proximoRequest++;
		emVoo.set(requestId, verbo);
		enviar(Object.assign({ v: 1, requestId, verbo }, extra || {}));
		return requestId;
	}

	function recalcularDirty() {
		s.dirty = s.editConfig !== null && s.serverConfig !== null && !iguais(s.editConfig, s.serverConfig);
	}

	function aceitarConfigDoServidor(config, revisao) {
		const mudou = revisao !== s.revisao || !iguais(config, s.serverConfig);
		s.serverConfig = clonar(config);
		s.revisao = revisao;
		if (!s.dirty || s.editConfig === null) {
			s.editConfig = clonar(config);
			s.baseRevision = revisao;
			s.mudouNoServidor = false;
		} else if (mudou && revisao !== s.baseRevision) {
			// Nao destroi o rascunho: avisa que o servidor tem outra versao.
			s.mudouNoServidor = true;
		}
		recalcularDirty();
	}

	const api = {
		estado() {
			return s;
		},
		/** Troca de personagem / sessao: nada do anterior sobrevive (pedidos em voo morrem). */
		reiniciar() {
			emVoo.clear();
			s = estadoVazio();
		},
		pedirEstado() {
			return pedir('pedir');
		},
		ligar() {
			s.pendenteLigarDesligar = 'ligar';
			s.erro = null;
			return pedir('ligar');
		},
		desligar() {
			s.pendenteLigarDesligar = 'desligar';
			s.erro = null;
			return pedir('desligar');
		},
		/** O jogador mexeu no rascunho. `fn` recebe uma COPIA e devolve a nova. */
		editar(fn) {
			if (s.editConfig === null) {
				return;
			}
			s.editConfig = fn(clonar(s.editConfig));
			s.problemas = [];
			s.erro = null;
			recalcularDirty();
		},
		aplicar() {
			if (!s.dirty || s.pendenteAplicar || s.editConfig === null) {
				return null;
			}
			s.pendenteAplicar = true;
			s.conflito = false;
			s.problemas = [];
			s.erro = null;
			return pedir('aplicar', { baseRevision: s.baseRevision, config: clonar(s.editConfig) });
		},
		descartar() {
			s.editConfig = clonar(s.serverConfig);
			s.baseRevision = s.revisao;
			s.problemas = [];
			s.conflito = false;
			s.mudouNoServidor = false;
			s.erro = null;
			recalcularDirty();
		},
		/** Conflito: recarregar troca o rascunho pela versao do servidor (escolha explicita). */
		recarregar() {
			api.descartar();
			return pedir('pedir');
		},
		/**
		 * A resposta ou o status do servidor. Devolve `true` se mudou algo.
		 * @param {object} d o JSON v1 do `ZC_RAGIDLE_BOT`
		 * @param {number|null} personagemAtual o personagem desta sessao
		 */
		receber(d, personagemAtual) {
			if (!d || d.v !== 1) {
				return false;
			}
			if (personagemAtual !== null && personagemAtual !== undefined && d.personagemId !== personagemAtual) {
				return false;
			}
			let verbo = null;
			if (d.tipo === 'resposta') {
				if (d.requestId === null || d.requestId === undefined) {
					// Resposta sem correlacao (pedido malformado): so o erro.
					s.erro = d.erro || null;
					return true;
				}
				verbo = emVoo.get(d.requestId) || null;
				if (verbo === null) {
					return false; // atrasada ou de outro pedido: nao substitui estado novo
				}
				emVoo.delete(d.requestId);
			} else if (d.tipo === 'status') {
				if (typeof d.statusRevision === 'number' && d.statusRevision < s.statusRevision) {
					return false;
				}
			} else {
				return false;
			}
			s.personagemId = d.personagemId;
			s.mapa = d.mapa;
			s.carregado = true;
			s.capacidades = d.capacidades || s.capacidades;
			if (Array.isArray(d.monstros)) {
				s.monstros = d.monstros;
			}
			if (Array.isArray(d.skills)) {
				s.skills = d.skills;
			}
			if (Array.isArray(d.pocoes)) {
				s.pocoes = d.pocoes;
			}
			if (typeof d.statusRevision === 'number' && d.statusRevision >= s.statusRevision) {
				s.statusRevision = d.statusRevision;
				s.status = d.status || s.status;
			}
			// ligado/situacao: so a resposta do proprio ON/OFF ou o status confirmam.
			s.ligado = !!d.ligado;
			s.situacao = d.situacao || s.situacao;
			if (verbo === 'ligar' || verbo === 'desligar') {
				s.pendenteLigarDesligar = null;
				if (!d.ok) {
					s.erro = d.erro || 'falha';
				}
			}
			if (verbo === 'aplicar') {
				s.pendenteAplicar = false;
				if (d.ok) {
					s.dirty = false;
					s.editConfig = null; // a de servidor entra limpa logo abaixo
					s.conflito = false;
					s.mudouNoServidor = false;
				} else {
					s.erro = d.erro || 'falha';
					s.conflito = d.erro === 'conflito-de-revisao';
					s.problemas = Array.isArray(d.problemas) ? d.problemas : [];
				}
			}
			if (d.config && typeof d.revisao === 'number') {
				aceitarConfigDoServidor(d.config, d.revisao);
			}
			return true;
		},
		/** As secoes com backend real (o menu nao mostra aba sem contrato). */
		secoes() {
			return (s.capacidades && Array.isArray(s.capacidades.secoes) && s.capacidades.secoes) || [];
		},
		/** Ha algum pedido de verbo em voo (para testes e para o "Enviando..."). */
		pedidosEmVoo() {
			return emVoo.size;
		}
	};
	return api;
}

/** As frases do status operacional (o servidor manda o CODIGO; o idioma traduz a frase). */
export const FRASE_DO_STATUS = Object.freeze({
	'controle-manual': 'Controle manual',
	'suspenso-manual': 'Suspenso pelo controle manual',
	'procurando-alvo': 'Procurando alvo',
	'indo-ate-alvo': 'Indo até {alvo}',
	atacando: 'Atacando {alvo}',
	'sem-alvo-valido': 'Sem alvo válido',
	'sem-acao-viavel': 'Sem ação possível',
	'caca-desligada': 'Caça desligada',
	sentado: 'Descansando',
	morto: 'Personagem caído',
	'alvo-inalcancavel': 'Alvo fora de alcance, procurando outro',
	'falha-operacional': 'Falha operacional',
	'recuperando-hp': 'Recuperando HP',
	'recuperando-sp': 'Recuperando SP',
	curando: 'Curando',
	'mantendo-buffs': 'Mantendo buffs',
	descansando: 'Descansando',
	coletando: 'Coletando itens'
});

export function fraseDoStatus(status) {
	if (!status) {
		return FRASE_DO_STATUS['controle-manual'];
	}
	const modelo = FRASE_DO_STATUS[status.codigo] || FRASE_DO_STATUS['falha-operacional'];
	const nome = status.alvo && status.alvo.nome ? status.alvo.nome : 'o alvo';
	return modelo.replace('{alvo}', nome);
}

/** As frases de erro do pedido. */
export function fraseDoErro(erro) {
	switch (erro) {
		case 'conflito-de-revisao':
			return 'A configuração mudou em outro lugar. Recarregue para ver a versão atual; sua edição só é perdida se você recarregar.';
		case 'config-invalida':
			return 'Alguns campos não foram aceitos. Nada foi alterado.';
		case 'pedido-invalido':
			return 'O servidor não entendeu o pedido. Nada foi alterado.';
		case null:
		case undefined:
			return '';
		default:
			return 'Não foi possível concluir. Tente de novo.';
	}
}
