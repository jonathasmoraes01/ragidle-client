/**
 * A TELA PRETA AO TROCAR DE ABA E ESCOLHA (D-2598, 16/10/2026; sucede a
 * "economia de energia automatica desligavel" de 23/09/2026). A opcao mora nas
 * Configuracoes de Video, nasce DESLIGADA, e escolhe so a tela: o aviso ao
 * servidor sai com ela ligada ou nao (provado com relogio falso em
 * `atrasoDaEconomia.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = join(__dirname, '..', '..', 'src');
const ler = rel => readFileSync(join(src, rel), 'utf8');
const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('a tela preta ao trocar de aba', () => {
	it('nasce DESLIGADA, numa chave NOVA (a velha esta gravada `true` em todo jogador antigo)', () => {
		const prefs = semComentario(ler('Preferences/Graphics.js'));
		expect(prefs).toMatch(/telaPretaAoTrocarDeAba: false,/);
		expect(prefs, 'a chave velha nao tem mais leitor nem padrao').not.toMatch(/economiaDeEnergiaAutomatica/);
	});

	it('a opcao esta nas Configuracoes de Video, le e grava a chave nova', () => {
		const html = ler('UI/Components/GraphicsOption/GraphicsOption.html');
		expect(html).toContain('class="economia-automatica"');
		expect(html).toContain('Apagar a tela ao trocar de aba');
		const js = ler('UI/Components/GraphicsOption/GraphicsOption.js');
		expect(js).toContain("bindChange('.economia-automatica', onToggleEconomiaAutomatica);");
		expect(js).toContain("root.querySelector('.economia-automatica').checked = GraphicsSettings.telaPretaAoTrocarDeAba === true;");
		expect(js).toContain('GraphicsSettings.telaPretaAoTrocarDeAba = !!this.checked;');
	});

	it('o gatilho le a opcao so para a TELA; nenhum leitor da chave velha sobrou no cliente', () => {
		const motor = ler('Engine/MapEngine.js');
		expect(motor).toContain('telaPretaEscolhida: () => GraphicsSettings.telaPretaAoTrocarDeAba === true,');
		for (const arquivo of ['Engine/MapEngine.js', 'Engine/gatilhoDaEconomia.js', 'UI/Components/GraphicsOption/GraphicsOption.js']) {
			expect(semComentario(ler(arquivo)), arquivo).not.toMatch(/economiaDeEnergiaAutomatica|automaticaLigada/);
		}
	});
});
