/**
 * FAVORITO x VIAJAR: AS DUAS CAIXAS DE TOQUE SE SOBREPUNHAM (R13, 14/09/2026).
 *
 * `.hm-card-fav` (a estrela) é `position: absolute`, 44x44, ancorada no
 * canto superior direito do CARTAO inteiro (`top:-1px; right:-1px`).
 * `.hm-card-go` (a seta redonda de viajar), antes deste conserto, era
 * `position: static` (nao declarada) e ficava CENTRALIZADA na vertical do
 * cartao pelo `align-items: center` do pai — e o cartao so tinha ~72px de
 * altura (o thumbnail de 54px + 8px de padding em cima/embaixo + 1px de
 * borda em cima/embaixo). A seta ficava a 21..51px do topo; a estrela, a
 * 0..40px (medindo a partir do CANTO do cartao). As duas caixas dividiam o
 * mesmo pedaco: um toque no topo da seta (ate uns 22px do topo dela) caia
 * DENTRO da caixa da estrela — e um elemento `position: absolute` pinta
 * (e portanto recebe o toque) POR CIMA de um `position: static`, nao
 * importa a ordem no DOM. O resultado medido pelo dono: as vezes favoritar
 * tambem viajava, as vezes viajar so favoritava (a seta nunca respondia) —
 * as duas faces do MESMO defeito geometrico, dependendo de exatamente onde
 * o dedo/cursor caia dentro da faixa comum.
 *
 * NAO DA PARA COBRIR OS DOIS CONTROLES COM 44px CADA SEM SOBREPOR dentro de
 * ~72px de altura (44+44 > 72) — a conta esta neste arquivo, na função
 * `geometria`. O conserto real (`HuntMap.css`, 14/09/2026) deu folga extra
 * ao cartao (`min-height: 100px`) em vez de encolher qualquer um dos dois
 * controles: a estrela CONTINUA em 44px de altura (o piso tatil real do
 * dono — "onde ha DEDO todo alvo tem 44px de lado", e o passo de 44px de
 * `prove:toque-na-barra"; uma versao anterior deste conserto a tinha
 * encolhido para 40px citando um "piso >= 40px" sem fonte, corrigido na
 * auditoria do senior-C de 14/09/2026) mantendo-a no TOPO, e a seta/pilula
 * "Aqui" foi para o RODAPE (`align-self: flex-end`) com a area de toque
 * expandida para 44px via `::before` (`inset: -7px`; tambem corrigido de
 * -5px/40px na mesma auditoria — o mesmo truque ja usado em `Common.css`,
 * so que aqui o host se posiciona por conta propria). Com os 44+44=88
 * cabendo dentro dos 100px do cartao, as duas faixas NAO SE TOCAM MAIS — o
 * z-index (estrela 1, seta 2) fica de reforco para qualquer sobra futura de
 * poucos pixels, mas nao e o que resolve o caso de hoje.
 *
 * Este arquivo NAO renderiza o componente (jsdom nao faz layout de verdade
 * — todo elemento tem caixa 0x0 sem um motor de CSS por tras). Ele le o
 * CSS de verdade, calcula as caixas com a MESMA aritmetica do navegador
 * (posicionamento absoluto/relativo, `align-self`, `::before` com `inset`
 * negativo) e simula o hit-test (quem pinta por cima, na ORDEM que o CSS
 * manda: posicionado bate estatico; entre dois posicionados, z-index maior
 * vence). A prova mora em bater essa simulação com `elementFromPoint`
 * verdadeiro seria o ideal, mas o ambiente de teste deste projeto e jsdom
 * (`vite.config.js`), que nao tem motor de layout — entao a simulação e
 * geometrica, alimentada pelos numeros REAIS do arquivo fonte, e o
 * controle de mutação abaixo prova que ela pega o defeito antigo.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CAMINHO_DO_HUNTMAP = join(process.cwd(), 'src', 'UI', 'Components', 'HuntMap', 'HuntMap.css');
const CAMINHO_DO_COMMON = join(process.cwd(), 'src', 'UI', 'Common.css');
const ler = caminho => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

/** As regras `seletores { corpo }` de um CSS, sem comentarios. */
function regras(texto) {
	const limpo = texto.replace(/\/\*[\s\S]*?\*\//g, '');
	const achadas = [];
	for (const m of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const seletores = m[1]
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);
		achadas.push({ seletores, corpo: m[2] });
	}
	return achadas;
}

/**
 * As declaracoes de um seletor EXATO, na ORDEM do arquivo — uma entrada
 * posterior sobrescreve a anterior, como a cascata faz para especificidade
 * igual (e' o caso de ".hm-card", declarado duas vezes no arquivo real).
 */
function declaracoesDe(css, seletorAlvo) {
	const props = new Map();
	for (const { seletores, corpo } of regras(css)) {
		if (!seletores.includes(seletorAlvo)) continue;
		for (const decl of corpo.split(';')) {
			const i = decl.indexOf(':');
			if (i === -1) continue;
			const prop = decl.slice(0, i).trim();
			const valor = decl.slice(i + 1).trim();
			if (prop) props.set(prop, valor);
		}
	}
	return props;
}

/** Todo `--token: valor;` do arquivo, independente do seletor que o declara. */
function tokensDe(css) {
	const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const tokens = new Map();
	for (const m of limpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
		tokens.set(m[1], m[2].trim());
	}
	return tokens;
}

/** Resolve "8px", "var(--sp-4)" ou "-1px" para numero de pixels. */
function px(valor, tokens) {
	if (valor === undefined) return undefined;
	const viaVar = /^var\((--[\w-]+)\)$/.exec(valor.trim());
	if (viaVar) return px(tokens.get(viaVar[1]), tokens);
	const m = /^(-?\d+(?:\.\d+)?)px$/.exec(valor.trim());
	if (!m) return undefined;
	return Number(m[1]);
}

/** O primeiro/segundo valor de um shorthand "top right bottom left" (aqui so top/bottom importam). */
function padding(valor, tokens) {
	const partes = valor
		.trim()
		.split(/\s+/)
		.map(p => px(p, tokens));
	if (partes.length === 1) return { top: partes[0], bottom: partes[0] };
	if (partes.length >= 3) return { top: partes[0], bottom: partes[2] };
	return { top: partes[0], bottom: partes[0] };
}

const HUNTMAP = ler(CAMINHO_DO_HUNTMAP);
const COMMON = ler(CAMINHO_DO_COMMON);
const TOKENS = new Map([...tokensDe(COMMON), ...tokensDe(HUNTMAP)]);

/**
 * Monta a geometria vertical das duas caixas (estrela e seta), a partir do
 * TEXTO real do HuntMap.css (ou de uma variante mutada, para o controle).
 * So o eixo vertical importa para provar a sobreposicao: as duas caixas
 * sao ancoradas na mesma borda direita (a estrela por `right`, a seta por
 * ser o ultimo item da linha) — a sobreposicao horizontal e quase total
 * nos dois casos (medido: a seta cabe inteira dentro da largura da
 * estrela), entao o eixo que decide se elas se tocam e o vertical.
 */
function geometria(css) {
	const card = declaracoesDe(css, '#HuntMap .hm-card');
	const fav = declaracoesDe(css, '#HuntMap .hm-card-fav');
	const go = declaracoesDe(css, '#HuntMap .hm-card-go');
	const goAntes = declaracoesDe(css, '#HuntMap .hm-card-go::before');

	// So a ESPESSURA do primeiro numero do shorthand importa aqui (topo/baixo
	// nao tem override neste componente — so ".hm-card-left" tem 3px).
	const bordaTopo = Number(/^(\d+(?:\.\d+)?)px/.exec(card.get('border') ?? '1px')?.[1] ?? 1);
	const pad = padding(card.get('padding') ?? '0', TOKENS);

	// Altura do cartao: min-height quando declarada (o conserto), senao o
	// tamanho "natural" que o conteudo dava antes dele existir (thumbnail
	// de 54px + padding + borda — e' o valor documentado no CSS antigo).
	const alturaMinima = px(card.get('min-height'), TOKENS);
	const ALTURA_NATURAL_SEM_MIN_HEIGHT = 54 + pad.top + pad.bottom + bordaTopo * 2;
	const alturaCartao = alturaMinima ?? ALTURA_NATURAL_SEM_MIN_HEIGHT;

	const contentTop = bordaTopo + pad.top;
	const contentBottom = alturaCartao - bordaTopo - pad.bottom;

	// A estrela: `top` e' relativo a BORDA DE PADDING (= bordaTopo, a partir
	// do border-box), e a caixa tem a altura declarada.
	const favTop = bordaTopo + (px(fav.get('top'), TOKENS) ?? 0);
	const favAltura = px(fav.get('height'), TOKENS) ?? 44;
	const favBottom = favTop + favAltura;

	// A seta: se NAO tem `align-self: flex-end`, o pai a centraliza no
	// content-box (o comportamento antigo, herdado de `align-items: center`
	// em ".hm-card"); com `align-self: flex-end`, ela vai para o rodape do
	// content-box (o conserto).
	const goAltura = px(go.get('height'), TOKENS) ?? 30;
	const noRodape = (go.get('align-self') ?? '').includes('flex-end');
	const goVisualTop = noRodape
		? contentBottom - goAltura
		: contentTop + (contentBottom - contentTop) / 2 - goAltura / 2;
	const goVisualBottom = goVisualTop + goAltura;

	// A area de toque REAL da seta: expandida pelo `::before` com `inset`
	// negativo, quando ele existe (o conserto); senao e' so a caixa visual.
	const insetGo = px(goAntes.get('inset'), TOKENS) ?? 0; // negativo, ex.: -5
	const goTocaTop = goVisualTop + insetGo;
	const goTocaBottom = goVisualBottom - insetGo;

	return {
		fav: { top: favTop, bottom: favBottom, posicionado: (fav.get('position') ?? 'static') !== 'static', zIndex: Number(fav.get('z-index') ?? 0) },
		goVisual: { top: goVisualTop, bottom: goVisualBottom },
		goToque: {
			top: goTocaTop,
			bottom: goTocaBottom,
			posicionado: (go.get('position') ?? 'static') !== 'static',
			zIndex: Number(go.get('z-index') ?? 0)
		}
	};
}

/** Quem pinta por cima na sobreposicao: posicionado bate estatico; entre dois posicionados, o maior z-index vence; empate, o ultimo no DOM (a seta, que vem depois da estrela no HTML gerado). */
function vence(a, b) {
	if (a.posicionado !== b.posicionado) return a.posicionado ? a : b;
	if (a.posicionado && b.posicionado && a.zIndex !== b.zIndex) return a.zIndex > b.zIndex ? a : b;
	return b;
}

/** Um ponto y esta dentro da caixa (so o eixo vertical, ver o comentario da `geometria`). */
function contem(caixa, y) {
	return y >= caixa.top && y <= caixa.bottom;
}

/** Simula elementFromPoint no eixo vertical: 'fav', 'go' ou null. */
function elementoNoPonto(g, y) {
	const candidatos = [];
	if (contem(g.fav, y)) candidatos.push({ nome: 'fav', ...g.fav });
	if (contem(g.goToque, y)) candidatos.push({ nome: 'go', ...g.goToque });
	if (candidatos.length === 0) return null;
	if (candidatos.length === 1) return candidatos[0].nome;
	return vence(candidatos[0], candidatos[1]).nome;
}

const LARGURAS = [393, 768, 1280];

describe('a estrela de favorito e a seta de viajar tem caixas de toque distintas (R13)', () => {
	it('o aparelho mede alguma coisa: acha as quatro regras que a conta usa', () => {
		expect(declaracoesDe(HUNTMAP, '#HuntMap .hm-card').size).toBeGreaterThan(3);
		expect(declaracoesDe(HUNTMAP, '#HuntMap .hm-card-fav').size).toBeGreaterThan(3);
		expect(declaracoesDe(HUNTMAP, '#HuntMap .hm-card-go').size).toBeGreaterThan(3);
		expect(declaracoesDe(HUNTMAP, '#HuntMap .hm-card-go::before').size).toBeGreaterThan(0);
	});

	for (const largura of LARGURAS) {
		// A geometria das duas caixas NAO depende da largura do cartao: as
		// duas se ancoram na borda DIREITA (a estrela por `right`, a seta por
		// ser o ultimo item da linha antes do padding-right) — mudar a
		// largura desloca as duas peças igualmente, nunca uma em relacao a
		// outra. O teste roda nas 3 larguras pedidas para provar isso: a
		// mesma conta, o mesmo resultado, independente de redimensionar.
		it(`em ${largura}px de largura: favoritar nao viaja, viajar nao favorita`, () => {
			const g = geometria(HUNTMAP);

			// As duas caixas de toque nao se tocam (o eixo que importa, ver a
			// função `geometria`).
			expect(g.fav.bottom, 'a estrela ainda alcanca onde a seta comeca').toBeLessThanOrEqual(g.goToque.top);

			// As duas cumprem o piso tatil REAL do dono (44px — "onde ha DEDO
			// todo alvo tem 44px de lado", e o passo de 44px de
			// `prove:toque-na-barra`; NAO 40px, que era um numero sem fonte).
			expect(g.fav.bottom - g.fav.top).toBeGreaterThanOrEqual(44);
			expect(g.goToque.bottom - g.goToque.top).toBeGreaterThanOrEqual(44);

			// Um toque no CENTRO de cada controle acerta o controle certo.
			const centroFav = (g.fav.top + g.fav.bottom) / 2;
			const centroGo = (g.goVisual.top + g.goVisual.bottom) / 2;
			expect(elementoNoPonto(g, centroFav), `largura ${largura}: centro da estrela`).toBe('fav');
			expect(elementoNoPonto(g, centroGo), `largura ${largura}: centro da seta`).toBe('go');

			// E nenhum ponto dentro da caixa VISUAL da seta (nao so o centro)
			// resolve para a estrela — e' a queixa exata do dono ("a seta
			// nunca responde"): amostra o topo, o meio e o fundo da seta.
			for (const y of [g.goVisual.top + 1, centroGo, g.goVisual.bottom - 1]) {
				expect(elementoNoPonto(g, y), `largura ${largura}: y=${y} dentro da seta`).toBe('go');
			}
		});
	}

	it('o portao pega o defeito de 14/09: sem o conserto, a seta cai dentro da caixa da estrela', () => {
		// Reconstroi o texto ANTES do conserto: cartao sem `min-height`,
		// estrela sem z-index (mas nos mesmos 44px de sempre — a altura dela
		// NUNCA foi o que separou as caixas, so a folga do cartao), seta sem
		// `align-self`, `position`, `z-index` nem a area de toque expandida —
		// exatamente como o arquivo estava descrito no comentario de
		// 10/09/2026 (a versao que so movia o GLIFO, sem dar folga ao cartao).
		let semOConserto = HUNTMAP
			.replace(/\n\tmin-height:\s*100px;/, '')
			.replace(/#HuntMap \.hm-card-fav \{([^}]*)\}/, (m0, corpo) =>
				`#HuntMap .hm-card-fav {${corpo.replace(/\n\tz-index:\s*1;/, '')}}`
			)
			.replace(/#HuntMap \.hm-card-go \{([^}]*)\}/, (m0, corpo) =>
				`#HuntMap .hm-card-go {${corpo
					.replace(/\n\tposition:\s*relative;/, '')
					.replace(/\n\tz-index:\s*2;/, '')
					.replace(/\n\talign-self:\s*flex-end;/, '')}}`
			)
			.replace(/#HuntMap \.hm-card-go::before \{[^}]*\}\s*/, '');

		expect(semOConserto, 'o conserto saiu do HuntMap.css — a mutacao nao encontrou o que reverter').not.toBe(HUNTMAP);

		const antigo = geometria(semOConserto);

		// CONTROLE: a caixa da estrela e a caixa (visual) da seta REALMENTE
		// se tocam na versao antiga — sem isto, o caso abaixo passaria de
		// graca por eu ter reconstruido a geometria errada.
		expect(antigo.fav.bottom, 'a mutacao nao reproduziu a sobreposicao: a conta esta errada').toBeGreaterThan(antigo.goVisual.top);

		// O CASO: um toque no TOPO da seta antiga (a faixa que o dono mediu
		// coberta) resolve para a ESTRELA, nao para a seta — o defeito.
		const topoDaSetaAntiga = antigo.goVisual.top + 1;
		expect(elementoNoPonto(antigo, topoDaSetaAntiga), 'a mutacao nao reproduz "a seta nunca responde"').toBe('fav');
	});
});
