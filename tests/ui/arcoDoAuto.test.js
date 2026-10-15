/**
 * O ARCO DE SKILLS EM VOLTA DO AUTO (pedido do dono, 15/10/2026, HUD mobile premium): *"o botao ali
 * vermelho seria para ativar e desativar o auto combate e as skills em volta dele seriam as 3 selecionadas
 * no automatico"* - e, nas escolhas do dono, tocar o disco USA a skill na hora.
 *
 * O que se prova aqui:
 *   - quem sao "as 3": o rodizio que o SERVIDOR confirmou (`serverConfig.skills.geral`), na ordem dele, ate
 *     tres, com o nivel resolvido e o "desligada" do rodizio (`rodizioDoAuto.js`);
 *   - o desenho: tres discos sempre, o icone publicado, o "+" que leva ao menu do Bot, e nenhum `src=""`
 *     (que faria o navegador pedir a propria pagina) (`arcoDeSkills.js`);
 *   - a costura, com as pecas REAIS (BotMenu + CombatCornerIdle) e o pacote no formato do
 *     `ZC_RAGIDLE_BOT`: o rodizio chega com a janela do Bot fechada, o toque usa pelo caminho da barra, o
 *     disco vazio abre o Bot, e a recarga da barra acende o relogio do disco certo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TETO_DO_ARCO, assinaturaDoRodizio, rodizioDoAuto } from 'UI/Components/BotMenu/rodizioDoAuto.js';
import { acaoDoToque, desenharArco, iconeDaSkill, slotsDoArco } from 'UI/Components/CombatCornerIdle/arcoDeSkills.js';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('DB/DBManager.js', () => ({ default: { getItemInfo: () => ({ identifiedDisplayName: 'Unknown Item' }) } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 << 6 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const SKILLS = [
	{ skillId: 46, nome: 'Rajada de Flechas', chave: 'AC_DOUBLE', aprendido: 10, aceita: true },
	{ skillId: 47, nome: 'Chuva de Flechas', chave: 'AC_SHOWER', aprendido: 8, aceita: true },
	{ skillId: 129, nome: 'Ataque do Falcao', chave: 'HT_BLITZBEAT', aprendido: 5, aceita: true },
	{ skillId: 130, nome: 'Detectar', chave: 'HT_DETECTING', aprendido: 4, aceita: true }
];

function estado(geral, porSkill = {}, skills = SKILLS) {
	return { serverConfig: { skills: { geral, porSkill, porMonstro: {} } }, skills };
}

describe('rodizioDoAuto - quem sao "as 3 selecionadas no automatico"', () => {
	it('sem estado, sem config ou sem rodizio: nenhuma', () => {
		expect(rodizioDoAuto(null)).toEqual([]);
		expect(rodizioDoAuto({ serverConfig: null })).toEqual([]);
		expect(rodizioDoAuto(estado([]))).toEqual([]);
	});

	it('a ordem do rodizio, ate o teto de tres', () => {
		const itens = rodizioDoAuto(
			estado([
				{ skillId: 47, nivel: 'aprendido' },
				{ skillId: 46, nivel: 'aprendido' },
				{ skillId: 130, nivel: 'aprendido' },
				{ skillId: 129, nivel: 'aprendido' }
			])
		);
		expect(TETO_DO_ARCO).toBe(3);
		expect(itens.map(i => i.skillId)).toEqual([47, 46, 130]);
		expect(itens[0]).toEqual({ skillId: 47, nome: 'Chuva de Flechas', chave: 'AC_SHOWER', nivel: 8, ativa: true });
	});

	it('"aprendido" vira o nivel aprendido; nivel fixo vale; sem a skill conhecida, null', () => {
		const itens = rodizioDoAuto(
			estado(
				[
					{ skillId: 46, nivel: 'aprendido' },
					{ skillId: 47, nivel: 3 },
					{ skillId: 999, nivel: 'aprendido' }
				],
				{},
				SKILLS
			)
		);
		expect(itens.map(i => i.nivel)).toEqual([10, 3, null]);
		expect(itens[2]).toMatchObject({ nome: '#999', chave: null });
	});

	it('a skill desligada no rodizio continua no arco, marcada', () => {
		const itens = rodizioDoAuto(estado([{ skillId: 46, nivel: 'aprendido' }], { 46: { ativa: false } }));
		expect(itens[0].ativa).toBe(false);
	});

	it('a assinatura muda quando o desenho muda, e so entao', () => {
		const a = rodizioDoAuto(estado([{ skillId: 46, nivel: 'aprendido' }]));
		const b = rodizioDoAuto(estado([{ skillId: 46, nivel: 'aprendido' }]));
		const c = rodizioDoAuto(estado([{ skillId: 46, nivel: 'aprendido' }], { 46: { ativa: false } }));
		expect(assinaturaDoRodizio(a)).toBe(assinaturaDoRodizio(b));
		expect(assinaturaDoRodizio(a)).not.toBe(assinaturaDoRodizio(c));
	});
});

describe('desenharArco e acaoDoToque', () => {
	function container() {
		const el = document.createElement('div');
		el.className = 'cc-rodizio';
		document.body.appendChild(el);
		return el;
	}

	it('tres discos sempre; o vazio e o "+" que abre o menu do Bot', () => {
		const el = container();
		const discos = desenharArco(el, [{ skillId: 46, nome: 'Rajada de Flechas', chave: 'AC_DOUBLE', nivel: 10, ativa: true }]);
		expect(discos.length).toBe(3);
		expect(el.querySelectorAll('.cc-skill').length).toBe(3);
		expect(discos[0].classList.contains('is-vazio')).toBe(false);
		expect(discos[0].querySelector('img').getAttribute('src')).toBe(iconeDaSkill('AC_DOUBLE'));
		expect(discos[0].getAttribute('aria-label')).toBe('Usar Rajada de Flechas');
		expect(discos[1].classList.contains('is-vazio')).toBe(true);
		expect(discos[1].getAttribute('aria-label')).toBe('Escolher as skills do automático');
		expect(acaoDoToque(discos[0])).toEqual({ acao: 'usar', skillId: 46, nivel: 10 });
		expect(acaoDoToque(discos[1])).toEqual({ acao: 'escolher' });
	});

	it('redesenhar nao cria disco a mais, e o disco que esvazia perde a skill e o icone', () => {
		const el = container();
		desenharArco(el, [{ skillId: 46, nome: 'Rajada', chave: 'AC_DOUBLE', nivel: 10, ativa: true }]);
		desenharArco(el, []);
		const disco = el.querySelector('.cc-skill');
		expect(el.querySelectorAll('.cc-skill').length).toBe(3);
		expect(disco.classList.contains('is-vazio')).toBe(true);
		expect(disco.hasAttribute('data-skill')).toBe(false);
		expect(disco.querySelector('img').hasAttribute('src')).toBe(false);
	});

	it('sem icone publicado o src SAI (nada de src=""), e o disco ganha a inicial', () => {
		const el = container();
		const [disco] = desenharArco(el, [{ skillId: 999, nome: 'detectar', chave: null, nivel: null, ativa: true }]);
		expect(disco.querySelector('img').hasAttribute('src')).toBe(false);
		expect(disco.getAttribute('data-inicial')).toBe('D');
		// Sem nivel no rodizio, o uso cai no nivel escolhido da janela de skills.
		expect(acaoDoToque(disco)).toEqual({ acao: 'usar', skillId: 999, nivel: undefined });
	});

	it('o icone que falhou fica marcado, e a marca sai quando o endereco muda', () => {
		const el = container();
		const [disco] = desenharArco(el, [{ skillId: 46, nome: 'Rajada', chave: 'AC_DOUBLE', nivel: 10, ativa: true }]);
		const img = disco.querySelector('img');
		img.dispatchEvent(new Event('error'));
		expect(img.dataset.falhou).toBe(iconeDaSkill('AC_DOUBLE'));
		desenharArco(el, [{ skillId: 47, nome: 'Chuva', chave: 'AC_SHOWER', nivel: 10, ativa: true }]);
		expect(img.dataset.falhou).toBeUndefined();
		expect(img.getAttribute('src')).toBe(iconeDaSkill('AC_SHOWER'));
	});

	it('a skill desligada no rodizio continua usavel, e diz isso', () => {
		const el = container();
		const [disco] = desenharArco(el, [{ skillId: 46, nome: 'Rajada', chave: 'AC_DOUBLE', nivel: 10, ativa: false }]);
		expect(disco.classList.contains('is-desligada')).toBe(true);
		expect(disco.getAttribute('aria-label')).toBe('Usar Rajada (desligada no automático)');
		expect(acaoDoToque(disco)).toEqual({ acao: 'usar', skillId: 46, nivel: 10 });
	});

	it('o toque fora de um disco nao pede nada', () => {
		expect(acaoDoToque(null)).toBeNull();
		expect(acaoDoToque(document.createElement('button'))).toBeNull();
	});

	it('os slots do relogio: a skill e o icone de cada disco, null no vazio', () => {
		const el = container();
		desenharArco(el, [{ skillId: 46, nome: 'Rajada', chave: 'AC_DOUBLE', nivel: 10, ativa: true }]);
		const slots = slotsDoArco(el);
		expect(slots.map(s => s.skillId)).toEqual([46, null, null]);
		expect(slots[0].icone.classList.contains('cc-skill-icone')).toBe(true);
		expect(slotsDoArco(null)).toEqual([]);
	});
});

/* ─── A costura com as pecas reais ───────────────────────────────────────── */

const pasta = join(__dirname, '..', '..', 'src', 'UI', 'Components');
const htmlDoMenu = readFileSync(join(pasta, 'BotMenu', 'BotMenu.html'), 'utf8');
const htmlDoBotao = readFileSync(join(pasta, 'CombatCornerIdle', 'CombatCornerIdle.html'), 'utf8');

function pacote(geral, extra = {}) {
	return {
		v: 1,
		tipo: 'status',
		requestId: null,
		personagemId: 7,
		mapa: 'prt_fild08',
		ok: true,
		erro: null,
		problemas: [],
		revisao: 0,
		config: {
			v: 1,
			cacar: true,
			especiesVetadas: [],
			modoDeAtaque: 'skills-e-basico',
			raioDePercepcao: 15,
			skills: { geral, porSkill: {}, porMonstro: {} }
		},
		ligado: false,
		situacao: 'desligado',
		status: { codigo: 'controle-manual', alvo: null },
		statusRevision: 0,
		agora: 0,
		capacidades: { contrato: 1, versaoDaConfig: 1, limites: { raioMinimo: 3, raioMaximo: 30 }, secoes: ['cacada', 'ataque'] },
		monstros: [],
		skills: SKILLS,
		...extra
	};
}

async function montar() {
	vi.resetModules();
	localStorage.clear();
	const { default: Network } = await import('Network/NetworkManager.js');
	const { default: Session } = await import('Engine/SessionStorage.js');
	const { default: BotMenu } = await import('UI/Components/BotMenu/BotMenu.js');
	/* A porta da barra, e nao o `ShortCut.js` (que arrasta a janela de skills e as entidades com canvas): o uso
	   e a recarga chegam por ela, e a barra a abastece no jogo (ver o portao do fim deste arquivo). */
	const porta = await import('UI/Components/ShortCut/portaDasSkills.js');
	const usar = vi.fn();
	porta.registrarUsoDeSkill(usar);
	const { default: CombatCornerIdle } = await import('UI/Components/CombatCornerIdle/CombatCornerIdle.js');
	Session.GID = 7;
	BotMenu._host = document.createElement('div');
	BotMenu._host.innerHTML = htmlDoMenu;
	BotMenu._shadow = null;
	BotMenu.draggable = () => {};
	BotMenu.init();
	// A janela do Bot FECHADA: o arco nao pode depender dela aberta.
	const chamada = Network.hookPacket.mock.calls.filter(c => c[1] && c[1].name === 'onBotRecebido').at(-1);
	const receber = d => chamada[1]({ json: JSON.stringify(d) });
	CombatCornerIdle._host = document.createElement('div');
	CombatCornerIdle._host.innerHTML = htmlDoBotao;
	CombatCornerIdle._shadow = null;
	CombatCornerIdle.init();
	CombatCornerIdle.onAppend();
	const discos = () => Array.from(CombatCornerIdle._host.querySelectorAll('.cc-skill'));
	return { BotMenu, CombatCornerIdle, porta, usar, receber, discos };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('o arco com o BotMenu e o CombatCornerIdle de verdade', () => {
	it('antes do estado do Bot: tres "+"; com ele, as skills do rodizio na ordem', async () => {
		const { receber, discos } = await montar();
		expect(discos().map(d => d.classList.contains('is-vazio'))).toEqual([true, true, true]);
		receber(
			pacote([
				{ skillId: 47, nivel: 'aprendido' },
				{ skillId: 46, nivel: 'aprendido' }
			])
		);
		expect(discos().map(d => d.getAttribute('data-skill'))).toEqual(['47', '46', null]);
		expect(discos()[0].getAttribute('data-nivel')).toBe('8');
	});

	it('o rodizio que o servidor muda redesenha o arco', async () => {
		const { receber, discos } = await montar();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		receber(pacote([{ skillId: 129, nivel: 2 }], { revisao: 1 }));
		expect(discos()[0].getAttribute('data-skill')).toBe('129');
		expect(discos()[0].getAttribute('data-nivel')).toBe('2');
	});

	it('tocar um disco USA a skill na hora, pelo caminho da barra', async () => {
		const { usar, receber, discos } = await montar();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		discos()[0].click();
		expect(usar).toHaveBeenCalledWith(46, 10);
	});

	it('o toque no icone (dentro do disco) tambem usa', async () => {
		const { usar, receber, discos } = await montar();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		discos()[0].querySelector('img').click();
		expect(usar).toHaveBeenCalledWith(46, 10);
	});

	it('o disco vazio abre o menu do Bot, e nao usa nada', async () => {
		const { BotMenu, usar, receber, discos } = await montar();
		const abrir = vi.spyOn(BotMenu, 'toggle').mockImplementation(() => {});
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		discos()[2].click();
		expect(abrir).toHaveBeenCalledTimes(1);
		expect(usar).not.toHaveBeenCalled();
	});

	it('o tocar no disco nao liga nem desliga o Auto', async () => {
		const { receber, discos } = await montar();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		const { default: Network } = await import('Network/NetworkManager.js');
		const antes = Network.sendPacket.mock.calls.length;
		discos()[0].click();
		expect(Network.sendPacket.mock.calls.length).toBe(antes);
	});

	it('a recarga que a barra recebe (0x043d) acende o relogio SO no disco da skill', async () => {
		const { porta, receber, discos } = await montar();
		receber(
			pacote([
				{ skillId: 46, nivel: 'aprendido' },
				{ skillId: 47, nivel: 'aprendido' }
			])
		);
		porta.avisarRecarga(47, 3000);
		expect(discos()[0].querySelector('.sc-recarga')).toBeNull();
		expect(discos()[1].querySelector('.sc-recarga')).not.toBeNull();
	});

	it('o atraso global acende todos os discos com skill', async () => {
		const { porta, receber, discos } = await montar();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		porta.avisarRecarga(null, 1500);
		expect(discos()[0].querySelector('.sc-recarga')).not.toBeNull();
		expect(discos()[1].querySelector('.sc-recarga')).toBeNull();
	});

	it('sair do mapa solta os ouvintes: o rodizio novo nao chega ao arco removido', async () => {
		const { CombatCornerIdle, porta, receber, discos } = await montar();
		CombatCornerIdle.onRemove();
		receber(pacote([{ skillId: 46, nivel: 'aprendido' }]));
		porta.avisarRecarga(46, 3000);
		expect(discos()[0].classList.contains('is-vazio')).toBe(true);
		expect(discos()[0].querySelector('.sc-recarga')).toBeNull();
	});
});

describe('a porta das skills da barra', () => {
	it('sem a barra registrada, usar nao pede nada e diz isso', async () => {
		vi.resetModules();
		const porta = await import('UI/Components/ShortCut/portaDasSkills.js');
		expect(porta.usarSkill(46, 10)).toBe(false);
		const usar = vi.fn();
		porta.registrarUsoDeSkill(usar);
		expect(porta.usarSkill(46, undefined)).toBe(true);
		expect(usar).toHaveBeenCalledWith(46, undefined);
	});

	it('um ouvinte da recarga que falha nao derruba o seguinte', async () => {
		vi.resetModules();
		const porta = await import('UI/Components/ShortCut/portaDasSkills.js');
		const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
		const depois = vi.fn();
		porta.aoRecarga(() => {
			throw new Error('quebrou');
		});
		const soltar = porta.aoRecarga(depois);
		porta.avisarRecarga(47, 3000);
		expect(depois).toHaveBeenCalledWith(47, 3000);
		expect(erro).toHaveBeenCalled();
		soltar();
		porta.avisarRecarga(47, 3000);
		expect(depois).toHaveBeenCalledTimes(1);
	});

	/* O `ShortCut.js` nao carrega em jsdom (canvas das entidades), como nos outros portoes da barra
	   (`barraDeAtalhosNativa.test.js`): o que se cobra e o TEXTO da costura. */
	it('a barra abastece a porta: as duas recargas avisam, e o uso registrado e o `useSkill` dela', () => {
		const fonte = readFileSync(join(pasta, 'ShortCut', 'ShortCut.js'), 'utf8');
		const corpo = nome => {
			const i = fonte.indexOf(`ShortCut.${nome} = function`);
			return fonte.slice(i, fonte.indexOf('\n};', i));
		};
		expect(corpo('setSkillDelay')).toContain('avisarRecarga(Number(ID), delay);');
		expect(corpo('setGlobalSkillDelay')).toContain('avisarRecarga(null, delay);');
		expect(fonte).toContain('registrarUsoDeSkill((id, nivel) => ShortCut.useSkill(id, nivel));');
		// O arco nao importa a barra: so a porta.
		const arco = readFileSync(join(pasta, 'CombatCornerIdle', 'CombatCornerIdle.js'), 'utf8');
		expect(arco).not.toMatch(/import ShortCut from/);
		expect(arco).toContain("from 'UI/Components/ShortCut/portaDasSkills.js'");
	});
});
