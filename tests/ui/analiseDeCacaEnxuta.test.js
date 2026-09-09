/**
 * O MODO ENXUTO DA ANALISE DE CACA - e, principalmente, a PORTA dele.
 *
 * O modo enxuto e do master (08/09/2026, ordem do dono: *"igual fizemos com a
 * janela Personagem"*) e chegou SEM caso nenhum. Esta frente trazia um modo
 * compacto proprio, descartado na integracao (D-1246) por ser a mesma entrega
 * duas vezes - o que sobreviveu dela foi a MEDIDA da porta, que e o que este
 * arquivo prende.
 *
 * Levantar a janela puxa WebGL e uma sessao logada, entao a costura se confere
 * no fonte; quem olha a janela de verdade e `scripts/sonda-tela-alfa.ts`, no
 * repositorio do servidor, com clique de mouse e `elementFromPoint`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = join(process.cwd(), 'src/UI/Components/HuntAnalyzer');
const html = readFileSync(join(base, 'HuntAnalyzer.html'), 'utf8');
const js = readFileSync(join(base, 'HuntAnalyzer.js'), 'utf8');
const css = readFileSync(join(base, 'HuntAnalyzer.css'), 'utf8');

describe('a PORTA do modo enxuto', () => {
	it('o botao existe no cabecalho, com verbo e com nome acessivel', () => {
		expect(html).toContain('class="ha-minimize ri-close"');
		expect(html).toMatch(/title="Recolher"/);
		expect(html).toMatch(/aria-label="Recolher para o modo enxuto"/);
	});

	it('o botao tem lugar PROPRIO - e longe o bastante do "x" para o dedo', () => {
		/*
		 * A cicatriz mais cara desta rodada. `.ri-close` do design system e
		 * `position:absolute; right:8px; top:50%` (Common.css): dois botoes com
		 * essa classe caem no MESMO pixel, e o que vem depois no DOM fica por
		 * cima. Esta frente ja shipou um botao invisivel assim - existia,
		 * funcionava por codigo, e o jogador nao tinha como clicar.
		 *
		 * 34px (o valor que veio do master) resolve o EMPILHAMENTO mas nao o
		 * dedo: com o colchao de 44px que o `::before` de `inset:-12px` da a
		 * cada um, centros a 26px deixam o "Fechar" comendo metade do alvo do
		 * "Recolher". 52px poe os centros a 44px - os alvos se encostam no meio
		 * do caminho, e nenhum rouba o outro. Medido em 393x852 com toque.
		 */
		const bloco = css.slice(css.indexOf('.ha-minimize {'));
		expect(bloco.slice(0, 120)).toMatch(/right:\s*52px/);
		expect(bloco.slice(0, 120)).not.toMatch(/right:\s*(8|34)px/);
	});

	it('o titulo tem teto E nao quebra linha - os dois, ou o cabecalho engorda', () => {
		// O teto sozinho ja reprovou: com folga demais o titulo virou duas
		// linhas ("Analise de / Caca") e o cabecalho dobrou de altura.
		const bloco = css.slice(css.indexOf('.ha-titulo {'));
		expect(bloco.slice(0, 300)).toContain('max-width');
		expect(bloco.slice(0, 300)).toContain('white-space: nowrap');
	});

	it('o clique do botao chama o alternador - e nao vaza para o arrasto do cabecalho', () => {
		// A ancora e o ADDEVENTLISTENER: `.ha-minimize` aparece duas vezes no
		// arquivo, e a primeira e a do `aplicarCompacto` (que so troca o verbo).
		const trecho = js.slice(js.indexOf(".querySelector('.ha-minimize').addEventListener"));
		expect(trecho.slice(0, 260)).toContain('HuntAnalyzer.alternarCompacto()');
		// O cabecalho e a alca de arrasto: sem o `stopPropagation` o clique no
		// botao comeca a arrastar a janela junto.
		expect(trecho.slice(0, 260)).toContain('stopPropagation');
	});
});

describe('o que o enxuto esconde - e o que ele NAO toca', () => {
	it('somem as abas, as metricas, a nota e as listas; a cabine e os ritmos ficam', () => {
		const escondidos = css.slice(css.indexOf('#HuntAnalyzer.is-compact .ha-abas'));
		const bloco = escondidos.slice(0, escondidos.indexOf('}') + 1);
		for (const alvo of ['.ha-abas', '.ha-metricas', '.ha-nota', '.ha-bloco']) {
			expect(bloco).toContain(alvo);
		}
		// O cronometro e os ritmos por hora sao o motivo de o modo existir:
		// esconde-los seria recolher a janela inteira, que e o que o "x" faz.
		expect(bloco).not.toContain('.ha-cabine');
		expect(bloco).not.toContain('.ha-ritmos');
	});

	it('o verbo do botao acompanha o estado - restaurar e o MESMO botao', () => {
		const trecho = js.slice(js.indexOf('function aplicarCompacto'));
		expect(trecho.slice(0, 900)).toContain("'Restaurar'");
		expect(trecho.slice(0, 900)).toContain('Restaurar a janela completa');
	});

	it('a classe vai no #HuntAnalyzer E no host - a altura fixa mora no `:host`', () => {
		const trecho = js.slice(js.indexOf('function aplicarCompacto'));
		expect(trecho.slice(0, 900)).toContain("classList.toggle('is-compact'");
		expect(trecho.slice(0, 900)).toContain('HuntAnalyzer._host');
		expect(css).toContain(':host(.is-compact)');
	});

	it('o modo lembrado sobrevive ao F5, como a aba', () => {
		expect(js).toContain('compacto: false');
		const trecho = js.slice(js.indexOf('HuntAnalyzer.alternarCompacto'));
		expect(trecho.slice(0, 300)).toContain('_preferences.save()');
	});

	it('alternar NAO mexe em dado: so classe, preferencia e o verbo do botao', () => {
		/*
		 * A coleta continua correndo por baixo - o tique atualiza os MESMOS
		 * elementos nos dois modos. Se um dia `aplicarCompacto` passar a zerar,
		 * somar ou reescrever numero, este caso cai.
		 */
		const trecho = js.slice(
			js.indexOf('function aplicarCompacto'),
			js.indexOf('HuntAnalyzer.alternarCompacto'),
		);
		expect(trecho).not.toMatch(/registroDaCaca|zerar|reiniciar|\.textContent\s*=/);
	});
});
