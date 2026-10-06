/**
 * OS TRES DEFEITOS ANTIGOS DO NPC (D-2049, 06/10/2026), achados pela D-2047.
 *
 *   1. O ESC no menu do NPC (e na fala, e na confirmacao do servidor) fechava a
 *      conversa E abria as Configuracoes por cima: o `Escape` foi anexado no
 *      boot do mapa e o tratador dele roda antes do da conversa.
 *   2. A lista do Portal (`AL_WARP`) deixava `NpcMenu.onAppend` gravado, e todo
 *      menu de NPC aberto depois nascia com o titulo do Portal.
 *   3. No celular a caixa de fala ficava colada na borda direita (73..393).
 *
 * Os componentes DE VERDADE, montados no jsdom: o canvas do jsdom nao existe,
 * entao `getContext` devolve um contexto de mentira (o `EntityDisplay` mede
 * texto no import), e o fio (`Network`) e espiado — os ganchos dos pacotes sao
 * capturados no `hookPacket` e chamados com o pacote na mao, e o que sairia
 * para o servidor e anotado. Quem prova o jogo montado, com os PNGs, e a sonda
 * `scripts/diag-defeitos-do-npc-na-tela.ts` do servidor.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const contexto = new Proxy(
	{},
	{
		get: (alvo, chave) => {
			if (chave in alvo) return alvo[chave];
			if (chave === 'measureText') return () => ({ width: 10 });
			if (chave === 'getImageData' || chave === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) });
			return () => {};
		},
		set: (alvo, chave, valor) => {
			alvo[chave] = valor;
			return true;
		}
	}
);
HTMLCanvasElement.prototype.getContext = function getContext() {
	return contexto;
};

let Network, PACKET, Escape, NpcMenu, NpcBox, conversa, posicao;
const ganchos = new Map();
const enviados = [];

beforeAll(async () => {
	Network = (await import('Network/NetworkManager.js')).default;
	PACKET = (await import('Network/PacketStructure.js')).default;
	vi.spyOn(Network, 'hookPacket').mockImplementation((pacote, callback) => ganchos.set(pacote, callback));
	vi.spyOn(Network, 'sendPacket').mockImplementation(pkt => enviados.push(pkt));
	Escape = (await import('UI/Components/Escape/Escape.js')).default;
	NpcMenu = (await import('UI/Components/NpcMenu/NpcMenu.js')).default;
	NpcBox = (await import('UI/Components/NpcBox/NpcBox.js')).default;
	conversa = await import('UI/conversaNaTela.js');
	posicao = await import('UI/Components/NpcMenu/posicaoDoMenu.js');
	(await import('Engine/MapEngine/NPC.js')).default();
	// A janela de habilidades escolhe a versao no boot do mapa; aqui so o gancho importa.
	const SkillWindow = (await import('UI/Components/SkillList/SkillList.js')).default;
	vi.spyOn(SkillWindow, 'getUI').mockReturnValue({});
	(await import('Engine/MapEngine/Skill.js')).default();
	(await import('Engine/MapEngine/RagidleConfirmar.js')).default.init();
	Escape.append();
}, 60_000);

function gancho(pacote) {
	const f = ganchos.get(pacote);
	if (!f) throw new Error('o gancho do pacote nao foi registrado');
	return f;
}

function esc() {
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
}

const configuracoesAbertas = () => Escape._host.style.display !== 'none';
const tituloDoMenu = () => NpcMenu.getRoot().querySelector('.title').textContent;
const opcoesDoMenu = () => Array.from(NpcMenu.getRoot().querySelectorAll('.content div[data-index]')).map(d => d.textContent);

afterEach(() => {
	NpcMenu.remove();
	NpcBox.remove();
	Escape._host.style.display = 'none';
	enviados.length = 0;
	vi.unstubAllGlobals();
});

/* ── 1. O ESC NA CONVERSA ─────────────────────────────────────────────── */

describe('o ESC na conversa com o NPC nao abre as Configuracoes (D-2049)', () => {
	it('controle: sem conversa, o ESC abre as Configuracoes, como sempre', () => {
		expect(configuracoesAbertas()).toBe(false);
		esc();
		expect(configuracoesAbertas()).toBe(true);
	});

	it('no menu com a fala atras: cancela o menu (255), fecha a fala, e as Configuracoes ficam fechadas', () => {
		gancho(PACKET.ZC.SAY_DIALOG)({ NAID: 77, msg: '[Hipnotizador] Ola.' });
		gancho(PACKET.ZC.MENU_LIST)({ NAID: 77, msg: 'Atributos:Habilidades:Agora nao' });
		expect(conversa.conversaNaTela()).not.toBeNull();
		esc();
		expect(configuracoesAbertas()).toBe(false);
		expect(NpcMenu.__active).toBe(false);
		expect(NpcBox.__active).toBe(false);
		expect(enviados.map(p => p.num)).toEqual([255]);
	});

	it('no menu sozinho (a Kafra nao fala antes): cancela, e as Configuracoes ficam fechadas', () => {
		gancho(PACKET.ZC.MENU_LIST)({ NAID: 78, msg: 'Save:Use Storage:Cancel' });
		esc();
		expect(configuracoesAbertas()).toBe(false);
		expect(NpcMenu.__active).toBe(false);
		expect(enviados.map(p => p.num)).toEqual([255]);
	});

	it('na fala com "Fechar": fecha a fala, e as Configuracoes ficam fechadas', () => {
		gancho(PACKET.ZC.SAY_DIALOG)({ NAID: 79, msg: 'Voce ja esta com o HP cheio.' });
		// o `ZC_CLOSE_DIALOG` pergunta `:visible`, que o jsdom (sem layout) nega
		NpcBox.addClose(79);
		esc();
		expect(configuracoesAbertas()).toBe(false);
		expect(NpcBox.__active).toBe(false);
	});

	it('na fala so com "Continuar": o ESC nao faz nada (como na fonte), nem abre as Configuracoes', () => {
		gancho(PACKET.ZC.SAY_DIALOG)({ NAID: 80, msg: 'Primeira pagina.' });
		gancho(PACKET.ZC.WAIT_DIALOG)({ NAID: 80 });
		esc();
		expect(configuracoesAbertas()).toBe(false);
		expect(NpcBox.__active).toBe(true);
	});

	it('na confirmacao do servidor: responde "nao", fecha, e as Configuracoes ficam fechadas', () => {
		gancho(PACKET.ZC.RAGIDLE_CONFIRMAR)({ json: JSON.stringify({ v: 1, id: 9, texto: 'Devolver o carrinho?' }) });
		expect(conversa.conversaNaTela()).toBe('confirmacao');
		esc();
		expect(configuracoesAbertas()).toBe(false);
		expect(enviados.map(p => [p.id, p.resposta])).toEqual([[9, 0]]);
		expect(conversa.conversaNaTela()).toBeNull();
	});

	it('fechada a conversa, o ESC volta a abrir as Configuracoes', () => {
		gancho(PACKET.ZC.MENU_LIST)({ NAID: 81, msg: 'a:b' });
		esc();
		expect(configuracoesAbertas()).toBe(false);
		esc();
		expect(configuracoesAbertas()).toBe(true);
	});
});

describe('o registro da conversa (puro)', () => {
	afterEach(() => {
		conversa.desregistrarConversa('teste-a');
		conversa.desregistrarConversa('teste-b');
	});

	it('diz QUAL parte esta na tela, e null quando nenhuma', () => {
		conversa.registrarConversa('teste-a', () => false);
		expect(conversa.conversaNaTela()).toBeNull();
		conversa.registrarConversa('teste-b', () => true);
		expect(conversa.conversaNaTela()).toBe('teste-b');
	});

	it('so `true` conta (um valor "quase verdadeiro" nao tranca o ESC)', () => {
		conversa.registrarConversa('teste-a', () => 1);
		expect(conversa.conversaNaTela()).toBeNull();
	});

	it('uma leitura que lanca conta como fora da tela, e nao derruba as outras', () => {
		conversa.registrarConversa('teste-a', () => {
			throw new Error('quebrado');
		});
		expect(conversa.conversaNaTela()).toBeNull();
		conversa.registrarConversa('teste-b', () => true);
		expect(conversa.conversaNaTela()).toBe('teste-b');
	});

	it('registrar de novo troca a leitura, sem empilhar', () => {
		conversa.registrarConversa('teste-a', () => true);
		conversa.registrarConversa('teste-a', () => false);
		expect(conversa.conversaNaTela()).toBeNull();
	});

	it('entrada invalida e ignorada', () => {
		conversa.registrarConversa('', () => true);
		conversa.registrarConversa('teste-a', 'sim');
		expect(conversa.conversaNaTela()).toBeNull();
	});

	it('componenteNaTela: anexado E sem display none', () => {
		const host = document.createElement('div');
		expect(conversa.componenteNaTela(null)).toBe(false);
		expect(conversa.componenteNaTela({ __active: true, _host: host })).toBe(true);
		expect(conversa.componenteNaTela({ __active: false, _host: host })).toBe(false);
		expect(conversa.componenteNaTela({ __active: true, _host: null })).toBe(false);
		host.style.display = 'none';
		expect(conversa.componenteNaTela({ __active: true, _host: host })).toBe(false);
	});
});

/* ── 2. O PORTAL E O MENU SEGUINTE ────────────────────────────────────── */

describe('a lista do Portal nao contamina o menu seguinte (D-2049)', () => {
	it('o Portal abre com o titulo dele; a Kafra depois abre SEM ele e com as opcoes dela', () => {
		gancho(PACKET.ZC.WARPLIST2)({ SKID: 27, mapName: ['prontera.gat', 'geffen.gat'] });
		expect(NpcMenu.__active).toBe(true);
		expect(tituloDoMenu()).not.toBe('');
		expect(opcoesDoMenu()).toHaveLength(3);

		NpcMenu.getRoot().querySelector('.cancel').click();
		expect(NpcMenu.__active).toBe(false);
		expect(enviados.map(p => p.mapName)).toEqual(['cancel']);
		enviados.length = 0;

		gancho(PACKET.ZC.MENU_LIST)({ NAID: 90, msg: 'Save:Curar (100z):Cancel' });
		expect(tituloDoMenu()).toBe('');
		expect(opcoesDoMenu()).toEqual(['Save', 'Curar (100z)', 'Cancel']);
		// e a escolha vai a Kafra (CZ_CHOOSE_MENU), e nao ao Portal (CZ_SELECT_WARPPOINT)
		NpcMenu.getRoot().querySelector('.ok').click();
		expect(enviados.map(p => [p.NAID, p.num])).toEqual([[90, 1]]);
	});

	it('o Portal nao deixa gancho de abertura gravado no menu', () => {
		gancho(PACKET.ZC.WARPLIST2)({ SKID: 27, mapName: ['payon.gat'] });
		NpcMenu.remove();
		expect(NpcMenu.onAppend).toBeUndefined();
	});

	it('o titulo nao sobrevive ao menu, mesmo escrito por fora', () => {
		gancho(PACKET.ZC.MENU_LIST)({ NAID: 91, msg: 'a:b' });
		NpcMenu.getRoot().querySelector('.title').textContent = 'sobra';
		NpcMenu.remove();
		gancho(PACKET.ZC.MENU_LIST)({ NAID: 91, msg: 'a:b' });
		expect(tituloDoMenu()).toBe('');
	});
});

/* ── 3. A FALA NO CELULAR ─────────────────────────────────────────────── */

function comoDedo(dedo) {
	vi.stubGlobal('matchMedia', q => ({ matches: dedo && q === '(pointer: coarse)', media: q, addEventListener() {}, removeEventListener() {} }));
}

/**
 * O host medido como no navegador (o jsdom nao tem layout): a caixa de 320
 * nasce em `left` e a medida segue o `style.left` que o codigo escrever, com
 * o `zoom` aplicado — o encaixe na tela do `GUIComponent` mede de novo depois.
 */
function medirHost(left, largura = 320) {
	NpcBox.prepare();
	NpcBox._host.style.left = `${left}px`;
	NpcBox._host.getBoundingClientRect = function medida() {
		const zoom = parseFloat(this.style.zoom) || 1;
		const l = parseFloat(this.style.left) * zoom;
		const w = largura * zoom;
		return { left: l, top: 226, right: l + w, bottom: 426, width: w, height: 200, x: l, y: 226 };
	};
}

describe('a fala do NPC no celular fica no centro (D-2049)', () => {
	it('no dedo, a fala de 320 numa tela de 393 vai para o centro (36,5 -> 37)', () => {
		comoDedo(true);
		vi.stubGlobal('innerWidth', 393);
		medirHost(131);
		NpcBox.append();
		expect(NpcBox._host.style.left).toBe('37px');
	});

	it('no dedo, respeita o zoom do host (pixels da tela -> CSS)', () => {
		comoDedo(true);
		vi.stubGlobal('innerWidth', 393);
		// zoom 0,5: a caixa ocupa 160px na tela; centro = (393 - 160) / 2 = 116,5 -> 117 / 0,5
		medirHost(131);
		NpcBox._host.style.zoom = '0.5';
		NpcBox.append();
		const left = NpcBox._host.style.left;
		NpcBox._host.style.zoom = '';
		expect(left).toBe('234px');
	});

	it('no mouse, a fala fica onde estava (desktop preservado)', () => {
		comoDedo(false);
		vi.stubGlobal('innerWidth', 1600);
		medirHost(533);
		NpcBox._host.style.left = '533px';
		NpcBox.append();
		expect(NpcBox._host.style.left).toBe('533px');
	});

	it('a regra e a MESMA do menu: posicaoHorizontal com 8px das bordas', () => {
		const { posicaoHorizontal, MARGEM, posicaoDoMenu } = posicao;
		expect(posicaoHorizontal({ telaLargura: 393, largura: 320, preferida: 131, centralizar: true })).toBe(36.5);
		// sem centralizar: a preferida, presa entre as margens
		expect(posicaoHorizontal({ telaLargura: 393, largura: 320, preferida: 131, centralizar: false })).toBe(393 - MARGEM - 320);
		expect(posicaoHorizontal({ telaLargura: 393, largura: 320, preferida: 0, centralizar: false })).toBe(MARGEM);
		expect(posicaoHorizontal({ telaLargura: 1600, largura: 320, preferida: 533, centralizar: false })).toBe(533);
		// mais larga que a tela menos as margens: centraliza, sem passar da borda esquerda
		expect(posicaoHorizontal({ telaLargura: 330, largura: 320, preferida: 100, centralizar: false })).toBe(5);
		expect(posicaoHorizontal({ telaLargura: 300, largura: 320, preferida: 100, centralizar: true })).toBe(0);
		// e o menu usa ela: a mesma coluna da fala no celular
		const menu = posicaoDoMenu({ tela: { largura: 393, altura: 852 }, fala: null, largura: 320, alturas: [100], preferida: { top: 500, left: 131 }, centralizar: true });
		expect(menu.left).toBe(Math.round(posicaoHorizontal({ telaLargura: 393, largura: 320, preferida: 131, centralizar: true })));
	});
});
