/**
 * A LINHA "PESO" DA DESCRICAO SAI DO PESO DO JOGO (16/09/2026, D-1526 do
 * servidor) — relato do dono depois da R30: *"nao atualizou em relacao ao peso
 * das pocoes"*.
 *
 * A descricao vem do arquivo de dados do cliente e traz o peso escrito a mao,
 * com codigo de cor no meio (`Peso: ^7777777^000000`). O peso que o jogo usa e
 * o da ficha publicada pelo servidor (`fichasDeItem.js`, em decigrama). Medido
 * no servidor: 63 itens do recorte tinham o texto diferente do peso real.
 */

const LINHA_DE_PESO = /(Peso\s*:\s*(?:\^[0-9a-fA-F]{6})?\s*)([\d.,]+)/i;

/** 70 -> "7", 1 -> "0.1" — o formato do proprio texto. */
export function pesoComoNaDescricao(decigramas) {
	const unidades = decigramas / 10;
	return Number.isInteger(unidades) ? String(unidades) : String(Math.round(unidades * 10) / 10);
}

/**
 * @param {string} texto a descricao ja juntada em linhas
 * @param {number|null} decigramas o peso da ficha, ou `null` se ela ainda nao chegou
 */
export function comPesoDaFicha(texto, decigramas) {
	if (typeof texto !== 'string' || decigramas === null || decigramas === undefined) {
		return texto;
	}
	return texto.replace(LINHA_DE_PESO, (_tudo, antes) => antes + pesoComoNaDescricao(decigramas));
}
