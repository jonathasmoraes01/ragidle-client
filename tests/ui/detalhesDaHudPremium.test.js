/**
 * OS DETALHES DO DONO NA HUD PREMIUM (15/10/2026), depois de jogar com ela no PC: *"o ping quando esta alto, fica
 * cortando. a % da exp coloca uma barrinha em baixo delas, por mais que aumente um pouco. Coloque a possibilidade
 * da pessoa minimizar o mapa tambem e ficar apenas o nome do mapa atual. Coloquei os icones novos la no drive"* -
 * e o print com o "120 FPS" por cima da aba Codex do cartao de missoes.
 *
 * O que se prova:
 *   - o PING alto nao espreme o cartao: a coluna do aparelho deixa o numero da bateria (o desenho ja diz o nivel);
 *   - a % da EXP sai de dentro do trilho: texto a direita do nivel, com uma barrinha de 4px embaixo;
 *   - o MINIMAPA minimiza na pilula do nome: a preferencia (guardada, nasce aberta), a marca no documento e nos
 *     shadows, o toque que alterna e diz o que faz, o mapa que para de desenhar, e o CSS que deixa so a pilula
 *     (com o trilho abaixo do alvo de toque dela, e nao colado);
 *   - os ICONES do Drive: o Auto, o Cacar e o Voltar desenham a arte do dono (os arquivos existem e sao WEBP), o
 *     rotulo continua sendo texto, e toda imagem que a camada cita existe em `public/`;
 *   - o FPS mora acima do chat, e a coluna de buffs para antes dele (a marca de `marcaDoFps.js`).
 *
 * As provas de tela (`scripts/foto-hud-premium.mjs`, a variante `premium-detalhes` e o `fps=1` nas outras) medem
 * a geometria; aqui fica o que o jsdom alcanca.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import HudPremium, { MARCA_MINIMAPA_RECOLHIDO, esquecerPreferenciasParaTeste } from 'UI/HudPremium/hudPremium.js';
import HudVertical from 'UI/hudVertical.js';
import { alternarMinimapa, ligarRecolherMinimapa } from 'UI/Components/MiniMap/recolherMinimapa.js';
import { MINIMAPA_ESCONDIDO_EM_PE, minimapaVisivel } from 'UI/Components/MiniMap/minimapaNoQuadro.js';
import { MARCA_FPS_VISIVEL, marcarFps } from 'UI/Components/FPS/marcaDoFps.js';

const raizDoRepo = join(__dirname, '..', '..');
const ui = join(raizDoRepo, 'src', 'UI');
const ler = (...partes) => readFileSync(join(ui, ...partes), 'utf8');
const premiumCss = nome => ler('HudPremium', 'componentes', `${nome}.css`);
const tokens = ler('HudPremium', 'tokens.css');
const documento = ler('HudPremium', 'documento.css');

function fingirCelularEmPe() {
	window.matchMedia = consulta => ({ matches: true, media: consulta, addEventListener() {}, removeEventListener() {} });
}

/** Um host como o GUIComponent monta: shadow com `.ui-component-root` e o HTML do componente. */
function montar(nome, html) {
	const host = document.createElement('div');
	host.id = nome;
	host.dataset.guiComponent = nome;
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	raiz.innerHTML = html;
	host.attachShadow({ mode: 'open' }).appendChild(raiz);
	document.body.appendChild(host);
	return { host, raiz };
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
	document.documentElement.className = '';
	window.ROConfig = { enableHudAdaptavel: true, enableHudMobilePremium: true };
	fingirCelularEmPe();
	esquecerPreferenciasParaTeste();
	HudVertical.desligarParaTeste();
});

afterEach(() => {
	delete window.ROConfig;
	esquecerPreferenciasParaTeste();
});

describe('o ping alto nao corta mais', () => {
	const css = premiumCss('BasicInfoIdle');

	it('o numero da bateria sai da coluna do aparelho (o desenho dela ja diz o nivel)', () => {
		expect(css).toMatch(/\.ri-premium \.bi-aparelho \.bi-rodape-bateria-texto \{\s*display: none;/);
	});

	it('o ping nunca quebra em duas linhas', () => {
		expect(css).toMatch(/\.ri-premium \.bi-aparelho \.bi-ping \{[^}]*white-space: nowrap;/);
	});
});

describe('a % da EXP com a barrinha embaixo', () => {
	const css = premiumCss('BasicInfoIdle');
	const regra = seletor => {
		const achada = css.match(new RegExp(`${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
		expect(achada, seletor).not.toBeNull();
		return achada[1];
	};

	it('a fileira do nivel e uma grade: o nivel e a % em cima, a barrinha de 4px embaixo', () => {
		const fileira = regra('.ri-premium .bi-level-row');
		expect(fileira).toMatch(/display: grid !important;/);
		expect(fileira).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto;/);
		expect(fileira).toMatch(/grid-template-rows: auto 4px;/);
	});

	it('o trilho some como caixa: o preenchimento e a % viram itens da grade', () => {
		expect(regra('.ri-premium .bi-exp-track')).toMatch(/display: contents !important;/);
	});

	it('a % e texto por extenso a direita do nivel, fora da barra', () => {
		const pct = regra('.ri-premium .bi-exp-pct');
		expect(pct).toMatch(/position: static;/);
		expect(pct).toMatch(/display: block;/);
		expect(pct).toMatch(/grid-column: 2;/);
		expect(pct).toMatch(/grid-row: 1;/);
		expect(pct).toMatch(/font-size: 9px;/);
	});

	it('a barrinha: o fundo e o `::after` da fileira, e o preenchimento corre por cima dele na fileira de baixo', () => {
		const fundo = regra('.ri-premium .bi-level-row::after');
		expect(fundo).toMatch(/grid-column: 1 \/ -1;/);
		expect(fundo).toMatch(/grid-row: 2;/);
		expect(fundo).toMatch(/height: 4px;/);
		const preenchimento = regra('.ri-premium .bi-exp-fill');
		expect(preenchimento).toMatch(/z-index: 1;/);
		expect(preenchimento).toMatch(/grid-column: 1 \/ -1;/);
		expect(preenchimento).toMatch(/grid-row: 2;/);
		expect(preenchimento).toMatch(/justify-self: start;/);
	});
});

describe('o minimapa minimiza na pilula do nome', () => {
	const html = ler('Components', 'MiniMap', 'MiniMapV2', 'MiniMapV2.html');
	const montarMinimapa = () => montar('MiniMapV2', html);
	const botao = raiz => raiz.querySelector('.mm-recolher');

	it('nasce aberto, e a escolha e guardada no aparelho', () => {
		expect(HudPremium.minimapaRecolhido()).toBe(false);
		expect(HudPremium.definirMinimapaRecolhido(true)).toBe(true);
		esquecerPreferenciasParaTeste();
		expect(HudPremium.minimapaRecolhido()).toBe(true);
		// so `true` recolhe: lixo pedido conta como aberto
		HudPremium.definirMinimapaRecolhido('sim');
		expect(HudPremium.minimapaRecolhido()).toBe(false);
	});

	it('um valor estranho que ja estava guardado tambem nao recolhe', () => {
		localStorage.setItem('HudPremium', JSON.stringify({ barraDeAtalhos: false, minimapaRecolhido: 'sim', _version: 1.0 }));
		esquecerPreferenciasParaTeste();
		expect(HudPremium.minimapaRecolhido()).toBe(false);
	});

	it('quem guardou a preferencia antes desta opcao existir (so a barra de skills) nasce com o mapa aberto', () => {
		localStorage.setItem('HudPremium', JSON.stringify({ barraDeAtalhos: true, _version: 1.0 }));
		esquecerPreferenciasParaTeste();
		expect(HudPremium.minimapaRecolhido()).toBe(false);
		expect(HudPremium.barraDeAtalhosLigada()).toBe(true);
	});

	it('a marca vai ao documento e ao root de cada shadow, so na premium', () => {
		const { raiz } = montarMinimapa();
		HudPremium.definirMinimapaRecolhido(true);
		HudVertical.reaplicar(document);
		expect(document.documentElement.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(true);
		expect(raiz.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(true);
		// sem a premium a preferencia nao vale: o minimapa de D-939 nao tem pilula para abrir
		window.ROConfig.enableHudMobilePremium = false;
		HudVertical.reaplicar(document);
		expect(document.documentElement.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(false);
		expect(raiz.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(false);
	});

	it('o botao mora na pilula do nome e nasce dizendo o que o toque faz', () => {
		const { raiz } = montarMinimapa();
		expect(raiz.querySelector('.mm-header .mm-recolher')).not.toBeNull();
		expect(ligarRecolherMinimapa(raiz)).toBe(true);
		expect(botao(raiz).getAttribute('aria-label')).toBe('Minimizar o mapa');
		expect(botao(raiz).title).toBe('Minimizar o mapa');
		expect(botao(raiz).getAttribute('aria-expanded')).toBe('true');
	});

	it('um toque minimiza (preferencia, marca, rotulo) e o seguinte abre', () => {
		const { raiz } = montarMinimapa();
		HudVertical.reaplicar(document);
		ligarRecolherMinimapa(raiz);
		botao(raiz).click();
		expect(HudPremium.minimapaRecolhido()).toBe(true);
		expect(raiz.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(true);
		expect(botao(raiz).getAttribute('aria-label')).toBe('Abrir o mapa');
		expect(botao(raiz).getAttribute('aria-expanded')).toBe('false');
		botao(raiz).click();
		expect(HudPremium.minimapaRecolhido()).toBe(false);
		expect(raiz.classList.contains(MARCA_MINIMAPA_RECOLHIDO)).toBe(false);
		expect(botao(raiz).getAttribute('aria-label')).toBe('Minimizar o mapa');
	});

	it('o toque e do botao: nao chega a quem ouve o minimapa (o mundo, o arrasto da janela)', () => {
		const { raiz } = montarMinimapa();
		ligarRecolherMinimapa(raiz);
		let vazou = 0;
		botao(raiz).addEventListener('click', () => vazou++);
		raiz.addEventListener('click', () => vazou++);
		botao(raiz).click();
		expect(vazou).toBe(0);
	});

	it('o minimapa antigo, sem a pilula, nao ganha nada', () => {
		const { raiz } = montar('MiniMap', '<div class="mm-header"></div>');
		expect(ligarRecolherMinimapa(raiz)).toBe(false);
		expect(ligarRecolherMinimapa(null)).toBe(false);
		// e alternar sem botao so troca a preferencia, sem lancar
		alternarMinimapa(raiz);
		expect(HudPremium.minimapaRecolhido()).toBe(true);
	});

	it('minimizado, o mapa para de desenhar; aberto, desenha', () => {
		document.documentElement.classList.add('ri-vertical', 'ri-premium');
		expect(minimapaVisivel(document, MINIMAPA_ESCONDIDO_EM_PE)).toBe(true);
		document.documentElement.classList.add(MARCA_MINIMAPA_RECOLHIDO);
		expect(minimapaVisivel(document, MINIMAPA_ESCONDIDO_EM_PE)).toBe(false);
	});

	it('o init do minimapa liga o botao', () => {
		const comum = ler('Components', 'MiniMap', 'MiniMapCommon.js');
		expect(comum).toContain("import { ligarRecolherMinimapa } from 'UI/Components/MiniMap/recolherMinimapa.js';");
		expect(comum).toContain('ligarRecolherMinimapa(root);');
	});

	it('o CSS: so a pilula fica, o host encolhe, e o trilho sobe ate logo abaixo do alvo dela', () => {
		const css = premiumCss('MiniMapV2');
		expect(css).toMatch(
			/\.ri-premium\.ri-minimapa-recolhido \.mm-body,\s*\.ri-premium\.ri-minimapa-recolhido \.mm-footer \{\s*display: none;/
		);
		// o alvo do toque passa 13px da pilula em cima e embaixo: 18 + 2 * 13 = 44
		expect(css).toMatch(/\.ri-premium \.mm-recolher \{[^}]*inset: -13px -6px;/);
		// fora da premium o botao nao existe na tela
		expect(ler('Components', 'MiniMap', 'MiniMapV2', 'MiniMapV2.css')).toMatch(/\.mm-recolher \{\s*display: none;/);
		const recolhido = tokens.match(/html\.ri-premium\.ri-minimapa-recolhido \{([^}]*)\}/);
		expect(recolhido).not.toBeNull();
		expect(recolhido[1]).toMatch(/--m-minimapa: 0px;/);
		expect(recolhido[1]).toMatch(/--m-trilho-topo: calc\(var\(--m-minimapa-topo\) - 9px \+ 20px \+ 13px \+ 3px\);/);
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium\.ri-minimapa-recolhido #MiniMapV2 \{\s*top: calc\(var\(--m-minimapa-topo\) - 9px\) !important;/
		);
	});
});

describe('os icones do Drive no Auto, no Cacar e no Voltar', () => {
	const publico = join(raizDoRepo, 'public');
	const corner = premiumCss('CombatCornerIdle');
	const hunt = premiumCss('HuntButtonIdle');

	it('os quatro medalhoes existem e sao WEBP', () => {
		for (const nome of ['auto-off', 'auto-on', 'cacar', 'voltar']) {
			const arquivo = join(publico, 'ragidle', 'hud', 'premium', `botao-${nome}.webp`);
			expect(existsSync(arquivo), arquivo).toBe(true);
			const cabeca = readFileSync(arquivo).subarray(0, 12).toString('latin1');
			expect(cabeca.slice(0, 4)).toBe('RIFF');
			expect(cabeca.slice(8, 12)).toBe('WEBP');
		}
	});

	it('o Auto desenha a arte do OFF, e ligado a do ON, sem o aro de CSS por cima', () => {
		const anel = corner.match(/\.ri-premium \.cc-ring \{([^}]*)\}/)[1];
		expect(anel).toMatch(/border: 0;/);
		expect(anel).toMatch(/background: url\('\/ragidle\/hud\/premium\/botao-auto-off\.webp'\) center \/ 100% 100% no-repeat;/);
		expect(anel).toMatch(/box-shadow: none;/);
		expect(corner).toMatch(
			/\.ri-premium \.cc-btn--auto\.is-on \.cc-ring \{\s*background-image: url\('\/ragidle\/hud\/premium\/botao-auto-on\.webp'\);/
		);
		// as faiscas de CSS sairiam em dobro com as da arte
		expect(corner).toMatch(
			/\.ri-premium \.cc-btn--auto\.is-on \.cc-ring::before,\s*\.ri-premium \.cc-btn--auto\.is-on \.cc-ring::after \{\s*display: none;/
		);
	});

	it('o brilho interno do hover do desktop nao pinta por cima da arte, e vem ANTES do ligado', () => {
		const hover = corner.indexOf('.ri-premium .cc-btn:hover .cc-ring {');
		const ligado = corner.indexOf('.ri-premium .cc-btn--auto.is-on .cc-ring {');
		expect(hover).toBeGreaterThan(-1);
		expect(hover).toBeLessThan(ligado);
		expect(corner.slice(hover, corner.indexOf('}', hover))).toMatch(/box-shadow: none;/);
	});

	it('o rotulo do Auto continua TEXTO, com o estado escrito', () => {
		expect(corner).toMatch(/\.ri-premium \.cc-label--v::after \{\s*content: ' · OFF';/);
		expect(corner).toMatch(/\.ri-premium \.cc-btn--auto\.is-on \.cc-label--v::after \{\s*content: ' · ON';/);
	});

	it('o Cacar e o Voltar desenham a arte, e o glifo de reserva sai da vista', () => {
		expect(hunt).toMatch(/\.ri-premium \.hb-btn \{[^}]*border: 0;[^}]*box-shadow: none;/);
		expect(hunt).toMatch(/\.ri-premium \.hb-btn \.hb-glifo \{\s*display: none;/);
		expect(hunt).toMatch(/\.ri-premium \.hb-cacar \{[^}]*background-image: url\('\/ragidle\/hud\/premium\/botao-cacar\.webp'\);/);
		expect(hunt).toMatch(/\.ri-premium \.hb-voltar \{[^}]*background-image: url\('\/ragidle\/hud\/premium\/botao-voltar\.webp'\);/);
	});

	it('a pilula do rotulo cobre o quarto de baixo do disco, onde a emenda do recorte mora', () => {
		expect(hunt).toMatch(/\.ri-premium \.hb-rotulo \{\s*top: calc\(100% - 15px\);/);
		expect(hunt).toMatch(/\.ri-premium \.hb-voltar::after \{[^}]*top: calc\(100% - 11px\);/);
	});

	it('o apagado do botao (o filtro do `.ri-btn`) sobrevive a sombra da arte', () => {
		expect(hunt).toMatch(/\.ri-premium \.hb-btn:disabled \{\s*filter: grayscale\(1\) drop-shadow/);
	});

	it('toda imagem que a camada premium cita existe em public/', () => {
		const pastas = [join(ui, 'HudPremium'), join(ui, 'HudPremium', 'componentes')];
		const citadas = new Set();
		for (const pasta of pastas) {
			for (const arquivo of readdirSync(pasta).filter(n => n.endsWith('.css'))) {
				const texto = readFileSync(join(pasta, arquivo), 'utf8');
				for (const [, caminho] of texto.matchAll(/url\('(\/ragidle\/[^']+)'\)/g)) {
					citadas.add(caminho);
				}
			}
		}
		expect(citadas.size).toBeGreaterThan(4);
		for (const caminho of citadas) {
			expect(existsSync(join(publico, caminho)), caminho).toBe(true);
		}
	});
});

describe('o FPS mora acima do chat', () => {
	it('a marca acompanha o host: a vista, escondido, fora do documento', () => {
		const { host } = montar('FPS', '<div id="FPS"></div>');
		expect(marcarFps(host)).toBe(true);
		expect(document.documentElement.classList.contains(MARCA_FPS_VISIVEL)).toBe(true);
		host.style.display = 'none';
		expect(marcarFps(host)).toBe(false);
		expect(document.documentElement.classList.contains(MARCA_FPS_VISIVEL)).toBe(false);
		host.style.display = '';
		marcarFps(host);
		host.remove();
		expect(marcarFps(host)).toBe(false);
		expect(document.documentElement.classList.contains(MARCA_FPS_VISIVEL)).toBe(false);
	});

	it('sem host (o contador saiu), a marca sai', () => {
		document.documentElement.classList.add(MARCA_FPS_VISIVEL);
		expect(marcarFps(null)).toBe(false);
		expect(document.documentElement.classList.contains(MARCA_FPS_VISIVEL)).toBe(false);
	});

	it('o FPS.js marca ao entrar, ao alternar e ao sair', () => {
		const fps = ler('Components', 'FPS', 'FPS.js');
		const corpo = nome => {
			const i = fps.indexOf(`FPS.${nome} = function`);
			return fps.slice(i, fps.indexOf('\n};', i));
		};
		expect(corpo('onAppend')).toContain('marcarFps(this._host);');
		expect(corpo('toggle')).toContain('marcarFps(this._host);');
		expect(corpo('onRemove')).toContain('marcarFps(null);');
	});

	it('a camada premium veste o contador (a pilula) e o ancora logo acima do chat', () => {
		expect(HudPremium.componentesComCss()).toContain('FPS');
		expect(premiumCss('FPS')).toMatch(/\.ri-premium #FPS \{[^}]*position: static;[^}]*border-radius: 999px;/);
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium #FPS \{\s*position: fixed !important;\s*top: auto !important;[^}]*bottom: calc\(var\(--m-chat-alcance\) \+ 6px\) !important;/
		);
		// com o chat em bolinha, centrado sobre ela (a fileira de buffs da folha do Menu corre ao lado dela)
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium\.ri-chat-minimizado #FPS \{\s*left: calc\(var\(--safe-esq, 0px\) \+ var\(--m-margem\) \+ var\(--m-chat-bolinha\) \/ 2\) !important;\s*transform: translateX\(-50%\);/
		);
	});

	it('a coluna de buffs reserva o lugar dele so quando ele esta a vista', () => {
		expect(tokens).toMatch(/html\.ri-premium\.ri-fps-visivel \{\s*--m-reserva-do-fps: 26px;/);
		expect(MARCA_FPS_VISIVEL).toBe('ri-fps-visivel');
		expect(tokens).toMatch(/- 8px - var\(--m-reserva-do-fps, 0px\)/);
	});
});
