/**
 * A JANELA DE GRUPO FECHADA NAO DESENHA (auditoria de desempenho de
 * 15/10/2026, no molde do BotMenu, D-2385).
 *
 * Todo `ZC_RAGIDLE_GRUPO` passava por `desenharTudo()`, mesmo com a janela
 * fechada. A decisao (`desenhoAdiado.js`) e exercitada de verdade; a costura
 * no `GrupoIdle` e lida do fonte, como em `transferirLideranca.test.js` (a
 * janela nao monta facil em jsdom).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { criarDesenhoAdiado } from '../../src/UI/Components/GrupoIdle/desenhoAdiado.js';

function montar(aberta) {
	const estado = { aberta, desenhos: 0 };
	const d = criarDesenhoAdiado({ aberta: () => estado.aberta, desenhar: () => estado.desenhos++ });
	return { estado, d };
}

describe('o desenho adiado', () => {
	it('fechada: dez empurroes nao desenham nada, e a janela fica suja', () => {
		const { estado, d } = montar(false);
		for (let i = 0; i < 10; i++) d.mudou();
		expect(estado.desenhos).toBe(0);
		expect(d.estaSuja()).toBe(true);
	});

	it('ao abrir, desenha o ultimo estado UMA vez; abrir de novo sem mudanca nao redesenha', () => {
		const { estado, d } = montar(false);
		d.mudou();
		d.mudou();
		estado.aberta = true;
		d.abriu();
		expect(estado.desenhos).toBe(1);
		d.abriu();
		expect(estado.desenhos).toBe(1);
	});

	it('aberta: todo empurrao desenha, como antes', () => {
		const { estado, d } = montar(true);
		for (let i = 0; i < 3; i++) d.mudou();
		expect(estado.desenhos).toBe(3);
		expect(d.estaSuja()).toBe(false);
	});

	it('desenhar ja (montagem, troca de personagem) limpa a sujeira', () => {
		const { estado, d } = montar(false);
		d.mudou();
		d.agora();
		expect(estado.desenhos).toBe(1);
		estado.aberta = true;
		d.abriu();
		expect(estado.desenhos).toBe(1);
	});
});

describe('a costura no GrupoIdle', () => {
	const fonte = readFileSync(join(process.cwd(), 'src/UI/Components/GrupoIdle/GrupoIdle.js'), 'utf8').replace(
		/\r\n/g,
		'\n'
	);

	it('o gancho do ZC_RAGIDLE_GRUPO suja em vez de desenhar, e avisa a HUD de party como antes', () => {
		const i = fonte.indexOf('Network.hookPacket(PACKET.ZC.RAGIDLE_GRUPO');
		expect(i).toBeGreaterThan(-1);
		const gancho = fonte.slice(i, fonte.indexOf('\n});', i));
		expect(gancho).toContain('_desenho.mudou();');
		expect(gancho).not.toContain('desenharTudo()');
		expect(gancho).toContain('GrupoIdle.aoAtualizar();');
		expect(gancho.indexOf('GrupoIdle.estado = dados;')).toBeLessThan(gancho.indexOf('_desenho.mudou();'));
	});

	it('as duas portas que abrem a janela desenham o que ficou sujo', () => {
		for (const porta of ['GrupoIdle.abrir = function abrir() {', 'GrupoIdle.onAppend = function onAppend() {']) {
			const i = fonte.indexOf(porta);
			expect(i, porta).toBeGreaterThan(-1);
			const corpo = fonte.slice(i, fonte.indexOf('\n};', i));
			const abre = corpo.indexOf("classList.add('is-open')");
			expect(abre, porta).toBeGreaterThan(-1);
			expect(corpo.indexOf('_desenho.abriu();'), porta).toBeGreaterThan(abre);
		}
	});

	it('a decisao de aberta e a classe is-open da janela', () => {
		expect(fonte).toMatch(/const _desenho = criarDesenhoAdiado\(\{\n\taberta: \(\) => \{\n\t\tconst win = raiz\(\)\.querySelector\('\.gi-window'\);\n\t\treturn !!\(win && win\.classList\.contains\('is-open'\)\);/);
	});
});
