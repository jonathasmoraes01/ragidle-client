/**
 * UI/Background.js
 *
 * Background Manager
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Configs from 'Core/Configs.js';
import PACKETVER from 'Network/PacketVerManager.js';
import { animateElement } from 'Utils/HtmlHelper.js';

/**
 * @var {HTMLElement} Background overlay (used for transition)
 */
const _overlay = document.createElement('div');
Object.assign(_overlay.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1000',
	backgroundColor: 'black',
	opacity: '0'
});

const _container = document.createElement('div');
Object.assign(_container.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1',
	width: '100%',
	height: '100%',
	backgroundColor: 'black'
});

/**
 * @var {HTMLCanvasElement} Background canvas element
 *
 * A barra de progresso NAO desenha mais aqui (era rgb(0,255,255) / rgb(140,140,140) /
 * rgb(66,99,165) / rgb(255,255,0), cores cravadas de 2002). O canvas nao tem mais
 * nenhum desenho proprio; fica so como camada de compatibilidade para o z-index
 * que o resto do arquivo ja gerenciava (Renderer/MapRenderer esperam poder
 * empilhar sobre ela). A barra virou DOM (ver _barLayer abaixo) para poder usar
 * os tokens do design system (Common.css/:root) em vez de replicar valores.
 */
const _canvas = document.createElement('canvas');
Object.assign(_canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '2' });

/**
 * @var {CanvasRenderingContext2D} Background context
 */
const _ctx = _canvas.getContext('2d');

/**
 * ------------------------------------------------------------------
 * Barra de progresso em DOM (nao em canvas)
 *
 * Por que DOM em vez de canvas: os tokens do design system (--blue-500,
 * --gold-500, --font-display etc.) sao custom properties CSS. Num canvas
 * eles teriam que ser lidos com getComputedStyle e replicados a mao em
 * fillStyle/font a cada frame -- e o texto customizado (Marcellus) exige
 * medir a fonte carregada via FontFace API antes de desenhar, ou o primeiro
 * frame cai no fallback. Em DOM, a barra e so HTML/CSS: pega os tokens
 * direto de --root (Common.css e injetado global pelo UIManager, ver
 * UI/UIManager.js:injectCommonCSS), reflow e' automatico no resize, e a
 * fonte troca sozinha quando carrega (sem novo desenho). O canvas continua
 * existindo so pelo z-index (ver nota acima) -- nao teve motivo pra apagar
 * o elemento e arriscar quebrar quem espera por ele.
 * ------------------------------------------------------------------
 */

/** @var {HTMLDivElement} camada da barra + nome do jogo, irma do _canvas */
const _barLayer = document.createElement('div');
Object.assign(_barLayer.style, {
	position: 'absolute',
	top: '0',
	left: '0',
	zIndex: '1',
	display: 'none',
	pointerEvents: 'none'
});

const _barName = document.createElement('div');
_barName.className = 'rag-loadbar-name';
_barName.textContent = 'Ragnarok Classic Idle';

const _barTrack = document.createElement('div');
_barTrack.className = 'rag-loadbar-track';

const _barFill = document.createElement('div');
_barFill.className = 'rag-loadbar-fill';

const _barPct = document.createElement('div');
_barPct.className = 'rag-loadbar-pct';
_barPct.textContent = '0%';

_barTrack.appendChild(_barFill);
_barTrack.appendChild(_barPct);
_barLayer.appendChild(_barName);
_barLayer.appendChild(_barTrack);

/**
 * Injeta o CSS da barra uma vez por documento (mesmo padrao de
 * UIManager.js:injectCommonCSS). Usa os tokens de Common.css, que ja
 * chegam em :root porque o UIManager injeta Common.css globalmente.
 */
(function injectLoadbarCSS() {
	if (document.querySelector('style[data-ragidle-loadbar]')) {
		return;
	}
	const style = document.createElement('style');
	style.setAttribute('data-ragidle-loadbar', '');
	style.textContent = `
		/*
		 * ASSINATURA, nao objeto de UI.
		 *
		 * A versao anterior era uma pilula: chapa (--surface-dark-glass), borda
		 * dourada e raio de pilula. Com moldura fechada ela lia como BOTAO
		 * clicavel no meio de uma ilustracao -- e em 1920x1080 sobre a arte do
		 * dragao o nome do jogo aparecia TRES vezes (o logotipo pintado na arte,
		 * o selo do canto inferior direito e a pilula).
		 *
		 * A pilula nao pode simplesmente SAIR: em 2560x1080 o 'cover' corta o
		 * logotipo pintado e o "IDLE" desaparece da tela. Quem garante o nome
		 * inteiro nas proporcoes extremas e este texto. Entao ficou o texto e
		 * saiu a moldura.
		 *
		 * O veu e uma elipse do MESMO token da chapa antiga, que morre em 70% --
		 * e 70,7% e onde a borda da caixa cruza a elipse de canto-mais-longe
		 * (1/raiz de 2). Por isso o degrade chega a zero ANTES do limite da
		 * caixa: fundo de elemento e recortado pela caixa, e qualquer alfa
		 * sobrando na borda desenharia de volta o retangulo que esta regra
		 * tirou. O padding largo existe pra isso, nao por respiro.
		 *
		 * Pelo mesmo motivo o backdrop-filter SAIU: ele borra a area da caixa e
		 * so dela, entao devolve uma aresta retangular nitida por mais suave que
		 * o degrade seja.
		 *
		 * O pior caso de contraste e a luz de catedral de loading-acolita (quase
		 * branco atras): --gold-200 sobre o veu a 0,58 da ~3,9:1, acima do 3:1
		 * que texto grande pede, e a sombra do texto e a margem.
		 */
		.rag-loadbar-name {
			position: absolute;
			left: 50%;
			bottom: 25%;
			transform: translateX(-50%);
			white-space: nowrap;
			font: var(--type-hero);
			font-size: clamp(30px, 2.4vw, 46px);
			letter-spacing: var(--ls-title);
			color: var(--gold-200);
			padding: clamp(18px, 1.6vw, 30px) clamp(60px, 6vw, 120px);
			background: radial-gradient(
				ellipse at center,
				var(--surface-dark-glass) 0%,
				var(--surface-dark-glass) 50%,
				transparent 70%
			);
			text-shadow:
				0 1px 2px rgba(9, 21, 38, 0.9),
				0 0 18px rgba(9, 21, 38, 0.75);
		}
		.rag-loadbar-track {
			position: absolute;
			left: 50%;
			top: 75%;
			transform: translateX(-50%);
			width: clamp(320px, 30vw, 640px);
			height: 16px;
			background: var(--bar-track);
			border: 1px solid var(--border-gold);
			border-radius: var(--radius-bar);
			box-shadow: var(--shadow-inset), var(--rim-gold);
			overflow: hidden;
		}
		.rag-loadbar-fill {
			height: 100%;
			width: 0%;
			background: linear-gradient(180deg, var(--blue-400) 0%, var(--blue-500) 45%, var(--blue-600) 100%);
			box-shadow: var(--rim-light);
			border-radius: var(--radius-bar);
			transition: width var(--dur-base) var(--ease-out);
		}
		.rag-loadbar-pct {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font: var(--type-numeric);
			font-size: 11px;
			letter-spacing: var(--ls-caps);
			color: var(--white);
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
		}
	`;
	document.head.appendChild(style);
})();

/**
 * ------------------------------------------------------------------
 * O vazamento da HUD por cima da tela de carregamento
 *
 * O sintoma que abriu o caso: no canto superior esquerdo de TODA tela de
 * carregamento lia-se "<nome> / Lv.1 / Novice / Lv.1 / Exp. 0% / HP. 40 / 40 |
 * SP. 11 / 11" em texto miudo, ilegivel sobre arte clara. E o modo `small` da
 * janela NATIVA de informacao basica (o `_host` de UI/Components/BasicInfo, id
 * `BasicInfoV0`..`BasicInfoV5` conforme o PACKETVER; aqui, `BasicInfoV4`).
 *
 * Por que ela esta ali: `MapRenderer.setMap()` chama
 * `UIManager.removeComponents()` ANTES de `Background.setLoading()`, mas o
 * `append()` de um GUIComponent e ASSINCRONO -- espera as chapas .bmp do GRF.
 * `Engine/MapEngine.js:onMapChange` pede a janela algumas linhas antes de
 * chamar `setMap`, entao ela chega ao DOM DEPOIS da limpeza, sobrevive a ela
 * e fica orfa sobre a arte. Nao e defeito da arte nova: e anterior a ela.
 *
 * NAO E UM ELEMENTO SO -- e uma CLASSE de defeito, e por isso a varredura e
 * por lista e nao por id unico. Os outros dois orfaos sao botoes que
 * `document.body.appendChild` deixa soltos e que nenhum removeComponents()
 * alcanca, porque nao pertencem a arvore de componente nenhum:
 *
 *   - `lvlup_job`  (`UI/Components/SkillList/SkillListCommon.js`), 43x43 no
 *     canto inferior direito -- o glifo "up" que aparecia em todos os prints.
 *   - `lvlup_base` (`UI/Components/Equipment/EquipmentCommon.js`), 4x4 no
 *     canto superior esquerdo. Invisivel na pratica, mas deixar UM dos dois
 *     de fora e deixar a classe do defeito viva.
 *
 * Por que `visibility` e nao `display`: os tres ja tem DONO do `display`.
 * UI/Components/BasicInfoIdle (`hideNativeBasicInfo`) poe a janela em `none`
 * assim que a HUD entra, e UI/Components/DockIdle (`hideNativeLevelUpButton`)
 * faz o mesmo com o `lvlup_job`, em polling. Se escondessemos por `display`,
 * devolver o valor anterior passaria por cima do deles e os dois voltariam a
 * aparecer DENTRO do jogo. `visibility` e um eixo que ninguem mais toca:
 * devolver '' deixa o `display: none` deles de pe.
 *
 * E por que esconder em vez de remover: sao pecas vivas -- MapEngine e
 * MapEngine/Main.js escrevem na janela (`BasicInfo.getUI().update(...)`),
 * BasicInfoIdle LE os campos dela, e SkillList/Equipment continuam donos dos
 * botoes. Some-los do DOM quebraria os quatro.
 * ------------------------------------------------------------------
 */

/**
 * Os orfaos que sobrevivem ao UIManager.removeComponents(). `BasicInfoV\d+`
 * de proposito, e nao `BasicInfo.*`: `BasicInfoIdle` e a HUD legitima e nao
 * pode entrar nesta lista.
 */
const ORFAOS_QUE_VAZAM = /^(BasicInfoV\d+|lvlup_job|lvlup_base)$/;

/** @var {Array<{el: HTMLElement, visibilidade: string}>} o que escondemos, e o valor a devolver */
let _escondidosNoCarregamento = [];

/** @var {MutationObserver|null} vigia de quem chega ATRASADO ao DOM */
let _vigiaDoVazamento = null;

function esconderSeVazar(no) {
	if (!no || no.nodeType !== 1 || !ORFAOS_QUE_VAZAM.test(no.id)) {
		return;
	}
	if (_escondidosNoCarregamento.some(g => g.el === no)) {
		return;
	}
	_escondidosNoCarregamento.push({ el: no, visibilidade: no.style.visibility });
	no.style.visibility = 'hidden';
}

function esconderVazamentoDaHud() {
	if (_vigiaDoVazamento) {
		return;
	}
	Array.prototype.forEach.call(document.body.children, esconderSeVazar);

	// A varredura acima nao basta: o append() e assincrono (ver o bloco acima),
	// entao a janela costuma chegar DEPOIS, com a arte ja na tela. Sem o vigia,
	// ela aparece de qualquer jeito -- que e o que acontecia.
	_vigiaDoVazamento = new MutationObserver(registros => {
		for (let i = 0; i < registros.length; ++i) {
			Array.prototype.forEach.call(registros[i].addedNodes, esconderSeVazar);
		}
	});
	_vigiaDoVazamento.observe(document.body, { childList: true });
}

function devolverVazamentoDaHud() {
	if (_vigiaDoVazamento) {
		_vigiaDoVazamento.disconnect();
		_vigiaDoVazamento = null;
	}
	for (let i = 0; i < _escondidosNoCarregamento.length; ++i) {
		const g = _escondidosNoCarregamento[i];
		g.el.style.visibility = g.visibilidade;
	}
	_escondidosNoCarregamento = [];
}

/**
 * Background loading progress
 * @var {number} percent
 */
let _progress = -1;

/**
 * @var {object|null} current overlay animation handle
 */
let _overlayAnim = null;

/**
 * Render background (or a black background if no image is loaded yet)
 */
function render() {
	_ctx.clearRect(0, 0, _canvas.width, _canvas.height);

	if (_progress > -1) {
		Background.setPercent(_progress);
	} else {
		_barLayer.style.display = 'none';
	}
}
let _loading = [];

/**
 * ------------------------------------------------------------------
 * As telas de carregamento do Rag Idle
 *
 * Por que fora do GRF: as dez telas originais do RO (loading01..10.jpg) moram
 * DENTRO de data.grf, e o GRF e o pacote de arte do dono -- ele e regravado por
 * fora do repositorio e nao versiona nada nosso. Publicando em
 * public/ragidle/loading/ o vite serve por HTTP direto (mesmo padrao ja usado
 * por /ragidle/classes, /ragidle/skills, /ragidle/item), a arte nova fica
 * versionada junto do codigo e o carregador do GRF nem e acionado.
 *
 * O segundo motivo e a armadilha de CP949: caminho de GRF e minusculizado pelo
 * carregador, e 0xC0 vira 0xE0 nos nomes coreanos -- caminho ASCII servido pelo
 * vite nao passa por essa normalizacao (ver o desvio por '/' em setImage).
 *
 * Nome ASCII curto e sem espaco de proposito: o nome de origem tinha data,
 * espaco e reticencia Unicode, que viram %XX numa URL.
 * ------------------------------------------------------------------
 */
const TELAS_DE_CARREGAMENTO = [
	'/ragidle/loading/loading-acolita.jpeg',
	'/ragidle/loading/loading-arqueiro.jpeg',
	'/ragidle/loading/loading-dragao.jpeg',
	'/ragidle/loading/loading-espadachim.jpeg',
	'/ragidle/loading/loading-fogueira.jpeg',
	'/ragidle/loading/loading-gatuno.jpeg',
	'/ragidle/loading/loading-maga.jpeg',
	'/ragidle/loading/loading-mercador.jpeg',
	'/ragidle/loading/loading-mirante.jpeg',
	'/ragidle/loading/loading-sacerdotisa.jpeg'
];

/**
 * O fundo da tela de LOGIN. Mesma origem e mesmas razoes das telas acima
 * (servida pelo vite, nome ASCII, desvio por '/' em setImage). Uma so, e nao
 * uma lista: a tela de login nao sorteia -- ela e a primeira impressao do jogo
 * e precisa ser a mesma toda vez.
 */
const FUNDO_DE_LOGIN = '/ragidle/login/login-aventureiros.jpeg';

/**
 * Background Namespace
 */
class Background {
	/**
	 * Initialize Background component
	 *
	 * @param {Array} loading - Array of loading filenames stored in clientinfo.xml
	 */
	static init(loading) {
		_progress = 0;
		_canvas.style.zIndex = '1';
		_barLayer.style.zIndex = '1';

		render();

		// O sorteio SO pode cair na arte do dono. O parametro `loading` (a lista do
		// clientinfo.xml do roBrowser) e ignorado de proposito: nenhum chamador do
		// Rag Idle passa lista hoje, e honra-lo seria uma porta silenciosa de volta
		// para as loading01..10.jpg do GRF -- exatamente o que esta entrega tirou de
		// circulacao. Para devolver o comportamento upstream basta um
		// `if (loading) { _loading = loading; return; }` aqui.
		void loading;
		_loading = TELAS_DE_CARREGAMENTO;
	}

	/**
	 * A lista VIVA de onde setLoading() sorteia.
	 *
	 * Existe para a prova poder auditar o conjunto sortavel sem depender de
	 * sorte: recarregar N vezes so mostra o que caiu, nunca o que PODE cair.
	 *
	 * @returns {Array<string>} copia, para ninguem alterar o sorteio por fora
	 */
	static getLoadingList() {
		return _loading.slice();
	}

	/**
	 * Resize the background
	 */
	static resize(width, height) {
		_canvas.width = width;
		_canvas.height = height;
		Object.assign(_overlay.style, { width: width + 'px', height: height + 'px' });
		Object.assign(_container.style, { width: width + 'px', height: height + 'px' });
		Object.assign(_barLayer.style, { width: width + 'px', height: height + 'px' });

		_ctx.clearRect(0, 0, width, height);

		render();
	}

	/**
	 * Set an image as background
	 *
	 * @param {string|Array<string>} filename
	 * @param {function} callback once the image is loaded (optional)
	 */
	static setImage(filename, callback) {
		const exist = !!_container.parentNode;
		_progress = -1;

		_container.innerHTML = '';
		_container.style.backgroundImage = 'none';
		render();

		// Desvio para arte servida pelo proprio vite (public/, ver
		// TELAS_DE_CARREGAMENTO): comeca com '/', logo NAO e caminho de GRF e nao
		// pode passar por Client.loadFile -- o carregador minusculiza o caminho, e
		// so o GRF conhece DB.INTERFACE_PATH. Aqui tambem mora o "cover": as telas
		// novas sao 1376x768 (1.792:1) e nao 4:3 como as do RO, entao o
		// backgroundSize '100% 100%' de baixo as esmagaria em 1280x1024 e as
		// esticaria em 2560x1080. 'cover' + 'center' preenche sem deformar,
		// sacrificando borda em vez de proporcao.
		if (typeof filename === 'string' && filename.charAt(0) === '/') {
			const pronta = () => {
				Object.assign(_container.style, {
					backgroundImage: `url(${filename})`,
					backgroundSize: 'cover',
					backgroundPosition: 'center center',
					backgroundRepeat: 'no-repeat'
				});
				if (exist && callback) callback();
			};

			// Espera o decode antes de avisar: sem isso a barra de progresso aparece
			// por cima do container ainda preto no primeiro carregamento.
			const img = new Image();
			img.onload = pronta;
			img.onerror = pronta;
			img.src = filename;
		} else if (Array.isArray(filename)) {
			let loadedCount = 0;
			const total = filename.length;
			const divs = [];

			// Pre-create the grid cells in exact order
			for (let i = 0; i < total; i++) {
				const div = document.createElement('div');
				Object.assign(div.style, {
					width: '25%',
					height: '33.333%',
					float: 'left',
					backgroundSize: '100% 100%'
				});
				divs.push(div);
				_container.appendChild(div);
			}

			filename.forEach((file, index) => {
				const fullPath = DB.INTERFACE_PATH + file;

				Client.loadFile(
					fullPath,
					url => {
						divs[index].style.backgroundImage = `url(${url})`;

						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					},
					() => {
						loadedCount++;
						if (loadedCount === total) {
							if (exist && callback) callback();
						}
					}
				);
			});
		} else {
			const fullPath = DB.INTERFACE_PATH + filename;
			// Get and load Image
			Client.loadFile(
				fullPath,
				url => {
					Object.assign(_container.style, {
						backgroundImage: `url(${url})`,
						// Os tres explicitos porque o desvio de cover acima grudou
						// 'cover'/'center' no MESMO elemento: sem repor, a tela de login
						// herdaria o enquadramento da ultima tela de carregamento.
						backgroundSize: '100% 100%',
						backgroundPosition: '0% 0%',
						backgroundRepeat: 'no-repeat'
					});
					if (exist && callback) callback();
				},
				() => {
					if (exist && callback) callback();
				}
			);
		}

		// Add transition only if the background isn't here
		if (!exist) {
			transition(() => {
				document.body.appendChild(_container);
				document.body.appendChild(_canvas);
				document.body.appendChild(_barLayer);
				if (callback) {
					callback();
				}
			});
		}
	}

	/**
	 * O fundo da tela de login do Rag Idle.
	 *
	 * Arte do dono, servida pelo vite como as telas de carregamento (ver
	 * TELAS_DE_CARREGAMENTO): comeca com '/', entao setImage a pinta pelo desvio
	 * que ja aplica cover + center -- ela e 1376x768 e seria esmagada pelo
	 * '100% 100%' do ramo do GRF.
	 *
	 * Por que ela ganha de TODOS os PACKETVER e nao so do nosso: o escalonamento
	 * abaixo existe para escolher a arte da Gravity conforme a versao do cliente,
	 * e nao ha versao em que a arte deles deva vencer a nossa. O escalonamento
	 * fica de pe logo abaixo, intacto -- para voltar ao fundo original basta
	 * apagar este return, sem reescrever nada.
	 */
	static getLoginBackgroundName() {
		return FUNDO_DE_LOGIN;
	}

	/**
	 * O escalonamento ORIGINAL do roBrowser, preservado. Nao e chamado por
	 * ninguem enquanto FUNDO_DE_LOGIN existir; e a fonte para quem quiser a arte
	 * da Gravity de volta, e a prova de que nao apagamos nada do fork.
	 */
	static getLoginBackgroundNameDoRoBrowser() {
		if (PACKETVER.value >= 20221207) {
			return 't_login.jpg';
		}
		if (PACKETVER.value >= 20181114) {
			return [
				't_\xB9\xE8\xB0\xE61-1.bmp',
				't_\xB9\xE8\xB0\xE61-2.bmp',
				't_\xB9\xE8\xB0\xE61-3.bmp',
				't_\xB9\xE8\xB0\xE61-4.bmp',
				't_\xB9\xE8\xB0\xE62-1.bmp',
				't_\xB9\xE8\xB0\xE62-2.bmp',
				't_\xB9\xE8\xB0\xE62-3.bmp',
				't_\xB9\xE8\xB0\xE62-4.bmp',
				't_\xB9\xE8\xB0\xE63-1.bmp',
				't_\xB9\xE8\xB0\xE63-2.bmp',
				't_\xB9\xE8\xB0\xE63-3.bmp',
				't_\xB9\xE8\xB0\xE63-4.bmp'
			];
		}
		return 'bgi_temp.bmp';
	}

	/**
	 * Add versioned login background
	 *
	 * @param {function} callback once the background is display (optional)
	 */
	static setLoginBackground(callback) {
		Background.setImage(Background.getLoginBackgroundName(), callback);
	}

	/**
	 * Add loading background
	 *
	 * @param {function} callback once the loading is display (optional)
	 */
	static setLoading(callback) {
		const lista = _loading.length ? _loading : TELAS_DE_CARREGAMENTO;
		const index = Math.floor(Math.random() * lista.length);

		// Antes de pintar: a janela nativa de informacao basica e os dois botoes
		// de "subiu de nivel" sobrevivem ao UIManager.removeComponents() por
		// nao pertencerem a arvore de componente nenhum quando ele roda (ver o
		// bloco "O vazamento da HUD" no topo). Background.remove() devolve.
		esconderVazamentoDaHud();

		// A reserva era 'loading01.jpg' -- arte do GRF. Ela precisava sair: com
		// setLoading() chamado antes de init() (MapRenderer nao garante a ordem), a
		// lista vazia caia na tela antiga e uma das dez velhas voltava a aparecer.
		Background.setImage(lista[index], () => {
			_canvas.style.zIndex = '999';
			_barLayer.style.zIndex = '999';
			Background.setPercent(0.0);

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Remove background
	 *
	 * @param {function} callback once the overlay hide the window (optional)
	 */
	static remove(callback) {
		const exist = !!_container.parentNode;

		if (!exist) {
			devolverVazamentoDaHud();
			if (callback) {
				callback();
			}
			return;
		}

		transition(() => {
			// Devolve DENTRO da transicao, junto com a arte saindo: devolver no
			// topo de remove() traria o texto de volta por cima da arte durante
			// os ~500 ms do fade.
			devolverVazamentoDaHud();
			_progress = -1;
			_container.style.zIndex = '0';
			_canvas.style.zIndex = '0';
			_barLayer.style.zIndex = '0';
			_barLayer.style.display = 'none';
			if (_container.parentNode) _container.parentNode.removeChild(_container);
			if (_canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
			if (_barLayer.parentNode) _barLayer.parentNode.removeChild(_barLayer);
			_container.innerHTML = '';
			_container.style.backgroundImage = 'none';

			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Adding progress bar to background
	 *
	 * Antes desenhava num <canvas> com cores cravadas (ciano/cinza/amarelo, ver
	 * historico do arquivo); agora e' DOM (_barLayer), estilizado por
	 * injectLoadbarCSS() acima com os tokens do design system.
	 *
	 * @param {number} percent
	 */
	static setPercent(percent) {
		_progress = Math.min(Math.floor(percent), 100);

		_barLayer.style.display = 'block';
		_barFill.style.width = _progress + '%';
		_barPct.textContent = _progress + '%';
	}
}

/**
 * Play with the overlay
 *
 * @param {function} callback once the overlay hide the window
 */
function transition(callback) {
	const transitionDuration = Configs.get('transitionDuration') ? Configs.get('transitionDuration') : 500;

	if (_overlayAnim) {
		_overlayAnim.stop();
	}

	_overlay.style.opacity = '0.01';
	document.body.appendChild(_overlay);

	_overlayAnim = animateElement(_overlay, { opacity: 1.0 }, transitionDuration, () => {
		callback();

		_overlayAnim = animateElement(_overlay, { opacity: 0.01 }, transitionDuration, () => {
			if (_overlay.parentNode) {
				_overlay.parentNode.removeChild(_overlay);
			}
		});
	});
}

/**
 * Export
 */
export default Background;
