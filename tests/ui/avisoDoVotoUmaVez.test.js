/**
 * O AVISO DE VOTO UMA VEZ POR LIBERACAO (30/09/2026).
 *
 * Relato ao dono: o modal "Seu voto esta liberado!" aparecia demais. O servidor
 * manda `avisar` uma vez por CONEXAO, e conexao nova acontece a toda
 * reconexao, recarga e volta ao app. `avisoDoVoto.js` lembra a marca da
 * liberacao (conta, plataforma, `ultimoVotoMs`); o modal so abre para marca
 * nova. O botao "Votar" continua sendo o sinal permanente.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MARCAS_GUARDADAS, comAsVistas, marcasLiberadas, temAvisoNovo } from '../../src/UI/Components/VotoIdle/avisoDoVoto.js';

const plat = (id, liberado, ultimoVotoMs, ligada = true) => ({ id, ligada, liberado, ultimoVotoMs });

describe('o aviso de voto uma vez por liberacao', () => {
	it('so as plataformas LIGADAS e LIBERADAS dao marca, com a conta e o ultimo voto', () => {
		const ps = [plat('idlerank', true, 1000), plat('topidle', false, 2000), plat('outra', true, 0, false)];
		expect(marcasLiberadas(7, ps)).toEqual(['7:idlerank:1000']);
		expect(marcasLiberadas(7, null)).toEqual([]);
	});

	it('a primeira conexao avisa; a reconexao com a MESMA liberacao nao', () => {
		const ps = [plat('idlerank', true, 1000)];
		expect(temAvisoNovo(7, ps, [])).toBe(true);
		const vistas = comAsVistas(7, ps, []);
		expect(temAvisoNovo(7, ps, vistas)).toBe(false);
	});

	it('um voto creditado e a liberacao seguinte avisam de novo, uma vez', () => {
		const vistas = comAsVistas(7, [plat('idlerank', true, 1000)], []);
		const depoisDoVoto = [plat('idlerank', true, 1000 + 12 * 3600 * 1000)];
		expect(temAvisoNovo(7, depoisDoVoto, vistas)).toBe(true);
		expect(temAvisoNovo(7, depoisDoVoto, comAsVistas(7, depoisDoVoto, vistas))).toBe(false);
	});

	it('outra plataforma liberada, ou outra conta no mesmo aparelho, e aviso novo', () => {
		const vistas = comAsVistas(7, [plat('idlerank', true, 1000)], []);
		expect(temAvisoNovo(7, [plat('idlerank', true, 1000), plat('topidle', true, 0)], vistas)).toBe(true);
		expect(temAvisoNovo(8, [plat('idlerank', true, 1000)], vistas)).toBe(true);
	});

	it('sem nada liberado nao ha aviso, e a lista guardada tem teto', () => {
		expect(temAvisoNovo(7, [plat('idlerank', false, 1000)], [])).toBe(false);
		let vistas = [];
		for (let i = 0; i < MARCAS_GUARDADAS + 10; i++) vistas = comAsVistas(7, [plat('p', true, i)], vistas);
		expect(vistas).toHaveLength(MARCAS_GUARDADAS);
		expect(vistas[vistas.length - 1]).toBe(`7:p:${MARCAS_GUARDADAS + 9}`);
	});

	it('a janela usa a peca: o modal so abre com aviso novo, e grava o que mostrou', () => {
		const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
		const js = semComentario(readFileSync('src/UI/Components/VotoIdle/VotoIdle.js', 'utf8'));
		expect(js).toContain('dados.avisar && dados.liberados > 0 && temAvisoNovo(Session.AID, dados.plataformas, vistos)');
		expect(js).toContain('_preferences.avisosVistos = comAsVistas(Session.AID, dados.plataformas, vistos);');
		expect(js).toContain('_preferences.save();');
	});
});
