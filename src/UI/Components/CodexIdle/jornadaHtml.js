/**
 * UI/Components/CodexIdle/jornadaHtml.js
 *
 * O DESENHO DA JORNADA DE MIDGARD - as tres telas em string de HTML.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE MORA FORA DE `CodexIdle.js`
 * ---------------------------------------------------------------------------
 * Porque assim ele pode ser FOTOGRAFADO. A regra 5 do projeto diz que contar
 * elemento nao prova que da para ver, e a unica prova que vale para leiaute e
 * a foto do PNG. Dentro de `CodexIdle.js` este codigo so roda com o cliente
 * inteiro de pe (Renderer, rede, sessao, o mapa 3D carregado); aqui ele
 * depende de DUAS coisas e nada mais - `ri-icones.js`, que e um dicionario de
 * strings, e as regras puras de `jornadaDeMidgard.js`.
 *
 * O resultado e que `docs/provas-jornada/` fotografa ESTE codigo, e nao uma
 * segunda copia escrita para o arnes. Copia de tela para tirar foto e a pior
 * forma de prova que existe: ela aprova o que ninguem vai rodar.
 *
 * ---------------------------------------------------------------------------
 * O CONTEXTO ENTRA, NAO E LIDO
 * ---------------------------------------------------------------------------
 * Nivel do personagem, morte, mapa atual, nivel em que cada mapa abre e o que
 * ja chegou do servidor sao ARGUMENTOS (`contexto`), e nao consultas a modulos
 * globais. E o que torna cada estado desta tela reproduzivel: para fotografar
 * "o botao apagado porque o jogador esta morto" basta passar `morto: true`.
 *
 * @author RagIdle
 */

import RiIcones from 'UI/ri-icones.js';
import {
	contadorEscrito,
	missoesDaEspecie,
	motivoDeNaoViajar,
	pinosDosCapitulos,
	placarDoPremio,
	porcentagem,
	proximoPasso,
	recompensaEmTexto,
	seloDoEstado
} from './jornadaDeMidgard.js';

/** O fundo do mapa de capitulos - 1457x1080, convertido do PNG do dono. */
export const MAPA_DE_MIDGARD = '/ragidle/mapa-de-midgard.webp';

/**
 * O contexto da renderizacao em curso.
 *
 * Variavel de modulo, e nao parametro de cada funcao, porque o desenho e
 * SINCRONO de ponta a ponta: `jornadaHtml` a escreve, chama a arvore inteira e
 * termina antes de qualquer outra coisa rodar. Passar o contexto por vinte
 * assinaturas so para dizer o mesmo custaria ruido em cada uma.
 */
let _ctx = {};

/**
 * Mesmo helper privado de `CodexIdle.js` / `PasseIdle.js` / `MissoesIdle.js`.
 *
 * Ele e copiado, e nao importado, pelo motivo que o projeto ja registrou nas
 * outras janelas: uma peca compartilhada de UMA linha nao paga o acoplamento -
 * e, aqui, romperia a promessa do cabecalho de este arquivo depender de duas
 * coisas so.
 */
function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

/* ------------------------------------------------------------------ */
/* A JORNADA DE MIDGARD - as tres telas                                */
/* ------------------------------------------------------------------ */

/**
 * O avatar do monstro. O arquivo e `public/ragidle/mobs/<mobId>.png`, gerado
 * por `npm run miniaturas` e vigiado por `avatar-de-todo-monstro.test.ts` no
 * repo do servidor.
 *
 * O `onerror` some com a imagem em vez de deixar o icone quebrado - e ele e a
 * razao pela qual a falta de avatar NAO grita: os tres mapas de 31/08 nasceram
 * com 112 avatares para 122 monstros e ninguem notou. Quem cobra e o portao de
 * la; aqui a tela so nao pode ficar feia.
 */
function avatarHtml(mobId, classe) {
	const id = Number(mobId);
	if (!Number.isFinite(id) || id <= 0) {
		return '';
	}
	return (
		'<img class="' +
		escapeHtml(classe || 'cx-jor-avatar') +
		'" src="/ragidle/mobs/' +
		id +
		'.png" alt="" onerror="this.style.display=\'none\'" />'
	);
}

/** Um glifo do design system, pelo nome. Chave desconhecida vira vazio. */
function glifo(chave) {
	return RiIcones[chave] || '';
}

/** O selo de estado: GLIFO + PALAVRA + forma. Nunca so cor. */
function seloHtml(estado) {
	const s = seloDoEstado(estado);
	return (
		'<span class="cx-selo ' +
		escapeHtml(s.classe) +
		' cx-selo--' +
		escapeHtml(s.forma) +
		'"><span class="cx-selo-glifo">' +
		glifo(s.glifo) +
		'</span><span class="cx-selo-texto">' +
		escapeHtml(s.rotulo) +
		'</span></span>'
	);
}

/** O chip clicavel de uma especie: avatar + nome, ponte para a Jornada. */
export function chipDeEspecieHtml(mobId, monstro) {
	return (
		'<button type="button" class="cx-ponte-especie" data-mobid="' +
		escapeHtml(mobId == null ? '' : mobId) +
		'" title="Ver as missões da Jornada desta espécie">' +
		avatarHtml(mobId, 'cx-ponte-avatar') +
		'<span>' +
		escapeHtml(monstro || '') +
		'</span></button>'
	);
}

/*
 * QUEM LE A SESSAO E O CATALOGO E `CodexIdle.js`, e nao este arquivo.
 *
 * `situacaoDoJogador()` (nivel, morte, mapa atual) e `nivelQueAbre()` (o
 * catalogo do Mapa de Caca) moram la e chegam aqui dentro de `contexto`. E o
 * que mantem este arquivo fotografavel - e, de quebra, o que torna cada um dos
 * quatro estados reproduzivel numa prova sem servidor nenhum.
 */

/**
 * A ACAO PRINCIPAL de uma missao: ir ao mapa onde ela se cumpre.
 *
 * Ela e o "Advance" da referencia - o botao que leva o jogador ao lugar onde a
 * missao acontece, e nao um rotulo informativo. O que muda aqui e o que o
 * pedido cobra: quando a viagem NAO vai sair, o botao diz o motivo em vez de
 * nao fazer nada, porque as recusas de `viajar()` sao silenciosas do outro
 * lado do fio.
 */
function acaoDeViagemHtml(missao) {
	const mapa = missao && missao.mapa ? String(missao.mapa) : '';
	const rotulo = (missao && missao.mapaRotulo) || mapa;
	if (!mapa) {
		return '';
	}
	const situacao = _ctx.situacao || {};
	const motivo = motivoDeNaoViajar({
		mapa: mapa,
		mapaAtual: situacao.mapaAtual,
		morto: situacao.morto,
		nivelDoJogador: situacao.nivelDoJogador,
		// Sem a funcao (contexto incompleto), `null` - e `null` DEIXA clicar,
		// pela mesma razao do catalogo que ainda nao chegou: recusar por falta
		// de dado seria a janela inventando uma tranca.
		nivelQueAbre: typeof _ctx.nivelQueAbre === 'function' ? _ctx.nivelQueAbre(mapa) : null
	});

	if (!motivo) {
		return (
			'<button type="button" class="cx-jor-ir ri-btn" data-viajar="' +
			escapeHtml(mapa) +
			'" title="Viajar para ' +
			escapeHtml(rotulo) +
			'">Ir para ' +
			escapeHtml(rotulo) +
			'</button>'
		);
	}

	return (
		'<button type="button" class="cx-jor-ir ri-btn" disabled title="' +
		escapeHtml(motivo.frase) +
		'">Ir para ' +
		escapeHtml(rotulo) +
		'</button>' +
		'<span class="cx-jor-motivo">' +
		glifo('alerta') +
		'<span>' +
		escapeHtml(motivo.frase) +
		'</span></span>'
	);
}

/** Uma linha de missao, no desenho do painel de missoes da referencia. */
function linhaDeMissaoHtml(m, opcoes) {
	const meta = Number(m.meta) || 0;
	const abates = Number(m.abates) || 0;
	const pct = porcentagem(abates, meta);
	const premio = recompensaEmTexto(m.recompensas);
	const mostrarCapitulo = !!(opcoes && opcoes.comCapitulo);

	return (
		'<div class="cx-jor-missao ' +
		escapeHtml(seloDoEstado(m.estado).classe) +
		'">' +
		'<button type="button" class="cx-jor-alvo" data-codex-mobid="' +
		escapeHtml(m.mobId == null ? '' : m.mobId) +
		'" title="Ver esta espécie no Códex">' +
		avatarHtml(m.mobId) +
		'</button>' +
		'<div class="cx-jor-missao-texto">' +
		'<span class="cx-jor-missao-nome">' +
		escapeHtml(m.monstro || '') +
		'</span>' +
		'<span class="cx-jor-missao-local">' +
		glifo('pin') +
		'<span>' +
		escapeHtml(m.mapaRotulo || m.mapa || '') +
		'</span>' +
		(mostrarCapitulo && m.capitulo
			? '<button type="button" class="cx-jor-link" data-capitulo="' +
				escapeHtml(m.capitulo) +
				'">' +
				escapeHtml(nomeDoCapitulo(m.capitulo)) +
				'</button>'
			: '') +
		'</span>' +
		(premio ? '<span class="cx-jor-missao-premio">Recompensa: ' + escapeHtml(premio) + '</span>' : '') +
		'</div>' +
		'<div class="cx-jor-missao-lado">' +
		seloHtml(m.estado) +
		'<span class="cx-jor-contador">' +
		escapeHtml(contadorEscrito(abates, meta)) +
		'</span>' +
		'</div>' +
		'<div class="ri-bar ri-bar--exp cx-jor-barra"><div class="fill" style="width:' +
		pct +
		'%"></div></div>' +
		'<div class="cx-jor-acao">' +
		acaoDeViagemHtml(m) +
		'<button type="button" class="cx-jor-link cx-jor-link--codex" data-codex-mobid="' +
		escapeHtml(m.mobId == null ? '' : m.mobId) +
		'">Ver no Códex</button>' +
		'</div>' +
		'</div>'
	);
}

/** O titulo de um capitulo pelo id, lido do retrato. */
function nomeDoCapitulo(id) {
	const jor = (_ctx.estado && _ctx.estado.jornada) || {};
	const cap = (jor.capitulos || []).find(c => c && c.id === id);
	return (cap && cap.titulo) || id || '';
}

/** O capitulo inteiro pelo id. */
function capituloPorId(id) {
	const jor = (_ctx.estado && _ctx.estado.jornada) || {};
	return (jor.capitulos || []).find(c => c && c.id === id) || null;
}

/** O cartaz do premio - anunciado desde a PRIMEIRA abertura, pedido do dono. */
function premioHtml(jornada) {
	const placar = placarDoPremio(jornada);
	const premio = (jornada && jornada.premio) || {};
	return (
		'<div class="cx-jor-premio' +
		(placar.entregue ? ' is-entregue' : '') +
		'">' +
		'<span class="cx-jor-premio-glifo">' +
		glifo(placar.entregue ? 'confere' : 'recompensas') +
		'</span>' +
		'<div class="cx-jor-premio-texto">' +
		'<div class="cx-jor-premio-titulo">Prêmio da Jornada</div>' +
		'<div class="cx-jor-premio-descricao">' +
		escapeHtml(premio.descricao || 'O prêmio ainda não foi anunciado pelo servidor.') +
		'</div>' +
		'<div class="cx-jor-premio-falta">' +
		escapeHtml(placar.falta) +
		'</div>' +
		'</div>' +
		'<span class="cx-jor-premio-placar">' +
		escapeHtml(contadorEscrito(placar.concluidos, placar.total)) +
		'<small>capítulos</small></span>' +
		'</div>'
	);
}

/**
 * O REQUISITO, quando a Jornada ainda nao abriu.
 *
 * O pedido e explicito: antes do desbloqueio a Jornada APARECE, dizendo o que
 * falta e como seguir - nao e uma aba vazia nem um cadeado mudo. O texto e do
 * servidor (`requisito.titulo` e `requisito.comoSeguir`); o botao e a porta,
 * porque so a frase deixaria o jogador procurando o caminho a mao.
 */
function requisitoHtml(jornada) {
	const req = (jornada && jornada.requisito) || null;
	return (
		'<div class="cx-jor-requisito">' +
		'<span class="cx-jor-requisito-glifo">' +
		glifo('cadeado') +
		'</span>' +
		'<div>' +
		'<div class="cx-jor-requisito-titulo">' +
		escapeHtml((req && req.titulo) || 'A Jornada ainda não está aberta') +
		'</div>' +
		'<div class="cx-jor-requisito-como">' +
		escapeHtml(
			(req && req.comoSeguir) || 'Conclua a missão de troca de classe para começar a Jornada de Midgard.'
		) +
		'</div>' +
		'<button type="button" class="cx-jor-abrir-missoes ri-btn ri-btn--sec">Abrir as Missões</button>' +
		'</div>' +
		'</div>'
	);
}

/** A legenda dos quatro estados - a prova de que a cor nao e o unico sinal. */
function legendaHtml() {
	return (
		'<div class="cx-jor-legenda">' +
		['concluido', 'em-andamento', 'disponivel', 'bloqueado'].map(seloHtml).join('') +
		'</div>'
	);
}

/** TELA A - o mapa-mundi com os capitulos como lugares. */
function telaDoMapaHtml(jornada) {
	const capitulos = (jornada.capitulos || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
	const pinos = pinosDosCapitulos(capitulos);
	const semPino = capitulos.filter(c => !pinos[c.id]).length;
	/*
	 * COM A JORNADA TRANCADA NAO HA "PROXIMO PASSO" AQUI.
	 *
	 * O proximo passo do jogador e a missao de CLASSE, e o cartao do requisito
	 * logo acima ja aponta para ela. Marcar o capitulo 1 com a fita dourada
	 * poria dois "proximos" na mesma tela, com o errado em destaque.
	 */
	const trancada = jornada.desbloqueada === false;
	const proximo = trancada ? null : proximoPasso(jornada);

	const marcas = capitulos
		.filter(c => pinos[c.id])
		.map(c => {
			const p = pinos[c.id];
			const s = seloDoEstado(c.estado);
			const atual = proximo && proximo.id === c.id;
			/*
			 * A ETIQUETA MUDA DE LADO PERTO DA BORDA.
			 *
			 * O disco fica sempre em cima da coordenada medida; quem se move e
			 * o rotulo. Centralizado, um lugar a 94% da largura (a Ilha da
			 * Tartaruga) jogaria metade do nome para fora, e a caixa corta com
			 * `overflow:hidden` - nome cortado no meio, sem nada dizer por que.
			 * Perto da borda de baixo ele sobe pelo mesmo motivo.
			 */
			const lado = p.x > 78 ? ' is-a-direita' : p.x < 22 ? ' is-a-esquerda' : '';
			const altura = p.y > 86 ? ' is-acima' : '';
			return (
				'<button type="button" class="cx-jor-pino ' +
				escapeHtml(s.classe) +
				lado +
				altura +
				(atual ? ' is-atual' : '') +
				'" style="left:' +
				p.x +
				'%;top:' +
				p.y +
				'%"' +
				// Trancada, o pino nao abre nada - e um botao que nao faz nada e
				// pior que um botao apagado, que ao menos diz que ainda nao e hora.
				(trancada ? ' disabled' : ' data-capitulo="' + escapeHtml(c.id) + '"') +
				' title="' +
				escapeHtml(c.titulo + ' - ' + s.rotulo + ' - ' + contadorEscrito(c.concluidas, c.total) + ' missões') +
				'">' +
				'<span class="cx-jor-pino-disco">' +
				glifo(s.glifo) +
				'</span>' +
				/*
				 * O rotulo diz o LUGAR do mapa, e nao o titulo do capitulo.
				 *
				 * Duas razoes, e nenhuma e economia de espaco: o pino marca um
				 * lugar - dizer "Prontera" sobre Prontera e a verdade que o
				 * fundo ja conta -, e o titulo do capitulo ("Os campos ao redor
				 * de Prontera") mora na lista logo abaixo, onde ele cabe
				 * inteiro. O numero na frente e o que costura os dois.
				 */
				'<span class="cx-jor-pino-nome">' +
				escapeHtml(String(c.ordem || '?') + '. ' + p.lugar) +
				'</span>' +
				'</button>'
			);
		})
		.join('');

	return (
		'<div class="cx-jor-mapa-caixa">' +
		'<img class="cx-jor-mapa-fundo" src="' +
		MAPA_DE_MIDGARD +
		'" alt="Mapa de Midgard" />' +
		marcas +
		'</div>' +
		legendaHtml() +
		(semPino
			? '<div class="cx-jor-nota">' +
				semPino +
				(semPino === 1
					? ' capítulo não tem lugar reconhecido no mapa e vive só na lista.'
					: ' capítulos não têm lugar reconhecido no mapa e vivem só na lista.') +
				' Um pino no lugar errado ensinaria geografia falsa.</div>'
			: '') +
		(proximo ? proximoPassoHtml(proximo) : '')
	);
}

/** O cartao do PROXIMO PASSO - o que o pedido chama de "evidente". */
function proximoPassoHtml(cap) {
	return (
		'<div class="cx-jor-proximo">' +
		'<div class="cx-jor-proximo-faixa">Próximo passo</div>' +
		'<div class="cx-jor-proximo-titulo">' +
		escapeHtml(String(cap.ordem || '') + '. ' + (cap.titulo || cap.id)) +
		'</div>' +
		(cap.abertura ? '<div class="cx-jor-proximo-abertura">' + escapeHtml(cap.abertura) + '</div>' : '') +
		'<div class="cx-jor-proximo-rodape">' +
		seloHtml(cap.estado) +
		'<span class="cx-jor-contador">' +
		escapeHtml(contadorEscrito(cap.concluidas, cap.total)) +
		' missões</span>' +
		'<button type="button" class="cx-jor-ir ri-btn" data-capitulo="' +
		escapeHtml(cap.id) +
		'">Ver as missões</button>' +
		'</div>' +
		'</div>'
	);
}

/** TELA C - a jornada inteira, capitulo a capitulo, na ordem. */
function telaDaJornadaHtml(jornada) {
	const capitulos = (jornada.capitulos || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
	if (capitulos.length === 0) {
		return '<div class="cx-vazio">O servidor não mandou capítulo nenhum.</div>';
	}
	// Ver a nota gemea em `telaDoMapaHtml`: trancada, o proximo passo e a
	// missao de classe, e nao o capitulo 1.
	const trancada = jornada.desbloqueada === false;
	const proximo = trancada ? null : proximoPasso(jornada);
	const pinos = pinosDosCapitulos(capitulos);

	return (
		legendaHtml() +
		'<div class="cx-jor-capitulos">' +
		capitulos
			.map(c => {
				const s = seloDoEstado(c.estado);
				const pct = porcentagem(c.concluidas, c.total);
				const ehProximo = proximo && proximo.id === c.id;
				return (
					'<div class="cx-jor-capitulo ' +
					escapeHtml(s.classe) +
					(ehProximo ? ' is-proximo' : '') +
					'">' +
					(ehProximo ? '<span class="cx-jor-fita">Próximo passo</span>' : '') +
					'<span class="cx-jor-capitulo-ordem">' +
					escapeHtml(c.ordem || '?') +
					'</span>' +
					'<div class="cx-jor-capitulo-texto">' +
					'<span class="cx-jor-capitulo-nome">' +
					escapeHtml(c.titulo || c.id) +
					(c.ehDosChefes ? ' <span class="ri-badge ri-badge--ouro">Chefes</span>' : '') +
					(pinos[c.id]
						? ' <span class="cx-jor-capitulo-lugar">' +
							glifo('pin') +
							escapeHtml(pinos[c.id].lugar) +
							'</span>'
						: '') +
					'</span>' +
					(c.abertura ? '<span class="cx-jor-capitulo-abertura">' + escapeHtml(c.abertura) + '</span>' : '') +
					'</div>' +
					'<div class="cx-jor-capitulo-lado">' +
					seloHtml(c.estado) +
					'<span class="cx-jor-contador">' +
					escapeHtml(contadorEscrito(c.concluidas, c.total)) +
					'</span>' +
					'</div>' +
					'<div class="ri-bar ri-bar--exp cx-jor-barra"><div class="fill" style="width:' +
					pct +
					'%"></div></div>' +
					'<div class="cx-jor-acao">' +
					/*
					 * ESPIAR O QUE VEM E PERMITIDO, e por isso o botao de um
					 * capitulo bloqueado continua de pe - so que SECUNDARIO. Ele
					 * nao pode competir em peso com o do capitulo que da para
					 * jogar agora. Com a Jornada TRANCADA ele apaga: la ele nao
					 * abriria nada, e botao que nao faz nada parece defeito.
					 */
					'<button type="button" class="cx-jor-ir ri-btn' +
					(c.estado === 'bloqueado' ? ' ri-btn--sec' : '') +
					'"' +
					(trancada
						? ' disabled title="A Jornada ainda não está aberta"'
						: ' data-capitulo="' + escapeHtml(c.id) + '"') +
					'>Ver as missões</button>' +
					'</div>' +
					'</div>'
				);
			})
			.join('') +
		'</div>'
	);
}

/** TELA B - a lista de missoes de UM capitulo. */
function telaDoCapituloHtml(jornada) {
	const cap = capituloPorId(_ctx.capituloAberto);
	if (!cap) {
		return '<div class="cx-vazio">Este capítulo não está no retrato do servidor.</div>';
	}
	const missoes = _ctx.missoesPorCapitulo[cap.id];
	const corpo = !missoes
		? '<div class="cx-carregando">Carregando as missões deste capítulo…</div>'
		: missoes.length === 0
			? '<div class="cx-vazio">Este capítulo não tem missão nenhuma.</div>'
			: '<div class="cx-jor-missoes">' + missoes.map(m => linhaDeMissaoHtml(m, null)).join('') + '</div>';

	return (
		voltarHtml('Todos os capítulos') +
		'<div class="cx-jor-cabeca">' +
		'<span class="cx-jor-capitulo-ordem">' +
		escapeHtml(cap.ordem || '?') +
		'</span>' +
		'<div>' +
		'<div class="cx-jor-cabeca-titulo">' +
		escapeHtml(cap.titulo || cap.id) +
		'</div>' +
		(cap.abertura ? '<div class="cx-jor-cabeca-abertura">' + escapeHtml(cap.abertura) + '</div>' : '') +
		'</div>' +
		'<div class="cx-jor-cabeca-lado">' +
		seloHtml(cap.estado) +
		'<span class="cx-jor-contador">' +
		escapeHtml(contadorEscrito(cap.concluidas, cap.total)) +
		'</span></div>' +
		'</div>' +
		legendaHtml() +
		corpo +
		(cap.fecho ? '<div class="cx-jor-fecho">' + escapeHtml(cap.fecho) + '</div>' : '')
	);
}

/** TELA da PONTE - todas as missoes de uma especie, em todos os mapas. */
function telaDaEspecieHtml() {
	const mobId = _ctx.especieAberta;
	const achadas = missoesDaEspecie(_ctx.missoesPorCapitulo, mobId);
	const nome = achadas.length ? achadas[0].monstro : nomeDaEspecieNoCodex(mobId);
	const faltam = Number(_ctx.faltamNaVarredura) || 0;

	return (
		voltarHtml('Voltar') +
		'<div class="cx-jor-cabeca">' +
		avatarHtml(mobId, 'cx-jor-avatar cx-jor-avatar--grande') +
		'<div>' +
		'<div class="cx-jor-cabeca-titulo">' +
		escapeHtml(nome || 'Espécie #' + mobId) +
		'</div>' +
		'<div class="cx-jor-cabeca-abertura">' +
		(achadas.length === 0
			? 'Nenhuma missão da Jornada encontrada para esta espécie até aqui.'
			: achadas.length === 1
				? 'Uma missão da Jornada, em um mapa.'
				: achadas.length + ' missões da Jornada, em ' + mapasDistintos(achadas) + ' mapas.') +
		'</div>' +
		'</div>' +
		'</div>' +
		(faltam
			? '<div class="cx-jor-nota">Procurando nos capítulos que ainda não chegaram - faltam ' + faltam + '.</div>'
			: '') +
		(achadas.length
			? '<div class="cx-jor-missoes">' +
				achadas.map(m => linhaDeMissaoHtml(m, { comCapitulo: true })).join('') +
				'</div>'
			: '')
	);
}

function mapasDistintos(missoes) {
	const vistos = {};
	for (const m of missoes) {
		vistos[m.mapa] = true;
	}
	return Object.keys(vistos).length;
}

/** O nome da especie pelo Codex, quando a Jornada ainda nao a trouxe. */
function nomeDaEspecieNoCodex(mobId) {
	const missoes = (_ctx.estado && _ctx.estado.missoes) || [];
	for (const m of missoes) {
		for (const a of m.alvos || []) {
			if (Number(a.mobId) === Number(mobId)) {
				return a.monstro;
			}
		}
	}
	return '';
}

function voltarHtml(texto) {
	return (
		'<button type="button" class="cx-jor-voltar" data-vista="jornada">' +
		glifo('desfazer') +
		'<span>' +
		escapeHtml(texto) +
		'</span></button>'
	);
}

/** O trilho das duas telas de topo (mapa e jornada inteira). */
function trilhoHtml() {
	const atual = _ctx.vista === 'jornada' ? 'jornada' : 'mapa';
	return (
		'<div class="cx-jor-trilho">' +
		'<button type="button" class="cx-jor-trilho-item ri-tab' +
		(atual === 'mapa' ? ' is-active' : '') +
		'" data-vista="mapa">Mapa de Midgard</button>' +
		'<button type="button" class="cx-jor-trilho-item ri-tab' +
		(atual === 'jornada' ? ' is-active' : '') +
		'" data-vista="jornada">A jornada inteira</button>' +
		'</div>'
	);
}

/** O corpo da aba "Missoes do Codex". */
export function jornadaHtml(estado, contexto) {
	_ctx = contexto || {};
	const jornada = estado.jornada;
	if (!jornada) {
		/*
		 * Servidor SEM a Jornada (o cliente sobe antes dele em producao, e o
		 * contrato manda os dois ficarem em `v: 1` justamente para isto). A aba
		 * diz o que houve em vez de mostrar uma tela vazia.
		 */
		return (
			'<div class="cx-vazio">Este servidor ainda não serve a Jornada de Midgard. ' +
			'A aba aparece assim que ele passar a mandá-la.</div>'
		);
	}

	const cabeca = premioHtml(jornada) + (jornada.desbloqueada ? '' : requisitoHtml(jornada));

	if (!jornada.desbloqueada) {
		/*
		 * TRANCADA, e mesmo assim a jornada INTEIRA aparece - o pedido diz que
		 * ela nao pode ser aba vazia. O que ela nao tem e a acao: os capitulos
		 * vem com `estado: 'bloqueado'` do servidor e nao abrem.
		 */
		return (
			cabeca + trilhoHtml() + (_ctx.vista === 'jornada' ? telaDaJornadaHtml(jornada) : telaDoMapaHtml(jornada))
		);
	}

	if (_ctx.vista === 'capitulo') {
		return cabeca + telaDoCapituloHtml(jornada);
	}
	if (_ctx.vista === 'especie') {
		return cabeca + telaDaEspecieHtml();
	}
	return cabeca + trilhoHtml() + (_ctx.vista === 'jornada' ? telaDaJornadaHtml(jornada) : telaDoMapaHtml(jornada));
}
