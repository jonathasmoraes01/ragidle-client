/**
 * A JANELA DE PROCURAR GRUPO (LFG) — D-634.
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

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import IdleConfig from 'UI/Components/IdleConfig/IdleConfig.js';
import htmlText from './LFGIdle.html?raw';
import cssText from './LFGIdle.css?raw';

/*
 * Manter em sincronia com o ":host"/".lfg-window" do CSS — mesmo papel do
 * WINDOW_WIDTH/HEIGHT de MissoesIdle.js:41-42.
 *
 * Eles existem porque a POSICAO desta janela era cega ao tamanho da tela: o
 * CSS cravava `top: 90px` e mais nada a corrigia. Com 520 de altura, a borda
 * de baixo cai em 610px — e numa janela de navegador menor que isso (barra de
 * favoritos, zoom, tela pequena) o botao "Entrar" ficava fora da area
 * visivel, sem arrasto para compensar: `GUIComponent._fixPositionOverflow`
 * so grampeia a janela na viewport quando `_isDraggable` e verdadeiro, e isso
 * so acontece dentro de `draggable()`.
 */
const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 520;

const LFGIdle = new GUIComponent('LFGIdle', cssText);

/** A posicao que o jogador escolher atravessa a sessao, como na de Missoes. */
const _preferences = Preferences.get(
	'LFGIdle',
	{
		x: null,
		y: null
	},
	1.0
);

LFGIdle.render = () => htmlText;

/** Janela fechada não engole clique de cena (mesmo par do MissoesIdle). */
LFGIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** Os anúncios do último `ZC_RAGIDLE_LFG_LISTA`. */
LFGIdle.grupos = [];

/** Os mapas da aba "Criar" — vêm no `ZC_RAGIDLE_LFG_LISTA`, prontos. */
LFGIdle.mapas = [];

/**
 * O MEU grupo, como o servidor decidiu: `{ grupoId, souLider } | null`.
 * Vem no MESMO `ZC_RAGIDLE_LFG_LISTA` dos grupos e mapas. Nunca é deduzido
 * aqui comparando `grupoId` contra a lista — a mesma regra do cabeçalho
 * deste arquivo: quem decide é o servidor, a UI só reflete.
 */
LFGIdle.meu = null;

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

/** O mesmo sinal que HuntButtonIdle.js já lê (ver o cabeçalho de lá): não
 * pedido por esta janela, só lido — `IdleConfig.sondarMapa()` já roda a cada
 * troca de mapa, em MapEngine.js. `contexto` começa `null` até a primeira
 * resposta chegar. */
function ehCidadeAgora() {
	return !!(IdleConfig.contexto && IdleConfig.contexto.ehCidade);
}

/** Um grupo aberto. `podeEntrar` e `motivo` vêm PRONTOS do servidor. */
function cardDeGrupo(g) {
	const faixa = g.faixa || {};
	const desabilitado = g.podeEntrar ? '' : ' disabled';
	const botao =
		'<button type="button" class="ri-btn lfg-entrar" data-grupo="' +
		escapeHtml(g.grupoId) +
		'"' + desabilitado + '>Entrar</button>';

	/*
	 * "Voltar para Hunt" — pedido do dono: morreu, voltou pra cidade, quer
	 * um jeito de ir direto pro grupo de novo. Só no card do MEU grupo
	 * (`meu.grupoId`, que o servidor já manda — comparar aqui não é decidir
	 * QUEM pertence ao grupo, é só achar QUAL card é o meu pra desenhar o
	 * botão nele) e só na cidade (na hunt o botão não faz sentido: o
	 * jogador já está lá). Sem `data-grupo`: o CZ manda SEM argumento, o
	 * servidor já sabe qual é o meu grupo e pra onde ele vai.
	 */
	const ehMeuGrupo = !!(LFGIdle.meu && LFGIdle.meu.grupoId === g.grupoId);
	const botaoVoltar =
		ehMeuGrupo && ehCidadeAgora()
			? '<button type="button" class="ri-btn ri-btn--sec lfg-voltar">Voltar para Hunt</button>'
			: '';

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
		'<div class="lfg-card-acao">' + botao + botaoVoltar + '</div>' +
		motivo +
		'</div>'
	);
}

/**
 * A aba CRIAR: um mapa por linha, com a faixa e o bloqueio já visíveis.
 *
 * Tudo aqui vem PRONTO do servidor, dentro do próprio `ZC_RAGIDLE_LFG_LISTA`:
 * a faixa sai de `faixaDoMapa` e o `podeCriar`/`motivo` de `podeEntrar`, as
 * mesmas funções puras que o resto do jogo usa.
 *
 * A versão anterior lia o catálogo do `HuntMap` e calculava
 * `maximo = min(minimo + 15, 99)` por conta própria. Isso tinha DOIS defeitos,
 * e o jogador encontrou o primeiro: quem abrisse o LFG antes da janela de
 * caça via "Nenhum mapa de caça disponível", porque o catálogo do HuntMap
 * ainda não existia na sessão. O segundo era pior e silencioso — era uma
 * SEGUNDA IMPLEMENTAÇÃO da regra de faixa, exatamente o que o cabeçalho
 * deste arquivo promete não fazer.
 */
function linhaDeMapa(m) {
	const faixa = m.faixa || {};
	const bloqueado = !m.podeCriar;
	const motivo = bloqueado && m.motivo
		? '<div class="lfg-card-motivo">' + escapeHtml(m.motivo) + '</div>'
		: '';
	return (
		'<div class="lfg-criar-mapa ri-card' + (bloqueado ? ' is-bloqueado' : '') + '">' +
		'<div>' +
		'<div class="lfg-card-mapa">' + escapeHtml(m.rotulo) + '</div>' +
		'<div class="lfg-card-meta">' +
		'<span class="ri-badge ri-badge--azul">Nível ' + escapeHtml(faixa.minimo) +
		'–' + escapeHtml(faixa.maximo) + '</span>' +
		'</div>' +
		motivo +
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

/**
 * A barra do MEU grupo — pedido do dono ("as vezes eu fico bugado, preciso
 * poder sair/desfazer"). Só aparece na aba "Grupos abertos" (na "Criar" o
 * jogador nem está olhando o grupo dele) e só quando `LFGIdle.meu` não é
 * null. Um botão troca pelo outro conforme `souLider` — nunca os dois juntos.
 *
 * Nenhum texto aqui é "motivo de recusa" (isso é do servidor, ver os hooks
 * abaixo); são só rótulos estruturais nossos, como "Líder: X" já é em
 * `cardDeGrupo`.
 */
function atualizarBarraDoGrupo() {
	const barra = raiz().querySelector('.lfg-lider-barra');
	if (!barra) {
		return;
	}

	const meu = LFGIdle.meu;
	const visivel = LFGIdle.abaAtiva === 'grupos' && !!meu;
	barra.hidden = !visivel;

	const confirma = barra.querySelector('.lfg-desfazer-confirma');
	const btnSair = barra.querySelector('.lfg-sair-btn');
	const btnDesfazer = barra.querySelector('.lfg-desfazer-btn');

	if (!visivel) {
		// Troca de aba ou perda do grupo no meio da pergunta não pode deixar
		// um "Sim, desfazer" pendurado esperando clique.
		if (confirma) {
			confirma.hidden = true;
		}
		return;
	}

	const souLider = !!meu.souLider;
	const texto = barra.querySelector('.lfg-lider-texto');
	if (texto) {
		texto.textContent = souLider ? 'Você lidera este grupo.' : 'Você está neste grupo.';
	}
	if (btnDesfazer) {
		btnDesfazer.hidden = !souLider;
	}
	if (btnSair) {
		btnSair.hidden = souLider;
	}
	if (!souLider && confirma) {
		// A pergunta de confirmação só existe para "Desfazer".
		confirma.hidden = true;
	}
}

LFGIdle.init = function init() {
	const r = raiz();

	const fechar = r.querySelector('.lfg-close');
	if (fechar) {
		fechar.addEventListener('click', function () {
			LFGIdle.fechar();
		});
	}

	// A barra de titulo e a alca do arrasto — e habilitar o arrasto e o que
	// liga o `_fixPositionOverflow` do GUIComponent, que grampeia a janela
	// dentro da viewport. Sem ele a janela nasce cortada e nao ha como mover.
	const titulo = r.querySelector('.lfg-titlebar');
	if (titulo) {
		this.draggable(titulo);
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
			atualizarBarraDoGrupo();
			desenhar();
		});
	});

	// A barra do MEU grupo: "Sair" manda na hora (afeta só quem clicou);
	// "Desfazer" pede confirmação de dois passos ANTES de mandar, porque
	// tira todo mundo do mapa de caça. Nunca `window.confirm` — é caixa do
	// navegador, não da janela do jogo.
	const barra = r.querySelector('.lfg-lider-barra');
	if (barra) {
		const confirma = barra.querySelector('.lfg-desfazer-confirma');
		const btnSair = barra.querySelector('.lfg-sair-btn');
		const btnDesfazer = barra.querySelector('.lfg-desfazer-btn');
		const btnSim = barra.querySelector('.lfg-desfazer-sim');
		const btnCancelar = barra.querySelector('.lfg-desfazer-cancelar');

		if (btnSair) {
			btnSair.addEventListener('click', function () {
				mandar({ acao: 'sair' });
			});
		}
		if (btnDesfazer && confirma) {
			btnDesfazer.addEventListener('click', function () {
				confirma.hidden = false;
			});
		}
		if (btnCancelar && confirma) {
			btnCancelar.addEventListener('click', function () {
				confirma.hidden = true;
			});
		}
		if (btnSim && confirma) {
			btnSim.addEventListener('click', function () {
				confirma.hidden = true;
				mandar({ acao: 'dissolver' });
			});
		}
	}

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
			const voltar = evento.target.closest('.lfg-voltar');
			if (voltar) {
				// Sem confirmação: voltar pra hunt não é destrutivo (não tira
				// ninguém de lugar nenhum, diferente de "Desfazer grupo") —
				// pedir "tem certeza?" pra tudo ensina o jogador a clicar
				// sem ler. A recusa do servidor (morto, fora de faixa etc.)
				// aparece em .lfg-aviso, como qualquer outra ação.
				mandar({ acao: 'voltar' });
				return;
			}
			const criar = evento.target.closest('.lfg-criar');
			if (criar && !criar.disabled) {
				mandar({ acao: 'criar', mapa: criar.dataset.mapa });
			}
		});
	}

	// Centralizar pela tela REAL, e nao pelo `top:90px` do CSS. O `Math.max`
	// e o que impede coordenada negativa numa viewport menor que a janela.
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
};

LFGIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

LFGIdle.onRemove = function onRemove() {
	_preferences.x = parseInt(LFGIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(LFGIdle._host.style.top, 10) || 0;
	_preferences.save();
};

LFGIdle.abrir = function abrir() {
	const win = raiz().querySelector('.lfg-window');
	if (!win) {
		return;
	}
	/*
	 * Nada é lido de outra janela aqui: os grupos E os mapas chegam no mesmo
	 * `ZC_RAGIDLE_LFG_LISTA` que o `listar` abaixo pede. Ler o catálogo do
	 * HuntMap era o que fazia a aba "Criar" nascer vazia para quem abrisse
	 * esta janela primeiro.
	 */
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
	// Os mapas vêm no MESMO pacote (o conserto do "Nenhum mapa disponível").
	LFGIdle.mapas = dados && Array.isArray(dados.mapas) ? dados.mapas : LFGIdle.mapas;
	// "meu" também vem pronto — { grupoId, souLider } ou null. Guardado como
	// o servidor mandou, sem reconstrução: reconstruir seria uma segunda
	// leitura da mesma decisão.
	LFGIdle.meu = dados && dados.meu && typeof dados.meu === 'object' ? dados.meu : null;
	atualizarBarraDoGrupo();
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
	// "voltar" teleporta de volta pro mapa da hunt, igual "criar"/"entrar" —
	// os três fecham a janela porque o jogador está de saída da cidade.
	if (dados.acao === 'criar' || dados.acao === 'entrar' || dados.acao === 'voltar') {
		LFGIdle.fechar();
	} else {
		mandar({ acao: 'listar' });
	}
});

/**
 * A TROCA DE PERSONAGEM ESQUECE O MEU PEDIDO de grupo (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda o pedido de grupo DESTE personagem.
 *
 * `grupos` e `mapas` sao do mundo e se renovam sozinhos no proximo pacote;
 * `meu` e do personagem, e mostrado como "voce esta procurando grupo" —
 * herda-lo diria ao novo personagem que ele tem um pedido que nao e dele.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
LFGIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	LFGIdle.meu = null;
};

export default UIManager.addComponent(LFGIdle);
