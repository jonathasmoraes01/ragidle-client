/**
 * UI/giroDoCelular.js
 *
 * O CELULAR DEITADO NAO DESENHA O JOGO — ELE PEDE PARA GIRAR (D-1491, 15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DO DONO, E O NUMERO QUE A MOTIVOU
 * ---------------------------------------------------------------------------
 * *"pode impedir a tela de girar, ok? Vamos manter a visualizacao vertical o
 * tempo inteiro no mobile."*
 *
 * Ele decidiu isso depois de uma medicao: **no celular deitado nao ha layout
 * possivel.** Numa tela de 393px de altura, descontando a base do botao Menu
 * (101px) e a coluna da direita — minimapa mais os botoes de caca, que vao ate
 * 288px do topo (`--hud-td-abaixo-da-coluna`) — sobram **4px** de altura livre.
 * Nao e um numero para ajustar: nao cabe.
 *
 * A `prove:hud-responsiva` confirmou isso nas tres telas deitadas, com o menu
 * aberto: minimapa, botoes de caca e o proprio painel do personagem, todos
 * cobertos. Enquanto o deitado for suportado, ele e fonte permanente de
 * sobreposicao.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UMA TELA, E NAO UMA TRAVA DE ORIENTACAO
 * ---------------------------------------------------------------------------
 * A trava de verdade nao existe no aparelho do dono:
 *
 *   - `screen.orientation.lock()` **nao existe no Safari do iOS**;
 *   - onde existe (Android), so funciona em TELA CHEIA — nunca numa aba comum,
 *     que e como ele estava testando (a barra do Safari aparece no print dele).
 *
 * O manifesto do PWA **ja pede retrato** (`"orientation": "portrait"` com
 * `"display": "fullscreen"`, em `applications/pwa/manifest.webmanifest`), e
 * isso cobre quem INSTALOU o jogo. **Fica por medir se o iOS honra esse campo
 * no PWA instalado** — historicamente o Safari ignorava boa parte do manifesto,
 * e afirmar sem medir no aparelho seria inventar.
 *
 * Entao o que vale em todo lugar e RECUSAR A DESENHAR: a tela abaixo cobre o
 * jogo enquanto o aparelho estiver deitado, e sai sozinha quando ele voltar. Ela
 * nao impede a rotacao — ela declina dela.
 *
 * ---------------------------------------------------------------------------
 * O CRITERIO E TAMANHO, E NAO SO ORIENTACAO — E ISSO E O CUIDADO PRINCIPAL
 * ---------------------------------------------------------------------------
 * **Tablet deitado e legitimo e continua entrando.** Um 1024x768 tambem e dedo
 * e tambem esta deitado, mas la a HUD cabe (esta na matriz da prova e passa).
 * Cortar por "deitado" quebraria o tablet.
 *
 * O corte e o ESPELHO do que `ehCelularEmPe` ja usa: em pe o lado curto e a
 * LARGURA (`max-width: 599px`); deitado, o lado curto vira a ALTURA. Conferido
 * contra a matriz da prova antes de escrever:
 *
 *   | tela | altura | recusa? |
 *   |---|---|---|
 *   | iphone15-deitado-852x393 | 393 | sim |
 *   | iphone-se-deitado-667x375 | 375 | sim |
 *   | android-deitado-915x412 | 412 | sim |
 *   | tablet-1024x768 | 768 | **nao** |
 *   | janela-580x250 (mouse) | 250 | **nao** — `pointer: fine` |
 *
 * A ultima linha importa: uma janela de navegador baixa no computador NAO pode
 * receber "gire o celular". Quem separa e o `pointer: coarse`.
 */

/**
 * O criterio, escrito UMA vez — como o de `ehCelularEmPe`.
 *
 * As tres pernas sao as mesmas de la, com a do lado curto espelhada:
 *   - `pointer: coarse` — e um DEDO. Janela de computador baixa nao entra;
 *   - `orientation: landscape` — esta deitado;
 *   - `max-height: 599px` — e um CELULAR, e nao um tablet.
 */
const CRITERIO_DEITADO = '(pointer: coarse) and (orientation: landscape) and (max-height: 599px)';

const ID_DA_TELA = 'ri-gire-o-celular';

/** Este aparelho, agora, e um celular DEITADO? */
export function ehCelularDeitado() {
	if (typeof window === 'undefined' || !window.matchMedia) {
		return false;
	}
	try {
		return window.matchMedia(CRITERIO_DEITADO).matches;
	} catch {
		return false;
	}
}

/** Monta a tela. So chamada quando ela precisa existir. */
function montar(d) {
	const capa = d.createElement('div');
	capa.id = ID_DA_TELA;
	Object.assign(capa.style, {
		position: 'fixed',
		inset: '0',
		background: '#0b0d14',
		color: '#e8e8e8',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '14px',
		padding: '24px',
		boxSizing: 'border-box',
		textAlign: 'center',
		fontFamily: "'Figtree', Arial, 'Liberation Sans', Arimo, sans-serif",
		/*
		 * Acima das outras camadas soltas (a tela preta do sono e a da economia
		 * usam 2000000) e MUITO abaixo do teto do cursor (2147483647,
		 * CursorManager.js) — `tests/ui/cursorAcimaDeTudo.test.js` reprova
		 * qualquer z-index que alcance o dele. Esta tela precisa vencer as
		 * outras: deitado, nenhuma delas e utilizavel.
		 */
		zIndex: '2000010',
		/* Ela ENGOLE o toque: e esse o ponto de recusar a desenhar. */
		pointerEvents: 'auto',
		touchAction: 'none'
	});

	const icone = d.createElement('div');
	icone.textContent = '📱';
	Object.assign(icone.style, {
		fontSize: 'clamp(40px, 12vh, 72px)',
		lineHeight: '1',
		/* O giro e a INSTRUCAO: o icone deitado voltando para a vertical diz o
		   que fazer sem depender de o jogador ler a frase. */
		animation: 'ri-gire 2.4s ease-in-out infinite'
	});

	const estilo = d.createElement('style');
	estilo.textContent =
		'@keyframes ri-gire{0%,45%{transform:rotate(-90deg)}70%,100%{transform:rotate(0deg)}}' +
		'@media (prefers-reduced-motion: reduce){#' +
		ID_DA_TELA +
		' div{animation:none!important}}';

	const titulo = d.createElement('div');
	titulo.textContent = 'Gire o celular';
	Object.assign(titulo.style, { fontSize: 'clamp(20px, 6vh, 28px)', fontWeight: '700' });

	const linha = d.createElement('div');
	linha.textContent = 'O Ragnarok Classic Idle foi feito para a tela em pé.';
	Object.assign(linha.style, { fontSize: '15px', opacity: '0.8', maxWidth: '420px', lineHeight: '1.5' });

	const rodape = d.createElement('div');
	rodape.textContent = 'A caçada continua — nada se perde enquanto você gira.';
	Object.assign(rodape.style, { fontSize: '12px', opacity: '0.5', marginTop: '6px' });

	capa.append(estilo, icone, titulo, linha, rodape);
	d.body.appendChild(capa);
	return capa;
}

/**
 * Poe ou tira a tela, conforme o aparelho.
 *
 * Idempotente e barata: e chamada do mesmo caminho de `resize`/`orientationchange`
 * que a marca da HUD vertical usa (`hudVertical.aplicar`), e sai cedo quando
 * nada mudou. Duplicar os ouvintes num arquivo novo seria a "segunda rota
 * escrita a mao" que este projeto ja pagou varias vezes.
 *
 * @param {Document} [doc]
 * @returns {boolean} se a tela esta na frente agora
 */
export function aplicarTelaDeGiro(doc) {
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if (!d || !d.body) {
		return false;
	}
	const deitado = ehCelularDeitado();
	const existente = d.getElementById(ID_DA_TELA);

	if (deitado && !existente) {
		montar(d);
		return true;
	}
	if (!deitado && existente) {
		existente.remove();
		return false;
	}
	return deitado;
}

export default { ehCelularDeitado, aplicarTelaDeGiro, ID_DA_TELA };
