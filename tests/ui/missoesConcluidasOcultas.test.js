/**
 * AS MISSÕES CONCLUÍDAS SÃO OCULTAS POR PADRÃO (11/09/2026).
 *
 * Pedido do dono: *"referente a janela de Missões, quero que oculte por padrão
 * todas as missões que já foram concluídas"*.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O INTERRUPTOR ENTROU JUNTO, E NÃO DEPOIS
 * ---------------------------------------------------------------------------
 * "Ocultar" sem "como mostrar" esconderia o histórico do jogador. Missão
 * repetível fica `concluida` entre um ciclo e outro, e sem a porta de volta ela
 * sumiria da tela — o pedido viraria um defeito com outro nome.
 *
 * ---------------------------------------------------------------------------
 * OS QUATRO `vi.mock` NÃO SÃO ENFEITE — A PRIMEIRA VERSÃO DESTE ARQUIVO NÃO OS
 * TINHA E OS CINCO CASOS MORRERAM JUNTOS
 * ---------------------------------------------------------------------------
 * `TypeError: Cannot read properties of null (reading 'createImageData')`, em
 * `Renderer/SpriteRenderer.js:112`, alcançado por `Renderer/Map/Water.js:12`.
 * Importar `MissoesIdle.js` puxa o renderizador de sprites pela cadeia de
 * imports, e no `jsdom` o `getContext('2d')` devolve `null` — o módulo explode
 * ANTES de qualquer caso rodar. Por isso caiu até o caso que nem toca a lista.
 *
 * Os quatro são os mesmos de `abaSobreviveAoF5.test.js`, que importa este mesmo
 * componente e passa — a evidência de que bastam.
 *
 * ---------------------------------------------------------------------------
 * O BOTÃO NÃO É UM `.mi-tab`, E ISSO É MEDIDO AQUI
 * ---------------------------------------------------------------------------
 * `abaSobreviveAoF5.test.js` liga e conta os `.mi-tab` por `data-tab`. Um
 * terceiro botão com aquela classe entraria na conta dele como se fosse uma
 * aba, e o portão da memória de aba passaria a medir outra coisa.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({
	default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 }
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const MISSOES = [
	{ id: 'a', tipo: 'principal', titulo: 'Em andamento', estado: 'em-andamento', cooldownS: 0 },
	{ id: 'b', tipo: 'principal', titulo: 'Ja fechei esta', estado: 'concluida', cooldownS: 0 },
	{ id: 'c', tipo: 'principal', titulo: 'Disponivel', estado: 'disponivel', cooldownS: 0 }
];

/**
 * Monta a janela como o jogo monta, com o HTML REAL e o `init()` de verdade.
 *
 * As missões entram ANTES do `init()` de propósito: é ele que chama `render()`
 * no fim. `render` é privada do módulo — a primeira versão deste arquivo tentou
 * `MissoesIdle.render()` e caiu no `else`, remontando a janela inteira.
 */
async function montarMissoes(missoes = MISSOES) {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');

	MissoesIdle._host = document.createElement('div');
	MissoesIdle._host.innerHTML = html;
	MissoesIdle._shadow = null;
	MissoesIdle.draggable = () => {};
	MissoesIdle.missoes = missoes;
	MissoesIdle.init();

	return MissoesIdle;
}

function textoDaLista(MissoesIdle) {
	const body = MissoesIdle._host.querySelector('.mi-body');
	return body ? body.textContent : '';
}

describe('a janela de Missões oculta as concluídas por padrão', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	it('sem escolha nenhuma, a concluída NÃO aparece', async () => {
		const MissoesIdle = await montarMissoes();
		expect(textoDaLista(MissoesIdle)).not.toContain('Ja fechei esta');
	});

	it('CONTROLE: as outras aparecem — senão o caso acima passaria com a lista vazia', async () => {
		const MissoesIdle = await montarMissoes();
		const texto = textoDaLista(MissoesIdle);
		expect(texto).toContain('Em andamento');
		expect(texto).toContain('Disponivel');
	});

	it('o interruptor traz a concluída de volta', async () => {
		const MissoesIdle = await montarMissoes();
		MissoesIdle._host.querySelector('.mi-concluidas').click();

		expect(textoDaLista(MissoesIdle)).toContain('Ja fechei esta');
	});

	it('a escolha sobrevive ao F5 — ela é da PESSOA, como a aba', async () => {
		const antes = await montarMissoes();
		antes._host.querySelector('.mi-concluidas').click();
		expect(textoDaLista(antes)).toContain('Ja fechei esta');

		// O F5: o módulo morre e é carregado de novo. O `localStorage` fica.
		vi.resetModules();
		const depois = await montarMissoes();

		expect(textoDaLista(depois), 'a janela esqueceu a escolha').toContain('Ja fechei esta');
	});

	it('e o botão fica ACESO quando a escolha volta — o rótulo não pode mentir', async () => {
		// O par do caso acima: estado certo com o botão apagado é a mesma
		// família de defeito que `abaSobreviveAoF5` registra para as abas —
		// "a lista certa embaixo do rótulo errado".
		const antes = await montarMissoes();
		antes._host.querySelector('.mi-concluidas').click();

		vi.resetModules();
		const depois = await montarMissoes();
		const botao = depois._host.querySelector('.mi-concluidas');

		expect(botao.classList.contains('is-active')).toBe(true);
		expect(botao.getAttribute('aria-pressed')).toBe('true');
	});

	it('o botão NÃO é um `.mi-tab` — senão o portão da memória de aba passa a contá-lo', async () => {
		const MissoesIdle = await montarMissoes();
		const abas = MissoesIdle._host.querySelectorAll('.mi-tab');
		expect(abas.length, 'apareceu um terceiro `.mi-tab`').toBe(2);

		const botao = MissoesIdle._host.querySelector('.mi-concluidas');
		expect(botao, 'o interruptor sumiu do HTML').not.toBeNull();
		expect(botao.classList.contains('mi-tab'), 'o interruptor ganhou a classe de aba').toBe(false);
	});
});
