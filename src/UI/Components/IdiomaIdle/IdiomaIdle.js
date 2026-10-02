/**
 * UI/Components/IdiomaIdle/IdiomaIdle.js
 *
 * A ESCOLHA DO IDIOMA (D-1929, 01/10/2026 — o jogo em ingles).
 *
 * Pedido do dono: *"o passo zero do tutorial seja um banner/janela para o
 * player escolher o idioma (...) bandeira + titulo"*, e *"caso a pessoa queira
 * trocar novamente depois, precisamos adicionar essa possibilidade dentro das
 * configuracoes"*. A mesma janela abre por tres portas:
 *
 *  1. o PASSO ZERO do tutorial: o jogador novo (tutorial na etapa 1) que
 *     nunca escolheu ve esta janela antes da primeira etapa — o tutorial cede
 *     enquanto ela esta aberta (`TutorialIdle.desenhar`);
 *  2. o botao da TELA DE LOGIN: o estrangeiro chega antes do tutorial, e o
 *     login, o cadastro e a escolha de personagem tambem tem texto;
 *  3. as CONFIGURACOES (menu Sistema).
 *
 * Escolher um idioma DIFERENTE recarrega o jogo: no jogo, mantendo a sessao
 * (`recarregarMantendoASessao`); no login, so a pagina. Fechar sem escolher
 * conta como escolher o atual — o passo zero nao volta a perguntar.
 *
 * A janela e bilingue e inteira `translate="no"` (ver o .html).
 *
 * @author RagIdle
 */

import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import htmlText from './IdiomaIdle.html?raw';
import cssText from './IdiomaIdle.css?raw';
import { IDIOMAS, definirIdioma, idiomaAtual, idiomaFoiEscolhido } from 'Core/Idioma.js';
import { recarregarMantendoASessao } from 'UI/recargaMantendoASessao.js';
import { janelaDaCasca } from 'UI/ofertaDeInstalacao.js';

const IdiomaIdle = new GUIComponent('IdiomaIdle', cssText);

IdiomaIdle.render = () => htmlText;

IdiomaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

IdiomaIdle.captureKeyEvents = true;

/** De onde ela foi aberta: 'jogo' (passo zero, Configuracoes) ou 'login'. */
let _contexto = 'jogo';

/** Quem quer saber quando ela fecha sem recarregar (o tutorial, para seguir). */
let _aoFechar = null;

/** Injetaveis no teste: o que acontece depois de escolher um idioma diferente. */
let _recarregarNoJogo = () => recarregarMantendoASessao();
let _recarregarNoLogin = () => janelaDaCasca().location.reload();

function _root() {
	return IdiomaIdle._shadow || IdiomaIdle._host;
}

IdiomaIdle.init = function init() {
	const root = _root();
	if (!root) {
		return;
	}
	const opcoes = root.querySelector('.ii-opcoes');
	if (opcoes) {
		opcoes.textContent = '';
		for (const idioma of IDIOMAS) {
			const botao = document.createElement('button');
			botao.type = 'button';
			botao.className = 'ii-opcao';
			botao.dataset.idioma = idioma.codigo;
			const bandeira = document.createElement('img');
			bandeira.className = 'ii-bandeira';
			bandeira.src = `/ragidle/idioma/${idioma.bandeira}.svg`;
			bandeira.alt = '';
			const nome = document.createElement('span');
			nome.className = 'ii-nome';
			nome.textContent = idioma.nome;
			const marca = document.createElement('span');
			marca.className = 'ii-marca';
			botao.append(bandeira, nome, marca);
			botao.addEventListener('click', () => escolher(idioma.codigo));
			opcoes.appendChild(botao);
		}
	}
	const x = root.querySelector('.ii-x');
	if (x) {
		x.addEventListener('click', fecharSemEscolher);
	}
	const modal = root.querySelector('.ii-modal');
	if (modal) {
		modal.addEventListener('click', evento => {
			if (evento.target === modal) {
				fecharSemEscolher();
			}
		});
	}
};

/** Marca o idioma em uso ("atual · current"). */
function marcarAtual() {
	const root = _root();
	if (!root) {
		return;
	}
	const atual = idiomaAtual();
	for (const botao of root.querySelectorAll('.ii-opcao')) {
		const ehAtual = botao.dataset.idioma === atual;
		botao.classList.toggle('is-atual', ehAtual);
		const marca = botao.querySelector('.ii-marca');
		if (marca) {
			marca.textContent = ehAtual ? (atual === 'en' ? 'current' : 'atual') : '';
		}
	}
}

/**
 * Abre a janela. Prepara e anexa sozinha: na tela de login ninguem a anexou.
 *
 * @param {{contexto?: 'jogo'|'login', aoFechar?: function}} [opcoes]
 */
IdiomaIdle.mostrar = function mostrar(opcoes = {}) {
	_contexto = opcoes.contexto === 'login' ? 'login' : 'jogo';
	_aoFechar = typeof opcoes.aoFechar === 'function' ? opcoes.aoFechar : null;
	if (!IdiomaIdle.__loaded) {
		IdiomaIdle.prepare();
	}
	if (!IdiomaIdle.__active) {
		IdiomaIdle.append();
	}
	const root = _root();
	const modal = root && root.querySelector('.ii-modal');
	if (!modal) {
		return;
	}
	marcarAtual();
	modal.classList.add('is-open');
	IdiomaIdle.focus();
};

IdiomaIdle.estaAberta = function estaAberta() {
	const root = _root();
	const modal = root && root.querySelector('.ii-modal');
	return !!(modal && modal.classList.contains('is-open'));
};

IdiomaIdle.fechar = function fechar() {
	const root = _root();
	const modal = root && root.querySelector('.ii-modal');
	if (modal) {
		modal.classList.remove('is-open');
	}
};

/**
 * O PASSO ZERO do tutorial: abre so para quem nunca escolheu. O tutorial
 * chama isto ao desenhar a etapa 1 e cede enquanto a janela estiver aberta.
 *
 * @param {function} [aoFechar]
 * @returns {boolean} se abriu agora
 */
IdiomaIdle.passoZero = function passoZero(aoFechar) {
	if (idiomaFoiEscolhido() || IdiomaIdle.estaAberta()) {
		return false;
	}
	IdiomaIdle.mostrar({ contexto: 'jogo', aoFechar });
	return true;
};

function escolher(codigo) {
	const mudou = definirIdioma(codigo);
	IdiomaIdle.fechar();
	if (!mudou) {
		avisarFechou();
		return;
	}
	if (_contexto === 'login') {
		_recarregarNoLogin();
	} else {
		_recarregarNoJogo();
	}
}

/** Fechar sem escolher conta como escolher o atual: o passo zero nao volta. */
function fecharSemEscolher() {
	if (!idiomaFoiEscolhido()) {
		definirIdioma(idiomaAtual());
	}
	IdiomaIdle.fechar();
	avisarFechou();
}

function avisarFechou() {
	const aoFechar = _aoFechar;
	_aoFechar = null;
	if (aoFechar) {
		aoFechar();
	}
}

IdiomaIdle.onKeyDown = function onKeyDown(event) {
	if (event.which !== 27 && event.key !== 'Escape') {
		return;
	}
	if (!IdiomaIdle.estaAberta()) {
		return;
	}
	fecharSemEscolher();
	event.stopImmediatePropagation();
	event.preventDefault();
};

/** So para os testes: troca o que acontece no lugar da recarga. */
IdiomaIdle._trocarRecargas = function _trocarRecargas(noJogo, noLogin) {
	_recarregarNoJogo = noJogo;
	_recarregarNoLogin = noLogin;
};

export default UIManager.addComponent(IdiomaIdle);
