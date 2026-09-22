/**
 * UI/Components/TemporadaIdle/formatoDaTemporada.js
 *
 * A METADE PURA da janela da Temporada (Season 1 — "Luz & Trevas: Herdeiros
 * de Midgard"). Tudo aqui é função de entrada -> string/objeto, sem DOM, sem
 * Network, sem GUIComponent — o mesmo corte que `PainelComandoIdle` fez com
 * `tabelaDoPainel.js` (ver o cabeçalho daquele arquivo): a metade que decide
 * roda de verdade em teste; a metade que MONTA a janela (pacote fisgado,
 * arrasto, registro na pilha) é lida no fonte, porque levantar a janela de
 * verdade puxa WebGL e uma sessão logada.
 *
 * ## A regra que este módulo nunca quebra
 *
 * O servidor decide TUDO (preço, veredito de compra, pity, situação de cada
 * nível do passe). Nenhuma função aqui recalcula saldo, chance ou pity — elas
 * só formatam o que já chegou pronto em `ZC_RAGIDLE_TEMPORADA` (0x0fbb). Ver
 * `servidor/temporada/loja-da-temporada.ts:estadoParaJanela` (rag-idle-master)
 * para o contrato exato.
 *
 * ## O redesenho de 21/09/2026 (o dono: "ta muito feio o visual")
 *
 * Tres pedidos, e os tres moram aqui:
 *
 * 1. A progressao do passe ENCOLHEU e foi para a aba Destaques
 *    (`renderPasseCompactoHtml`): sao 50 niveis e so 8 tem premio, entao a
 *    trilha de 50 bolinhas em duas linhas virou UMA fileira com os 8 marcos.
 *    O botao "Resgatar" continua em cada marco - a aba "Passe" saiu, o verbo
 *    nao.
 * 2. A janela de Recompensas foi APOSENTADA e o conteudo dela mora aqui: o
 *    Passe Semanal (`renderSemanalHtml`) e a compra do VIP dentro de
 *    `renderVipHtml`. As funcoes vieram de `PasseIdle.js` (vitrine, trilha de
 *    sete dias, veredito do botao) - o DADO continua vindo do pacote do Passe
 *    (`ZC_RAGIDLE_PASSE`), que segue tendo o PasseIdle como dono.
 * 3. O visual: a CAIXA ganhou o glifo do slot que ela veste (o mesmo da
 *    Mochila) e a previa das seis recompensas em arte real, em vez de uma
 *    letra; o banner virou um degrade continuo de luz para trevas.
 *
 * Os glifos vem de `UI/ri-icones.js` (strings puras, sem DOM) - nada de SVG
 * desenhado a mao aqui, que e o que o design system proibe.
 *
 * ## O redesenho premium de 22/09/2026 (contrato V2, `CONTRATO-TEMPORADA-V2.md`)
 *
 * Tres mudancas de fundo, e as tres moram aqui:
 *
 * 1. O PASSE PREMIUM SAIU DE VEZ (nao so da tela - do contrato). Os campos
 *    `pontos/pontosPorNivel/pontosNoNivel/tetoDiario/pontosHoje/
 *    pontosPorAbate/premium/precoPremium/compraPremium` nao existem mais em
 *    `estado.passe`. `renderPremiumHtml`/`renderPasseCompactoHtml` saem
 *    inteiras - funcao pura sem chamador fica verde para sempre.
 * 2. O PASSE DE BATALHA VIRA ABA PROPRIA, com XP (nao mais "pontos"), a
 *    segunda trilha e o VIP de 30 dias (nao mais Premium comprado), missoes
 *    diarias e semanais, e uma trilha de recompensas com ATE `niveis` marcos
 *    por lado (nao mais so os 8 que tinham premio). `renderPasseDeBatalhaHtml`
 *    e as funcoes que ela usa leem SEMPRE os campos do JSON
 *    (`passe.niveis`/`passe.xpPorNivel`/...), nunca um numero cravado - o
 *    documento de redesenho mostra "Nivel X / 50" e "Hoje: X / 200" na secao
 *    19, e isso e texto de UMA versao anterior do contrato: os numeros certos
 *    (30 niveis, 1000 XP/nivel, 400 XP de caca/dia) sao os de hoje, mas
 *    amanha podem nao ser, e o codigo nao pode saber a diferenca.
 * 3. O PASSE SEMANAL SAI (`renderSemanalHtml` e a funcao que ele chamava
 *    foram embora com ele - decisao do dono, 22/09/2026: desativar por
 *    completo). O VIP de 30 dias CONTINUA vendendo pelo mesmo pacote de
 *    sempre (`ZC_RAGIDLE_PASSE`/`estadoDoPasse`) - so o produto semanal saiu
 *    do catalogo, a compra do VIP nao mudou de dono nem de forma.
 *
 * ## Emenda 1 ao contrato (Team Lead, 22/09, depois da revisao independente)
 *
 * Tres correcoes, e as tres moram aqui:
 *
 * 1. `passe.diasRestantes` E OS DIAS DA TEMPORADA, nao do VIP (a leitura
 *    original deste arquivo estava ERRADA - ficou documentado e corrigido
 *    aqui). Pode vir `null` quando a temporada ainda nao tem data de fim; os
 *    dias do VIP continuam so em `estado.vip.diasRestantes`. `Number(null)`
 *    vira `0`, que `Number.isFinite` aceita - por isso a checagem aqui e
 *    SEMPRE `!= null` ANTES de `Number(...)`, nunca so `Number.isFinite`.
 * 2. `passe.semanais` PODE VIR `null` (temporada sem data de inicio ainda).
 *    `renderMissoesSemanaisHtml` devolve string vazia nesse caso - o bloco
 *    some da tela sem quebrar, nunca desenha "undefined XP".
 * 3. `concluidas` (diarias e semanais) conta SO as que pagam (no maximo
 *    `queContam`) - o servidor ja faz essa conta; o cliente so mostra o
 *    numero pronto, nunca soma `concluido:true` sozinho.
 */

import RiIcones from 'UI/ri-icones.js';

/** Mesmo escape de PasseIdle.js/PainelComandoIdle.js — sem depender de DOM. */
export function escapeHtml(value) {
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

/** Um glifo do design system, ou string vazia - a janela nunca quebra por icone. */
export function glifo(chave) {
	return (RiIcones && RiIcones[chave]) || '';
}

/*
 * A PORCENTAGEM DE CADA ITEM SAIU DA TELA (decisao do dono, 22/09/2026, com
 * estas palavras: *"a porcentagem que aparece ali de cada item que vem na
 * caixa, a gente vai remover, a gente nao vai mostrar a porcentagem que e de
 * cada item"*).
 *
 * Havia uma `formatarPorcentagem(chance, escala)` aqui, com dois chamadores: o
 * `title` da previa do card e a coluna da direita do modal "Ver conteudo". Os
 * dois sairam, e a funcao foi junto - funcao pura exportada sem chamador passa
 * a ser testada por ninguem e fica verde para sempre, que e uma armadilha ja
 * catalogada neste projeto.
 *
 * O campo `chance`/`escala` CONTINUA chegando no pacote: quem decide o sorteio
 * e o servidor, e o contrato v1 do `ZC_RAGIDLE_TEMPORADA` nao muda por uma
 * decisao de tela. O que mudou e que a janela nao o desenha em lugar nenhum.
 */

/**
 * Centavos inteiros (900) -> "R$ 9,00". NUNCA passa por ponto flutuante na
 * conta de reais/centavos — a regra do dono ("nunca float na conta de
 * dinheiro") que o cabeçalho da tarefa cita.
 */
export function formatarPrecoCentavos(centavos) {
	const n = Math.max(0, Math.trunc(Number(centavos) || 0));
	const reais = Math.trunc(n / 100);
	const resto = String(n % 100).padStart(2, '0');
	let reaisTexto;
	try {
		reaisTexto = reais.toLocaleString('pt-BR');
	} catch (err) {
		reaisTexto = String(reais);
	}
	return `R$ ${reaisTexto},${resto}`;
}

/**
 * `20260927` -> `27/09` (portado de PasseIdle.js). O ano fica de fora de
 * proposito: um passe dura no maximo 30 dias, entao o ano nunca desambigua
 * nada e so rouba espaco da linha.
 */
export function dataCurta(yyyymmdd) {
	const n = Number(yyyymmdd) || 0;
	if (n <= 0) {
		return '';
	}
	const dia = String(n % 100).padStart(2, '0');
	const mes = String(Math.trunc(n / 100) % 100).padStart(2, '0');
	return dia + '/' + mes;
}

/** Um instante em ms -> `dd/mm` (o `fimMs` da temporada). */
export function dataCurtaDeMs(ms) {
	const d = new Date(Number(ms));
	if (!Number.isFinite(d.getTime())) {
		return '';
	}
	return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * O TEXTO da raridade, e ele vem do SERVIDOR.
 *
 * A prova de tela de 21/09/2026 fotografou "LEGENDARY" em duas telas do
 * jogador — o reveal e o corpo da carta do correio. O token continua sendo
 * contrato (ele decide a COR, e viaja no pacote); quem escreve a palavra é o
 * servidor, em `rotuloDaRaridade` (`servidor/temporada/sorteio.ts`), pelo mesmo
 * motivo de sempre nesta janela: o cliente só desenha.
 *
 * O `??` é reserva para um payload em cache de antes deste campo (reconexão no
 * meio de um deploy) — nunca uma segunda tabela de tradução.
 */
export function rotuloDaRaridade(objeto) {
	return (objeto && objeto.rotuloDaRaridade) || (objeto && objeto.raridade) || '';
}

/** As três raridades do servidor (COMMON/RARE/LEGENDARY) -> a classe do token. */
export function classeDaRaridade(raridade) {
	const r = String(raridade || '').toUpperCase();
	if (r === 'LEGENDARY') {
		return 'te-raridade--legendary';
	}
	if (r === 'RARE') {
		return 'te-raridade--rare';
	}
	return 'te-raridade--common';
}

/** `situacao` do prêmio do passe (LOCKED/AVAILABLE/CLAIMED) -> a classe do nível. */
export function classeDoNivel(situacao) {
	if (situacao === 'CLAIMED') {
		return 'te-nivel--claimed';
	}
	if (situacao === 'AVAILABLE') {
		return 'te-nivel--available';
	}
	return 'te-nivel--locked';
}

/**
 * O texto (e se é erro) que a `resultado` de uma ação vira na tela.
 *
 * `resultado.texto` já vem pronto do servidor nos dois lados (`ok:true` e
 * `ok:false`) — o cliente só decide a COR pelo campo `ok`, nunca reescreve a
 * frase.
 */
export function avisoDoResultado(resultado) {
	if (!resultado) {
		return null;
	}
	return {
		texto: resultado.texto || '',
		ehErro: resultado.ok === false
	};
}

/** O alfabeto aceito pelo servidor para a `chave` de clique (ver o protocolo). */
const ALFABETO_DA_CHAVE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/**
 * Uma chave NOVA por clique — 16 a 32 chars de `[A-Za-z0-9_-]`, gerada com
 * `crypto.getRandomValues` (nunca `Math.random`, que não é criptográfico e o
 * protocolo explicitamente pede a fonte forte para a dedupe de compra/abertura
 * valer).
 *
 * `Math.random` só entra como ÚLTIMO recurso, se `crypto` não existir no
 * ambiente (nunca deveria faltar num navegador real — é rede de segurança
 * para não quebrar em silêncio, não o caminho esperado).
 */
export function gerarChave(tamanho = 24) {
	const n = Math.min(32, Math.max(16, Math.trunc(tamanho) || 24));
	const bytes = new Uint8Array(n);
	const fonteCripto =
		typeof globalThis !== 'undefined' &&
		globalThis.crypto &&
		typeof globalThis.crypto.getRandomValues === 'function'
			? globalThis.crypto
			: null;
	if (fonteCripto) {
		fonteCripto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < n; i++) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}
	let chave = '';
	for (let i = 0; i < n; i++) {
		chave += ALFABETO_DA_CHAVE[bytes[i] % ALFABETO_DA_CHAVE.length];
	}
	return chave;
}

/**
 * A TRAVA de clique — o mesmo primitivo usado pelo double-click guard E pelo
 * "carregando" que apaga todos os botões de ação (a tarefa pede as duas
 * coisas com a mesma forma: um clique trava até a resposta, ou até 10s sem
 * resposta nenhuma).
 */
export function criarTrava() {
	let travado = false;
	return {
		estaTravado: () => travado,
		travar: () => {
			travado = true;
		},
		destravar: () => {
			travado = false;
		}
	};
}

/** Tile com a INICIAL como retrato — nunca uma imagem quebrada quando o
 * ícone real (arte publicada por id, ou o GRF, feito por quem monta a
 * janela) não puder ser carregado ou nem for tentado (teste, arnês de foto). */
export function iconeFallbackHtml(itemId, texto) {
	const base = String(texto || '').trim();
	const inicial = base ? base.charAt(0).toUpperCase() : '?';
	const idNumero = Number(itemId);
	const idAttr = Number.isFinite(idNumero) && idNumero > 0 ? ` data-item-id="${idNumero}"` : '';
	return `<span class="te-icone ri-tile"${idAttr}><span class="te-icone-fallback">${escapeHtml(inicial)}</span></span>`;
}

/**
 * O GLIFO DO SLOT que a caixa veste - o mesmo que a Mochila desenha na vaga
 * vazia de cada peca (MochilaIdle.js: slotChapeu/slotOculos/slotBoca/
 * slotCapa). A caixa nao tem arte de item propria (o `sku` dela e um nome
 * Aegis sem PNG), e a primeira versao desenhava a LETRA inicial do slot: o
 * dono chamou de feio. O glifo do slot diz a mesma coisa ("isto vai na
 * cabeca") no vocabulario que o jogador ja viu na Mochila.
 */
const GLIFO_DO_SLOT = { Topo: 'slotChapeu', Meio: 'slotOculos', Baixo: 'slotBoca', Manto: 'slotCapa' };

export function glifoDoSlot(slot) {
	return glifo(GLIFO_DO_SLOT[slot] || 'pacote');
}

/**
 * O ICONE PREMIUM de cada caixa (moldura/categoria - regra 18: ele NUNCA
 * substitui o sprite real do item, so identifica a caixa no cabecalho e no
 * resumo). Mapeado pelo `slot`, do mesmo jeito que `glifoDoSlot` - ver
 * `public/ragidle/temporada/MAPA-DOS-ASSETS.md`.
 */
const ICONE_DA_CAIXA = {
	Topo: 'icone-caixa-topo',
	Meio: 'icone-caixa-meio',
	Baixo: 'icone-caixa-baixo',
	Manto: 'icone-caixa-manto'
};

export function iconeDaCaixaUrl(slot) {
	const nome = ICONE_DA_CAIXA[slot];
	return nome ? `/ragidle/temporada/${nome}.webp` : '';
}

/** `n` + singular/plural, sem inventar concordancia fora daqui. */
function plural(n, singular, pluralTexto) {
	return Number(n) === 1 ? singular : pluralTexto;
}

/* ------------------------------------------------------------------ */
/* Destaques: banner, passe compacto, caixas em resumo, atalhos        */
/* ------------------------------------------------------------------ */

/**
 * O banner da Season: o nome e o subtitulo vem do servidor (`temporada`).
 *
 * 22/09/2026: a arte real (`banner-luz-trevas.webp`, identificada visualmente
 * pelo Team Lead - ver `MAPA-DOS-ASSETS.md`) entra como imagem de fundo. A
 * ARTE JA TRAZ "SEASON 1 · LUZ & TREVAS · HERDEIROS DE MIDGARD" pintada -
 * a primeira versao desta funcao escrevia o MESMO texto por cima em HTML, e
 * a prova de tela pegou os dois se sobrepondo, ilegiveis. O texto do
 * servidor (`nome`/`subtitulo`) continua saindo, so que como texto
 * ACESSIVEL (leitor de tela), nunca desenhado por cima da arte - so o
 * `te-banner-prazo` (dinamico, e a arte nao sabe a data de hoje) fica
 * visivel.
 */
export function renderBannerHtml(temporada) {
	const t = temporada || {};
	const nome = t.nome || 'Luz & Trevas';
	const subtitulo = t.subtitulo || 'Herdeiros de Midgard';
	const numero = String(t.id || '').match(/\d+/);
	const season = numero ? `Season ${numero[0]}` : 'Season 1';
	/* `fase` vem do servidor: 'antes' e 'encerrada' chegam os dois com
	   `aberta: false`. Sem `fase` (servidor antigo), `aberta: false` e encerrada.
	   `fimMs` e o primeiro instante FECHADO: o ultimo dia aberto e o de
	   `fimMs - 1`. */
	const fase = t.fase || (t.aberta === false ? 'encerrada' : 'aberta');
	let prazo = '';
	if (fase === 'antes') {
		prazo = t.inicioMs ? `Abre em ${dataCurtaDeMs(t.inicioMs)}` : 'Em breve';
	} else if (fase === 'encerrada') {
		prazo = 'Temporada encerrada';
	} else if (t.fimMs) {
		prazo = `Aberta até ${dataCurtaDeMs(Number(t.fimMs) - 1)}`;
	}
	return (
		`<div class="te-banner${fase === 'encerrada' ? ' is-encerrada' : ''}" role="img" aria-label="${escapeHtml(`${season} · ${nome} · ${subtitulo}`)}">` +
		'<div class="te-banner-arte" aria-hidden="true"></div>' +
		'<div class="te-banner-veu" aria-hidden="true"></div>' +
		(prazo ? `<span class="te-banner-prazo">${escapeHtml(prazo)}</span>` : '') +
		'</div>'
	);
}

/** O banner da aba Caixas (`banner-caixas.webp`) - so a moldura; o titulo da
 * secao continua sendo `te-secao-titulo`, texto de verdade, nunca preso
 * dentro da imagem. */
export function renderBannerDasCaixasHtml() {
	return '<div class="te-banner te-banner--caixas"><div class="te-banner-arte" aria-hidden="true"></div></div>';
}

/* ------------------------------------------------------------------ */
/* Progresso compacto (Destaques) + chamada para a aba Passe de Batalha */
/* ------------------------------------------------------------------ */

/**
 * A BARRA DE NÍVEL (XP) - compartilhada pelos Destaques e pelo cabeçalho do
 * Passe de Batalha. O rótulo ("345 / 1000 XP para o nível 13") sai de DENTRO
 * da barra e vira uma legenda embaixo dela (achado na prova de tela de
 * 22/09/2026: o rótulo branco só lia sobre o trecho PREENCHIDO da barra -
 * sobre o trilho claro, ilegível. Documento §26 também pede o preenchimento
 * AZUL, não verde - `--sp-fill` é o azul que o design system já usa nas
 * barras de SP, reaproveitado aqui em vez de inventar token novo).
 */
export function renderBarraDeNivelHtml(pct, rotulo) {
	return (
		`<div class="ri-bar te-passe-barra"><div class="fill" style="width:${pct}%"></div></div>` +
		`<div class="te-passe-barra-legenda">${escapeHtml(rotulo)}</div>`
	);
}

/**
 * O RESUMO do progresso nos Destaques (contrato V2): nivel, barra de XP no
 * nivel atual e as DUAS fontes de XP do dia (caca e missoes diarias - o
 * contrato manda os dois separados, `tetoDiarioDeCaca`/`xpDeCacaHoje` de um
 * lado e `diarias.xpHoje`/`diarias.tetoDeXp` do outro). Nenhum numero e
 * cravado aqui - se o servidor mandar `niveis: 40`, esta secao desenha 40.
 */
export function renderProgressoDaTemporadaHtml(passe) {
	const niveis = Math.max(1, Number(passe.niveis) || 1);
	const nivel = Math.max(0, Number(passe.nivel) || 0);
	const xpPorNivel = Math.max(1, Number(passe.xpPorNivel) || 1);
	const xpNoNivel = Math.max(0, Number(passe.xpNoNivel) || 0);
	const noTeto = nivel >= niveis;
	const pctBarra = noTeto ? 100 : Math.min(100, Math.max(0, Math.round((xpNoNivel / xpPorNivel) * 100)));
	const rotuloBarra = noTeto ? 'Nível máximo alcançado' : `${xpNoNivel} / ${xpPorNivel} XP para o nível ${nivel + 1}`;

	const tetoCaca = Number(passe.tetoDiarioDeCaca);
	const xpCaca = Number(passe.xpDeCacaHoje);
	const notaCaca =
		Number.isFinite(tetoCaca) && tetoCaca > 0
			? `Caça hoje: <strong>${escapeHtml(xpCaca)}</strong> / ${escapeHtml(tetoCaca)} XP`
			: '';

	const diarias = passe.diarias || {};
	const tetoMissoes = Number(diarias.tetoDeXp);
	const xpMissoes = Number(diarias.xpHoje);
	const notaMissoes =
		Number.isFinite(tetoMissoes) && tetoMissoes > 0
			? `Missões hoje: <strong>${escapeHtml(xpMissoes)}</strong> / ${escapeHtml(tetoMissoes)} XP`
			: '';

	/* `diasRestantes` pode vir `null` (temporada sem data de fim ainda) -
	   `Number(null)` vira 0, que `Number.isFinite` aceita, entao a checagem
	   de "veio mesmo" tem que ser `!= null` ANTES de converter (emenda 1). */
	const notaDias =
		passe.diasRestantes != null
			? `${escapeHtml(passe.diasRestantes)} ${plural(passe.diasRestantes, 'dia restante', 'dias restantes')} de temporada`
			: '';

	return (
		'<section class="te-secao te-progresso">' +
		'<header class="te-secao-cab">' +
		`<h3 class="te-secao-titulo">${glifo('estrela')}<span>Progresso da Temporada</span></h3>` +
		`<span class="te-passe-nivel">Nível <strong>${nivel}</strong><span class="te-passe-de"> / ${niveis}</span></span>` +
		'</header>' +
		renderBarraDeNivelHtml(pctBarra, rotuloBarra) +
		'<div class="te-passe-meta">' +
		(notaCaca ? `<span>${notaCaca}</span>` : '') +
		(notaMissoes ? `<span>${notaMissoes}</span>` : '') +
		(notaDias ? `<span>${notaDias}</span>` : '') +
		'</div>' +
		'</section>'
	);
}

/**
 * O card de chamada para o Passe de Batalha (documento §16: "não colocar o
 * Battle Pass completo aqui", só o convite). O mascote é ilustração, não
 * ícone minúsculo (§C do documento) - por isso vive num card largo, sozinho,
 * sem disputar espaço com o resto do texto.
 */
export function renderChamadaDoPasseHtml() {
	return (
		'<button type="button" class="te-chamada-passe ri-card" data-ir="passe">' +
		'<img class="te-chamada-passe-mascote" src="/ragidle/temporada/mascote-passe.webp" alt="" width="96" height="96">' +
		'<span class="te-chamada-passe-texto">' +
		'<span class="te-chamada-passe-titulo">Passe de Batalha</span>' +
		'<span class="te-chamada-passe-sub">Suba de nível caçando e resgate recompensas nas trilhas Free e VIP.</span>' +
		'</span>' +
		`<span class="ri-btn te-chamada-passe-botao">Ver Passe de Batalha${glifo('chevronDir')}</span>` +
		'</button>'
	);
}

/** As caixas em resumo (Destaques): icone da caixa, nome, fechadas e o lendario. */
export function renderResumoDasCaixasHtml(caixas) {
	const cards = (caixas || [])
		.map(c => {
			const fechadas = Number(c.fechadas) || 0;
			const lendaria = (c.recompensas || []).find(r => String(r.raridade || '').toUpperCase() === 'LEGENDARY');
			const sub =
				`${fechadas} ${plural(fechadas, 'fechada', 'fechadas')}` + (lendaria ? ` · ${lendaria.nome}` : '');
			const iconeUrl = iconeDaCaixaUrl(c.slot);
			const glifoImg = iconeUrl
				? `<img class="te-resumo-caixa-glifo-img" src="${iconeUrl}" alt="" width="20" height="20">`
				: glifoDoSlot(c.slot);
			return (
				`<button type="button" class="te-resumo-caixa ri-card${fechadas > 0 ? ' is-tem' : ''}" data-ir="caixas" data-pool="${escapeHtml(c.pool)}">` +
				`<span class="te-resumo-caixa-glifo ri-tile">${glifoImg}</span>` +
				'<span class="te-resumo-caixa-texto">' +
				`<span class="te-resumo-caixa-nome">${escapeHtml(c.nome)}</span>` +
				`<span class="te-resumo-caixa-sub">${escapeHtml(sub)}</span>` +
				'</span>' +
				(fechadas > 0
					? `<span class="te-resumo-caixa-contagem">${fechadas}</span>`
					: `<span class="te-resumo-caixa-seta">${glifo('chevronDir')}</span>`) +
				'</button>'
			);
		})
		.join('');
	return (
		'<section class="te-secao">' +
		'<header class="te-secao-cab">' +
		`<h3 class="te-secao-titulo">${glifo('pacote')}<span>Caixas da Temporada</span></h3>` +
		`<button type="button" class="te-link" data-ir="caixas"><span>Ver todas</span>${glifo('chevronDir')}</button>` +
		'</header>' +
		`<div class="te-resumo-caixas">${cards}</div>` +
		'</section>'
	);
}

/** O passe de um tipo ('semanal'/'vip') no estado do Passe, ou null. */
export function passePorTipo(estadoDoPasse, tipo) {
	const lista = (estadoDoPasse && estadoDoPasse.passes) || [];
	return lista.find(p => p && p.tipo === tipo) || null;
}

/**
 * Os atalhos do rodape dos Destaques - depois do Passe Semanal sair
 * (22/09/2026), sobraram Caixas e VIP (documento §16: "atalhos para Caixas e
 * VIP").
 */
export function renderAtalhosHtml(vip) {
	const vipTexto =
		vip && vip.ativo
			? `Ativo · ${escapeHtml(vip.diasRestantes)} ${plural(vip.diasRestantes, 'dia', 'dias')}`
			: 'EXP, drop e visual exclusivo';
	return (
		'<div class="te-atalhos">' +
		'<button type="button" class="te-atalho ri-card" data-ir="caixas">' +
		'<span class="te-atalho-glifo te-atalho-glifo--arte"><img src="/ragidle/temporada/icone-caixas.webp" alt="" width="34" height="34"></span>' +
		'<span class="te-atalho-texto">' +
		'<span class="te-atalho-nome">Caixas</span>' +
		'<span class="te-atalho-sub">Visuais exclusivos da temporada</span>' +
		'</span>' +
		`<span class="te-atalho-seta">${glifo('chevronDir')}</span>` +
		'</button>' +
		`<button type="button" class="te-atalho te-atalho--vip ri-card${vip && vip.ativo ? ' is-ativo' : ''}" data-ir="vip">` +
		'<span class="te-atalho-glifo te-atalho-glifo--arte"><img src="/ragidle/temporada/icone-atalho-vip.webp" alt="" width="34" height="34"></span>' +
		'<span class="te-atalho-texto">' +
		'<span class="te-atalho-nome">VIP</span>' +
		`<span class="te-atalho-sub">${vipTexto}</span>` +
		'</span>' +
		`<span class="te-atalho-seta">${glifo('chevronDir')}</span>` +
		'</button>' +
		'</div>'
	);
}

/** A aba Destaques inteira: banner, progresso, chamada do Passe de Batalha,
 * caixas em resumo, atalhos (Caixas/VIP). Depois que o Passe Semanal saiu
 * (22/09/2026), nada nos Destaques depende mais do estado do Passe
 * (`estadoDoPasse`) - só a aba VIP continua precisando dele, para o botão
 * de comprar/renovar. */
export function renderDestaquesHtml(estado) {
	return (
		renderBannerHtml(estado.temporada) +
		renderProgressoDaTemporadaHtml(estado.passe) +
		renderChamadaDoPasseHtml() +
		renderResumoDasCaixasHtml(estado.caixas) +
		renderAtalhosHtml(estado.vip)
	);
}

/* ------------------------------------------------------------------ */
/* Caixas                                                              */
/* ------------------------------------------------------------------ */

/** Um card completo de caixa (Caixas Topo/Meio/Baixo/Manto). */
export function renderCaixaHtml(caixa) {
	const precoHtml =
		caixa.preco === null
			? '<span class="te-caixa-preco te-caixa-preco--indefinido">Preço a definir</span>'
			: `<span class="te-caixa-preco"><strong>${escapeHtml(caixa.preco)}</strong><span>RO Cash</span></span>`;

	const garantia = Math.max(1, Number(caixa.pity.garantia) || 1);
	const pctPity = Math.min(100, Math.max(0, Math.round((Number(caixa.pity.contador) / garantia) * 100)));

	const notaPity = caixa.pity.garantidoNaProxima
		? `<div class="te-pity-garantido">${glifo('brilhos')}<span>Lendário garantido na próxima</span></div>`
		: caixa.pity.faltam <= 10
			? `<div class="te-pity-faltam">Faltam ${escapeHtml(caixa.pity.faltam)} ${plural(caixa.pity.faltam, 'abertura', 'aberturas')} para a garantia</div>`
			: '';

	const recompensas = caixa.recompensas || [];
	const previa = recompensas
		.map(
			r =>
				`<span class="te-previa-item ${classeDaRaridade(r.raridade)}" title="${escapeHtml(r.nome)} · ${escapeHtml(rotuloDaRaridade(r))}">` +
				iconeFallbackHtml(r.itemId, r.nome) +
				'</span>'
		)
		.join('');

	const fechadas = Number(caixa.fechadas) || 0;
	const comprarDesabilitado = !caixa.compra.pode;
	const abrirDesabilitado = !(fechadas > 0);
	const iconeUrl = iconeDaCaixaUrl(caixa.slot);
	/* A moldura/identidade da caixa e o icone premium (quando existe um para
	   o slot); o glifo do slot fica de RESERVA - nunca um card sem retrato
	   nenhum. Regra 18: isto NUNCA substitui o sprite real dos itens, que
	   continua na prévia logo abaixo. */
	const glifoCabecalho = iconeUrl
		? `<img class="te-caixa-glifo-img" src="${iconeUrl}" alt="" width="28" height="28">`
		: glifoDoSlot(caixa.slot);

	return (
		`<article class="te-caixa ri-card" data-pool="${escapeHtml(caixa.pool)}">` +
		'<header class="te-caixa-cab">' +
		`<span class="te-caixa-glifo ri-tile">${glifoCabecalho}</span>` +
		'<div class="te-caixa-info">' +
		`<div class="te-caixa-nome">${escapeHtml(caixa.nome)}</div>` +
		`<div class="te-caixa-slot">Visual de ${escapeHtml(caixa.slot)} · ${recompensas.length} ${plural(recompensas.length, 'possibilidade', 'possibilidades')}</div>` +
		'</div>' +
		precoHtml +
		'</header>' +
		`<div class="te-caixa-previa">${previa}</div>` +
		'<div class="te-caixa-estado">' +
		`<span class="te-caixa-fechadas${fechadas > 0 ? ' is-tem' : ''}">${glifo('pacote')}<strong>${fechadas}</strong><span>${plural(fechadas, 'fechada', 'fechadas')}</span></span>` +
		'<div class="te-pity">' +
		`<div class="te-pity-rotulo"><span>Proteção Lendária</span><strong>${escapeHtml(caixa.pity.contador)} / ${escapeHtml(caixa.pity.garantia)}</strong></div>` +
		`<div class="ri-bar te-pity-barra"><div class="fill" style="width:${pctPity}%"></div></div>` +
		'</div>' +
		'</div>' +
		notaPity +
		(caixa.compra.texto ? `<div class="te-nota">${escapeHtml(caixa.compra.texto)}</div>` : '') +
		'<div class="te-caixa-acoes">' +
		`<button type="button" class="te-ver-conteudo ri-btn ri-btn--sec" data-pool="${escapeHtml(caixa.pool)}">Ver conteúdo</button>` +
		`<button type="button" class="ri-btn ri-btn--ouro" data-agir="comprar-caixa" data-pool="${escapeHtml(caixa.pool)}"${comprarDesabilitado ? ' disabled' : ''}>Comprar</button>` +
		`<button type="button" class="ri-btn" data-agir="abrir-caixa" data-pool="${escapeHtml(caixa.pool)}"${abrirDesabilitado ? ' disabled' : ''}>Abrir${fechadas > 0 ? ` (${fechadas})` : ''}</button>` +
		'</div>' +
		'</article>'
	);
}

/**
 * A ORDEM DOS GRUPOS na tela, da melhor para a mais comum.
 *
 * O dono pediu a separacao por categoria em 22/09/2026 e citou duas
 * ("Rara, Lendaria, etc."), sem cravar a ordem. Ela e a da vitrine: a LENDARIA
 * e uma so no pool (`COMPOSICAO_DO_POOL`, no servidor: 3/2/1) e e o que o
 * jogador foi ali ver - abrir a lista pelas tres comuns esconderia a unica
 * linha que importa atras de rolagem.
 *
 * Uma raridade que NAO esteja nesta lista nao some da tela: ela vira um grupo
 * no fim, na ordem em que o servidor mandou. Quem manda no catalogo de
 * raridades e o servidor, e uma tela que engole item por nao reconhecer o
 * token seria a pior forma de descobrir isso.
 */
const ORDEM_DAS_RARIDADES = ['LEGENDARY', 'RARE', 'COMMON'];

/** As recompensas em grupos por raridade, na ordem de `ORDEM_DAS_RARIDADES`. */
export function agruparPorRaridade(recompensas) {
	const porToken = new Map();
	(recompensas || []).forEach(r => {
		const token = String((r && r.raridade) || '').toUpperCase();
		if (!porToken.has(token)) {
			porToken.set(token, []);
		}
		porToken.get(token).push(r);
	});
	const conhecidas = ORDEM_DAS_RARIDADES.filter(t => porToken.has(t));
	const resto = [...porToken.keys()].filter(t => ORDEM_DAS_RARIDADES.indexOf(t) === -1);
	return [...conhecidas, ...resto].map(token => ({
		raridade: token,
		/* O ROTULO E O DO SERVIDOR, como em todo o resto da janela: ele vem no
		   primeiro item do grupo, nunca de uma segunda tabela de traducao aqui. */
		rotulo: rotuloDaRaridade(porToken.get(token)[0]),
		itens: porToken.get(token)
	}));
}

/**
 * O conteudo do modal "Ver conteudo": as 6 recompensas SEPARADAS POR
 * CATEGORIA, e sem a porcentagem de nenhuma (as duas decisoes do dono de
 * 22/09/2026 - ver o bloco no lugar da antiga `formatarPorcentagem`).
 *
 * A raridade deixou de aparecer como selo em CADA linha porque agora ela e o
 * titulo do grupo - dizer a mesma palavra seis vezes embaixo dela nao informa
 * nada. A regra "raridade e TEXTO, nunca so cor" continua de pe: o titulo do
 * grupo e o mesmo selo `.te-raridade`, com a mesma palavra do servidor.
 */
export function renderModalConteudoHtml(caixa) {
	const grupos = agruparPorRaridade(caixa.recompensas)
		.map(grupo => {
			const linhas = grupo.itens
				.map(
					r =>
						'<div class="te-premio-linha">' +
						`<div class="te-premio-icone">${iconeFallbackHtml(r.itemId, r.nome)}</div>` +
						'<div class="te-premio-info">' +
						`<div class="te-premio-nome">${escapeHtml(r.nome)}</div>` +
						'<div class="te-premio-meta">' +
						`<span class="te-premio-slot">${escapeHtml(r.slot)}</span>` +
						(r.animado ? '<span class="te-premio-animado">Animado</span>' : '') +
						'</div>' +
						'</div>' +
						'</div>'
				)
				.join('');
			return (
				`<section class="te-premio-grupo" data-raridade="${escapeHtml(grupo.raridade)}">` +
				'<header class="te-premio-grupo-cab">' +
				`<span class="te-raridade ${classeDaRaridade(grupo.raridade)}">${escapeHtml(grupo.rotulo)}</span>` +
				`<span class="te-premio-grupo-conta">${grupo.itens.length} ${plural(grupo.itens.length, 'item', 'itens')}</span>` +
				'</header>' +
				`<div class="te-premio-grupo-itens">${linhas}</div>` +
				'</section>'
			);
		})
		.join('');
	return (
		'<div class="te-modal-titulo-caixa">' +
		`<span class="te-modal-titulo-glifo ri-tile">${glifoDoSlot(caixa.slot)}</span>` +
		`<span>${escapeHtml(caixa.nome)}</span>` +
		'</div>' +
		`<div class="te-premios">${grupos}</div>`
	);
}

/* ------------------------------------------------------------------ */
/* VIP - a compra veio da janela de Recompensas                        */
/* ------------------------------------------------------------------ */

/**
 * A VITRINE de um produto pago: nome, o que ele e numa linha, o preco em cash
 * e, se ja tem, a vigencia. Portada de `PasseIdle.js:vitrineHtml` - e o unico
 * bloco com aro dourado permanente, para o ouro continuar significando algo.
 */
export function renderVitrineHtml(passe, nome, resumo, referencia) {
	const preco = passe
		? `<div class="te-vitrine-preco"><span class="te-vitrine-preco-valor">${escapeHtml(passe.cash)}</span><span class="te-vitrine-preco-unidade">cash</span></div>`
		: '<div class="te-vitrine-preco"><span class="te-vitrine-preco-valor">…</span></div>';

	const vigencia =
		passe && passe.ativo
			? '<div class="te-vitrine-vigencia">' +
				'<span class="ri-badge ri-badge--verde">Ativo</span>' +
				`<span class="te-vitrine-vigencia-texto">até ${escapeHtml(dataCurta(passe.expiraEm))} · ${escapeHtml(passe.diasRestantes)} ${plural(passe.diasRestantes, 'dia restante', 'dias restantes')}</span>` +
				'</div>'
			: '';

	return (
		'<div class="te-vitrine">' +
		'<div class="te-vitrine-topo">' +
		'<div class="te-vitrine-cabeca">' +
		`<div class="te-vitrine-nome">${escapeHtml(nome)}</div>` +
		`<div class="te-vitrine-resumo">${escapeHtml(resumo)}</div>` +
		(referencia ? `<div class="te-vitrine-referencia">${escapeHtml(referencia)}</div>` : '') +
		'</div>' +
		preco +
		'</div>' +
		vigencia +
		'</div>'
	);
}

/**
 * O botão de compra de um passe, com o texto e o estado certos. Portado de
 * `PasseIdle.js:acaoHtml` - e o VEREDITO continua vindo do servidor no campo
 * `recusa` (`null` = pode comprar), nunca de um `cash >= preco` daqui.
 */
export function renderAcaoDoPasseHtml(passe, cash) {
	if (!passe) {
		return '<div class="te-carregando">Carregando…</div>';
	}
	const recusa = passe.recusa || null;
	const podeComprar = recusa === null;
	const rotulo = passe.ativo ? 'Renovar' : 'Comprar';
	const nota =
		recusa === 'ainda-nao-vence'
			? 'Seu passe ainda vale. A renovação abre no último dia, assim o cash não fica preso num benefício que você já tem.'
			: recusa === 'saldo-insuficiente'
				? `Faltam ${escapeHtml(Number(passe.cash) - Number(cash || 0))} cash.`
				: passe.ativo
					? `Renovar SOMA ${escapeHtml(passe.dias)} dias ao que falta. Você não perde o que já pagou.`
					: 'O valor sai do seu saldo de cash na hora.';

	return (
		'<div class="te-acao">' +
		`<button type="button" class="te-comprar-passe ri-btn ri-btn--ouro" data-agir="comprar-passe" data-tipo="${escapeHtml(passe.tipo)}"${podeComprar ? '' : ' disabled'}>` +
		`${escapeHtml(rotulo)} · ${escapeHtml(passe.cash)} cash</button>` +
		`<div class="te-nota te-nota--centro">${nota}</div>` +
		'</div>'
	);
}

/* ------------------------------------------------------------------ */
/* Passe de Batalha - aba própria (contrato V2)                        */
/* ------------------------------------------------------------------ */

/** Uma linha de missão (diária ou semanal): check, texto, progresso e o XP -
 * `paga` decide se o XP aparece ou fica esmaecido (o servidor já calculou
 * quais das N contam; o cliente só desenha o veredito). */
export function renderObjetivoHtml(objetivo, xpPorObjetivo) {
	const alvo = Math.max(1, Number(objetivo.alvo) || 1);
	const progresso = Math.max(0, Math.min(alvo, Number(objetivo.progresso) || 0));
	const concluido = !!objetivo.concluido;
	const paga = objetivo.paga !== false;
	const pct = Math.round((progresso / alvo) * 100);
	const marca = concluido
		? `<span class="te-objetivo-marca is-concluido">${glifo('confere')}</span>`
		: '<span class="te-objetivo-marca"></span>';
	const xpTag = Number.isFinite(Number(xpPorObjetivo))
		? `<span class="te-objetivo-xp${paga ? '' : ' is-sem-xp'}">${paga ? '+' : ''}${escapeHtml(xpPorObjetivo)} XP${paga ? '' : ' · não conta'}</span>`
		: '';
	return (
		`<li class="te-objetivo${concluido ? ' is-concluido' : ''}${paga ? '' : ' is-sem-xp'}">` +
		marca +
		'<span class="te-objetivo-texto">' +
		`<span class="te-objetivo-titulo">${escapeHtml(objetivo.texto)}</span>` +
		(concluido
			? ''
			: `<span class="te-objetivo-progresso"><span class="ri-bar te-objetivo-barra"><span class="fill" style="width:${pct}%"></span></span><span class="te-objetivo-numero">${escapeHtml(progresso)} / ${escapeHtml(alvo)}</span></span>`) +
		'</span>' +
		xpTag +
		'</li>'
	);
}

/** A nota "vale X de Y" + "N concluídas" - compartilhada pelas diárias e
 * semanais. `concluidas` já vem CONTADA pelo servidor (só as que pagam, no
 * máximo `queContam` - emenda 1); o cliente nunca refaz essa soma sozinho a
 * partir de `objetivo.concluido`. */
function notaDeMissoesHtml(bloco, total) {
	const queContam = Number(bloco.queContam);
	const concluidas = Number(bloco.concluidas);
	const partes = [];
	if (Number.isFinite(queContam) && queContam > 0 && queContam < total) {
		partes.push(`Vale ${escapeHtml(queContam)} de ${total}: as demais não somam XP extra.`);
	}
	if (Number.isFinite(concluidas) && Number.isFinite(queContam)) {
		partes.push(`${escapeHtml(concluidas)} de ${escapeHtml(queContam)} concluídas.`);
	}
	return partes.join(' ');
}

/** O bloco de missões diárias: os objetivos, quantos pagam XP e o teto do dia. */
export function renderMissoesDiariasHtml(diarias) {
	const d = diarias || {};
	const objetivos = d.objetivos || [];
	const nota = notaDeMissoesHtml(d, objetivos.length);
	return (
		'<section class="te-secao te-missoes">' +
		'<header class="te-secao-cab">' +
		`<h3 class="te-secao-titulo">${glifo('confere')}<span>Missões diárias</span></h3>` +
		`<span class="te-missoes-xp">${escapeHtml(d.xpHoje)} / ${escapeHtml(d.tetoDeXp)} XP hoje</span>` +
		'</header>' +
		(nota ? `<p class="te-nota">${escapeHtml(nota)}</p>` : '') +
		`<ul class="te-objetivos">${objetivos.map(o => renderObjetivoHtml(o, d.xpPorObjetivo)).join('')}</ul>` +
		'</section>'
	);
}

/**
 * O bloco de missões semanais: mesma forma das diárias, mais o bloco atual
 * (1..4 - a rotação semanal do servidor) com o ícone de calendário.
 *
 * `semanais` PODE VIR `null` (emenda 1: temporada ainda sem data de início) -
 * a secao inteira some da tela nesse caso, sem erro e sem "undefined" em
 * lugar nenhum - nunca inventa um bloco vazio para preencher o espaço.
 */
export function renderMissoesSemanaisHtml(semanais) {
	if (!semanais) {
		return '';
	}
	const objetivos = semanais.objetivos || [];
	const nota = notaDeMissoesHtml(semanais, objetivos.length);
	return (
		'<section class="te-secao te-missoes">' +
		'<header class="te-secao-cab">' +
		'<h3 class="te-secao-titulo">' +
		'<img class="te-secao-titulo-icone" src="/ragidle/temporada/icone-missoes-semanais.webp" alt="" width="16" height="16">' +
		'<span>Missões semanais</span>' +
		'</h3>' +
		`<span class="te-missoes-xp">${escapeHtml(semanais.xpNoBloco)} / ${escapeHtml(semanais.tetoDeXp)} XP no bloco</span>` +
		'</header>' +
		(nota ? `<p class="te-nota">${escapeHtml(nota)}</p>` : '') +
		`<ul class="te-objetivos">${objetivos.map(o => renderObjetivoHtml(o, semanais.xpPorObjetivo)).join('')}</ul>` +
		'</section>'
	);
}

/**
 * Os PRÊMIOS agrupados por nível, cada um com as duas trilhas (free/vip) -
 * ordenados por nível e, dentro do nível, free antes de vip (mesma ordem do
 * V1, só o rótulo da segunda trilha mudou).
 */
export function niveisDoPasse(passe) {
	const porNivel = new Map();
	((passe && passe.premios) || []).forEach(p => {
		const nivel = Number(p.nivel);
		if (!porNivel.has(nivel)) {
			porNivel.set(nivel, { free: null, vip: null });
		}
		const par = porNivel.get(nivel);
		if (p.trilha === 'vip') {
			par.vip = p;
		} else {
			par.free = p;
		}
	});
	return [...porNivel.keys()].sort((a, b) => a - b).map(nivel => ({ nivel, ...porNivel.get(nivel) }));
}

/** Um card de prêmio da trilha de recompensas (free ou vip). */
export function renderPremioDaTrilhaHtml(premio, trilha) {
	if (!premio) {
		return `<div class="te-premio-card te-premio-card--vazio te-premio-card--${trilha}" aria-hidden="true"></div>`;
	}
	const situacao = premio.situacao;
	const quantidade =
		Number(premio.quantidade) > 1
			? `<span class="te-premio-card-qtd">×${escapeHtml(premio.quantidade)}</span>`
			: '';
	const estado =
		situacao === 'CLAIMED'
			? `<span class="te-premio-card-estado is-resgatado">${glifo('confere')}</span>`
			: situacao === 'AVAILABLE'
				? `<button type="button" class="ri-btn ri-btn--ouro te-premio-card-resgatar" data-agir="resgatar" data-nivel="${escapeHtml(premio.nivel)}" data-trilha="${escapeHtml(trilha)}">Resgatar</button>`
				: `<span class="te-premio-card-estado is-bloqueado">${glifo('cadeado')}</span>`;
	return (
		`<div class="te-premio-card te-premio-card--${trilha} ${classeDoNivel(situacao)}" data-nivel="${escapeHtml(premio.nivel)}" data-trilha="${escapeHtml(trilha)}">` +
		iconeFallbackHtml(premio.itemId, premio.nome) +
		quantidade +
		`<div class="te-premio-card-nome" title="${escapeHtml(premio.nome)}">${escapeHtml(premio.nome)}</div>` +
		estado +
		'</div>'
	);
}

/**
 * A TRILHA DE RECOMPENSAS: duas fileiras que rolam JUNTAS na horizontal -
 * FREE em cima (azul/prata), VIP embaixo (creme/dourado) - o mesmo nível
 * sempre alinhado na mesma coluna (documento §19-20: "lado a lado", "a
 * diferença deve ser percebida instantaneamente"). A trilha VIP fica
 * esmaecida quando o jogador não tem VIP nesta temporada (`passe.vip`) -
 * ainda visível (ele vê o que está perdendo), só sem convidar o clique.
 */
export function renderTrilhaDeRecompensasHtml(passe) {
	const niveis = niveisDoPasse(passe);
	const semVip = !passe.vip;
	const colunas = niveis
		.map(
			n =>
				`<div class="te-trilha-coluna" data-nivel="${n.nivel}">` +
				`<span class="te-trilha-nivel">${n.nivel}</span>` +
				renderPremioDaTrilhaHtml(n.free, 'free') +
				renderPremioDaTrilhaHtml(n.vip, 'vip') +
				'</div>'
		)
		.join('');
	return (
		'<section class="te-secao te-reward-track">' +
		'<header class="te-secao-cab">' +
		`<h3 class="te-secao-titulo">${glifo('pacote')}<span>Recompensas por nível</span></h3>` +
		'<div class="te-reward-legenda">' +
		'<span class="te-reward-legenda-item te-reward-legenda-item--free">Free</span>' +
		`<span class="te-reward-legenda-item te-reward-legenda-item--vip${semVip ? ' is-bloqueada' : ''}">VIP</span>` +
		'</div>' +
		'</header>' +
		`<div class="te-reward-scroll ri-scroll${semVip ? ' is-sem-vip' : ''}">${colunas}</div>` +
		'</section>'
	);
}

/**
 * A ABA PASSE DE BATALHA inteira (documento §19-21, contrato V2): nível/XP
 * no topo com o emblema da temporada, missões diárias e semanais, e a
 * trilha de recompensas. O mascote entra numa faixa própria, sem cobrir
 * nenhuma informação (documento §19: "Não colocar o Poring cobrindo
 * informações importantes").
 */
export function renderPasseDeBatalhaHtml(passe) {
	const niveis = Math.max(1, Number(passe.niveis) || 1);
	const nivel = Math.max(0, Number(passe.nivel) || 0);
	const xpPorNivel = Math.max(1, Number(passe.xpPorNivel) || 1);
	const xpNoNivel = Math.max(0, Number(passe.xpNoNivel) || 0);
	const noTeto = nivel >= niveis;
	const pctBarra = noTeto ? 100 : Math.min(100, Math.max(0, Math.round((xpNoNivel / xpPorNivel) * 100)));
	const rotuloBarra = noTeto ? 'Nível máximo alcançado' : `${xpNoNivel} / ${xpPorNivel} XP para o nível ${nivel + 1}`;
	/* Mesma regra da nota acima (emenda 1): `null` e "a temporada nao tem
	   data de fim ainda", nunca "zero dias". */
	const notaDias =
		passe.diasRestantes != null
			? `${escapeHtml(passe.diasRestantes)} ${plural(passe.diasRestantes, 'dia restante', 'dias restantes')}`
			: '';

	return (
		'<section class="te-passe-batalha">' +
		'<div class="te-passe-batalha-topo ri-card">' +
		'<img class="te-passe-batalha-emblema" src="/ragidle/temporada/emblema-temporada.webp" alt="" width="72" height="72">' +
		'<div class="te-passe-batalha-topo-info">' +
		'<h2 class="te-passe-batalha-titulo">Passe de Batalha</h2>' +
		`<span class="te-passe-nivel">Nível <strong>${nivel}</strong><span class="te-passe-de"> / ${niveis}</span></span>` +
		renderBarraDeNivelHtml(pctBarra, rotuloBarra) +
		(notaDias ? `<span class="te-passe-batalha-dias">${notaDias} de temporada</span>` : '') +
		'</div>' +
		'<img class="te-passe-batalha-mascote" src="/ragidle/temporada/mascote-passe.webp" alt="" width="88" height="88">' +
		'</div>' +
		'<div class="te-ornamento-divisor" aria-hidden="true"></div>' +
		renderMissoesDiariasHtml(passe.diarias) +
		renderMissoesSemanaisHtml(passe.semanais) +
		renderTrilhaDeRecompensasHtml(passe) +
		'</section>'
	);
}

/**
 * A aba VIP - UMA aba para o que eram duas (a da Temporada e a das
 * Recompensas): a vitrine com o preco em cash e a vigencia, os beneficios que
 * o servidor da temporada lista, o visual exclusivo (Astra Blessing) e o
 * botao de comprar/renovar.
 *
 * O VISUAL EXCLUSIVO DO VIP, e ele FALTAVA: a prova de tela de 21/09/2026
 * abriu a aba VIP com o VIP ATIVO e mostrou o beneficio como uma LINHA de
 * lista, sem botao - enquanto o servidor ja tratava `resgatar-visual-vip`
 * desde o primeiro commit. Quem decide se pode e o SERVIDOR
 * (`vip.visual.pode`/`.texto`): esta funcao nao olha `vip.ativo` para liberar
 * o botao, do mesmo jeito que o card da caixa nao olha saldo.
 */
export function renderVipHtml(vip, estadoDoPasse) {
	const passeVip = passePorTipo(estadoDoPasse, 'vip');
	const cash = (estadoDoPasse && estadoDoPasse.cash) || 0;
	const dias = passeVip ? passeVip.dias : vip.dias;
	const resumo = `${escapeHtml(dias)} dias de vantagem em tudo o que você caça.`;
	const referencia = Number.isFinite(Number(vip.precoReferenciaCentavos))
		? `Equivale a ${formatarPrecoCentavos(vip.precoReferenciaCentavos)} por ${vip.dias} dias`
		: '';

	const beneficios = (vip.beneficios || [])
		.map(b => {
			/* "+15% de EXP de base" -> o numero em destaque e o resto como texto;
			   sem numero ("Selo VIP") entra o glifo de confere, ou o relogio para
			   o que ainda esta "em breve". */
			const m = String(b.texto || '').match(/^(\+?\d+%?)\s+(.*)$/);
			const cabeca = m
				? `<strong class="te-beneficio-valor">${escapeHtml(m[1])}</strong>`
				: `<span class="te-beneficio-glifo">${glifo(b.ativo ? 'confere' : 'relogio')}</span>`;
			const texto = m ? m[2] : b.texto;
			return `<li class="te-beneficio${b.ativo ? '' : ' is-em-breve'}">${cabeca}<span class="te-beneficio-texto">${escapeHtml(texto)}</span></li>`;
		})
		.join('');

	const visual = vip.visual;
	/* O ASTRA BLESSING usa o icone dedicado (identificado visualmente pelo
	   Team Lead - ver MAPA-DOS-ASSETS.md), nunca o fallback de inicial: e a
	   UNICA recompensa da janela com arte propria em vez de sprite de item.
	   O ESTADO (disponivel/resgatado/bloqueado - documento §23) e uma classe
	   por cima do mesmo icone, nunca um segundo asset. */
	const estadoDoVisual = !visual
		? ''
		: visual.resgatado
			? 'is-resgatado'
			: visual.pode
				? 'is-disponivel'
				: 'is-bloqueado';
	const cardDoVisual = !visual
		? ''
		: `<div class="te-vip-visual ri-card ${estadoDoVisual}">` +
			`<span class="te-vip-visual-icone"><img src="/ragidle/temporada/icone-astra-blessing.webp" alt="" width="44" height="44">` +
			(visual.resgatado ? `<span class="te-vip-visual-selo is-resgatado">${glifo('confere')}</span>` : '') +
			(!visual.resgatado && !visual.pode
				? `<span class="te-vip-visual-selo is-bloqueado">${glifo('cadeado')}</span>`
				: '') +
			'</span>' +
			'<div class="te-vip-visual-texto">' +
			`<div class="te-vip-visual-nome">${escapeHtml(visual.nome)}</div>` +
			`<div class="te-vip-visual-dica">${escapeHtml(visual.texto || 'Exclusivo de quem tem VIP nesta temporada.')}</div>` +
			'</div>' +
			`<button type="button" class="ri-btn ri-btn--ouro te-vip-resgatar" data-agir="resgatar-visual-vip"${visual.pode ? '' : ' disabled'}>` +
			`${visual.resgatado ? 'Resgatado' : 'Resgatar'}</button>` +
			'</div>';

	return (
		'<section class="te-vip">' +
		'<img class="te-vip-emblema" src="/ragidle/temporada/vip-emblema.webp" alt="" width="120" height="120">' +
		renderVitrineHtml(passeVip, 'VIP', resumo, referencia) +
		'<div class="te-secao">' +
		`<h3 class="te-secao-titulo">${glifo('estrela')}<span>O que o VIP dá</span></h3>` +
		`<ul class="te-beneficios">${beneficios}</ul>` +
		'</div>' +
		cardDoVisual +
		(estadoDoPasse ? renderAcaoDoPasseHtml(passeVip, cash) : '<div class="te-carregando">Carregando…</div>') +
		'</section>'
	);
}

/** O selo do cabeçalho: "VIP · N dias" ou "Sem VIP". */
export function textoDoSeloVip(vip) {
	if (!vip || !vip.ativo) {
		return 'Sem VIP';
	}
	return `VIP · ${escapeHtml(vip.diasRestantes)} ${plural(vip.diasRestantes, 'dia', 'dias')}`;
}

/* ------------------------------------------------------------------ */
/* O reveal da abertura                                                */
/* ------------------------------------------------------------------ */

/**
 * O overlay de reveal de uma abertura (`resultado.abertura`).
 *
 * A LINHA DO DESTINO E A FRASE DO SERVIDOR (22/09/2026, decisao do dono: a
 * caixa entrega o visual DIRETO NA MOCHILA, e o correio vira so a excecao de
 * quando nao cabe). Esta funcao dizia "Enviado ao seu correio." por conta
 * propria - uma segunda copia da regra, que mentiria no dia em que o destino
 * mudasse, que e hoje. Quem sabe para onde o visual foi e o servidor, e ele
 * ja escreve isso em `resultado.texto`; a reserva so entra se a frase vier
 * vazia, e diz o destino NOVO.
 */
export function renderRevealHtml(resultado) {
	const abertura = resultado && resultado.abertura;
	if (!abertura) {
		return '';
	}
	const raridadeClasse = classeDaRaridade(abertura.raridade);
	const destino = String(resultado.texto || '').trim() || `${abertura.nome} foi para a sua mochila.`;
	const linhaDestino = `<div class="te-reveal-destino">${escapeHtml(destino)}</div>`;
	return (
		`<div class="te-reveal-caixa ${raridadeClasse}${abertura.repetida ? ' te-reveal--repetida' : ''}">` +
		`<div class="te-reveal-brilho" aria-hidden="true">${glifo('brilhos')}</div>` +
		iconeFallbackHtml(abertura.itemId, abertura.nome) +
		`<div class="te-reveal-nome">${escapeHtml(abertura.nome)}</div>` +
		`<div class="te-reveal-raridade te-raridade ${raridadeClasse}">${escapeHtml(rotuloDaRaridade(abertura))}</div>` +
		(abertura.foiGarantia ? '<div class="te-reveal-garantia">Garantia da Proteção Lendária</div>' : '') +
		linhaDestino +
		'<button type="button" class="te-reveal-fechar ri-btn ri-btn--sec">Fechar</button>' +
		'</div>'
	);
}
