/**
 * A textura de um efeito e carregada UMA vez por nome, e nao uma vez por efeito
 * (13/09/2026). Ver `src/Renderer/Effects/texturaDeEfeito.js`.
 *
 * Medido antes do conserto (`diag-origem-das-texturas`): as texturas vivas na
 * GPU cresciam ~75 por minuto de caca, sem patamar. `TwoDEffect` e
 * `ThreeDEffect` subiam uma textura NOVA a cada efeito criado e o `free()`
 * nunca a apagava.
 *
 * O carregador e injetado: o de verdade passa pelo `Client.loadFile` e pelo
 * `WebGL.texture`, que o jsdom nao tem.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { esquecerTexturasDeEfeito, texturaDeEfeito } from 'Renderer/Effects/texturaDeEfeito.js';

/** Um carregador falso: guarda os pedidos e deixa o teste decidir quando cada um termina. */
function carregadorFalso() {
	const pedidos = [];
	const carregar = (gl, nome, pronto) => pedidos.push({ nome, pronto });
	const terminar = (i, textura) => pedidos[i].pronto(textura);
	return { carregar, pedidos, terminar };
}

const GL = {};

beforeEach(() => esquecerTexturasDeEfeito());

describe('texturaDeEfeito', () => {
	it('mil efeitos com a mesma imagem carregam a imagem UMA vez', () => {
		const { carregar, pedidos, terminar } = carregadorFalso();
		const recebidas = [];
		texturaDeEfeito(GL, 'fogo.tga', t => recebidas.push(t), carregar);
		terminar(0, 'TEXTURA-DO-FOGO');
		for (let i = 0; i < 999; i++) {
			texturaDeEfeito(GL, 'fogo.tga', t => recebidas.push(t), carregar);
		}
		expect(pedidos).toHaveLength(1);
		expect(recebidas).toHaveLength(1000);
		expect(new Set(recebidas)).toEqual(new Set(['TEXTURA-DO-FOGO']));
	});

	it('quem pediu ENQUANTO a imagem carregava recebe a mesma textura quando ela chega', () => {
		const { carregar, pedidos, terminar } = carregadorFalso();
		const recebidas = [];
		texturaDeEfeito(GL, 'gelo.tga', t => recebidas.push(['a', t]), carregar);
		texturaDeEfeito(GL, 'gelo.tga', t => recebidas.push(['b', t]), carregar);
		expect(pedidos).toHaveLength(1);
		expect(recebidas).toHaveLength(0);
		terminar(0, 'TEXTURA-DO-GELO');
		expect(recebidas).toEqual([
			['a', 'TEXTURA-DO-GELO'],
			['b', 'TEXTURA-DO-GELO']
		]);
	});

	it('imagens diferentes sao texturas diferentes', () => {
		const { carregar, pedidos, terminar } = carregadorFalso();
		const recebidas = {};
		texturaDeEfeito(GL, 'a.bmp', t => (recebidas.a = t), carregar);
		texturaDeEfeito(GL, 'b.bmp', t => (recebidas.b = t), carregar);
		terminar(0, 'A');
		terminar(1, 'B');
		expect(pedidos.map(p => p.nome)).toEqual(['a.bmp', 'b.bmp']);
		expect(recebidas).toEqual({ a: 'A', b: 'B' });
	});

	it('esquecer (perda de contexto) faz a proxima pedida carregar de novo', () => {
		const { carregar, pedidos, terminar } = carregadorFalso();
		texturaDeEfeito(GL, 'luz.tga', () => {}, carregar);
		terminar(0, 'VELHA');
		esquecerTexturasDeEfeito();
		texturaDeEfeito(GL, 'luz.tga', () => {}, carregar);
		expect(pedidos).toHaveLength(2);
	});
});
