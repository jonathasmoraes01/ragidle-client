/**
 * A TABELA DO PAINEL — as decisões puras da janela (D-1564).
 *
 * Elas moram fora do componente porque o componente importa o `Renderer`, e
 * quem importa o `Renderer` puxa WebGL: um teste que quisesse medir a ORDEM da
 * tabela teria de levantar o cliente inteiro. Separadas, elas rodam de verdade
 * no teste — e é a diferença entre medir a decisão e ler o fonte dela.
 *
 * Nada aqui toca o DOM.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/**
 * "1h 02m 03s" — o MESMO formato do `@mvptime` no chat.
 *
 * Ele é reescrito aqui porque o servidor manda `faltaMs`, e não a string: a
 * janela precisa recalcular o texto a cada segundo, e mandar texto pronto
 * significaria um pacote por segundo.
 */
export function formatarFalta(ms) {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const dois = (n) => String(n).padStart(2, '0');
	return h > 0 ? `${h}h ${dois(m)}m ${dois(s)}s` : `${m}m ${dois(s)}s`;
}

/**
 * Quanto falta AGORA para esta linha, em ms.
 *
 * O servidor mandou a distância no instante do envio; o tempo que passou desde
 * a chegada é descontado com o relógio do navegador. Os dois relógios nunca se
 * encontram — é por isso que o que viaja é a distância (ver o cabeçalho de
 * `servidor/comandos/painel-de-comando.ts`).
 */
export function faltaAgora(faltaMs, chegouEm, agora) {
	if (faltaMs === null || faltaMs === undefined) {
		return null;
	}
	return Math.max(0, faltaMs - (agora - chegouEm));
}

/** Texto comparavel: sem caixa e sem acento ("Jose" acha "José"). */
function normalizar(texto) {
	return String(texto ?? '')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();
}

/**
 * A PESQUISA DO PAINEL (25/09/2026, pedido do dono para o `@who`): so as linhas
 * em que ALGUMA coluna contem o termo. Termo vazio devolve tudo.
 *
 * @param {Array<{valores: Object}>} linhas
 * @param {string} termo
 */
export function filtrarLinhas(linhas, termo) {
	const t = normalizar(termo).trim();
	if (t === '') {
		return linhas;
	}
	return linhas.filter((linha) => Object.values(linha.valores || {}).some((v) => normalizar(v).includes(t)));
}

/**
 * A lista na ordem da tela.
 *
 * Sem escolha do jogador, a ordem é a que o servidor mandou — as linhas já
 * chegam ordenadas, e o `ordemInicial` só diz qual cabeçalho aparece marcado.
 * A comparação é por TIPO: número e relógio comparam como número (o `null` do
 * relógio vai para o fim, como no chat), o resto compara como texto.
 */
export function ordenarLinhas(painel, ordem) {
	if (!ordem) {
		return painel.linhas.slice();
	}
	const coluna = painel.colunas.find((c) => c.chave === ordem.chave);
	if (!coluna) {
		return painel.linhas.slice();
	}
	const sinal = ordem.direcao === 'desc' ? -1 : 1;
	const numerica = coluna.tipo === 'numero' || coluna.tipo === 'relogio';
	return painel.linhas.slice().sort((a, b) => {
		const va = a.valores[ordem.chave];
		const vb = b.valores[ordem.chave];
		if (numerica) {
			// `null` (sem relógio) fica no FIM nas duas direções: ele não é
			// "muito grande" nem "muito pequeno", é ausência.
			if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
			if (vb === null || vb === undefined) return -1;
			return (va - vb) * sinal;
		}
		return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR') * sinal;
	});
}
