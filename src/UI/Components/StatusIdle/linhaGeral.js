/**
 * UI/Components/StatusIdle/linhaGeral.js
 *
 * O DOM de UMA linha da secao "Gerais" (25/09/2026), fora de StatusIdle.js para
 * poder ser medido no jsdom: a janela inteira arrasta UIManager e a cadeia de
 * render, e o que precisa de prova aqui e so a linha e o toque nela.
 *
 * ── O DETALHE TEM DE SE ANUNCIAR ──────────────────────────────────────────
 * A primeira versao escondia a parte do Codex no `title` (o balao nativo do
 * navegador) e nada na linha dizia que ele existia. O dono, no mesmo dia:
 * *"e impossivel o player saber que ele pode clicar ali ou colocar o mouse em
 * cima"*. Entao:
 *
 *   - toda linha que tem o que explicar ganha um "i" VISIVEL ao lado do
 *     numero, o realce de linha clicavel ao passar o mouse e o ponteiro de mao;
 *   - clicar (mouse) ou tocar (dedo) abre o detalhe EMBAIXO da linha, dentro da
 *     janela: a parte do Codex (em destaque), o que o numero quer dizer e os
 *     canais de recuperacao. O mesmo gesto fecha;
 *   - o `title` SAIU: com o detalhe na janela ele so repetia o texto num balao
 *     do sistema, e no toque ele nem existe.
 *
 * Toda linha que o jogo desenha hoje tem dica (`ROTULOS`, geraisDaFicha.js),
 * entao todas sao botoes; a linha sem detalhe (uma chave sem dica) continua
 * sendo texto, sem "i" e sem nada para abrir.
 *
 * A linha e um <button>: toque, clique, Enter e Espaco chegam todos pelo
 * `click`, e o foco de teclado vem de graca. `aria-expanded` diz aberto ou
 * fechado; `aria-controls` aponta o detalhe. Nada da ficha vira HTML: tudo e
 * `textContent`.
 */

/**
 * Monta a linha. `linha` e o que `linhasParaDesenhar` devolve; `aberta` diz se
 * o detalhe ja estava aberto (a ficha e redesenhada a cada status que entra ou
 * sai, e o detalhe nao pode fechar sozinho no meio da leitura).
 */
export function montarLinhaGeral(doc, linha, aberta) {
	const detalhe = Array.isArray(linha.detalhe) ? linha.detalhe.filter(t => typeof t === 'string' && t !== '') : [];
	const temDetalhe = detalhe.length > 0;
	const row = doc.createElement(temDetalhe ? 'button' : 'div');
	row.className = 'st-geral-row';
	row.dataset.geral = linha.chave;

	const label = doc.createElement('span');
	label.className = 'st-geral-label';
	label.textContent = linha.rotulo;

	const direita = doc.createElement('span');
	direita.className = 'st-geral-direita';
	const valor = doc.createElement('span');
	valor.className = 'st-geral-value';
	valor.textContent = linha.valor;
	direita.appendChild(valor);

	row.appendChild(label);
	row.appendChild(direita);

	if (temDetalhe) {
		// O "i" e so o sinal de que ha mais: quem le a linha em voz alta ja
		// ouve "recolhido/expandido" pelo aria-expanded.
		const info = doc.createElement('span');
		info.className = 'st-geral-info';
		info.setAttribute('aria-hidden', 'true');
		info.textContent = 'i';
		direita.appendChild(info);

		const caixa = doc.createElement('span');
		caixa.className = 'st-geral-detalhe';
		caixa.id = 'st-geral-detalhe-' + linha.chave;
		for (const texto of detalhe) {
			const parte = doc.createElement('span');
			// A parte do Codex vem em destaque: e a pergunta que trouxe o
			// jogador ate aqui (o pedido original do dono era ver o Codex).
			parte.className = texto.startsWith('Codex ') ? 'st-geral-detalhe-linha st-geral-codex' : 'st-geral-detalhe-linha';
			parte.textContent = texto;
			caixa.appendChild(parte);
		}
		row.appendChild(caixa);

		row.type = 'button';
		row.classList.add('st-geral-row--detalhe');
		row.setAttribute('aria-controls', caixa.id);
		marcarLinhaAberta(row, aberta === true);
	}

	return row;
}

/** Pinta aberto/fechado: a classe (o CSS mostra o detalhe) e o `aria-expanded`. */
export function marcarLinhaAberta(row, aberta) {
	row.classList.toggle('is-aberta', aberta);
	row.setAttribute('aria-expanded', aberta ? 'true' : 'false');
}

/** A linha com detalhe que recebeu o clique/toque, ou `null` (linha sem detalhe, fora da lista). */
export function linhaComDetalheDoEvento(evento) {
	const alvo = evento && evento.target;
	return alvo && typeof alvo.closest === 'function' ? alvo.closest('.st-geral-row--detalhe') : null;
}

export default { montarLinhaGeral, marcarLinhaAberta, linhaComDetalheDoEvento };
