/**
 * UI/ri-icones.js
 *
 * Set unico de glifos do "Ragnarok Idle Design System" (DS oficial do dono,
 * fornecido em 18/08/2026 — SUBSTITUI a rodada anterior deste modulo, que
 * usava SVG preenchido com gradiente azul + acento dourado desenhado a mao.
 * Regra do DS, textual: "No emoji, and no hand-drawn SVG illustration
 * anywhere in this system."
 *
 * Cada chave deste objeto e uma STRING de SVG pronta pra virar innerHTML —
 * nunca um componente React/Vue, nunca DOM criado em JS.
 *
 * Receita de GLIFO (o DS e claro: o premio nao vem do glifo, vem do
 * TRATAMENTO em volta dele — ver ".ri-disc"/".ri-glass" em cada CSS de
 * componente):
 *   - estilo Lucide (MIT) — path data incorporado INLINE aqui, sem CDN nem
 *     dependencia de rede (o cliente roda local, sem internet em runtime);
 *   - stroke 2, stroke-linecap/stroke-linejoin round, fill NENHUM;
 *   - cor = currentColor — quem injeta controla a cor via CSS "color" no
 *     elemento pai (".ri-disc", ".ri-glass" etc.), nunca um valor fixo aqui;
 *   - viewBox "0 0 24 24" em todos, sem width/height fixo no proprio <svg>
 *     (o tamanho e 45% do diametro do disco/orbe que envolve o icone — essa
 *     conta mora no CSS de cada componente, nunca aqui).
 * Onde o path exato de um icone Lucide nao era conhecido de cor, o glifo foi
 * desenhado no MESMO idioma (2px, round, geometrico, sem detalhe barroco) —
 * marcado com comentario "(idioma Lucide)" nesses casos.
 *
 * Nomes OFICIAIS por item (extraidos do showcase ui_kits/game_hud/
 * BottomBar.jsx pelo dono, 19/08/2026 — complemento ao pivo de icones):
 * user (personagem), scroll-text (skills), backpack (inventario), shirt
 * (equipamento), shield (guilda), users (grupo), store (loja), menu (menu).
 * O showcase generico usa "sparkles" pro slot central deles, mas o NOSSO
 * central e "Caça" (feature real do jogo, nao o exemplo generico do DS) —
 * pra esse e os outros que o DS nao nomeia, a escolha ficou por conta deste
 * fork: map (caca), zap (auto — "swords ou zap", ambos aceitos pelo DS),
 * coins (zeny), settings (config, fora do escopo nomeado do DS).
 *
 * Uso tipico (ver DockIdle.js/TopMenuIdle.js/CombatCornerIdle.js/
 * BasicInfoIdle.js/TopBarIdle.js): o .html de cada componente troca o
 * <svg>...</svg> antigo por um marcador HTML "<!--RI_ICONE:chave-->", e o
 * render() do componente troca esse marcador pela string deste modulo antes
 * de devolver o innerHTML — ids/data-attrs/listeners de fora do <svg> nunca
 * mudam de lugar.
 *
 * ATUALIZACAO 19/08/2026 — o proprio design system OFICIAL marca o glifo
 * Lucide acima como "substituicao sinalizada": o conjunto real deveria vir
 * da arte convertida do cliente. Investigado (ver scripts/icones-de-menu.ts
 * em rag-idle-master): o GRF tem um set de glifo puro pronto pra isso,
 * `ro_menu_icon/<nome>_1.bmp` (36x36, chibi, fundo magenta, SEM caixa nem
 * texto pintado). 9 das 19 chaves usadas por este fork tinham candidato
 * aprovavel; essas 9 agora chamam `artReal(chave, <o mesmo svg de antes>)`
 * — o SVG antigo fica como RESERVA (usado se o PNG faltar, ver `onerror` em
 * `artReal`). As outras chaves continuam 100% Lucide, por dois motivos
 * possiveis (documentado key a key abaixo): o unico candidato do GRF tinha
 * letra pintada em pixel (guilda="G", zeny="Z" — o DS proibe texto dentro
 * do glifo), ou nao existe candidato nenhum pro conceito (loja, roshop,
 * troca, leilao, eventos, passe, menu, admin, grafico).
 *
 * @author RagIdle
 */

const svg = (inner) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/**
 * Arte REAL do cliente (GRF, pasta ro_menu_icon -- ver
 * scripts/icones-de-menu.ts no rag-idle-master, que gerou os PNGs em
 * public/ragidle/dock-icons/<chave>.png) embrulhada num <svg> com <image>
 * em vez de <img> solto -- de PROPOSITO: e o unico jeito de reusar o
 * dimensionamento que ja existe em CSS sem tocar em NENHUM arquivo de CSS
 * (a regra e "nao toque em Common.css", e o dimensionamento -- 45% do disco
 * em ".ri-disc svg"/".ri-glass svg", 20x20 fixo em ".dk-icon-wrap svg" --
 * mira o seletor "svg", nao "img"). O <image> e um retangulo raster dentro
 * do proprio SVG: o navegador escala exatamente como escalaria um <img>.
 *
 * SEM "image-rendering:pixelated" aqui, de proposito: a regra 4 do
 * CLAUDE.md (rag-idle-master) manda pixelated pra AMPLIACAO por numero
 * inteiro (ex.: sprite 24x24 mostrado a 48px). Aqui e o CONTRARIO -- a arte
 * nasce 36x36 e todo consumidor de hoje mostra ela MENOR (20 a 52px,
 * nenhum maior que a origem) -- e pixelated (nearest-neighbor) em
 * REDUCAO produz serrilhado, nao nitidez. Testado nos dois modos
 * (gauntlet 19/08/2026, mockup com Common.css real + Playwright
 * deviceScaleFactor 3): a reducao suave (padrao do navegador) ficou nitida
 * em TODOS os tamanhos reais do fork (20/26/27/42/52px); pixelated ficou
 * pior. Se um consumidor futuro passar a exibir esta arte AMPLIADA alem de
 * 36px, ele precisa da mesma regra 4 (pixelated + inteiro) que qualquer
 * outro PNG do cliente -- não é o caso de nenhum consumidor hoje.
 */
const artReal = (chave, glifoDeReserva) =>
	`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><image href="/ragidle/dock-icons/${chave}.png" width="24" height="24" preserveAspectRatio="xMidYMid meet" onerror='this.closest("svg").outerHTML=${JSON.stringify(glifoDeReserva)}'/></svg>`;

const RiIcones = {
	// ── Personagem — arte REAL (ro_menu_icon/status_1.bmp, busto chibi) com
	// reserva Lucide "User" (path oficial) se o PNG faltar. ─────────────────
	personagem: artReal(
		'personagem',
		svg('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>')
	),

	// ── Skills — arte REAL (ro_menu_icon/skill_1.bmp, livro com emblema) com
	// reserva Lucide "ScrollText" (idioma Lucide — pergaminho com linhas de
	// texto e uma ponta enrolada, path exato nao lembrado de cor). ─────────
	skills: artReal(
		'skills',
		svg('<path d="M15.5 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M9 13h6M9 17h4"/>')
	),

	// ── Inventario / Mochila — arte REAL (ro_menu_icon/item_1.bmp, bau) com
	// reserva Lucide "Backpack" (idioma Lucide, path exato nao lembrado de
	// cor, desenhado do zero no mesmo idioma). ──────────────────────────────
	inventario: artReal(
		'inventario',
		svg('<path d="M6 20V10a6 6 0 0 1 12 0v10"/><path d="M6 20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2"/><path d="M9 4.4a3 3 0 0 1 6 0"/><rect x="9" y="13" width="6" height="5" rx="1"/>')
	),

	// ── Equipamento — arte REAL (ro_menu_icon/equip_1.bmp, peitoral) com
	// reserva Lucide "Shirt" (idioma Lucide — silhueta de camiseta, path
	// exato nao lembrado de cor). ────────────────────────────────────────────
	equipamento: artReal(
		'equipamento',
		svg('<path d="M8 3 4 6l2 3 2-1v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8l2 1 2-3-4-3-2 2h-2z"/>')
	),

	// ── Caca — arte REAL (ro_menu_icon/map_1.bmp, pergaminho/mapa) com
	// reserva Lucide "Map". ──────────────────────────────────────────────────
	caca: artReal(
		'caca',
		svg('<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>')
	),

	// ── Config — arte REAL (ro_menu_icon/option_1.bmp, duas engrenagens) com
	// reserva Lucide "Settings" (idioma Lucide, engrenagem simplificada pra
	// continuar legivel em 12-15px). ─────────────────────────────────────────
	config: artReal(
		'config',
		svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2.5 12h3M18.5 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>')
	),

	// ── Menu — Lucide "Menu". ────────────────────────────────────────────────
	menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),

	// ── Guilda — Lucide "Shield" (path oficial; era "Flag" na rodada
	// anterior — o showcase nomeia "shield" pra Guilda, "shirt" ficou livre
	// pra Equipamento, ver acima). REPROVADO um candidato real (investigacao
	// 19/08/2026, GRF ro_menu_icon/guild_1.bmp -- estandarte com asas): tem a
	// letra "G" pintada em pixel dentro do bmp, e o design system exige
	// "glifo puro, sem texto" (redesign/design-system-oficial.md); ver
	// scripts/icones-de-menu.ts pro resto da investigacao. ──────────────────
	guilda: svg('<path d="M12 2 20 5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5z"/>'),

	// ── Grupo — arte REAL (ro_menu_icon/party_1.bmp, dupla chibi + "+") com
	// reserva Lucide "Users". ────────────────────────────────────────────────
	grupo: artReal(
		'grupo',
		svg('<circle cx="9" cy="8" r="3"/><path d="M2 21c0-3.9 3.1-6 7-6s7 2.1 7 6"/><circle cx="17.2" cy="8.6" r="2.4"/><path d="M15.6 15.2c2.7.4 4.6 2.2 4.6 5.8"/>')
	),

	// ── Loja — (idioma Lucide, "Store"). ────────────────────────────────────
	loja: svg(
		'<path d="M3 9 4 4h16l1 5"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 20v-5a3 3 0 0 1 6 0v5"/>'
	),

	// ── RO Shop — Lucide "Gem". ──────────────────────────────────────────────
	roshop: svg(
		'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M9 9l3 12 3-12"/>'
	),

	// ── Troca — Lucide "Repeat". ─────────────────────────────────────────────
	troca: svg(
		'<path d="M17 2l4 4-4 4"/><path d="M3 6h18"/><path d="M7 22l-4-4 4-4"/><path d="M21 18H3"/>'
	),

	// ── Leilao — (idioma Lucide, "Gavel" nao existe no set classico que
	// temos de cor, desenhado do zero no mesmo idioma). ─────────────────────
	leilao: svg(
		'<path d="M17.5 3.5l3 3-4.5 4.5-3-3z"/><path d="M13 8l-9 9"/><path d="M9 12l3 3"/><path d="M4 20h9"/>'
	),

	// ── Recompensas — arte REAL (ro_menu_icon/achievement_1.bmp, trofeu) com
	// reserva Lucide "Gift". ─────────────────────────────────────────────────
	recompensas: artReal(
		'recompensas',
		svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M12 8C9.5 3.5 5.5 4.5 5.5 7c0 1.5 2.5 1 6.5 1zM12 8c2.5-4.5 6.5-3.5 6.5-1 0 1.5-2.5 1-6.5 1z"/>')
	),

	// ── Eventos — Lucide "Calendar". ─────────────────────────────────────────
	eventos: svg(
		'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>'
	),

	// ── Passe — Lucide "Ticket". ─────────────────────────────────────────────
	passe: svg(
		'<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M9 7v10" stroke-dasharray="2 2.4"/>'
	),

	// ── Auto — arte REAL (ro_menu_icon/battle_1.bmp, espadas cruzadas) com
	// reserva Lucide "Zap" (le "automatico"). ────────────────────────────────
	auto: artReal('auto', svg('<path d="M13 2 3 14h8l-1 8 11-14h-8z"/>')),

	// ── Zeny — Lucide "Coins" (path oficial nomeado pelo showcase — trocou o
	// "Z" estilizado da rodada anterior, o contexto do valor ao lado ja
	// desambigua a moeda). REPROVADO um candidato real (investigacao
	// 19/08/2026, GRF ro_menu_icon/bank_1.bmp -- saco de moedas): tem a
	// letra "Z" pintada em pixel dentro do bmp, mesmo motivo de "guilda"
	// acima -- o design system pede glifo puro. ──────────────────────────────
	zeny: svg('<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/><path d="M9 6.5v5M15 12.5v5"/>'),

	// ── Grafico — Lucide "BarChart3" (botao status compacto da HUD). ────────
	grafico: svg('<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>'),

	// ── Admin — (idioma Lucide, "Wrench"). ───────────────────────────────────
	admin: svg(
		'<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-3-3-3 3z"/>'
	),

	// ── Pin — Lucide "MapPin" (uso generico). ────────────────────────────────
	pin: svg('<path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),

	// ── Mais — Lucide "Plus" (uso generico). ─────────────────────────────────
	mais: svg('<path d="M12 5v14M5 12h14"/>'),
};

export default RiIcones;
