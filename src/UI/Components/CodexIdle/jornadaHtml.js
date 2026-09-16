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
	/*
	 * A FAIXA, e nao mais o cartao (reforma de 16/09/2026, pedido do dono:
	 * "minimalista e premium... que encaixe dentro de uma janela").
	 *
	 * O cartao antigo tinha fundo dourado, glifo grande e tres linhas de
	 * texto - ~90px que brigavam com o mapa pelo espaco de uma janela de
	 * 600. A faixa diz o MESMO em uma linha: o nome da jornada, o placar e
	 * uma barra de fio. O premio nao sumiu: a descricao e o que falta moram
	 * no `title` do placar, e o glifo troca para o "confere" quando entregue.
	 * Informacao de consulta ocasional nao paga 90px permanentes.
	 */
	const placar = placarDoPremio(jornada);
	const premio = (jornada && jornada.premio) || {};
	const pct = porcentagem(placar.concluidos, placar.total);
	const sobrePremio =
		'Prêmio: ' + (premio.descricao || 'ainda não anunciado pelo servidor') + ' — ' + placar.falta;
	return (
		'<div class="cx-jor-faixa' +
		(placar.entregue ? ' is-entregue' : '') +
		'">' +
		'<span class="cx-jor-faixa-nome">Jornada de Midgard</span>' +
		'<span class="cx-jor-faixa-placar" title="' +
		escapeHtml(sobrePremio) +
		'">' +
		glifo(placar.entregue ? 'confere' : 'recompensas') +
		'<b>' +
		escapeHtml(String(placar.concluidos)) +
		'</b><small>de ' +
		escapeHtml(String(placar.total)) +
		'</small>' +
		'</span>' +
		'<div class="cx-jor-faixa-barra" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
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
 *
 * UMA FAIXA, e nao mais um cartao (16/09/2026 — achado do dono: a janela real
 * estourava 602px de conteudo contra 536,8px disponiveis, e este cartao
 * sozinho pesava 125px, o maior bloco da tela trancada). A frase completa
 * continua inteira — no `title` da faixa, como o placar do premio ja faz —
 * e a versao visivel trunca numa linha. O botao sai do cartao e vira parte da
 * PROPRIA faixa, a direita, onde a faixa do premio poe o placar.
 */
function requisitoHtml(jornada) {
	const req = (jornada && jornada.requisito) || null;
	const titulo = (req && req.titulo) || 'A Jornada ainda não está aberta';
	const como =
		(req && req.comoSeguir) || 'Conclua a missão de troca de classe para começar a Jornada de Midgard.';
	return (
		'<div class="cx-jor-requisito" title="' +
		escapeHtml(titulo + ' — ' + como) +
		'">' +
		'<span class="cx-jor-requisito-glifo" aria-hidden="true">' +
		glifo('cadeado') +
		'</span>' +
		'<span class="cx-jor-requisito-texto">' +
		'<b>' +
		escapeHtml(titulo) +
		'</b><span>' +
		escapeHtml(como) +
		'</span>' +
		'</span>' +
		'<button type="button" class="cx-jor-abrir-missoes ri-btn ri-btn--sec">Abrir as Missões</button>' +
		'</div>'
	);
}

/**
 * A legenda do MAPA: quatro miniaturas do proprio pino, com a palavra ao lado.
 *
 * Ate a reforma de 16/09 ela reusava `seloHtml` - quatro chips coloridos que
 * nao se pareciam com os pinos que pretendiam explicar. Legenda que mostra
 * outra coisa nao legenda nada. As miniaturas sao os MESMOS discos do mapa
 * (mesmas classes de estado), entao mudar o desenho do pino muda a legenda
 * junto, de graca.
 *
 * A prova de que cor nao e o unico sinal continua valendo: os quatro estados
 * se distinguem pela FORMA (cheio, anel, vazado, tracejado) - e a reforma
 * reduziu a paleta a ouro + neutro justamente apoiada nesse eixo.
 */
function legendaHtml() {
	const itens = [
		['is-concluido', 'Concluído'],
		['is-andamento', 'Em andamento'],
		['is-disponivel', 'Disponível'],
		['is-bloqueado', 'Bloqueado']
	];
	return (
		'<div class="cx-jor-legenda">' +
		itens
			.map(
				par =>
					'<span class="cx-jor-legenda-item ' +
					par[0] +
					'"><i class="cx-jor-legenda-pino" aria-hidden="true"></i>' +
					par[1] +
					'</span>'
			)
			.join('') +
		'</div>'
	);
}

/** TELA A - o mapa-mundi com os capitulos como lugares. */
/**
 * A PERNA ATUAL: o arco do capitulo anterior ate o proximo passo.
 *
 * A PRIMEIRA VERSAO LIGAVA TODOS OS CAPITULOS em sequencia, e so olhando deu
 * para ver que estava errado: a ordem dos capitulos e de DIFICULDADE, nao de
 * geografia. O fio saia Prontera -> Geffen -> Payon -> Morroc -> Ayothaya ->
 * Comodo, cruzando o mapa inteiro de um lado ao outro, e o resultado era um
 * rabisco por cima da ilustracao. Mais linha nao e mais premium.
 *
 * O que ficou e UM arco so: de onde o jogador veio para onde ele vai agora.
 * Ele nunca vira rabisco, some quando a jornada acaba, e diz a unica coisa
 * que o jogador precisa saber olhando o mapa.
 *
 * `viewBox="0 0 100 100"` com `preserveAspectRatio="none"` faz a coordenada
 * do SVG ser a MESMA porcentagem que o pino usa em `left/top`. Sem isso eu
 * precisaria converter para pixel e o fio sairia do lugar em toda largura de
 * tela diferente - o defeito que o `%` do pino ja evita.
 */
function rotaHtml(capitulos, pinos, proximo) {
	if (!proximo || !pinos[proximo.id]) {
		return '';
	}
	const comPino = capitulos.filter(c => pinos[c.id]);
	const onde = comPino.findIndex(c => c.id === proximo.id);
	if (onde < 1) {
		return '';
	}
	const de = pinos[comPino[onde - 1].id];
	const ate = pinos[proximo.id];
	/*
	 * O ARCO, e nao a reta. A curva sai da linha que o mapa ja tem (estradas,
	 * costa) em vez de competir com ela, e da a leitura de "trajeto". O desvio
	 * e perpendicular ao segmento, com 18% do comprimento - o bastante para
	 * curvar, pouco o bastante para nao passar por cima de outro pino.
	 */
	const mx = (de.x + ate.x) / 2;
	const my = (de.y + ate.y) / 2;
	const dx = ate.x - de.x;
	const dy = ate.y - de.y;
	const cx = mx - dy * 0.18;
	const cy = my + dx * 0.18;
	const d = 'M' + de.x + ' ' + de.y + ' Q' + cx + ' ' + cy + ' ' + ate.x + ' ' + ate.y;
	return (
		'<svg class="cx-jor-mapa-rota" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
		'<path class="cx-jor-rota-perna" d="' + d + '" />' +
		'</svg>'
	);
}

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
				'%;--progresso:' +
				porcentagem(c.concluidas, c.total) +
				'"' +
				// Trancada, o pino nao abre nada - e um botao que nao faz nada e
				// pior que um botao apagado, que ao menos diz que ainda nao e hora.
				(trancada ? ' disabled' : ' data-capitulo="' + escapeHtml(c.id) + '"') +
				' title="' +
				escapeHtml(c.titulo + ' - ' + s.rotulo + ' - ' + contadorEscrito(c.concluidas, c.total) + ' missões') +
				'">' +
				/*
				 * O ANEL DE PROGRESSO e o que faz o mapa "encher" a cada missao,
				 * e nao so a cada capitulo: ele le `--progresso` (0..100) e
				 * desenha a fatia com um `conic-gradient`. Sem ele o pino so
				 * tinha QUATRO estados, e o jogador que matou 30 de 48 via a
				 * mesma marca de quem matou 1.
				 *
				 * `aria-hidden`: o numero ja vai escrito no `title` do botao e
				 * na lista abaixo. Anunciar de novo seria ruido no leitor.
				 */
				'<span class="cx-jor-pino-anel" aria-hidden="true"></span>' +
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

	/*
	 * A NOTA DOS "N CAPITULOS SEM LUGAR" SAIU DA TELA (reforma de 16/09).
	 *
	 * Ela era a justificativa do desenvolvedor - por que ha menos pinos que
	 * capitulos - vazando para o jogador, que nao pediu satisfacao nenhuma. A
	 * regra que ela defendia continua inteira no cabecalho de
	 * `pinosDosCapitulos`; a lista continua mostrando os 22; e `semPino` segue
	 * calculado acima porque o portao de teste o exercita.
	 */
	void semPino;

	return (
		'<div class="cx-jor-mapa-caixa">' +
		'<img class="cx-jor-mapa-fundo" src="' +
		MAPA_DE_MIDGARD +
		'" alt="Mapa de Midgard" />' +
		rotaHtml(capitulos, pinos, proximo) +
		marcas +
		/*
		 * O PROXIMO PASSO FLUTUA SOBRE O MAPA, dentro da caixa (16/09). O
		 * cartao antigo morava ABAIXO, com narrativa e botao proprio: ~120px
		 * que empurravam a tela para fora da janela de 600. A barra ocupa
		 * altura NENHUMA (overlay) e a narrativa fica onde ja morava por
		 * inteiro, na tela do capitulo.
		 */
		(proximo ? proximoPassoHtml(proximo) : '') +
		'</div>' +
		legendaHtml()
	);
}

/**
 * A barra flutuante do PROXIMO PASSO - o que o pedido chama de "evidente".
 *
 * Ela e UM botao inteiro (`data-capitulo`), e nao um cartao com um botao
 * dentro: o gesto que a barra oferece e um so, entao a barra inteira e o
 * alvo. O chevron diz "isto abre" sem custar um segundo rotulo.
 */
function proximoPassoHtml(cap) {
	return (
		'<button type="button" class="cx-jor-proximo" data-capitulo="' +
		escapeHtml(cap.id) +
		'" title="Abrir as missões deste capítulo">' +
		'<span class="cx-jor-proximo-rotulo">Próximo</span>' +
		'<span class="cx-jor-proximo-titulo">' +
		escapeHtml(String(cap.ordem || '') + '. ' + (cap.titulo || cap.id)) +
		'</span>' +
		'<span class="cx-jor-proximo-conta">' +
		escapeHtml(contadorEscrito(cap.concluidas, cap.total)) +
		'</span>' +
		'<span class="cx-jor-proximo-seta" aria-hidden="true">&rsaquo;</span>' +
		'</button>'
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

	/*
	 * A LINHA INTEIRA E O BOTAO (reforma de 16/09/2026).
	 *
	 * Cada capitulo tinha um cartao com borda colorida, fundo proprio, selo
	 * escrito, barra grossa e um botao azul "Ver as missoes" - vinte e dois
	 * botoes identicos e nenhum silencio. O gesto que a linha oferece e UM
	 * (abrir o capitulo), entao a linha e o alvo: `<button>` de verdade, com
	 * `data-capitulo`, que o `closest` do handler ja resolve sem uma linha de
	 * JS nova. O chevron a direita e o unico convite que sobrou.
	 *
	 * O que cada coisa virou: o selo escrito virou o GLIFO do estado (a
	 * palavra continua no `title`, e a forma do glifo distingue os quatro sem
	 * cor); a barra grossa virou um fio de 2px rente a base, so em quem tem
	 * progresso para mostrar; a narrativa continua a regra de sempre (celular
	 * so no proximo; desktop em todos, agora num corpo mais quieto); e a
	 * legenda saiu - linha que se explica nao precisa de manual em cima.
	 */
	return (
		'<div class="cx-jor-capitulos">' +
		capitulos
			.map(c => {
				const s = seloDoEstado(c.estado);
				const pct = porcentagem(c.concluidas, c.total);
				const ehProximo = proximo && proximo.id === c.id;
				return (
					'<button type="button" class="cx-jor-capitulo ' +
					escapeHtml(s.classe) +
					(ehProximo ? ' is-proximo' : '') +
					'"' +
					(trancada ? ' disabled' : ' data-capitulo="' + escapeHtml(c.id) + '"') +
					' title="' +
					escapeHtml(s.rotulo + (trancada ? ' — a Jornada ainda não está aberta' : '')) +
					'">' +
					'<span class="cx-jor-capitulo-ordem">' +
					escapeHtml(c.ordem || '?') +
					'</span>' +
					'<span class="cx-jor-capitulo-texto">' +
					'<span class="cx-jor-capitulo-nome">' +
					(ehProximo ? '<span class="cx-jor-fita">Próximo</span>' : '') +
					escapeHtml(c.titulo || c.id) +
					(c.ehDosChefes ? ' <span class="ri-badge ri-badge--ouro">Chefes</span>' : '') +
					'</span>' +
					(c.abertura ? '<span class="cx-jor-capitulo-abertura">' + escapeHtml(c.abertura) + '</span>' : '') +
					'</span>' +
					'<span class="cx-jor-capitulo-lado">' +
					'<span class="cx-jor-capitulo-estado" aria-hidden="true">' +
					glifo(s.glifo) +
					'</span>' +
					'<span class="cx-jor-contador">' +
					escapeHtml(contadorEscrito(c.concluidas, c.total)) +
					'</span>' +
					'</span>' +
					'<span class="cx-jor-capitulo-seta" aria-hidden="true">&rsaquo;</span>' +
					(pct > 0 && pct < 100
						? '<span class="cx-jor-fio" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
						: '') +
					'</button>'
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
		// Sem legenda aqui (16/09): cada linha de missao ja carrega o selo COM
		// a palavra escrita - a legenda era um manual explicando o que a
		// propria pagina soletra logo abaixo.
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
	/*
	 * SEM MAPA, SEM TRILHO. Duas abas em que uma leva ao lugar onde a outra ja
	 * esta e pior que nenhuma: ela promete uma tela que nao existe. No celular
	 * a Jornada tem UMA tela, entao o seletor some junto com o mapa.
	 */
	if (_ctx.semMapa) {
		return '';
	}
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

/**
 * A TELA DE ABERTURA DA ABA: o mapa, ou a lista.
 *
 * No desktop o padrao e o MAPA e o jogador troca pelo trilho. No celular em
 * pe (`semMapa`) o mapa nao existe, entao a lista e a unica - e a escolha
 * guardada em `vista` nao pode mandar, senao quem abriu o mapa no desktop e
 * depois girou o telefone cairia numa tela em branco.
 */
function telaDaListaOuMapa(jornada) {
	if (_ctx.semMapa || _ctx.vista === 'jornada') {
		return telaDaJornadaHtml(jornada);
	}
	return telaDoMapaHtml(jornada);
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
			cabeca + trilhoHtml() + telaDaListaOuMapa(jornada)
		);
	}

	if (_ctx.vista === 'capitulo') {
		return cabeca + telaDoCapituloHtml(jornada);
	}
	if (_ctx.vista === 'especie') {
		return cabeca + telaDaEspecieHtml();
	}
	return cabeca + trilhoHtml() + telaDaListaOuMapa(jornada);
}
