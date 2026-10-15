/**
 * A LISTA DO GRUPO RECOLHE (17/10/2026, relato de jogador no celular em pe:
 * *"esse negocio ocupa um espaco gigantesco e nao tem nenhum X"*, com nove
 * membros cobrindo ~40% da tela).
 *
 * Na janela real montada no jsdom: o botao da alca recolhe e abre, a escolha
 * fica guardada (volta recolhida depois de recarregar), recolhida ela para o
 * ticker das barras, o rotulo diz quantos sao, e o grupo grande ganha a marca
 * do modo compacto (o CSS do retrato o desenha em uma linha por membro).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..', '..');
const ler = (...p) => readFileSync(join(raiz, ...p), 'utf8');

const membros = (n) =>
	Array.from({ length: n }, (_, i) => ({
		contaId: 2000001 + i,
		nome: `Membro${i + 1}`,
		classe: 4,
		nivel: 50,
		vivo: true,
		online: true,
		souEu: i === 0,
		ehLider: i === 0
	}));

let vidasLidas = 0;

async function montar(n) {
	vi.resetModules();
	vi.doMock('Network/NetworkManager.js', () => ({ default: { sendPacket: vi.fn(), hookPacket: vi.fn() } }));
	vi.doMock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: (c) => c } }));
	vi.doMock('Renderer/EntityManager.js', () => ({
		default: {
			getLife: () => {
				vidasLidas++;
				return { hp: 500, hp_max: 1000 };
			}
		}
	}));
	vi.doMock('UI/Components/GrupoIdle/GrupoIdle.js', () => ({
		default: { estado: { grupo: { membros: membros(n) } } }
	}));
	const modulo = await import('UI/Components/PartyHud/PartyHud.js');
	const PartyHud = modulo.default;
	PartyHud._host = document.createElement('div');
	PartyHud._host.innerHTML = ler('src', 'UI', 'Components', 'PartyHud', 'PartyHud.html');
	PartyHud._shadow = null;
	PartyHud.init();
	return { PartyHud, host: PartyHud._host, MEMBROS_ANTES_DO_COMPACTO: modulo.MEMBROS_ANTES_DO_COMPACTO };
}

describe('a lista do grupo recolhe', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
		vidasLidas = 0;
	});
	afterEach(() => vi.useRealTimers());

	it('nasce aberta, com o botao de recolher e o rotulo com a contagem', async () => {
		const { PartyHud, host } = await montar(9);
		const hud = host.querySelector('.ph-hud');
		expect(hud.hidden).toBe(false);
		expect(hud.classList.contains('is-recolhido')).toBe(false);
		expect(host.querySelectorAll('.ph-membro')).toHaveLength(9);
		expect(host.querySelector('.ph-rotulo').textContent).toBe('Grupo (9)');
		expect(host.querySelector('.ph-recolher').title).toBe('Recolher');
		PartyHud.onRemove();
	});

	it('o botao recolhe e abre; recolhida, o ticker das barras para', async () => {
		const { PartyHud, host } = await montar(9);
		const hud = host.querySelector('.ph-hud');
		const botao = host.querySelector('.ph-recolher');
		botao.click();
		expect(hud.classList.contains('is-recolhido')).toBe(true);
		expect(botao.title).toBe('Mostrar');
		expect(hud.hidden).toBe(false); // a alca continua a vista, para abrir de novo
		vidasLidas = 0;
		vi.advanceTimersByTime(4000);
		expect(vidasLidas).toBe(0);
		botao.click();
		expect(hud.classList.contains('is-recolhido')).toBe(false);
		vidasLidas = 0;
		vi.advanceTimersByTime(4000);
		expect(vidasLidas).toBeGreaterThan(0);
		PartyHud.onRemove();
	});

	it('a escolha fica guardada: recarregada, ela volta recolhida', async () => {
		const primeira = await montar(3);
		primeira.host.querySelector('.ph-recolher').click();
		primeira.PartyHud.onRemove();
		const segunda = await montar(3);
		expect(segunda.host.querySelector('.ph-hud').classList.contains('is-recolhido')).toBe(true);
		expect(segunda.host.querySelector('.ph-recolher').title).toBe('Mostrar');
		segunda.PartyHud.onRemove();
	});

	it('o toque no botao nao chega a alca (nao vira arrasto)', async () => {
		const { PartyHud, host } = await montar(3);
		const naAlca = vi.fn();
		host.querySelector('.ph-alca').addEventListener('pointerdown', naAlca);
		host.querySelector('.ph-recolher').dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(naAlca).not.toHaveBeenCalled();
		PartyHud.onRemove();
	});

	it('o grupo grande ganha a marca do compacto; o pequeno nao', async () => {
		const grande = await montar(5);
		expect(grande.MEMBROS_ANTES_DO_COMPACTO).toBe(4);
		expect(grande.host.querySelector('.ph-hud').classList.contains('is-muitos')).toBe(true);
		grande.PartyHud.onRemove();
		const pequeno = await montar(4);
		expect(pequeno.host.querySelector('.ph-hud').classList.contains('is-muitos')).toBe(false);
		pequeno.PartyHud.onRemove();
	});

	it('o CSS: recolhida some a lista; no retrato o compacto tira a classe e o numero', () => {
		const css = ler('src', 'UI', 'Components', 'PartyHud', 'PartyHud.css');
		expect(css).toMatch(/\.ph-hud\.is-recolhido \.ph-membros \{ display: none; \}/);
		expect(css).toMatch(/:host-context\(html\.ri-vertical\) #PartyHud \.ph-hud\.is-muitos \.ph-classe,/);
		expect(css).toMatch(/\.ph-recolher::before \{[^}]*inset:\s*-14px/);
	});
});
