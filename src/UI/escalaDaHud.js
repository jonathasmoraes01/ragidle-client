/**
 * UI/escalaDaHud.js — A HUD DIMINUI JUNTO COM A JANELA (D-934, 05/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O PEDIDO
 * ═══════════════════════════════════════════════════════════════════════
 * Palavras do dono, com um print de uma janela pequena junto: *"a HUD não pode
 * ficar assim, um em cima do outro, ela deve diminuir junto com a janela."*
 *
 * O print mostrava o navegador espremido a algo como 580x250, com o painel de
 * personagem por cima do cluster de essenciais, o botão de caça por cima do
 * menu e a doca por cima de tudo.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE AS FAIXAS SOZINHAS NÃO RESOLVIAM
 * ═══════════════════════════════════════════════════════════════════════
 * A camada de D-929/D-930 REARRANJA: ela move o cluster, empilha o rodapé,
 * encolhe a doca e o painel. Isso resolve os aparelhos REAIS — nenhum celular
 * tem 250px de altura, e a matriz de doze resoluções passa limpa.
 *
 * Mas uma janela de navegador não tem tamanho mínimo. Abaixo de qualquer
 * arranjo possível, a soma das peças ainda é maior que a tela — e rearranjar
 * peças que não cabem só troca qual delas fica por cima. A partir daí a única
 * saída é a peça ficar MENOR, que é exatamente o que o dono escreveu.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DEDO NÃO ENCOLHE — E É POR ISSO QUE A REGRA TEM DOIS LADOS
 * ═══════════════════════════════════════════════════════════════════════
 * `pointer: coarse` (celular, tablet) fica em escala 1, SEMPRE. Encolher ali
 * levaria os alvos abaixo dos 44px que a frente inteira acabou de garantir —
 * seria desfazer o conserto com o conserto. Nesses aparelhos quem responde é o
 * rearranjo, e ele basta: a tela nunca é menor que o próprio aparelho.
 *
 * No MOUSE (`pointer: fine`) o piso tátil não vale, o cursor acerta 12px sem
 * esforço, e a janela pode ter qualquer tamanho. Ali a HUD encolhe.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * `zoom`, E NÃO `transform: scale()`
 * ═══════════════════════════════════════════════════════════════════════
 * `transform` desenha menor mas NÃO muda o layout: o elemento continua
 * ocupando a caixa original, e `position: fixed` continua ancorando pela caixa
 * antiga — dois painéis encolhidos continuariam se cruzando exatamente como
 * antes. Seria o print do dono de novo, só que em letra miúda.
 *
 * `zoom` escala o LAYOUT: a caixa, os `top/right/bottom/left`, o `font-size` e
 * o teste de acerto do ponteiro, tudo junto. É a única propriedade que faz o
 * que a frase "diminuir junto com a janela" descreve.
 *
 * Ele também mantém honestos os três componentes que PUBLICAM geometria
 * (`--hud-basic-fundo`, `--hud-cluster-topo`, `--hud-chat-altura`): eles medem
 * por `getBoundingClientRect`, que já devolve o valor com o zoom aplicado, em
 * coordenadas da viewport. Com `transform` isso também valeria, mas o layout
 * por trás estaria mentindo.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * OS DOIS NÚMEROS DA CONTA, E DE ONDE ELES SAEM
 * ═══════════════════════════════════════════════════════════════════════
 * `1024 x 768` é o menor tamanho em que a HUD cabe sem nenhuma sobreposição —
 * medido, não escolhido: é uma das doze telas da matriz desta frente, e ela
 * passa com zero cruzamentos. Acima disso a escala é 1 e nada muda.
 *
 * O piso de `0.5` é o ponto em que a HUD ainda é legível num monitor. Abaixo
 * dele o rearranjo assume o resto: em 580x250, escala 0.5 deixa a pilha do
 * rodapé em ~161px de altura numa tela de 250 — cabe, com folga.
 */

/** O menor tamanho em que a HUD cabe inteira, medido na matriz desta frente. */
const LARGURA_BASE = 1024;
const ALTURA_BASE = 768;
/** Abaixo disto a letra deixa de ser legível; daí para baixo quem age é o rearranjo. */
const PISO = 0.5;

/**
 * A BANDEIRA DE ROLLOUT (D-937, 05/09/2026).
 *
 * Pedido do dono na Fase 5: *"Rollout atras de flag, com volta imediata caso
 * quebre para quem ja joga."*
 *
 * `enableHudAdaptavel` vem do `ROConfig`, que e a uniao de `Config.js` com
 * `Config.local.js` — e o `Config.local.js` e publicado como ARQUIVO SEPARADO,
 * com `Cache-Control: no-cache` (`applications/deploy/vercel.json`). Trocar
 * uma linha nele e publicar de novo devolve o jogo ao layout anterior **sem
 * rebuild e sem esperar cache** — e a volta mais rapida que este pipeline
 * tem.
 *
 * O QUE ELA DESLIGA: as tres camadas de 05/09 que mudam a APARENCIA —
 * o `zoom` (D-934), a janela virando painel de tela cheia (D-932) e as
 * bordas seguras (D-936).
 *
 * O QUE ELA NAO DESLIGA, de proposito: as faixas de largura e altura
 * (D-929/D-930). Elas sao a continuacao do mecanismo de 31/08 e so agem em
 * tela pequena, onde o layout anterior estava medidamente quebrado —
 * desliga-las devolveria o defeito em vez de desfazer o conserto.
 *
 * A marca `ri-hud-classica` no `<html>` e o que o CSS le, e ela e a mesma
 * chave que a `pilhaDeJanelas` consulta antes de marcar uma janela como
 * painel.
 */
export const MARCA_CLASSICA = 'ri-hud-classica';

let _ligado = false;
let _ultima = null;

/**
 * A camada adaptavel de 05/09 esta LIGADA? (D-937)
 *
 * Falha para LIGADO: sem o `Configs` (um teste, uma casca minima), o jogo
 * roda com o layout novo, que e o estado normal. Uma bandeira que falhasse
 * para desligado transformaria qualquer erro de carregamento numa volta
 * silenciosa ao layout velho — e ninguem descobriria pelo sintoma.
 */
export function ehAdaptavel() {
	try {
		const cfg = window.ROConfig;
		if (cfg && cfg.enableHudAdaptavel === false) return false;
	} catch (erro) {
		/* casca sem config: segue ligado */
	}
	return true;
}

/** O ponteiro deste aparelho é grosso (dedo)? */
function ehDedo() {
	if (typeof window === 'undefined' || !window.matchMedia) {
		return false;
	}
	return window.matchMedia('(pointer: coarse)').matches;
}

/** A escala que a janela atual pede. */
export function escalaAtual(largura, altura) {
	if (ehDedo()) {
		return 1;
	}
	const w = largura || window.innerWidth || 0;
	const h = altura || window.innerHeight || 0;
	if (!w || !h) {
		return 1;
	}
	const bruta = Math.min(w / LARGURA_BASE, h / ALTURA_BASE, 1);
	return Math.max(PISO, Math.round(bruta * 100) / 100);
}

/**
 * Aplica a escala. Idempotente e barata: sai cedo quando o número não mudou,
 * porque isto roda no caminho de `resize`, que dispara às dezenas por segundo
 * enquanto alguém arrasta a borda da janela.
 */
export function aplicar(doc) {
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if (!d || !d.documentElement) {
		return 1;
	}
	const escala = escalaAtual();
	if (escala === _ultima) {
		return escala;
	}
	_ultima = escala;

	/* O token vale para quem quiser ler a escala em CSS (a HUD já tem
	   consumidores dele desde D-929) — e ele continua sendo a fonte da verdade
	   mesmo onde o `zoom` não é aplicado. */
	d.documentElement.style.setProperty('--ui-escala', String(escala));

	/*
	 * O `zoom` vai em TODO host de componente de UI, e não numa lista de ids.
	 * Uma lista envelheceria no dia em que alguém somasse um painel — e o
	 * sintoma seria um pedaço da HUD que não encolhe junto, que é pior do que
	 * nenhum encolher.
	 *
	 * `data-gui-component` é a marca que TODO `GUIComponent` já põe no host
	 * (`GUIComponent.js:238`), e é a mesma que o predicado de clique/toque usa
	 * para saber o que é UI (`Controls/ehEventoDaUI.js`).
	 */
	const hosts = d.querySelectorAll('[data-gui-component]');
	for (let i = 0; i < hosts.length; i++) {
		hosts[i].style.zoom = escala === 1 ? '' : String(escala);
	}
	return escala;
}

/**
 * Liga o observador. O `resize` do `Renderer` já existe e já tem debounce de
 * 500ms, mas ele serve ao canvas: para a HUD, meio segundo de atraso enquanto
 * o dono arrasta a borda da janela é meio segundo de sobreposição na tela.
 * Aqui a resposta é imediata, e o custo é uma leitura de `innerWidth` e uma
 * comparação — a varredura de hosts só roda quando o número muda.
 */
export function ligar(doc) {
	if (_ligado || typeof window === 'undefined') {
		return;
	}
	_ligado = true;

	/* A bandeira e lida UMA vez, no boot: ela e de rollout, e nao de
	   preferencia — mudar de ideia no meio da sessao nao e caso de uso, e
	   reavaliar a cada resize custaria uma leitura de config por quadro. */
	const alvoDoc = doc || document;
	if (!ehAdaptavel()) {
		alvoDoc.documentElement.classList.add(MARCA_CLASSICA);
		return;
	}
	const alvo = doc || document;
	const responder = () => aplicar(alvo);
	window.addEventListener('resize', responder);
	window.addEventListener('orientationchange', responder);
	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', responder);
	}
	/* Um host novo (uma janela aberta pela primeira vez) precisa nascer com a
	   escala vigente. `_ultima` é zerada para a próxima aplicação valer. */
	_ultima = null;
	aplicar(alvo);
}

/** Reaplica ignorando o cache — para quando um host novo entra no documento. */
export function reaplicar(doc) {
	_ultima = null;
	return aplicar(doc);
}

/**
 * DE PIXEL DE VIEWPORT PARA UNIDADE DA HUD.
 *
 * Esta é a conversão que o `zoom` obriga, e ela tem uma armadilha que custou
 * uma sobreposição para aparecer:
 *
 *   - `getBoundingClientRect()` devolve a caixa JÁ COM o zoom aplicado, em
 *     pixels da viewport. Ler dá o número que os olhos veem.
 *   - `element.style.top = '189px'` dentro de um host com `zoom: 0.65` é
 *     interpretado nas unidades DELE, e desenha em 189 × 0,65 = 123.
 *
 * Ler e escrever o mesmo número, portanto, NÃO devolve o elemento ao mesmo
 * lugar. Foi exatamente isso que pôs o rastreador de missões 58px por cima do
 * painel de personagem em 800x500 — medido em 05/09/2026.
 *
 * A convenção desta HUD, daqui para a frente: **toda geometria medida que vira
 * `style` ou custom property passa por aqui.** Como o zoom é o MESMO em todos
 * os hosts, o número convertido é coerente para qualquer consumidor.
 */
export function emUnidadesDaHud(px) {
	const e = escalaAtual();
	return e === 1 ? px : px / e;
}

export default {
	ehAdaptavel,
	MARCA_CLASSICA,
	escalaAtual,
	aplicar,
	ligar,
	reaplicar,
	emUnidadesDaHud,
	LARGURA_BASE,
	ALTURA_BASE,
	PISO,
};
