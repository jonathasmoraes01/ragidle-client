/**
 * Network/juntarPaginas.js
 *
 * AS PAGINAS DE UMA JANELA QUE PASSA DO U16 (07/10/2026, D-2071).
 *
 * O tamanho de um pacote do RO e um `u16` (65.535 bytes). Duas janelas chegam
 * perto ou passam - a arvore de habilidades (`ZC_RAGIDLE_SKILLS`, 46 KB no
 * Sabio) e o quadro de grupos (`ZC_RAGIDLE_LFG_LISTA`, sem teto de grupos) -,
 * e o servidor (`servidor/mapa/paginas-da-janela.ts`, no repositorio do jogo)
 * as manda em paginas: cada pagina e o corpo INTEIRO do contrato com uma
 * fatia da lista grande, mais `parte` (1..n) e `partes` (n). O molde e o do
 * catalogo de mapas (`HuntMap.js`).
 *
 * Abaixo do teto de uma pagina o corpo vem como sempre, sem `parte`/`partes`,
 * e passa direto. Com paginas, este juntador guarda as fatias e so devolve o
 * corpo quando a ULTIMA chega - um corpo so, como se nunca tivesse sido
 * cortado. Pagina fora de ordem (ou de outra serie: `partes` ou `rev`
 * diferente) descarta o que estava guardado: a proxima serie recomeca do 1.
 */

/**
 * Um juntador para a lista `chave`. Devolve uma funcao que recebe cada corpo
 * e devolve o corpo pronto (o que passa direto, ou o juntado na ultima
 * pagina), ou `null` enquanto faltam paginas.
 */
export function criarJuntadorDePaginas(chave) {
	let guardado = null;
	return function juntar(dados) {
		if (!dados || !(Number(dados.partes) > 1)) {
			guardado = null;
			return dados;
		}
		const parte = Number(dados.parte);
		const partes = Number(dados.partes);
		const fatia = Array.isArray(dados[chave]) ? dados[chave] : [];
		if (parte === 1) {
			// `concat` (abaixo) faz lista nova: a fatia da primeira pagina nao e mexida.
			guardado = { corpo: { ...dados, [chave]: fatia }, partes, proxima: 2, rev: dados.rev };
		} else if (guardado && guardado.partes === partes && guardado.proxima === parte && guardado.rev === dados.rev) {
			guardado.corpo[chave] = guardado.corpo[chave].concat(fatia);
			guardado.proxima = parte + 1;
		} else {
			guardado = null;
			return null;
		}
		if (parte < partes) {
			return null;
		}
		const pronto = guardado.corpo;
		guardado = null;
		delete pronto.parte;
		delete pronto.partes;
		return pronto;
	};
}
