/**
 * UI/Components/MissoesIdle/infoDaMissao.js
 *
 * O "(i)" DE UMA MISSAO (01/10/2026, pedido do dono).
 *
 * *"adicionar um botão de (i) = tooltip na missão, para que o player quando
 * estiver caçando possa clicar e abrir as informações referente à missão que
 * ele clicou/está fazendo atualmente"*.
 *
 * ─── POR QUE UM PAINEL QUE ABRE NO TOQUE, E NAO UMA DICA DE PASSAR O MOUSE ─
 * Este fork nao tem dica de `hover` no dedo (o celular nao tem "passar por
 * cima"), e o pedido e de quem esta CACANDO — no celular, na maior parte do
 * tempo. Entao o "(i)" ABRE um painel com um toque e o mesmo toque o fecha, no
 * mouse e no dedo. E o mesmo desenho do seletor de nivel da barra (D-1908,
 * `ShortCut/seletorDeNivelDaBarra.js`): ancorado no botao que o abriu, um so
 * por vez, toque fora fecha, ESC e o voltar do Android fecham primeiro.
 *
 * ─── POR QUE NAO E UMA JANELA DA PILHA ──────────────────────────────────
 * Registrar o painel na `pilhaDeJanelas` marcaria o host de quem o abriu com
 * `.ri-janela` — e no celular o CARTAO DE MISSOES inteiro viraria um painel de
 * tela cheia (D-932). O que a pilha daria (o ESC, o voltar) vem pela lista de
 * baloes (`UI/balaoDaHud.js`), que a pilha pergunta antes das janelas.
 *
 * ─── O QUE ELE MOSTRA ───────────────────────────────────────────────────
 * Tudo que o pacote ja traz, e nada calculado aqui: titulo, dificuldade, de
 * quem e a missao (`npc`), o estado, a descricao, cada objetivo com a barra e
 * `progresso/alvo`, onde cacar (`mapaRotulo`) ou de quem o item cai (`caiDe`),
 * as recompensas (`rotulo`, montado no servidor) e os MESMOS botoes do cartao.
 *
 * ─── UMA FABRICA DE UM SO, SEM IMPORTAR A JANELA ────────────────────────
 * O painel e um so para o jogo inteiro (abrir um fecha o outro), mas quem o
 * abre passa o que ele precisa ler (`dados`) e o que fazer nos botoes
 * (`agir`). E isso que deixa este arquivo sem importar `MissoesIdle.js` (que o
 * importa: sem ciclo) e o comportamento inteiro provado em jsdom
 * (`tests/ui/infoDaMissao.test.js`).
 */

import { podeIniciarMissao, textoDoLimiteDeMissoes, missaoAceita } from './podeIniciarMissao.js';
import {
	acoesDaMissaoAceita,
	estadoParaOJogador,
	objetivoCompleto,
	porcentagemDoObjetivo
} from './missoesAceitas.js';
import { abrirBalao, esquecerBalao } from 'UI/balaoDaHud.js';
import { emUnidadesDaHud } from 'UI/escalaDaHud.js';
import { ehCelularEmPe } from 'UI/hudVertical.js';

/** O nome deste balao na lista do ESC (`balaoDaHud.js`). */
const NOME_DO_BALAO = 'info-da-missao';

/** Respiro entre o painel e a borda da tela, e entre ele e o "(i)". */
const MARGEM = 8;

function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/** O rotulo do estado, no vocabulario de 01/10/2026 (`estadoParaOJogador`). */
const ROTULO_DO_ESTADO = {
	pronta: 'Pronta para finalizar',
	'em-andamento': 'Em andamento',
	disponivel: 'Disponível',
	bloqueada: 'Bloqueada',
	concluida: 'Concluída'
};

/**
 * O "(i)" que abre este painel, para qualquer tela desenhar. `data-info` e o
 * contrato: e por ele que o clique fora reconhece "o mesmo (i) de novo" (e
 * deixa o clique FECHAR, em vez de fechar no `pointerdown` e reabrir no
 * `click`).
 *
 * A pele e a mesma em toda tela (`.im-i`, em `infoDaMissao.css`, que as duas
 * folhas que o usam importam); a classe da tela (`mt-info`, `mi-info`) fica
 * para o encaixe no layout dela.
 *
 * @param {{id: string, titulo?: string}} missao
 * @param {string} classe - a classe da tela (`mt-info`, `mi-info`)
 */
export function botaoDeInfoHtml(missao, classe) {
	const nome = missao.titulo || missao.id;
	return (
		`<button type="button" class="im-i ${escapeHtml(classe)}" data-info="${escapeHtml(missao.id)}"` +
		` aria-label="Informações da missão ${escapeHtml(nome)}" title="Informações da missão">i</button>`
	);
}

/** Uma linha "Onde"/"Cai de" do objetivo, ou nada. */
function ondeDoObjetivo(o) {
	// Coleta (`coletar-<itemId>`): quem solta o item, e onde.
	if (o && typeof o.itemId === 'number' && o.caiDe && Array.isArray(o.caiDe.monstros) && o.caiDe.monstros.length) {
		const onde = o.caiDe.rotulo ? ` (${escapeHtml(o.caiDe.rotulo)})` : '';
		return `<div class="im-onde">Cai de: ${o.caiDe.monstros.map(escapeHtml).join(', ')}${onde}</div>`;
	}
	// Caca (`matar-<mobId>`), ou a coleta sem `caiDe`: o mapa do passo.
	if (o && typeof o.mapaRotulo === 'string' && o.mapaRotulo) {
		return `<div class="im-onde">Onde: ${escapeHtml(o.mapaRotulo)}</div>`;
	}
	return '';
}

/** Os botoes do painel — os MESMOS do cartao, pelas mesmas regras puras. */
function acoesHtml(m, execucao, opcoes) {
	const botoes = [];
	if (m.executavel) {
		if (missaoAceita(m, execucao)) {
			for (const a of acoesDaMissaoAceita(m)) {
				const classe = a.destaque ? 'ri-btn ri-btn--ouro' : 'ri-btn ri-btn--sec';
				botoes.push(
					`<button type="button" class="${classe} im-acao" data-im-acao="${a.acao}"` +
						`${a.habilitado ? '' : ' disabled'} title="${escapeHtml(a.titulo)}">${escapeHtml(a.rotulo)}</button>`
				);
			}
		} else if (podeIniciarMissao(m, execucao)) {
			botoes.push('<button type="button" class="ri-btn ri-btn--ouro im-acao" data-im-acao="iniciar">Iniciar</button>');
		} else if (podeIniciarMissao(m, execucao, { ignorarLimite: true })) {
			botoes.push(
				`<button type="button" class="ri-btn ri-btn--sec im-acao" disabled title="Finalize ou abandone uma missão para aceitar outra">${escapeHtml(textoDoLimiteDeMissoes(execucao))}</button>`
			);
		}
	}
	if (opcoes && opcoes.verNaJanela) {
		botoes.push('<button type="button" class="im-ver" data-im-acao="ver">Ver na janela de missões</button>');
	}
	return botoes.length ? `<div class="im-acoes">${botoes.join('')}</div>` : '';
}

/**
 * O CONTEUDO do painel, puro — exportado para o teste ler o que o jogador le.
 *
 * @param {object} m - uma linha de `MissoesIdle.missoes`
 * @param {object|null} execucao - `MissoesIdle.execucao` (`{aceitas, maximo}`)
 * @param {{verNaJanela?: boolean}} [opcoes]
 * @returns {string}
 */
export function infoDaMissaoHtml(m, execucao, opcoes) {
	const estado = estadoParaOJogador(m, execucao);
	const rotuloDoEstado =
		estado === 'bloqueada' && m.requisito ? `Bloqueada: ${m.requisito}` : ROTULO_DO_ESTADO[estado] || '';
	const dificuldade = m.dificuldade
		? `<span class="ri-badge ri-badge--cinza im-dif" title="Dificuldade">${escapeHtml(m.dificuldade)}</span>`
		: '';
	const npc = typeof m.npc === 'string' && m.npc ? `<span class="im-npc">Missão de ${escapeHtml(m.npc)}</span>` : '';

	const objetivos = Array.isArray(m.objetivos) ? m.objetivos : [];
	const objetivosHtml = objetivos.length
		? '<div class="im-secao">Objetivos</div><ul class="im-objetivos">' +
			objetivos
				.map(o => {
					const pct = porcentagemDoObjetivo(o.progresso, o.alvo);
					return (
						`<li class="im-objetivo${objetivoCompleto(o) ? ' is-completo' : ''}">` +
						'<div class="im-objetivo-linha">' +
						`<span class="im-objetivo-desc">${escapeHtml(o.descricao)}</span>` +
						`<span class="im-conta">${escapeHtml(o.progresso)}/${escapeHtml(o.alvo)}</span>` +
						'</div>' +
						`<div class="im-barra" aria-hidden="true"><div class="im-barra-fill" style="width:${pct}%"></div></div>` +
						ondeDoObjetivo(o) +
						'</li>'
					);
				})
				.join('') +
			'</ul>'
		: '';

	const recompensas = Array.isArray(m.recompensas) ? m.recompensas : [];
	const recompensasHtml = recompensas.length
		? '<div class="im-secao">Recompensas</div><ul class="im-recompensas">' +
			recompensas.map(r => `<li>${escapeHtml(r.rotulo)}</li>`).join('') +
			'</ul>'
		: '';

	return (
		'<div class="im-topo">' +
		'<div class="im-cabeca">' +
		`<div class="im-titulo">${escapeHtml(m.titulo || m.id)}</div>` +
		(dificuldade || npc ? `<div class="im-sub">${dificuldade}${npc}</div>` : '') +
		'</div>' +
		'<button type="button" class="im-fechar" data-im-acao="fechar" aria-label="Fechar informações" title="Fechar">&times;</button>' +
		'</div>' +
		'<div class="im-corpo">' +
		`<p class="im-estado" data-estado="${escapeHtml(estado)}">${escapeHtml(rotuloDoEstado)}</p>` +
		(m.descricao ? `<p class="im-desc">${escapeHtml(m.descricao)}</p>` : '') +
		objetivosHtml +
		recompensasHtml +
		'</div>' +
		acoesHtml(m, execucao, opcoes)
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   O CONTROLE DO PAINEL (um so para o jogo inteiro)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * O pedido aberto agora, ou `null`:
 * `{ id, conteiner, ancora, host, dados, agir, verNaJanela }` (ver `abrir`).
 */
let _aberto = null;
let _porFora = null;

/** O painel FILHO DIRETO do conteiner (nunca um de dentro da lista). */
function painelEm(conteiner) {
	if (!conteiner || !conteiner.children) {
		return null;
	}
	return Array.from(conteiner.children).find(c => c.classList && c.classList.contains('im-painel')) || null;
}

function criarPainel(conteiner) {
	let el = painelEm(conteiner);
	if (!el) {
		el = conteiner.ownerDocument.createElement('div');
		el.className = 'im-painel';
		el.setAttribute('role', 'dialog');
		el.addEventListener('click', aoClicarNoPainel);
		conteiner.appendChild(el);
	}
	return el;
}

/** Um clique dentro do painel: os botoes dele, e so eles. */
function aoClicarNoPainel(e) {
	e.stopImmediatePropagation();
	const botao = e.target && e.target.closest ? e.target.closest('[data-im-acao]') : null;
	if (!botao || botao.disabled || !_aberto) {
		return;
	}
	const acao = botao.getAttribute('data-im-acao');
	const pedido = _aberto;
	if (acao === 'fechar') {
		fecharInfoDaMissao();
		return;
	}
	if (acao === 'ver') {
		const m = missaoDoPedido(pedido);
		fecharInfoDaMissao();
		if (typeof pedido.verNaJanela === 'function') {
			pedido.verNaJanela(pedido.id, m ? m.tipo : undefined);
		}
		return;
	}
	// Iniciar, Finalizar, Ir caçar, Abandonar: o pacote e o mesmo do cartao, e
	// quem o manda e quem abriu o painel. O painel fecha junto — o "Ir caçar"
	// troca de mapa, e os outros mudam a lista que ele estava mostrando.
	fecharInfoDaMissao();
	if (typeof pedido.agir === 'function') {
		pedido.agir(acao, pedido.id);
	}
}

function missaoDoPedido(pedido) {
	const dados = typeof pedido.dados === 'function' ? pedido.dados() : null;
	const missoes = dados && Array.isArray(dados.missoes) ? dados.missoes : [];
	return missoes.find(m => m && m.id === pedido.id) || null;
}

/**
 * Poe o painel no lugar.
 *
 * - CELULAR EM PE: a largura e da tela, com 16px de cada lado (a classe
 *   `is-celular` e o CSS cuidam dela), e o topo fica logo abaixo do "(i)" —
 *   ou acima, se nao couber —, sempre dentro da tela. O que nao couber na
 *   altura rola por DENTRO do painel (`.im-corpo`).
 * - COMPUTADOR: ao lado do "(i)", a direita (o cartao mora na coluna da
 *   esquerda, e o jogo esta a direita dele), ou a esquerda se nao couber.
 *
 * `emUnidadesDaHud` pela razao de D-934: o host pode ter `zoom`, e um numero
 * lido do `getBoundingClientRect` escrito de volta no `style` cairia noutro
 * lugar. No dedo a escala e sempre 1, entao ali a conta nao muda nada.
 */
function posicionar(el, pedido) {
	const celular = ehCelularEmPe();
	el.classList.toggle('is-celular', celular);
	const janela = el.ownerDocument.defaultView;
	const largura = (janela && janela.innerWidth) || 0;
	const altura = (janela && janela.innerHeight) || 0;
	const ancora = typeof pedido.ancora === 'function' ? pedido.ancora() : null;
	const r = ancora && ancora.getBoundingClientRect ? ancora.getBoundingClientRect() : null;
	const b = el.getBoundingClientRect();

	let top = r ? r.bottom + MARGEM / 2 : MARGEM;
	if (altura > 0 && top + b.height > altura - MARGEM) {
		const acima = r ? r.top - MARGEM / 2 - b.height : MARGEM;
		top = acima >= MARGEM ? acima : Math.max(MARGEM, altura - MARGEM - b.height);
	}

	if (celular) {
		el.style.left = '';
		el.style.top = `${Math.round(Math.max(MARGEM, top))}px`;
		return;
	}

	let left = r ? r.right + MARGEM : MARGEM;
	if (largura > 0 && left + b.width > largura - MARGEM) {
		left = r ? r.left - MARGEM - b.width : MARGEM;
	}
	if (largura > 0) {
		left = Math.max(MARGEM, Math.min(left, largura - b.width - MARGEM));
	}
	// No computador o topo acompanha o "(i)" (e nao "abaixo dele"): o painel
	// abre AO LADO, e o olho nao precisa saltar.
	let topAoLado = r ? r.top : MARGEM;
	if (altura > 0) {
		topAoLado = Math.max(MARGEM, Math.min(topAoLado, altura - b.height - MARGEM));
	}
	el.style.left = `${Math.round(emUnidadesDaHud(left))}px`;
	el.style.top = `${Math.round(emUnidadesDaHud(topAoLado))}px`;
}

/** Desenha (ou redesenha) o conteudo do pedido aberto. */
function desenhar() {
	const pedido = _aberto;
	if (!pedido) {
		return;
	}
	const m = missaoDoPedido(pedido);
	if (!m) {
		// A missao saiu da lista (troca de personagem, lista nova sem ela):
		// um painel falando de algo que nao existe mais e pior que nenhum.
		fecharInfoDaMissao();
		return;
	}
	const dados = pedido.dados();
	const el = criarPainel(pedido.conteiner);
	// O redesenho chega a cada abate que mexe na missao; a rolagem de quem esta
	// lendo o fim da lista no celular NAO volta ao topo por causa dele.
	const corpoAntes = el.querySelector('.im-corpo');
	const rolagem = corpoAntes ? corpoAntes.scrollTop : 0;
	el.setAttribute('aria-label', `Informações da missão ${m.titulo || m.id}`);
	el.innerHTML = infoDaMissaoHtml(m, dados ? dados.execucao : null, {
		verNaJanela: typeof pedido.verNaJanela === 'function'
	});
	const corpo = el.querySelector('.im-corpo');
	if (corpo && rolagem) {
		corpo.scrollTop = rolagem;
	}
	el.classList.add('is-aberto');
	posicionar(el, pedido);
}

/** O mesmo "(i)" do painel aberto, no MESMO conteiner? */
function ehAAncoraAberta(no) {
	return (
		!!_aberto &&
		!!no &&
		typeof no.getAttribute === 'function' &&
		no.getAttribute('data-info') === _aberto.id &&
		typeof no.getRootNode === 'function' &&
		no.getRootNode() === _aberto.conteiner.getRootNode()
	);
}

function ligarPorFora() {
	if (_porFora || !_aberto) {
		return;
	}
	const doc = _aberto.conteiner.ownerDocument;
	_porFora = e => {
		if (!_aberto) {
			return;
		}
		const el = painelEm(_aberto.conteiner);
		const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
		if (el && (caminho.includes(el) || el.contains(e.target))) {
			return;
		}
		/* O MESMO "(i)" nao fecha aqui: o `click` dele vem logo depois e e ele
		   que FECHA (alternar). Fechar no `pointerdown` faria o `click`
		   reabrir — o painel piscaria e ficaria aberto. */
		if (caminho.some(ehAAncoraAberta) || ehAAncoraAberta(e.target)) {
			return;
		}
		fecharInfoDaMissao();
	};
	doc.addEventListener('pointerdown', _porFora, true);
}

function desligarPorFora(doc) {
	if (_porFora && doc) {
		doc.removeEventListener('pointerdown', _porFora, true);
	}
	_porFora = null;
}

/**
 * Abre o painel de uma missao.
 *
 * @param {object} pedido
 * @param {string} pedido.id                    a missao
 * @param {Element} pedido.conteiner            onde o painel mora (a raiz do componente — FORA de
 *                                              qualquer caixa com `overflow: hidden` ou `backdrop-filter`,
 *                                              que prenderiam um `position: fixed`)
 * @param {() => Element|null} pedido.ancora    o "(i)" na tela agora (a lista e redesenhada)
 * @param {Element} [pedido.host]               o host do componente: ganha `data-info-da-missao`
 *                                              enquanto o painel estiver aberto (Common.css o sobe
 *                                              acima da moldura da HUD)
 * @param {() => {missoes: object[], execucao: object|null}} pedido.dados
 * @param {(acao: string, id: string) => void} pedido.agir
 * @param {(id: string, tipo?: string) => void} [pedido.verNaJanela]
 * @returns {boolean} abriu?
 */
export function abrirInfoDaMissao(pedido) {
	if (!pedido || !pedido.id || !pedido.conteiner || typeof pedido.dados !== 'function') {
		return false;
	}
	if (_aberto) {
		fecharInfoDaMissao();
	}
	_aberto = pedido;
	if (pedido.host && pedido.host.dataset) {
		pedido.host.dataset.infoDaMissao = 'aberta';
	}
	abrirBalao(NOME_DO_BALAO, fecharInfoDaMissao);
	ligarPorFora();
	desenhar();
	return _aberto === pedido;
}

/**
 * O gesto do "(i)": abre; no MESMO "(i)" de novo, fecha. Devolve se ficou aberto.
 */
export function alternarInfoDaMissao(pedido) {
	if (_aberto && pedido && _aberto.id === pedido.id && _aberto.conteiner === pedido.conteiner) {
		fecharInfoDaMissao();
		return false;
	}
	return abrirInfoDaMissao(pedido);
}

/**
 * Fecha o painel. Com `conteiner`, so fecha se o painel for DAQUELE conteiner
 * (a janela de Missoes fechando nao fecha o painel aberto pelo cartao da HUD).
 * Devolve se fechou.
 */
export function fecharInfoDaMissao(conteiner) {
	const pedido = _aberto;
	if (!pedido || (conteiner && pedido.conteiner !== conteiner)) {
		return false;
	}
	_aberto = null;
	esquecerBalao(NOME_DO_BALAO);
	desligarPorFora(pedido.conteiner.ownerDocument);
	if (pedido.host && pedido.host.dataset) {
		delete pedido.host.dataset.infoDaMissao;
	}
	const el = painelEm(pedido.conteiner);
	if (el) {
		el.classList.remove('is-aberto');
		el.innerHTML = '';
	}
	return true;
}

/** O id da missao do painel aberto, ou `null`. */
export function infoDaMissaoAberta() {
	return _aberto ? _aberto.id : null;
}

/**
 * O estado das missoes mudou (lista inteira ou parcial de progresso): o painel
 * aberto acompanha — a barra anda enquanto o jogador olha.
 */
export function redesenharInfoDaMissao() {
	if (_aberto) {
		desenhar();
	}
}
