/**
 * A CAIXA COMO PREMIO DO PASSE, NA JANELA DE VERDADE (01/10/2026, o Passe de
 * Batalha VIP da S1).
 *
 * `formatoDaTemporada.test.js` mede o card (a string). Este mede o que so a
 * janela montada responde, com o HTML real do componente e o `init()` de
 * verdade (o molde de `abaSobreviveAoF5.test.js`):
 *
 *  1. a DICA do card de caixa aparece no hover (o seletor da janela tem de
 *     conhecer o `data-caixa`) e o clique nele NAO abre a janela de detalhes de
 *     item nenhum - nao ha item;
 *  2. o "Resgatar" da caixa manda o resgate de sempre (nivel + trilha), e o
 *     estado que o servidor devolve DEPOIS dele chega a aba Caixas e ao resumo
 *     dos Destaques - a contagem de fechadas sobe sem a janela pedir nada;
 *  3. o card de ITEM continua com a dica de item e o clique de detalhes;
 *  4. a compra do Passe de Batalha VIP com a venda aberta: o botao acende,
 *     pergunta antes de gastar, manda o verbo, e o resultado vira aviso.
 *
 * O jsdom nao tem leiaute: aqui nao se mede enquadramento nem toque. Isso e da
 * prova de tela (desktop e celular em pe), e alguem precisa olhar os PNGs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('DB/DBManager.js', () => ({
	default: {
		INTERFACE_PATH: '',
		getItemInfo: vi.fn(() => ({ identifiedDescriptionName: 'Uma asa azul de fada.', identifiedResourceName: '' }))
	}
}));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({
	default: { uid: null, append: vi.fn(), remove: vi.fn(), setItem: vi.fn() }
}));

const TEXTO_DO_SERVIDOR = 'Caixa Topo creditada: abra em Caixas da temporada.';

function caixaDoEstado(fechadas) {
	return {
		pool: 'TOP',
		sku: 'VISUAL_TOP_BOX_S1',
		nome: 'Caixa Topo',
		slot: 'Topo',
		precoMinor: 1000,
		fechadas,
		compra: { pode: false, motivo: 'saldo-insuficiente', texto: 'Saldo insuficiente.' },
		pity: { contador: 0, garantia: 40, faltam: 40, garantidoNaProxima: false },
		recompensas: [{ itemId: 9000300, nome: 'Asas de Anjo', raridade: 'COMMON', slot: 'Topo' }]
	};
}

function trilhaVip(extra = {}) {
	return { liberada: true, precoMinor: 1500, aVenda: true, compra: { pode: false, motivo: 'ja-comprado', texto: null }, ...extra };
}

/** O estado como o servidor o manda (v: 3), com UMA caixa e o premio de caixa no nivel 10 da VIP. */
function estado({ fechadas = 0, situacaoDaCaixa = 'AVAILABLE', trilha = trilhaVip(), resultado = null } = {}) {
	return {
		v: 3,
		temporada: { id: 'S1', nome: 'Luz & Trevas', subtitulo: 'Herdeiros de Midgard', aberta: true },
		moeda: { saldoMinor: 5000 },
		caixas: [caixaDoEstado(fechadas)],
		vip: { ativo: false, diasRestantes: 0 },
		passe: {
			niveis: 30,
			xp: 10000,
			nivel: 10,
			xpPorNivel: 1000,
			xpNoNivel: 0,
			tetoDiarioDeCaca: 400,
			xpDeCacaHoje: 0,
			vip: trilha.liberada,
			trilhaVip: trilha,
			diasRestantes: null,
			diarias: { objetivos: [], queContam: 3, xpPorObjetivo: 200, concluidas: 0, xpHoje: 0, tetoDeXp: 600 },
			semanais: null,
			premios: [
				{ nivel: 10, trilha: 'free', itemId: 2254, caixa: null, nome: 'Asas Azuis de Fada', quantidade: 1, animado: false, situacao: 'AVAILABLE' },
				{
					nivel: 10,
					trilha: 'vip',
					itemId: null,
					caixa: { pool: 'TOP', slot: 'Topo' },
					nome: 'Caixa Topo',
					quantidade: 1,
					animado: false,
					situacao: situacaoDaCaixa
				}
			]
		},
		resultado
	};
}

async function montarJanela() {
	const { default: html } = await import('UI/Components/TemporadaIdle/TemporadaIdle.html?raw');
	const { default: TemporadaIdle } = await import('UI/Components/TemporadaIdle/TemporadaIdle.js');
	const { default: Network } = await import('Network/NetworkManager.js');
	const { default: PACKET } = await import('Network/PacketStructure.js');
	const { default: ItemInfo } = await import('UI/Components/ItemInfo/ItemInfo.js');

	TemporadaIdle._host = document.createElement('div');
	TemporadaIdle._host.innerHTML = html;
	TemporadaIdle._shadow = null;
	document.body.appendChild(TemporadaIdle._host);
	TemporadaIdle.init();
	TemporadaIdle._host.querySelector('.te-window').classList.add('is-open');

	const gancho = Network.hookPacket.mock.calls.find(([pkt]) => pkt === PACKET.ZC.RAGIDLE_TEMPORADA);
	expect(gancho, 'a janela nao ligou o ZC da temporada').toBeTruthy();
	const receber = dados => gancho[1]({ json: JSON.stringify(dados) });
	const raiz = TemporadaIdle._host;
	const acoesEnviadas = () =>
		Network.sendPacket.mock.calls.map(([pkt]) => pkt && pkt.json).filter(Boolean).map(j => JSON.parse(j));
	return { TemporadaIdle, raiz, receber, acoesEnviadas, ItemInfo, Network };
}

function clicar(el) {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function irPara(raiz, aba) {
	clicar(raiz.querySelector(`.te-tab[data-tab="${aba}"]`));
}

describe('a caixa como premio do passe, na janela montada', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.innerHTML = '';
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('o card de caixa: arte da caixa, sem data-item-id, dica no hover, e o clique nao abre detalhe de item', async () => {
		const { raiz, receber, ItemInfo, acoesEnviadas } = await montarJanela();
		receber(estado());
		irPara(raiz, 'passe');

		const card = raiz.querySelector('.te-premio-card[data-caixa="TOP"]');
		expect(card, 'o card da caixa nao foi desenhado').not.toBeNull();
		expect(card.hasAttribute('data-item-id')).toBe(false);
		expect(card.querySelector('[data-item-id]')).toBeNull();
		expect(card.querySelector('img.te-premio-caixa-img').getAttribute('src')).toBe('/ragidle/temporada/icone-caixa-topo.webp');

		const dica = raiz.querySelector('.te-dica');
		expect(dica.hidden).toBe(true);
		card.querySelector('.te-premio-card-nome').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(dica.hidden, 'a dica da caixa nao abriu no hover').toBe(false);
		expect(dica.textContent).toContain('Caixa Topo');
		expect(dica.textContent).toContain('Vai para as suas caixas da temporada');
		expect(dica.textContent).not.toContain('Clique para ver os detalhes');

		clicar(card.querySelector('.te-premio-card-nome'));
		expect(ItemInfo.append).not.toHaveBeenCalled();
		expect(acoesEnviadas().filter(a => a.acao === 'resgatar')).toEqual([]);
	});

	it('o card de ITEM nao mudou: dica de item com o convite, e o clique abre os detalhes', async () => {
		const { raiz, receber, ItemInfo } = await montarJanela();
		receber(estado());
		irPara(raiz, 'passe');

		const card = raiz.querySelector('.te-premio-card[data-item-id="2254"]');
		expect(card).not.toBeNull();
		card.querySelector('.te-premio-card-nome').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		const dica = raiz.querySelector('.te-dica');
		expect(dica.hidden).toBe(false);
		expect(dica.textContent).toContain('Uma asa azul de fada.');
		expect(dica.textContent).toContain('Clique para ver os detalhes');

		clicar(card.querySelector('.te-premio-card-nome'));
		expect(ItemInfo.append).toHaveBeenCalledTimes(1);
	});

	it('o resgate da caixa: manda nivel + trilha, e o estado de volta sobe a contagem nas Caixas e nos Destaques', async () => {
		const { raiz, receber, acoesEnviadas } = await montarJanela();
		receber(estado({ fechadas: 0 }));

		/* CONTROLE: antes do resgate a caixa esta com zero fechadas nas duas abas */
		irPara(raiz, 'caixas');
		expect(raiz.querySelector('.te-caixa[data-pool="TOP"] .te-caixa-fechadas strong').textContent).toBe('0');
		irPara(raiz, 'passe');

		const botao = raiz.querySelector('.te-premio-card[data-caixa="TOP"] [data-agir="resgatar"]');
		expect(botao, 'o card da caixa AVAILABLE nao tem o Resgatar').not.toBeNull();
		clicar(botao);
		expect(acoesEnviadas()).toContainEqual({ acao: 'resgatar', nivel: 10, trilha: 'vip' });

		receber(
			estado({
				fechadas: 1,
				situacaoDaCaixa: 'CLAIMED',
				resultado: {
					acao: 'resgatar',
					ok: true,
					texto: TEXTO_DO_SERVIDOR,
					resgate: { nivel: 10, trilha: 'vip', itemId: null, caixa: 'TOP', nome: 'Caixa Topo' }
				}
			})
		);

		expect(raiz.querySelector('.te-aviso').textContent).toBe(TEXTO_DO_SERVIDOR);
		expect(raiz.querySelector('.te-premio-card[data-caixa="TOP"] .is-resgatado'), 'o card nao virou resgatado').not.toBeNull();

		irPara(raiz, 'caixas');
		expect(raiz.querySelector('.te-caixa[data-pool="TOP"] .te-caixa-fechadas strong').textContent).toBe('1');
		const abrir = raiz.querySelector('.te-caixa[data-pool="TOP"] [data-agir="abrir-caixa"]');
		expect(abrir.disabled).toBe(false);
		expect(abrir.textContent).toBe('Abrir (1)');

		irPara(raiz, 'destaques');
		expect(raiz.querySelector('.te-resumo-caixa[data-pool="TOP"] .te-resumo-caixa-contagem').textContent).toBe('1');
	});

	it('a compra do Passe de Batalha VIP com a venda aberta: acende, confirma antes de gastar, manda o verbo e avisa', async () => {
		const { raiz, receber, acoesEnviadas } = await montarJanela();
		const aVenda = trilhaVip({ liberada: false, compra: { pode: true, motivo: null, texto: null } });
		receber(estado({ trilha: aVenda }));
		irPara(raiz, 'passe');

		const botao = raiz.querySelector('.te-passe-vip-comprar');
		expect(botao.disabled).toBe(false);
		expect(botao.textContent).toBe('Comprar · 15 RO Cash');

		clicar(botao);
		/* nada sai antes da confirmacao */
		expect(acoesEnviadas().filter(a => a.acao === 'comprar-passe-vip')).toEqual([]);
		const modal = raiz.querySelector('.te-modal--confirmar');
		expect(modal.hidden).toBe(false);
		expect(modal.querySelector('.te-confirmar-texto').textContent).toContain('Passe de Batalha VIP');

		clicar(modal.querySelector('.te-confirmar-ok'));
		const compras = acoesEnviadas().filter(a => a.acao === 'comprar-passe-vip');
		expect(compras).toHaveLength(1);
		expect(typeof compras[0].chave).toBe('string');
		expect(compras[0].chave.length).toBeGreaterThanOrEqual(16);

		receber(
			estado({
				trilha: trilhaVip({ liberada: true }),
				resultado: { acao: 'comprar-passe-vip', ok: true, texto: 'Passe de Batalha VIP liberado.' }
			})
		);
		expect(raiz.querySelector('.te-aviso').textContent).toBe('Passe de Batalha VIP liberado.');
		expect(raiz.querySelector('.te-passe-vip-compra')).toBeNull();
		expect(raiz.querySelector('.te-reward-scroll').classList.contains('is-sem-vip')).toBe(false);
	});

	it('a venda aberta SEM saldo: o botao fica apagado com o preco e o texto do servidor, e o clique nao pergunta nada', async () => {
		const { raiz, receber } = await montarJanela();
		const semSaldo = trilhaVip({
			liberada: false,
			compra: { pode: false, motivo: 'saldo-insuficiente', texto: 'Faltam 10 RO Cash.' }
		});
		receber(estado({ trilha: semSaldo }));
		irPara(raiz, 'passe');

		const botao = raiz.querySelector('.te-passe-vip-comprar');
		expect(botao.disabled).toBe(true);
		expect(botao.textContent).toBe('15 RO Cash');
		expect(raiz.querySelector('.te-passe-vip-compra-dica').textContent).toBe('Faltam 10 RO Cash.');
		clicar(botao);
		expect(raiz.querySelector('.te-modal--confirmar').hidden).toBe(true);
	});
});
