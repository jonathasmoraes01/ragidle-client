/**
 * DB/Items/fichasDeItem.js
 *
 * O PESO E A RARIDADE DE CADA ITEM — o dado que o GRF nao tem (D-919,
 * 02/09/2026).
 *
 * ## O buraco
 *
 * `ItemTable.js` nasce das tabelas do cliente oficial: nome, icone, descricao,
 * slot, `ClassNum`. **Peso nao esta la** — nem no GRF, nem em lugar nenhum
 * deste repositorio. A loja moderna, porem, ja tinha sido escrita como se
 * estivesse: `NpcStoreV2.js` montava `Peso ${info.weight / 10}` na linha do
 * item e `calculateWeight()` somava `DB.getItemInfo(ITID).weight`. Os dois
 * liam `undefined` desde o primeiro dia: a meta nunca imprimiu peso nenhum
 * (a condicao `if (info && info.weight)` engolia o caso) e a soma sempre
 * devolveu **zero**, sem erro e sem sintoma. Codigo morto que parecia vivo.
 *
 * ## A fonte
 *
 * `/ragidle/fichas-de-item.json`, publicado pelo repositorio do jogo
 * (`scripts/publicar-fichas-de-item.ts`) a partir do `item_db` do rAthena
 * via `conteudo.json` — o cabecalho daquele script e o lugar onde cada numero
 * esta explicado, inclusive de onde sai a escada de raridade e por que o
 * degrau de cima e o limiar de anuncio de drop raro do jogo (D-631).
 *
 * O arquivo cobre 100% do que uma loja consegue mostrar: o servidor OCULTA da
 * vitrine todo item fora do recorte, e pula pelo mesmo caminho o inventario
 * sem ficha. Ainda assim, **todo leitor aqui devolve `null` para id
 * desconhecido** — a tela decide o que fazer com a ausencia, e nenhuma delas
 * inventa peso zero (regra 1 do projeto: onde o dado nao existe, ele falta,
 * nao vira um numero plausivel).
 *
 * ## A carga
 *
 * Uma vez por sessao, sob demanda (`carregarFichasDeItem()`), e nunca no
 * caminho quente: quem abre uma loja pede a promessa e redesenha quando ela
 * chega. Falha de rede nao derruba nada — as fichas ficam vazias, a loja
 * abre sem a coluna de peso, e o console registra o motivo.
 *
 * @author RagIdle
 */

/** O `v` que este modulo sabe ler. Contrato diferente = arquivo recusado. */
const VERSAO_ACEITA = 1;

const CAMINHO = '/ragidle/fichas-de-item.json';

/**
 * Classe do ladrilho (`.ri-tile`) por raridade — a pele mora em Common.css e
 * ate hoje nao tinha consumidor nenhum: o design system desenhou a borda de
 * raridade antes de existir raridade no jogo.
 *
 * Comum nao tem classe DE PROPOSITO: o normal e o aro dourado padrao do
 * ladrilho, e pintar todo mundo apagaria o destaque dos tres que importam.
 */
export const CLASSE_DE_RARIDADE = ['', 'is-uncommon', 'is-rare', 'is-unique'];

/** @type {Map<number, {peso: number, raridade: number, chance: number, tipo: number}>} */
const _fichas = new Map();

/** @type {Promise<boolean>|null} a carga em curso (ou a que ja terminou) */
let _carga = null;

/**
 * Le o JSON publicado para dentro do mapa. Exportada para o teste poder
 * exercitar o formato sem rede.
 *
 * @param {object} dados - o objeto do arquivo
 * @returns {number} quantas fichas entraram
 */
export function absorverFichasDeItem(dados) {
	_fichas.clear();

	if (!dados || dados.v !== VERSAO_ACEITA || !dados.itens) {
		throw new Error(`fichas-de-item.json: versao ${dados && dados.v} nao reconhecida (esperava ${VERSAO_ACEITA})`);
	}

	for (const id in dados.itens) {
		const linha = dados.itens[id];
		if (!Array.isArray(linha) || linha.length < 4) {
			continue;
		}
		_fichas.set(parseInt(id, 10), {
			peso: linha[0],
			raridade: linha[1],
			chance: linha[2],
			tipo: linha[3]
		});
	}

	return _fichas.size;
}

/**
 * Carrega o arquivo uma vez por sessao. Chamar de novo devolve a MESMA
 * promessa — inclusive depois de falhar, porque repetir a busca a cada loja
 * aberta so multiplicaria o erro no console.
 *
 * @returns {Promise<boolean>} true se ha fichas para consultar
 */
export function carregarFichasDeItem() {
	if (_carga) {
		return _carga;
	}

	_carga = fetch(CAMINHO)
		.then(resposta => {
			if (!resposta.ok) {
				throw new Error(`HTTP ${resposta.status}`);
			}
			return resposta.json();
		})
		.then(dados => absorverFichasDeItem(dados) > 0)
		.catch(erro => {
			// Sem peso e sem raridade a loja continua funcionando: e a coluna
			// que some, nao a compra. Registrar o motivo importa mais do que
			// interromper — este arquivo e publicado pelo OUTRO repositorio, e
			// "sumiu na publicacao" e a falha provavel.
			console.warn(`[fichasDeItem] ${CAMINHO} nao carregou (${erro.message}); loja sem peso/raridade`);
			return false;
		});

	return _carga;
}

/**
 * @param {number} itid
 * @returns {{peso: number, raridade: number, chance: number, tipo: number}|null}
 */
export function fichaDeItem(itid) {
	return _fichas.get(itid) || null;
}

/**
 * Peso de UMA unidade, em decigramas — a mesma unidade de
 * `Session.Entity.weight` e do `Weight` do item_db (Red Potion = 70).
 *
 * @param {number} itid
 * @returns {number|null} null quando o item nao esta na tabela
 */
export function pesoDeItem(itid) {
	const ficha = _fichas.get(itid);
	return ficha ? ficha.peso : null;
}

/**
 * @param {number} itid
 * @returns {number} 0 Comum · 1 Incomum · 2 Raro · 3 Lendario (0 no desconhecido)
 */
export function raridadeDeItem(itid) {
	const ficha = _fichas.get(itid);
	return ficha ? ficha.raridade : 0;
}

/**
 * A melhor chance de drop do item, em decimos de milesimo (7000 = 70%).
 *
 * @param {number} itid
 * @returns {number} -1 quando nenhum monstro solta (so loja/quest) ou o item
 *                   nao esta na tabela
 */
export function chanceDeDropDeItem(itid) {
	const ficha = _fichas.get(itid);
	return ficha ? ficha.chance : -1;
}

/**
 * O tipo do cliente (`enum item_types`) do item — a reserva de quem monta
 * categoria: o pacote de vitrine manda o tipo, mas nem todo tipo de loja
 * manda (a de pontos, por exemplo), e a categoria errada e pior que a
 * generica.
 *
 * @param {number} itid
 * @returns {number|null}
 */
export function tipoDeItem(itid) {
	const ficha = _fichas.get(itid);
	return ficha ? ficha.tipo : null;
}
