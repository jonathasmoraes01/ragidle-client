/**
 * O BOTAO DE DESMONTAR DA MOCHILA (D-2052, 06/10/2026).
 *
 * A Mochila esconde a janela de equipamento nativa e, com ela, o "off" que
 * desmonta o Peco Peco: o Cavaleiro montava no Breeder e nao tinha como descer
 * (achado pela sonda `diag-montaria-na-tela` do servidor). A regra pura
 * (`montadoNoPeco`) e as COSTURAS entre arquivos, lidas no fonte — o metodo de
 * `transferenciaDoCarrinho.test.js`. Quem mede o jogo montado e a sonda.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import StatusConst from 'DB/Status/StatusState.js';
import { montadoNoPeco } from 'UI/Components/MochilaIdle/montariaNaMochila.js';
import StatusInfo from 'DB/Status/StatusInfo.js';
import SC from 'DB/Status/StatusConst.js';
import { emPortugues } from 'DB/Status/StatusInfoPtBr.js';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8').replaceAll('\r\n', '\n');

describe('montadoNoPeco', () => {
	it('le o bit OPTION_RIDING (0x20) do effectState', () => {
		expect(StatusConst.EffectState.RIDING).toBe(0x20);
		expect(montadoNoPeco({ effectState: 0x20 })).toBe(true);
		expect(montadoNoPeco({ effectState: 0x20 | 0x08 })).toBe(true);
	});

	it('a pe, com carrinho ou com falcao, NAO esta montado (o mesmo pacote devolveria o carrinho)', () => {
		expect(montadoNoPeco({ effectState: 0 })).toBe(false);
		expect(montadoNoPeco({ effectState: StatusConst.EffectState.CART1 })).toBe(false);
		expect(montadoNoPeco({ effectState: StatusConst.EffectState.FALCON })).toBe(false);
		expect(montadoNoPeco({})).toBe(false);
		expect(montadoNoPeco(null)).toBe(false);
		expect(montadoNoPeco(undefined)).toBe(false);
	});
});

describe('a costura do botao na Mochila', () => {
	const html = ler('UI/Components/MochilaIdle/MochilaIdle.html');
	const js = ler('UI/Components/MochilaIdle/MochilaIdle.js');
	const css = ler('UI/Components/MochilaIdle/MochilaIdle.css');

	it('o botao nasce ESCONDIDO, ao lado do boneco', () => {
		const boneco = html.slice(html.indexOf('<div class="mo-boneco">'), html.indexOf('<div class="mo-coluna mo-coluna-dir">'));
		expect(boneco).toMatch(/<button type="button" class="mo-desmontar ri-btn ri-btn--sec"[^>]* hidden>Desmontar<\/button>/);
	});

	it('o clique manda o CZ_REQ_CARTOFF, e so montado', () => {
		const i = js.indexOf("root.querySelector('.mo-desmontar')");
		expect(i).toBeGreaterThan(0);
		const corpo = js.slice(i, js.indexOf('\n\t}\n', i));
		expect(corpo).toContain('if (!montadoNoPeco(Session.Entity)) {');
		expect(corpo).toContain('Network.sendPacket(new PACKET.CZ.REQ_CARTOFF());');
		expect(corpo.indexOf('montadoNoPeco')).toBeLessThan(corpo.indexOf('REQ_CARTOFF'));
	});

	it('o laco de 250 ms mostra e esconde o botao pelo bit', () => {
		const sync = js.slice(js.indexOf('function syncAll() {'), js.indexOf('\n}\n', js.indexOf('function syncAll() {')));
		expect(sync).toContain('syncBotaoDeDesmontar();');
		const f = js.slice(js.indexOf('function syncBotaoDeDesmontar() {'));
		expect(f).toContain('const esconder = !montadoNoPeco(Session.Entity);');
	});

	it('o [hidden] vence o inline-flex do .ri-btn, e o dedo tem a area de 44px', () => {
		expect(css).toMatch(/\.mo-desmontar\[hidden\] \{\n\tdisplay: none;\n\}/);
		expect(css).toMatch(/@media \(pointer: coarse\) \{\n\t\.mo-desmontar::before \{\n\t\tcontent: '';\n\t\tposition: absolute;\n\t\tinset: -12px -6px;/);
	});
});

describe('o icone da montaria (EFST_RIDING, 27)', () => {
	it('a dica sai em portugues, e nao "Riding Vehicle"', () => {
		const info = StatusInfo[SC.RIDING];
		expect(SC.RIDING).toBe(27);
		expect(info.descript[0][0]).toBe('Riding Vehicle');
		expect(emPortugues(info.descript[0][0])).toBe('Montado no Peco Peco');
	});
});
