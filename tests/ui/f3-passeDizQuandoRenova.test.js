/**
 * A JANELA DO PASSE DIZ QUANDO A RENOVACAO ABRE (D-1720, 21/09/2026).
 *
 * Ordem do dono: *"a interface deve refletir QUANDO a renovacao estara
 * disponivel"*.
 *
 * O backend (D-1640) passou a mandar `venceEmMs` e `renovaEmMs` por passe.
 * Campo que chega e ninguem le NAO e requisito atendido - este arquivo e o que
 * guarda essa metade.
 *
 * Ele le o FONTE (importar o componente arrastaria o cliente inteiro) e
 * EXECUTA a formatacao por um recorte: o que importa aqui e a REGRA - instante
 * absoluto vira data local, ausencia cai no texto generico -, e ela e
 * aritmetica de `Date`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTE = readFileSync(
	join(process.cwd(), 'src', 'UI', 'Components', 'PasseIdle', 'PasseIdle.js'),
	'utf8'
);

/** O corpo de uma funcao do componente, do nome dela em diante. */
function corpoDe(nome, tamanho = 2200) {
	const i = FONTE.indexOf(`function ${nome}(`);
	expect(i, `a funcao \`${nome}\` sumiu do PasseIdle`).toBeGreaterThan(0);
	return FONTE.slice(i, i + tamanho);
}

/** A mesma funcao do componente, recortada do fonte e executada de verdade. */
function quandoAbreDoFonte() {
	const corpo = corpoDe('quandoAbre', 700);
	const fim = corpo.indexOf('}\r\n\r\n') >= 0 ? corpo.indexOf('}\r\n\r\n') : corpo.indexOf('}\n\n');
	// eslint-disable-next-line no-new-func
	return new Function(`${corpo.slice(0, fim + 1)}\nreturn quandoAbre;`)();
}

describe('a nota do passe diz QUANDO a renovacao abre', () => {
	it('um instante vira data e hora LOCAIS', () => {
		const quandoAbre = quandoAbreDoFonte();
		const alvo = new Date(2026, 8, 22, 3, 5, 0); // 22/09/2026 03:05 local
		expect(quandoAbre(alvo.getTime())).toBe('22/09 às 03:05');
	});

	it('sem o campo (registro velho, ou botao ja aberto) devolve null', () => {
		const quandoAbre = quandoAbreDoFonte();
		expect(quandoAbre(null)).toBeNull();
		expect(quandoAbre(undefined)).toBeNull();
		expect(quandoAbre(0)).toBeNull();
		expect(quandoAbre(Number.NaN)).toBeNull();
	});

	it('a nota de `ainda-nao-vence` usa `renovaEmMs` e nomeia a regra NOVA', () => {
		const corpo = corpoDe('acaoHtml');
		expect(corpo).toContain('quandoAbre(passe.renovaEmMs)');
		expect(corpo).toContain('últimas 24 horas');
		expect(
			corpo,
			'a nota ainda diz "no último dia" — essa regra morreu em D-1640'
		).not.toContain('abre no último dia');
	});

	it('o botao continua DESENHANDO o veredito do servidor, sem conta propria', () => {
		/*
		 * A busca e no CODIGO, e nao no arquivo inteiro: o comentario de
		 * `acaoHtml` cita `podePagar = cash >= passe.cash` DE PROPOSITO, para
		 * contar por que aquela conta saiu. Casar o comentario faria o portao
		 * reprovar exatamente a memoria que ele existe para proteger.
		 */
		const corpo = corpoDe('acaoHtml')
			.split(/\r?\n/)
			.filter(l => {
				const t = l.trimStart();
				return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
			})
			.join('\n');
		expect(
			corpo,
			'voltou uma segunda conta da regra no cliente — a janela e sempre a que perde'
		).not.toContain('cash >= passe.cash');
		expect(corpo).toContain('const podeComprar = recusa === null;');
	});
});
