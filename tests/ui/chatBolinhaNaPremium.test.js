/**
 * O CHAT EM BOLINHA NA HUD PREMIUM (pedido do dono, 15/10/2026): *"o chat por padrao vem minimizado e o player
 * clica para abrir e minimizar com 1 click"*. (Os buffs, que primeiro foram para o lado da bolinha, moram numa
 * coluna abaixo das missoes - `buffsEmColuna.test.js`.)
 *
 * O que se prova:
 *   - o ciclo do chevron: tres estados fora da premium (como sempre), DOIS na premium - um toque abre, um
 *     toque minimiza (`estadosDoChat.js`, puro);
 *   - a costura no ChatBox.js: o ciclo curto pergunta a marca `ri-premium` do proprio shadow, o rotulo diz
 *     "Minimizar chat", e a marca `ri-chat-minimizado` vai e volta no documento (e sai quando o chat sai);
 *   - o nascer minimizado no celular continua (08/09/2026) - nada aqui o desfaz;
 *   - o CSS: minimizado o painel perde a largura e a casca (senao sobrava uma caixa invisivel de 300px comendo
 *     o toque no mapa - medido).
 *
 * O ChatBox.js nao carrega em jsdom (o mesmo motivo dos outros portoes do chat): a costura e cobrada pelo texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESTADOS_DO_CHAT, MARCA_CHAT_MINIMIZADO, proximoEstadoDoChat } from 'UI/Components/ChatBox/estadosDoChat.js';

const src = join(__dirname, '..', '..', 'src', 'UI');
const ler = (...partes) => readFileSync(join(src, ...partes), 'utf8');

describe('o ciclo do chevron do chat', () => {
	it('fora da premium continua com os tres estados, na mesma ordem', () => {
		expect(ESTADOS_DO_CHAT).toEqual(['aberto', 'recolhido', 'minimizado']);
		expect(proximoEstadoDoChat('aberto', false)).toBe('recolhido');
		expect(proximoEstadoDoChat('recolhido', false)).toBe('minimizado');
		expect(proximoEstadoDoChat('minimizado', false)).toBe('aberto');
		// estado desconhecido volta ao comeco, como o ciclo de antes fazia
		expect(proximoEstadoDoChat('lixo', false)).toBe('aberto');
	});

	it('na premium sao dois: um toque minimiza o aberto, um toque abre o minimizado', () => {
		expect(proximoEstadoDoChat('aberto', true)).toBe('minimizado');
		expect(proximoEstadoDoChat('minimizado', true)).toBe('aberto');
		// quem chegou ao "recolhido" por outro caminho (o F10 antigo, outra sessao) abre com um toque
		expect(proximoEstadoDoChat('recolhido', true)).toBe('aberto');
	});
});

describe('a costura no ChatBox.js', () => {
	const chat = ler('Components', 'ChatBox', 'ChatBox.js');

	it('o chevron pergunta a marca ri-premium do proprio shadow', () => {
		expect(chat).toMatch(/function emCicloCurto\(\) \{[\s\S]*?closest\('\.ri-premium'\)/);
		expect(chat).toContain('return proximoEstadoDoChat(_recolhido.estado, emCicloCurto());');
		expect(chat).toContain("ligarBotao('.cb-collapse', () => definirEstado(proximoEstado()));");
	});

	it('o rotulo do chat aberto na premium diz o que o toque faz: "Minimizar chat"', () => {
		expect(chat).toMatch(/estado === 'aberto'\s*\?\s*emCicloCurto\(\)\s*\?\s*'Minimizar chat'\s*:\s*'Recolher chat'/);
	});

	it('a marca do chat minimizado vai e volta no documento, e sai quando o chat sai', () => {
		expect(MARCA_CHAT_MINIMIZADO).toBe('ri-chat-minimizado');
		expect(chat).toContain(
			'chatboxEl.ownerDocument.documentElement.classList.toggle(MARCA_CHAT_MINIMIZADO, minimizado);'
		);
		const remove = chat.slice(chat.indexOf('ChatBox.onRemove = function'));
		expect(remove.slice(0, remove.indexOf('\n};'))).toContain(
			'document.documentElement.classList.remove(MARCA_CHAT_MINIMIZADO);'
		);
	});

	it('no celular o chat continua nascendo minimizado a cada entrada', () => {
		expect(chat).toMatch(/if \(ehTelaDeToque\(\)\) \{\s*_recolhido\.estado = 'minimizado';/);
	});
});

describe('o desenho da bolinha', () => {
	const chatCss = ler('HudPremium', 'componentes', 'ChatBox.css');

	it('minimizado, o painel perde a largura e a casca: so a bolinha ocupa a tela', () => {
		const regra = chatCss.match(/\.ri-premium #chatbox\.is-minimizado \{([^}]*)\}/);
		expect(regra).not.toBeNull();
		expect(regra[1]).toMatch(/width: auto !important;/);
		expect(regra[1]).toMatch(/padding: 0;/);
		expect(regra[1]).toMatch(/border: 0;/);
		expect(regra[1]).toMatch(/background: none;/);
		expect(chatCss).toMatch(/\.ri-premium #chatbox\.is-minimizado \.cb-topo \{[^}]*padding: 0;/);
		expect(chatCss).toMatch(/\.ri-premium #chatbox\.is-minimizado \.cb-collapse \{[^}]*width: var\(--m-chat-bolinha, 44px\);/);
	});
});
