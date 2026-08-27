/**
 * O BOTAO "Auto" DA BARRA DE ACOES (27/08/2026, auditoria).
 *
 * Ele fazia tres coisas erradas de uma vez:
 *
 * 1. Invertia `IdleConfig.editConfig.cacaAutomatica` e chamava `aplicarConfig()`,
 *    que serializa o RASCUNHO INTEIRO da janela de Config. O rascunho sobrevive
 *    ao fechar da janela (`closeWindow` so tira `.is-open`), entao um clique num
 *    botao da barra de acoes enviava edicoes que o jogador nunca aplicou.
 *
 * 2. Se qualquer uma delas fosse invalida, o servidor recusa TRANSACIONALMENTE:
 *    nada muda, nem o `cacaAutomatica` pedido. O caso medido — marcar
 *    "Desabilitar ataques basicos" e depois remover a unica skill da rotacao —
 *    deixa `{modoDeAtaque:'apenas-skills', rotacao:[]}`, que o servidor recusa.
 *    O botao Auto entao NUNCA funciona, e a causa mora numa janela fechada.
 *
 * 3. Acendia mesmo assim: `syncAutoState` lia o rascunho, e no ramo de recusa o
 *    rascunho e deliberadamente preservado.
 *
 * O teste exercita a funcao de verdade — `Network.sendPacket` mockado e o
 * criterio: o que saiu no fio e o que importa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Quebra de linha, para as buscas no fonte nao dependerem de escape. */
const NL = String.fromCharCode(10);

const mocks = vi.hoisted(() => ({
	enviados: [],
	// A resposta do servidor chega por hook; guardar o callback e o unico
	// jeito de exercitar o ramo de RECUSA sem subir a rede inteira.
	hooks: [],
	avisos: [],
	network: {
		sendPacket: (p) => mocks.enviados.push(p),
		hookPacket: (_pkt, cb) => mocks.hooks.push(cb)
	}
}));

vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), vsync: [] } }));
vi.mock('UI/UIManager.js', () => ({
	default: { showErrorBox: vi.fn(), addComponent: (c) => c }
}));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: {
		addText: (texto) => mocks.avisos.push(texto),
		TYPE: { ERROR: 1 },
		FILTER: { PUBLIC_LOG: 1 }
	}
}));

const { default: htmlDoComponente } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');

/** O estado que o servidor ACEITOU — o unico que o botao pode usar. */
const ACEITO = {
	cacaAutomatica: false,
	coletarItens: true,
	modoDeAtaque: 'skills-e-basico',
	rotacao: [{ skillId: 'MG_FIREWALL', nivelDeUso: 1 }],
	alvosDesabilitados: []
};

/** A resposta de RECUSA do servidor, no contrato do fio (v:1, dentro de `json`). */
const RECUSA = {
	v: 1,
	aplicado: false,
	problemas: ['apenas-skills com rotacao vazia'],
	contexto: { ehCidade: false },
	config: ACEITO
};

/** O RASCUNHO invalido que o jogador deixou na janela e nunca aplicou. */
const RASCUNHO_PODRE = {
	cacaAutomatica: false,
	coletarItens: false,
	modoDeAtaque: 'apenas-skills',
	rotacao: [],
	alvosDesabilitados: [9999]
};

describe('o botao Auto da barra de acoes', () => {
	beforeEach(() => {
		mocks.enviados.length = 0;
		mocks.avisos.length = 0;
		/*
		 * O host e o HTML REAL do componente, e nao um esqueleto escrito aqui.
		 * Um host inventado passa a mentir assim que o componente ganha um no
		 * novo — e o caminho da resposta do servidor chama `renderTabs`,
		 * `renderBody`, `renderProblemas` e `updateFooter`, que juntos tocam
		 * quase a janela inteira.
		 */
		IdleConfig._host = document.createElement('div');
		IdleConfig._host.innerHTML = htmlDoComponente;
		IdleConfig._shadow = null;
		IdleConfig.serverConfig = JSON.parse(JSON.stringify(ACEITO));
		IdleConfig.editConfig = JSON.parse(JSON.stringify(RASCUNHO_PODRE));
	});

	it('manda o estado ACEITO com um campo trocado — nunca o rascunho', () => {
		IdleConfig.alternarCacaAutomatica();

		expect(mocks.enviados.length, 'nada foi enviado').toBe(1);
		const enviado = JSON.parse(mocks.enviados[0].json);

		expect(enviado.cacaAutomatica, 'o campo do botao nao foi invertido').toBe(true);
		// E o resto e o ACEITO, e nao o rascunho: se o rascunho vazasse, o
		// servidor recusaria transacionalmente e o botao nunca funcionaria.
		expect(enviado.modoDeAtaque).toBe('skills-e-basico');
		expect(enviado.rotacao).toEqual(ACEITO.rotacao);
		expect(enviado.alvosDesabilitados).toEqual([]);
		expect(enviado.coletarItens).toBe(true);
	});

	it('NAO toca no rascunho do jogador — ele e dele', () => {
		IdleConfig.alternarCacaAutomatica();
		expect(IdleConfig.editConfig).toEqual(RASCUNHO_PODRE);
	});

	it('NAO antecipa o resultado: `serverConfig` so muda quando a resposta chega', () => {
		/*
		 * O botao e um indicador de estado do SERVIDOR. Marcar o estado local
		 * antes da resposta e o que fazia o botao ficar aceso anunciando algo que
		 * o servidor tinha recusado.
		 */
		IdleConfig.alternarCacaAutomatica();
		expect(IdleConfig.serverConfig.cacaAutomatica).toBe(false);
	});

	it('sem config do servidor ainda, ele PEDE em vez de inventar um estado', () => {
		IdleConfig.serverConfig = null;
		IdleConfig.alternarCacaAutomatica();
		// O pedido de config sai no fio; o que nao pode sair e um "aplicar" com
		// um estado que ninguem confirmou.
		expect(mocks.enviados.length).toBe(1);
		expect(mocks.enviados[0].json, 'mandou aplicar sem estado conhecido').toBeUndefined();
	});

	it('a RECUSA com a janela fechada chega ao jogador — nao morre em DOM invisivel', () => {
		/*
		 * `renderProblemas()` escreve dentro da janela de Config. Pelo botao Auto a
		 * janela esta fechada, entao o texto ia para um DOM que ninguem ve: o
		 * jogador clicava e NADA acontecia, sem uma palavra na tela.
		 */
		const janela = IdleConfig._host.querySelector('.ic-window');
		janela.classList.remove('is-open');

		expect(mocks.hooks.length, 'ninguem registrou o hook da resposta').toBeGreaterThan(0);
		mocks.hooks[0]({ json: JSON.stringify(RECUSA) });

		expect(mocks.avisos.length, 'a recusa foi muda').toBe(1);
		expect(mocks.avisos[0]).toContain('apenas-skills com rotacao vazia');
	});

	it('com a janela ABERTA o aviso NAO se repete no chat — a janela ja mostra', () => {
		const janela = IdleConfig._host.querySelector('.ic-window');
		janela.classList.add('is-open');
		mocks.hooks[0]({ json: JSON.stringify(RECUSA) });
		expect(mocks.avisos.length, 'avisou duas vezes a mesma coisa').toBe(0);
	});
});

describe('o indicador do botao Auto', () => {
	/*
	 * `syncAutoState` mora num closure do DockIdle e pinta uma classe CSS; nao ha
	 * como chama-lo sem subir a barra de acoes inteira. A medida possivel e a
	 * mesma que o servidor usa para estado em closure: LER O FONTE.
	 *
	 * O recorte comeca NA declaracao da funcao, entao o comentario que a explica
	 * (que cita `editConfig` de proposito, para contar a historia) fica de fora —
	 * sem precisar de nenhuma limpeza por regex.
	 *
	 * O que estes casos travam e a FONTE do bool. Ele lia `editConfig` — o
	 * rascunho da janela de Config —, entao marcar a caixa e fechar a janela SEM
	 * aplicar deixava o botao aceso com o servidor desligado; e no ramo de
	 * recusa, onde o rascunho e preservado de proposito, ele continuava aceso
	 * anunciando algo que nao aconteceu.
	 */
	function corpoDe(fonte, assinatura) {
		const inicio = fonte.indexOf(assinatura);
		expect(inicio, assinatura + ' sumiu do DockIdle').toBeGreaterThan(-1);
		const fim = fonte.indexOf(NL + '}', inicio);
		expect(fim, 'nao achei o fim de ' + assinatura).toBeGreaterThan(inicio);
		return fonte.slice(inicio, fim);
	}

	let fonte;
	beforeEach(async () => {
		const fs = await import('node:fs');
		fonte = fs.readFileSync('src/UI/Components/DockIdle/DockIdle.js', 'utf8');
	});

	it('le `serverConfig`, e NUNCA o rascunho', () => {
		const corpo = corpoDe(fonte, 'function syncAutoState()');
		expect(corpo, 'o indicador voltou a ler o rascunho').not.toContain('editConfig');
		expect(corpo, 'o indicador nao le o estado do servidor').toContain('serverConfig');
	});

	it('o clique NAO mexe no rascunho nem chama `aplicarConfig`', () => {
		const corpo = corpoDe(fonte, 'function onClickAuto(');
		expect(corpo, 'o clique voltou a escrever no rascunho').not.toContain('editConfig');
		expect(
			corpo,
			'o clique voltou a mandar o rascunho inteiro (aplicarConfig)'
		).not.toContain('aplicarConfig');
		expect(corpo).toContain('alternarCacaAutomatica');
	});
});
