/**
 * `catalogoEmCache.js` sem DOM (D-1850, 30/09/2026): os `mapas` do catalogo
 * guardados com a impressao do servidor, em memoria e no armazenamento do
 * navegador, para a reabertura do Mapa de Caca pedir so o cabecalho.
 */
import { describe, expect, it } from 'vitest';
import {
	CHAVE_DO_CATALOGO_FIXO,
	criarCacheDoCatalogo,
	ehRespostaLeve,
	identidadeDoCatalogo
} from '../../src/UI/Components/HuntMap/catalogoEmCache.js';

function armazenamentoFalso() {
	const dados = new Map();
	return {
		dados,
		getItem: k => (dados.has(k) ? dados.get(k) : null),
		setItem: (k, v) => dados.set(k, String(v)),
		removeItem: k => dados.delete(k)
	};
}

const FIXO = '0123456789ab';
const pagina = (parte, partes, mapas) => JSON.stringify({ v: 3, fixo: FIXO, parte, partes, mapas });
const P1 = pagina(1, 2, [{ mapa: 'a', monstros: [{ mobId: 1, drops: [501] }] }]);
const P2 = pagina(2, 2, [{ mapa: 'b', monstros: [] }]);

describe('ehRespostaLeve', () => {
	it('e leve so com impressao em texto e SEM a chave mapas', () => {
		expect(ehRespostaLeve({ v: 3, fixo: FIXO })).toBe(true);
		expect(ehRespostaLeve({ v: 3, fixo: FIXO, mapas: [] })).toBe(false);
		expect(ehRespostaLeve({ v: 3, fixo: FIXO, mapas: undefined })).toBe(false);
		expect(ehRespostaLeve({ v: 3, mapas: [] })).toBe(false);
		expect(ehRespostaLeve({ v: 3 })).toBe(false);
		expect(ehRespostaLeve({ v: 3, fixo: 12 })).toBe(false);
		expect(ehRespostaLeve(null)).toBe(false);
	});
});

describe('identidadeDoCatalogo', () => {
	const cabecalho = { v: 3, cidade: { mapa: 'prontera' }, nivel: 10, favoritos: ['a'], fixo: FIXO };

	it('o cheio (com parte/partes/mapas) e o leve do mesmo catalogo tem a MESMA identidade', () => {
		const cheio = Object.assign({}, cabecalho, { parte: 1, partes: 2, mapas: [{ mapa: 'a' }, { mapa: 'b' }] });
		const leve = Object.assign({}, cabecalho, { parte: 1, partes: 1, mapas: [{ mapa: 'a' }] });
		expect(identidadeDoCatalogo(cheio)).toBe(identidadeDoCatalogo(leve));
	});

	it('muda com o cabecalho do jogador e com a impressao', () => {
		const base = identidadeDoCatalogo(cabecalho);
		expect(identidadeDoCatalogo(Object.assign({}, cabecalho, { nivel: 11 }))).not.toBe(base);
		expect(identidadeDoCatalogo(Object.assign({}, cabecalho, { favoritos: [] }))).not.toBe(base);
		expect(identidadeDoCatalogo(Object.assign({}, cabecalho, { cacaMedida: { v: 3 } }))).not.toBe(base);
		expect(identidadeDoCatalogo(Object.assign({}, cabecalho, { fixo: 'ffffffffffff' }))).not.toBe(base);
	});

	it('sem impressao (servidor antigo) nao ha identidade: quem chama compara as paginas', () => {
		expect(identidadeDoCatalogo({ v: 3, nivel: 10, mapas: [] })).toBeNull();
		expect(identidadeDoCatalogo(null)).toBeNull();
	});
});

describe('criarCacheDoCatalogo', () => {
	it('sem nada guardado: sem impressao e sem mapas', () => {
		const cache = criarCacheDoCatalogo(armazenamentoFalso());
		expect(cache.impressao()).toBeNull();
		expect(cache.mapasDe(FIXO)).toBeNull();
	});

	it('guardar poe na MEMORIA os mesmos objetos (e nao uma copia)', () => {
		const cache = criarCacheDoCatalogo(armazenamentoFalso());
		const mapas = [{ mapa: 'a' }];
		cache.guardar(FIXO, mapas, P1);
		expect(cache.impressao()).toBe(FIXO);
		expect(cache.mapasDe(FIXO)).toBe(mapas);
		expect(cache.mapasDe('ffffffffffff')).toBeNull();
	});

	it('o texto gravado e a impressao e as paginas cruas; outra pagina (sessao nova) le os mapas na ordem', () => {
		const arm = armazenamentoFalso();
		const primeira = criarCacheDoCatalogo(arm);
		const texto = primeira.guardar(FIXO, [], `${P1}\n${P2}`);
		expect(texto).toBe(`${FIXO}\n${P1}\n${P2}`);
		primeira.gravar(texto);
		expect(arm.getItem(CHAVE_DO_CATALOGO_FIXO)).toBe(texto);

		const sessaoNova = criarCacheDoCatalogo(arm);
		expect(sessaoNova.impressao()).toBe(FIXO);
		const mapas = sessaoNova.mapasDe(FIXO);
		expect(mapas.map(m => m.mapa)).toEqual(['a', 'b']);
		// Os drops voltam como itemId (o que o servidor mandou), nao como nome.
		expect(mapas[0].monstros[0].drops).toEqual([501]);
		// E ficou em memoria: a segunda leitura devolve os MESMOS objetos.
		expect(sessaoNova.mapasDe(FIXO)).toBe(mapas);
	});

	it('impressao sem forma ou mapas sem lista nao guardam nada', () => {
		const cache = criarCacheDoCatalogo(armazenamentoFalso());
		expect(cache.guardar('XYZ', [], P1)).toBeNull();
		expect(cache.guardar(FIXO, null, P1)).toBeNull();
		expect(cache.impressao()).toBeNull();
	});

	it('pagina ilegivel no armazenamento vira "sem mapas", e nao meia lista', () => {
		const arm = armazenamentoFalso();
		arm.setItem(CHAVE_DO_CATALOGO_FIXO, `${FIXO}\n${P1}\n{quebrado`);
		expect(criarCacheDoCatalogo(arm).mapasDe(FIXO)).toBeNull();
		arm.setItem(CHAVE_DO_CATALOGO_FIXO, `${FIXO}\n${JSON.stringify({ v: 3 })}`);
		expect(criarCacheDoCatalogo(arm).mapasDe(FIXO)).toBeNull();
		arm.setItem(CHAVE_DO_CATALOGO_FIXO, FIXO);
		expect(criarCacheDoCatalogo(arm).impressao()).toBeNull();
	});

	it('impressao guardada diferente da pedida nao devolve mapas', () => {
		const arm = armazenamentoFalso();
		arm.setItem(CHAVE_DO_CATALOGO_FIXO, `${FIXO}\n${P1}`);
		expect(criarCacheDoCatalogo(arm).mapasDe('ffffffffffff')).toBeNull();
	});

	it('esquecer apaga as duas camadas', () => {
		const arm = armazenamentoFalso();
		const cache = criarCacheDoCatalogo(arm);
		cache.gravar(cache.guardar(FIXO, [], P1));
		cache.esquecer();
		expect(cache.impressao()).toBeNull();
		expect(arm.getItem(CHAVE_DO_CATALOGO_FIXO)).toBeNull();
	});

	it('armazenamento que LANCA (janela privada, cota) vira "sem cache", sem erro', () => {
		const lanca = {
			getItem: () => {
				throw new Error('bloqueado');
			},
			setItem: () => {
				throw new Error('cota');
			},
			removeItem: () => {
				throw new Error('bloqueado');
			}
		};
		const cache = criarCacheDoCatalogo(lanca);
		expect(cache.impressao()).toBeNull();
		expect(() => cache.gravar(`${FIXO}\n${P1}`)).not.toThrow();
		expect(() => cache.esquecer()).not.toThrow();
		// A memoria continua valendo sem o armazenamento.
		const mapas = [{ mapa: 'a' }];
		cache.guardar(FIXO, mapas, P1);
		expect(cache.mapasDe(FIXO)).toBe(mapas);
		expect(criarCacheDoCatalogo(null).impressao()).toBeNull();
	});
});
