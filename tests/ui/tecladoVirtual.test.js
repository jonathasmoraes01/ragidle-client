/**
 * O TECLADO DO CELULAR COM O JOGO NUM IFRAME (15/10/2026).
 *
 * Relato: *"quando vai digitar pelo celular o chat buga e fica la em cima"*,
 * no iPhone e no Android, no navegador e no app instalado. A conta antiga media
 * o viewport do PROPRIO iframe, que o teclado nao encolhe - dava zero sempre.
 *
 * O que se prova aqui e a CONTA (o Chromium do Playwright nao abre teclado de
 * sistema): uma formula so para os tres jeitos de o navegador reagir, a janela
 * certa medida, e a pagina de fora devolvida ao zero quando o teclado fecha.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import TecladoVirtual, {
	PISO_DO_TECLADO,
	alturaEscondida,
	janelaQueVeOTeclado,
	medirTeclado,
	publicar
} from 'UI/tecladoVirtual.js';

/** Uma janela de mentira com o que a conta le. */
function janela({ innerHeight, vv, parent, frameTop, scrollY = 0 }) {
	const w = {
		innerHeight,
		visualViewport: vv,
		scrollX: 0,
		scrollY,
		rolagens: [],
		scrollTo(x, y) {
			this.rolagens.push([x, y]);
			this.scrollX = x;
			this.scrollY = y;
		}
	};
	w.parent = parent || w;
	w.frameElement = parent ? { getBoundingClientRect: () => ({ top: frameTop || 0 }) } : null;
	return w;
}

function documento() {
	const props = {};
	return {
		props,
		documentElement: {
			style: {
				setProperty: (k, v) => {
					props[k] = v;
				}
			}
		}
	};
}

beforeEach(() => {
	TecladoVirtual.desligarParaTeste();
});

describe('alturaEscondida - uma formula para os tres navegadores', () => {
	it('sem teclado, nada escondido', () => {
		expect(alturaEscondida({ alturaDoQuadro: 852, topoDoQuadro: 0, topoVisivel: 0, alturaVisivel: 852 })).toBe(0);
	});

	it('iPhone: a area visivel encolhe E desloca (offsetTop)', () => {
		// 852 de quadro, teclado de 352: o iPhone desloca 200 para mostrar o campo.
		expect(alturaEscondida({ alturaDoQuadro: 852, topoDoQuadro: 0, topoVisivel: 200, alturaVisivel: 500 })).toBe(152);
	});

	it('Android que ROLA a pagina de fora: o topo do iframe sobe, e a conta da o mesmo', () => {
		const semRolar = alturaEscondida({ alturaDoQuadro: 852, topoDoQuadro: 0, topoVisivel: 0, alturaVisivel: 500 });
		const rolada = alturaEscondida({ alturaDoQuadro: 852, topoDoQuadro: -150, topoVisivel: 0, alturaVisivel: 500 });
		expect(semRolar).toBe(352);
		// Rolar 150 deixa 150 a mais do quadro a vista: escondem-se 202, e o chat
		// colado nesse fundo aparece no mesmo lugar da tela.
		expect(rolada).toBe(202);
	});

	it('Android que ENCOLHE o layout: o quadro encolhe junto e nada fica escondido', () => {
		expect(alturaEscondida({ alturaDoQuadro: 500, topoDoQuadro: 0, topoVisivel: 0, alturaVisivel: 500 })).toBe(0);
	});

	it('a barra do navegador indo e vindo (abaixo do piso) nao e teclado', () => {
		expect(
			alturaEscondida({ alturaDoQuadro: 852, topoDoQuadro: 0, topoVisivel: 0, alturaVisivel: 852 - PISO_DO_TECLADO })
		).toBe(0);
	});
});

describe('quem mede: a pagina de fora quando o jogo esta num iframe', () => {
	it('com iframe da mesma origem, mede pelo viewport DE FORA', () => {
		const fora = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 500 } });
		const quadro = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 852 }, parent: fora, frameTop: 0 });
		expect(janelaQueVeOTeclado(quadro).de).toBe(fora);
		// O viewport do PROPRIO quadro diz 852 (o teclado nao o encolhe): a conta
		// antiga dava zero aqui. A de agora ve os 352 do teclado.
		expect(medirTeclado(quadro)).toBe(352);
	});

	it('sem iframe (ou de outra origem), mede pelo proprio viewport', () => {
		const solta = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 500 } });
		expect(janelaQueVeOTeclado(solta).de).toBe(solta);
		expect(medirTeclado(solta)).toBe(352);
	});

	it('pagina de fora inacessivel (frameElement lanca) cai no proprio viewport', () => {
		const quadro = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 852 } });
		quadro.parent = {};
		Object.defineProperty(quadro, 'frameElement', {
			get() {
				throw new Error('SecurityError');
			}
		});
		expect(janelaQueVeOTeclado(quadro).de).toBe(quadro);
		expect(medirTeclado(quadro)).toBe(0);
	});
});

describe('publicar', () => {
	it('escreve a altura e o 1/0 de aberto, que o CSS do chat le', () => {
		const fora = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 500 } });
		const quadro = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 852 }, parent: fora });
		const doc = documento();
		publicar(quadro, doc);
		expect(doc.props['--teclado-altura']).toBe('352px');
		expect(doc.props['--teclado-aberto']).toBe('1');
	});

	it('quando o teclado FECHA, a pagina de fora volta ao zero (o "fica la em cima")', () => {
		const fora = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 500 }, scrollY: 150 });
		const quadro = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 852 }, parent: fora, frameTop: -150 });
		const doc = documento();
		publicar(quadro, doc);
		expect(fora.rolagens).toEqual([]);
		// Fechou: a area visivel volta inteira, mas a pagina ficou rolada.
		fora.visualViewport = { offsetTop: 0, height: 852 };
		quadro.frameElement = { getBoundingClientRect: () => ({ top: 0 }) };
		publicar(quadro, doc);
		expect(doc.props['--teclado-aberto']).toBe('0');
		expect(fora.rolagens).toEqual([[0, 0]]);
	});

	it('com o teclado aberto nao rola nada (nao briga com o navegador)', () => {
		const fora = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 500 }, scrollY: 150 });
		const quadro = janela({ innerHeight: 852, vv: { offsetTop: 0, height: 852 }, parent: fora, frameTop: -150 });
		const doc = documento();
		publicar(quadro, doc);
		publicar(quadro, doc);
		expect(fora.rolagens).toEqual([]);
	});
});
