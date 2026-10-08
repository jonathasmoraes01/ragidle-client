/**
 * UI/Components/BotMenu/editorDeManutencao.js
 *
 * O DESENHO das abas Sobrevivencia, Suporte e Coleta do menu do Bot (Fase 6,
 * 07/10/2026), no padrao de `editorDeSkills.js`: recebe a config do rascunho e
 * o que o servidor mandou (pocoes, skills com `suporte`) e desenha; toda
 * mudanca passa por `editar(fn)` com as funcoes puras de
 * `edicaoDeManutencao.js`. Nada aqui decide: o servidor valida a config e
 * devolve `problemas` por campo.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import {
	adicionarPocao,
	adicionarSuporte,
	definirDescanso,
	definirDestinoDoSuporte,
	definirLimiarDaCura,
	definirLimiarDePocao,
	definirNivelDoSuporte,
	definirRaioDeColeta,
	deixarDeIgnorar,
	descansoCoerente,
	destinosDaSkill,
	ignorarItem,
	lerColeta,
	lerSobrevivencia,
	lerSuporte,
	ligarColeta,
	moverPocao,
	moverSuporte,
	removerPocao,
	removerSuporte
} from './edicaoDeManutencao.js';

const NOME_DO_TIPO = Object.freeze({ buff: 'Buff', cura: 'Cura' });
const NOME_DO_DESTINO = Object.freeze({ eu: 'Em mim', grupo: 'No grupo' });
const CHAVE_DO_EIXO = Object.freeze({ hp: 'pocoesHp', sp: 'pocoesSp' });

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

function botao(classe, texto, titulo, aoClicar, desligado) {
	const b = criar('button', 'ri-btn ri-btn--sec ' + classe, texto);
	b.type = 'button';
	b.title = titulo;
	b.setAttribute('aria-label', titulo);
	b.disabled = !!desligado;
	b.addEventListener('click', e => {
		e.stopImmediatePropagation();
		aoClicar();
	});
	return b;
}

/** Numero digitado: so vale no `change` (Enter ou sair do campo), para o redesenho nao atropelar a digitacao. */
function ligarNumero(input, valor, aoMudar) {
	if (input.ownerDocument.activeElement !== input) {
		input.value = String(valor);
	}
	input.onchange = () => aoMudar(input.value);
}

function nomeDoItemPor(dados) {
	const daMochila = new Map((dados.pocoes || []).map(p => [p.itemId, p.nome]));
	return id => daMochila.get(id) || (dados.nomeDoItem && dados.nomeDoItem(id)) || '#' + id;
}

/* ================= SOBREVIVENCIA ================= */

/**
 * @param {Element} raiz a secao Sobrevivencia
 * @param {{config: object, pocoes: Array|null, teto: number, nomeDoItem?: (id: number) => string|null}} dados
 * @param {(fn: (c: object) => object) => void} editar
 */
export function desenharSobrevivencia(raiz, dados, editar) {
	const s = lerSobrevivencia(dados.config);
	for (const eixo of ['hp', 'sp']) {
		const bloco = raiz.querySelector('.bm-pocoes[data-eixo="' + eixo + '"]');
		if (bloco) {
			desenharPocoes(bloco, eixo, s[CHAVE_DO_EIXO[eixo]], dados, editar);
		}
	}
	const d = s.descanso;
	ligarNumero(raiz.querySelector('.bm-sentar-hp'), d.sentarHpAbaixoDe, v =>
		editar(c => definirDescanso(c, 'sentarHpAbaixoDe', v))
	);
	ligarNumero(raiz.querySelector('.bm-sentar-sp'), d.sentarSpAbaixoDe, v =>
		editar(c => definirDescanso(c, 'sentarSpAbaixoDe', v))
	);
	ligarNumero(raiz.querySelector('.bm-levantar'), d.levantarEm, v => editar(c => definirDescanso(c, 'levantarEm', v)));
	raiz.querySelector('.bm-descanso-aviso').hidden = descansoCoerente(dados.config);
}

function desenharPocoes(bloco, eixo, lista, dados, editar) {
	const nome = nomeDoItemPor(dados);
	const naMochila = new Map((dados.pocoes || []).map(p => [p.itemId, p]));
	ligarNumero(bloco.querySelector('.bm-limiar'), lista.abaixoDe, v => editar(c => definirLimiarDePocao(c, eixo, v)));

	const ol = bloco.querySelector('.bm-lista-pocoes');
	ol.innerHTML = '';
	lista.itens.forEach((itemId, i) => {
		const li = criar('li', 'bm-item bm-pocao');
		li.setAttribute('data-item', String(itemId));
		const n = criar('span', 'bm-item-nome', nome(itemId));
		n.setAttribute('translate', 'no');
		li.appendChild(n);
		const p = naMochila.get(itemId);
		const qtd = p ? p.quantidade : 0;
		const q = criar('span', 'bm-quantidade' + (qtd > 0 ? '' : ' is-vazio'), qtd > 0 ? qtd + ' un.' : 'sem estoque');
		li.appendChild(q);
		li.appendChild(botao('bm-sobe', '↑', 'Subir', () => editar(c => moverPocao(c, eixo, itemId, -1)), i === 0));
		li.appendChild(
			botao('bm-desce', '↓', 'Descer', () => editar(c => moverPocao(c, eixo, itemId, 1)), i === lista.itens.length - 1)
		);
		li.appendChild(botao('bm-remove', '×', 'Remover', () => editar(c => removerPocao(c, eixo, itemId))));
		ol.appendChild(li);
	});

	// ADICIONAR: so as pocoes que o personagem tem e que curam ESTE eixo.
	const nova = bloco.querySelector('.bm-nova-pocao');
	nova.innerHTML = '';
	for (const p of dados.pocoes || []) {
		if (p[eixo] && !lista.itens.includes(p.itemId)) {
			const o = criar('option', '', p.nome + ' (' + p.quantidade + ')');
			o.value = String(p.itemId);
			nova.appendChild(o);
		}
	}
	const add = bloco.querySelector('.bm-add-pocao');
	add.disabled = nova.options.length === 0 || lista.itens.length >= dados.teto;
	add.onclick = e => {
		e.stopImmediatePropagation();
		if (nova.value) {
			editar(c => adicionarPocao(c, eixo, Number(nova.value), dados.teto));
		}
	};
	const sem = bloco.querySelector('.bm-sem-pocao');
	if (sem) {
		sem.hidden = nova.options.length > 0 || lista.itens.length >= dados.teto;
	}
}

/* ================= SUPORTE ================= */

/**
 * @param {Element} raiz a secao Suporte
 * @param {{config: object, skills: Array|null, teto: number}} dados
 * @param {(fn: (c: object) => object) => void} editar
 */
export function desenharSuporte(raiz, dados, editar) {
	const deSuporte = (dados.skills || []).filter(s => s.suporte === 'buff' || s.suporte === 'cura');
	const porId = new Map(deSuporte.map(s => [s.skillId, s]));
	const lista = lerSuporte(dados.config);

	const ol = raiz.querySelector('.bm-lista-suporte');
	ol.innerHTML = '';
	lista.forEach((e, i) => {
		const skill = porId.get(e.skillId) || null;
		const tipo = skill ? skill.suporte : e.gatilho === 'hp' ? 'cura' : 'buff';
		const li = criar('li', 'bm-item bm-suporte');
		li.setAttribute('data-indice', String(i));
		li.setAttribute('data-skill', String(e.skillId));
		const n = criar('span', 'bm-item-nome', skill ? skill.nome : '#' + e.skillId);
		n.setAttribute('translate', 'no');
		li.appendChild(n);
		li.appendChild(criar('span', 'bm-tipo bm-tipo--' + tipo, NOME_DO_TIPO[tipo]));

		const destino = criar('select', 'bm-destino');
		destino.setAttribute('aria-label', 'Em quem usar');
		for (const d of destinosDaSkill(skill)) {
			const o = criar('option', '', NOME_DO_DESTINO[d]);
			o.value = d;
			destino.appendChild(o);
		}
		if (![...destino.options].some(o => o.value === e.destino)) {
			// Entrada salva com um destino que a skill nao aceita mais: aparece, e o servidor aponta.
			const o = criar('option', '', NOME_DO_DESTINO[e.destino] || e.destino);
			o.value = e.destino;
			destino.appendChild(o);
		}
		destino.value = e.destino;
		destino.disabled = destino.options.length < 2;
		destino.onchange = () => editar(c => definirDestinoDoSuporte(c, i, destino.value, skill));
		li.appendChild(destino);

		const nivel = criar('select', 'bm-skill-nivel');
		nivel.setAttribute('aria-label', 'Nível de uso');
		const opt = criar('option', '', 'Aprendido');
		opt.value = 'aprendido';
		nivel.appendChild(opt);
		for (let k = 1; k <= ((skill && skill.aprendido) || 0); k++) {
			const o = criar('option', '', 'Nv ' + k);
			o.value = String(k);
			nivel.appendChild(o);
		}
		nivel.value = String(e.nivel);
		nivel.onchange = () =>
			editar(c => definirNivelDoSuporte(c, i, nivel.value === 'aprendido' ? 'aprendido' : Number(nivel.value)));
		li.appendChild(nivel);

		if (tipo === 'cura') {
			const rotulo = criar('label', 'bm-limiar-cura');
			rotulo.appendChild(criar('span', '', 'HP abaixo de'));
			const limiar = criar('input', 'bm-limiar');
			limiar.type = 'number';
			limiar.min = '1';
			limiar.max = '99';
			limiar.step = '1';
			limiar.inputMode = 'numeric';
			ligarNumero(limiar, e.limiar, v => editar(c => definirLimiarDaCura(c, i, v)));
			rotulo.appendChild(limiar);
			rotulo.appendChild(criar('span', '', '%'));
			li.appendChild(rotulo);
		}

		li.appendChild(botao('bm-sobe', '↑', 'Subir', () => editar(c => moverSuporte(c, i, -1)), i === 0));
		li.appendChild(botao('bm-desce', '↓', 'Descer', () => editar(c => moverSuporte(c, i, 1)), i === lista.length - 1));
		li.appendChild(botao('bm-remove', '×', 'Remover', () => editar(c => removerSuporte(c, i))));
		ol.appendChild(li);
	});

	// ADICIONAR: so as skills que o servidor marcou como suporte e que ainda nao estao "em mim".
	const nova = raiz.querySelector('.bm-novo-suporte');
	nova.innerHTML = '';
	for (const s of deSuporte) {
		if (!lista.some(e => e.skillId === s.skillId && e.destino === 'eu')) {
			const o = criar('option', '', s.nome + ' (' + NOME_DO_TIPO[s.suporte] + ')');
			o.value = String(s.skillId);
			nova.appendChild(o);
		}
	}
	const add = raiz.querySelector('.bm-add-suporte');
	add.disabled = nova.options.length === 0 || lista.length >= dados.teto;
	add.onclick = ev => {
		ev.stopImmediatePropagation();
		const skill = porId.get(Number(nova.value));
		if (skill) {
			editar(c => adicionarSuporte(c, skill, dados.teto));
		}
	};
	raiz.querySelector('.bm-adicionar').hidden = deSuporte.length === 0;
	raiz.querySelector('.bm-sem-suporte').hidden = deSuporte.length > 0;
}

/* ================= COLETA ================= */

/**
 * @param {Element} raiz a secao Coleta
 * @param {{config: object, teto: number, raioMinimo: number, raioMaximo: number, nomeDoItem?: (id: number) => string|null}} dados
 * @param {(fn: (c: object) => object) => void} editar
 */
export function desenharColeta(raiz, dados, editar) {
	const c = lerColeta(dados.config);
	const nome = nomeDoItemPor(dados);
	const ligada = raiz.querySelector('.bm-coletar');
	ligada.checked = c.ligada;
	ligada.onchange = () => editar(x => ligarColeta(x, ligada.checked));

	const raio = raiz.querySelector('.bm-raio-coleta');
	raio.min = String(dados.raioMinimo);
	raio.max = String(dados.raioMaximo);
	raio.value = String(c.raio);
	raio.oninput = () => editar(x => definirRaioDeColeta(x, raio.value, dados.raioMinimo, dados.raioMaximo));
	raiz.querySelector('.bm-raio-coleta-valor').textContent = String(c.raio);

	const ul = raiz.querySelector('.bm-ignorados');
	ul.innerHTML = '';
	for (const itemId of c.ignorar) {
		const li = criar('li', 'bm-ignorado');
		li.setAttribute('data-item', String(itemId));
		const n = criar('span', 'bm-item-nome', nome(itemId));
		n.setAttribute('translate', 'no');
		n.title = 'Item ' + itemId;
		li.appendChild(n);
		li.appendChild(botao('bm-remove', '×', 'Voltar a coletar', () => editar(x => deixarDeIgnorar(x, itemId))));
		ul.appendChild(li);
	}

	const entrada = raiz.querySelector('.bm-novo-ignorado');
	const add = raiz.querySelector('.bm-add-ignorado');
	const cheio = c.ignorar.length >= dados.teto;
	add.disabled = cheio;
	entrada.disabled = cheio;
	const confirmar = () => {
		const id = Number(entrada.value);
		if (Number.isInteger(id) && id > 0) {
			entrada.value = '';
			editar(x => ignorarItem(x, id, dados.teto));
		}
	};
	add.onclick = e => {
		e.stopImmediatePropagation();
		confirmar();
	};
	entrada.onkeydown = e => {
		if (e.key === 'Enter') {
			e.preventDefault();
			confirmar();
		}
	};
}
