/**
 * A % DA EXP TEM DE CABER NA BARRA QUE A CONTEM (D-1486, 15/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O RELATO
 * ---------------------------------------------------------------------------
 * Dono, jogando no iPhone (402x714, dpr 3): *"no mobile ainda nao esta
 * aparecendo a % do level atual (a altura da barra de exp esta pequena)"*.
 *
 * O diagnostico dele estava certo. A % nasceu em D-1319 com `line-height: 14px`
 * CRAVADO, casando com a altura do trilho no desktop. Mas TRES outras regras
 * encolhem o trilho — 6px no celular em pe, 4px na tela baixa, 4px no compacto
 * — e nenhuma foi visitada por aquela rodada. Com `overflow: hidden` no trilho,
 * o texto de 9px dentro de uma caixa de linha de 14px sobrava ~3,5px de ~9px de
 * glifo: **o jogador via o topo dos digitos e mais nada.**
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE PORTAO MEDE A REGRA, E NAO OS TRES NUMEROS
 * ---------------------------------------------------------------------------
 * Consertar as tres regras a mao deixaria a QUARTA — a que alguem escrever
 * amanha — livre para repetir o mesmo defeito em silencio, e este projeto tem
 * nome para isso: "duas rotas, e a segunda escrita a mao".
 *
 * Entao o que ele cobra e o ACOPLAMENTO: quem declara a altura do trilho
 * declara junto o que fazer com o texto. Um numero solto em `height` do
 * `.bi-exp-track` reprova aqui mesmo que o valor escolhido seja generoso —
 * porque o problema nunca foi o valor, foi o texto nao saber dele.
 *
 * O piso de 12px e medido e nao arbitrario: a fonte da % e `9px`, e abaixo de
 * ~12px de caixa de linha o glifo comeca a ser cortado pelo `overflow: hidden`.
 * Trilho mais fino que isso e legitimo (o compacto e uma risca de proposito) —
 * o que nao e legitimo e mostrar meio digito, entao ali a % APAGA.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync('src/UI/Components/BasicInfoIdle/BasicInfoIdle.css', 'utf8');

/** Corta os comentarios: eles citam numeros e alturas ao explicar a cicatriz. */
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Os blocos `{...}` que mexem no trilho da EXP, com o seletor que os abre.
 * Le o CSS SEM comentario de proposito — um comentario que escreva
 * `height: 4px` ao narrar a historia nao e uma regra, e contaria como uma.
 */
function blocosDoTrilho() {
	const achados = [];
	const re = /([^{}]*\.bi-exp-track[^{}]*)\{([^}]*)\}/g;
	let m;
	while ((m = re.exec(SEM_COMENTARIO)) !== null) {
		achados.push({ seletor: m[1].trim().replace(/\s+/g, ' '), corpo: m[2] });
	}
	return achados;
}

describe('a % da EXP cabe na barra que a contem', () => {
	it('ha blocos de trilho para medir (senao este arquivo aprova de graca)', () => {
		// O controle: um regex que para de casar tornaria todos os casos abaixo
		// verdes por vacuidade, que e a armadilha que este projeto mais repete.
		expect(blocosDoTrilho().length).toBeGreaterThanOrEqual(4);
	});

	it('a % herda a altura do trilho, em vez de repetir um numero', () => {
		const i = SEM_COMENTARIO.indexOf('.bi-exp-pct {');
		expect(i, 'a regra da % sumiu').toBeGreaterThan(-1);
		const regra = SEM_COMENTARIO.slice(i, SEM_COMENTARIO.indexOf('}', i));
		expect(
			regra,
			'`line-height` com numero solto e o defeito original: ele descasa do trilho na primeira regra que encolher a barra'
		).toMatch(/line-height:\s*var\(--bi-exp-altura/);
	});

	it('NENHUM bloco do trilho crava a altura fora da variavel', () => {
		for (const { seletor, corpo } of blocosDoTrilho()) {
			const altura = /(^|[;{\s])height:\s*([^;]+);/.exec(corpo);
			if (!altura) {
				continue; // bloco que mexe noutra coisa (margin, display)
			}
			expect(
				altura[2].trim(),
				`"${seletor}" crava a altura em vez de passar por --bi-exp-altura — foi exatamente assim que a % ficou cortada no iPhone`
			).toMatch(/var\(--bi-exp-altura/);
		}
	});

	it('trilho fino demais para 9px APAGA a %, em vez de corta-la ao meio', () => {
		const PISO_LEGIVEL = 12;
		let finos = 0;
		for (const { seletor, corpo } of blocosDoTrilho()) {
			const declarada = /--bi-exp-altura:\s*(\d+)px/.exec(corpo);
			if (!declarada) {
				continue;
			}
			const px = Number(declarada[1]);
			if (px >= PISO_LEGIVEL) {
				continue;
			}
			finos++;
			expect(
				corpo,
				`"${seletor}" deixa o trilho em ${String(px)}px, abaixo do piso de ${String(PISO_LEGIVEL)}px, e NAO apaga a % — o jogador veria meio digito`
			).toMatch(/--bi-exp-pct-visivel:\s*none/);
		}
		// CONTROLE POSITIVO: se nenhum bloco fosse fino, o caso acima nao teria
		// medido nada e passaria calado.
		expect(finos, 'nenhum trilho fino para medir — o caso acima nao provou nada').toBeGreaterThan(0);
	});

	it('o celular EM PE mostra a %: o trilho dele alcanca o piso legivel', () => {
		// Esta e a regra do aparelho do dono (402x714, dedo, retrato). Ela e a
		// razao de a rodada existir, entao tem caso proprio em vez de depender
		// dos genericos acima.
		const vertical = blocosDoTrilho().find(b => b.seletor.includes('.ri-vertical'));
		expect(vertical, 'sumiu a regra do celular em pe').toBeTruthy();
		const declarada = /--bi-exp-altura:\s*(\d+)px/.exec(vertical.corpo);
		expect(declarada, 'o celular em pe nao declara a altura pela variavel').toBeTruthy();
		expect(
			Number(declarada[1]),
			'com menos que isto a % volta a sair cortada no iPhone do dono'
		).toBeGreaterThanOrEqual(12);
		expect(vertical.corpo, 'o celular em pe nao pode apagar a %: e a tela do relato').not.toMatch(
			/--bi-exp-pct-visivel:\s*none/
		);
	});
});
