/**
 * A VARREDURA DE BARRAS DE ROLAGEM OLHA SO O QUE MUDOU (13/09/2026).
 *
 * `GUIComponent` observa cada componente e, a cada mutacao, varria TODO no dele
 * chamando `getComputedStyle` em cada um (para achar quem rola e dar a barra do
 * tema). Uma linha nova no chat e uma mutacao — e o chat guarda ate 400 linhas
 * por aba. Medido (`Rag Idle 2.0/scripts/diag-origem-das-texturas.ts`): em
 * 4 min de caca o chat foi de 257 a 1.723 nos, e as leituras de estilo de 1.669
 * a 2.273 por segundo. O custo de cada linha crescia com o historico.
 *
 * Os ALVOS sao so o que mudou: os elementos adicionados e o alvo de uma troca
 * de classe, ou de um elemento que deixou de estar escondido. A barra que ja
 * existe num conteiner nao depende da varredura para se atualizar — cada uma
 * tem o proprio relogio (`Scrollbar.js`).
 *
 * A EXCECAO e folha de estilo nova (`<style>`/`<link>`): ela pode mudar o
 * `overflow` de qualquer no, e ai a varredura volta a ser do componente inteiro.
 * Teste: `tests/ui/alvosDaVarredura.test.js`.
 */

/**
 * @param {MutationRecord[]} mutations
 * @return {{tudo: boolean, alvos: Element[]}}
 */
/** Acima disto, varrer o componente inteiro sai mais barato que podar os alvos (F31). */
export const LIMITE_DE_ALVOS = 64;

export function alvosDaVarredura(mutations) {
	// Um `Set` (F31, auditoria de 22/09/2026): `alvos.includes` a cada no
	// tornava a coleta O(n^2) na volta da aba, com milhares de linhas de uma vez.
	const alvos = new Set();
	let tudo = false;
	const somar = el => {
		alvos.add(el);
	};

	for (const m of mutations) {
		if (m.type === 'childList') {
			for (const no of m.addedNodes) {
				if (no.nodeType !== 1) {
					continue;
				}
				if (no.tagName === 'STYLE' || no.tagName === 'LINK') {
					tudo = true;
					continue;
				}
				somar(no);
			}
		} else if (m.type === 'attributes') {
			if (m.attributeName === 'style') {
				const antes = m.oldValue || '';
				if (antes.includes('display: none') || antes.includes('display:none')) {
					if (m.target.style.display !== 'none') {
						somar(m.target);
					}
				}
			} else if (m.attributeName === 'class') {
				somar(m.target);
			}
		}
	}

	/*
	 * MUITOS ALVOS DE UMA VEZ: varre o componente inteiro, UMA vez (F31). A
	 * poda abaixo compara cada alvo com todos os outros — n^2 `contains` — e
	 * com milhares de linhas novas (a volta da aba) isso custava mais que a
	 * varredura que ela existe para economizar.
	 */
	if (tudo || alvos.size > LIMITE_DE_ALVOS) {
		return { tudo: true, alvos: [] };
	}
	// Um alvo dentro de outro ja e varrido junto com o de fora.
	const lista = [...alvos];
	const finais = [];
	for (const el of lista) {
		if (!lista.some(outro => outro !== el && outro.contains(el))) {
			finais.push(el);
		}
	}
	return { tudo: false, alvos: finais };
}
