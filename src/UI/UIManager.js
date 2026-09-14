/**
 * UI/UIManager.js
 *
 * Manage Interface
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import GUIComponent from 'UI/GUIComponent.js';
import CommonCSS from 'UI/Common.css?raw';
import UIVersionManager from 'UI/UIVersionManager.js';
import KEYS from 'Controls/KeyEventHandler.js';
import ClampToViewport from 'UI/ClampToViewport.js';
import EscalaDaHud from 'UI/escalaDaHud.js'; // D-934: a HUD diminui junto com a janela
import HudVertical from 'UI/hudVertical.js'; // D-939: a HUD vertical do celular em pe

/**
 * Centralize popup position
 * @returns {{top: string, left: string, zIndex: string}}
 */
function _popupPosition() {
	return {
		top: `${(window.innerHeight - 120) / 1.5 - 120}px`,
		left: `${(window.innerWidth - 280) / 2.0}px`,
		zIndex: '100'
	};
}

/**
 * Create a button with data-attributes for parseHTML to process
 * @param {string} name - button name (ex: 'ok', 'cancel')
 * @param {function} onClick - click callback (fires once)
 * @param {string} [label] - optional visible text. O bitmap do GRF (btn_ok.bmp
 *   etc.) ja tem o rotulo desenhado, entao os chamadores normais NAO passam
 *   isso -- passar teria um rotulo duplicado (bitmap + texto) quando o
 *   bitmap carrega. So usado pela caixa de erro de boot (showErrorBox), que
 *   tem de funcionar ANTES de qualquer asset do GRF existir: sem rotulo,
 *   vira um retangulo mudo sem dizer o que faz.
 * @returns {HTMLButtonElement}
 */
/**
 * O rotulo PT-BR do botao de caixa, a partir do NOME DE TEXTURA que os
 * chamadores ja passam ('ok'/'cancel' sao os unicos em uso — conferido com
 * grep em 27/08/2026). Nome fora do mapa volta como esta: rotulo estranho e
 * melhor que botao mudo.
 */
function _rotuloDeBotao(name) {
	return { ok: 'OK', cancel: 'Cancelar', yes: 'Sim', no: 'Nao' }[name] || name;
}

function _createButton(name, onClick, label) {
	const btn = document.createElement('button');
	/* Fase 3 (01/09/2026): o botao de caixa deixou de vestir bitmap do GRF
	   (btn_ok.bmp e familia). O rotulo agora e SEMPRE texto — traduzido por
	   _rotuloDeBotao — e a pele e a do design system: `.ri-btn` ja mora em
	   todo Shadow DOM via Common.css. `ok` continua primario; qualquer outro
	   nome (cancel/no) sai secundario, que e a hierarquia das nossas janelas.
	   O terceiro argumento sobrevive para quem quiser um rotulo especifico. */
	btn.className = name === 'ok' || name === 'yes' ? 'btn ri-btn' : 'btn ri-btn ri-btn--sec';
	btn.textContent = label || _rotuloDeBotao(name);

	let clicked = false;
	btn.addEventListener('click', () => {
		if (clicked) return;
		clicked = true;
		onClick();
	});

	return btn;
}

/**
 * Create overlay that blocks interaction with the game
 * @returns {HTMLDivElement}
 */
function _createOverlay() {
	const overlay = document.createElement('div');
	overlay.className = 'win_popup_overlay';
	document.body.appendChild(overlay);
	return overlay;
}

// Common CSS must live in a global <style> tag so document-level rules
// (body font-size/family, focus reset) apply to light DOM and are inherited
// by every component's Shadow DOM. UIComponent.js used to inject this at load;
// it now lives here since UIManager is always loaded.
(function injectCommonCSS() {
	let style = document.querySelector('style[data-common]');
	if (!style) {
		style = document.createElement('style');
		style.setAttribute('data-common', '');
		style.textContent = CommonCSS;
		document.head.appendChild(style);
	}
})();

/*
 * As faces do design system (Marcellus para titulo, Figtree para UI) entram
 * UMA vez por documento, aqui — e nao por @import dentro do Common.css, que
 * seria refeito dentro de cada Shadow DOM. O jogo roda num iframe, entao o
 * documento certo e este, o mesmo que recebe o CSS comum acima.
 *
 * Sem rede o <link> falha calado e a pilha de reserva (Arial/Liberation Sans)
 * assume: nenhuma tela quebra, so perde o acabamento tipografico. Por isso as
 * familias em Common.css declaram reserva, e nada aqui e bloqueante.
 */
(function injectDesignSystemFonts() {
	if (document.querySelector('link[data-ri-fontes]')) {
		return;
	}
	const preconnect = document.createElement('link');
	preconnect.rel = 'preconnect';
	preconnect.href = 'https://fonts.gstatic.com';
	preconnect.crossOrigin = 'anonymous';
	document.head.appendChild(preconnect);

	const link = document.createElement('link');
	link.setAttribute('data-ri-fontes', '');
	link.rel = 'stylesheet';
	link.href =
		'https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700;800&display=swap';
	document.head.appendChild(link);
})();

// Overlay CSS must live in the global <style> tag because overlay divs
// are appended to document.body (light DOM), not inside any Shadow DOM.
(function injectOverlayCSS() {
	let style = document.querySelector('style[data-overlay]');
	if (!style) {
		style = document.createElement('style');
		style.setAttribute('data-overlay', '');
		style.textContent = `  
			.win_popup_overlay {
				position: fixed;
				top: 0px;
				left: 0px;
				width: 100%;
				height: 100%;
				z-index: 99;
			}`;
		document.head.appendChild(style);
	}
})();

/**
 * Reorder keydown handlers so the popup captures first.
 * Moves the component's keydown handler to the capture phase so it fires before all other listeners.
 */
function _prioritizeKeyDown() {
	if (this._keyHandler) {
		window.removeEventListener('keydown', this._keyHandler);
		window.addEventListener('keydown', this._keyHandler, true);
	}
}

/**
 * User Interface Manager
 */
class UIManager {
	/**
	 * Components cache
	 * @var {array} Components List
	 */
	static components = {};

	/**
	 * Store a component in the manager
	 *
	 * @param {GUIComponent} component object
	 */
	static addComponent(component) {
		if (!(component instanceof GUIComponent)) {
			throw new Error('UIManager::addComponent() - Invalid type of component');
		}

		component.manager = this;
		this.components[component.name] = component;
		return component;
	}

	/**
	 * Get component stored in manager
	 *
	 * @param {string} component name
	 * @return {GUIComponent} object
	 */
	static getComponent(name) {
		const versionAlias = UIVersionManager.getUIAlias(name);
		if (versionAlias) {
			name = versionAlias;
		}

		if (!(name in this.components)) {
			throw new Error('UIManager.getComponent() - Component "' + name + '" not found');
		}

		return this.components[name];
	}

	/**
	 * Remove all components in screen
	 */
	static removeComponents(manter = []) {
		const keys = Object.keys(this.components);
		const count = keys.length;

		for (let i = 0; i < count; ++i) {
			/* `manter` (10/09/2026): a TROCA DE MAPA preserva o chat — ver
			   `MapRenderer.setMap`. Sem argumento, como em todo outro chamador
			   (login, selecao de personagem, sair do jogo), sai tudo. */
			if (manter.includes(keys[i])) continue;
			this.components[keys[i]].remove();
		}
	}

	/**
	 * When resizing window, some components can be outside the screen size and
	 * it sucks a lot. Try to correct the problem.
	 *
	 * @param {number} Game screen width
	 * @param {number} Game screen height
	 */
	static fixResizeOverflow(WIDTH, HEIGHT) {
		/*
		 * D-934: a HUD encolhe junto com a janela.
		 *
		 * Aqui, e nao so no `resize` do `escalaDaHud`, porque este e o ponto
		 * por onde TODA mudanca de tamanho passa — inclusive as que nao vem de
		 * um `resize` de janela (o `visualViewport` do teclado virtual, a
		 * troca de mapa que recria hosts). `reaplicar` ignora o cache do
		 * ultimo valor justamente porque um host NOVO precisa nascer com a
		 * escala que ja vigora.
		 */
		EscalaDaHud.reaplicar();
		/* D-939: mesmo motivo — um host recem-criado precisa nascer com a
		   marca `ri-vertical` que ja vigora, e este e o ponto por onde toda
		   mudanca de tamanho e todo host novo passam. */
		HudVertical.reaplicar();
		const keys = Object.keys(this.components);
		for (let i = 0; i < keys.length; ++i) {
			const component = this.components[keys[i]];
			const el = component.ui ? component.ui[0] : null;
			if (!el) continue;
			ClampToViewport(el, WIDTH, HEIGHT, component.magnet);
			if (component.onResize) {
				component.onResize();
			}
		}
	}

	/**
	 * Display an error box component
	 * Will reload the game once selected
	 *
	 * @param {string} error message
	 */
	static showErrorBox(text) {
		const WinError = this.getComponent('WinPopup').clone('WinError');
		WinError.riAnimaJanela = true; // entra/sai com a animacao unica (Fase 3)
		// eslint-disable-next-line
		let overlay;

		WinError.init = function Init() {
			const root = this._shadow;

			root.querySelector('.text').textContent = text;
			Object.assign(this._host.style, _popupPosition());

			root.querySelector('.btns').appendChild(
				_createButton(
					'ok',
					() => {
						overlay.remove();
						WinError.remove();
						import('Engine/GameEngine.js').then(m => m.default.reload());
					},
					'OK'
				)
			);
		};

		WinError.onKeyDown = function OnKeyDown(event) {
			event.stopImmediatePropagation();
			switch (event.which) {
				case KEYS.ENTER:
				case KEYS.ESCAPE:
					overlay.remove();
					this.remove();
					import('Engine/GameEngine.js').then(m => m.default.reload());
			}
		};

		overlay = _createOverlay();
		WinError.onAppend = _prioritizeKeyDown;
		WinError.append();

		return WinError;
	}

	/**
	 * Show a message box to the user
	 *
	 * @param {string} message to show
	 * @param {string} button name
	 * @param {function} callback once the button is pressed
	 */
	static showMessageBox(text, btn_name, callback, keydown) {
		const WinMSG = this.getComponent('WinPopup').clone('WinMSG');
		WinMSG.riAnimaJanela = true; // entra/sai com a animacao unica (Fase 3)

		WinMSG.init = function Init() {
			this.draggable();
			const root = this._shadow;

			root.querySelector('.text').textContent = text;
			Object.assign(this._host.style, _popupPosition());

			if (btn_name) {
				root.querySelector('.btns').appendChild(
					_createButton(btn_name, () => {
						WinMSG.remove();
						if (callback) callback();
					})
				);
			}
		};

		if (keydown) {
			WinMSG.onKeyDown = function (event) {
				switch (event.which) {
					case KEYS.ENTER:
					case KEYS.ESCAPE:
						this.remove();
						if (callback) callback();
				}
				event.stopImmediatePropagation();
			};

			WinMSG.onAppend = _prioritizeKeyDown;
		}

		WinMSG.append();
		return WinMSG;
	}

	/**
	 * A tela de "Dormindo..." (D-1381, 13/09/2026 — EXP projetada e aviso de
	 * aba em D-1386) — o servidor responde ao `CZ_ENTER2` com
	 * `ZC_RAGIDLE_SONO{dormindo:true}` em vez do `ZC_ACCEPT_ENTER2` normal,
	 * quando o personagem ainda esta no sono do "Dormir" ao logar (decisao
	 * "b" do dono: reconectar NAO acerta contas sozinho).
	 *
	 * Construida sobre o MESMO clone de `WinPopup` que `showErrorBox` usa, e
	 * pelo mesmo motivo: e a UNICA janela comprovada a renderizar NESTE ponto
	 * do boot — antes de `MapEngine` ter entrado em mundo nenhum, sem HUD e
	 * sem cena do Renderer.
	 *
	 * A EXP projetada (D-1386, achado do dono ao testar: a tela so dizia
	 * QUANTO TEMPO faltava, nunca o que aquele tempo valia) e recalculada a
	 * cada segundo, do mesmo jeito que o relogio — ela MOSTRA o preco de
	 * acordar cedo em vez de só dizer o prazo, e cai pra zero junto com o
	 * `restante`, nunca inventando um total fixo que a taxa medida não sustenta
	 * (regra 1). E a mesma razao do "pode fechar a aba": achamos essa lacuna
	 * numa auditoria de UX e nenhuma tela dizia isso ate aqui.
	 *
	 * @param {number} restanteMs tempo restante de sono, em ms
	 * @param {{expBasePorMs: number, expClassePorMs: number}} taxas taxa de EXP/ms
	 *   medida na amostra (a MESMA que o servidor congelou ao iniciar o sono)
	 * @param {function(): void} onAcordar chamado quando o jogador clica em "Acordar agora" —
	 *   so manda o pedido ao servidor (D-1387: quem fecha esta janela e reconecta e o
	 *   `dormindo:false` que chega depois, via `onSonoRecebido`, nunca o clique em si)
	 * @returns {{remove: function(): void}} quem chama fecha com `.remove()` se precisar —
	 *   fecha a janela E o overlay juntos (os dois sao peças separadas no DOM)
	 */
	static showDormindo(restanteMs, taxas, onAcordar) {
		const WinSono = this.getComponent('WinPopup').clone('WinSono');
		WinSono.riAnimaJanela = true; // entra/sai com a animacao unica (Fase 3)
		// eslint-disable-next-line
		let overlay;
		let timer = null;
		let restante = Math.max(0, Number(restanteMs) || 0);
		const expBasePorMs = Number(taxas?.expBasePorMs) || 0;
		const expClassePorMs = Number(taxas?.expClassePorMs) || 0;

		function textoDoResto(ms) {
			const totalMin = Math.floor(ms / 60000);
			const h = Math.floor(totalMin / 60);
			const m = totalMin % 60;
			const tempo = h > 0 ? `Dormindo... ${h}h ${m}min restante(s)` : `Dormindo... ${m}min restante(s)`;
			const expBase = Math.round(expBasePorMs * ms).toLocaleString('pt-BR');
			const expClasse = Math.round(expClassePorMs * ms).toLocaleString('pt-BR');
			return (
				`${tempo}\n` +
				`~${expBase} EXP base · ~${expClasse} EXP classe pela frente\n` +
				`Pode fechar esta aba com segurança — o sono continua sem ela.`
			);
		}

		function fecharTudo() {
			if (overlay) overlay.remove();
			WinSono.remove();
		}

		WinSono.init = function Init() {
			const root = this._shadow;
			root.querySelector('.text').textContent = textoDoResto(restante);
			Object.assign(this._host.style, _popupPosition());

			root.querySelector('.btns').appendChild(
				_createButton(
					'ok',
					() => {
						if (timer) clearInterval(timer);
						/*
						 * NAO fecha nem reconecta aqui (D-1387). Um clique so pede —
						 * a janela vira "Acordando..." (sem botao, pra nao deixar
						 * clicar de novo) e fica de pe ate o servidor confirmar. Quem
						 * fecha esta janela e mostra o resumo e `onSonoRecebido`,
						 * quando a resposta chegar (ou o teto de seguranca dela, se
						 * a resposta se perder).
						 */
						const textEl = root.querySelector('.text');
						if (textEl) textEl.textContent = 'Acordando...';
						const btnsEl = root.querySelector('.btns');
						if (btnsEl) btnsEl.innerHTML = '';
						onAcordar();
					},
					'Acordar agora'
				)
			);

			// O contador na TELA (D-1380 ja usa o mesmo padrao no aviso de
			// versao nova): a cada segundo, sem depender de outro tique.
			timer = setInterval(() => {
				restante = Math.max(0, restante - 1000);
				const el = root.querySelector('.text');
				if (el) el.textContent = textoDoResto(restante);
				if (restante <= 0 && timer) {
					// O teto de 8h venceu enquanto o jogador olhava a tela:
					// o mesmo botao resolve, sem exigir um segundo clique.
					clearInterval(timer);
					timer = null;
				}
			}, 1000);
		};

		WinSono.onKeyDown = function OnKeyDown(event) {
			/*
			 * SEM ESC/ENTER fechando sozinho — ao contrario do erro/aviso
			 * comuns, "acordar" e uma decisao explicita do jogador, e um ENTER
			 * sem querer (o mesmo toque que confirmou o login, por exemplo)
			 * nao pode reativar a conta sem o jogador ter escolhido isso.
			 */
			event.stopImmediatePropagation();
		};

		overlay = _createOverlay();
		WinSono.onAppend = _prioritizeKeyDown;
		WinSono.append();

		return { remove: fecharTudo };
	}

	/**
	 * O RESUMO DO "DORMIR" (D-1387, 13/09/2026) — pedido do dono e do Jhow no
	 * grupo de teste ("abrir uma janela com o resumo do Farm off"), depois de
	 * relatar que voltar do sono parecia bugado. Mostrado depois que o servidor
	 * confirma o "acordar" (`onSonoRecebido`), ANTES de reconectar — o jogador
	 * ve o que ganhou antes da tela mudar para o boot/login.
	 *
	 * Mesmo clone de `WinPopup`, pelo mesmo motivo das outras telas do "Dormir":
	 * e a unica janela comprovada a renderizar antes de `MapEngine` ter entrado
	 * em mundo nenhum.
	 *
	 * @param {{expBase: number, expClasse: number, tempoDormidoMs: number}} resumo
	 * @param {function(): void} onContinuar chamado quando o jogador fecha o resumo — e aqui
	 *   que quem chama deve reconectar
	 * @returns {object} o componente aberto
	 */
	static showResumoDoSono(resumo, onContinuar) {
		const WinResumo = this.getComponent('WinPopup').clone('WinResumoSono');
		WinResumo.riAnimaJanela = true;
		let overlay;

		function textoDoResumo() {
			const totalMin = Math.max(0, Math.floor((Number(resumo?.tempoDormidoMs) || 0) / 60000));
			const h = Math.floor(totalMin / 60);
			const m = totalMin % 60;
			const tempo = h > 0 ? `Você dormiu ${h}h ${m}min e ganhou:` : `Você dormiu ${m}min e ganhou:`;
			const expBase = Math.round(Number(resumo?.expBase) || 0).toLocaleString('pt-BR');
			const expClasse = Math.round(Number(resumo?.expClasse) || 0).toLocaleString('pt-BR');
			return `${tempo}\n${expBase} EXP base · ${expClasse} EXP classe`;
		}

		function fechar() {
			overlay.remove();
			WinResumo.remove();
			onContinuar();
		}

		WinResumo.init = function Init() {
			const root = this._shadow;
			root.querySelector('.text').textContent = textoDoResumo();
			Object.assign(this._host.style, _popupPosition());
			root.querySelector('.btns').appendChild(_createButton('ok', fechar, 'Continuar'));
		};

		WinResumo.onKeyDown = function OnKeyDown(event) {
			switch (event.which) {
				case KEYS.ENTER:
				case KEYS.ESCAPE:
					fechar();
			}
			event.stopImmediatePropagation();
		};

		overlay = _createOverlay();
		WinResumo.onAppend = _prioritizeKeyDown;
		WinResumo.append();

		return WinResumo;
	}

	/**
	 * A TELA DA ECONOMIA DE ENERGIA (D-1389/D-1390, 14/09/2026 — sair virou
	 * escolha do jogador em D-1392) — pedido do dono, no estilo dos idles de
	 * mobile: quando a aba vai pro fundo (`visibilitychange`, `MapEngine.js`),
	 * cobre tudo com uma tela preta mostrando o tempo restante e um resumo AO
	 * VIVO (EXP, mobs mortos, itens) — quem chama (`MapEngine.js`) reatualiza
	 * com `.atualizar(...)` a cada segundo, puxando os numeros de
	 * `registroDaCaca`.
	 *
	 * VOLTAR PRA ABA NAO FECHA SOZINHO (D-1392, correção do dono no mesmo
	 * dia): a primeira versão mandava "sair" automático assim que a aba
	 * ficava visível de novo — e um relance rápido na aba (checar uma
	 * notificação, por exemplo) já tirava o personagem do modo sem o jogador
	 * ter escolhido isso. Agora só o clique em "Voltar a jogar" sai; olhar a
	 * aba sozinho não muda nada, e o jogador pode ficar deliberadamente na
	 * economia de energia mesmo olhando a tela.
	 *
	 * NAO usa o clone de `WinPopup` das outras telas do "Dormir": aquela é
	 * uma caixa pequena com moldura do RO, pensada pra diálogo. Esta é tela
	 * CHEIA, sem moldura nenhuma — o pedido foi explícito ("pode ser uma
	 * tela preta mesmo") — então é um `<div>` simples cobrindo o viewport,
	 * sem Shadow DOM.
	 *
	 * O relógio que ESTE componente mostra é só mostrador, como em
	 * `showDormindo` — quem manda a verdade é o servidor; `MapEngine.js`
	 * ressincroniza a cada resposta de `ZC_RAGIDLE_ECONOMIA`.
	 *
	 * @param {number} restanteMs tempo restante, em ms
	 * @param {function(): void} onVoltar chamado quando o jogador clica em "Voltar a jogar" —
	 *   quem chama manda o `sair` e fecha esta tela; ela nunca se fecha sozinha
	 * @returns {{atualizar: function({restanteMs:number, expBase?:number, expClasse?:number,
	 *   abates?:number, itensTotal?:number}): void, remove: function(): void}}
	 */
	static showEconomiaDeEnergia(restanteMs, onVoltar) {
		const overlay = document.createElement('div');
		Object.assign(overlay.style, {
			position: 'fixed',
			inset: '0',
			background: '#000',
			color: '#e8e8e8',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			// 2000000, nunca o teto do cursor (2147483647, CursorManager.js) — o
			// mesmo numero que DeathWindow.css já usa como "camada solta mais
			// alta" (ver o censo no cabeçalho dele); `tests/ui/cursorAcimaDeTudo
			// .test.js` reprova qualquer z-index que alcance o do cursor.
			zIndex: '2000000',
			fontFamily: "'Figtree', Arial, 'Liberation Sans', Arimo, sans-serif",
			textAlign: 'center',
			gap: '12px',
			padding: '24px',
			boxSizing: 'border-box'
		});

		const titulo = document.createElement('div');
		Object.assign(titulo.style, { fontSize: '13px', opacity: '0.6', letterSpacing: '0.08em' });
		titulo.textContent = 'MODO DE ECONOMIA DE ENERGIA';

		const timer = document.createElement('div');
		Object.assign(timer.style, {
			fontSize: 'clamp(32px, 8vw, 56px)',
			fontVariantNumeric: 'tabular-nums',
			fontWeight: '600'
		});

		const resumo = document.createElement('div');
		Object.assign(resumo.style, { fontSize: '14px', opacity: '0.85', lineHeight: '1.7' });

		const botao = document.createElement('button');
		botao.type = 'button';
		botao.textContent = 'Voltar a jogar';
		Object.assign(botao.style, {
			marginTop: '16px',
			padding: '10px 28px',
			fontSize: '14px',
			fontWeight: '600',
			color: '#0a0a0a',
			background: '#e8c76a',
			border: 'none',
			borderRadius: '6px',
			cursor: 'pointer'
		});
		botao.addEventListener('click', () => {
			if (onVoltar) onVoltar();
		});

		const rodape = document.createElement('div');
		Object.assign(rodape.style, { fontSize: '12px', opacity: '0.5', marginTop: '4px' });
		rodape.textContent = 'Clique em "Voltar a jogar" quando quiser retomar — olhar a aba sozinho não sai do modo.';

		overlay.append(titulo, timer, resumo, botao, rodape);
		document.body.appendChild(overlay);

		function textoDoTimer(ms) {
			const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
			const h = String(Math.floor(total / 3600)).padStart(2, '0');
			const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
			const s = String(total % 60).padStart(2, '0');
			return `${h}:${m}:${s}`;
		}

		function atualizar(stats) {
			timer.textContent = textoDoTimer(stats?.restanteMs);
			const expBase = Math.round(Number(stats?.expBase) || 0).toLocaleString('pt-BR');
			const expClasse = Math.round(Number(stats?.expClasse) || 0).toLocaleString('pt-BR');
			const abates = Math.round(Number(stats?.abates) || 0).toLocaleString('pt-BR');
			const itens = Math.round(Number(stats?.itensTotal) || 0).toLocaleString('pt-BR');
			resumo.textContent = `EXP base +${expBase} · EXP classe +${expClasse} · Mobs mortos: ${abates} · Itens: ${itens}`;
		}

		atualizar({ restanteMs });

		return {
			atualizar,
			remove: () => overlay.remove()
		};
	}

	/**
	 * Prompt a message to the user
	 *
	 * @param {string} message to show
	 * @param {string} button ok
	 * @param {string} button cancel
	 * @param {function} callback when ok is pressed
	 * @param {function} callback when cancel is pressed
	 */
	static showPromptBox(text, btn_yes, btn_no, onYes, onNo) {
		const WinPrompt = this.getComponent('WinPopup').clone('WinPrompt');
		WinPrompt.riAnimaJanela = true; // entra/sai com a animacao unica (Fase 3)

		WinPrompt.init = function Init() {
			this.draggable();
			const root = this._shadow;

			root.querySelector('.text').textContent = text;
			Object.assign(this._host.style, _popupPosition());

			const btnsContainer = root.querySelector('.btns');

			/*
			 * RAGIDLE (27/08/2026): o ROTULO em texto entra SEMPRE, e em
			 * portugues. `_createButton` ja aceitava o terceiro argumento (e o
			 * proprio comentario dele avisa: "sem rotulo, vira um retangulo
			 * mudo") — so que esta caixa nunca o passava, confiando no bitmap
			 * `btn_ok.bmp`/`btn_cancel.bmp`... que NAO existe no GRF LATAM
			 * deste projeto. Medido com a troca a dois em 27/08: o convite
			 * "(Analista) requests a deal" chegava com DOIS retangulos mudos —
			 * aceitar era adivinhar. O CSS do WinPopup ja esperava o texto
			 * DOM (WinPopup.css:90-93).
			 */
			btnsContainer.appendChild(
				_createButton(btn_yes, () => {
					WinPrompt.remove();
					if (onYes) onYes();
				}, _rotuloDeBotao(btn_yes))
			);

			btnsContainer.appendChild(
				_createButton(btn_no, () => {
					WinPrompt.remove();
					if (onNo) onNo();
				}, _rotuloDeBotao(btn_no))
			);
		};

		WinPrompt.append();
		return WinPrompt;
	}

	/**
	 * A contagem de 5s do "Dormir" (D-1381, 13/09/2026) — pedido do dono:
	 * *"aparece um timer de 5 segundos dizendo que o sistema de caça offline
	 * será iniciado"*. Generico o bastante para qualquer contagem que precise
	 * de um botao de cancelar e de disparar algo so quando chega a zero — o
	 * MESMO padrao de contagem que `registrar-sw.js` ja usa no aviso de versao
	 * nova (D-1380), aqui como janela em vez de rodape.
	 *
	 * @param {string} texto a frase antes do numero (ex.: "Iniciando o sono em")
	 * @param {number} segundos quantos segundos contar
	 * @param {function(): void} aoZerar chamado quando a contagem chega a zero — a janela ja fechou
	 * @param {string} [avisoExtra] linha fixa abaixo da contagem (D-1386 — o "Dormir"
	 *   usa pra avisar "pode fechar a aba" ja aqui, antes do pacote sair, e nao so
	 *   na tela final de "Dormindo..."). Vazio por padrao: nenhum outro chamador
	 *   existia ate aqui, entao isto nao muda comportamento de ninguem
	 * @returns {{ cancelar: function(): void }} para o chamador cancelar de fora (ex.: a janela fechou)
	 */
	static showContagemRegressiva(texto, segundos, aoZerar, avisoExtra = '') {
		const WinContagem = this.getComponent('WinPopup').clone('WinContagem');
		WinContagem.riAnimaJanela = true;
		let overlay;
		let timer = null;
		let restante = Math.max(1, Math.floor(segundos));
		let zerada = false;

		function textoDaContagem() {
			const base = `${texto} ${restante}...`;
			return avisoExtra ? `${base}\n${avisoExtra}` : base;
		}

		function encerrar() {
			if (timer) clearInterval(timer);
			timer = null;
			overlay.remove();
			WinContagem.remove();
		}

		WinContagem.init = function Init() {
			const root = this._shadow;
			root.querySelector('.text').textContent = textoDaContagem();
			Object.assign(this._host.style, _popupPosition());

			root.querySelector('.btns').appendChild(
				_createButton(
					'cancel',
					() => {
						encerrar();
					},
					'Cancelar'
				)
			);

			timer = setInterval(() => {
				restante -= 1;
				if (restante <= 0) {
					zerada = true;
					encerrar();
					aoZerar();
					return;
				}
				const el = root.querySelector('.text');
				if (el) el.textContent = textoDaContagem();
			}, 1000);
		};

		WinContagem.onKeyDown = function OnKeyDown(event) {
			event.stopImmediatePropagation();
			if (event.which === KEYS.ESCAPE) {
				encerrar();
			}
		};

		overlay = _createOverlay();
		WinContagem.onAppend = _prioritizeKeyDown;
		WinContagem.append();

		return {
			cancelar() {
				if (!zerada) encerrar();
			}
		};
	}

	/**
	 * Reload CSS of a component
	 * @param {string} componentName
	 * @param {string} newCssText
	 */
	static reloadCSS(componentName, newCssText) {
		GUIComponent.reloadCSS(componentName, newCssText);
	}
}
/**
 * Export
 */
export default UIManager;
