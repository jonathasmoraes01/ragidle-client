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
 */

import RiIcones from 'UI/ri-icones.js';

/** Mesmo escape de PasseIdle.js/PainelComandoIdle.js — sem depender de DOM. */
export function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
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

/**
 * `chance`/`escala` (ex.: 3250/10000) -> "32,5%", em pt-BR e sem zero à toa.
 *
 * `escala` é sempre `ESCALA_DA_CHANCE` do servidor (10000 hoje), mas a conta
 * usa o valor que chegou — nunca uma constante local, porque essa constante
 * pertence ao servidor (o mesmo motivo do resto deste módulo).
 */
export function formatarPorcentagem(chance, escala) {
	const pct = (Number(chance) / Number(escala)) * 100;
	if (!Number.isFinite(pct)) {
		return '0%';
	}
	const arredondado = Math.round(pct * 100) / 100;
	const comDuasCasas = arredondado.toFixed(2);
	const semZeroATOA = comDuasCasas.replace(/0+$/, '').replace(/\.$/, '');
	const texto = semZeroATOA === '' ? '0' : semZeroATOA;
	return texto.replace('.', ',') + '%';
}

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
		typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
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

/** `n` + singular/plural, sem inventar concordancia fora daqui. */
function plural(n, singular, pluralTexto) {
	return Number(n) === 1 ? singular : pluralTexto;
}

/* ------------------------------------------------------------------ */
/* Destaques: banner, passe compacto, caixas em resumo, atalhos        */
/* ------------------------------------------------------------------ */

/** O banner da Season: o nome e o subtitulo vem do servidor (`temporada`). */
export function renderBannerHtml(temporada) {
	const t = temporada || {};
	const nome = t.nome || 'Luz & Trevas';
	const subtitulo = t.subtitulo || 'Herdeiros de Midgard';
	const numero = String(t.id || '').match(/\d+/);
	const season = numero ? `Season ${numero[0]}` : 'Season 1';
	const encerrada = t.aberta === false;
	const prazo = encerrada ? 'Temporada encerrada' : t.fimMs ? `Aberta até ${dataCurtaDeMs(t.fimMs)}` : '';
	return (
		`<div class="te-banner${encerrada ? ' is-encerrada' : ''}">` +
		'<div class="te-banner-luz" aria-hidden="true"></div>' +
		'<div class="te-banner-trevas" aria-hidden="true"></div>' +
		`<div class="te-banner-eclipse" aria-hidden="true">${glifo('temporada')}</div>` +
		'<div class="te-banner-texto">' +
		`<span class="te-banner-linha te-banner-linha--season">${escapeHtml(season)}</span>` +
		`<span class="te-banner-linha te-banner-linha--tema">${escapeHtml(nome)}</span>` +
		`<span class="te-banner-linha te-banner-linha--sub">${escapeHtml(subtitulo)}</span>` +
		'</div>' +
		(prazo ? `<span class="te-banner-prazo">${escapeHtml(prazo)}</span>` : '') +
		'</div>'
	);
}

/**
 * Os marcos do passe, na ordem em que o jogador os alcanca: por nivel, e no
 * mesmo nivel o free antes do premium (o 50 tem os dois).
 */
export function marcosDoPasse(passe) {
	return [...((passe && passe.premios) || [])].sort((a, b) => {
		const dn = Number(a.nivel) - Number(b.nivel);
		if (dn !== 0) {
			return dn;
		}
		return a.trilha === 'free' ? -1 : 1;
	});
}

/** Um marco da trilha compacta: nivel, trilha, icone, nome e o estado/botao. */
export function renderMarcoHtml(premio, passe) {
	const nivel = Number(premio.nivel);
	const trilha = premio.trilha === 'premium' ? 'premium' : 'free';
	const situacao = premio.situacao;
	const alcancado = nivel <= Number(passe.nivel);
	const semPremium = trilha === 'premium' && !passe.premium;

	let rodape;
	if (situacao === 'AVAILABLE') {
		rodape =
			`<button type="button" class="ri-btn ri-btn--ouro te-marco-resgatar" data-agir="resgatar" data-nivel="${nivel}" data-trilha="${trilha}">` +
			'Resgatar</button>';
	} else if (situacao === 'CLAIMED') {
		rodape = `<span class="te-marco-estado is-resgatado">${glifo('confere')}<span>Resgatado</span></span>`;
	} else {
		/* Por que esta trancado: ou o nivel nao chegou, ou chegou e falta o
		   Premium - o jogador precisa saber qual dos dois para agir. */
		const motivo = alcancado && semPremium ? 'Premium' : `Nível ${nivel}`;
		rodape = `<span class="te-marco-estado is-bloqueado">${glifo('cadeado')}<span>${escapeHtml(motivo)}</span></span>`;
	}

	return (
		`<div class="te-marco te-marco--${trilha} ${classeDoNivel(situacao)}${alcancado ? ' is-alcancado' : ''}" data-nivel="${nivel}" data-trilha="${trilha}" data-situacao="${escapeHtml(situacao)}">` +
		'<div class="te-marco-topo">' +
		`<span class="te-marco-nivel">${nivel}</span>` +
		`<span class="te-marco-trilha">${trilha === 'premium' ? 'Premium' : 'Free'}</span>` +
		'</div>' +
		iconeFallbackHtml(premio.itemId, premio.nome) +
		`<div class="te-marco-nome" title="${escapeHtml(premio.nome)}">${escapeHtml(premio.nome)}</div>` +
		rodape +
		'</div>'
	);
}

/** O bloco do Premium: selo se ja tem, botao se esta a venda, aviso se nao. */
export function renderPremiumHtml(passe) {
	if (passe.premium) {
		return `<span class="ri-badge ri-badge--ouro te-premium-selo">${glifo('estrela')}<span>Premium ativo</span></span>`;
	}
	const compra = passe.compraPremium || { pode: false, texto: null };
	const nota = compra.texto ? `<span class="te-nota">${escapeHtml(compra.texto)}</span>` : '';
	if (passe.precoPremium === null) {
		return `<span class="ri-badge ri-badge--cinza te-premium-selo">${glifo('relogio')}<span>Premium em breve</span></span>${nota}`;
	}
	return (
		`<button type="button" class="ri-btn ri-btn--ouro te-premium-comprar" data-agir="comprar-premium"${compra.pode ? '' : ' disabled'}>` +
		`${glifo('estrela')}<span>Comprar Premium · ${escapeHtml(passe.precoPremium)} RO Cash</span></button>` +
		nota
	);
}

/**
 * A PROGRESSAO COMPACTA do passe - o pedido 1 do dono ("pegar aquela
 * progressao, diminuir um pouquinho e encaixar na pagina de destaque").
 * Barra de pontos do nivel, a fileira dos marcos com premio e o Premium.
 */
export function renderPasseCompactoHtml(passe) {
	const niveis = Math.max(1, Number(passe.niveis) || 1);
	const nivel = Math.max(0, Number(passe.nivel) || 0);
	const pontosPorNivel = Math.max(1, Number(passe.pontosPorNivel) || 1);
	const pontosNoNivel = Math.max(0, Number(passe.pontosNoNivel) || 0);
	const noTeto = nivel >= niveis;
	const pctBarra = noTeto ? 100 : Math.min(100, Math.max(0, Math.round((pontosNoNivel / pontosPorNivel) * 100)));
	const rotuloBarra = noTeto ? 'Nível máximo alcançado' : `${pontosNoNivel} / ${pontosPorNivel} pontos para o nível ${nivel + 1}`;
	const pontosPorAbate = Number(passe.pontosPorAbate);
	const porAbate = Number.isFinite(pontosPorAbate) && pontosPorAbate > 0 ? `${pontosPorAbate} ${plural(pontosPorAbate, 'ponto', 'pontos')} por abate` : '';

	return (
		'<section class="te-secao te-passe">' +
		'<header class="te-secao-cab">' +
		`<h3 class="te-secao-titulo">${glifo('estrela')}<span>Passe da Temporada</span></h3>` +
		`<span class="te-passe-nivel">Nível <strong>${nivel}</strong><span class="te-passe-de"> / ${niveis}</span></span>` +
		'</header>' +
		`<div class="ri-bar te-passe-barra"><div class="fill" style="width:${pctBarra}%"></div><span class="rotulo">${escapeHtml(rotuloBarra)}</span></div>` +
		'<div class="te-passe-meta">' +
		`<span>Hoje: <strong>${escapeHtml(passe.pontosHoje)}</strong> / ${escapeHtml(passe.tetoDiario)} pontos</span>` +
		(porAbate ? `<span>${escapeHtml(porAbate)}</span>` : '') +
		'</div>' +
		`<div class="te-marcos">${marcosDoPasse(passe)
			.map((p) => renderMarcoHtml(p, passe))
			.join('')}</div>` +
		`<div class="te-passe-premium">${renderPremiumHtml(passe)}</div>` +
		'</section>'
	);
}

/** As caixas em resumo (Destaques): glifo do slot, nome, fechadas e o lendario. */
export function renderResumoDasCaixasHtml(caixas) {
	const cards = (caixas || [])
		.map((c) => {
			const fechadas = Number(c.fechadas) || 0;
			const lendaria = (c.recompensas || []).find((r) => String(r.raridade || '').toUpperCase() === 'LEGENDARY');
			const sub = `${fechadas} ${plural(fechadas, 'fechada', 'fechadas')}` + (lendaria ? ` · ${lendaria.nome}` : '');
			return (
				`<button type="button" class="te-resumo-caixa ri-card${fechadas > 0 ? ' is-tem' : ''}" data-ir="caixas" data-pool="${escapeHtml(c.pool)}">` +
				`<span class="te-resumo-caixa-glifo ri-tile">${glifoDoSlot(c.slot)}</span>` +
				'<span class="te-resumo-caixa-texto">' +
				`<span class="te-resumo-caixa-nome">${escapeHtml(c.nome)}</span>` +
				`<span class="te-resumo-caixa-sub">${escapeHtml(sub)}</span>` +
				'</span>' +
				(fechadas > 0 ? `<span class="te-resumo-caixa-contagem">${fechadas}</span>` : `<span class="te-resumo-caixa-seta">${glifo('chevronDir')}</span>`) +
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
	return lista.find((p) => p && p.tipo === tipo) || null;
}

/** Os dois atalhos do rodape dos Destaques: Passe Semanal e VIP, com o estado. */
export function renderAtalhosHtml(vip, estadoDoPasse) {
	const semanal = passePorTipo(estadoDoPasse, 'semanal');
	const semanalTexto = !estadoDoPasse
		? 'Carregando…'
		: semanal && semanal.ativo
			? `Ativo · dia ${escapeHtml(semanal.diaDoCiclo)} de ${escapeHtml(semanal.dias)}`
			: 'Cashback e itens por 7 dias';
	const vipTexto =
		vip && vip.ativo ? `Ativo · ${escapeHtml(vip.diasRestantes)} ${plural(vip.diasRestantes, 'dia', 'dias')}` : 'EXP, drop e visual exclusivo';
	return (
		'<div class="te-atalhos">' +
		`<button type="button" class="te-atalho ri-card${semanal && semanal.ativo ? ' is-ativo' : ''}" data-ir="semanal">` +
		`<span class="te-atalho-glifo ri-disc">${glifo('relogio')}</span>` +
		'<span class="te-atalho-texto">' +
		'<span class="te-atalho-nome">Passe Semanal</span>' +
		`<span class="te-atalho-sub">${semanalTexto}</span>` +
		'</span>' +
		`<span class="te-atalho-seta">${glifo('chevronDir')}</span>` +
		'</button>' +
		`<button type="button" class="te-atalho te-atalho--vip ri-card${vip && vip.ativo ? ' is-ativo' : ''}" data-ir="vip">` +
		`<span class="te-atalho-glifo ri-disc">${glifo('estrela')}</span>` +
		'<span class="te-atalho-texto">' +
		'<span class="te-atalho-nome">VIP</span>' +
		`<span class="te-atalho-sub">${vipTexto}</span>` +
		'</span>' +
		`<span class="te-atalho-seta">${glifo('chevronDir')}</span>` +
		'</button>' +
		'</div>'
	);
}

/** A aba Destaques inteira: banner, passe compacto, caixas em resumo, atalhos. */
export function renderDestaquesHtml(estado, estadoDoPasse) {
	return (
		renderBannerHtml(estado.temporada) +
		renderPasseCompactoHtml(estado.passe) +
		renderResumoDasCaixasHtml(estado.caixas) +
		renderAtalhosHtml(estado.vip, estadoDoPasse || null)
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
			(r) =>
				`<span class="te-previa-item ${classeDaRaridade(r.raridade)}" title="${escapeHtml(r.nome)} · ${escapeHtml(rotuloDaRaridade(r))} · ${formatarPorcentagem(r.chance, r.escala)}">` +
				iconeFallbackHtml(r.itemId, r.nome) +
				'</span>'
		)
		.join('');

	const fechadas = Number(caixa.fechadas) || 0;
	const comprarDesabilitado = !caixa.compra.pode;
	const abrirDesabilitado = !(fechadas > 0);

	return (
		`<article class="te-caixa ri-card" data-pool="${escapeHtml(caixa.pool)}">` +
		'<header class="te-caixa-cab">' +
		`<span class="te-caixa-glifo ri-tile">${glifoDoSlot(caixa.slot)}</span>` +
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

/** O conteúdo do modal "Ver conteúdo": as 6 recompensas, odds NUNCA escondidas. */
export function renderModalConteudoHtml(caixa) {
	const linhas = (caixa.recompensas || [])
		.map(
			(r) =>
				'<div class="te-premio-linha">' +
				`<div class="te-premio-icone">${iconeFallbackHtml(r.itemId, r.nome)}</div>` +
				'<div class="te-premio-info">' +
				`<div class="te-premio-nome">${escapeHtml(r.nome)}</div>` +
				'<div class="te-premio-meta">' +
				`<span class="te-raridade ${classeDaRaridade(r.raridade)}">${escapeHtml(rotuloDaRaridade(r))}</span>` +
				`<span class="te-premio-slot">${escapeHtml(r.slot)}</span>` +
				(r.animado ? '<span class="te-premio-animado">Animado</span>' : '') +
				'</div>' +
				'</div>' +
				`<div class="te-premio-chance">${formatarPorcentagem(r.chance, r.escala)}</div>` +
				'</div>'
		)
		.join('');
	return (
		'<div class="te-modal-titulo-caixa">' +
		`<span class="te-modal-titulo-glifo ri-tile">${glifoDoSlot(caixa.slot)}</span>` +
		`<span>${escapeHtml(caixa.nome)}</span>` +
		'</div>' +
		`<div class="te-premios">${linhas}</div>`
	);
}

/* ------------------------------------------------------------------ */
/* Passe Semanal e VIP - o que veio da janela de Recompensas           */
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

/** A aba Passe Semanal: vitrine, a trilha dos sete dias e o botão. */
export function renderSemanalHtml(estadoDoPasse) {
	if (!estadoDoPasse) {
		return '<div class="te-carregando">Carregando…</div>';
	}
	const passe = passePorTipo(estadoDoPasse, 'semanal');
	const semanal = estadoDoPasse.semanal || { dias: [], cashbackTotal: 0 };
	const cash = estadoDoPasse.cash || 0;

	/*
	 * A PORCENTAGEM E DERIVADA, e nao escrita a mao (a nota veio de PasseIdle):
	 * o dono ja disse que o preco pode mudar, e um "20%" cravado viraria mentira
	 * no dia em que o preco ou a tabela mudassem. O servidor manda
	 * `cashbackTotal` e o preco; a conta sai dos dois.
	 */
	const pct = passe && passe.cash > 0 ? Math.round((Number(semanal.cashbackTotal) / Number(passe.cash)) * 100) : 0;
	const resumo = passe ? `${passe.dias} dias · ${pct}% de cashback no final` : '';
	const total = (semanal.dias || []).length;

	const dias = (semanal.dias || [])
		.map((d) => {
			const entregue = !!(passe && passe.ativo && d.dia <= passe.entregues);
			const hoje = !!(passe && passe.ativo && d.dia === passe.diaDoCiclo && !entregue);
			const premio = d.dia === total;
			const classes = ['te-dia', entregue ? 'is-entregue' : '', hoje ? 'is-hoje' : '', premio ? 'is-premio' : ''].filter(Boolean).join(' ');
			const itens = (d.itens || []).map((i) => `${escapeHtml(i.quantidade)}× ${escapeHtml(i.nome)}`).join('<br>');
			return (
				`<div class="${classes}">` +
				`<span class="te-dia-num">Dia ${escapeHtml(d.dia)}</span>` +
				`<span class="te-dia-cash">+${escapeHtml(d.cash)} cash</span>` +
				`<span class="te-dia-item">${itens}</span>` +
				(entregue ? `<span class="te-dia-check">${glifo('confere')}</span>` : '') +
				'</div>'
			);
		})
		.join('');

	return (
		'<section class="te-semanal">' +
		renderVitrineHtml(passe, 'Passe Semanal', resumo, '') +
		'<div class="te-secao">' +
		`<h3 class="te-secao-titulo">${glifo('relogio')}<span>O que chega, dia a dia</span></h3>` +
		`<div class="te-trilha">${dias}</div>` +
		'</div>' +
		renderAcaoDoPasseHtml(passe, cash) +
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
		.map((b) => {
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
	const cardDoVisual = !visual
		? ''
		: '<div class="te-vip-visual ri-card">' +
			iconeFallbackHtml(visual.itemId, visual.nome) +
			'<div class="te-vip-visual-texto">' +
			`<div class="te-vip-visual-nome">${escapeHtml(visual.nome)}</div>` +
			`<div class="te-vip-visual-dica">${escapeHtml(visual.texto || 'Exclusivo de quem tem VIP nesta temporada.')}</div>` +
			'</div>' +
			`<button type="button" class="ri-btn ri-btn--ouro te-vip-resgatar" data-agir="resgatar-visual-vip"${visual.pode ? '' : ' disabled'}>` +
			`${visual.resgatado ? 'Resgatado' : 'Resgatar'}</button>` +
			'</div>';

	return (
		'<section class="te-vip">' +
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
