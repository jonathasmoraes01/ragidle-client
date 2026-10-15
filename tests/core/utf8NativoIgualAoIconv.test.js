/**
 * O UTF-8 NATIVO TEM DE SER O MESMO DO ICONV (auditoria de desempenho, 15/10/2026).
 *
 * `CodepageManager.decode(bytes, 'utf-8')` (todo `readString` dos pacotes,
 * inclusive o LOGIN) passou a decodificar pelo `TextDecoder` nativo em vez do
 * iconv-lite em JS puro. Este arquivo e o ORACULO: para milhares de entradas
 * (validas, invalidas, truncadas, com BOM, com U+FFFD legitimo, CP949, lixo),
 * a saida nova tem de ser IGUAL, caractere a caractere, a do caminho antigo
 * (copiado aqui literalmente: iconv utf-8 e, com qualquer U+FFFD, o charset
 * antigo).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import iconv from 'Vendors/iconv-lite.js';
import CodepageManager from 'Utils/CodepageManager.js';

/** O caminho ANTIGO, literal (o `smartDecode` de antes de 15/10/2026). */
function decodificarComoAntes(bytes, fallback) {
	const utf8 = iconv.decode(bytes, 'utf-8');
	if (!/�/.test(utf8)) {
		return utf8;
	}
	return iconv.decode(bytes, fallback);
}

/** PRNG semeado (mulberry32): a mesma bateria em toda corrida. */
function prng(semente) {
	let a = semente >>> 0;
	return function () {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function inteiro(r, n) {
	return Math.floor(r() * n);
}

function textoAleatorio(r) {
	const faixas = [
		[0x20, 0x7e],
		[0xa0, 0x2ff],
		[0x370, 0x52f],
		[0xac00, 0xd7a3], // hangul
		[0x3040, 0x30ff], // kana
		[0x4e00, 0x9fff], // cjk
		[0x1f300, 0x1faff] // emoji (astral)
	];
	let s = '';
	const n = inteiro(r, 40);
	for (let i = 0; i < n; i++) {
		const [de, ate] = faixas[inteiro(r, faixas.length)];
		s += String.fromCodePoint(de + inteiro(r, ate - de + 1));
	}
	return s;
}

const ESQUISITOS = [
	[],
	[0xef, 0xbb, 0xbf], // so o BOM
	[0xef, 0xbb, 0xbf, 0x41, 0x42], // BOM + texto
	[0x41, 0xef, 0xbb, 0xbf, 0x42], // BOM no meio (nao e tirado)
	[0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf], // dois BOMs
	[0xef, 0xbf, 0xbd], // U+FFFD legitimo
	[0x41, 0xef, 0xbf, 0xbd, 0x42],
	[0xc0, 0x80], // overlong
	[0xe0, 0x80, 0x80],
	[0xf0, 0x80, 0x80, 0x80],
	[0xed, 0xa0, 0x80], // surrogate codificado
	[0xed, 0xbf, 0xbf],
	[0xf4, 0x90, 0x80, 0x80], // acima de U+10FFFF
	[0xf8, 0x88, 0x80, 0x80, 0x80],
	[0xe4, 0xbd], // truncado no fim
	[0xf0, 0x9f, 0x98], // emoji truncado
	[0x80],
	[0xbf, 0x41],
	[0xc2],
	[0xff, 0xfe, 0x41, 0x00], // BOM de UTF-16
	[0x00, 0x41]
];

function bateria() {
	const r = prng(20261015);
	const entradas = ESQUISITOS.map(b => Uint8Array.from(b));
	for (let i = 0; i < 1500; i++) {
		// texto valido
		entradas.push(Uint8Array.from(iconv.encode(textoAleatorio(r), 'utf-8')));
	}
	for (let i = 0; i < 500; i++) {
		// texto valido com BOM, com U+FFFD legitimo no meio, ou truncado
		const base = Array.from(iconv.encode(textoAleatorio(r), 'utf-8'));
		const tipo = inteiro(r, 3);
		if (tipo === 0) base.unshift(0xef, 0xbb, 0xbf);
		else if (tipo === 1) base.splice(inteiro(r, base.length + 1), 0, 0xef, 0xbf, 0xbd);
		else if (base.length > 0) base.length = inteiro(r, base.length);
		entradas.push(Uint8Array.from(base));
	}
	for (let i = 0; i < 1000; i++) {
		// CP949 (o charset antigo dos nomes coreanos) e windows-1252
		const charset = i % 2 === 0 ? 'windows-949' : 'windows-1252';
		entradas.push(Uint8Array.from(iconv.encode(textoAleatorio(r), charset)));
	}
	for (let i = 0; i < 2000; i++) {
		// lixo puro
		const n = inteiro(r, 48);
		const b = new Uint8Array(n);
		for (let j = 0; j < n; j++) b[j] = inteiro(r, 256);
		entradas.push(b);
	}
	for (let i = 0; i < 1000; i++) {
		// valido com UM byte trocado (o caso mais perto do real)
		const b = Uint8Array.from(iconv.encode(textoAleatorio(r), 'utf-8'));
		if (b.length > 0) b[inteiro(r, b.length)] = inteiro(r, 256);
		entradas.push(b);
	}
	return entradas;
}

function hex(bytes) {
	return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(' ');
}

describe('o UTF-8 nativo e IGUAL ao caminho antigo (oraculo)', () => {
	const entradas = bateria();

	for (const charset of ['windows-949', 'windows-1252']) {
		it(`${entradas.length} entradas, charset antigo ${charset}`, () => {
			CodepageManager.setCharset(charset);
			let divergentes = 0;
			const exemplos = [];
			for (const bytes of entradas) {
				const novo = CodepageManager.decode(bytes, 'utf-8');
				const antigo = decodificarComoAntes(bytes, charset);
				if (novo !== antigo) {
					divergentes++;
					if (exemplos.length < 5) exemplos.push(hex(bytes));
				}
			}
			expect(exemplos).toEqual([]);
			expect(divergentes).toBe(0);
		});
	}

	it('a subvisao de um buffer maior (como o BinaryReader entrega) tambem', () => {
		CodepageManager.setCharset('windows-949');
		const grande = Uint8Array.from(iconv.encode('xx한국어 텍스트yy', 'utf-8'));
		const meio = grande.subarray(2, grande.length - 2);
		expect(CodepageManager.decode(meio, 'utf-8')).toBe(decodificarComoAntes(meio, 'windows-949'));
		expect(CodepageManager.decode(meio, 'utf-8')).toBe('한국어 텍스트');
	});
});

describe('o caminho rapido e o nativo, e o iconv fica de reserva', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('UTF-8 valido nao passa pelo iconv', () => {
		CodepageManager.setCharset('windows-949');
		const espiao = vi.spyOn(iconv, 'decode');
		const bytes = Uint8Array.from(iconv.encode('{"nome":"Poção Vermelha"}', 'utf-8'));
		espiao.mockClear();
		expect(CodepageManager.decode(bytes, 'utf-8')).toBe('{"nome":"Poção Vermelha"}');
		expect(espiao).not.toHaveBeenCalled();
	});

	it('sem TextDecoder no ambiente, decodifica pelo iconv como antes', async () => {
		vi.stubGlobal('TextDecoder', undefined);
		vi.resetModules();
		const { default: Cm } = await import('Utils/CodepageManager.js');
		const { default: iconvDoModulo } = await import('Vendors/iconv-lite.js');
		Cm.setCharset('windows-949');
		const espiao = vi.spyOn(iconvDoModulo, 'decode');
		const bytes = Uint8Array.from(iconvDoModulo.encode('Prontera 한', 'utf-8'));
		expect(Cm.decode(bytes, 'utf-8')).toBe('Prontera 한');
		expect(espiao).toHaveBeenCalledWith(bytes, 'utf-8');
	});

	it('TextDecoder que lanca nao derruba a decodificacao (D-993: e o caminho do login)', async () => {
		vi.stubGlobal(
			'TextDecoder',
			class {
				decode() {
					throw new Error('quebrado');
				}
			}
		);
		vi.resetModules();
		const { default: Cm } = await import('Utils/CodepageManager.js');
		const { default: iconvDoModulo } = await import('Vendors/iconv-lite.js');
		Cm.setCharset('windows-949');
		const bytes = Uint8Array.from(iconvDoModulo.encode('Alberta', 'utf-8'));
		expect(Cm.decode(bytes, 'utf-8')).toBe('Alberta');
	});
});
