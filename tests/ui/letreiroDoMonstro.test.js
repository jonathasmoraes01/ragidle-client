import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { letreiroFixo } from '../../src/Engine/MapEngine/letreiroFixo.js';

/*
 * O NOME DO MONSTRO SEMPRE VISIVEL, abaixo da barra de HP (24/09/2026, pedido
 * do dono com o print: os mobs mostravam so a barra).
 *
 * Que o nome APARECE e legivel no mapa e medido na tela (fotos da prova); aqui
 * ficam a regra de quem ganha o letreiro e os dois fios que a fazem valer.
 */
const TIPOS = { TYPE_PC: 0, TYPE_MOB: 5, TYPE_NPC: 6 };

describe('letreiroFixo', () => {
	it('monstro tem letreiro sempre, com ou sem a opcao dos jogadores', () => {
		expect(letreiroFixo(TIPOS.TYPE_MOB, TIPOS, {})).toBe(true);
		expect(letreiroFixo(TIPOS.TYPE_MOB, TIPOS, { showPlayerNames: false })).toBe(true);
	});

	it('jogador segue a opcao de video, e preferencia antiga (sem o campo) vale ligado', () => {
		expect(letreiroFixo(TIPOS.TYPE_PC, TIPOS, {})).toBe(true);
		expect(letreiroFixo(TIPOS.TYPE_PC, TIPOS, { showPlayerNames: true })).toBe(true);
		expect(letreiroFixo(TIPOS.TYPE_PC, TIPOS, { showPlayerNames: false })).toBe(false);
	});

	it('NPC continua por hover', () => {
		expect(letreiroFixo(TIPOS.TYPE_NPC, TIPOS, {})).toBe(false);
	});
});

const ler = rel => readFileSync(resolve(import.meta.dirname, '../../src', rel), 'utf8').replace(/\r\n/g, '\n');

describe('os fios do letreiro do monstro', () => {
	it('aplicar() decide por letreiroFixo e o monstro so pede o nome se veio sem ele', () => {
		const fonte = ler('Engine/MapEngine/NomesDosJogadores.js');
		const corpo = fonte.slice(fonte.indexOf('function aplicar('), fonte.indexOf('function reaplicarEmTodos('));
		expect(corpo).toContain('letreiroFixo(entity.objecttype, Entity, GraphicsSettings)');
		expect(corpo).toContain('if (ehJogador(entity) || !entity.display.name) {');
		expect(corpo).toContain('entity.display.fixo = true;');
		expect(corpo).toContain('entity.display.add();');
	});

	it('perder o foco (trocar de alvo) nao apaga o letreiro fixo', () => {
		const fonte = ler('Controls/EntityControl.js');
		const inicio = fonte.indexOf('static onFocusEnd()');
		expect(inicio).toBeGreaterThan(-1);
		const corpo = fonte.slice(inicio, fonte.indexOf('lock on arrow', inicio));
		expect(corpo).toMatch(/if \(!this\.display\.fixo\) \{\s*this\.display\.display = false;\s*this\.display\.remove\(\);\s*\}/);
	});

	it('o nome do monstro nasce no spawn: onEntitySpam aplica o letreiro a toda entidade nova', () => {
		const fonte = ler('Engine/MapEngine/Entity.js');
		const corpo = fonte.slice(fonte.indexOf('function onEntitySpam('), fonte.indexOf('if (pkt.job == 45)'));
		expect(corpo).toContain('NomesDosJogadores.aplicar(entity);');
	});
});
