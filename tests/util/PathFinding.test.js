import { describe, it, expect } from 'vitest';  
import PathFinding from 'Utils/PathFinding.js';  
  
const TYPE = {  
    NONE:     1 << 0,  
    WALKABLE: 1 << 1,  
    WATER:    1 << 2,  
    SNIPABLE: 1 << 3  
};  
  
function createGrid(width, height, fillType) {  
    const cells = new Uint8Array(width * height);  
    cells.fill(fillType);  
    return { width, height, cells, types: TYPE };  
}  
  
describe('PathFinding', () => {  
    it('finds straight path on open grid', () => {  
        const gat = createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE);  
        PathFinding.setGat(gat);  
  
        const out = new Int32Array(200);  
        const len = PathFinding.search(0, 0, 3, 0, 0, out);  
  
        expect(len).toBeGreaterThan(0);  
        // First position should be start  
        expect(out[0]).toBe(0);  
        expect(out[1]).toBe(0);  
    });  
  
    it('returns 0 when path is blocked', () => {  
        const gat = createGrid(5, 5, TYPE.WALKABLE | TYPE.SNIPABLE);  
        // Block column x=2 completely  
        for (let y = 0; y < 5; y++) {  
            gat.cells[2 + y * 5] = TYPE.NONE;  
        }  
        PathFinding.setGat(gat);  
  
        const out = new Int32Array(200);  
        const len = PathFinding.search(0, 2, 4, 2, 0, out);  
        expect(len).toBe(0);  
    });  
  
    it('finds path around obstacle', () => {  
        const gat = createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE);  
        // Block middle row except edges  
        for (let x = 1; x < 9; x++) {  
            gat.cells[x + 5 * 10] = TYPE.NONE;  
        }  
        PathFinding.setGat(gat);  
  
        const out = new Int32Array(200);  
        const len = PathFinding.search(5, 3, 5, 7, 0, out);  
        expect(len).toBeGreaterThan(0);  
    });  
  
    it('searchLong finds direct path', () => {  
        const gat = createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE);  
        PathFinding.setGat(gat);  
  
        const out = new Int32Array(200);  
        const result = PathFinding.searchLong(0, 0, 3, 3, 0, out);  
        expect(result.success).toBe(true);  
    });  
  
    it('respects range parameter', () => {
        const gat = createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE);
        PathFinding.setGat(gat);

        const out = new Int32Array(200);
        const result = PathFinding.searchLong(0, 0, 5, 5, 10, out);
        expect(result.success).toBe(true);
        expect(result.inRange).toBe(true);
    });

    /*
     * SEM MAPA CARREGADO (RAGIDLE, 07/09/2026).
     *
     * `GAT.cells` e `null` entre o pedido de troca de mapa e o fim do
     * carregamento, e o servidor ja manda entidade andando nessa janela:
     * `onEntitySpam` -> `Entity.set` -> `walkTo` -> aqui. Sem guarda a leitura
     * era `null[206]`, e a excecao subia pelo `Socket.receive` — abortando o
     * laco que fatia o buffer de rede. Medido: 14 excecoes numa unica entrada
     * em mapa de caca, no celular em pe (`prove:anuncio-de-drop`).
     *
     * Os dois casos abaixo restauram o mapa no fim: `setGat` e estado GLOBAL do
     * modulo, e deixar `cells` em `null` faria o proximo arquivo de teste medir
     * outra coisa.
     */
    it('search devolve 0 sem mapa carregado, em vez de estourar', () => {
        PathFinding.setGat({ width: 0, height: 0, cells: null, types: TYPE });

        const out = new Int32Array(200);
        expect(() => PathFinding.search(10, 10, 20, 20, 0, out)).not.toThrow();
        expect(PathFinding.search(10, 10, 20, 20, 0, out)).toBe(0);

        PathFinding.setGat(createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE));
    });

    it('searchLong devolve "sem caminho" sem mapa carregado', () => {
        PathFinding.setGat({ width: 0, height: 0, cells: null, types: TYPE });

        const out = new Int32Array(200);
        let result;
        expect(() => { result = PathFinding.searchLong(10, 10, 20, 20, 0, out); }).not.toThrow();
        expect(result.success).toBe(false);
        expect(result.pathLength).toBe(0);

        PathFinding.setGat(createGrid(10, 10, TYPE.WALKABLE | TYPE.SNIPABLE));
    });
});