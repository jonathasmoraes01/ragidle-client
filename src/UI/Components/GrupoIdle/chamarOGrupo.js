/**
 * UI/Components/GrupoIdle/chamarOGrupo.js
 *
 * O botão "Chamar o grupo" APARECE? (J11 da comunidade, R125, D-2463, 15/10/2026)
 *
 * Sem DOM, pela mesma razão de `vidaDoMembro.js`: regra com condição precisa de
 * teste que RODE, e levantar a `GrupoIdle` de verdade puxa `GUIComponent`,
 * `Renderer` e o GRF junto.
 *
 * Só o LÍDER chama, e só quando há mais alguém no grupo. Quem pode vir, quem
 * fica e a espera entre duas chamadas são do SERVIDOR (`chamada-do-grupo.ts`):
 * a janela não repete a regra, só não oferece o gesto a quem ele não serve.
 *
 * @param {{ eu?: { souLider?: boolean } | null, grupo?: { membros?: unknown[] } | null } | null} estado
 *   o último `ZC_RAGIDLE_GRUPO` que a janela recebeu
 * @returns {boolean}
 */
export function chamarCabe(estado) {
	const souLider = !!(estado && estado.eu && estado.eu.souLider);
	const membros = estado && estado.grupo && Array.isArray(estado.grupo.membros) ? estado.grupo.membros : [];
	return souLider && membros.length > 1;
}
