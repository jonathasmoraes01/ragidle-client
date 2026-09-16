/**
 * DB/Skills/areasDeSkill.js
 *
 * O TAMANHO DO CIRCULO DE CONJURACAO - o do nosso servidor, por skill e por
 * nivel (13/09/2026, relato do dono).
 *
 * ## O buraco
 *
 * O circulo que aparece no chao durante a conjuracao (`EF_GROUNDSAMPLE` ->
 * `MagicTarget.js`) tirava o tamanho de uma tabela FIXA do roBrowser
 * (`CastSize`), escrita para o servidor oficial. O nosso nao e o oficial em
 * area: o dono dobrou a `SplashArea` de toda skill (`MULTIPLICADOR_DE_AREA_DO_DONO`,
 * 31/08/2026). O circulo da Chuva de Meteoros dizia 7 celulas enquanto os
 * meteoros caiam num 13x13 - o jogador via uma area e apanhava noutra.
 *
 * ## A fonte
 *
 * `/ragidle/areas-de-skill.json`, publicado pelo repositorio do jogo
 * (`scripts/publicar-areas-de-skill.ts`) a partir da MESMA resolucao de
 * habilidade que o servidor usa para ferir. O cabecalho daquele script diz qual
 * raio vira circulo em cada tipo de skill.
 *
 * ## A carga
 *
 * Uma vez por sessao (`carregarAreasDeSkill()`). Sem o arquivo nada quebra: o
 * `MagicTarget` cai na tabela antiga do roBrowser, que e o comportamento de
 * antes - so o tamanho fica o do servidor oficial.
 *
 * @author RagIdle
 */

/** O `v` que este modulo sabe ler. Contrato diferente = arquivo recusado. */
const VERSAO_ACEITA = 1;

const CAMINHO = '/ragidle/areas-de-skill.json';

/** @type {Map<number, number[]>} SKID -> diametro em celulas, por nivel (indice 0 = nivel 1) */
const _aneis = new Map();

/** @type {Promise<boolean>|null} */
let _carga = null;

/**
 * Le o JSON publicado para dentro do mapa. Exportada para o teste exercitar o
 * formato sem rede.
 *
 * @param {object} dados - o objeto do arquivo
 * @returns {number} quantas skills entraram
 */
export function absorverAreasDeSkill(dados) {
	_aneis.clear();

	if (!dados || dados.v !== VERSAO_ACEITA || !dados.aneis) {
		throw new Error(`areas-de-skill.json: versao ${dados && dados.v} nao reconhecida (esperava ${VERSAO_ACEITA})`);
	}

	for (const skid in dados.aneis) {
		const porNivel = dados.aneis[skid];
		if (!Array.isArray(porNivel) || porNivel.length === 0) {
			continue;
		}
		if (!porNivel.every(n => Number.isInteger(n) && n >= 1 && n % 2 === 1)) {
			// Diametro de circulo em celulas e sempre impar (o centro + raio para
			// cada lado). Uma linha que nao e isso e publicacao quebrada, e
			// desenhar um circulo torto seria pior que cair na tabela antiga.
			continue;
		}
		_aneis.set(parseInt(skid, 10), porNivel.slice());
	}

	return _aneis.size;
}

/**
 * Carrega o arquivo uma vez por sessao. Chamar de novo devolve a MESMA promessa.
 *
 * @returns {Promise<boolean>} true se ha areas para consultar
 */
export function carregarAreasDeSkill() {
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
		.then(dados => absorverAreasDeSkill(dados) > 0)
		.catch(erro => {
			console.warn(`[areasDeSkill] ${CAMINHO} nao carregou (${erro.message}); circulo com a tabela do roBrowser`);
			return false;
		});

	return _carga;
}

/**
 * O diametro do circulo, em celulas, desta skill neste nivel.
 *
 * O nivel acima do que o arquivo conhece usa o ultimo nivel publicado (a skill
 * de NPC e a de nivel 11 da fonte ficam fora da tabela do jogador), e nivel
 * ausente ou invalido usa o nivel 1 - o mesmo que o cliente oficial faz quando
 * nao sabe o nivel de quem conjura.
 *
 * @param {number} skid
 * @param {number} [nivel]
 * @returns {number|null} null quando a skill nao esta na tabela
 */
export function diametroDoCirculo(skid, nivel) {
	const porNivel = _aneis.get(skid);
	if (!porNivel) {
		return null;
	}
	const n = Number.isInteger(nivel) && nivel >= 1 ? nivel : 1;
	return porNivel[Math.min(n, porNivel.length) - 1];
}
