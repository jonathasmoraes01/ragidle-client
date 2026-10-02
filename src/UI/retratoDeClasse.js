/**
 * O RETRATO DE CLASSE DE QUEM ESTA MONTADO (29/09/2026).
 *
 * O avatar da HUD e o da ficha pedem `/ragidle/classes/<Session.Entity.job>.png`.
 * Montado no Peco, o job do Cavaleiro deixa de ser 7 e passa a ser 13
 * (`KNIGHT2`), o do Templario de 14 para 21 (`CRUSADER2`), e assim por diante:
 * o servidor manda o id montado para o cliente desenhar o Peco. O cliente
 * oficial NAO tem `icon_job_13.bmp` (nem 21, 4014, 4022...), entao o pedido
 * dava 404 e o avatar caia na inicial do nome.
 *
 * A regra e pelo NOME da constante, e nao uma lista de ids: em `JobConst.js`
 * a forma montada e o nome da classe com `2` antes do sufixo de grau
 * (`KNIGHT2`, `KNIGHT2_H`, `KNIGHT2_B`, `RUNE_KNIGHT2`...). Tirado o `2`, sai
 * a classe base, e so vale se ela existir na tabela. Nomes com `2` que nao sao
 * montaria (`SUPERNOVICE2`, o Super Aprendiz expandido) caem no retrato da
 * classe vizinha, que e o que o jogador reconhece; e se a base tambem nao tiver
 * retrato, o `onerror` de quem desenha segue escondendo a imagem, como hoje.
 */

import JobId from 'DB/Jobs/JobConst.js';

const BASE_DO_MONTADO = (() => {
	const mapa = new Map();
	for (const [nome, id] of Object.entries(JobId)) {
		const base = nome.replace(/2(?=(_[HB])?$)/, '');
		if (base !== nome && JobId[base] !== undefined) {
			mapa.set(id, JobId[base]);
		}
	}
	return mapa;
})();

/** O job cujo retrato representa `jobId` (a base, se `jobId` for montado). */
export function jobDoRetrato(jobId) {
	const id = Number(jobId);
	return BASE_DO_MONTADO.has(id) ? BASE_DO_MONTADO.get(id) : jobId;
}

/** O caminho do PNG de retrato para o job do personagem. */
export function caminhoDoRetrato(jobId) {
	return `/ragidle/classes/${jobDoRetrato(jobId)}.png`;
}
