/**
 * UI/Components/CacaMedidaIdle/formatoDaCacaMedida.js
 *
 * A METADE PURA da janela "Seus mapas" (28/09/2026) — ler o pacote, ordenar,
 * dar o selo e montar o HTML do corpo. Nada aqui toca DOM, rede ou relogio:
 * e o que deixa o teste rodar as decisoes de verdade, e a bancada medir o
 * custo de montar a janela sem subir o jogo.
 *
 * Contrato: `docs/CONTRATO-CACA-MEDIDA.md` (repositorio do servidor), secoes
 * 4 (o `0x0fb5`) e 5 (a janela).
 *
 * ## O que esta janela NAO faz
 *
 * Ela nao calcula taxa nenhuma. EXP/h, zeny/h, pocoes/h e mortes/h chegam
 * PRONTOS do servidor, que e quem mediu a caca. Refazer a conta aqui seria a
 * segunda rota escrita a mao — o defeito mais caro deste projeto. O cliente so
 * ORDENA pelo seletor e da o SELO pela regra que o contrato escreve.
 *
 * ## Por que o corpo sai numa string so
 *
 * Ordem do dono (secao 6): abrir e desenhar mais rapido que o Mapa de Caca. O
 * corpo inteiro vira UM `innerHTML` por pacote, sem imagem (o Mapa de Caca
 * pede miniatura e ate cinco avatares por cartao) e sem ouvinte por cartao — o
 * clique e delegado no corpo, entao redesenhar nao religa nada.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** A versao do contrato que esta janela entende. */
export const VERSAO_DO_CONTRATO = 1;

/** "Medido" = pelo menos isto de caca viva no mapa (contrato, secao 1). */
export const MINUTOS_PARA_MEDIR = 10;

/** O `pedir` repete a cada 15 s, e SO enquanto a janela esta aberta. */
export const INTERVALO_DO_PEDIDO_MS = 15000;

/** O seletor "Mais EXP | Mais zeny". */
export const CRITERIO = Object.freeze({ EXP: 'exp', ZENY: 'zeny' });

/** O campo que cada criterio ordena (decrescente: o maior primeiro). */
const CAMPO_DO_CRITERIO = Object.freeze({
	[CRITERIO.EXP]: 'expBasePorHora',
	[CRITERIO.ZENY]: 'zenyPorHora'
});

/** O selo "Cuidado" vale abaixo disto de mortes por hora (contrato, secao 5). */
export const LIMITE_DO_CUIDADO_POR_HORA = 2;

/** Os tres estados do Explorar que o contrato declara. */
const ESTADOS_DO_EXPLORAR = new Set(['parado', 'explorando', 'concluido']);

function escapeHtml(valor) {
	return String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Numero com ponto de milhar ("16.293"); ausente vira travessao. */
export function formatarNumero(valor) {
	if (valor === null || valor === undefined || valor === '') {
		return '—';
	}
	const n = Number(valor);
	if (!Number.isFinite(n)) {
		return '—';
	}
	/*
	 * A mao, e nao `toLocaleString('pt-BR')`: o resultado dele depende do ICU
	 * de cada navegador (o Node sem ICU completo devolve "16,293"), e o numero
	 * que o jogador le nao pode mudar de forma entre aparelhos.
	 */
	const sinal = n < 0 ? '-' : '';
	const inteiro = String(Math.round(Math.abs(n)));
	let saida = '';
	for (let i = 0; i < inteiro.length; i++) {
		if (i > 0 && (inteiro.length - i) % 3 === 0) {
			saida += '.';
		}
		saida += inteiro[i];
	}
	return sinal + saida;
}

/**
 * Le o corpo do `0x0fb5`. Devolve `null` para o que nao e deste contrato — a
 * janela ignora em vez de desenhar metade de uma resposta que nao entende.
 *
 * @param {string} json
 */
export function lerCacaMedida(json) {
	let dados;
	try {
		dados = JSON.parse(json);
	} catch (_erro) {
		return null;
	}
	if (!dados || dados.v !== VERSAO_DO_CONTRATO || !Array.isArray(dados.mapas)) {
		return null;
	}
	if (!dados.explorar || !ESTADOS_DO_EXPLORAR.has(dados.explorar.estado)) {
		// Sem estado de Explorar legivel a janela ainda mostra os mapas: o
		// botao volta ao "parado", que so faz o jogador PEDIR de novo.
		dados.explorar = { estado: 'parado' };
	}
	return dados;
}

/**
 * O selo do cartao, pela regra da secao 5: **Seguro** (0 mortes), **Cuidado**
 * (menos de 2 mortes por hora), **Arriscado** (o resto).
 *
 * "0 mortes" olha `mortes`, e nao `mortesPorHora`: uma morte em 60 minutos
 * arredonda para 1/h e uma em 3 horas para 0/h — e quem morreu uma vez naquele
 * mapa nao pode ler "Seguro".
 */
export function seloDoMapa(mapa) {
	const mortes = Number(mapa && mapa.mortes) || 0;
	if (mortes <= 0) {
		return { chave: 'seguro', rotulo: 'Seguro' };
	}
	const porHora = Number(mapa.mortesPorHora);
	if (Number.isFinite(porHora) && porHora < LIMITE_DO_CUIDADO_POR_HORA) {
		return { chave: 'cuidado', rotulo: 'Cuidado' };
	}
	return { chave: 'arriscado', rotulo: 'Arriscado' };
}

function numeroOuZero(valor) {
	const n = Number(valor);
	return Number.isFinite(n) ? n : 0;
}

/**
 * A ordem da lista: os MEDIDOS primeiro, e dentro de cada grupo o maior valor
 * do criterio escolhido. O servidor nao garante ordem (contrato, secao 4).
 *
 * Por que o medido vem antes mesmo com taxa menor: uma amostra de 3 minutos e
 * ruido (um abate a mais dobra a taxa). Por o "medindo" no topo por causa de
 * um numero instavel seria a janela recomendando o que ainda nao mediu.
 *
 * Empate desempata pelo rotulo, para a lista nao trocar de lugar sozinha a
 * cada pedido de 15 s.
 */
export function ordenarMapas(mapas, criterio) {
	const campo = CAMPO_DO_CRITERIO[criterio] || CAMPO_DO_CRITERIO[CRITERIO.EXP];
	return (Array.isArray(mapas) ? mapas : []).slice().sort((a, b) => {
		const medido = (b.medido ? 1 : 0) - (a.medido ? 1 : 0);
		if (medido !== 0) {
			return medido;
		}
		const valor = numeroOuZero(b[campo]) - numeroOuZero(a[campo]);
		if (valor !== 0) {
			return valor;
		}
		return String(a.rotulo || a.mapa || '').localeCompare(String(b.rotulo || b.mapa || ''));
	});
}

/** "medido em 32 min" ou "medindo 4 de 10 min". */
export function textoDoTempo(mapa) {
	const minutos = Math.max(0, Math.floor(numeroOuZero(mapa && mapa.minutos)));
	if (mapa && mapa.medido) {
		return `medido em ${minutos} min`;
	}
	return `medindo ${Math.min(minutos, MINUTOS_PARA_MEDIR)} de ${MINUTOS_PARA_MEDIR} min`;
}

/** O rotulo que cada estado de candidato mostra na lista do Explorar. */
export function textoDoCandidato(candidato) {
	const minutos = Math.max(0, Math.floor(numeroOuZero(candidato && candidato.minutos)));
	switch (candidato && candidato.estado) {
		case 'medindo':
			return `Caçando agora · ${Math.min(minutos, MINUTOS_PARA_MEDIR)} de ${MINUTOS_PARA_MEDIR} min`;
		case 'medido':
			return `Sem mortes · ${formatarNumero(candidato.expBasePorHora)} EXP/h`;
		case 'arriscado':
			return 'Morreu aqui';
		case 'esperando':
		default:
			return 'Na fila';
	}
}

function htmlDoResultado(resultado) {
	if (!resultado || !resultado.texto) {
		return '';
	}
	const classe = resultado.ok ? 'is-ok' : 'is-erro';
	return `<div class="cm-resultado ${classe}" role="status">${escapeHtml(resultado.texto)}</div>`;
}

function htmlDoVazio(dados, temAlgum) {
	const sugestao = dados.sugestaoDaEscada;
	const linhaDaSugestao =
		sugestao && (sugestao.rotulo || sugestao.mapa)
			? `<span class="cm-vazio-sugestao">Sugestão para o seu nível: <strong>${escapeHtml(sugestao.rotulo || sugestao.mapa)}</strong></span>`
			: '';
	const explicacao = temAlgum
		? `Os números aparecem quando você caçar ${MINUTOS_PARA_MEDIR} minutos num mapa.`
		: `Cace ${MINUTOS_PARA_MEDIR} minutos num mapa e os números dele aparecem aqui.`;
	return (
		'<div class="cm-vazio">' +
		'<strong class="cm-vazio-titulo">Ainda não medimos sua caça</strong>' +
		`<span>${explicacao}</span>` +
		linhaDaSugestao +
		'</div>'
	);
}

function htmlDoNumero(rotulo, valor, destaque) {
	return (
		`<div class="cm-numero${destaque ? ' is-destaque' : ''}">` +
		`<dt>${rotulo}</dt><dd>${formatarNumero(valor)}</dd>` +
		'</div>'
	);
}

function htmlDoCartao(mapa, criterio, mapaAtual) {
	const selo = seloDoMapa(mapa);
	const aqui = mapaAtual && mapa.mapa === mapaAtual;
	const anterior = mapa.fichaAtual === false;
	const mortes = Math.max(0, Math.round(numeroOuZero(mapa.mortes)));
	const tituloDoSelo =
		mortes === 0
			? 'Nenhuma morte neste mapa'
			: `${mortes} ${mortes === 1 ? 'morte' : 'mortes'} · ${formatarNumero(mapa.mortesPorHora)} por hora`;
	const classes =
		'cm-cartao' +
		(mapa.medido ? ' is-medido' : ' is-medindo') +
		(aqui ? ' is-atual' : '') +
		(anterior ? ' is-anterior' : '');
	const marcas =
		(aqui ? '<span class="cm-marca cm-marca--aqui">Você está aqui</span>' : '') +
		(anterior
			? '<span class="cm-marca cm-marca--anterior" title="Medido com outro equipamento, atributos ou habilidades. Os números podem ter mudado.">ficha anterior</span>'
			: '');
	return (
		`<li class="${classes}" data-mapa="${escapeHtml(mapa.mapa)}">` +
		'<div class="cm-cartao-topo">' +
		`<span class="cm-nome">${escapeHtml(mapa.rotulo || mapa.mapa)}</span>` +
		`<span class="cm-selo cm-selo--${selo.chave}" title="${escapeHtml(tituloDoSelo)}">${selo.rotulo}</span>` +
		'</div>' +
		`<div class="cm-linha-do-tempo"><span class="cm-tempo">${textoDoTempo(mapa)}</span>${marcas}</div>` +
		'<dl class="cm-numeros">' +
		htmlDoNumero('EXP base/h', mapa.expBasePorHora, criterio === CRITERIO.EXP) +
		htmlDoNumero('EXP classe/h', mapa.expClassePorHora, false) +
		htmlDoNumero('Zeny/h', mapa.zenyPorHora, criterio === CRITERIO.ZENY) +
		htmlDoNumero('Poções/h', mapa.pocoesPorHora, false) +
		'</dl>' +
		'</li>'
	);
}

function rotuloDoCandidato(explorar, mapa) {
	const achado = (explorar.candidatos || []).find(c => c.mapa === mapa);
	return (achado && achado.rotulo) || mapa;
}

function htmlDosCandidatos(explorar) {
	const candidatos = Array.isArray(explorar.candidatos) ? explorar.candidatos : [];
	if (candidatos.length === 0) {
		return '';
	}
	const emCurso = explorar.estado === 'explorando' ? explorar.indice : -1;
	return (
		'<ol class="cm-candidatos">' +
		candidatos
			.map((c, i) => {
				const estado = ['esperando', 'medindo', 'medido', 'arriscado'].includes(c.estado)
					? c.estado
					: 'esperando';
				const escolhido =
					explorar.estado === 'concluido' && explorar.escolhido && c.mapa === explorar.escolhido;
				return (
					`<li class="cm-candidato cm-candidato--${estado}${i === emCurso ? ' is-em-curso' : ''}${escolhido ? ' is-escolhido' : ''}">` +
					`<span class="cm-candidato-nome">${escapeHtml(c.rotulo || c.mapa)}</span>` +
					`<span class="cm-candidato-estado">${escapeHtml(textoDoCandidato(c))}</span>` +
					'</li>'
				);
			})
			.join('') +
		'</ol>'
	);
}

const BOTAO_EXPLORAR =
	'<button type="button" class="cm-botao ri-btn" data-acao="explorar">Explorar mapas para meu nível</button>';

function htmlDoExplorar(explorar) {
	if (explorar.estado === 'explorando') {
		return (
			'<section class="cm-explorar is-explorando" aria-live="polite">' +
			'<div class="cm-explorar-titulo">Explorando mapas para o seu nível</div>' +
			`<p class="cm-explorar-texto">Cada mapa é caçado por ${MINUTOS_PARA_MEDIR} minutos. No fim você fica no que der mais EXP sem morrer.</p>` +
			htmlDosCandidatos(explorar) +
			'<button type="button" class="cm-botao ri-btn ri-btn--sec" data-acao="cancelar">Cancelar</button>' +
			'</section>'
		);
	}
	if (explorar.estado === 'concluido') {
		const fim = explorar.escolhido
			? `Você ficou em <strong>${escapeHtml(rotuloDoCandidato(explorar, explorar.escolhido))}</strong>, o que deu mais EXP sem morrer.`
			: 'Nenhum mapa passou sem mortes. Você continua onde estava.';
		return (
			'<section class="cm-explorar is-concluido" aria-live="polite">' +
			'<div class="cm-explorar-titulo">Exploração concluída</div>' +
			`<p class="cm-explorar-fim">${fim}</p>` +
			htmlDosCandidatos(explorar) +
			BOTAO_EXPLORAR +
			'</section>'
		);
	}
	return (
		'<section class="cm-explorar is-parado">' +
		`<p class="cm-explorar-texto">Testamos até 3 mapas do seu nível, ${MINUTOS_PARA_MEDIR} minutos cada, e você fica no que der mais EXP sem morrer.</p>` +
		BOTAO_EXPLORAR +
		'</section>'
	);
}

/**
 * O CORPO INTEIRO da janela, numa string. Quem chama escreve com UM
 * `innerHTML`.
 *
 * @param {object|null} dados   o `0x0fb5` ja lido (`lerCacaMedida`)
 * @param {string} criterio     `CRITERIO.EXP` ou `CRITERIO.ZENY`
 */
export function montarHtmlDaCacaMedida(dados, criterio) {
	if (!dados) {
		return '<div class="cm-carregando">Carregando…</div>';
	}
	const mapas = ordenarMapas(dados.mapas, criterio);
	const algumMedido = mapas.some(m => m.medido);
	const lista = mapas.length
		? `<ul class="cm-lista">${mapas.map(m => htmlDoCartao(m, criterio, dados.mapaAtual)).join('')}</ul>`
		: '';
	return (
		htmlDoResultado(dados.resultado) +
		htmlDoExplorar(dados.explorar || { estado: 'parado' }) +
		(algumMedido ? '' : htmlDoVazio(dados, mapas.length > 0)) +
		lista
	);
}
