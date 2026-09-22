/**
 * UI/Components/TemporadaIdle/TemporadaIdle.js
 *
 * A JANELA DA TEMPORADA — Season 1, "Luz & Trevas: Herdeiros de Midgard".
 *
 * ---------------------------------------------------------------------------
 * O SERVIDOR DECIDE TUDO, O CLIENTE SÓ DESENHA (o mesmo contrato de
 * PasseIdle.js/CodexIdle.js/MissoesIdle.js)
 * ---------------------------------------------------------------------------
 * Preço, veredito de compra (`compra.pode`/`compra.texto`), pity, situação de
 * cada nível do passe e o prêmio de uma abertura chegam prontos em
 * `ZC_RAGIDLE_TEMPORADA` (0x0fbb). Esta janela NUNCA calcula
 * `saldo >= preco`, NUNCA recalcula chance/pity e NUNCA manda preço, prêmio,
 * raridade, chance, sorte ou pity no pacote de saída — só o VERBO, o pool (ou
 * nível/trilha) e a `chave` do clique.
 *
 * ---------------------------------------------------------------------------
 * A METADE PURA MORA EM `formatoDaTemporada.js`
 * ---------------------------------------------------------------------------
 * Toda formatação/HTML de card é função pura (entrada -> string), testada
 * direto sem subir a janela — o mesmo corte que `PainelComandoIdle` fez com
 * `tabelaDoPainel.js`. Este arquivo só monta: pacote, DOM, cliques, trava.
 *
 * ---------------------------------------------------------------------------
 * A TRAVA DE CLIQUE (a tarefa pede: clique -> trava TUDO -> envia -> destrava
 * no ZC ou em 10s sem resposta)
 * ---------------------------------------------------------------------------
 * `_trava` (criarTrava(), em formatoDaTemporada.js) é UMA trava para TODAS as
 * ações (comprar-caixa/abrir-caixa/resgatar/resgatar-visual-vip e, desde
 * 21/09/2026, comprar-passe), não uma por botão: dois cliques em botões
 * DIFERENTES enquanto a primeira ação ainda não voltou cobrariam duas vezes
 * do mesmo jeito que dois cliques no mesmo botão cobrariam - o servidor
 * aceitaria as duas, e as duas seriam válidas.
 *
 * ---------------------------------------------------------------------------
 * AS RECOMPENSAS MORAM AQUI DESDE 21/09/2026 (pedido do dono: "a janela de
 * recompensas nao compensa mais; vai colocar ela ali na aba da temporada")
 * ---------------------------------------------------------------------------
 * O Passe Semanal e a compra do VIP vieram da janela `PasseIdle` (Recompensas),
 * que ficou SEM BOTAO no menu. O que NAO veio junto foi o pacote: o dono do
 * `ZC_RAGIDLE_PASSE` (0x0fe5) CONTINUA sendo o PasseIdle, e esta janela so
 * ASSINA `PasseIdle.aoReceberEstado` para receber o estado dele. Pedir
 * (`CZ_RAGIDLE_PEDIR_PASSE`) e comprar (`CZ_RAGIDLE_COMPRAR_PASSE`) sao pacotes
 * de SAIDA, e mandar pacote nao disputa dono com ninguem.
 *
 * ELA NAO DA `hookPacket` NO 0x0fe5, E ISSO NAO E ESTILO: `Network.hookPacket`
 * faz `Packets.list[id].callback = callback` (NetworkManager.js) - o segundo
 * gancho no mesmo opcode APAGA o primeiro. Enquanto esta janela hookava o
 * `ZC_RAGIDLE_PASSE`, a janela de Recompensas ficava em "Carregando..." para
 * sempre, porque o estado dela nunca chegava. Foi para producao em 21/09/2026.
 * Ha portao no servidor: `servidor/protocolo/um-dono-por-pacote.test.ts`.
 *
 * ---------------------------------------------------------------------------
 * O REDESENHO PREMIUM DE 22/09/2026 (contrato V2 - `CONTRATO-TEMPORADA-V2.md`)
 * ---------------------------------------------------------------------------
 * O `ZC_RAGIDLE_TEMPORADA` sobe para `v: 2`: o bloco `passe` troca de forma
 * (XP em vez de pontos, VIP em vez de Premium comprado) e ganha missoes
 * diarias/semanais. O Passe de Batalha volta a ser ABA PROPRIA (nao mais
 * encolhido dentro dos Destaques) e o Passe Semanal sai do catalogo por
 * completo - decisao do dono. `ABAS` e `onTemporadaRecebida` sao os dois
 * pontos que mudam de forma aqui; o resto (trava, modais, reveal, pacotes de
 * saida) continua igual.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import DB from 'DB/DBManager.js';
import { unknownItem } from 'DB/Items/FichaDoItem.js';
import Client from 'Core/Client.js';
import arrastarPorPonteiro, { prenderNaTela } from 'UI/arrastarPorPonteiro.js';
import PasseIdle from '../PasseIdle/PasseIdle.js';
import { itemIconUrl, preferirArtePublicada } from 'Utils/ItemArt.js';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';
import { formatarRoCash, minorDe, minorDePrimeiro } from 'Utils/roCash.js';
import htmlText from './TemporadaIdle.html?raw';
import cssText from './TemporadaIdle.css?raw';
import {
	avisoDoResultado,
	criarTrava,
	dataCurta,
	gerarChave,
	passePorTipo,
	renderBannerDasCaixasHtml,
	renderCaixaHtml,
	renderDestaquesHtml,
	renderModalConteudoHtml,
	renderPasseDeBatalhaHtml,
	renderRevealHtml,
	renderVipHtml,
	textoDoSeloVip
} from './formatoDaTemporada.js';

/** Manter em sincronia com o ":host"/".te-window" do CSS. */
const WINDOW_WIDTH = 680;
const WINDOW_HEIGHT = 640;

/** Quanto tempo o aviso do rodapé fica na tela. */
const AVISO_MS = 4200;

/** A tarefa pede exatamente isto: sem resposta em 10s, destrava e avisa. */
const TIMEOUT_SEM_RESPOSTA_MS = 10000;

const TemporadaIdle = new GUIComponent('TemporadaIdle', cssText);

TemporadaIdle.render = () => htmlText;

/** Janela fechada não pode engolir clique de cena. */
TemporadaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O último estado inteiro que o servidor mandou (contrato v2). */
TemporadaIdle.estado = null;

/** O último estado do PASSE (0x0fe5), recebido por `PasseIdle.aoReceberEstado`. */
TemporadaIdle.estadoDoPasse = null;

/*
 * AS QUATRO ABAS (22/09/2026, contrato V2 - `CONTRATO-TEMPORADA-V2.md`):
 * Destaques, Caixas, Passe de Batalha e VIP.
 *
 * O Passe Semanal SAIU - decisao do dono, desativada por completo (o
 * servidor recusa a compra e para de entregar o cashback diario; nada e
 * apagado do estado do jogador, so deixa de ser honrado). O Passe de
 * Batalha VOLTOU a ser aba propria - tinha sido fundida nos Destaques em
 * 21/09/2026, e o documento de redesenho e explicito: nao fundir, nao
 * esconder. O VIP continua sendo UMA aba onde eram duas (a desta janela e a
 * das Recompensas) - as duas descreviam o mesmo produto por angulos
 * diferentes: o que ele da, e como se compra.
 */
const ABAS = ['destaques', 'caixas', 'passe', 'vip'];
const ABA_PADRAO = 'destaques';

TemporadaIdle.activeTab = ABA_PADRAO;

const _preferences = Preferences.get(
	'TemporadaIdle',
	{
		x: null,
		y: null,
		aba: null
	},
	1.0
);

/** Uma trava só, para todas as ações - ver o cabeçalho. */
const _trava = criarTrava();

let _avisoTimer = null;
let _revealTimer = null;
let _timeoutSemResposta = null;
/** A confirmação pendente (o que rodar se o jogador clicar "Confirmar"). */
let _executarAoConfirmar = null;

function _root() {
	return TemporadaIdle._shadow || TemporadaIdle._host;
}

function janelaEstaAberta() {
	const root = _root();
	const win = root && root.querySelector('.te-window');
	return !!(win && win.classList.contains('is-open'));
}

/* ------------------------------------------------------------------ */
/* Ícone real por itemId — melhora o fallback de inicial, nunca quebra */
/* ------------------------------------------------------------------ */

/**
 * Tenta trocar a inicial pelo ícone de verdade: a arte PUBLICADA por id
 * primeiro, o GRF depois (o mesmo caminho de ItemObtain.js/CorreioIdle.js).
 *
 * Fora do motor completo (teste vitest, arnês de foto do Playwright) `DB`/
 * `Client` não têm o que ler — o `catch` garante que a inicial já desenhada
 * fica exatamente como está. É a moldura "nunca imagem quebrada" que a tarefa
 * pede, num lugar só.
 */
function melhorarIcones(escopo) {
	if (!escopo || typeof escopo.querySelectorAll !== 'function') {
		return;
	}
	escopo.querySelectorAll('.te-icone[data-item-id]').forEach(el => {
		if (el.dataset.melhorado) {
			return;
		}
		el.dataset.melhorado = '1';
		const itemId = Number(el.dataset.itemId);
		if (!Number.isFinite(itemId) || itemId <= 0) {
			return;
		}

		const pintar = url => {
			if (!url) {
				return;
			}
			const img = document.createElement('img');
			img.className = 'te-icone-img';
			img.width = 24;
			img.height = 24;
			img.alt = '';
			img.onerror = () => img.remove();
			img.src = url;
			el.appendChild(img);
			el.classList.add('is-carregado');
		};

		/*
		 * A ARTE PUBLICADA VEM PRIMEIRO, e a prova de tela de 21/09/2026 e quem
		 * mandou: este bloco ia direto ao GRF por
		 * `DB.getItemInfo(id).identifiedResourceName`, e 26 dos 33 visuais desta
		 * Season sao CUSTOM (9.000.3xx) - id que o `ItemTable.js` do cliente nao
		 * conhece. `getItemInfo` devolvia `unknownItem` para todos eles, e a
		 * janela desenhava a MACA no reveal, no correio e na trilha do passe.
		 *
		 * `Utils/ItemArt.js` ja resolve isto para a Mochila e para a dica de item:
		 * `/ragidle/item/<id>.png` primeiro (o PNG que o pipeline do jogo publica
		 * por ID, e que portanto conhece os custom), e o `.bmp` do GRF so quando
		 * ele nao existe. Reusar a peca e o conserto; uma terceira rota seria a
		 * forma 'duas rotas, a 2a escrita a mao' que este projeto ja catalogou.
		 *
		 * E QUANDO NEM O PNG EXISTE, A INICIAL FICA. A prova de tela do
		 * redesenho (21/09/2026) mostrou 4 dos 6 premios da Caixa Topo com a
		 * POCAO VERMELHA: para todo custom SEM PNG publicado o GRF respondia
		 * `unknownItem` - um SUCESSO com a arte errada, que `pintar` aceitava.
		 * Arte errada e pior que inicial; a inicial ao menos nao mente. (Quantos
		 * custom tem PNG muda a cada publicacao do pipeline; a regra nao.)
		 */
		preferirArtePublicada(itemIconUrl(itemId), pintar, () => {
			try {
				const info = DB.getItemInfo(itemId);
				if (!info || info === unknownItem) {
					return;
				}
				const resource = info.identifiedResourceName;
				if (!resource) {
					return;
				}
				Client.loadFile(DB.INTERFACE_PATH + 'item/' + resource + '.bmp', pintar);
			} catch (err) {
				/* DB/Client indisponiveis fora do motor - o fallback da inicial ja
				   esta na tela, e nada quebra. */
			}
		});
	});
}

/* ------------------------------------------------------------------ */
/* Aviso do rodapé + trava global de clique                            */
/* ------------------------------------------------------------------ */

function mostrarAviso(texto, ehErro) {
	const root = _root();
	const aviso = root && root.querySelector('.te-aviso');
	if (!aviso || !texto) {
		return;
	}
	aviso.textContent = texto;
	aviso.classList.toggle('is-erro', !!ehErro);
	aviso.classList.add('is-visivel');
	if (_avisoTimer) {
		clearTimeout(_avisoTimer);
	}
	_avisoTimer = setTimeout(() => {
		aviso.classList.remove('is-visivel');
		_avisoTimer = null;
	}, AVISO_MS);
}

function travarBotoes() {
	_trava.travar();
	const root = _root();
	const corpo = root && root.querySelector('.te-body');
	if (corpo) {
		corpo.classList.add('is-carregando');
	}
	if (_timeoutSemResposta) {
		clearTimeout(_timeoutSemResposta);
	}
	_timeoutSemResposta = setTimeout(() => {
		_timeoutSemResposta = null;
		destravarBotoes();
		mostrarAviso('Sem resposta do servidor.', true);
	}, TIMEOUT_SEM_RESPOSTA_MS);
}

function destravarBotoes() {
	_trava.destravar();
	if (_timeoutSemResposta) {
		clearTimeout(_timeoutSemResposta);
		_timeoutSemResposta = null;
	}
	const root = _root();
	const corpo = root && root.querySelector('.te-body');
	if (corpo) {
		corpo.classList.remove('is-carregando');
	}
}

/* ------------------------------------------------------------------ */
/* Reveal da abertura                                                  */
/* ------------------------------------------------------------------ */

function fecharReveal() {
	const root = _root();
	const el = root && root.querySelector('.te-reveal');
	if (el) {
		el.hidden = true;
		el.innerHTML = '';
	}
	if (_revealTimer) {
		clearTimeout(_revealTimer);
		_revealTimer = null;
	}
}

function mostrarReveal(resultado) {
	const root = _root();
	const el = root && root.querySelector('.te-reveal');
	if (!el || !resultado || !resultado.abertura) {
		return;
	}
	el.innerHTML = renderRevealHtml(resultado);
	melhorarIcones(el);
	el.hidden = false;
	if (_revealTimer) {
		clearTimeout(_revealTimer);
	}
	/*
	 * COMMON é rápido e discreto, RARE fica um pouco mais, LEGENDARY fica mais
	 * tempo (o reveal "especial dourado, sem exagero" que a tarefa pede) — mas
	 * o botão "Fechar" e o clique no fundo sempre dispensam na hora, então
	 * este timer é só o piso de quem não vai mexer no mouse.
	 */
	const raridade = String(resultado.abertura.raridade || '').toUpperCase();
	const duracao = raridade === 'LEGENDARY' ? 7000 : raridade === 'RARE' ? 5000 : 3200;
	_revealTimer = setTimeout(fecharReveal, duracao);
}

/* ------------------------------------------------------------------ */
/* Modais (conteúdo da caixa / confirmação de compra)                  */
/* ------------------------------------------------------------------ */

function fecharModais() {
	const root = _root();
	if (!root) {
		return;
	}
	root.querySelectorAll('.te-modal').forEach(modal => {
		modal.hidden = true;
	});
	_executarAoConfirmar = null;
}

function caixaPorPool(pool) {
	const lista = (TemporadaIdle.estado && TemporadaIdle.estado.caixas) || [];
	return lista.find(c => c && c.pool === pool) || null;
}

function abrirModalConteudo(pool) {
	const caixa = caixaPorPool(pool);
	if (!caixa) {
		return;
	}
	const root = _root();
	const modal = root && root.querySelector('.te-modal--conteudo');
	const corpo = modal && modal.querySelector('.te-modal-corpo');
	if (!modal || !corpo) {
		return;
	}
	corpo.innerHTML = renderModalConteudoHtml(caixa);
	melhorarIcones(corpo);
	modal.hidden = false;
}

/** Confirmação antes de gastar cash - caixa e VIP. */
function abrirConfirmacao(texto, executar) {
	const root = _root();
	const modal = root && root.querySelector('.te-modal--confirmar');
	const alvo = modal && modal.querySelector('.te-confirmar-texto');
	if (!modal || !alvo) {
		// Sem modal no DOM (não deveria acontecer): não trava o jogador sem
		// explicação nenhuma, mas também não gasta cash sem confirmar — só
		// desiste, e é visível (o botão não fez nada).
		return;
	}
	alvo.textContent = texto;
	_executarAoConfirmar = executar;
	modal.hidden = false;
}

function confirmarPendente() {
	const executar = _executarAoConfirmar;
	fecharModais();
	if (typeof executar === 'function') {
		executar();
	}
}

/* ------------------------------------------------------------------ */
/* Os pacotes de saída                                                 */
/* ------------------------------------------------------------------ */

function enviarAcao(corpo) {
	if (_trava.estaTravado()) {
		return;
	}
	travarBotoes();
	const pkt = new PACKET.CZ.RAGIDLE_TEMPORADA_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

function pedirEstado() {
	const pkt = new PACKET.CZ.RAGIDLE_TEMPORADA_ACAO();
	pkt.json = JSON.stringify({ acao: 'pedir' });
	Network.sendPacket(pkt);
}

/** O estado do Passe (semanal/VIP) - a resposta chega por `PasseIdle.aoReceberEstado`. */
function pedirEstadoDoPasse() {
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_PASSE());
}

/**
 * A compra de um passe (semanal/vip) - o MESMO pacote que a janela de
 * Recompensas mandava (0x0fe7). O botao trava ate a resposta chegar pelo
 * caminho do PasseIdle, senao dois cliques rapidos mandariam duas compras
 * e o servidor cobraria as duas (a segunda renova).
 */
function enviarCompraDePasse(tipo) {
	if (_trava.estaTravado()) {
		return;
	}
	travarBotoes();
	Network.sendPacket(new PACKET.CZ.RAGIDLE_COMPRAR_PASSE(tipo));
}

/* ------------------------------------------------------------------ */
/* Cliques                                                             */
/* ------------------------------------------------------------------ */

function irParaAba(aba) {
	if (!aba || ABAS.indexOf(aba) === -1 || aba === TemporadaIdle.activeTab) {
		return;
	}
	TemporadaIdle.activeTab = aba;
	lembrarAba(_preferences, aba);
	render();
	const corpo = _root() && _root().querySelector('.te-body');
	if (corpo) {
		corpo.scrollTop = 0;
	}
}

function onClickTab(botao) {
	irParaAba(botao.dataset.tab);
}

/**
 * O único lugar que decide QUAL ação mandar — e o único que checa a trava,
 * ANTES de montar corpo nenhum. Duplo clique (ou clique noutro botão de ação
 * enquanto a primeira resposta não voltou) para bem aqui.
 */
function onClicarAcao(botao) {
	if (botao.disabled || _trava.estaTravado()) {
		return;
	}
	const agir = botao.dataset.agir;
	if (agir === 'comprar-caixa') {
		const pool = botao.dataset.pool;
		const caixa = caixaPorPool(pool);
		if (!caixa) {
			return;
		}
		abrirConfirmacao(`Comprar ${caixa.nome} por ${formatarRoCash(minorDe(caixa, 'preco') || 0)} RO Cash?`, () =>
			enviarAcao({ acao: 'comprar-caixa', pool, chave: gerarChave() })
		);
		return;
	}
	if (agir === 'abrir-caixa') {
		const pool = botao.dataset.pool;
		enviarAcao({ acao: 'abrir-caixa', pool, chave: gerarChave() });
		return;
	}
	if (agir === 'resgatar') {
		const nivel = Number(botao.dataset.nivel);
		const trilha = botao.dataset.trilha;
		enviarAcao({ acao: 'resgatar', nivel, trilha });
		return;
	}
	if (agir === 'resgatar-visual-vip') {
		/* Sem confirmação: não gasta cash nenhum — é um resgate, e o servidor
		   recusa sozinho sem VIP ou já resgatado. */
		enviarAcao({ acao: 'resgatar-visual-vip' });
		return;
	}
	if (agir === 'comprar-passe') {
		/* Desde 22/09/2026 so existe UM tipo compravel por este verbo: o VIP
		   de 30 dias. O Passe Semanal saiu do catalogo (contrato V2) e o
		   Passe Premium nao existe mais (a segunda trilha do Passe de
		   Batalha e o proprio VIP). */
		const tipo = botao.dataset.tipo;
		if (tipo !== 'vip') {
			return;
		}
		const passe = passePorTipo(TemporadaIdle.estadoDoPasse, tipo);
		const verbo = passe && passe.ativo ? 'Renovar' : 'Comprar';
		const preco =
			passe && minorDePrimeiro(passe, ['preco', 'cash']) !== null
				? `${formatarRoCash(minorDePrimeiro(passe, ['preco', 'cash']))} RO Cash`
				: '';
		abrirConfirmacao(`${verbo} o VIP${preco ? ` por ${preco}` : ''}?`, () => enviarCompraDePasse(tipo));
	}
}

/** Um único listener delegado no elemento raiz — cobre a janela e os modais. */
function onClickRaiz(e) {
	const fechar = e.target.closest('.te-close');
	if (fechar) {
		e.stopImmediatePropagation();
		TemporadaIdle.toggle();
		return;
	}

	const tab = e.target.closest('.te-tab');
	if (tab) {
		e.stopImmediatePropagation();
		onClickTab(tab);
		return;
	}

	/* Os atalhos dos Destaques (chamada do Passe de Batalha, caixas em
	   resumo, Caixas, VIP) so TROCAM DE ABA - nunca disparam acao. */
	const ir = e.target.closest('[data-ir]');
	if (ir) {
		e.stopImmediatePropagation();
		irParaAba(ir.dataset.ir);
		return;
	}

	const verConteudo = e.target.closest('.te-ver-conteudo');
	if (verConteudo) {
		e.stopImmediatePropagation();
		abrirModalConteudo(verConteudo.dataset.pool);
		return;
	}

	const cancelar = e.target.closest('.te-modal-fechar, .te-modal-fundo, .te-confirmar-cancelar');
	if (cancelar) {
		e.stopImmediatePropagation();
		fecharModais();
		return;
	}

	const confirmarOk = e.target.closest('.te-confirmar-ok');
	if (confirmarOk) {
		e.stopImmediatePropagation();
		confirmarPendente();
		return;
	}

	const revealFechar = e.target.closest('.te-reveal-fechar');
	if (revealFechar) {
		e.stopImmediatePropagation();
		fecharReveal();
		return;
	}
	if (e.target.classList && e.target.classList.contains('te-reveal')) {
		fecharReveal();
		return;
	}

	const botaoAcao = e.target.closest('[data-agir]');
	if (botaoAcao) {
		e.stopImmediatePropagation();
		onClicarAcao(botaoAcao);
	}
}

/* ------------------------------------------------------------------ */
/* O desenho                                                           */
/* ------------------------------------------------------------------ */

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const estado = TemporadaIdle.estado;
	const estadoDoPasse = TemporadaIdle.estadoDoPasse;

	root.querySelectorAll('.te-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.tab === TemporadaIdle.activeTab);
	});

	/* O saldo: o da Temporada quando ja chegou; senao o do Passe, que e o
	   mesmo cash da mesma conta - os dois pacotes o trazem. */
	/* Em MINOR desde o RO Shop (22/09/2026): `saldoMinor`/`cashMinor` do
	   contrato novo, ou o inteiro antigo x100 (`Utils/roCash.js:minorDe`), e o
	   MESMO `formatarRoCash` do RO Shop e da HUD. */
	const carteira = root.querySelector('.te-carteira-valor');
	if (carteira) {
		const saldoDaTemporada = minorDe(estado && estado.moeda, 'saldo');
		const saldo = saldoDaTemporada !== null ? saldoDaTemporada : minorDePrimeiro(estadoDoPasse, ['saldo', 'cash']);
		carteira.textContent = formatarRoCash(saldo || 0);
	}

	const selo = root.querySelector('.te-selo-vip');
	if (selo) {
		const vipAtivo = !!(estado && estado.vip && estado.vip.ativo);
		selo.textContent = textoDoSeloVip(estado && estado.vip);
		selo.classList.toggle('ri-badge--ouro', vipAtivo);
		selo.classList.toggle('ri-badge--cinza', !vipAtivo);
	}

	const corpo = root.querySelector('.te-body');
	if (!corpo) {
		return;
	}
	corpo.dataset.aba = TemporadaIdle.activeTab;

	/* Desde que o Passe Semanal saiu (22/09/2026) TODAS as abas dependem do
	   estado da Temporada (0x0fbb) - so a compra do VIP, dentro da aba VIP,
	   ainda depende tambem do estado do Passe (0x0fe5). */
	if (!estado) {
		corpo.innerHTML = '<div class="te-carregando">Carregando…</div>';
		return;
	}

	if (TemporadaIdle.activeTab === 'caixas') {
		corpo.innerHTML = `${renderBannerDasCaixasHtml()}<div class="te-caixas-grade">${(estado.caixas || []).map(renderCaixaHtml).join('')}</div>`;
	} else if (TemporadaIdle.activeTab === 'passe') {
		corpo.innerHTML = renderPasseDeBatalhaHtml(estado.passe);
	} else if (TemporadaIdle.activeTab === 'vip') {
		corpo.innerHTML = renderVipHtml(estado.vip, estadoDoPasse);
	} else {
		corpo.innerHTML = renderDestaquesHtml(estado);
	}
	melhorarIcones(corpo);
}

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

function savePosition() {
	_preferences.x = parseInt(TemporadaIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(TemporadaIdle._host.style.top, 10) || 0;
	_preferences.save();
}

TemporadaIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	TemporadaIdle.estado = null;
	TemporadaIdle.estadoDoPasse = null;
	/* A aba volta para a LEMBRADA, não para a de fábrica — mesma razão de
	   PasseIdle.js/MissoesIdle.js: é escolha da PESSOA, não do personagem. */
	TemporadaIdle.activeTab = abaLembrada(_preferences, ABA_PADRAO, ABAS);
	destravarBotoes();
	fecharReveal();
	fecharModais();
	fecharEEsquecer(_root(), '.te-window');
};

TemporadaIdle.init = function init() {
	const root = _root();
	TemporadaIdle.activeTab = abaLembrada(_preferences, ABA_PADRAO, ABAS);

	// Guardas nos querySelector pelo motivo registrado em
	// ClassChangeNotice.js:68-88: este init roda dentro de MapEngine.init, e
	// uma exceção aqui derruba o motor de mapa inteiro.
	const container = root && root.querySelector('#TemporadaIdle');
	if (container) {
		container.addEventListener('click', onClickRaiz);
	}
	const titulo = root && root.querySelector('.te-titlebar');
	if (titulo) {
		arrastarPorPonteiro({
			alca: titulo,
			painel: this._host,
			aoSoltar: ({ left, top }) => {
				_preferences.x = left;
				_preferences.y = top;
				_preferences.save();
			}
		});
	}

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	render();
};

TemporadaIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.left = _preferences.x + 'px';
		this._host.style.top = _preferences.y + 'px';
	}
	// A tela de hoje pode ser menor que a de ontem: a posição guardada é
	// PRENDIDA antes de valer (mesma regra de PainelComandoIdle.js).
	prenderNaTela(this._host);
};

TemporadaIdle.onRemove = function onRemove() {
	savePosition();
	destravarBotoes();
	fecharReveal();
};

/** Abre/fecha; ao abrir, pede os DOIS estados ao servidor (temporada e passe). */
TemporadaIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.te-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		fecharModais();
		fecharReveal();
		savePosition();
	} else {
		win.classList.add('is-open');
		TemporadaIdle.focus();
		pedirEstado();
		pedirEstadoDoPasse();
	}
};

/* ------------------------------------------------------------------ */
/* Os pacotes                                                          */
/* ------------------------------------------------------------------ */

function onTemporadaRecebida(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[TemporadaIdle] payload nao e JSON valido', err);
		return;
	}
	/* O contrato sobe para v2 em 22/09/2026 (CONTRATO-TEMPORADA-V2.md): o
	   bloco `passe` troca de forma (XP em vez de pontos, VIP em vez de
	   Premium). Um payload de versao diferente e ignorado, do mesmo jeito
	   que o v1 ja ignorava payload de formato desconhecido - a janela so
	   redesenha quando o formato bate com o que ela sabe ler, nunca tenta
	   adivinhar um campo que mudou de nome. */
	/* RO Shop (22/09/2026): a `v: 3` do contrato traz o dinheiro em MINOR
	   (`moeda.saldoMinor`, `caixas[].precoMinor` - CONTRATO.md do RO Shop,
	   secao 5). O resto do payload e o da v2, e a janela ja le as duas formas
	   do dinheiro por `minorDe`; versao que ela nao conhece continua ignorada. */
	if (!dados || (dados.v !== 2 && dados.v !== 3)) {
		return;
	}
	destravarBotoes();
	TemporadaIdle.estado = dados;
	render();

	const resultado = dados.resultado;
	if (resultado) {
		const aviso = avisoDoResultado(resultado);
		if (aviso && aviso.texto) {
			mostrarAviso(aviso.texto, aviso.ehErro);
		}
		if (resultado.ok && resultado.abertura) {
			mostrarReveal(resultado);
		}
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_TEMPORADA, onTemporadaRecebida);

/*
 * O ESTADO DO PASSE chega por AQUI, e nunca por um segundo `hookPacket` no
 * 0x0fe5 (ver o cabecalho). O PasseIdle continua sendo o dono do pacote e
 * chama este ouvinte depois de desenhar a propria janela (que hoje nao tem
 * botao no menu - ver PasseIdle.js).
 *
 * Tres coisas acontecem aqui: o estado e guardado e a aba redesenhada; a
 * trava de clique abre (uma compra de passe foi respondida); e o resultado
 * da compra vira aviso no rodape desta janela - a de Recompensas, fechada,
 * mostraria o dela para ninguem. Quando a compra e de VIP e deu certo, o
 * estado da Temporada e pedido de novo: o selo do cabecalho, o visual do VIP
 * e os atalhos dos Destaques dependem do que o Passe acabou de mudar.
 */
function onPasseMudou(dados) {
	TemporadaIdle.estadoDoPasse = dados;
	destravarBotoes();
	render();

	const comprou = dados && dados.comprou;
	if (comprou && comprou.ok) {
		/* Desde 22/09/2026 o unico tipo que esta janela manda para
		   `comprar-passe` e 'vip' - o Passe Semanal saiu do catalogo (ver o
		   cabecalho). */
		const passe = passePorTipo(dados, comprou.tipo);
		mostrarAviso(`VIP ativo até ${dataCurta(passe && passe.expiraEm)}.`, false);
		if (comprou.tipo === 'vip' && janelaEstaAberta()) {
			pedirEstado();
		}
	} else if (comprou && !comprou.ok) {
		mostrarAviso(comprou.motivo || 'Não foi possível comprar.', true);
	}
}
PasseIdle.aoReceberEstado = onPasseMudou;

export default UIManager.addComponent(TemporadaIdle);
