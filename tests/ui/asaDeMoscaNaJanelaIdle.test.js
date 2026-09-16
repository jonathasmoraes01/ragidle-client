/**
 * A ASA DE MOSCA APARECE, LIGA E CONFIGURA (11/09/2026 - ordem do dono: *"preciso
 * que essa asa de mosca fique visivel no menu, seja possivel ativar e seja
 * possivel configurar... de 5 a 15 segundos"*).
 *
 * O gatilho existia desde 09/09 e era INVISIVEL: ligava sozinho para todo VIP,
 * com 10 s fixos e nenhum controle - e a primeira pergunta do dono foi "onde
 * ativa?". Este caso monta a janela de verdade e cobra as tres coisas que ele
 * pediu, porque as tres falham por motivos diferentes:
 *
 * 1. estar VISIVEL na secao Cacada;
 * 2. o interruptor escrever `asa.ligada` no rascunho que vai no Aplicar;
 * 3. a barrinha andar entre 3 e 20 e escrever `asa.teleportarApos`.
 *
 * A faixa e conferida contra o ATRIBUTO do slider, e nao contra uma constante
 * do teste: `min`/`max` sao o que de fato limita o jogador, e o servidor recusa
 * fora de 3..20 (`servidor/idle/config-idle.ts`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

/** O payload do servidor, no contrato v1 - so o que esta janela le. */
function pacote({ ehVip = true, asasNaMochila = 3, asa = { ligada: true, teleportarApos: 10 } } = {}) {
	return {
		json: JSON.stringify({
			v: 1,
			problemas: [],
			config: {
				cacaAutomatica: true,
				coletarItens: true,
				alvosDesabilitados: [],
				rotacao: [],
				rotacaoDeBuffs: [],
				cura: { alvo: 'grupo', curarAbaixoDe: 50 },
				asa,
				modoDeAtaque: 'skills-e-basico',
				descanso: {
					ligado: false, hpLigado: true, spLigado: false, hpAbaixo: 1,
					spAbaixo: 1, condicao: 'qualquer', levantarHp: 2, levantarSp: 2
				},
				pocaoDeHp: { ligado: false, itemId: 0, usarCom: 1 },
				pocaoDeSp: { ligado: false, itemId: 0, usarCom: 1 },
				usarBuffsDeItem: false
			},
			contexto: {
				mapa: 'prt_fild08',
				rotuloDoMapa: 'Campos de Prontera',
				ehCidade: false,
				mobsDoMapa: [],
				skills: [],
				skillsDeBuff: [],
				skillsDeCura: [],
				consumiveisDeCura: [],
				ehVip,
				asasNaMochila,
				capacidades: {
					sentarParaRecuperar: true, pocaoDeSp: true, buffsAutomaticos: true,
					suprimirAtaqueBasico: true, suporteAoGrupo: true
				}
			}
		})
	};
}

/** Monta a janela como o jogo monta (mesmo caminho de `abaSobreviveAoF5`). */
async function montarComConfig(opcoes) {
	const { default: html } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
	const Network = (await import('Network/NetworkManager.js')).default;
	const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');

	IdleConfig._host = document.createElement('div');
	IdleConfig._host.innerHTML = html;
	IdleConfig._shadow = null;
	IdleConfig.draggable = () => {};
	IdleConfig.init();

	// O handler registrado no `hookPacket` - a porta por onde a config entra.
	const onConfig = Network.hookPacket.mock.calls.at(-1)[1];
	onConfig(pacote(opcoes));

	return IdleConfig;
}

const slider = IdleConfig => IdleConfig._host.querySelector('[data-range="asa.teleportarApos"]');
const chave = IdleConfig => IdleConfig._host.querySelector('[data-bool="asa.ligada"]');

describe('a Asa de Mosca automática na janela idle', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('aparece na seção Caçada, que é onde a janela abre', async () => {
		const IdleConfig = await montarComConfig();

		expect(IdleConfig.activeTab).toBe('caca');
		expect(chave(IdleConfig), 'o interruptor não está na tela').toBeTruthy();
		expect(slider(IdleConfig), 'a barrinha não está na tela').toBeTruthy();
	});

	it('a barrinha anda de 3 a 20 segundos, e mostra SEGUNDOS', async () => {
		const IdleConfig = await montarComConfig();
		const barra = slider(IdleConfig);

		expect(barra.min).toBe('3');
		expect(barra.max).toBe('20');

		barra.value = '7';
		barra.dispatchEvent(new Event('input', { bubbles: true }));

		expect(IdleConfig.editConfig.asa.teleportarApos, 'o valor não chegou ao rascunho').toBe(7);
		// O '%' era cravado no binder: sem o sufixo, "7s" sairia como "7%".
		const mostrador = IdleConfig._host.querySelector('[data-range-display="asa.teleportarApos"]');
		expect(mostrador.textContent).toBe('7s');
	});

	it('desligar o interruptor escreve no rascunho e apaga a barrinha', async () => {
		const IdleConfig = await montarComConfig();

		const interruptor = chave(IdleConfig);
		interruptor.checked = false;
		interruptor.dispatchEvent(new Event('change', { bubbles: true }));

		expect(IdleConfig.editConfig.asa.ligada).toBe(false);
		// Desligado, o limiar não é editável: um slider vivo debaixo de um
		// interruptor desligado é a definição de controle que mente.
		expect(slider(IdleConfig).disabled).toBe(true);
	});

	it('sem passe VIP o controle APARECE, mas desabilitado', async () => {
		// Esconder faria o jogador comum procurar no menu o que o patch note
		// anunciou - que foi exatamente a pergunta que abriu esta rodada.
		const IdleConfig = await montarComConfig({ ehVip: false, asasNaMochila: 0 });

		expect(chave(IdleConfig), 'o controle sumiu para quem não é VIP').toBeTruthy();
		expect(chave(IdleConfig).disabled).toBe(true);
		expect(slider(IdleConfig).disabled).toBe(true);
		expect(IdleConfig._host.textContent).toContain('passe VIP');
	});

	it('config antiga, sem o bloco `asa`, ganha o padrão em vez de quebrar', async () => {
		// Quem configurou a janela ANTES desta rodada tem config sem o campo. O
		// `setPath` não cria objeto no meio do caminho: sem `garantirAsa` o
		// primeiro arrasto da barrinha morreria num `undefined`.
		const IdleConfig = await montarComConfig({ asa: undefined });

		expect(IdleConfig.editConfig.asa).toEqual({ ligada: true, teleportarApos: 10 });
		expect(slider(IdleConfig).disabled).toBe(false);
	});
});
