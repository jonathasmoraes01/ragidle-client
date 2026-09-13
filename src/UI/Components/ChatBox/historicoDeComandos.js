/**
 * O HISTORICO SO DE COMANDOS (a proposta 5 da tarefa 20 do dono).
 *
 * O chat ja lembrava o que foi digitado — as setas trazem de volta —, mas numa
 * lista SO, que mistura fala e comando, e que sumia ao recarregar a pagina
 * (`History.js`, em memoria). Para quem administra, o que se repete e o
 * comando: `@item 501 10`, `#heal Fulano`. Esta lista guarda SO os comandos
 * (`@` e `#`), e fica gravada por personagem, como as outras preferencias do
 * chat.
 *
 * As setas usam esta lista quando o campo ja comeca com `@` ou `#`, e buscam
 * pelo que ja esta digitado: `@it` e a seta para cima trazem os `@item`
 * anteriores, do mais novo ao mais velho, e a seta para baixo volta ao que o
 * jogador tinha escrito. Com o campo vazio, ou falando, as setas seguem na
 * lista de sempre.
 */

/** Quantos comandos ficam gravados — o mesmo teto da lista de sempre (`History.js`). */
export const TETO_DO_HISTORICO_DE_COMANDOS = 50;

/** O campo JA comeca como comando — o gatilho das setas, que vale ate para o `@` sozinho. */
export function comecaComoComando(texto) {
	return typeof texto === 'string' && /^[@#]/.test(texto);
}

/** Uma linha de comando de servidor para GUARDAR: o simbolo e alguma coisa colada nele. */
export function ehLinhaDeComando(texto) {
	return typeof texto === 'string' && /^[@#]\S/.test(texto.trim());
}

/** A lista depois de guardar `linha`: sem repetida, a mais nova no fim, e dentro do teto. */
export function guardarComando(lista, linha, teto = TETO_DO_HISTORICO_DE_COMANDOS) {
	const limpa = linha.trim();
	const sem = lista.filter((c) => c !== limpa);
	sem.push(limpa);
	return sem.length > teto ? sem.slice(sem.length - teto) : sem;
}

/**
 * O que foi gravado, lido com desconfianca: o `localStorage` e do navegador, e
 * pode vir de outra versao ou ter sido mexido a mao. So texto de comando entra.
 */
export function lerComandosGravados(bruto, teto = TETO_DO_HISTORICO_DE_COMANDOS) {
	if (!Array.isArray(bruto)) return [];
	return bruto
		.filter((c) => ehLinhaDeComando(c))
		.map((c) => c.trim())
		.slice(-teto);
}

/** Os comandos que comecam com `prefixo`, do mais novo ao mais velho, sem o proprio prefixo. */
export function comandosQueComecamCom(lista, prefixo) {
	const achados = [];
	for (let i = lista.length - 1; i >= 0; i--) {
		const c = lista[i];
		if (c !== prefixo && c.startsWith(prefixo)) achados.push(c);
	}
	return achados;
}

/**
 * Um passo das setas na busca de comandos. `busca` e o estado do passo anterior
 * (ou `null`); ela RECOMECA quando o texto do campo nao e mais o que o ultimo
 * passo escreveu — o jogador mexeu nele, e o que ele escreveu vira o prefixo.
 *
 * @param {{prefixo: string, achados: string[], posicao: number, escrito: string} | null} busca
 * @param {string} textoAtual
 * @param {string[]} lista
 * @param {'cima' | 'baixo'} direcao
 * @returns {{busca: {prefixo: string, achados: string[], posicao: number, escrito: string}, texto: string}}
 */
export function passoDaBusca(busca, textoAtual, lista, direcao) {
	const atual =
		busca && busca.escrito === textoAtual
			? busca
			: { prefixo: textoAtual, achados: comandosQueComecamCom(lista, textoAtual), posicao: -1, escrito: textoAtual };
	const posicao = Math.min(atual.posicao + (direcao === 'cima' ? 1 : -1), atual.achados.length - 1);
	if (posicao < 0) return { busca: { ...atual, posicao: -1, escrito: atual.prefixo }, texto: atual.prefixo };
	const texto = atual.achados[posicao];
	return { busca: { ...atual, posicao, escrito: texto }, texto };
}
