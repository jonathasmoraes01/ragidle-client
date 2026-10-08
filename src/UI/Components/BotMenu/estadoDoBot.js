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
			/** O contexto do mapa (`{mapa, rotuloDoMapa, ehCidade}`); null = servidor sem o campo. */
			contexto: null,
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
			/** As municoes da mochila (Fase 7); null = servidor sem flechas no Bot. */
			municoes: null,
			/** A situacao da escolha de flecha (Fase 7): `{vip, manual, tetoAutomatico}`. */
			municao: null,
			/** O posto de grupo em vigor (Fase 8): `{emGrupo, posto, postoNome}`. */
			grupo: null,
			/** Fase 9: os perfis (`{nome, classe, postura}`), o de origem da config e as cidades com Kafra. */
			perfis: [],
			perfilAtivo: null,
			cidades: [],
			pendentePerfil: false,
			pendenteLigarDesligar: null,
			pendenteAplicar: false,
			/** "Salvar e Iniciar": o ON espera a confirmacao do Aplicar (aplicar recusado nao liga). */
			ligarAposAplicar: false,
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
		/** "Retomar automatico" (Fase 7): comando imediato, fora do Aplicar; a flecha da mao deixa de valer. */
		retomarMunicao() {
			s.erro = null;
			return pedir('retomar-municao');
		},
		/** Fase 9, perfis: verbos IMEDIATOS (fora do Aplicar). Aplicar usa a revisao confirmada. */
		perfilSalvar(nome) {
			s.pendentePerfil = true;
			s.erro = null;
			return pedir('perfil-salvar', { nome });
		},
		perfilAplicar(nome) {
			s.pendentePerfil = true;
			s.erro = null;
			s.problemas = [];
			return pedir('perfil-aplicar', { nome, baseRevision: s.revisao });
		},
		perfilRenomear(nome, novoNome) {
			s.pendentePerfil = true;
			s.erro = null;
			return pedir('perfil-renomear', { nome, novoNome });
		},
		perfilExcluir(nome) {
			s.pendentePerfil = true;
			s.erro = null;
			return pedir('perfil-excluir', { nome });
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
		/**
		 * "Salvar e Iniciar": com rascunho, aplica e SO liga quando o servidor aceitar; sem rascunho,
		 * liga direto (ON usa a config confirmada). Aplicar recusado nao liga e mantem o rascunho.
		 */
		aplicarELigar() {
			if (s.pendenteAplicar || s.pendenteLigarDesligar !== null || s.editConfig === null) {
				return null;
			}
			if (!s.dirty) {
				return s.ligado ? null : api.ligar();
			}
			s.ligarAposAplicar = true;
			return api.aplicar();
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
			if (d.contexto && typeof d.contexto === 'object') {
				s.contexto = d.contexto;
			}
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
			if (Array.isArray(d.municoes)) {
				s.municoes = d.municoes;
			}
			if (d.municao && typeof d.municao === 'object') {
				s.municao = d.municao;
			}
			if (d.grupo && typeof d.grupo === 'object') {
				s.grupo = d.grupo;
			}
			if (Array.isArray(d.perfis)) {
				s.perfis = d.perfis;
			}
			if (d.perfilAtivo !== undefined) {
				s.perfilAtivo = d.perfilAtivo;
			}
			if (Array.isArray(d.cidades)) {
				s.cidades = d.cidades;
			}
			if (verbo !== null && verbo.indexOf('perfil-') === 0) {
				s.pendentePerfil = false;
				if (!d.ok) {
					s.erro = d.erro || 'falha';
					s.problemas = Array.isArray(d.problemas) ? d.problemas : [];
				}
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
			let ligarAgora = false;
			if (verbo === 'aplicar') {
				s.pendenteAplicar = false;
				ligarAgora = s.ligarAposAplicar && !!d.ok && !d.ligado;
				s.ligarAposAplicar = false;
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
			if (ligarAgora) {
				api.ligar();
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
	coletando: 'Coletando itens',
	'preparando-municao': 'Trocando de flecha',
	'sem-municao-compativel': 'Sem flecha que fira o alvo',
	'flecha-fixa-indisponivel': 'Flecha escolhida acabou',
	'alvo-imune': 'Alvo imune ao seu ataque',
	'seguindo-lider': 'Seguindo o líder',
	apoiando: 'Apoiando o grupo',
	'indo-ao-armazem': 'Indo ao armazém',
	'guardando-itens': 'Guardando itens no armazém',
	comprando: 'Comprando na loja',
	'voltando-a-caca': 'Voltando à caça',
	'armazem-indisponivel': 'Armazém indisponível{detalhe}'
});

/** O motivo curto de `armazem-indisponivel` (o servidor manda o codigo). */
const DETALHE_DO_ARMAZEM = Object.freeze({
	'sem-kafra': 'sem Kafra na cidade',
	'sem-loja': 'a loja não vende o que falta',
	'viagem-recusada': 'a viagem foi recusada',
	'sem-zeny': 'zeny insuficiente',
	'sem-progresso': 'nada mudou, nova tentativa em alguns minutos',
	'sem-caminho': 'sem caminho até o NPC'
});

export function fraseDoStatus(status) {
	if (!status) {
		return FRASE_DO_STATUS['controle-manual'];
	}
	const modelo = FRASE_DO_STATUS[status.codigo] || FRASE_DO_STATUS['falha-operacional'];
	const nome = status.alvo && status.alvo.nome ? status.alvo.nome : 'o alvo';
	const detalhe = status.detalhe && DETALHE_DO_ARMAZEM[status.detalhe] ? ': ' + DETALHE_DO_ARMAZEM[status.detalhe] : '';
	return modelo.replace('{alvo}', nome).replace('{detalhe}', detalhe);
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
		case 'nome-invalido':
			return 'Nome de perfil inválido: use de 1 a 24 caracteres.';
		case 'nome-repetido':
			return 'Já existe um perfil com esse nome.';
		case 'perfil-inexistente':
			return 'Esse perfil não existe mais.';
		case 'limite-de-perfis':
			return 'Limite de perfis atingido. Exclua um para salvar outro.';
		case 'perfil-invalido':
			return 'Esse perfil não vale para o personagem agora. Nada foi alterado.';
		case null:
		case undefined:
			return '';
		default:
			return 'Não foi possível concluir. Tente de novo.';
	}
}
