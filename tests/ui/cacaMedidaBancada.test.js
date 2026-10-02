/**
 * A BANCADA DE DESEMPENHO DO MAPA DE CACA (contrato da Caca Medida, secao 10:
 * *"o Mapa de Caca abre MAIS RAPIDO que hoje"*).
 *
 * Ela so roda com o catalogo REAL na mao, e por isso pula na suite normal:
 *
 *   RAG_BENCH_CATALOGO=<paginas.json> npx vitest run tests/ui/cacaMedidaBancada.test.js
 *
 * `<paginas.json>` e um array com as strings JSON das paginas do
 * `ZC_RAGIDLE_CATALOGO`, como o servidor as manda (`paginarCatalogo` sobre o
 * `montarCatalogo` do `conteudo.json`). Com `RAG_BENCH_SAIDA=<pasta>` ela
 * tambem grava o HTML da janela em dois instantes — logo depois do trecho
 * sincrono da abertura e com a lista completa —, para a medicao no Chromium.
 *
 * O MESMO arquivo mede o codigo de antes e o de depois: ele so usa o que as
 * duas versoes tem (`toggle`, `limparEstadoDoPersonagem`, o gancho do
 * catalogo) e, quando existe, `_terminarLista()` — que na versao de antes nao
 * existe porque la a lista inteira saia no mesmo `innerHTML`.
 *
 * O INSTRUMENTO e `performance.now()` no **jsdom**: ele mede o trabalho de JS
 * e de construcao do DOM (ler o pacote, filtrar, ordenar, montar a string, o
 * `innerHTML`), e NAO mede estilo, leiaute nem pintura — o jsdom nao tem
 * nenhum dos tres. Numero daqui nao descreve o celular.
 */
import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOGO = process.env.RAG_BENCH_CATALOGO;
const SAIDA = process.env.RAG_BENCH_SAIDA;
const ligada = !!(CATALOGO && existsSync(CATALOGO));

const mocks = vi.hoisted(() => ({ hooks: [], enviados: [] }));

vi.mock('Network/NetworkManager.js', () => ({
	default: {
		sendPacket: p => mocks.enviados.push(p),
		hookPacket: (pkt, cb) => mocks.hooks.push({ pkt, cb })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), vsync: [], width: 1280, height: 800 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1, INFO: 2 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { append: () => {}, remove: () => {}, uid: 0 } }));
vi.mock('UI/itemNaTela.js', () => ({
	aplicarIconeDoItem: () => {},
	nomeLocalDoItem: (id, fallback) => fallback
}));

function estatistica(amostras) {
	const o = amostras.slice().sort((a, b) => a - b);
	const q = p => o[Math.min(o.length - 1, Math.floor(p * o.length))];
	return { mediana: q(0.5), p95: q(0.95), min: o[0], n: o.length };
}

const fmt = s => `mediana ${s.mediana.toFixed(2)} ms · p95 ${s.p95.toFixed(2)} ms · min ${s.min.toFixed(2)} ms (n=${s.n})`;

/**
 * O bloco `cacaMedida` que um ADMINISTRADOR recebe, na forma do FIO (v3,
 * secao 11 — D-1842 no servidor), sintetico sobre o catalogo real: 30 mapas
 * medidos em tupla e o risco de todos ALINHADO a ordem das paginas. As paginas
 * de fora nao mudam — o bloco entra so na primeira, que e onde o servidor o poe.
 */
function paginasDeAdmin(paginas) {
	const todos = paginas.flatMap(p => JSON.parse(p).mapas || []);
	const medida = {};
	todos.slice(0, 30).forEach((m, i) => {
		medida[m.mapa] = [12 + i, 1, 1000 + i * 137, 700 + i * 91, 5000 + i * 311, 40 + i, i % 4, i % 4, 120 + i];
	});
	const g = todos.map((m, i) => 1 + (i % 12));
	const l = g.map(golpes => (golpes >= 7 ? 's' : golpes >= 4 ? 'c' : 'a')).join('');
	const primeira = JSON.parse(paginas[0]);
	primeira.cacaMedida = {
		v: 3,
		limites: { seguro: 7, cuidado: 4 },
		medida,
		risco: { n: todos.length, g, l },
		explorar: { estado: 'parado' }
	};
	return [JSON.stringify(primeira)].concat(paginas.slice(1));
}

describe.skipIf(!ligada)('bancada: abrir o Mapa de Caca (jsdom)', () => {
	it('mede a abertura, a lista completa e a reabertura', async () => {
		const paginas = JSON.parse(readFileSync(CATALOGO, 'utf8'));
		const deAdmin = paginasDeAdmin(paginas);
		const { default: PACKET } = await import('Network/PacketStructure.js');
		const { default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js');
		const { default: htmlDoMapa } = await import('UI/Components/HuntMap/HuntMap.html?raw');
		HuntMap._host = document.createElement('div');
		HuntMap._host.innerHTML = htmlDoMapa;
		HuntMap._shadow = null;
		HuntMap.focus = () => {};
		HuntMap.draggable = () => {};
		HuntMap.init();
		const catalogo = mocks.hooks.find(h => h.pkt === PACKET.ZC.RAGIDLE_CATALOGO).cb;
		const terminar = () => (typeof HuntMap._terminarLista === 'function' ? HuntMap._terminarLista() : undefined);
		const cartoes = () => HuntMap._host.querySelectorAll('.hm-card').length;

		function abrirDoZero(pags) {
			HuntMap.limparEstadoDoPersonagem(); // fecha e esquece: a proxima abertura e a primeira
			const t0 = performance.now();
			HuntMap.toggle();
			for (const json of pags) {
				catalogo({ json });
			}
			const t1 = performance.now();
			const noPrimeiroQuadro = cartoes();
			terminar();
			const t2 = performance.now();
			return { sincrono: t1 - t0, completo: t2 - t0, noPrimeiroQuadro, total: cartoes() };
		}
		function reabrir(pags) {
			HuntMap.toggle(); // fecha
			const t0 = performance.now();
			HuntMap.toggle(); // abre
			for (const json of pags) {
				catalogo({ json });
			}
			const t1 = performance.now();
			terminar();
			return performance.now() - t0 + 0 * t1;
		}

		for (let i = 0; i < 10; i++) {
			abrirDoZero(paginas);
			reabrir(paginas);
			abrirDoZero(deAdmin);
		}

		/*
		 * A REABERTURA COM CABECALHO NOVO (D-1850): o jogador subiu de nivel ou
		 * trocou de mapa, entao o catalogo NAO e o mesmo byte a byte e a regra 2
		 * nao o salva. Cheio: as paginas inteiras de novo. Leve (so com
		 * `RAG_BENCH_LEVE=1` e paginas com `fixo`): uma pagina so de cabecalho.
		 */
		let nivelDaVez = 0;
		const comNivel = (json, nivel) => {
			const p = JSON.parse(json);
			p.nivel = nivel;
			return JSON.stringify(p);
		};
		function reabrirCabecalhoNovo(pags) {
			nivelDaVez += 1;
			const novas = pags.map(j => comNivel(j, 1 + (nivelDaVez % 98)));
			HuntMap.toggle();
			const t0 = performance.now();
			HuntMap.toggle();
			for (const json of novas) {
				catalogo({ json });
			}
			terminar();
			return performance.now() - t0;
		}
		const leve = process.env.RAG_BENCH_LEVE === '1' && !!JSON.parse(paginas[0]).fixo;
		const paginaLeve = nivel => {
			const p = JSON.parse(paginas[0]);
			delete p.mapas;
			p.partes = 1;
			p.nivel = nivel;
			return JSON.stringify(p);
		};
		function reabrirLeve() {
			nivelDaVez += 1;
			const json = paginaLeve(1 + (nivelDaVez % 98));
			HuntMap.toggle();
			const t0 = performance.now();
			HuntMap.toggle();
			catalogo({ json });
			terminar();
			return performance.now() - t0;
		}
		const cabecalhoNovo = [];
		const reabLeve = [];
		abrirDoZero(paginas);
		for (let i = 0; i < 10; i++) {
			reabrirCabecalhoNovo(paginas);
			if (leve) {
				reabrirLeve();
			}
		}
		for (let i = 0; i < 40; i++) {
			cabecalhoNovo.push(reabrirCabecalhoNovo(paginas));
			if (leve) {
				reabLeve.push(reabrirLeve());
			}
		}
		const parseDaParte = paginas.map(json => {
			const t = [];
			for (let i = 0; i < 200; i++) {
				const t0 = performance.now();
				JSON.parse(json);
				t.push(performance.now() - t0);
			}
			return estatistica(t);
		});

		const sinc = [];
		const comp = [];
		const reab = [];
		const sincAdmin = [];
		const compAdmin = [];
		let ultimo = null;
		let ultimoAdmin = null;
		for (let i = 0; i < 40; i++) {
			ultimo = abrirDoZero(paginas);
			sinc.push(ultimo.sincrono);
			comp.push(ultimo.completo);
			reab.push(reabrir(paginas));
			ultimoAdmin = abrirDoZero(deAdmin);
			sincAdmin.push(ultimoAdmin.sincrono);
			compAdmin.push(ultimoAdmin.completo);
		}

		const texto = (
			`\n[bancada jsdom] abrir (1a vez, jogador): cartoes no 1o quadro ${ultimo.noPrimeiroQuadro} de ${ultimo.total}` +
				`\n  trecho sincrono (ate o 1o quadro): ${fmt(estatistica(sinc))}` +
				`\n  ate a lista completa:              ${fmt(estatistica(comp))}` +
				`\n[bancada jsdom] reabrir com o MESMO catalogo:   ${fmt(estatistica(reab))}` +
				`\n[bancada jsdom] abrir (1a vez, admin c/ cacaMedida): cartoes no 1o quadro ${ultimoAdmin.noPrimeiroQuadro} de ${ultimoAdmin.total}` +
				`\n  trecho sincrono (ate o 1o quadro): ${fmt(estatistica(sincAdmin))}` +
				`\n  ate a lista completa:              ${fmt(estatistica(compAdmin))}` +
				`\n[bancada jsdom] reabrir com cabecalho NOVO, cheio: ${fmt(estatistica(cabecalhoNovo))}` +
				(leve ? `\n[bancada jsdom] reabrir com cabecalho NOVO, LEVE: ${fmt(estatistica(reabLeve))}` : '') +
				`\n[bancada jsdom] JSON.parse por parte: ${parseDaParte.map((e, i) => `parte ${i + 1} ${e.mediana.toFixed(3)} ms`).join(' · ')}\n`
		);
		// O reporter do vitest engole o `console.log` de caso que passa: o
		// resultado vai direto ao stdout, e a um arquivo quando ha pasta.
		process.stdout.write(texto);

		if (SAIDA) {
			mkdirSync(SAIDA, { recursive: true });
			writeFileSync(join(SAIDA, 'resultado.txt'), texto);
			HuntMap.limparEstadoDoPersonagem();
			HuntMap.toggle();
			for (const json of paginas) {
				catalogo({ json });
			}
			writeFileSync(join(SAIDA, 'mapa-de-caca-primeiro-quadro.html'), HuntMap._host.innerHTML);
			terminar();
			writeFileSync(join(SAIDA, 'mapa-de-caca-completo.html'), HuntMap._host.innerHTML);
			HuntMap.limparEstadoDoPersonagem();
			HuntMap.toggle();
			for (const json of deAdmin) {
				catalogo({ json });
			}
			terminar();
			writeFileSync(join(SAIDA, 'mapa-de-caca-admin-completo.html'), HuntMap._host.innerHTML);
		}

		// CONTROLE: a janela desenhou de verdade — tempo de janela vazia nao
		// mede nada ("criterio que passa com zero").
		expect(ultimo.total).toBeGreaterThan(100);
		expect(ultimoAdmin.total).toBeGreaterThan(100);
	}, 300_000);
});
