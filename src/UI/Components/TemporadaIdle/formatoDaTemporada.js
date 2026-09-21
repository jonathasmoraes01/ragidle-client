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
 */

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
 * ícone real (DB.getItemInfo + Client.loadFile, feito por quem monta a
 * janela) não puder ser carregado ou nem for tentado (teste, arnês de foto). */
export function iconeFallbackHtml(itemId, texto) {
	const base = String(texto || '').trim();
	const inicial = base ? base.charAt(0).toUpperCase() : '?';
	const idNumero = Number(itemId);
	const idAttr = Number.isFinite(idNumero) && idNumero > 0 ? ` data-item-id="${idNumero}"` : '';
	return `<span class="te-icone ri-tile"${idAttr}><span class="te-icone-fallback">${escapeHtml(inicial)}</span></span>`;
}

/** Um card completo de caixa (Caixas Topo/Meio/Baixo/Manto). */
export function renderCaixaHtml(caixa) {
	const precoHtml =
		caixa.preco === null
			? '<span class="te-caixa-preco te-caixa-preco--indefinido">Preço a definir</span>'
			: `<span class="te-caixa-preco"><strong>${escapeHtml(caixa.preco)}</strong> RO Cash</span>`;

	const garantia = Math.max(1, Number(caixa.pity.garantia) || 1);
	const pctPity = Math.min(100, Math.max(0, Math.round((Number(caixa.pity.contador) / garantia) * 100)));

	const notaPity = caixa.pity.garantidoNaProxima
		? '<div class="te-pity-garantido">LENDÁRIO GARANTIDO NA PRÓXIMA</div>'
		: caixa.pity.faltam <= 10
			? `<div class="te-pity-faltam">Faltam ${escapeHtml(caixa.pity.faltam)} abertura${caixa.pity.faltam === 1 ? '' : 's'} para a garantia</div>`
			: '';

	const comprarDesabilitado = !caixa.compra.pode;
	const abrirDesabilitado = !(Number(caixa.fechadas) > 0);

	return (
		`<div class="te-caixa ri-card" data-pool="${escapeHtml(caixa.pool)}">` +
		'<div class="te-caixa-cabecalho">' +
		`<div class="te-caixa-icone">${iconeFallbackHtml(null, caixa.slot)}</div>` +
		'<div class="te-caixa-info">' +
		`<div class="te-caixa-nome">${escapeHtml(caixa.nome)}</div>` +
		`<div class="te-caixa-slot">${escapeHtml(caixa.slot)}</div>` +
		'</div>' +
		precoHtml +
		'</div>' +
		`<div class="te-caixa-fechadas">Fechadas: <strong>${escapeHtml(caixa.fechadas)}</strong></div>` +
		'<div class="te-pity">' +
		`<div class="te-pity-rotulo">Proteção Lendária ${escapeHtml(caixa.pity.contador)} / ${escapeHtml(caixa.pity.garantia)}</div>` +
		`<div class="ri-bar te-pity-barra"><div class="fill" style="width:${pctPity}%"></div></div>` +
		notaPity +
		'</div>' +
		(caixa.compra.texto ? `<div class="te-caixa-nota">${escapeHtml(caixa.compra.texto)}</div>` : '') +
		'<div class="te-caixa-acoes">' +
		`<button type="button" class="te-ver-conteudo ri-btn ri-btn--sec" data-pool="${escapeHtml(caixa.pool)}">Ver conteúdo</button>` +
		`<button type="button" class="ri-btn ri-btn--ouro" data-agir="comprar-caixa" data-pool="${escapeHtml(caixa.pool)}"${comprarDesabilitado ? ' disabled' : ''}>Comprar</button>` +
		`<button type="button" class="ri-btn" data-agir="abrir-caixa" data-pool="${escapeHtml(caixa.pool)}"${abrirDesabilitado ? ' disabled' : ''}>Abrir (${escapeHtml(caixa.fechadas)})</button>` +
		'</div>' +
		'</div>'
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
	return `<div class="te-modal-titulo-caixa">${escapeHtml(caixa.nome)}</div><div class="te-premios">${linhas}</div>`;
}

/** Uma trilha (free ou premium) de `passe.niveis` níveis, com prêmio nos que existirem. */
export function renderTrilhaHtml(passe, trilha) {
	const premiosPorNivel = new Map();
	for (const p of passe.premios || []) {
		if (p.trilha === trilha) {
			premiosPorNivel.set(p.nivel, p);
		}
	}
	const niveis = Math.max(1, Number(passe.niveis) || 0);
	let html = '';
	for (let nivel = 1; nivel <= niveis; nivel++) {
		const premio = premiosPorNivel.get(nivel);
		const ehAtual = nivel === passe.nivel;
		if (premio) {
			const acao =
				premio.situacao === 'AVAILABLE'
					? `<button type="button" class="ri-btn ri-btn--ouro te-nivel-resgatar" data-agir="resgatar" data-nivel="${nivel}" data-trilha="${escapeHtml(trilha)}">Resgatar</button>`
					: `<div class="te-nivel-situacao">${premio.situacao === 'CLAIMED' ? 'Resgatado' : 'Bloqueado'}</div>`;
			html +=
				`<div class="te-nivel te-nivel--premio ${classeDoNivel(premio.situacao)}${ehAtual ? ' is-atual' : ''}" data-nivel="${nivel}" data-situacao="${escapeHtml(premio.situacao)}">` +
				`<div class="te-nivel-numero">${nivel}</div>` +
				iconeFallbackHtml(premio.itemId, premio.nome) +
				`<div class="te-nivel-nome">${escapeHtml(premio.nome)}</div>` +
				acao +
				'</div>';
		} else {
			const passado = nivel <= Number(passe.nivel);
			html += `<div class="te-nivel te-nivel--marca${passado ? ' is-passado' : ''}${ehAtual ? ' is-atual' : ''}" data-nivel="${nivel}"></div>`;
		}
	}
	return html;
}

/** A aba Passe inteira: barra de pontos, as duas trilhas e o bloco do Premium. */
export function renderPasseHtml(passe) {
	const pontosPorNivel = Math.max(1, Number(passe.pontosPorNivel) || 1);
	const pctBarra = Math.min(100, Math.max(0, Math.round((Number(passe.pontosNoNivel) / pontosPorNivel) * 100)));

	const premiumBloco = passe.premium
		? '<span class="ri-badge ri-badge--ouro te-premium-selo">Premium ativo</span>'
		: `<button type="button" class="ri-btn ri-btn--ouro" data-agir="comprar-premium"${passe.compraPremium.pode ? '' : ' disabled'}>` +
			`Comprar Premium - ${passe.precoPremium === null ? 'preço a definir' : escapeHtml(passe.precoPremium) + ' RO Cash'}</button>` +
			(passe.compraPremium.texto ? `<div class="te-caixa-nota">${escapeHtml(passe.compraPremium.texto)}</div>` : '');

	return (
		'<div class="te-passe">' +
		'<div class="te-passe-resumo">' +
		`<div class="te-passe-nivel">Nível ${escapeHtml(passe.nivel)} / ${escapeHtml(passe.niveis)}</div>` +
		`<div class="ri-bar te-passe-barra"><div class="fill" style="width:${pctBarra}%"></div></div>` +
		`<div class="te-passe-hoje">Hoje: ${escapeHtml(passe.pontosHoje)} / ${escapeHtml(passe.tetoDiario)}</div>` +
		'</div>' +
		'<div class="te-passe-trilhas">' +
		'<div class="te-passe-linha te-passe-linha--free">' +
		'<span class="te-passe-rotulo">Free</span>' +
		`<div class="te-passe-trilho ri-scroll">${renderTrilhaHtml(passe, 'free')}</div>` +
		'</div>' +
		'<div class="te-passe-linha te-passe-linha--premium">' +
		'<span class="te-passe-rotulo">Premium</span>' +
		`<div class="te-passe-trilho ri-scroll">${renderTrilhaHtml(passe, 'premium')}</div>` +
		'</div>' +
		'</div>' +
		`<div class="te-passe-premium-bloco">${premiumBloco}</div>` +
		'</div>'
	);
}

/** A aba VIP: card único, benefícios do servidor, e a porta para o Passe. */
export function renderVipHtml(vip) {
	const beneficios = (vip.beneficios || [])
		.map((b) => `<li class="te-vip-beneficio${b.ativo ? '' : ' is-em-breve'}">${escapeHtml(b.texto)}</li>`)
		.join('');
	/*
	 * O VISUAL EXCLUSIVO DO VIP (a Astra Blessing, DEC-015), e ele FALTAVA.
	 *
	 * A prova de tela de 21/09/2026 abriu a aba VIP com o VIP ATIVO e mostrou o
	 * benefício como uma LINHA de lista, sem botão nenhum — enquanto o servidor
	 * já tratava `resgatar-visual-vip` desde o primeiro commit, com teste de
	 * recusa por `sem-vip` e por `ja-resgatado`. Era um verbo do servidor que
	 * nenhum caminho do jogador alcançava: ele lia "Aura exclusiva: Astra
	 * Blessing" e não tinha como pedi-la.
	 *
	 * Quem decide se pode é o SERVIDOR (`vip.visual.pode`/`.texto`): esta função
	 * não olha `vip.ativo` para liberar o botão, do mesmo jeito que o card da
	 * caixa não olha saldo.
	 */
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
		'<div class="te-vip ri-card">' +
		'<div class="te-vip-titulo">VIP RO CLASSIC</div>' +
		`<div class="te-vip-preco">${formatarPrecoCentavos(vip.precoReferenciaCentavos)} <span class="te-vip-preco-unidade">/ ${escapeHtml(vip.dias)} dias</span></div>` +
		`<ul class="te-vip-beneficios">${beneficios}</ul>` +
		cardDoVisual +
		`<button type="button" class="te-abrir-passe-vip ri-btn ri-btn--ouro">${vip.ativo ? 'Ver benefícios do VIP' : 'Ativar VIP'}</button>` +
		'</div>'
	);
}

/** O selo do cabeçalho: "VIP — N dias" ou "Sem VIP". */
export function textoDoSeloVip(vip) {
	if (!vip || !vip.ativo) {
		return 'Sem VIP';
	}
	return `VIP · ${escapeHtml(vip.diasRestantes)} dia${Number(vip.diasRestantes) === 1 ? '' : 's'}`;
}

/** Os destaques: banner da Season + resumo das caixas + resumo do passe. */
export function renderDestaquesHtml(estado) {
	const resumoCaixas = (estado.caixas || [])
		.map(
			(c) =>
				'<div class="te-resumo-caixa ri-card">' +
				`<div class="te-resumo-caixa-nome">${escapeHtml(c.nome)}</div>` +
				`<div class="te-resumo-caixa-fechadas">${escapeHtml(c.fechadas)} fechada${Number(c.fechadas) === 1 ? '' : 's'}</div>` +
				'</div>'
		)
		.join('');

	return (
		'<div class="te-banner">' +
		'<div class="te-banner-luz" aria-hidden="true"></div>' +
		'<div class="te-banner-trevas" aria-hidden="true"></div>' +
		'<div class="te-banner-texto">' +
		'<span class="te-banner-linha te-banner-linha--season">SEASON 1</span>' +
		'<span class="te-banner-linha te-banner-linha--tema">LUZ &amp; TREVAS</span>' +
		'<span class="te-banner-linha te-banner-linha--sub">HERDEIROS DE MIDGARD</span>' +
		'</div>' +
		'</div>' +
		'<div class="te-destaques-resumo">' +
		`<div class="te-destaques-caixas">${resumoCaixas}</div>` +
		'<div class="te-destaques-passe ri-card">' +
		`<div class="te-passe-nivel">Passe · Nível ${escapeHtml(estado.passe.nivel)} / ${escapeHtml(estado.passe.niveis)}</div>` +
		`<div class="te-passe-hoje">Hoje: ${escapeHtml(estado.passe.pontosHoje)} / ${escapeHtml(estado.passe.tetoDiario)}</div>` +
		'</div>' +
		'</div>'
	);
}

/** O overlay de reveal de uma abertura (`resultado.abertura`). */
export function renderRevealHtml(resultado) {
	const abertura = resultado && resultado.abertura;
	if (!abertura) {
		return '';
	}
	const raridadeClasse = classeDaRaridade(abertura.raridade);
	const linhaCorreio = abertura.repetida
		? `<div class="te-reveal-correio">${escapeHtml(resultado.texto)}</div>`
		: '<div class="te-reveal-correio">Enviado ao seu correio.</div>';
	return (
		`<div class="te-reveal-caixa ${raridadeClasse}${abertura.repetida ? ' te-reveal--repetida' : ''}">` +
		iconeFallbackHtml(abertura.itemId, abertura.nome) +
		`<div class="te-reveal-nome">${escapeHtml(abertura.nome)}</div>` +
		`<div class="te-reveal-raridade">${escapeHtml(rotuloDaRaridade(abertura))}</div>` +
		(abertura.foiGarantia ? '<div class="te-reveal-garantia">Garantia da Proteção Lendária</div>' : '') +
		linhaCorreio +
		'<button type="button" class="te-reveal-fechar ri-btn ri-btn--sec">Fechar</button>' +
		'</div>'
	);
}
