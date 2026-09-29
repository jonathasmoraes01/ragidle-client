/**
 * A BANCADA DE DESEMPENHO da janela "Seus mapas" contra o Mapa de Caca
 * (contrato da Caca Medida, secao 6: *"abrir e desenhar em menos tempo que o
 * Mapa de Caca"*).
 *
 * Ela so roda com o catalogo REAL na mao, e por isso pula na suite normal:
 *
 *   RAG_BENCH_CATALOGO=<paginas.json> npx vitest run tests/ui/cacaMedidaBancada.test.js
 *
 * `<paginas.json>` e um array com as strings JSON das paginas do
 * `ZC_RAGIDLE_CATALOGO`, como o servidor as manda (`paginarCatalogo` sobre o
 * `montarCatalogo` do `conteudo.json`). Com `RAG_BENCH_SAIDA=<pasta>` ela
 * tambem grava o HTML final das duas janelas, para a medicao no Chromium.
 *
 * O INSTRUMENTO e `performance.now()` no **jsdom**: ele mede o trabalho de JS
 * e de construcao do DOM (ler o pacote, filtrar, ordenar, montar a string, o
 * `innerHTML`), e NAO mede estilo, leiaute nem pintura — o jsdom nao tem
 * nenhum dos tres. Numero daqui nao descreve o celular; descreve o custo de JS
 * das duas janelas na mesma maquina, lado a lado.
 */
import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { estadoComNMapas } from '../fixtures/cacaMedidaEstado.js';

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

const fmt = s => `mediana ${s.mediana.toFixed(3)} ms · p95 ${s.p95.toFixed(3)} ms · min ${s.min.toFixed(3)} ms (n=${s.n})`;

describe.skipIf(!ligada)('bancada: Seus mapas contra o Mapa de Caca (jsdom)', () => {
	it('mede as duas janelas com o mesmo relogio', async () => {
		const paginas = JSON.parse(readFileSync(CATALOGO, 'utf8'));
		const { default: PACKET } = await import('Network/PacketStructure.js');

		/* --- o Mapa de Caca, com o HTML e o codigo de verdade --- */
		const { default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js');
		const { default: htmlDoMapa } = await import('UI/Components/HuntMap/HuntMap.html?raw');
		HuntMap._host = document.createElement('div');
		HuntMap._host.innerHTML = htmlDoMapa;
		HuntMap._shadow = null;
		const catalogo = mocks.hooks.find(h => h.pkt === PACKET.ZC.RAGIDLE_CATALOGO).cb;
		const chegarCatalogo = () => {
			for (const json of paginas) {
				catalogo({ json });
			}
		};

		/* --- a janela nova, com o HTML e o codigo de verdade --- */
		const { default: CacaMedidaIdle } = await import('UI/Components/CacaMedidaIdle/CacaMedidaIdle.js');
		const { default: htmlDaJanela } = await import('UI/Components/CacaMedidaIdle/CacaMedidaIdle.html?raw');
		CacaMedidaIdle._host = document.createElement('div');
		CacaMedidaIdle._host.innerHTML = htmlDaJanela;
		CacaMedidaIdle._shadow = null;
		CacaMedidaIdle.__active = true;
		CacaMedidaIdle.focus = () => {};
		const pacote = mocks.hooks.find(h => h.pkt === PACKET.ZC.RAGIDLE_CACA_MEDIDA).cb;
		const json30 = JSON.stringify({ ...estadoComNMapas(30), abrir: true });
		const abrirJanela = () => {
			CacaMedidaIdle.limparEstadoDoPersonagem(); // fecha: a proxima chegada ABRE
			pacote({ json: json30 });
		};

		/* aquecimento, que o JIT nao entra na conta */
		for (let i = 0; i < 20; i++) {
			chegarCatalogo();
			abrirJanela();
		}

		/* intercalado: a mesma carga de maquina pega as duas */
		const mapa = [];
		const nova = [];
		for (let i = 0; i < 100; i++) {
			let t = performance.now();
			chegarCatalogo();
			mapa.push(performance.now() - t);
			t = performance.now();
			abrirJanela();
			nova.push(performance.now() - t);
		}
		const sMapa = estatistica(mapa);
		const sNova = estatistica(nova);

		const bytesCatalogo = paginas.reduce((s, p) => s + Buffer.byteLength(p, 'utf8'), 0);
		const cartoesDoMapa = HuntMap._host.querySelectorAll('.hm-card').length;
		const cartoesDaNova = CacaMedidaIdle._host.querySelectorAll('.cm-cartao').length;
		console.log(
			`\n[bancada jsdom] Mapa de Caca (${paginas.length} paginas, ${bytesCatalogo} bytes, ${cartoesDoMapa} cartoes): ${fmt(sMapa)}` +
				`\n[bancada jsdom] Seus mapas   (1 pacote, ${Buffer.byteLength(json30, 'utf8')} bytes, ${cartoesDaNova} cartoes): ${fmt(sNova)}` +
				`\n[bancada jsdom] razao das medianas: ${(sMapa.mediana / sNova.mediana).toFixed(1)}x`
		);

		if (SAIDA) {
			mkdirSync(SAIDA, { recursive: true });
			writeFileSync(join(SAIDA, 'mapa-de-caca.html'), HuntMap._host.innerHTML);
			writeFileSync(join(SAIDA, 'seus-mapas.html'), CacaMedidaIdle._host.innerHTML);
		}

		// CONTROLE: as duas desenharam de verdade — tempo de janela vazia nao
		// mede nada ("criterio que passa com zero").
		expect(cartoesDoMapa).toBeGreaterThan(100);
		expect(cartoesDaNova).toBe(30);
		expect(sNova.mediana).toBeLessThan(sMapa.mediana);
	}, 180_000);
});
