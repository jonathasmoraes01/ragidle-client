/**
 * UI/Components/HuntMap/atlasDeCaca.js
 *
 * As REGRAS do Mapa de Caça que não precisam de DOM (redesenho de 01/09/2026,
 * D-901). Mesma razão de existir de `dropsDoMapa.js`: um módulo sem imports
 * pode ser EXECUTADO por um teste — e regra com conta (encaixe de nível,
 * geometria do medidor, motivo de uma busca ter casado) precisa de teste que
 * rode, não de teste que leia o fonte.
 *
 * Nada aqui é conceito do servidor. O catálogo traz `nivelQueAbre`,
 * `nivelMinimo`, `nivelMaximo` e `nivelMedio` de cada mapa (contrato v2,
 * `servidor/mapa/catalogo.ts`); o que este arquivo faz com esses números é
 * APRESENTAÇÃO — o servidor continua sendo quem autoriza a viagem.
 */

/**
 * Como o mapa se encaixa no nível do jogador. As quatro classes são as do
 * design system (selecionado/bloqueado/etc. são estados; estas são de
 * conteúdo) e a ordem de teste importa: a tranca vem antes de tudo.
 *
 * @param {number} nivel - nível base do jogador
 * @param {{nivelQueAbre: number, nivelMinimo: number, nivelMaximo: number}} mapa
 * @returns {{cls: 'locked'|'easy'|'ideal'|'challenge', rotulo: string, curto: string}}
 */
export function encaixeDeNivel(nivel, mapa) {
	if (nivel < mapa.nivelQueAbre) {
		return { cls: 'locked', rotulo: `Abre no Nv. ${mapa.nivelQueAbre}`, curto: 'Bloqueado' };
	}
	if (nivel > mapa.nivelMaximo) {
		return { cls: 'easy', rotulo: 'Abaixo do seu nível', curto: 'Fácil' };
	}
	if (nivel >= mapa.nivelMinimo) {
		return { cls: 'ideal', rotulo: 'Ideal para você', curto: 'Ideal' };
	}
	return { cls: 'challenge', rotulo: 'Acima do seu nível', curto: 'Desafio' };
}

/**
 * O MEDIDOR DE ENCAIXE de cada mapa: uma régua em que a faixa do mapa ocupa
 * sempre o meio (25%..75%) e o marcador diz onde o jogador está em relação a
 * ela. Não é uma escala absoluta de 1..99 de propósito — o que o jogador quer
 * saber numa lista é "estou abaixo, dentro ou acima DESTE mapa", e uma escala
 * absoluta esmagaria todo mapa de nível baixo num filete à esquerda.
 *
 * A faixa de 1 nível (mapa com min == max) ganha uma folga mínima para o
 * marcador não colapsar num ponto.
 *
 * @param {number} nivel
 * @param {{nivelMinimo: number, nivelMaximo: number}} mapa
 * @returns {{marcador: number, dentro: boolean}} marcador em 0..100 (percentual)
 */
export function medidorDeEncaixe(nivel, mapa) {
	const largura = Math.max(mapa.nivelMaximo - mapa.nivelMinimo, 4);
	const inicio = mapa.nivelMinimo - largura / 2;
	const fim = mapa.nivelMaximo + largura / 2;
	const bruto = ((nivel - inicio) / (fim - inicio)) * 100;
	const marcador = Math.round(Math.min(100, Math.max(0, bruto)) * 10) / 10;
	const dentro = nivel >= mapa.nivelMinimo && nivel <= mapa.nivelMaximo;
	return { marcador, dentro };
}

/**
 * POR QUE a busca casou com este mapa. A caixa procura em nome de mapa, de
 * monstro E de drop — e quando o jogador digita "jellopy" e vê "Campo de
 * Prontera" na lista, a linha precisa dizer que foi o Jellopy do Poring que
 * trouxe o mapa, senão a busca parece quebrada.
 *
 * Devolve `null` quando não casa (é o filtro), e um objeto com o motivo
 * quando casa. `monstros` é a lista `allMonstersOf(mapa)` do HuntMap (índice
 * ou ficha, as duas trazem `nome` e `drops`; no índice `drops` é lista de
 * NOMES, na ficha é lista de objetos com `nome` — e, quando o cliente já
 * traduziu o item, `nomeLocal`).
 *
 * O NOME DO SERVIDOR É INGLÊS (rAthena: "Tree Root"); o do cliente é o que o
 * jogador lê na Mochila ("Raiz de Árvore"). A busca aceita os DOIS, e o
 * motivo devolve o local quando houver — o jogador digitou o que vê na tela.
 *
 * @param {{rotulo: string, mapa: string}} mapa
 * @param {Array<{nome: string, drops?: Array<string|{nome: string, nomeLocal?: string}>}>} monstros
 * @param {string} termo - já em minúsculas e sem espaços nas pontas
 * @returns {null|{peloNome: boolean, monstros: string[], drops: Array<{item: string, monstro: string}>}}
 */
export function motivoDaBusca(mapa, monstros, termo) {
	if (!termo) {
		return { peloNome: true, monstros: [], drops: [] };
	}
	const peloNome = mapa.rotulo.toLowerCase().includes(termo) || mapa.mapa.toLowerCase().includes(termo);
	const porMonstro = [];
	const porDrop = [];
	for (const m of monstros) {
		if (m.nome.toLowerCase().includes(termo)) {
			porMonstro.push(m.nome);
		}
		for (const d of m.drops || []) {
			const nomeDoServidor = typeof d === 'string' ? d : d.nome;
			const nomeLocal = typeof d === 'string' ? '' : d.nomeLocal || '';
			const casa =
				(nomeDoServidor && nomeDoServidor.toLowerCase().includes(termo)) ||
				(nomeLocal && nomeLocal.toLowerCase().includes(termo));
			if (casa) {
				porDrop.push({ item: nomeLocal || nomeDoServidor, monstro: m.nome });
			}
		}
	}
	if (!peloNome && !porMonstro.length && !porDrop.length) {
		return null;
	}
	return { peloNome, monstros: porMonstro, drops: porDrop };
}

/**
 * O texto curto da linha "encontrado por": até 3 nomes, sem repetir o mesmo
 * item de dois monstros, e a contagem do que sobrou.
 *
 * @param {{peloNome: boolean, monstros: string[], drops: Array<{item: string, monstro: string}>}} motivo
 * @returns {string} vazio quando o mapa casou só pelo próprio nome
 */
export function resumoDoMotivo(motivo) {
	if (!motivo) {
		return '';
	}
	const partes = [];
	for (const nome of motivo.monstros) {
		if (!partes.includes(nome)) partes.push(nome);
	}
	for (const d of motivo.drops) {
		const texto = `${d.item} (${d.monstro})`;
		if (!partes.includes(texto)) partes.push(texto);
	}
	if (!partes.length) {
		return '';
	}
	const visiveis = partes.slice(0, 3);
	const sobra = partes.length - visiveis.length;
	return visiveis.join(' · ') + (sobra > 0 ? ` +${sobra}` : '');
}

/**
 * Ordens da lista: "nivel" (faixa crescente), "nome" (alfabética pt-BR) e
 * "nivel-recomendado" (quanto mais perto do nível do jogador a média da
 * população, mais em cima). Estável: empate desempata pelo nome para a lista
 * não dançar entre dois desenhos.
 *
 * @param {Array<object>} mapas
 * @param {'nivel'|'nome'|'nivel-recomendado'} chave
 * @param {number} nivel
 * @returns {Array<object>} cópia ordenada
 */
export function ordenarMapas(mapas, chave, nivel) {
	const arr = mapas.slice();
	const porNome = (a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR');
	if (chave === 'nome') {
		arr.sort(porNome);
	} else if (chave === 'nivel-recomendado') {
		arr.sort((a, b) => Math.abs(a.nivelMedio - nivel) - Math.abs(b.nivelMedio - nivel) || porNome(a, b));
	} else {
		arr.sort((a, b) => a.nivelMinimo - b.nivelMinimo || a.nivelMedio - b.nivelMedio || porNome(a, b));
	}
	return arr;
}

/**
 * Chance de drop em décimos de milésimo (7000 = 70%, contrato do catálogo).
 * A precisão acompanha o tamanho: de 10% para cima é inteiro; entre 1% e 10%
 * uma casa; abaixo de 1% duas casas — o Poring Card é 0,01% e "0,0%" seria
 * mentir que é zero. Zero à direita cai ("3,20" vira "3,2"; "5,00" vira "5").
 * Vírgula decimal: o design system escreve números em pt-BR.
 *
 * @param {number} chance
 * @returns {string}
 */
export function formatarChance(chance) {
	const pct = (chance || 0) / 100;
	let texto;
	if (pct >= 10) {
		texto = String(Math.round(pct));
	} else if (pct >= 1) {
		texto = pct.toFixed(1);
	} else {
		texto = pct.toFixed(2);
	}
	// Só corta zero à direita quando HÁ casa decimal — "70" tem que continuar "70".
	if (texto.includes('.')) {
		texto = texto.replace(/\.?0+$/, '');
	}
	return texto.replace('.', ',') + '%';
}
