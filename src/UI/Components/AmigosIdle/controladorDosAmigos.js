/**
 * UI/Components/AmigosIdle/controladorDosAmigos.js
 *
 * A JANELA "AMIGOS" (05/10/2026, sugestao de jogador que o dono pediu: "uma
 * janela para ver os amigos que estao online/offline no momento; para os
 * online, clicar para abrir o chat privado e/ou convidar para um grupo").
 *
 * O relato: "hoje pode adicionar mas so da pra ver se ta online no chat". O
 * servidor sempre teve a amizade inteira (`servidor/amigos.ts`, os sete
 * pacotes do /friend do rAthena) e o cliente sempre guardou a lista
 * (`Engine/MapEngine/Friends.js`); o que faltava era uma janela alcancavel
 * que a DESENHASSE — a nativa (`PartyFriends`) saiu do menu em D-960.
 *
 * Este modulo e a parte sem motor: recebe a lista, desenha Online/Offline com
 * a contagem, e transforma cada clique num pedido pelas funcoes injetadas.
 * Quem fala pacote e o `AmigosIdle.js` (a costura); quem decide e o servidor.
 *
 * O QUE O CLIENTE CONFERE ANTES DE MANDAR (e por que nao e "segunda rota"):
 * - convidar sem grupo / sem ser lider: o `Group.onRequestInvitation` nativo
 *   ja DESCARTA calado nesses dois casos (Group.js:131-134), entao o servidor
 *   nunca responderia — a janela diz o motivo em vez de ficar muda;
 * - adicionar a si mesmo: o servidor responde com SILENCIO, como a fonte
 *   (clif.cpp:15446), entao so o cliente pode dizer alguma coisa.
 * Grupo cheio, amigo noutro grupo, convite bloqueado, lista cheia, nome que
 * nao existe: tudo isso e resposta do SERVIDOR, e a janela so traduz o codigo.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** `MAX_FRIENDS` (mmo.hpp:168), o mesmo `MAX_AMIGOS` de `servidor/amigos.ts`. */
export const MAX_AMIGOS = 40;

/** O campo de nome do protocolo tem 24 bytes, um deles o zero final. */
export const TAMANHO_DO_NOME = 23;

/**
 * As respostas ao convite de grupo (`ZC_PARTY_JOIN_REQ_ACK`, os codigos de
 * `e_party_invite_reply`, clif.hpp:161-171) que esta janela sabe dizer.
 * `ok` = o convite deu certo (so o 2, "entrou"); o resto e recusa.
 */
const RESPOSTA_DO_CONVITE = {
	0: { tom: 'erro', texto: n => `${n} já está em outro grupo (ou já tem um convite esperando resposta).` },
	1: { tom: 'erro', texto: n => `${n} recusou o convite para o grupo.` },
	2: { tom: 'ok', texto: n => `${n} entrou no seu grupo.` },
	3: { tom: 'erro', texto: () => 'O seu grupo está cheio.' },
	4: { tom: 'erro', texto: n => `${n} é da mesma conta que você.` },
	5: { tom: 'erro', texto: n => `${n} desligou os convites de grupo.` },
	7: { tom: 'erro', texto: n => `${n} não está online.` },
	8: { tom: 'erro', texto: () => 'Não dá para convidar neste mapa.' }
};

/**
 * O texto da resposta ao convite, ou `null` para um codigo que esta janela
 * nao conhece (ai fica a frase nativa, que ja saiu no chat).
 *
 * @param {number} codigo
 * @param {string} nome
 * @returns {{tom: string, texto: string}|null}
 */
export function textoDaRespostaDoConvite(codigo, nome) {
	const r = RESPOSTA_DO_CONVITE[codigo];
	return r ? { tom: r.tom, texto: r.texto(nome || 'O jogador') } : null;
}

/**
 * O resultado do pedido de amizade (`ZC_ADD_FRIENDS_LIST`, 0x0209 — os tipos
 * de `clif_friendslist_reqack`, clif.cpp:15393-15399).
 *
 * @param {number} resultado
 * @param {string} nome
 * @returns {{tom: string, texto: string}|null}
 */
export function textoDoResultadoDeAmizade(resultado, nome) {
	const n = nome || 'O jogador';
	switch (resultado) {
		case 0:
			return { tom: 'ok', texto: `${n} agora é seu amigo.` };
		case 1:
			return { tom: 'erro', texto: `${n} recusou o pedido de amizade.` };
		case 2:
			return { tom: 'erro', texto: `Sua lista de amigos está cheia (${MAX_AMIGOS}).` };
		case 3:
			return { tom: 'erro', texto: `A lista de amigos de ${n} está cheia.` };
		default:
			return null;
	}
}

/**
 * As falas que o servidor manda no Logs com o remetente "Amigos"
 * (`falarNoFeed(conexao, 'Amigos', ...)`, servidor-mapa.ts) — o servidor as
 * escreve sem acento; aqui elas viram a frase da janela.
 */
const FALAS_DO_SERVIDOR = {
	'Personagem nao encontrado.': {
		tom: 'erro',
		texto: 'Ninguém online com esse nome. O pedido de amizade só chega a quem está no jogo.'
	},
	'Voces ja sao amigos.': { tom: 'erro', texto: 'Vocês já são amigos.' },
	'Este nome nao esta na sua lista.': { tom: 'erro', texto: 'Esse nome não está na sua lista.' },
	'Amigo removido.': { tom: 'ok', texto: 'Amigo removido.' }
};

/**
 * Le a fala do sistema e devolve o texto da janela se ela for do "Amigos".
 *
 * @param {string} msg o corpo do pacote ("Amigos : Personagem nao encontrado.")
 * @returns {{tom: string, texto: string}|null}
 */
export function falaDosAmigos(msg) {
	if (typeof msg !== 'string') {
		return null;
	}
	const m = /^Amigos : (.+)$/.exec(msg.replace(/\0+$/, '').trim());
	if (!m) {
		return null;
	}
	const corpo = m[1].trim();
	return FALAS_DO_SERVIDOR[corpo] || { tom: 'neutro', texto: corpo };
}

/** Online e o estado 0 (`p.offline = !online`, clif.cpp:15313); sem estado = offline. */
export function estaOnline(amigo) {
	return !!amigo && amigo.State === 0;
}

function porNome(a, b) {
	return String(a.Name).localeCompare(String(b.Name), 'pt-BR', { sensitivity: 'base' });
}

/**
 * A lista em duas, cada uma em ordem alfabetica.
 *
 * @param {Array<{AID:number,GID:number,Name:string,State?:number}>} lista
 */
export function separarAmigos(lista) {
	const todos = Array.isArray(lista) ? lista.filter(a => a && typeof a.Name === 'string') : [];
	return {
		online: todos.filter(estaOnline).sort(porNome),
		offline: todos.filter(a => !estaOnline(a)).sort(porNome)
	};
}

export function nomeParaEnvio(valor) {
	return String(valor == null ? '' : valor).trim();
}

function escapeHtml(valor) {
	return String(valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * @param {object} ctx
 * @param {Element|ShadowRoot} ctx.raiz
 * @param {(nome:string)=>void} ctx.pedirAmizade
 * @param {(amigo:object)=>void} ctx.removerAmigo
 * @param {(nome:string)=>void} ctx.sussurrar
 * @param {(nome:string)=>void} ctx.convidar
 * @param {()=>{temGrupo:boolean, souLider:boolean}} ctx.grupo
 * @param {(nome:string)=>boolean} ctx.ehDoMeuGrupo
 * @param {()=>string} ctx.meuNome
 */
export function criarControladorDosAmigos(ctx) {
	const raiz = ctx.raiz;
	const $ = sel => raiz.querySelector(sel);

	let _lista = [];
	/** O GID cuja linha pergunta "Remover?". */
	let _confirmando = null;
	/** O nome cujo convite de grupo esta no ar. */
	let _conviteNoAr = null;
	/** O nome cujo pedido de amizade esta no ar. */
	let _amizadeNoAr = null;

	function recado(texto, tom) {
		const el = $('.am-recado');
		if (!el) {
			return;
		}
		el.textContent = texto || '';
		el.className = 'am-recado' + (texto && tom ? ` is-${tom}` : '');
	}

	function acharPorGid(gid) {
		return _lista.find(a => String(a.GID) === String(gid)) || null;
	}

	function linhaHtml(amigo, online) {
		const gid = escapeHtml(amigo.GID);
		const nome = escapeHtml(amigo.Name);
		if (String(amigo.GID) === String(_confirmando)) {
			return (
				`<li class="am-linha is-confirmando" data-gid="${gid}">` +
				// O nome e a pergunta em nos SEPARADOS: o tradutor (D-1929) traduz
				// no de texto inteiro, e "Remover " solto nao casaria com nada.
				`<span class="am-nome" translate="no">${nome}</span>` +
				'<span class="am-pergunta">Remover da lista?</span>' +
				'<span class="am-acoes">' +
				`<button type="button" class="am-btn am-btn--perigo ri-btn" data-acao="confirmar-remocao" data-gid="${gid}">Remover</button>` +
				`<button type="button" class="am-btn ri-btn ri-btn--sec" data-acao="cancelar-remocao" data-gid="${gid}">Cancelar</button>` +
				'</span>' +
				'</li>'
			);
		}
		/*
		 * QUEM JA ESTA NO MEU GRUPO nao ganha "Convidar" (achado no print de
		 * 05/10: o amigo aceitou e o botao continuava la, convidando de novo quem
		 * acabou de entrar). A etiqueta "No grupo" ocupa o lugar dele.
		 */
		const noMeuGrupo = online && ctx.ehDoMeuGrupo(amigo.Name);
		const convite = noMeuGrupo
			? '<span class="am-etiqueta">No grupo</span>'
			: `<button type="button" class="am-btn ri-btn" data-acao="convidar" data-gid="${gid}" title="Convidar para o grupo">Convidar</button>`;
		const acoesOnline = online
			? `<button type="button" class="am-btn ri-btn" data-acao="mensagem" data-gid="${gid}" title="Mandar mensagem privada">Mensagem</button>` +
				convite
			: '';
		return (
			`<li class="am-linha${online ? ' is-online' : ''}" data-gid="${gid}">` +
			`<span class="am-bolinha" aria-hidden="true"></span>` +
			`<span class="am-nome" translate="no">${nome}</span>` +
			'<span class="am-acoes">' +
			acoesOnline +
			`<button type="button" class="am-btn am-btn--remover ri-btn ri-btn--sec" data-acao="remover" data-gid="${gid}" title="Remover dos amigos" aria-label="Remover dos amigos">&times;</button>` +
			'</span>' +
			'</li>'
		);
	}

	function desenhar() {
		const { online, offline } = separarAmigos(_lista);
		const total = $('.am-total');
		if (total) {
			total.textContent = `${_lista.length}/${MAX_AMIGOS}`;
		}
		const cOn = $('.am-contagem-online');
		if (cOn) {
			cOn.textContent = String(online.length);
		}
		const cOff = $('.am-contagem-offline');
		if (cOff) {
			cOff.textContent = String(offline.length);
		}
		const lOn = $('.am-lista-online');
		if (lOn) {
			lOn.innerHTML = online.length
				? online.map(a => linhaHtml(a, true)).join('')
				: `<li class="am-vazio">${_lista.length ? 'Nenhum amigo online agora.' : 'Você ainda não tem amigos na lista. Adicione pelo nome, logo acima.'}</li>`;
		}
		const lOff = $('.am-lista-offline');
		if (lOff) {
			lOff.innerHTML = offline.length
				? offline.map(a => linhaHtml(a, false)).join('')
				: '<li class="am-vazio">Ninguém offline.</li>';
		}
	}

	function adicionar() {
		const campo = $('.am-campo');
		const nome = nomeParaEnvio(campo && campo.value);
		if (!nome) {
			recado('Digite o nome do personagem.', 'erro');
			return false;
		}
		if (ctx.meuNome && nome === ctx.meuNome()) {
			recado('Esse é você.', 'erro');
			return false;
		}
		if (_lista.some(a => a.Name === nome)) {
			recado(`${nome} já é seu amigo.`, 'erro');
			return false;
		}
		_amizadeNoAr = nome;
		ctx.pedirAmizade(nome);
		if (campo) {
			campo.value = '';
		}
		recado(`Pedido de amizade enviado a ${nome}. Aguarde a resposta.`, 'neutro');
		return true;
	}

	function convidar(amigo) {
		const g = ctx.grupo();
		if (!g.temGrupo) {
			recado('Você ainda não está num grupo. Crie um em "Procurar grupo" e convide de novo.', 'erro');
			return false;
		}
		if (!g.souLider) {
			recado('Só o líder do grupo pode convidar.', 'erro');
			return false;
		}
		if (ctx.ehDoMeuGrupo(amigo.Name)) {
			recado(`${amigo.Name} já está no seu grupo.`, 'erro');
			return false;
		}
		_conviteNoAr = amigo.Name;
		ctx.convidar(amigo.Name);
		recado(`Convite para o grupo enviado a ${amigo.Name}. Aguarde a resposta.`, 'neutro');
		return true;
	}

	/** Um clique dentro da janela; devolve a acao executada (ou `null`). */
	function clicar(alvo) {
		const botao = alvo && typeof alvo.closest === 'function' ? alvo.closest('[data-acao]') : null;
		if (!botao || !raiz.contains(botao)) {
			return null;
		}
		const acao = botao.dataset.acao;
		const amigo = acharPorGid(botao.dataset.gid);
		if (!amigo) {
			return null;
		}
		switch (acao) {
			case 'mensagem':
				if (!estaOnline(amigo)) {
					return null;
				}
				ctx.sussurrar(amigo.Name);
				return acao;
			case 'convidar':
				if (!estaOnline(amigo)) {
					return null;
				}
				convidar(amigo);
				return acao;
			case 'remover':
				_confirmando = amigo.GID;
				desenhar();
				return acao;
			case 'cancelar-remocao':
				_confirmando = null;
				desenhar();
				return acao;
			case 'confirmar-remocao':
				_confirmando = null;
				ctx.removerAmigo(amigo);
				desenhar();
				return acao;
			default:
				return null;
		}
	}

	return {
		/** A lista inteira, a cada mudanca (login, logout, entrou, saiu). */
		receberLista(lista) {
			_lista = Array.isArray(lista) ? lista.slice() : [];
			if (_confirmando !== null && !acharPorGid(_confirmando)) {
				_confirmando = null;
			}
			desenhar();
		},
		/** A resposta ao convite de grupo (0x00fd), de QUALQUER convite: so le a do que ela mandou. */
		receberRespostaDoConvite(codigo, nome) {
			if (_conviteNoAr === null || nome !== _conviteNoAr) {
				return false;
			}
			const r = textoDaRespostaDoConvite(codigo, nome);
			if (!r) {
				return false;
			}
			_conviteNoAr = null;
			recado(r.texto, r.tom);
			// "Entrou" troca o botao pela etiqueta "No grupo".
			desenhar();
			return true;
		},
		/** O grupo mudou (alguem entrou ou saiu): as etiquetas "No grupo" se refazem. */
		grupoMudou() {
			desenhar();
		},
		/** O resultado do pedido de amizade (0x0209). Vale tambem para o pedido que CHEGOU e foi aceito. */
		receberResultadoDeAmizade(resultado, nome) {
			const r = textoDoResultadoDeAmizade(resultado, nome);
			if (!r) {
				return false;
			}
			if (_amizadeNoAr !== null && nome === _amizadeNoAr) {
				_amizadeNoAr = null;
			}
			recado(r.texto, r.tom);
			return true;
		},
		/** A fala do sistema do "Amigos" (nome que nao existe, ja amigos, removido). */
		receberFala(msg) {
			const r = falaDosAmigos(msg);
			if (!r) {
				return false;
			}
			_amizadeNoAr = null;
			recado(r.texto, r.tom);
			return true;
		},
		adicionar,
		clicar,
		aoAbrir() {
			_confirmando = null;
			recado('', null);
			desenhar();
		},
		aoFechar() {
			_confirmando = null;
			_conviteNoAr = null;
			_amizadeNoAr = null;
			recado('', null);
		},
		/** Para os testes e a sonda: o que a janela acha que esta no ar. */
		estado() {
			return { confirmando: _confirmando, conviteNoAr: _conviteNoAr, amizadeNoAr: _amizadeNoAr, total: _lista.length };
		}
	};
}
