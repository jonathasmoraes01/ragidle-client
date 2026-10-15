/**
 * O FILTRO POR CLASSE DENTRO DO MAPA DE CACA (J7, 15/10/2026, D-2470): o
 * componente de verdade (`HuntMap.js` + `HuntMap.html`) no jsdom, com rede
 * falsa e o arquivo `classes-dos-itens.json` PUBLICADO lido do disco.
 *
 * A resposta esperada de cada caso sai de uma conta independente sobre o JSON
 * cru (itens -> conjuntos -> classes), e nao do modulo que se prova.
 *
 * O jsdom nao faz leiaute: o que e de TELA (44 px no dedo, o seletor quebrando
 * de linha no celular) e conferido no CSS e na verificacao em tela.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { catalogoPequeno, comBlocoNoFio } from '../fixtures/huntMapCatalogo.js';

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
	nomeLocalDoItem: (id, fallback) => `Item ${id}`
}));

const PUBLICADO = JSON.parse(readFileSync('public/ragidle/classes-dos-itens.json', 'utf8'));

/** A conta independente: o conjunto de classes (indices) que usam o item, ou null. */
const classesQueUsam = itemId => {
	const conjunto = PUBLICADO.itens[String(itemId)];
	return conjunto === undefined ? null : PUBLICADO.conjuntos[conjunto];
};
const indiceDe = id => PUBLICADO.classes.indexOf(id);

/** Os ids de drop de um mapa do catalogo (monstros + MVP). */
const idsDoMapa = mapa =>
	(mapa.monstros || []).concat(mapa.mvp ? [mapa.mvp] : []).flatMap(m => m.drops.filter(d => typeof d === 'number'));

/** Os mapas do catalogo que tem equipamento que a classe usa (a resposta certa). */
const mapasDaClasse = (catalogo, indice) =>
	catalogo.mapas.filter(m => idsDoMapa(m).some(id => (classesQueUsam(id) || []).includes(indice))).map(m => m.mapa);

let HuntMap;
let PACKET;

async function montar() {
	vi.resetModules();
	mocks.hooks.length = 0;
	mocks.enviados.length = 0;
	localStorage.clear();
	vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => PUBLICADO }));
	({ default: PACKET } = await import('Network/PacketStructure.js'));
	({ default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js'));
	const { default: html } = await import('UI/Components/HuntMap/HuntMap.html?raw');
	HuntMap._host = document.createElement('div');
	HuntMap._host.innerHTML = html;
	HuntMap._shadow = null;
	HuntMap.focus = () => {};
	HuntMap.draggable = () => {};
	HuntMap.init();
	// A carga do arquivo e uma promessa: deixa ela terminar.
	await new Promise(r => setTimeout(r, 0));
}

const gancho = nome => mocks.hooks.find(h => h.pkt === PACKET.ZC[nome]).cb;
const q = s => HuntMap._host.querySelector(s);
const qq = s => Array.from(HuntMap._host.querySelectorAll(s));
const cartoes = () => qq('.hm-card').map(c => c.dataset.mapa);

function abrirCom(cat) {
	HuntMap.toggle();
	gancho('RAGIDLE_CATALOGO')({ json: JSON.stringify(comBlocoNoFio(cat, cat.mapas)) });
	HuntMap._terminarLista();
}

function chegarOutroCatalogo() {
	const cat = catalogoPequeno();
	gancho('RAGIDLE_CATALOGO')({ json: JSON.stringify(comBlocoNoFio(cat, cat.mapas)) });
	HuntMap._terminarLista();
}

function escolherClasse(indice) {
	const select = q('.hm-classe');
	select.value = String(indice);
	select.dispatchEvent(new Event('change'));
	HuntMap._terminarLista();
}

beforeEach(montar);
afterEach(() => vi.unstubAllGlobals());

describe('o seletor de classe', () => {
	it('nasce com o arquivo, ao lado da ordem: "Todas" e as 20 classes jogaveis, em portugues', () => {
		const select = q('.hm-classe');
		expect(select).not.toBeNull();
		expect(qq('.hm-classe option')).toHaveLength(21);
		expect(select.querySelector('option').textContent).toBe('Todas');
		expect(qq('.hm-classe option').map(o => o.textContent)).toContain('Espadachim');
		// Ao lado do seletor de ordem, e nao dentro dele.
		expect(q('.hm-sort-wrap').nextElementSibling).toBe(q('.hm-classe-wrap'));
		expect(qq('.hm-sort option')).toHaveLength(3);
	});

	it('SEM o arquivo (rede falhou) o seletor nao existe: a tela e a de hoje', async () => {
		vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.resetModules();
		mocks.hooks.length = 0;
		({ default: HuntMap } = await import('UI/Components/HuntMap/HuntMap.js'));
		const { default: html } = await import('UI/Components/HuntMap/HuntMap.html?raw');
		HuntMap._host = document.createElement('div');
		HuntMap._host.innerHTML = html;
		HuntMap._shadow = null;
		HuntMap.focus = () => {};
		HuntMap.draggable = () => {};
		HuntMap.init();
		await new Promise(r => setTimeout(r, 0));
		expect(q('.hm-classe')).toBeNull();
		expect(q('.hm-classe-wrap')).toBeNull();
	});
});

describe('a lista com a classe escolhida', () => {
	it('mostra so os mapas que dropam equipamento da classe (conta independente sobre o JSON cru)', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		const antes = cartoes();
		const resultados = {};
		for (const id of ['Swordman', 'Mage', 'Archer', 'Acolyte']) {
			const indice = indiceDe(id);
			escolherClasse(indice);
			resultados[id] = cartoes();
			expect(new Set(resultados[id]), id).toEqual(new Set(mapasDaClasse(cat, indice)));
		}
		// Sanidade do caso: o fixture tem equipamento, e o filtro CORTA mapas (nao devolve tudo).
		expect(Object.values(resultados).some(r => r.length > 0 && r.length < antes.length)).toBe(true);
		escolherClasse(-1);
		expect(cartoes()).toEqual(antes);
	});

	it('procura no jogo inteiro: a regiao e o "Para mim" em que a janela estava nao cortam', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		const indice = indiceDe('Swordman');
		const esperado = new Set(mapasDaClasse(cat, indice));
		// "Para mim" corta pelo nivel; com a classe, a lista tem de ser a do jogo todo.
		q('.hm-seg-btn[data-modo="ideais"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		HuntMap._terminarLista();
		escolherClasse(indice);
		expect(new Set(cartoes())).toEqual(esperado);
	});

	it('procura no jogo inteiro tambem na ABA de regiao: a regiao escolhida nao corta', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		const indice = PUBLICADO.classes.map((_, i) => i).find(i => {
			const regioes = new Set(mapasDaClasse(cat, i).map(m => cat.mapas.find(x => x.mapa === m).regiao));
			return regioes.size >= 2;
		});
		// O fixture tem equipamento de uma classe em duas regioes, ou o caso nao mede nada.
		expect(indice, 'nenhuma classe tem equipamento em duas regioes no fixture').toBeDefined();
		HuntMap.activeTab = 'Payon';
		escolherClasse(indice);
		expect(new Set(cartoes())).toEqual(new Set(mapasDaClasse(cat, indice)));
		const regioesNaLista = new Set(cartoes().map(m => cat.mapas.find(x => x.mapa === m).regiao));
		expect(regioesNaLista.size).toBeGreaterThanOrEqual(2);
	});

	it('o contador diz a classe e o cartao diz QUAIS itens trouxeram o mapa', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		const indice = indiceDe('Swordman');
		escolherClasse(indice);
		const quais = cartoes();
		expect(quais.length).toBeGreaterThan(0);
		expect(q('.hm-count').textContent).toContain('com equipamento para Espadachim');
		const mapa = cat.mapas.find(m => m.mapa === quais[0]);
		const doMapa = idsDoMapa(mapa).find(id => (classesQueUsam(id) || []).includes(indice));
		expect(q(`.hm-card[data-mapa="${quais[0]}"] .hm-card-hit`).textContent).toContain(`Item ${doMapa}`);
	});

	it('classe sem equipamento em nenhum mapa: lista vazia com a mensagem da classe', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		// Procura uma classe que nenhum mapa do fixture atende; se todas atendem, o caso nao se aplica.
		const semNada = PUBLICADO.classes.map((_, i) => i).find(i => mapasDaClasse(cat, i).length === 0);
		if (semNada === undefined) return;
		escolherClasse(semNada);
		expect(cartoes()).toEqual([]);
		expect(q('.hm-list').textContent).toContain('Nenhum mapa tem equipamento para essa classe.');
	});

	it('a classe nao atravessa a troca de personagem: o filtro zera e o seletor volta a "Todas"', () => {
		abrirCom(catalogoPequeno());
		escolherClasse(indiceDe('Swordman'));
		expect(HuntMap.filterClasse).toBe(indiceDe('Swordman'));
		HuntMap.limparEstadoDoPersonagem();
		expect(HuntMap.filterClasse).toBe(-1);
		// O catalogo do outro personagem chega e a lista e a de todos os mapas.
		chegarOutroCatalogo();
		expect(q('.hm-classe').value).toBe('-1');
	});
});

describe('o dossie com a classe escolhida', () => {
	it('lista os equipamentos da classe naquele mapa, e some sem classe', () => {
		const cat = catalogoPequeno();
		abrirCom(cat);
		const indice = indiceDe('Swordman');
		escolherClasse(indice);
		const mapa = cat.mapas.find(m => m.mapa === cartoes()[0]);
		const ids = idsDoMapa(mapa).filter(id => (classesQueUsam(id) || []).includes(indice));
		expect(ids.length).toBeGreaterThan(0);
		HuntMap.selectedMapa = mapa.mapa;
		// A ficha do mapa: os mesmos drops, agora como objetos com chance.
		gancho('RAGIDLE_MONSTROS')({
			json: JSON.stringify({
				v: 3,
				mapa: mapa.mapa,
				monstros: mapa.monstros.map(m => ({
					mobId: m.mobId,
					nome: m.nome,
					nivel: 1,
					raca: 'Brute',
					elemento: 'Neutral',
					nivelDoElemento: 1,
					drops: m.drops.map(id => ({ itemId: id, nome: `Item ${id}`, chance: 100, raridade: 1 }))
				})),
				mvp: null
			})
		});
		const painel = q('.hm-panel-scroll');
		expect(painel.textContent).toContain('Equipamento para Espadachim');
		const secao = Array.from(painel.querySelectorAll('.hm-section')).find(s => s.textContent.includes('Equipamento para'));
		expect(secao.querySelector('.hm-section-n').textContent).toBe(String(new Set(ids).size));
		// Os ladrilhos da secao sao os itens da classe, e so eles.
		const grade = secao.nextElementSibling;
		const dosLadrilhos = Array.from(grade.querySelectorAll('.hm-drop[data-item-id]')).map(b => Number(b.dataset.itemId));
		expect(new Set(dosLadrilhos)).toEqual(new Set(ids));
		escolherClasse(-1);
		expect(q('.hm-panel-scroll').textContent).not.toContain('Equipamento para');
	});
});
