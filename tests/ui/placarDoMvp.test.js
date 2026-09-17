/**
 * O PLACAR AO VIVO DO MVP (D-1533): a montagem pura e a fiacao no cliente.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatarDano, htmlDoPlacar, lerPlacar, LINHAS_DO_PLACAR, PLACAR_SOME_EM_MS } from 'UI/Components/PlacarMvpIdle/placarDoMvp.js';

const DADOS = {
	ativo: true,
	mvp: 'Baphomet',
	hp: 42,
	top: [
		{ nome: 'Ana', dano: 1234567, fatia: 61 },
		{ nome: 'Bia', dano: 500000, fatia: 24 },
		{ nome: 'Cai', dano: 100000, fatia: 5 },
		{ nome: 'Dio', dano: 90000, fatia: 4 },
		{ nome: 'Eva', dano: 80000, fatia: 3 },
		{ nome: 'Fui', dano: 70000, fatia: 3 },
	],
	eu: { posicao: 2, dano: 500000 },
};

describe('o placar do MVP, montado (D-1533)', () => {
	it('as constantes: 5 linhas e some em 3 s sem pacote', () => {
		expect(LINHAS_DO_PLACAR).toBe(5);
		expect(PLACAR_SOME_EM_MS).toBe(3000);
	});

	it('o dano ganha o separador de milhar', () => {
		expect(formatarDano(1234567)).toBe('1.234.567');
		expect(formatarDano(999)).toBe('999');
		expect(formatarDano(-5)).toBe('0');
		expect(formatarDano('x')).toBe('0');
	});

	it('sem disputa, nada', () => {
		expect(htmlDoPlacar(null)).toBe('');
		expect(htmlDoPlacar({ ativo: false })).toBe('');
		// O MVP morreu: o servidor manda `ativo:false`, e a lista antiga nao volta.
		expect(htmlDoPlacar({ ...DADOS, ativo: false })).toBe('');
		expect(htmlDoPlacar({ ativo: true, top: [] })).toBe('');
	});

	it('mostra o MVP, a vida, os 5 primeiros e a linha de quem ve', () => {
		const html = htmlDoPlacar(DADOS);
		expect(html).toContain('MVP · Baphomet');
		expect(html).toContain('width:42%');
		expect((html.match(/class="pm-linha /g) || []).length).toBe(5);
		expect(html).toContain('1.234.567');
		expect(html).not.toContain('Fui');
		expect(html).toContain('pm-pos-1');
		expect(html).toContain('Você: 2º · 500.000');
	});

	it('quem esta fora do top 10 ve isso escrito; quem nao bateu nao ve linha', () => {
		expect(htmlDoPlacar({ ...DADOS, eu: { posicao: null, dano: 10 } })).toContain('fora do top 10');
		expect(htmlDoPlacar({ ...DADOS, eu: { posicao: null, dano: 0 } })).not.toContain('pm-eu');
	});

	it('D-1543: quem saiu do mapa aparece na vaga, apagado e escrito', () => {
		const html = htmlDoPlacar({ ...DADOS, top: [{ nome: 'Saiu', dano: 9, fatia: 90, fora: true }, { nome: 'Ficou', dano: 1, fatia: 10 }] });
		expect(html).toContain('pm-pos-1 pm-fora');
		expect(html).toContain('Saiu <em>(fora do mapa)</em>');
		expect(html).not.toContain('pm-pos-2 pm-fora');
		expect(html).toContain('Ficou</span>');
	});

	it('o nome e escapado e a vida fica entre 0 e 100', () => {
		const html = htmlDoPlacar({ ...DADOS, mvp: '<b>', hp: 250, top: [{ nome: '<i>', dano: 1, fatia: 100 }] });
		expect(html).toContain('&lt;b&gt;');
		expect(html).toContain('&lt;i&gt;');
		expect(html).toContain('width:100%');
	});

	it('JSON torto nao derruba nada', () => {
		expect(lerPlacar('{')).toBeNull();
		expect(lerPlacar('{"ativo":true}')).toEqual({ ativo: true });
	});
});

describe('a fiacao do placar (D-1533)', () => {
	const ler = (c) => readFileSync(join(process.cwd(), 'src', c), 'utf8');

	it('o componente e o unico dono do 0x0fbd', () => {
		const comp = ler('UI/Components/PlacarMvpIdle/PlacarMvpIdle.js');
		expect(comp).toContain('Network.hookPacket(PACKET.ZC.RAGIDLE_PLACAR_MVP, receber)');
		expect(ler('Network/PacketRegister.js')).toContain('0x0fbd: PACKET.ZC.RAGIDLE_PLACAR_MVP,');
		expect(ler('Network/Packets/packets2021_len_main.js')).toContain('length_list[0x0fbd] = -1;');
	});

	it('entra no jogo DEPOIS do estou-pronto, isolado, e limpa na troca de personagem', () => {
		const engine = ler('Engine/MapEngine.js');
		const pronto = engine.indexOf('Network.sendPacket(new PACKET.CZ.NOTIFY_ACTORINIT());');
		const append = engine.indexOf("ligarAcessorioDaHud('placar do MVP', () => PlacarMvpIdle.append());");
		expect(pronto).toBeGreaterThan(-1);
		expect(append).toBeGreaterThan(pronto);
		expect(engine).toContain("ligarAcessorioDaHud('placar do MVP', () => PlacarMvpIdle.prepare());");
		expect(engine).toMatch(/PartyHud,\r?\n\t+PlacarMvpIdle,/);
	});

	it('no celular em pe ele tem posicao propria', () => {
		expect(ler('UI/Common.css')).toContain('html.ri-vertical #PlacarMvpIdle {');
	});
});
