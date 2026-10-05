/**
 * UI/Components/NpcStore/NpcStoreV2/quantidadeDeCompra.js
 *
 * OS ATALHOS DE QUANTIDADE DA COMPRA (05/10/2026, sugestao de jogador): *"como
 * o jogo e idle e carregamos toneladas de itens, na hora de comprar os
 * consumiveis voce pudesse estabelecer comprar ate 70% (para cacar) ou deixar
 * sem limite"*.
 *
 * Dois atalhos por linha, as duas contas aqui, sem DOM (o mesmo desenho de
 * `vitrine.js`):
 *
 * - **"70%"** — a MAIOR quantidade que deixa a mochila ABAIXO de 70% da
 *   capacidade. 70% e o `natural_heal_weight_rate` (`game/peso.ts`,
 *   `LIMIAR_DE_SOBRECARGA`): dali para cima a regeneracao natural de HP e SP
 *   PARA (armadilha 5 do contrato). E o teto de quem vai cacar. A conta e a
 *   do servidor, `pc_getpercentweight` (pc.cpp:3012-3017): percentual
 *   INTEIRO TRUNCADO, e exatamente 70 ja e sobrecarga (`>=`,
 *   pc.cpp:3026-3030). Entao a regra e `floor(peso * 100 / teto) < 70`, que
 *   e o mesmo que `peso * 100 < 70 * teto` — sem divisao, sem arredondamento.
 *
 * - **"Máx"** — TRAVADO ABAIXO DE 90% (ordem do dono, 05/10/2026: "trava em
 *   89%"). O servidor aceita compra ate 100% (so recusa `peso atual + peso da
 *   compra > teto`, `servidor/itens.ts`), mas a partir de 90%
 *   (`major_overweight_rate`) o personagem nao ataca nem usa habilidade - num
 *   jogo idle, apertar "Máx" e parar de cacar sem entender por que. A conta e a
 *   mesma do "70%", com o degrau de 90: o percentual truncado fica em 89.
 *
 * Os dois olham o RESTO DA COMPRA: o peso e o zeny das outras linhas ja
 * escolhidas entram na conta. Antes o "Máx" de cada linha olhava so a mochila,
 * e o segundo item no "Máx" travava o botao "Comprar" por peso.
 *
 * Unidades: peso em DECIGRAMAS (o `Weight` do item_db e o `Session.Entity
 * .weight`), dinheiro na moeda da loja.
 */

/** `natural_heal_weight_rate` — o degrau em que a regeneracao natural para. */
export const PERCENTUAL_PARA_CACAR = 70;

/** `major_overweight_rate` — o degrau em que ataque e habilidade param; o "Máx" fica abaixo dele. */
export const PERCENTUAL_DO_MAXIMO = 90;

/**
 * Quantas unidades cabem no PESO sem passar do teto que o servidor aceita.
 *
 * @param {{pesoAtual:number, pesoMaximo:number, pesoDoItem:number|null, pesoDoResto:number}} p
 * @returns {number} Infinity quando o peso nao limita (item sem peso conhecido
 *          ou que nao pesa) — quem limita ai e o estoque e o dinheiro
 */
export function cabeNoPeso({ pesoAtual, pesoMaximo, pesoDoItem, pesoDoResto }) {
	if (typeof pesoDoItem !== 'number' || pesoDoItem <= 0) {
		return Infinity;
	}
	const livre = pesoMaximo - pesoAtual - pesoDoResto;
	return Math.max(0, Math.floor(livre / pesoDoItem));
}

/**
 * Quantas unidades cabem deixando a mochila ABAIXO do percentual (ver o topo).
 *
 * @param {{pesoAtual:number, pesoMaximo:number, pesoDoItem:number|null, pesoDoResto:number, percentual?:number}} p
 * @returns {number|null} null quando a conta nao tem dado honesto (peso do item
 *          desconhecido ou teto ainda nao chegou) — o atalho fica apagado;
 *          Infinity quando o item nao pesa
 */
export function cabeAtePercentual({
	pesoAtual,
	pesoMaximo,
	pesoDoItem,
	pesoDoResto,
	percentual = PERCENTUAL_PARA_CACAR
}) {
	if (typeof pesoDoItem !== 'number' || !(pesoMaximo > 0)) {
		return null;
	}
	if (pesoDoItem <= 0) {
		return Infinity;
	}
	// (base + q * w) * 100 < percentual * teto  ->  q < folga / (100 * w)
	const folga = percentual * pesoMaximo - 100 * (pesoAtual + pesoDoResto);
	if (folga <= 0) {
		return 0;
	}
	return Math.ceil(folga / (100 * pesoDoItem)) - 1;
}

/**
 * Quantas unidades o dinheiro paga, depois do resto da compra.
 *
 * @param {{saldo:number, preco:number, custoDoResto:number}} p
 * @returns {number} Infinity quando o item e de graca (ou o preco nao e em dinheiro)
 */
export function cabeNoDinheiro({ saldo, preco, custoDoResto }) {
	if (!(preco > 0)) {
		return Infinity;
	}
	return Math.max(0, Math.floor((saldo - custoDoResto) / preco));
}

/**
 * A quantidade de cada atalho para UMA linha.
 *
 * @param {object} p
 * @param {number} p.tetoDaLinha - o teto que a linha ja tinha (estoque, mochila,
 *        dinheiro sem o resto da compra — `tetoDoItem`); nenhum atalho passa dele
 * @param {number} p.pesoAtual
 * @param {number} p.pesoMaximo
 * @param {number|null} p.pesoDoItem
 * @param {number|null} p.pesoDoResto - o peso das OUTRAS linhas; null quando
 *        alguma delas tem peso desconhecido
 * @param {number|null} p.saldo - null quando a moeda nao e dinheiro (escambo)
 * @param {number} p.preco
 * @param {number} p.custoDoResto
 * @returns {{maximo:number, ateParaCacar:number|null}}
 */
export function atalhosDaLinha(p) {
	const resto = typeof p.pesoDoResto === 'number' ? p.pesoDoResto : null;
	const dinheiro =
		p.saldo === null ? Infinity : cabeNoDinheiro({ saldo: p.saldo, preco: p.preco, custoDoResto: p.custoDoResto });

	// Sem o peso do resto, o "Máx" volta ao teto da linha (a conta de antes);
	// inventar zero para o resto deixaria passar uma compra que o servidor recusa.
	// O teto do servidor (100%) segue valendo; o degrau de 90% fica por cima dele.
	const abaixoDoDegrau =
		resto === null
			? null
			: cabeAtePercentual({
					pesoAtual: p.pesoAtual,
					pesoMaximo: p.pesoMaximo,
					pesoDoItem: p.pesoDoItem,
					pesoDoResto: resto,
					percentual: PERCENTUAL_DO_MAXIMO
				});
	const peso =
		resto === null || !(p.pesoMaximo > 0)
			? Infinity
			: Math.min(
					cabeNoPeso({
						pesoAtual: p.pesoAtual,
						pesoMaximo: p.pesoMaximo,
						pesoDoItem: p.pesoDoItem,
						pesoDoResto: resto
					}),
					abaixoDoDegrau === null ? Infinity : abaixoDoDegrau
				);
	const maximo = Math.max(0, Math.min(p.tetoDaLinha, peso, dinheiro));

	const ate =
		resto === null
			? null
			: cabeAtePercentual({
					pesoAtual: p.pesoAtual,
					pesoMaximo: p.pesoMaximo,
					pesoDoItem: p.pesoDoItem,
					pesoDoResto: resto
				});
	return {
		maximo,
		ateParaCacar: ate === null ? null : Math.max(0, Math.min(maximo, ate))
	};
}
