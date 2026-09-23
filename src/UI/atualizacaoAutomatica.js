/**
 * UI/atualizacaoAutomatica.js
 *
 * O JOGO ABERTO HA DIAS SE ATUALIZA SOZINHO (D-997, 23/09/2026, pedido do
 * dono: *"um jogador que esta com o jogo aberto por dias, ele consegue receber
 * um aviso de que uma atualizacao esta disponivel e o proprio jogo atualizar a
 * tela automaticamente em uma contagem de 5 segundos?"*).
 *
 * QUEM DESCOBRE a versao nova e a casca (`applications/pwa/registrar-sw.js`):
 * ela confere o servidor a cada 30 min e na volta da aba, e dispara
 * `ragidle:versao-nova` quando acha um build MAIS NOVO que a pagina. Este
 * modulo decide QUANDO trocar e o faz sem deslogar ninguem.
 *
 * ---------------------------------------------------------------------------
 * SO NA VOLTA DA ABA — a regra que o dono aprovou
 * ---------------------------------------------------------------------------
 * A contagem so comeca quando a aba ACABOU de voltar a ficar visivel
 * (`MS_DA_JANELA_DA_VOLTA`). Com a aba em segundo plano nada acontece; com o
 * jogador olhando a tela ha tempo, tambem nao — a versao espera a proxima
 * volta. A razao e o jogo idle: quem volta ao jogo le "Atualizando em 5 s" e
 * entende; quem esta no meio de uma janela aberta nao e interrompido.
 *
 * ---------------------------------------------------------------------------
 * SEM DESLOGAR
 * ---------------------------------------------------------------------------
 * A pagina recarregada perderia a sessao, que mora so na memoria. Por isso a
 * recarga guarda antes a retomada (`Engine/retomadaAposAtualizacao.js`), e a
 * pagina nova volta ao mesmo personagem pelo char-server. O personagem nem
 * sente: a caca segue no servidor enquanto a pagina recarrega (D-275).
 *
 * ---------------------------------------------------------------------------
 * SEM LACO
 * ---------------------------------------------------------------------------
 * Toda tentativa fica anotada na aba (`CHAVE_DA_ULTIMA_ATUALIZACAO`). Se a
 * pagina recarregada ainda se achar velha para a MESMA versao (um CDN servindo
 * o `api.html` antigo, por exemplo), ela nao tenta de novo por
 * `MS_SEM_REPETIR_A_MESMA_VERSAO`: recarregar em laco seria pior que ficar
 * uma versao atras.
 *
 * **Isto nao entra no caminho critico do mapa** (o aviso de D-993): ele e
 * ligado no boot do `GameEngine`, dentro de `try`, e so reage a eventos.
 */

import Session from 'Engine/SessionStorage.js';
import { guardarRetomada } from 'Engine/retomadaAposAtualizacao.js';
import { janelaDaCasca, pontePWA } from 'UI/ofertaDeInstalacao.js';

/** A contagem que o dono pediu. */
export const SEGUNDOS_DA_CONTAGEM = 5;

/** Quanto depois da volta da aba a contagem ainda pode comecar. */
export const MS_DA_JANELA_DA_VOLTA = 60_000;

/** A mesma versao nao e tentada de novo dentro deste prazo. */
export const MS_SEM_REPETIR_A_MESMA_VERSAO = 10 * 60_000;

export const CHAVE_DA_ULTIMA_ATUALIZACAO = 'ragidle:ultima-atualizacao';

/**
 * A decisao, pura.
 *
 * @param {{versaoPendente: string|null, visivel: boolean, msDesdeAVolta: number|null,
 *          ultimaTentativa: {versao: string, em: number}|null, agora: number}} estado
 * @returns {boolean}
 */
export function deveComecarAContagem(estado) {
	const { versaoPendente, visivel, msDesdeAVolta, ultimaTentativa, agora } = estado;
	if (!versaoPendente || !visivel) {
		return false;
	}
	if (msDesdeAVolta === null || msDesdeAVolta < 0 || msDesdeAVolta > MS_DA_JANELA_DA_VOLTA) {
		return false;
	}
	if (
		ultimaTentativa &&
		ultimaTentativa.versao === versaoPendente &&
		agora - ultimaTentativa.em < MS_SEM_REPETIR_A_MESMA_VERSAO
	) {
		return false;
	}
	return true;
}

function lerUltimaTentativa() {
	try {
		const texto = window.sessionStorage.getItem(CHAVE_DA_ULTIMA_ATUALIZACAO);
		const dados = texto ? JSON.parse(texto) : null;
		return dados && typeof dados.versao === 'string' && typeof dados.em === 'number' ? dados : null;
	} catch {
		return null;
	}
}

function anotarTentativa(versao, agora) {
	try {
		window.sessionStorage.setItem(CHAVE_DA_ULTIMA_ATUALIZACAO, JSON.stringify({ versao, em: agora }));
	} catch {
		/* sem anotacao, a protecao contra laco fica sem memoria; a recarga segue */
	}
}

/* ═════════════════════════════════════════════════════════════════════
   A CAIXA DA CONTAGEM
   ═════════════════════════════════════════════════════════════════════ */

const ID_DA_CAIXA = 'ri-atualizando';
const FONTE_UI = "'Figtree',Arial,'Liberation Sans',Arimo,sans-serif";

function montarCaixa(aoAtualizarAgora) {
	const caixa = document.createElement('div');
	caixa.id = ID_DA_CAIXA;
	caixa.setAttribute('role', 'status');
	/* A marca de UI (D-1380): sem ela o ouvinte de toque do jogo engole o
	   clique no celular, e o botao morre no iPhone — o defeito que prendeu o
	   aparelho do dono numa versao velha por duas semanas. */
	caixa.dataset.guiComponent = ID_DA_CAIXA;
	caixa.style.cssText = [
		'position:fixed',
		'left:50%',
		'transform:translateX(-50%)',
		'top:calc(env(safe-area-inset-top, 0px) + 12px)',
		'z-index:2147483000',
		'display:flex',
		'align-items:center',
		'gap:12px',
		'max-width:calc(100vw - 24px)',
		'padding:10px 14px',
		'border-radius:8px',
		'border:1px solid rgba(36,92,158,0.34)',
		'background:linear-gradient(180deg,rgba(255,255,255,0.97) 0%,rgba(239,245,252,0.95) 100%)',
		'color:#12294a',
		'font:600 13px/1.3 ' + FONTE_UI,
		'box-shadow:0 10px 28px rgba(12,34,64,0.28),0 2px 6px rgba(12,34,64,0.16),inset 0 0 0 1px rgba(240,216,155,0.75)'
	].join(';');

	const texto = document.createElement('span');
	texto.style.cssText = 'flex:1;min-width:0';

	const agora = document.createElement('button');
	agora.type = 'button';
	agora.textContent = 'Atualizar agora';
	agora.style.cssText = [
		'min-height:44px',
		'padding:0 16px',
		'border-radius:6px',
		'border:1px solid #245c9e',
		'background:linear-gradient(180deg,#4b81b8 0%,#245c9e 100%)',
		'color:#ffffff',
		'font:600 13px ' + FONTE_UI,
		'cursor:pointer'
	].join(';');
	agora.addEventListener('click', aoAtualizarAgora);

	caixa.appendChild(texto);
	caixa.appendChild(agora);
	document.body.appendChild(caixa);
	return { caixa, texto };
}

/* ═════════════════════════════════════════════════════════════════════
   O CICLO
   ═════════════════════════════════════════════════════════════════════ */

let _ligado = false;
let _versaoPendente = null;
let _ultimaVoltaEm = null;
let _contagem = null; // { caixa, texto, relogio, restantes, feito }

/* Recarrega a ABA inteira (a casca), e nao so o documento do jogo: e a casca
   que traz o registrador novo. Trocavel so para os testes (o jsdom nao deixa
   espiar `location.reload`). */
let _recarregar = () => janelaDaCasca().location.reload();

function visivel() {
	return document.visibilityState !== 'hidden';
}

function cancelarContagem() {
	if (!_contagem) {
		return;
	}
	clearTimeout(_contagem.relogio);
	_contagem.caixa.remove();
	_contagem = null;
}

/**
 * Guarda a retomada e recarrega a aba. `CharEngine` entra por import dinamico:
 * este modulo liga no boot, e puxar o motor de personagem para o grafo de
 * import do boot so para ler o servidor atual inverteria a dependencia.
 */
function atualizar() {
	const versao = _versaoPendente;
	anotarTentativa(versao, Date.now());
	return import('Engine/CharEngine.js')
		.then(m => {
			const servidor = m.default.servidorAtual;
			guardarRetomada(Session, servidor, Session.Playing ? Session.GID : null, Date.now());
		})
		.catch(() => {
			/* sem retomada, a recarga cai no login — pior, mas nao trava */
		})
		.then(() => import('Network/reconexao.js'))
		.then(m => {
			/* A pagina vai fechar o socket: a reconexao automatica nao pode
			   mostrar "Conexao perdida" nos segundos da recarga. */
			m.default.cancelarParaFechamentoDeliberado();
		})
		.catch(() => {})
		.then(() => {
			_recarregar();
		});
}

function iniciarContagem() {
	let feito = false;
	function acionar() {
		if (feito) {
			return;
		}
		feito = true;
		clearTimeout(_contagem && _contagem.relogio);
		if (_contagem) {
			_contagem.texto.textContent = 'Atualizando…';
		}
		atualizar();
	}
	const { caixa, texto } = montarCaixa(acionar);
	_contagem = { caixa, texto, relogio: 0, restantes: SEGUNDOS_DA_CONTAGEM };
	function escrever() {
		texto.textContent = 'Nova versão do jogo. Atualizando em ' + _contagem.restantes + ' s.';
	}
	function passo() {
		if (!_contagem) {
			return;
		}
		_contagem.restantes -= 1;
		if (_contagem.restantes <= 0) {
			acionar();
			return;
		}
		escrever();
		_contagem.relogio = setTimeout(passo, 1000);
	}
	escrever();
	_contagem.relogio = setTimeout(passo, 1000);
}

function avaliar() {
	if (_contagem) {
		return;
	}
	const agora = Date.now();
	const decide = deveComecarAContagem({
		versaoPendente: _versaoPendente,
		visivel: visivel(),
		msDesdeAVolta: _ultimaVoltaEm === null ? null : agora - _ultimaVoltaEm,
		ultimaTentativa: lerUltimaTentativa(),
		agora
	});
	if (decide) {
		iniciarContagem();
	}
}

/**
 * Liga o modulo. Idempotente — o boot pode chamar mais de uma vez.
 */
export function ligarAtualizacaoAutomatica() {
	if (_ligado) {
		return;
	}
	_ligado = true;

	const aoVersaoNova = evento => {
		const versao = evento && evento.detail && evento.detail.versao;
		if (typeof versao === 'string' && versao) {
			_versaoPendente = versao;
			avaliar();
		}
	};
	const casca = janelaDaCasca();
	casca.addEventListener('ragidle:versao-nova', aoVersaoNova);
	if (casca !== window) {
		window.addEventListener('ragidle:versao-nova', aoVersaoNova);
	}

	document.addEventListener('visibilitychange', () => {
		if (visivel()) {
			_ultimaVoltaEm = Date.now();
			avaliar();
		} else {
			/* A aba saiu no meio da contagem: ela para, e volta na proxima
			   volta. Recarregar com ninguem olhando nao explicaria nada. */
			cancelarContagem();
		}
	});

	/* A casca pode ter descoberto a versao ANTES de o jogo ligar. */
	const ponte = pontePWA();
	if (ponte && typeof ponte.versaoNovaDisponivel === 'string') {
		_versaoPendente = ponte.versaoNovaDisponivel;
	}
}

/** So para os testes: troca a recarga por uma funcao observavel. */
export function _definirRecargaParaTeste(funcao) {
	_recarregar = funcao;
}

/** So para os testes: volta o modulo ao estado de nascimento. */
export function _reiniciarParaTeste() {
	cancelarContagem();
	_ligado = false;
	_versaoPendente = null;
	_ultimaVoltaEm = null;
}
