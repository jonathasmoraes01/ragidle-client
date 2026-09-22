/**
 * O OBSERVADOR DA BARRA DE ROLAGEM NAO VAZA (F11, auditoria de 22/09/2026).
 *
 * `GUIComponent.append()` chama `_setupScrollbars()`, que cria um
 * `MutationObserver` e o guarda em `__scrollbarObserver` — SOBRESCREVENDO o
 * anterior sem desconecta-lo. `remove()` so desconecta o ultimo. O
 * `ItemObtain` e anexado de novo a cada item pego; com a aba oculta o aviso
 * nunca sai (o timer anda no laco de desenho), e cada item deixava um
 * observador vivo sobre o mesmo DOM: milhares numa noite, com custo que cresce
 * ao quadrado porque todos disparam a cada `set()`.
 *
 * E o `PainelComandoIdle` guardava o proprio `append()` com `__appended`, um
 * campo que ninguem escreve — o `GUIComponent` usa `__active`. A guarda nunca
 * valia: todo painel depois do primeiro reanexava (e vazava um observador), e o
 * `remove()` do fechamento nunca rodava.
 *
 * Le o fonte sem comentarios, como `rolagemNativaNoDedo.test.js`: o
 * `GUIComponent` so existe montado com folha de estilo e layout, que o jsdom
 * nao faz.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function semComentario(texto) {
	return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const GUI = semComentario(readFileSync('src/UI/GUIComponent.js', 'utf8'));
const PAINEL = semComentario(readFileSync('src/UI/Components/PainelComandoIdle/PainelComandoIdle.js', 'utf8'));

describe('o observador da barra de rolagem nao vaza (F11)', () => {
	it('o anterior e DESCONECTADO antes de criar outro', () => {
		const inicio = GUI.indexOf('_setupScrollbars() {');
		expect(inicio).toBeGreaterThan(-1);
		const corpo = GUI.slice(inicio, GUI.indexOf('self.__scrollbarObserver = observer;', inicio));
		const desconecta = corpo.indexOf('__scrollbarObserver.disconnect()');
		const cria = corpo.indexOf('new MutationObserver(');
		expect(desconecta, 'o observador anterior nao e desconectado').toBeGreaterThan(-1);
		expect(cria).toBeGreaterThan(desconecta);
	});

	it('o PainelComandoIdle guarda com o campo que EXISTE (__active), e nao com __appended', () => {
		expect(PAINEL).not.toContain('__appended');
		expect(PAINEL).toContain('PainelComandoIdle.__active');
	});
});
