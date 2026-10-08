/**
 * UI/Components/BotMenu/seletorDeItem.js
 *
 * O SELETOR DE ITEM do menu do Bot (correcoes pos-QA, 08/10/2026; contrato 05
 * secao 3: a interface nao expoe IDs). O jogador escolhe pelo NOME e pelo
 * ICONE reais, a partir dos candidatos que a janela entrega (a mochila, as
 * pocoes e as municoes que o servidor ja lista); o id fica so no dado. Um
 * botao abre a lista, um campo filtra pelo nome, um clique escolhe.
 *
 * Sem estado proprio: a lista e redesenhada a cada `desenhar` da janela, e o
 * aberto/fechado mora no atributo `hidden` do painel (sobrevive ao redesenho
 * porque o painel e do HTML da secao, e nao criado aqui).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

function criar(tag, classe, texto) {
	const e = document.createElement(tag);
	if (classe) {
		e.className = classe;
	}
	if (texto !== undefined) {
		e.textContent = texto;
	}
	return e;
}

/** O filtro pelo nome: sem acento e sem caixa ("pocao" acha "Poção"). */
export function normalizarNome(texto) {
	return String(texto || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();
}

/**
 * Os candidatos que o filtro deixa, na ordem recebida.
 * @param {Array<{itemId: number, nome: string}>} candidatos
 * @param {string} filtro
 */
export function filtrarCandidatos(candidatos, filtro) {
	const f = normalizarNome(filtro);
	return f ? candidatos.filter(c => normalizarNome(c.nome).includes(f)) : candidatos;
}

/**
 * @param {Element} raiz o bloco com `.bm-escolher` (botao), `.bm-seletor` (painel), `.bm-seletor-filtro` (campo) e `.bm-seletor-lista` (ul)
 * @param {{candidatos: Array<{itemId: number, nome: string, quantidade?: number}> | (() => Array<{itemId: number, nome: string, quantidade?: number}>),
 *          cheio: boolean, vazio: string,
 *          iconeDoItem?: (img: HTMLImageElement, id: number) => void}} dados
 * @param {(itemId: number) => void} aoEscolher
 */
export function desenharSeletorDeItem(raiz, dados, aoEscolher) {
	const abrir = raiz.querySelector('.bm-escolher');
	const painel = raiz.querySelector('.bm-seletor');
	const filtro = raiz.querySelector('.bm-seletor-filtro');
	const ul = raiz.querySelector('.bm-seletor-lista');
	abrir.disabled = !!dados.cheio;
	if (dados.cheio) {
		painel.hidden = true;
	}
	abrir.setAttribute('aria-expanded', painel.hidden ? 'false' : 'true');

	// Os candidatos sao lidos na hora (a mochila muda com a janela aberta).
	const listar = () => {
		ul.innerHTML = '';
		const todos = typeof dados.candidatos === 'function' ? dados.candidatos() : dados.candidatos;
		const visiveis = filtrarCandidatos(todos, filtro.value);
		if (visiveis.length === 0) {
			ul.appendChild(criar('li', 'bm-seletor-vazio', todos.length === 0 ? dados.vazio : 'Nenhum item com esse nome.'));
			return;
		}
		for (const c of visiveis) {
			const li = criar('li', 'bm-seletor-item');
			const b = criar('button', 'bm-opcao-item');
			b.type = 'button';
			b.setAttribute('data-item', String(c.itemId));
			const img = criar('img', 'bm-item-icone');
			img.alt = '';
			img.setAttribute('aria-hidden', 'true');
			if (dados.iconeDoItem) {
				dados.iconeDoItem(img, c.itemId);
			}
			b.appendChild(img);
			const n = criar('span', 'bm-item-nome', c.nome);
			n.setAttribute('translate', 'no');
			b.appendChild(n);
			if (typeof c.quantidade === 'number') {
				b.appendChild(criar('span', 'bm-quantidade', 'x' + c.quantidade));
			}
			b.addEventListener('click', e => {
				e.stopImmediatePropagation();
				painel.hidden = true;
				filtro.value = '';
				aoEscolher(c.itemId);
			});
			li.appendChild(b);
			ul.appendChild(li);
		}
	};

	abrir.onclick = e => {
		e.stopImmediatePropagation();
		painel.hidden = !painel.hidden;
		abrir.setAttribute('aria-expanded', painel.hidden ? 'false' : 'true');
		if (!painel.hidden) {
			listar();
			filtro.focus();
		}
	};
	filtro.oninput = listar;
	filtro.onkeydown = e => {
		if (e.key === 'Escape') {
			// O ESC fecha so o seletor; a janela continua aberta.
			e.preventDefault();
			e.stopImmediatePropagation();
			painel.hidden = true;
			abrir.setAttribute('aria-expanded', 'false');
			abrir.focus();
		}
	};
	if (!painel.hidden) {
		listar();
	}
}
