/**
 * scripts/arnes-tutorial.js
 *
 * O motor do arnes de foto do tutorial guiado (ver o comentario no
 * `arnes-tutorial.html` para o que ele mede e o que ele NAO mede).
 *
 * Ele monta o Shadow DOM de cada componente-alvo do jeito que o
 * `GUIComponent._prepare()` monta (host + `attachShadow({mode:'open'})` +
 * `<style>Common.css</style>` + `<style>Componente.css</style>` +
 * `<div class="ui-component-root">` com o HTML do componente) e reproduz a mao
 * os `is-open` / `display` que o `init()` e os handlers do JS escrevem. E a
 * receita do arnes de leiaute que este projeto ja usa.
 *
 * O COMPONENTE DO TUTORIAL, esse, e o de verdade: `TutorialIdle.js` e
 * importado, `prepare()`-ado e desenhado pelo proprio `desenhar()` dele. Se a
 * geometria estiver errada, e a foto que reprova, e nao uma copia da conta.
 */

import Common from '/src/UI/Common.css?raw';
import RiIcones from '/src/UI/ri-icones.js';
import * as EscalaDaHud from '/src/UI/escalaDaHud.js';
import * as HudVertical from '/src/UI/hudVertical.js';
import Cursor from '/src/UI/CursorManager.js';
import TutorialIdle from '/src/UI/Components/TutorialIdle/TutorialIdle.js';
import MissoesIdle from '/src/UI/Components/MissoesIdle/MissoesIdle.js';
import { ETAPAS } from '/src/UI/Components/TutorialIdle/etapasDoTutorial.js';

import topMenuHtml from '/src/UI/Components/TopMenuIdle/TopMenuIdle.html?raw';
import topMenuCss from '/src/UI/Components/TopMenuIdle/TopMenuIdle.css?raw';
import missoesHtml from '/src/UI/Components/MissoesIdle/MissoesIdle.html?raw';
import missoesCss from '/src/UI/Components/MissoesIdle/MissoesIdle.css?raw';
import mochilaHtml from '/src/UI/Components/MochilaIdle/MochilaIdle.html?raw';
import mochilaCss from '/src/UI/Components/MochilaIdle/MochilaIdle.css?raw';
import huntBtnHtml from '/src/UI/Components/HuntButtonIdle/HuntButtonIdle.html?raw';
import huntBtnCss from '/src/UI/Components/HuntButtonIdle/HuntButtonIdle.css?raw';
import trackerHtml from '/src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.html?raw';
import trackerCss from '/src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.css?raw';
import codexHtml from '/src/UI/Components/CodexIdle/CodexIdle.html?raw';
import codexCss from '/src/UI/Components/CodexIdle/CodexIdle.css?raw';

const icones = texto => texto.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/** Monta um host igual ao que o GUIComponent monta. */
function montar(nome, html, css) {
	const host = document.createElement('div');
	host.id = nome;
	host.dataset.guiComponent = nome;
	host.style.position = 'absolute';
	host.style.zIndex = '50';
	const shadow = host.attachShadow({ mode: 'open' });
	const comum = document.createElement('style');
	comum.textContent = Common;
	shadow.appendChild(comum);
	const proprio = document.createElement('style');
	proprio.setAttribute('data-component', nome);
	proprio.textContent = css;
	shadow.appendChild(proprio);
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	raiz.innerHTML = icones(html);
	shadow.appendChild(raiz);
	document.body.appendChild(host);
	return { host, shadow, raiz };
}

const pecas = {
	TopMenuIdle: montar('TopMenuIdle', topMenuHtml, topMenuCss),
	MissoesIdle: montar('MissoesIdle', missoesHtml, missoesCss),
	MochilaIdle: montar('MochilaIdle', mochilaHtml, mochilaCss),
	HuntButtonIdle: montar('HuntButtonIdle', huntBtnHtml, huntBtnCss),
	MissoesTrackerIdle: montar('MissoesTrackerIdle', trackerHtml, trackerCss),
	CodexIdle: montar('CodexIdle', codexHtml, codexCss)
};

/* O rastreador e posicionado por JS no jogo (`syncPosition`), entao aqui ele
   ganha a mesma ancora a mao: coluna da esquerda, abaixo do painel de
   personagem. */
pecas.MissoesTrackerIdle.host.style.left = '16px';
pecas.MissoesTrackerIdle.host.style.top = '110px';

/* As janelas Idle sao ARRASTAVEIS no jogo, e a posicao delas vem de
   `Preferences`. Sem preferencia salva elas nascem no canto, em cima do
   rastreador, e a foto fica confusa por um motivo que nao e do tutorial.
   Aqui elas ganham uma ancora central, so para o print se ler. */
if (window.innerWidth > 600) {
	pecas.MissoesIdle.host.style.left = '520px';
	pecas.MissoesIdle.host.style.top = '120px';
	pecas.MochilaIdle.host.style.left = '520px';
	pecas.MochilaIdle.host.style.top = '120px';
}

/* O leque do menu esconde o item de Admin para quem nao e a conta dona
   (TopMenuIdle.js). Sem isso a coluna sai com um item a mais. */
const admin = pecas.TopMenuIdle.shadow.querySelector('.tm-item-admin');
if (admin) {
	admin.style.display = 'none';
}

/** Uma missao de mentira, no formato que o ZC_RAGIDLE_MISSOES entrega. */
function semearMissoes() {
	const lista = pecas.MissoesIdle.shadow.querySelector('.mi-lista') || pecas.MissoesIdle.shadow.querySelector('.mi-body');
	if (lista) {
		lista.innerHTML =
			'<div class="mi-card">' +
			'<div class="mi-titulo">Os arredores de Prontera</div>' +
			'<p class="mi-descricao">Derrote 10 Porings nos campos ao redor da cidade.</p>' +
			'<div class="mi-objetivo">Derrotar Poring 0/10</div>' +
			'<button type="button" class="ri-btn ri-btn--ouro mi-executar" data-executar="iniciar" data-id="jornada-prt_fild08-1002">Iniciar</button>' +
			'</div>';
	}
	MissoesIdle.execucao = {
		ativaId: 'jornada-prt_fild08-1002',
		tituloAtiva: 'Os arredores de Prontera',
		passo: { texto: 'Derrotar Poring', progresso: 3, alvo: 10 }
	};
}

/** O rastreador desenhado como o `render()` dele desenha a missao ativa. */
function semearRastreador() {
	const ativa = pecas.MissoesTrackerIdle.shadow.querySelector('.mt-ativa');
	if (!ativa) return;
	ativa.dataset.vazia = 'false';
	ativa.innerHTML =
		'<div class="mt-ativa-titulo">Os arredores de Prontera</div>' +
		'<div class="mt-ativa-passo">Derrotar Poring 3/10</div>' +
		'<div class="mt-barra"><div class="mt-barra-fill" style="width:30%"></div></div>';
}

/** Um ladrilho de arma ocupado, como MochilaIdle monta. */
function semearMochila() {
	const coluna = pecas.MochilaIdle.shadow.querySelector('.mo-coluna-esq');
	if (!coluna) return;
	coluna.innerHTML = '';
	for (const [location, glifo, rotulo] of [
		[256, 'slotChapeu', 'Chapéu'],
		[2, 'slotArma', 'Arma'],
		[4, 'slotCapa', 'Capa']
	]) {
		const tile = document.createElement('div');
		tile.className = 'ri-tile mo-slot';
		tile.dataset.location = String(location);
		tile.dataset.dica = rotulo;
		tile.innerHTML = `<span class="mo-slot-glifo">${RiIcones[glifo] || ''}</span>`;
		coluna.appendChild(tile);
	}
}

semearMissoes();
semearRastreador();
semearMochila();

/* O tutorial de verdade. `prepare()` monta a shadow DOM dele; o `_host` sai do
   documento no fim do `_prepare()` (e o que o GUIComponent faz), entao o arnes
   o devolve, que e o papel do `append()`. */
TutorialIdle.prepare();
document.body.appendChild(TutorialIdle._host);

/**
 * A ARMADILHA 1 NA TELA: o arnes liga a escala da HUD de verdade
 * (`escalaDaHud.aplicar`), que escreve `style.zoom` em TODO
 * `[data-gui-component]` - inclusive no host do tutorial. Se o
 * `zoom: 1 !important` do CSS nao ganhasse do inline, a foto sairia com a
 * camada desenhada no lugar errado, e a prova mede isso.
 */
EscalaDaHud.reaplicar(document);

/*
 * A ARMADILHA 4 NA TELA: a marca `ri-vertical` e carimbada pelo modulo de
 * verdade, no `.ui-component-root` de cada shadow. Sem ela o celular sai com o
 * arranjo de computador, o leque nasce fora da tela e a foto do celular nao
 * responde a pergunta que ela existe para responder.
 */
HudVertical.aplicar(document, true);

/*
 * A MAO. No jogo, `Cursor.init()` le `data/sprite/cursors.spr` do GRF pelo
 * servidor de assets, e o arnes nao tem esse servidor. O quadro injetado pela
 * prova e o MESMO (mesmo arquivo do GRF, mesma conta de posicao do
 * CursorManager) e entra pela MESMA porta: `getCompiledFrameURL`. Assim o
 * caminho de desenho exercitado e o do componente, inclusive a medida da ponta
 * do dedo varrendo o alfa.
 */
window.__arnesPorMaoDoJogo = url => {
	Cursor.getCompiledFrameURL = () => url;
};

/** Abre (ou fecha) o leque do menu, como o `aplicarEstadoDoLeque()` faz. */
function leque(aberto) {
	const s = pecas.TopMenuIdle.shadow;
	const fan = s.querySelector('.tm-fan');
	const fab = s.querySelector('.tm-fab');
	const raiz = s.querySelector('#TopMenuIdle');
	if (!fan || !fab) return;
	/* A mesma sequencia de `aplicarEstadoDoLeque()`: montar, depois abrir. E o
	   `tm-aberto` na raiz, que e o que a HUD vertical le para desenhar a FOLHA
	   em vez do leque. */
	fan.classList.toggle('is-mounted', aberto);
	fan.classList.toggle('is-open', aberto);
	fab.classList.toggle('is-open', aberto);
	if (raiz) raiz.classList.toggle('tm-aberto', aberto);
	fab.setAttribute('aria-expanded', String(aberto));
}

/** Abre/fecha uma janela RAGIDLE do jeito que elas abrem: `.xx-window.is-open`. */
function janela(nome, seletor, aberta) {
	const el = pecas[nome] && pecas[nome].shadow.querySelector(seletor);
	if (el) {
		el.classList.toggle('is-open', aberta);
	}
}

/** Deixa a tela no arranjo que a etapa `n` encontraria no jogo. */
function cena(n) {
	leque(n === 2 || n === 8);
	janela('MissoesIdle', '.mi-window', n === 3);
	janela('MochilaIdle', '.mo-window', n === 4);
	janela('CodexIdle', '.cx-window', false);
	pecas.HuntButtonIdle.host.style.display = n === 5 ? '' : 'none';
	pecas.MissoesTrackerIdle.host.style.display = '';
}

window.__arnes = {
	/** Quantas etapas a tabela tem (a prova nao chuta o numero). */
	total: ETAPAS.length,

	/**
	 * Poe a etapa `n` na tela e devolve as MEDIDAS. Nao ha caminho de desenho
	 * proprio aqui: quem desenha e o `TutorialIdle.onResize()` -> `desenhar()`
	 * do componente de verdade.
	 */
	async etapa(n, opcoes) {
		cena(n);
		/* As janelas Idle fecham com `.ri-anima` (transicao de saida). Medir e
		   fotografar no quadro seguinte pegaria a janela da etapa ANTERIOR ainda
		   desbotando na tela, e a prova acusaria a camada por isso. */
		await new Promise(ok => setTimeout(ok, 280));
		TutorialIdle.estado = { v: 1, estado: 'em-andamento', etapa: n, total: ETAPAS.length };
		if (opcoes && opcoes.alvoSumido) {
			/* Forca o caminho de recuperacao: o leque fecha e o alvo da etapa
			   fica em 0x0. */
			leque(false);
			janela('MissoesIdle', '.mi-window', false);
			janela('MochilaIdle', '.mo-window', false);
		}
		TutorialIdle.onResize();
		/* A imagem da mao carrega de forma assincrona, e a medida da ponta do
		   dedo (e o redesenho que ela dispara) so acontece depois. Sem esta
		   espera a foto sairia com a mao no lugar da estimativa de reserva. */
		const img = TutorialIdle._shadow.querySelector('.tu-mao-img');
		if (img && img.getAttribute('src')) {
			try {
				await img.decode();
			} catch (_erro) {
				/* imagem invalida: a medida diz `maoCarregou:false` e a prova reprova */
			}
		}
		await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
		return this.medir(n);
	},

	/** As medidas que a prova cobra. Tudo em pixel de viewport. */
	medir(n) {
		const raiz = TutorialIdle._shadow;
		const camada = raiz.querySelector('.tu-camada');
		const etapa = ETAPAS.find(e => e.numero === n);
		const alvoEl = etapa.alvo
			? (document.getElementById(etapa.alvo.host) || {}).shadowRoot?.querySelector(etapa.alvo.seletor)
			: null;
		const caixa = el => {
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { x: r.left, y: r.top, w: r.width, h: r.height };
		};

		const veus = [...camada.querySelectorAll('.tu-veu')]
			.filter(v => v.style.display !== 'none')
			.map(caixa);
		const anel = caixa(camada.querySelector('.tu-anel'));
		const maoEl = camada.querySelector('.tu-mao');
		const maoImg = camada.querySelector('.tu-mao-img');
		const balao = camada.querySelector('.tu-balao');

		/* QUEM RECEBE O TOQUE no centro do alvo? Contar elemento nao prova que da
		   para clicar: esta e a pergunta que a sonda do alfa ensinou a fazer. O
		   `elementFromPoint` do DOCUMENTO devolve o host; o do shadow root do
		   dono devolve o proprio controle. Se um veu estiver por cima, o
		   documento devolve o host do tutorial, e e isso que reprova. */
		let quemRecebe = null;
		const alvoCaixa = caixa(alvoEl);
		if (alvoCaixa) {
			const cx = alvoCaixa.x + alvoCaixa.w / 2;
			const cy = alvoCaixa.y + alvoCaixa.h / 2;
			const topo = document.elementFromPoint(cx, cy);
			quemRecebe = topo ? topo.id || topo.tagName : null;
		}
		/* E num ponto QUALQUER fora do furo, quem recebe tem de ser a mascara. */
		const foraX = 8;
		const foraY = 8;
		const topoFora = document.elementFromPoint(foraX, foraY);

		return {
			etapa: n,
			aberta: camada.classList.contains('is-open'),
			semMascara: camada.classList.contains('sem-mascara'),
			zoomDoHost: getComputedStyle(TutorialIdle._host).zoom,
			zoomInlineDoHost: TutorialIdle._host.style.zoom,
			zoomDeOutroHost: getComputedStyle(pecas.TopMenuIdle.host).zoom,
			alvo: alvoCaixa,
			veus,
			anel,
			mao: caixa(maoEl),
			maoEspelhada: {
				x: maoEl.classList.contains('espelha-x'),
				y: maoEl.classList.contains('espelha-y')
			},
			maoCarregou: !!(maoImg && maoImg.naturalWidth > 1),
			maoReserva: maoEl.classList.contains('sem-cursor'),
			balao: caixa(balao),
			balaoCasa: balao.classList.contains('is-cima') ? 'cima' : 'baixo',
			quem: camada.querySelector('.tu-quem').textContent,
			passo: camada.querySelector('.tu-passo').textContent,
			frase: camada.querySelector('.tu-frase').textContent,
			pularVisivel: (() => {
				const b = camada.querySelector('.tu-pular');
				const r = b.getBoundingClientRect();
				return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
			})(),
			quemRecebeNoAlvo: quemRecebe,
			quemRecebeFora: topoFora ? topoFora.id || topoFora.tagName : null,
			tela: { largura: window.innerWidth, altura: window.innerHeight }
		};
	},

	/** O estado do servidor com o tutorial fora do ar (concluido/pulado). */
	desligar(estado) {
		TutorialIdle.estado = { v: 1, estado, etapa: 0, total: ETAPAS.length };
		TutorialIdle.onResize();
		return {
			aberta: TutorialIdle._shadow.querySelector('.tu-camada').classList.contains('is-open')
		};
	},

	/** A mao do jogo esta disponivel? A prova precisa saber para relatar honesto. */
	temMaoDoJogo() {
		const img = TutorialIdle._shadow.querySelector('.tu-mao-img');
		return !!(img && img.src && img.naturalWidth > 1);
	},

	/** Liga a arte da mao pela porta do componente (`getCompiledFrameURL`). */
	async porMaoDoJogo(dataUrl) {
		window.__arnesPorMaoDoJogo(dataUrl);
		TutorialIdle.onResize();
		const img = TutorialIdle._shadow.querySelector('.tu-mao-img');
		if (!img.getAttribute('src')) return false;
		try {
			await img.decode();
		} catch (_erro) {
			return false;
		}
		return img.naturalWidth > 1;
	},

	/** Desliga a arte do jogo: o outro estado REAL, com a seta de reserva. */
	semMaoDoJogo() {
		Cursor.getCompiledFrameURL = () => null;
	},

	/** Esconde/mostra a camada inteira, para a prova comparar o MESMO quadro
	 *  com e sem a mascara (a medida do PNG da regra 5). */
	camadaVisivel(ligada) {
		TutorialIdle._shadow.querySelector('.tu-camada').style.visibility = ligada ? '' : 'hidden';
	}
};

window.__arnesPronto = true;
