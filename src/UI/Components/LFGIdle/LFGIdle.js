/**
 * A JANELA DE PROCURAR GRUPO (LFG) — D-618.
 *
 * Ela lista os grupos abertos (mapa, líder, vagas e faixa de nível), deixa
 * criar um grupo escolhendo o mapa, e entrar num aberto.
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE GOVERNA ESTE ARQUIVO: A UI SÓ REFLETE
 * ---------------------------------------------------------------------------
 *
 * Nenhuma linha aqui decide se o jogador pode entrar. Quem decide é o
 * servidor: `ZC_RAGIDLE_LFG_LISTA` já traz, POR LINHA, um `podeEntrar` e um
 * `motivo` calculados para ESTE jogador (`game/party-lfg.ts`, via
 * `QuadroLFG.listar`). O botão desenha o booleano e imprime a frase.
 *
 * Isso não é preciosismo de arquitetura — é o que impede o pior defeito
 * possível deste recurso: se a janela recalculasse a faixa, existiriam duas
 * implementações da mesma regra, e no dia em que discordassem a que o jogador
 * veria seria a errada, porque o servidor recusaria DEPOIS do clique. A prova
 * de fio (`npm run prove:lfg`) exercita a recusa pelo pacote cru, sem janela
 * nenhuma no caminho, exatamente por isso.
 */

import Network from 'Network/NetworkManager.js';
import Session from 'Engine/SessionStorage.js';
import HuntMap from 'UI/Components/HuntMap/HuntMap.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './LFGIdle.html?raw';
import cssText from './LFGIdle.css?raw';

const LFGIdle = new GUIComponent('LFGIdle', cssText);

LFGIdle.render = () => htmlText;

/** Janela fechada não engole clique de cena (mesmo par do MissoesIdle). */
LFGIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** Os anúncios do último `ZC_RAGIDLE_LFG_LISTA`. */
LFGIdle.grupos = [];

/** O catálogo de caça, para a aba "Criar" — vem do `ZC_RAGIDLE_CATALOGO`. */
LFGIdle.mapas = [];

/** O nível do próprio jogador, para a aba "Criar" refletir o bloqueio. */
LFGIdle.meuNivel = 1;

/** Aba ativa: 'grupos' | 'criar'. */
LFGIdle.abaAtiva = 'grupos';

function raiz() {
	return LFGIdle._shadow || LFGIdle._host;
}

/**
 * O mesmo `escapeHtml` das outras janelas RagIdle.
 *
 * Ele não é opcional: nome de personagem e rótulo de mapa entram por
 * `innerHTML`, e nome de personagem é texto que OUTRO jogador escolheu.
 */
function escapeHtml(valor) {
	return String(valor === null || valor === undefined ? '' : valor)
		.split('&').join('&amp;')
		.split('<').join('&lt;')
		.split('>').join('&gt;')
		.split('"').join('&quot;');
}

function mandar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_LFG_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

function mostrarAviso(texto) {
	const aviso = raiz().querySelector('.lfg-aviso');
	if (!aviso) {
		return;
	}
	if (!texto) {
		aviso.hidden = true;
		aviso.textContent = '';
		return;
	}
	aviso.hidden = false;
	aviso.textContent = texto;
}

/** Um grupo aberto. `podeEntrar` e `motivo` vêm PRONTOS do servidor. */
function cardDeGrupo(g) {
	const faixa = g.faixa || {};
	const desabilitado = g.podeEntrar ? '' : ' disabled';
	const botao =
		'<button type="button" class="ri-btn lfg-entrar" data-grupo="' +
		escapeHtml(g.grupoId) +
		'"' + desabilitado + '>Entrar</button>';
	// O motivo aparece SEMPRE que houver — é o texto do servidor, por extenso.
	const motivo = g.motivo
		? '<div class="lfg-card-motivo">' + escapeHtml(g.motivo) + '</div>'
		: '';
	return (
		'<div class="lfg-card ri-card" data-grupo="' + escapeHtml(g.grupoId) + '">' +
		'<div class="lfg-card-mapa">' + escapeHtml(g.rotuloDoMapa || g.mapa) + '</div>' +
		'<div class="lfg-card-meta">' +
		'<span class="ri-badge ri-badge--azul">Nível ' + escapeHtml(faixa.minimo) +
		'–' + escapeHtml(faixa.maximo) + '</span>' +
		'<span>Líder: ' + escapeHtml(g.liderNome) + '</span>' +
		'<span>' + escapeHtml(g.vagas) + ' vaga(s)</span>' +
		'</div>' +
		'<div class="lfg-card-acao">' + botao + '</div>' +
		motivo +
		'</div>'
	);
}

/**
 * A aba CRIAR: um mapa por linha, com a faixa e o bloqueio já visíveis.
 *
 * O bloqueio aqui NÃO é uma segunda implementação da regra: ele desenha a
 * mesma faixa que o catálogo já serve. Quem decide continua sendo o servidor
 * — o `criar` responde `ZC_RAGIDLE_LFG_RESULTADO` com o motivo, e ele aparece
 * no aviso. Se um dia os dois discordarem, o servidor vence e o jogador lê a
 * frase dele.
 */
function linhaDeMapa(m) {
	const minimo = m.nivelQueAbre;
	const maximo = Math.min(minimo + 15, 99);
	const bloqueado = LFGIdle.meuNivel < minimo || LFGIdle.meuNivel > maximo;
	return (
		'<div class="lfg-criar-mapa ri-card' + (bloqueado ? ' is-bloqueado' : '') + '">' +
		'<div>' +
		'<div class="lfg-card-mapa">' + escapeHtml(m.rotulo) + '</div>' +
		'<div class="lfg-card-meta">' +
		'<span class="ri-badge ri-badge--azul">Nível ' + escapeHtml(minimo) +
		'–' + escapeHtml(maximo) + '</span>' +
		'</div>' +
		'</div>' +
		'<button type="button" class="ri-btn ri-btn--ouro lfg-criar" data-mapa="' +
		escapeHtml(m.mapa) + '"' + (bloqueado ? ' disabled' : '') + '>Criar aqui</button>' +
		'</div>'
	);
}

function desenhar() {
	const corpo = raiz().querySelector('.lfg-body');
	if (!corpo) {
		return;
	}

	if (LFGIdle.abaAtiva === 'criar') {
		corpo.innerHTML = LFGIdle.mapas.length
			? LFGIdle.mapas.map(linhaDeMapa).join('')
			: '<div class="lfg-empty">Nenhum mapa de caça disponível.</div>';
		return;
	}

	corpo.innerHTML = LFGIdle.grupos.length
		? LFGIdle.grupos.map(cardDeGrupo).join('')
		: '<div class="lfg-empty">Nenhum grupo aberto. Crie o seu na aba ao lado.</div>';
}

LFGIdle.init = function init() {
	const r = raiz();

	const fechar = r.querySelector('.lfg-close');
	if (fechar) {
		fechar.addEventListener('click', function () {
			LFGIdle.fechar();
		});
	}

	const abas = r.querySelectorAll('.lfg-tab');
	abas.forEach(function (aba) {
		aba.addEventListener('click', function () {
			LFGIdle.abaAtiva = aba.dataset.tab;
			abas.forEach(function (x) {
				x.classList.remove('is-active');
			});
			aba.classList.add('is-active');
			mostrarAviso('');
			desenhar();
		});
	});

	// Delegação: os cards são reescritos a cada lista, então o ouvinte mora
	// no corpo e não em cada botão (o mesmo padrão do MissoesIdle).
	const corpo = r.querySelector('.lfg-body');
	if (corpo) {
		corpo.addEventListener('click', function (evento) {
			const entrar = evento.target.closest('.lfg-entrar');
			if (entrar && !entrar.disabled) {
				mandar({ acao: 'entrar', grupoId: Number(entrar.dataset.grupo) });
				return;
			}
			const criar = evento.target.closest('.lfg-criar');
			if (criar && !criar.disabled) {
				mandar({ acao: 'criar', mapa: criar.dataset.mapa });
			}
		});
	}
};

LFGIdle.abrir = function abrir() {
	const win = raiz().querySelector('.lfg-window');
	if (!win) {
		return;
	}
	/*
	 * O catálogo e o nível são LIDOS de quem já os tem, e não pedidos de novo.
	 *
	 * `Network.hookPacket` guarda UM handler por opcode, em todo o cliente: um
	 * segundo hook em `ZC_RAGIDLE_CATALOGO` SUBSTITUIRIA o do HuntMap e
	 * quebraria a janela de caça, sem erro nenhum aparecer. Ler o estado que o
	 * outro componente publica é o padrão que as janelas RagIdle já usam
	 * justamente por isso.
	 */
	const catalogo = HuntMap.catalog;
	LFGIdle.mapas = catalogo && Array.isArray(catalogo.mapas) ? catalogo.mapas : [];
	LFGIdle.meuNivel = (Session.Entity && Session.Entity.clevel) || 1;

	win.classList.add('is-open');
	mostrarAviso('');
	mandar({ acao: 'listar' });
};

LFGIdle.fechar = function fechar() {
	const win = raiz().querySelector('.lfg-window');
	if (win) {
		win.classList.remove('is-open');
	}
};

LFGIdle.toggle = function toggle() {
	const win = raiz().querySelector('.lfg-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		LFGIdle.fechar();
	} else {
		LFGIdle.abrir();
	}
};

/*
 * ATENÇÃO ao `hookPacket`: ele SOBRESCREVE o handler anterior daquele opcode
 * (um por opcode, em todo o cliente). Estes dois são nossos e de mais
 * ninguém; se um dia outro componente precisar do mesmo pacote, o caminho é
 * publicar o estado daqui e ele ler, não um segundo hook.
 */
Network.hookPacket(PACKET.ZC.RAGIDLE_LFG_LISTA, function (pkt) {
	let dados = null;
	try {
		dados = JSON.parse(pkt.json);
	} catch (erro) {
		return;
	}
	LFGIdle.grupos = dados && Array.isArray(dados.grupos) ? dados.grupos : [];
	desenhar();
});

Network.hookPacket(PACKET.ZC.RAGIDLE_LFG_RESULTADO, function (pkt) {
	let dados = null;
	try {
		dados = JSON.parse(pkt.json);
	} catch (erro) {
		return;
	}
	if (!dados) {
		return;
	}
	// A recusa é a frase do SERVIDOR, mostrada como veio. A janela não tem
	// texto próprio para isso — se tivesse, seria a segunda redação da regra.
	if (dados.ok === false) {
		mostrarAviso(dados.motivo || 'não foi possível');
		return;
	}
	mostrarAviso('');
	if (dados.acao === 'criar' || dados.acao === 'entrar') {
		LFGIdle.fechar();
	} else {
		mandar({ acao: 'listar' });
	}
});

export default UIManager.addComponent(LFGIdle);
