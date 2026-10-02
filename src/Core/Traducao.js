/**
 * Core/Traducao.js
 *
 * O TRADUTOR NA BORDA (D-1929, 01/10/2026 — o jogo em ingles).
 *
 * O servidor fala portugues e o cliente foi escrito em portugues. Em vez de
 * reescrever as ~4.500 frases dos dois lados, o cliente traduz o texto NA
 * HORA DE MOSTRAR, por um catalogo pt->en publicado pelo repositorio do jogo
 * (`npm run publicar:idioma` -> `/ragidle/i18n/en/catalogo.json`). O contrato
 * do catalogo mora em `docs/PLANO-IDIOMA-INGLES.md` (repositorio do jogo).
 *
 * A ordem da busca, para um texto:
 *  1. EXATO: o texto normalizado e uma chave do catalogo;
 *  2. MODELO: o texto casa com um modelo com lacunas ("{0} conseguiu {1}");
 *     vence o modelo com mais letras fora das lacunas, e cada lacuna e
 *     traduzida de novo (nome de item, de monstro, numero no formato
 *     brasileiro), salvo as marcadas `cru` (nome de jogador);
 *  3. SEGMENTOS: o texto partido em numeros e separadores, cada pedaco com
 *     letras traduzido EXATO — tudo ou nada: meia frase em cada idioma nao
 *     sai;
 *  4. a falta: devolve o texto INTACTO e anota (a sonda em tela le a lista).
 *
 * Em portugues (o padrao) o tradutor nem liga: `traduzir` devolve o mesmo
 * texto, e nada muda para quem joga hoje.
 *
 * @author RagIdle
 */

/** O `v` do catalogo que este modulo le. Outro = recusado (a falha e alta). */
export const VERSAO_DO_CATALOGO = 1;

/** Onde o catalogo e publicado, por idioma. */
export const CAMINHO_DO_CATALOGO = { en: '/ragidle/i18n/en/catalogo.json' };

/** Modelo com menos letras que isto fora das lacunas e composicao, nao frase. */
export const LETRAS_MINIMAS_DO_MODELO = 4;

/** Quantas vezes uma lacuna pode ser traduzida dentro de outra. */
const PROFUNDIDADE_MAXIMA = 4;

/** Teto das listas em memoria (cache e faltas), para um texto que muda a cada tique nao crescer sem fim. */
const TETO_DO_CACHE = 20000;
const TETO_DAS_FALTAS = 5000;

const LETRA = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

/** Um nome proprio sem acento: palavras que comecam com maiuscula ("Orc Warrior", "Baphomet"). */
const NOME_PROPRIO = /^[A-Z][A-Za-z'’.-]*(?: [A-Z][A-Za-z'’.-]*)*$/;

/** @type {Map<string, string>} */
const _exatos = new Map();
/** @type {Array<{pt: string, en: string, cru: Set<number>, ordem: number[], regex: RegExp, ancora: string, letras: number}>} */
let _modelos = [];
/** @type {Map<string, string|null>} o resultado de cada texto ja visto (null = falta) */
const _cache = new Map();
/** @type {Set<string>} os textos com letra que nao achamos */
const _faltas = new Set();

let _ativo = false;

/**
 * A NORMALIZACAO do contrato (secao 3.2): todo trecho de espaco em branco
 * (inclusive quebra de linha e o espaco duro U+00A0, que o `\s` do JS ja
 * inclui) vira UM espaco, e as pontas saem. Maiusculas, acentos e pontuacao
 * ficam. O extrator do repositorio do jogo normaliza IGUAL — os vetores de
 * ouro dele (`i18n/vetores-de-normalizacao.json`) sao o teste dos dois lados.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
	return String(texto).replace(/\s+/g, ' ').trim();
}

/** Conta letras (as do portugues inclusive). */
function contarLetras(texto) {
	let n = 0;
	for (const c of texto) {
		if (LETRA.test(c)) {
			n++;
		}
	}
	return n;
}

function escaparRegex(texto) {
	return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compila um modelo do catalogo. Lanca quando ele e malformado — o publicador
 * ja recusa isso, e chegar aqui assim e defeito de publicacao.
 *
 * @param {{pt: string, en: string, cru?: number[]}} bruto
 */
export function compilarModelo(bruto) {
	if (!bruto || typeof bruto.pt !== 'string' || typeof bruto.en !== 'string') {
		throw new Error(`modelo malformado: ${JSON.stringify(bruto)}`);
	}
	const pt = normalizar(bruto.pt);
	const pedacos = pt.split(/\{(\d+)\}/);
	// pedacos: [literal, indice, literal, indice, ..., literal]
	const literais = [];
	const ordem = [];
	/*
	 * GRUPOS DE LACUNAS: lacunas COLADAS ("{0}{1}") viram UM grupo de captura —
	 * a expressao nao tem como saber onde uma acaba e a outra comeca, e partir
	 * no primeiro caractere (o que o `(.+?)` fazia) traduzia meio nome. O valor
	 * inteiro vai na primeira lacuna do grupo, e as outras saem vazias.
	 */
	const grupos = [];
	let fonte = '^';
	for (let i = 0; i < pedacos.length; i++) {
		if (i % 2 === 0) {
			literais.push(pedacos[i]);
			fonte += escaparRegex(pedacos[i]);
			continue;
		}
		const indice = parseInt(pedacos[i], 10);
		ordem.push(indice);
		const antes = pedacos[i - 1];
		if (antes === '' && i > 1) {
			grupos[grupos.length - 1].push(indice);
			continue;
		}
		grupos.push([indice]);
		/*
		 * A LACUNA COLADA NUMA PALAVRA PODE SAIR VAZIA: "falta{0}" e o plural
		 * ("falta"/"faltam"), "ligada{2}" e um sufixo opcional. Lacuna entre
		 * espacos continua exigindo pelo menos um caractere.
		 */
		const depois = pedacos[i + 1] || '';
		const colada = /\S$/.test(antes) || /^\S/.test(depois);
		fonte += colada ? '(.*?)' : '(.+?)';
	}
	fonte += '$';
	if (ordem.length === 0) {
		throw new Error(`modelo sem lacuna (devia ser exato): ${pt}`);
	}
	for (const m of bruto.en.matchAll(/\{(\d+)\}/g)) {
		if (!ordem.includes(parseInt(m[1], 10))) {
			throw new Error(`modelo com lacuna {${m[1]}} no ingles que nao existe no portugues: ${pt}`);
		}
	}
	const letras = contarLetras(literais.join(''));
	if (letras < LETRAS_MINIMAS_DO_MODELO) {
		throw new Error(`modelo com ${String(letras)} letras fora das lacunas e composicao, nao frase: ${pt}`);
	}
	const ancora = literais.reduce((a, b) => (b.length > a.length ? b : a), '');
	return {
		pt,
		en: bruto.en,
		cru: new Set(Array.isArray(bruto.cru) ? bruto.cru : []),
		ordem,
		grupos,
		regex: new RegExp(fonte),
		ancora,
		letras
	};
}

/**
 * Le o catalogo publicado para a memoria e LIGA o tradutor.
 *
 * @param {object} dados - o objeto do `catalogo.json`
 * @returns {{exatos: number, modelos: number}}
 */
export function absorverCatalogo(dados) {
	if (!dados || dados.v !== VERSAO_DO_CATALOGO || typeof dados.exatos !== 'object' || !Array.isArray(dados.modelos)) {
		throw new Error(`catalogo de traducao: versao ${dados && dados.v} nao reconhecida (esperava ${VERSAO_DO_CATALOGO})`);
	}
	_exatos.clear();
	_cache.clear();
	_faltas.clear();
	for (const pt of Object.keys(dados.exatos)) {
		const en = dados.exatos[pt];
		if (typeof en === 'string' && en !== '') {
			_exatos.set(normalizar(pt), en);
		}
	}
	_modelos = dados.modelos.map(compilarModelo);
	// O de mais letras primeiro: o primeiro que casa ja e o mais especifico. No
	// empate, o mais longo ("Tamanho do chat: {0}. {1}" antes de "...: {0}").
	_modelos.sort((a, b) => b.letras - a.letras || b.pt.length - a.pt.length);
	_ativo = true;
	return { exatos: _exatos.size, modelos: _modelos.length };
}

/** Desliga e esvazia (o idioma portugues, e os testes). */
export function desligarTraducao() {
	_ativo = false;
	_exatos.clear();
	_modelos = [];
	_cache.clear();
	_faltas.clear();
}

/** @returns {boolean} se ha catalogo carregado e o tradutor esta traduzindo */
export function traducaoLigada() {
	return _ativo;
}

/**
 * NUMERO NO FORMATO BRASILEIRO -> INGLES: "1.234,5" -> "1,234.5", "2,5" ->
 * "2.5". So o que e numero brasileiro SEM DUVIDA (grupos de 3 depois do
 * ponto, ou virgula decimal) e trocado; "1.5" fica como esta.
 *
 * @param {string} texto
 * @returns {string|null} null quando nao e numero brasileiro
 */
export function numeroParaIngles(texto) {
	// O sinal e o "%" ficam onde estao ("+0,5%" -> "+0.5%").
	const partes = /^([-+]?)(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+)(%?)$/.exec(texto);
	if (!partes) {
		return null;
	}
	return partes[1] + partes[2].replace(/[.,]/g, c => (c === '.' ? ',' : '.')) + partes[3];
}

function anotarFalta(texto) {
	if (_faltas.size < TETO_DAS_FALTAS && LETRA.test(texto)) {
		_faltas.add(texto);
	}
}

function traduzirLacuna(valor, profundidade) {
	// O espaco das PONTAS fica: em "o VIP{1}" a lacuna vale " ativo", e a
	// traducao sem o espaco colava "VIPactive".
	const pontas = /^(\s*)([\s\S]*?)(\s*)$/.exec(valor);
	const miolo = pontas[2];
	if (!miolo) {
		return valor;
	}
	const numero = numeroParaIngles(miolo);
	if (numero !== null) {
		return pontas[1] + numero + pontas[3];
	}
	if (profundidade > PROFUNDIDADE_MAXIMA || !LETRA.test(miolo)) {
		return valor;
	}
	const r = buscar(normalizar(miolo), profundidade);
	return r === null ? valor : pontas[1] + r + pontas[3];
}

function preencher(modelo, casamento, profundidade) {
	const porIndice = new Map();
	modelo.grupos.forEach((grupo, k) => {
		// O valor do grupo vai inteiro na PRIMEIRA lacuna; as coladas nela, vazias.
		grupo.forEach((indice, j) => porIndice.set(indice, j === 0 ? casamento[k + 1] : ''));
	});
	return modelo.en.replace(/\{(\d+)\}/g, (_, d) => {
		const indice = parseInt(d, 10);
		const valor = porIndice.get(indice);
		if (valor === undefined) {
			return '';
		}
		return modelo.cru.has(indice) ? valor : traduzirLacuna(valor, profundidade + 1);
	});
}

/**
 * Os SEGMENTOS: separa numeros e separadores comuns de interface
 * ("3 missoes", "Nivel 10 · Prontera", "Peso: 50"). Tudo ou nada.
 */
function porSegmentos(texto, profundidade) {
	const pedacos = texto.split(/(\s*[·•|:()[\]/×]\s*|\s*[-+]?\d[\d.,]*%?\s*)/);
	if (pedacos.length < 2) {
		return null;
	}
	let traduziuAlgum = false;
	const saida = [];
	for (const pedaco of pedacos) {
		if (pedaco === undefined || pedaco === '') {
			continue;
		}
		const miolo = pedaco.trim();
		if (!LETRA.test(miolo)) {
			const numero = numeroParaIngles(miolo);
			saida.push(numero === null ? pedaco : pedaco.replace(miolo, numero));
			continue;
		}
		const exato = _exatos.get(normalizar(miolo));
		if (exato === undefined) {
			/* NOME PROPRIO IGUAL NOS DOIS IDIOMAS ("Baphomet", "Orc Warrior"): os
			   geradores de dados nao gravam a identidade, e sem isto "MVP ·
			   Baphomet" nunca traduzia. Passa intocado o pedaco que e so palavras
			   com MAIUSCULA e sem acento — frase portuguesa (minuscula, ou com
			   acento) continua derrubando o texto inteiro. */
			if (NOME_PROPRIO.test(miolo)) {
				saida.push(pedaco);
				continue;
			}
			return null;
		}
		traduziuAlgum = true;
		saida.push(pedaco.replace(miolo, exato));
	}
	return traduziuAlgum ? saida.join('') : null;
}

/**
 * A LISTA: pedacos juntados por virgula, " + " ou " - " ("120 de EXP de base,
 * 5x Pocao Vermelha", "Bebe Selvagem - Iniciante"). Cada pedaco passa pela
 * busca inteira (exato, modelo, segmentos) e o prefixo "5x " fica. Tudo ou nada.
 */
function porLista(texto, profundidade) {
	if (profundidade > PROFUNDIDADE_MAXIMA) {
		return null;
	}
	const pedacos = texto.split(/(,\s+|\s+[+-]\s+)/);
	if (pedacos.length < 3 && !/^\d[\d.,]*x\s+/.test(texto)) {
		return null;
	}
	const saida = [];
	for (let i = 0; i < pedacos.length; i++) {
		const pedaco = pedacos[i];
		if (i % 2 === 1) {
			saida.push(pedaco);
			continue;
		}
		const miolo = pedaco.trim();
		if (miolo === '') {
			return null;
		}
		const comQuantidade = /^(\d[\d.,]*x\s+)([\s\S]+)$/.exec(miolo);
		const prefixo = comQuantidade ? comQuantidade[1] : '';
		const resto = comQuantidade ? comQuantidade[2] : miolo;
		if (!LETRA.test(resto)) {
			saida.push(pedaco);
			continue;
		}
		const r = buscar(normalizar(resto), profundidade + 1);
		if (r === null) {
			return null;
		}
		saida.push(prefixo + r);
	}
	return saida.join('');
}

/**
 * A busca, sobre o texto JA normalizado.
 *
 * @returns {string|null} a traducao, ou null quando falta
 */
function buscar(n, profundidade) {
	const exato = _exatos.get(n);
	if (exato !== undefined) {
		return exato;
	}
	for (const modelo of _modelos) {
		if (modelo.ancora && !n.includes(modelo.ancora)) {
			continue;
		}
		const casamento = modelo.regex.exec(n);
		if (casamento) {
			return preencher(modelo, casamento, profundidade);
		}
	}
	return porSegmentos(n, profundidade) ?? porLista(n, profundidade);
}

/**
 * TRADUZ um texto para o idioma do catalogo carregado.
 *
 * Devolve o MESMO texto quando o tradutor esta desligado (portugues), quando
 * nao ha letra (so numero/simbolo) ou quando falta traducao. O espacamento
 * das pontas e preservado (o no de texto do DOM depende dele).
 *
 * @param {string} texto
 * @returns {string}
 */
export function traduzir(texto) {
	if (!_ativo || typeof texto !== 'string' || texto === '') {
		return texto;
	}
	const pontas = /^(\s*)([\s\S]*?)(\s*)$/.exec(texto);
	const inicio = pontas[1];
	const miolo = pontas[2];
	const fim = pontas[3];
	if (!LETRA.test(miolo)) {
		// SO NUMERO: o "4.985,00" de RO Cash que o servidor manda pronto, sozinho
		// num no. Em ingles ele le "um ponto nove", entao o formato vira.
		const numero = numeroParaIngles(miolo);
		return numero === null ? texto : inicio + numero + fim;
	}
	const n = normalizar(miolo);

	let r = _cache.get(n);
	if (r === undefined) {
		r = buscar(n, 0);
		if (_cache.size >= TETO_DO_CACHE) {
			_cache.clear();
		}
		_cache.set(n, r);
		if (r === null) {
			anotarFalta(n);
		}
	}
	return r === null ? texto : inicio + r + fim;
}

/**
 * A traducao de um texto INTEIRO, ou null quando nao ha (sem anotar falta).
 * Para quem junta pedacos antes de traduzir — o dialogo de NPC, que o
 * servidor quebra em linhas de 116 caracteres — e quer saber se o todo
 * casou antes de trocar o que esta na tela.
 *
 * @param {string} texto
 * @returns {string|null}
 */
export function traducaoDe(texto) {
	if (!_ativo || typeof texto !== 'string' || !LETRA.test(texto)) {
		return null;
	}
	const n = normalizar(texto);
	const r = _cache.has(n) ? _cache.get(n) : buscar(n, 0);
	return r === undefined ? null : r;
}

/** Os textos com letra que nao acharam traducao desde que o catalogo carregou (a sonda le). */
export function faltasDeTraducao() {
	return [..._faltas];
}

/**
 * Busca e absorve o catalogo do idioma. Sem catalogo o jogo continua em
 * portugues — e o motivo vai ao console, porque o arquivo e publicado pelo
 * OUTRO repositorio e "sumiu na publicacao" e a falha provavel.
 *
 * @param {string} idioma
 * @param {function} [buscarArquivo] - injetavel no teste; o padrao e `fetch`
 * @returns {Promise<boolean>} se o tradutor ligou
 */
export function carregarCatalogo(idioma, buscarArquivo) {
	const caminho = CAMINHO_DO_CATALOGO[idioma];
	if (!caminho) {
		return Promise.resolve(false);
	}
	const buscarFn = buscarArquivo || (url => fetch(url));
	return Promise.resolve()
		.then(() => buscarFn(caminho))
		.then(resposta => {
			if (!resposta.ok) {
				throw new Error(`HTTP ${resposta.status}`);
			}
			return resposta.json();
		})
		.then(dados => {
			const lido = absorverCatalogo(dados);
			console.log(`[traducao] ${caminho}: ${String(lido.exatos)} frases e ${String(lido.modelos)} modelos`);
			return true;
		})
		.catch(erro => {
			console.warn(`[traducao] ${caminho} nao carregou (${erro.message}); o jogo segue em portugues`);
			return false;
		});
}
