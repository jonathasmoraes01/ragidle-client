/**
 * UI/Components/BotMenu/editorDeArmazem.js
 *
 * O DESENHO das abas Armazem e Perfis do menu do Bot (Fase 9, 08/10/2026), no
 * padrao de `editorDeManutencao.js`. Armazem edita o RASCUNHO (Aplicar
 * confirma). Perfis sao verbos IMEDIATOS (salvar a config confirmada, aplicar,
 * renomear, excluir): o servidor confirma cada um; aplicar nunca liga o Bot.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import {
	adicionarReposicao,
	alternarDeposito,
	candidatosDoArmazem,
	definirCidade,
	definirPesoDoGatilho,
	definirReposicao,
	definirReserva,
	definirTetoDeGasto,
	definirVoltar,
	lerArmazem,
	ligarArmazem,
	removerReposicao
} from './edicaoDeArmazem.js';
import { desenharSeletorDeItem } from './seletorDeItem.js';

const NOME_DA_POSTURA = Object.freeze({
	tank: 'Tanque',
	'melee-dps': 'Dano corpo a corpo',
	'ranged-dps': 'Dano à distância',
	'ranged-buff-ataque': 'Suporte e ataque',
	'ranged-buff': 'Só suporte'
});

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

function ligarNumero(input, valor, aoMudar) {
	if (input.ownerDocument.activeElement !== input) {
		input.value = String(valor);
	}
	input.onchange = () => aoMudar(input.value);
}

/** O icone e o nome do item numa linha da lista (05 secao 3: nunca o id na tela). */
function cabecaDoItem(li, itemId, nome, iconeDoItem) {
	const img = criar('img', 'bm-item-icone');
	img.alt = '';
	img.setAttribute('aria-hidden', 'true');
	if (iconeDoItem) {
		iconeDoItem(img, itemId);
	}
	li.appendChild(img);
	const n = criar('span', 'bm-item-nome', nome);
	n.setAttribute('translate', 'no');
	li.appendChild(n);
}

/**
 * @param {Element} raiz a secao Armazem
 * @param {{config: object, cidades: Array, limites: object, nomeDoItem?: (id: number) => string|null,
 *          mochila?: () => Array<{itemId: number, quantidade?: number}>, pocoes?: Array|null, municoes?: Array|null,
 *          iconeDoItem?: (img: HTMLImageElement, id: number) => void}} dados
 * @param {(fn: (c: object) => object) => void} editar
 */
export function desenharArmazem(raiz, dados, editar) {
	const a = lerArmazem(dados.config);
	const lim = dados.limites || {};
	// O nome do cliente; sem ele, o que o servidor mandou nas listas; senao uma frase (nunca o id).
	const doServidor = new Map([...(dados.pocoes || []), ...(dados.municoes || [])].filter(x => x && typeof x.nome === 'string').map(x => [x.itemId, x.nome]));
	const nome = id => (dados.nomeDoItem && dados.nomeDoItem(id)) || doServidor.get(id) || 'Item desconhecido';
	const fontes = () => ({ mochila: dados.mochila ? dados.mochila() : [], pocoes: dados.pocoes || [], municoes: dados.municoes || [] });

	const ligado = raiz.querySelector('.bm-armazem-ligado');
	ligado.checked = a.ligado;
	ligado.onchange = () => editar(c => ligarArmazem(c, ligado.checked));

	const cidade = raiz.querySelector('.bm-armazem-cidade');
	cidade.innerHTML = '';
	const vazio = criar('option', '', 'Escolha a cidade');
	vazio.value = '';
	cidade.appendChild(vazio);
	const cidades = [...(dados.cidades || [])];
	if (a.cidade !== null && !cidades.some(c => c.mapa === a.cidade)) {
		cidades.push({ mapa: a.cidade, rotulo: a.cidade });
	}
	for (const c of cidades) {
		const o = criar('option', '', c.rotulo);
		o.value = c.mapa;
		cidade.appendChild(o);
	}
	cidade.value = a.cidade || '';
	cidade.onchange = () => editar(c => definirCidade(c, cidade.value));

	ligarNumero(raiz.querySelector('.bm-armazem-peso'), a.pesoAcimaDe, v => editar(c => definirPesoDoGatilho(c, v)));
	ligarNumero(raiz.querySelector('.bm-armazem-teto'), a.tetoDeGasto, v =>
		editar(c => definirTetoDeGasto(c, v, lim.tetoDeGastoMaximo))
	);
	const voltar = raiz.querySelector('.bm-armazem-voltar');
	voltar.checked = a.voltar;
	voltar.onchange = () => editar(c => definirVoltar(c, voltar.checked));

	// DEPOSITAR: os itens autorizados, com a reserva (quanto fica na mochila).
	const ul = raiz.querySelector('.bm-armazem-depositar');
	ul.innerHTML = '';
	for (const itemId of a.depositar) {
		const li = criar('li', 'bm-item bm-deposito');
		li.setAttribute('data-item', String(itemId));
		cabecaDoItem(li, itemId, nome(itemId), dados.iconeDoItem);
		const rotulo = criar('label', 'bm-reserva');
		rotulo.appendChild(criar('span', '', 'manter'));
		const reserva = criar('input', 'bm-reserva-qtd');
		reserva.type = 'number';
		reserva.min = '0';
		reserva.max = '30000';
		reserva.inputMode = 'numeric';
		reserva.setAttribute('aria-label', 'Quantidade que fica na mochila');
		const atual = a.reservas.find(r => r.itemId === itemId);
		ligarNumero(reserva, atual ? atual.quantidade : 0, v => editar(c => definirReserva(c, itemId, v, lim.reservasNoDeposito)));
		rotulo.appendChild(reserva);
		li.appendChild(rotulo);
		li.appendChild(botao('bm-remove', '×', 'Não guardar mais', () => editar(c => alternarDeposito(c, itemId))));
		ul.appendChild(li);
	}
	desenharSeletorDeItem(
		raiz.querySelector('.bm-escolher-deposito'),
		{
			nome: 'armazem-guardar',
			candidatos: () => candidatosDoArmazem('depositar', dados.config, fontes(), dados.nomeDoItem),
			cheio: a.depositar.length >= (lim.itensNoDeposito || Infinity),
			vazio: 'Nada na mochila para guardar.',
			iconeDoItem: dados.iconeDoItem
		},
		id => editar(c => alternarDeposito(c, id, lim.itensNoDeposito))
	);

	// REPOR: comprar abaixo do minimo, ate o alvo.
	const ol = raiz.querySelector('.bm-armazem-repor');
	ol.innerHTML = '';
	for (const r of a.repor) {
		const li = criar('li', 'bm-item bm-reposicao');
		li.setAttribute('data-item', String(r.itemId));
		cabecaDoItem(li, r.itemId, nome(r.itemId), dados.iconeDoItem);
		for (const [campo, texto] of [
			['minimo', 'abaixo de'],
			['ate', 'até']
		]) {
			const rot = criar('label', 'bm-repor-' + campo);
			rot.appendChild(criar('span', '', texto));
			const inp = criar('input', 'bm-repor-qtd');
			inp.type = 'number';
			inp.min = '0';
			inp.max = '30000';
			inp.inputMode = 'numeric';
			inp.setAttribute('data-campo', campo);
			ligarNumero(inp, r[campo], v => editar(c => definirReposicao(c, r.itemId, campo, v)));
			rot.appendChild(inp);
			li.appendChild(rot);
		}
		li.appendChild(botao('bm-remove', '×', 'Não repor mais', () => editar(c => removerReposicao(c, r.itemId))));
		ol.appendChild(li);
	}
	desenharSeletorDeItem(
		raiz.querySelector('.bm-escolher-reposicao'),
		{
			nome: 'armazem-repor',
			candidatos: () => candidatosDoArmazem('repor', dados.config, fontes(), dados.nomeDoItem),
			cheio: a.repor.length >= (lim.itensNaReposicao || Infinity),
			vazio: 'Nenhum consumível conhecido. Tenha o item na mochila para escolhê-lo.',
			iconeDoItem: dados.iconeDoItem
		},
		id => editar(c => adicionarReposicao(c, id, lim.itensNaReposicao))
	);
}

/**
 * @param {Element} raiz a secao Perfis
 * @param {{perfis: Array, perfilAtivo: string|null, pendente: boolean, nomeMaximo: number}} dados
 * @param {{salvar: (nome: string) => void, aplicar: (nome: string) => void, renomear: (de: string, para: string) => void, excluir: (nome: string) => void}} verbos
 */
export function desenharPerfis(raiz, dados, verbos) {
	const ul = raiz.querySelector('.bm-perfis');
	ul.innerHTML = '';
	for (const p of dados.perfis || []) {
		const li = criar('li', 'bm-item bm-perfil' + (p.nome === dados.perfilAtivo ? ' is-ativo' : ''));
		li.setAttribute('data-perfil', p.nome);
		const n = criar('span', 'bm-item-nome', p.nome);
		n.setAttribute('translate', 'no');
		li.appendChild(n);
		li.appendChild(criar('span', 'bm-tipo', NOME_DA_POSTURA[p.postura] || p.postura));
		li.appendChild(botao('bm-perfil-aplicar', 'Usar', 'Usar este perfil', () => verbos.aplicar(p.nome), dados.pendente));
		li.appendChild(
			botao('bm-perfil-renomear', 'Renomear', 'Renomear', () => {
				const entrada = raiz.querySelector('.bm-perfil-nome');
				const para = entrada.value.trim();
				if (para) {
					entrada.value = '';
					verbos.renomear(p.nome, para);
				}
			}, dados.pendente)
		);
		li.appendChild(botao('bm-remove', '×', 'Excluir perfil', () => verbos.excluir(p.nome), dados.pendente));
		ul.appendChild(li);
	}
	raiz.querySelector('.bm-sem-perfil').hidden = (dados.perfis || []).length > 0;
	const entrada = raiz.querySelector('.bm-perfil-nome');
	entrada.maxLength = dados.nomeMaximo || 24;
	const salvar = raiz.querySelector('.bm-perfil-salvar');
	salvar.disabled = !!dados.pendente;
	salvar.onclick = e => {
		e.stopImmediatePropagation();
		const nome = entrada.value.trim();
		if (nome) {
			entrada.value = '';
			verbos.salvar(nome);
		}
	};
}
