/**
 * A ASA CONTRA O MONSTRO EVITADO NA JANELA DE VERDADE (D-1983, R103): o
 * interruptor monta na aba Cacada, escreve `asaAoSerAtacadoPorEvitado` no
 * rascunho e, sem VIP, aparece desabilitado com a explicacao. Monta a janela
 * pelo mesmo caminho de `asaDeMoscaNaJanelaIdle.test.js`.
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

const chave = IdleConfig => IdleConfig._host.querySelector('[data-bool="asaAoSerAtacadoPorEvitado"]');

describe('a Asa contra o monstro evitado na janela idle', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('VIP: aparece desligado (o padrao), e ligar escreve no rascunho', async () => {
		const IdleConfig = await montarComConfig();
		const c = chave(IdleConfig);
		expect(c, 'o interruptor nao esta na tela').toBeTruthy();
		expect(c.disabled).toBe(false);
		expect(c.checked).toBe(false);
		c.checked = true;
		c.dispatchEvent(new Event('change', { bubbles: true }));
		expect(IdleConfig.editConfig.asaAoSerAtacadoPorEvitado).toBe(true);
		expect(chave(IdleConfig).checked, 'o redesenho perdeu o valor').toBe(true);
	});

	it('sem passe VIP o controle APARECE, desabilitado, com a explicacao', async () => {
		const IdleConfig = await montarComConfig({ ehVip: false, asasNaMochila: 0 });
		expect(chave(IdleConfig), 'o controle sumiu para quem nao e VIP').toBeTruthy();
		expect(chave(IdleConfig).disabled).toBe(true);
		expect(IdleConfig._host.textContent).toContain('O uso automático da Asa é do passe VIP.');
	});
});
