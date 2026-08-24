/**
 * A TELA QUE FICAVA BRANCA (OU VERDE) NO ZOOM OUT (D-538).
 *
 * Queixa do dono, jogando: "ao dar zoom out a tela fica branca, verde,
 * depende do mapa".
 *
 * Depende do mapa porque a cor E do mapa. `Ground.fs` faz
 * `fogFactor = smoothstep(uFogNear, uFogFar, depth)` e mistura `uFogColor`
 * por esse fator; com `uFogFar` fixo, afastar a camera joga o chao inteiro
 * para depois do limite, o fator satura em 1 e sobra a cor da nevoa PURA.
 *
 * Os numeros abaixo sao os de `data/fogparametertable.txt` do cliente
 * instalado, LIDOS e nao inventados — `near`/`far` ja multiplicados por 240
 * como `MapRenderer.setMap` faz.
 */

import { describe, expect, it } from 'vitest';
import { nevoaNoZoom, ZOOM_DE_REFERENCIA } from 'Renderer/nevoaNoZoom.js';

/** `data/fogparametertable.txt`, com o `* 240` do carregador aplicado. */
const MAPAS = {
	// 0.25 / 0.6 / 0xffBAFF77 — o verde da queixa
	prt_fild08: { near: 0.25 * 240, far: 0.6 * 240, cor: '#BAFF77' },
	// 0.23 / 0.9 / 0xffffffff — o branco da queixa
	prontera: { near: 0.23 * 240, far: 0.9 * 240, cor: '#ffffff' }
};

/** `Camera.js`: `altitudeRange` 65, `MAX_ZOOM` 5. */
const ZOOM_MAXIMO = 65 * 5;

/** `Camera.js`: `mat4.translateZ(matrix, (altitudeFrom - zoom) / 2)`. */
const profundidadeDaCamera = zoom => zoom / 2;

describe('o defeito, com os numeros da tabela do cliente', () => {
	it('prt_fild08: no zoom maximo a camera passava do fim da nevoa (tela verde)', () => {
		const base = MAPAS.prt_fild08;
		expect(base.far).toBeCloseTo(144, 5);
		expect(profundidadeDaCamera(ZOOM_MAXIMO)).toBeGreaterThan(base.far);
	});

	it('prontera: a camera chegava perto o bastante para lavar de branco', () => {
		const base = MAPAS.prontera;
		// Nao ultrapassa, mas o smoothstep ja esta quase no fim: o que sobra
		// de cor do chao e residual.
		const p = profundidadeDaCamera(ZOOM_MAXIMO);
		const t = (p - base.near) / (base.far - base.near);
		expect(t).toBeGreaterThan(0.6);
	});
});

describe('a nevoa acompanhando a camera', () => {
	it('no zoom PADRAO nada muda — a aparencia de cada mapa e a de antes', () => {
		for (const base of Object.values(MAPAS)) {
			const ajustada = nevoaNoZoom(base, ZOOM_DE_REFERENCIA);
			expect(ajustada.near).toBeCloseTo(base.near, 10);
			expect(ajustada.far).toBeCloseTo(base.far, 10);
		}
	});

	it('no zoom MAXIMO a camera fica dentro da nevoa nos dois mapas', () => {
		const p = profundidadeDaCamera(ZOOM_MAXIMO);
		for (const [nome, base] of Object.entries(MAPAS)) {
			const ajustada = nevoaNoZoom(base, ZOOM_MAXIMO);
			expect(ajustada.far, `${nome} ainda satura`).toBeGreaterThan(p);
		}
	});

	it('aproximar a camera NAO adianta a nevoa (o fator nunca desce de 1)', () => {
		const base = MAPAS.prontera;
		const ajustada = nevoaNoZoom(base, 10);
		expect(ajustada.far).toBeCloseTo(base.far, 10);
	});

	it('a proporcao entre perto e longe e preservada — e bruma, nao parede', () => {
		const base = MAPAS.prt_fild08;
		const ajustada = nevoaNoZoom(base, ZOOM_MAXIMO);
		expect(ajustada.far / ajustada.near).toBeCloseTo(base.far / base.near, 10);
	});
});
