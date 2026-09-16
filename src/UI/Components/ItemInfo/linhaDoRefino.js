/**
 * A LINHA DO BÔNUS DE REFINO na ficha do item (16/09/2026, D-1516 do servidor).
 *
 * Pedido do dono: *"o bônus pelo refino não está sendo mostrado na descrição
 * do item... o player precisa saber"*. A descrição vem do GRF e descreve o
 * item SEM refino.
 *
 * Quem CALCULA é o servidor (`bonusDeRefinoDaPeca`, com o `refine.yml`); aqui
 * só se escreve o texto. A armadura chega em CENTÉSIMOS porque o emulador soma
 * as peças antes de arredondar — por peça, o número honesto tem casa decimal.
 *
 * @param {{nivel:number, atributo:'ATQ'|'DEF', valor:number, matq:number, sobreRefinoMaximo:number}|null} r
 * @returns {string|null}
 */
export function textoDoRefino(r) {
	if (!r || typeof r.nivel !== 'number' || typeof r.valor !== 'number') {
		return null;
	}
	if (r.atributo === 'DEF') {
		const def = Math.round(r.valor) / 100;
		return `Bônus do refino +${r.nivel}: DEF +${String(def).replace('.', ',')}`;
	}
	if (r.atributo !== 'ATQ') {
		return null;
	}
	let texto = `Bônus do refino +${r.nivel}: ATQ +${r.valor}`;
	if (r.matq > 0) {
		texto += ` · MATQ +${r.matq}`;
	}
	if (r.sobreRefinoMaximo > 0) {
		texto += ` · sobre-refino: +1 a +${r.sobreRefinoMaximo} de dano por golpe`;
	}
	return texto;
}
