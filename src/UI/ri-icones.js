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
 * ATUALIZACAO 01/09/2026 (onda de icones, emenda [DONO-1] assinada) — o dono
 * entregou um conjunto de 18 ilustracoes proprias para os botoes de
 * NAVEGACAO, e a regra de iconografia foi emendada: ARTE ILUSTRADA nos
 * discos de navegacao; traco Lucide continua em todo o resto (slots da
 * boneca, setas, controles dentro de janela, zeny/cash). As chaves de
 * navegacao agora chamam `arteUi(nome, <o mesmo glifo de antes>)`, que
 * resolve para `public/ragidle/ui-icons/<nome>.webp` (gerados por
 * vite/converter-ui-icons.mjs; de-para completo em docs/ui/mapa-icones.md).
 * A cadeia de reserva continua a mesma: se o WebP faltar, o onerror troca
 * pelo glifo vetorial embutido — o botao NUNCA fica vazio.
 * `auto` segue com a arte do GRF (o conjunto novo nao cobre o conceito).
 *
 * Todo <svg> daqui sai com aria-hidden="true": o glifo e DECORATIVO por
 * contrato — quem carrega nome acessivel e estado e o BOTAO em volta
 * (title/aria-label/aria-expanded, ver TopMenuIdle.js), nunca o desenho.
 *
 * @author RagIdle
 */

const svg = (inner) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

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
	`<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><image href="/ragidle/dock-icons/${chave}.png" width="24" height="24" preserveAspectRatio="xMidYMid meet" onerror='this.closest("svg").outerHTML=${JSON.stringify(glifoDeReserva)}'/></svg>`;

/**
 * Arte ILUSTRADA do dono (onda de icones 01/09/2026, emenda [DONO-1]) --
 * `public/ragidle/ui-icons/<nome>.webp`, os 18 icones de navegacao gerados
 * por vite/converter-ui-icons.mjs a partir dos originais 1024x1024 (recorte
 * na caixa alfa, lado maior 128px; de-para em docs/ui/mapa-icones.md).
 *
 * Mesmo embrulho <svg><image> de artReal, e pelos mesmos motivos (o CSS
 * dimensiona "svg", nao "img"). Duas diferencas de proposito:
 *
 * - class="ri-arte" no <svg>: a ilustracao ocupa 62% do disco em vez dos 45%
 *   do traco Lucide (ver ".ri-disc svg.ri-arte" em Common.css) -- 45% foi
 *   calibrado pra traco fino de 2px e afogaria a arte.
 * - O WebP NAO e quadrado (o recorte preserva a proporcao de cada desenho,
 *   0,59 a 1,61): preserveAspectRatio="xMidYMid meet" centraliza e encaixa
 *   dentro da caixa quadrada sem esticar.
 *
 * A reserva e a mesma cadeia de artReal: WebP faltou -> glifo vetorial
 * embutido no lugar, botao nunca fica vazio.
 */
const arteUi = (nome, glifoDeReserva) =>
	`<svg viewBox="0 0 24 24" class="ri-arte" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><image href="/ragidle/ui-icons/${nome}.webp" width="24" height="24" preserveAspectRatio="xMidYMid meet" onerror='this.closest("svg").outerHTML=${JSON.stringify(glifoDeReserva)}'/></svg>`;

const RiIcones = {
	// ── Personagem — arte ILUSTRADA (retrato do aventureiro) com reserva
	// Lucide "User" (path oficial) se o WebP faltar. ─────────────────────────
	personagem: arteUi(
		'personagem',
		svg('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>')
	),

	// ── Skills — arte ILUSTRADA (grimorio sobre estrela arcana) com reserva
	// Lucide "ScrollText" (idioma Lucide — pergaminho com linhas de
	// texto e uma ponta enrolada, path exato nao lembrado de cor). ─────────
	skills: arteUi(
		'skills',
		svg('<path d="M15.5 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M9 13h6M9 17h4"/>')
	),

	// ── Inventario / Mochila — arte ILUSTRADA (a mochila de couro que o dono
	// entregou avulsa em 01/09, [DONO-3]) com reserva Lucide "Backpack"
	// (idioma Lucide, desenhado do zero no mesmo idioma). ────────────────────
	inventario: arteUi(
		'inventario',
		svg('<path d="M6 20V10a6 6 0 0 1 12 0v10"/><path d="M6 20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2"/><path d="M9 4.4a3 3 0 0 1 6 0"/><rect x="9" y="13" width="6" height="5" rx="1"/>')
	),

	// ── Caca — arte ILUSTRADA (escudo com espadas cruzadas) com reserva
	// Lucide "Map" (era o conceito do glifo antigo; a silhueta nova e outra
	// mas a reserva so aparece por instantes de falha). ─────────────────────
	caca: arteUi(
		'caca',
		svg('<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>')
	),

	// ── Config (o botao "Idle" da HUD, abre IdleConfig) — arte ILUSTRADA
	// (engrenagens; o dono cravou em [DONO-4]: a engrenagem e do IDLE) com
	// reserva Lucide "Settings" (idioma Lucide, engrenagem simplificada pra
	// continuar legivel em 12-15px). O ARQUIVO chama idle.webp — o nome da
	// chave e anterior a decisao e os consumidores ja a citam; renomear chave
	// e mexer em todo HTML por causa de um apelido. ──────────────────────────
	config: arteUi(
		'idle',
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
	// scripts/icones-de-menu.ts pro resto da investigacao. A arte ILUSTRADA
	// (01/09) resolve o impasse: o brasao proprio do escudo azul nao e letra.──
	guilda: arteUi(
		'guilda',
		svg('<path d="M12 2 20 5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5z"/>')
	),

	// ── Grupo — arte ILUSTRADA (dupla chibi ARMADA — o par desarmado e o
	// `amigos` abaixo) com reserva Lucide "Users". ───────────────────────────
	grupo: arteUi(
		'grupo',
		svg('<circle cx="9" cy="8" r="3"/><path d="M2 21c0-3.9 3.1-6 7-6s7 2.1 7 6"/><circle cx="17.2" cy="8.6" r="2.4"/><path d="M15.6 15.2c2.7.4 4.6 2.2 4.6 5.8"/>')
	),

	// ── Amigos — chave NOVA da onda de 01/09 ([DONO-5]): ate entao o botao
	// Amigos desenhava o MESMO icone do Grupo — dois rotulos, uma figura. A
	// arte ilustrada tem o par DESARMADO para Amigos e o armado para Grupo.
	// Reserva Lucide "Heart-Handshake" simplificado (idioma Lucide). ─────────
	amigos: arteUi(
		'amigos',
		svg('<circle cx="8" cy="8.5" r="3"/><path d="M1.5 21c0-3.6 2.9-5.5 6.5-5.5"/><circle cx="16" cy="8.5" r="3"/><path d="M12.2 21c.6-3.3 3.2-5.5 6.3-5.5 1.4 0 2.7.4 3.7 1.1"/>')
	),

	// ── Correio — arte REAL, mas NAO de ro_menu_icon: o candidato de la
	// (mail_1.bmp) foi convertido e OLHADO, e tem a palavra "RODEX" pintada em
	// pixel dentro do glifo -- a MESMA reprovacao de guild_1 ("G") e bank_1
	// ("Z"), porque o design system exige glifo puro, sem texto. O envelope
	// limpo veio do rodexsystem (icon_status_mail_received.bmp, 24x24), que e
	// a arte que a propria lista de correio nativa usa por linha
	// (Rodex.js:174). Reserva Lucide "Mail" se o PNG faltar. ──────────────
	// A arte ILUSTRADA (01/09) e o envelope com selo de cera. O PNG do
	// rodexsystem continua em dock-icons/ porque a LISTA do CorreioIdle usa
	// os dois estados dele por linha (CorreioIdle.js) — aqui era so o botao.
	correio: arteUi(
		'correio',
		svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 6.5 9 6.5 9-6.5"/>')
	),

	// ── Missões — (idioma Lucide, "ListChecks": lista com marcas de feito).
	// Sem candidato em ro_menu_icon: o conceito "missão/quest" do cliente
	// (quest_1.bmp) tem ponto de exclamação PINTADO no glifo, a mesma
	// reprovação de guilda="G"/zeny="Z" (o DS proíbe texto/símbolo tipográfico
	// dentro do glifo) — fica 100% Lucide. ──────────────────────────────────
	// Desde 01/09 tem arte ILUSTRADA (prancheta com marcas de feito) — o
	// ponto de exclamacao que reprovava o candidato do GRF nao existe nela.
	missoes: arteUi(
		'missoes',
		svg('<path d="m3 6.5 1.8 1.8L8.3 4.8"/><path d="m3 16.5 1.8 1.8 3.5-3.5"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>')
	),

	// ── Codex (D-851) — (idioma Lucide, "BookOpen": livro aberto). Sem
	// candidato em ro_menu_icon: o conceito nao existe no cliente oficial (o
	// Codex e mecanica NOSSA), entao fica 100% Lucide, como loja/roshop/troca.
	//
	// PARENTESCO DECLARADO com `skills`, que tambem e livro: aquele resolve
	// para a ARTE REAL do cliente (um grimorio chibi com emblema, colorido) e
	// so cai em pergaminho vetorial se o PNG faltar — as duas silhuetas nao se
	// confundem na tela, e os dois botoes moram em lugares diferentes (cluster
	// e leque). Se um dia o `skills` perder o PNG, o par fica ambiguo: e o
	// ponto em que este glifo precisa mudar.
	codex: arteUi(
		'codex',
		svg('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>')
	),

	// ── Loja — arte ILUSTRADA (barraca de madeira) com reserva Lucide
	// "Store". ───────────────────────────────────────────────────────────────
	loja: arteUi(
		'loja',
		svg('<path d="M3 9 4 4h16l1 5"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 20v-5a3 3 0 0 1 6 0v5"/>')
	),

	// ── RO Shop — arte ILUSTRADA (cristal iridescente) com reserva Lucide
	// "Gem". ─────────────────────────────────────────────────────────────────
	roshop: arteUi(
		'ro-shop',
		svg('<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M9 9l3 12 3-12"/>')
	),

	// ── Troca — arte ILUSTRADA (setas de mao dupla) com reserva Lucide
	// "Repeat". O ARQUIVO chama trade.webp (nome que o dono deu a arte). ─────
	troca: arteUi(
		'trade',
		svg('<path d="M17 2l4 4-4 4"/><path d="M3 6h18"/><path d="M7 22l-4-4 4-4"/><path d="M21 18H3"/>')
	),

	// ── Leilao — arte ILUSTRADA (martelo de leiloeiro) com reserva no idioma
	// Lucide (desenhado do zero, "Gavel" nao lembrado de cor). ───────────────
	leilao: arteUi(
		'leilao',
		svg('<path d="M17.5 3.5l3 3-4.5 4.5-3-3z"/><path d="M13 8l-9 9"/><path d="M9 12l3 3"/><path d="M4 20h9"/>')
	),

	// ── Recompensas — arte ILUSTRADA (bau de tesouro com gemas) com reserva
	// Lucide "Gift". ─────────────────────────────────────────────────────────
	recompensas: arteUi(
		'recompensas',
		svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M12 8C9.5 3.5 5.5 4.5 5.5 7c0 1.5 2.5 1 6.5 1zM12 8c2.5-4.5 6.5-3.5 6.5-1 0 1.5-2.5 1-6.5 1z"/>')
	),

	// ── Eventos — arte ILUSTRADA (calendario) com reserva Lucide
	// "Calendar". ────────────────────────────────────────────────────────────
	eventos: arteUi(
		'eventos',
		svg('<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>')
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

	// ── Cash — Lucide "Gem": a moeda PAGA do jogo, e ela precisa ser
	// distinguivel do zeny a um relance, porque as duas ficam lado a lado na
	// mesma faixa. Duas moedas parecidas na mesma linha seriam pior que uma. ──
	cash: svg('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>'),

	// ── Grafico — arte ILUSTRADA (barras com seta subindo; o dono confirmou
	// em [DONO-2]: esta chave e a Analise de Caca e mais nada) com reserva
	// Lucide "BarChart3". O ARQUIVO chama analise-de-caca.webp. ──────────────
	grafico: arteUi(
		'analise-de-caca',
		svg('<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>')
	),

	// ── Admin — (idioma Lucide, "Wrench"). ───────────────────────────────────
	admin: svg(
		'<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-3-3-3 3z"/>'
	),

	// ── Pin — Lucide "MapPin" (uso generico). ────────────────────────────────
	pin: svg('<path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),

	// ── Mais — Lucide "Plus" (uso generico). ─────────────────────────────────
	mais: svg('<path d="M12 5v14M5 12h14"/>'),

	// ── Seta — Lucide "ChevronDown" (idioma Lucide, path oficial). Botao de
	// recolher/expandir da HUD (TopMenuIdle/BasicInfoIdle) -- a DIRECAO muda
	// por rotacao em CSS no proprio componente (var(--dur-fast)), nunca um
	// segundo glifo pra cada sentido. ───────────────────────────────────────
	seta: svg('<path d="M6 9l6 6 6-6"/>'),

	// ── Glifos-fantasma de slot vazio (MochilaIdle, 19/08/2026) — a peca
	// central do alvo "Origin" (redesign/extracao-inventario-origin.md secao
	// 2): um slot de equipamento VAZIO mostra a SILUETA do que falta ali, nao
	// um buraco cinza. Idioma Lucide puro (svg(), currentColor, stroke 2) de
	// PROPOSITO — nao artReal(): a silueta precisa herdar a cor fantasma via
	// CSS "color" (".mo-slot.is-empty" em MochilaIdle.css), e um PNG raster
	// nao recolore por CSS. "slotArmadura"/"slotEscudo" reusam o MESMO path
	// data das reservas Lucide de "equipamento"/"guilda" acima (mesmo
	// vocabulario visual, sem inventar dois desenhos pro mesmo conceito). ────
	// Chapeu (HEAD_TOP) -- copa + ABA que ultrapassa a copa dos dois lados
	// (a aba e o que distingue "chapeu" de "sino": um sino afunila pro alto
	// sem essa faixa saliente) + uma faixa/fita na base da copa, o segundo
	// sinal classico de chapeu. Verificado com foto real (gauntlet
	// 19/08/2026): a v1 (so copa + linha de base do mesmo tamanho) lia como
	// sino de mao a 22px -- corrigido aqui.
	slotChapeu: svg(
		'<path d="M3 16.5h18"/><path d="M7 16c0-5.2 2.1-9.5 5-9.5s5 4.3 5 9.5"/><path d="M8.2 14h7.6"/>'
	),
	// Oculos (HEAD_MID, RO: cobre os olhos -- Sunglasses/Glasses) -- duas
	// lentes ligadas por ponte, com hastes curtas indo pra fora. Diferente do
	// glifo de acessorio (que e um anel/gema), pra nao repetir leitura com
	// "duas coisas redondas ligadas".
	slotOculos: svg(
		'<circle cx="7.2" cy="12" r="3.1"/><circle cx="16.8" cy="12" r="3.1"/><path d="M10.3 12h3.4M3.6 11 1.8 10.2M20.4 11l1.8-.8"/>'
	),
	// Boca (HEAD_BOTTOM, RO: cobre nariz/boca -- Bandana/Mascara). Curva de
	// sorriso + linha do labio inferior, leitura de "boca" mesmo em 22px.
	slotBoca: svg('<path d="M4.5 12.5c2.6 3 12.4 3 15 0"/><path d="M7.5 13c1.8 1.3 7.2 1.3 9 0"/>'),
	slotArmadura: svg(
		'<path d="M8 3 4 6l2 3 2-1v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8l2 1 2-3-4-3-2 2h-2z"/>'
	),
	slotArma: svg('<path d="M19 3 21 5 8 18l-3 3-2-2 3-3L19 3z"/><path d="M13 8l3 3"/>'),
	slotEscudo: svg('<path d="M12 2 20 5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5z"/>'),
	// Capa (GARMENT) -- silhueta de manto: ombro reto e largo, cintura
	// estreita, barra alargada embaixo (a "ampulheta" e o que le como pano
	// que flutua, nao como roupa colada ao corpo) + broche no colarinho.
	// Verificado com foto real (gauntlet 19/08/2026): a v1 (trapezio unico
	// afunilando de cima a baixo) lia como frasco/pino de boliche -- a
	// cintura estreita no meio e a correcao.
	slotCapa: svg('<path d="M6 5h12l-4 5 4 10H6l4-10z"/><circle cx="12" cy="5" r="1.1"/>'),
	// Sapato/bota (SHOES) -- perna reta + pe angular com bico e salto sem
	// nenhuma curva (so linhas retas, pra nao arredondar pra "frasco" de
	// novo, mesmo erro do slotCapa v1 -- ver nota acima e a foto real que
	// pegou os dois).
	slotSapato: svg('<path d="M9 3h6v8h5l1 3-1 2H5v-3h4z"/>'),
	// Acessorio (ACCESSORY1/2) -- anel (aro) com uma GEMA facetada em cima
	// (duas linhas formando o corte, nao uma curva unica) -- a curva unica
	// da v1 lia como gota d'agua (a "silueta generica" que o briefing
	// reprovou), a faceta reta e o que distingue "joia" de "gota".
	// ── Slot de municao — a flecha (28/08/2026). Ela e a unica peca que o
	// jogador GASTA, e o ladrilho dela e o unico com contador. ────────────────
	slotMunicao: svg('<path d="M4 20 20 4"/><path d="M15 4h5v5"/><path d="M4 20l1.5-4.5L9 14"/>'),

	slotAcessorio: svg('<circle cx="12" cy="15" r="5"/><path d="M9 7h6l-3-4z"/><path d="M9 7 12 10 15 7"/>'),

	// Fantasia/costume (MochilaIdle, 26/08/2026) -- estrela de brilho de 4
	// pontas (idioma Lucide: e a forma central do "sparkles" oficial,
	// SEM os dois acentos pequenos de proposito -- o selo da grade mostra
	// isto a 9px, e a 9px os acentos viram ruido). "Sparkles" aqui NAO
	// conflita com a nota do cabecalho sobre o showcase: la ele foi trocado
	// como icone do slot central do DOCK (que virou "Caça"), nao proibido
	// como conceito -- e "brilho" e exatamente o conceito de peca so-visual.
	fantasia: svg('<path d="M12 3l1.9 7.1L21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9z"/>'),

	// ── Mapa de Caça redesenhado (D-901, 01/09/2026). Quatro glifos Lucide
	// (paths oficiais "search", "lock", "arrow-right", "map", "x") que a
	// janela usa no chrome: a lupa da busca, o cadeado do mapa trancado, a
	// seta do botao "viajar" de cada linha, o mapa vazio atras da miniatura
	// que falta (era um emoji, proibido pelo design system) e o X que limpa
	// a busca. ────────────────────────────────────────────────────────────
	busca: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
	cadeado: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
	irPara: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
	mapaVazio: svg(
		'<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'
	),
	fechar: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),

	// ── Árvore de habilidades (D-902, 01/09/2026): as setas da plaqueta
	// ◀ n/m ▶ eram glifos de FONTE (viravam emoji em alguns sistemas) e o
	// ✓/✗ dos pré-requisitos idem. Lucide "chevron-left", "chevron-right" e
	// "check". ─────────────────────────────────────────────────────────────
	chevronEsq: svg('<path d="m15 18-6-6 6-6"/>'),
	chevronDir: svg('<path d="m9 18 6-6-6-6"/>'),
	confere: svg('<path d="M20 6 9 17l-5-5"/>'),
};

export default RiIcones;
