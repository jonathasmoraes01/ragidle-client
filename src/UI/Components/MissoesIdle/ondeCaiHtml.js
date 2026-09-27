/**
 * UI/Components/MissoesIdle/ondeCaiHtml.js
 *
 * O "ONDE CAI" DA JANELA DE MISSOES (26/09/2026, pedido do dono).
 *
 * Palavras dele: *"dentro dessas quests que precisam de item, precisamos de um
 * botao para o player ir direto pro mapa que dropa o item. Se tiver mais de um
 * mapa, o player deve escolher o mapa que ele vai farmar. Diga tambem qual e o
 * monstro que dropa e tenha certeza de colocar o nome do item correto (em
 * portugues)"*.
 *
 * Tres pecas, puras (sem DOM, sem rede), para o teste as executar:
 *
 * - `linhaDoCaiDe`: a linha "Cai de" embaixo do objetivo de coleta, com o
 *   botao "Ir ao mapa". O servidor manda o objetivo ja com `itemId`,
 *   `nomeDoItem` (o nome do jogo), `caiDe` (o mapa da missao e quem solta la)
 *   e `mapasOndeCai` (quantos mapas ha).
 * - `decidirAoReceber`: o que fazer quando a lista chega — ir direto (um mapa
 *   so, e liberado), abrir a escolha, ou avisar que o item nao cai em lugar
 *   nenhum do Mapa de Caca.
 * - `corpoDaEscolha`: a janela de escolha — um cartao por mapa, do melhor para
 *   o pior, com os monstros, a chance, os abates por unidade e o motivo de nao
 *   poder ir (nivel, ou "voce esta aqui").
 *
 * Os numeros sao do SERVIDOR (`servidor/mapa/onde-cai-o-item.ts`): a mesma
 * conta da regua que aprova as missoes. A janela nao recalcula nada.
 */

/** Texto para HTML: escapa o que quebraria a marcacao. */
function escapar(valor) {
	return String(valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * A chance em porcento, com virgula e sem zeros sobrando: 0,7% · 0,35% · 20%.
 *
 * @param {number} porcento
 * @returns {string}
 */
export function formatarChance(porcento) {
	const n = Number(porcento);
	if (!Number.isFinite(n)) {
		return '?%';
	}
	return String(Number(n.toFixed(3))).replace('.', ',') + '%';
}

/**
 * Por que o jogador NAO pode ir a este mapa agora, ou `null`. O servidor
 * recusa as mesmas coisas (e escreve no feed); aqui e so para o botao nao
 * convidar para uma viagem que termina em recusa.
 *
 * @param {{mapa: string, nivelQueAbre: number}} mapa
 * @param {{nivel: number, mapaAtual: string}} jogador
 * @returns {string|null}
 */
export function motivoDeNaoIr(mapa, jogador) {
	if (jogador && mapa.mapa === jogador.mapaAtual) {
		return 'Você está aqui';
	}
	if (jogador && typeof jogador.nivel === 'number' && jogador.nivel < mapa.nivelQueAbre) {
		return `Abre no Nv. ${mapa.nivelQueAbre}`;
	}
	return null;
}

/**
 * A linha "Cai de" do objetivo de coleta, com o botao. Vazia para objetivo que
 * nao e de coleta, para o que ja esta completo, e para missao concluida ou
 * BLOQUEADA — o cartao bloqueado ja diz o que falta fazer antes, e mandar o
 * jogador farmar para uma missao que ele ainda nao pode comecar desvia da
 * cadeia que o requisito aponta.
 *
 * @param {{itemId?: number, nomeDoItem?: string, caiDe?: {mapa: string, rotulo: string, monstros: string[]}|null, mapasOndeCai?: number, progresso?: number, alvo?: number}} objetivo
 * @param {{id: string, estado: string}} missao
 * @returns {string}
 */
export function linhaDoCaiDe(objetivo, missao) {
	if (!objetivo || typeof objetivo.itemId !== 'number') {
		return '';
	}
	if (missao && (missao.estado === 'concluida' || missao.estado === 'bloqueada')) {
		return '';
	}
	if (typeof objetivo.progresso === 'number' && typeof objetivo.alvo === 'number' && objetivo.progresso >= objetivo.alvo) {
		return '';
	}
	const cai = objetivo.caiDe;
	const quem =
		cai && Array.isArray(cai.monstros) && cai.monstros.length
			? `Cai de <b>${cai.monstros.map(escapar).join(', ')}</b> em ${escapar(cai.rotulo)}`
			: 'Não cai em nenhum mapa do Mapa de Caça';
	const total = Number(objetivo.mapasOndeCai) || 0;
	const outros = total > 1 ? ` <span class="oc-cai-de-mais">· ${total} mapas</span>` : '';
	const botao =
		total > 0
			? `<button type="button" class="ri-btn ri-btn--sec oc-ir-mapa" data-onde-cai="${escapar(objetivo.itemId)}"` +
				` data-missao-id="${escapar(missao ? missao.id : '')}"` +
				` title="${total > 1 ? 'Escolha o mapa onde farmar' : 'Leva você ao mapa onde o item cai'}">Ir ao mapa</button>`
			: '';
	return `<div class="oc-cai-de"><span class="oc-cai-de-texto">${quem}${outros}</span>${botao}</div>`;
}

/**
 * O que fazer quando a lista chega do servidor.
 *
 * - `ir`: um mapa so, e o jogador pode ir — vai direto, sem perguntar.
 * - `escolher`: mais de um mapa, ou o unico tem um motivo (nivel, ja esta la):
 *   a janela mostra, e o jogador le por que.
 * - `nenhum`: o item nao cai em nenhum mapa servido.
 *
 * @param {{mapas: Array<{mapa: string, nivelQueAbre: number}>, nivel: number, mapaAtual: string}} ondeCai
 * @returns {{tipo: 'ir', mapa: string}|{tipo: 'escolher'}|{tipo: 'nenhum'}}
 */
export function decidirAoReceber(ondeCai) {
	const mapas = (ondeCai && Array.isArray(ondeCai.mapas) && ondeCai.mapas) || [];
	if (!mapas.length) {
		return { tipo: 'nenhum' };
	}
	if (mapas.length === 1 && (Number(ondeCai.total) || 1) === 1) {
		const unico = mapas[0];
		if (motivoDeNaoIr(unico, ondeCai) === null) {
			return { tipo: 'ir', mapa: unico.mapa };
		}
	}
	return { tipo: 'escolher' };
}

/**
 * O corpo da janela de escolha: um cartao por mapa, do melhor para o pior.
 *
 * @param {{itemId: number, nomeDoItem: string, mapas: Array<{mapa: string, rotulo: string, nivelQueAbre: number, monstros: Array<{nome: string, chanceEmPorcento: number}>, abatesPorUnidade: number}>, total: number, nivel: number, mapaAtual: string}} ondeCai
 * @returns {string}
 */
export function corpoDaEscolha(ondeCai) {
	const mapas = (ondeCai && Array.isArray(ondeCai.mapas) && ondeCai.mapas) || [];
	const nome = escapar((ondeCai && ondeCai.nomeDoItem) || 'o item');
	if (!mapas.length) {
		return `<p class="oc-escolha-intro"><b>${nome}</b> não cai em nenhum mapa do Mapa de Caça.</p>`;
	}
	const cartoes = mapas
		.map((m, i) => {
			const motivo = motivoDeNaoIr(m, ondeCai);
			const monstros = (m.monstros || [])
				.map(x => `<span class="oc-escolha-monstro">${escapar(x.nome)} <b>${formatarChance(x.chanceEmPorcento)}</b></span>`)
				.join('');
			const acao =
				motivo === null
					? `<button type="button" class="ri-btn ri-btn--ouro oc-escolha-ir" data-ir-mapa="${escapar(m.mapa)}">Ir</button>`
					: `<span class="oc-escolha-motivo">${escapar(motivo)}</span>`;
			return (
				`<li class="oc-escolha-mapa${motivo === null ? '' : ' is-indisponivel'}${i === 0 ? ' is-melhor' : ''}">` +
				`<div class="oc-escolha-topo"><span class="oc-escolha-nome">${escapar(m.rotulo)}</span>` +
				`<span class="ri-badge ri-badge--cinza oc-escolha-nivel">Nv. ${escapar(m.nivelQueAbre)}+</span>` +
				(i === 0 ? '<span class="ri-badge ri-badge--ouro oc-escolha-selo">Mais rápido</span>' : '') +
				`</div>` +
				`<div class="oc-escolha-monstros">${monstros}</div>` +
				`<div class="oc-escolha-rodape"><span class="oc-escolha-abates">~${escapar(m.abatesPorUnidade)} abates por unidade</span>${acao}</div>` +
				`</li>`
			);
		})
		.join('');
	const total = Number(ondeCai.total) || mapas.length;
	const mais = total > mapas.length ? `<p class="oc-escolha-mais">Mostrando os ${mapas.length} melhores de ${total} mapas.</p>` : '';
	return (
		`<p class="oc-escolha-intro"><b>${nome}</b> cai nestes mapas. O primeiro rende mais: menos abates por unidade.</p>` +
		`<ul class="oc-escolha-lista">${cartoes}</ul>` +
		mais +
		`<button type="button" class="ri-btn ri-btn--sec oc-escolha-ver-todos" data-ver-no-mapa-de-caca="${nome}">Ver todos no Mapa de Caça</button>`
	);
}
