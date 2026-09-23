/**
 * O CLIQUE CHEGA NOS MODAIS DA TEMPORADA? (relato do dono, 22/09/2026)
 *
 * ---------------------------------------------------------------------------
 * OS TRES RELATOS ERAM UM DEFEITO SO
 * ---------------------------------------------------------------------------
 * Na reuniao: *"ao clicar em comprar a caixa, ele nao esta abrindo o menu, nao
 * esta dando a opcao de clicar e confirmar"*, *"sempre ao clicar em abrir uma
 * janela dentro dessa janela do passe, ela ta ficando travada"* e *"ao clicar
 * e ver conteudo (...) mesmo clicando no X ali para fechar, ela nao fecha"*.
 *
 * A causa: `:host` e `pointer-events: none` para a janela FECHADA nao engolir
 * clique de cena, e quem reacendia o ponteiro era **so** o `.te-window`. Os
 * modais e o reveal sao IRMAOS dela dentro de `#TemporadaIdle` — nasciam sem
 * ponteiro. Eles APARECIAM na tela e o clique os atravessava: medido num
 * navegador de verdade, o clique no centro do "X" do modal chegava a uma ABA
 * da janela de tras.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O PORTAO LE O HTML, E NAO UMA LISTA
 * ---------------------------------------------------------------------------
 * Fixar "confere `.te-modal` e `.te-reveal`" fecharia os tres relatos e
 * envelheceria no dia em que a janela ganhasse um quarto irmao — que nasceria
 * com o mesmo defeito, calado. Entao a lista sai do PROPRIO HTML: todo filho
 * direto de `#TemporadaIdle` que nao seja a janela e uma camada que cobre a
 * tela, e toda camada dessas precisa reacender o ponteiro.
 *
 * O jsdom nao tem motor de leiaute, entao `elementFromPoint` aqui nao
 * responderia nada. A medida no navegador esta na prova de tela
 * (`scripts/foto-temporada.ts`, em rag-idle-master), que desde hoje REPROVA
 * quando o clique nao chega no fechar.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* `import.meta.url` aqui e uma URL http (o vitest roda sobre o vite): o caminho
   sai do cwd, que e a raiz do projeto — o mesmo molde de
   `tests/db/areasDeSkill.test.js`. */
const BASE = join(process.cwd(), 'src', 'UI', 'Components', 'TemporadaIdle');
const CSS = readFileSync(join(BASE, 'TemporadaIdle.css'), 'utf8');
const HTML = readFileSync(join(BASE, 'TemporadaIdle.html'), 'utf8');

/** Os filhos diretos de `#TemporadaIdle`, pela primeira classe de cada um. */
function camadasDoHtml() {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	const container = raiz.querySelector('#TemporadaIdle');
	expect(container, 'o HTML nao tem mais #TemporadaIdle').not.toBeNull();
	return [...container.children].map((el) => el.classList[0]).filter(Boolean);
}

/**
 * O corpo da regra `#TemporadaIdle .<classe> {...}`, ou null.
 *
 * Por `indexOf` e nao por expressao regular de proposito: montar a regex a
 * partir do nome da classe exigiria escapar, e escapar e uma segunda rota para
 * errar num portao cujo trabalho e nao errar.
 */
function blocoDaRegra(classe) {
	const cabeca = `#TemporadaIdle .${classe} {`;
	const i = CSS.indexOf(cabeca);
	if (i === -1) return null;
	const fim = CSS.indexOf('}', i);
	return fim === -1 ? null : CSS.slice(i + cabeca.length, fim);
}

describe('toda camada por cima da janela reacende o ponteiro', () => {
	it('o `:host` continua apagando o ponteiro (a janela fechada nao come clique de cena)', () => {
		const i = CSS.indexOf(':host {');
		expect(i, 'o CSS nao tem mais um bloco :host').toBeGreaterThan(-1);
		const host = CSS.slice(i, CSS.indexOf('}', i));
		expect(host).toContain('pointer-events: none');
	});

	it('a janela reacende', () => {
		expect(blocoDaRegra('te-window')).toContain('pointer-events: auto');
	});

	it('TODO irmao da janela reacende — a lista sai do HTML, nao daqui', () => {
		const camadas = camadasDoHtml();
		/* A amostra nao pode passar com zero nem com so a janela. */
		expect(camadas).toContain('te-window');
		expect(camadas.length).toBeGreaterThan(1);

		const semPonteiro = [];
		for (const classe of camadas) {
			if (classe === 'te-window') continue;
			const bloco = blocoDaRegra(classe);
			if (bloco === null) {
				semPonteiro.push(`${classe}: nao tem regra propria no CSS`);
			} else if (!bloco.includes('pointer-events: auto')) {
				semPonteiro.push(`${classe}: sem "pointer-events: auto" — o clique vai atravessar`);
			}
		}
		expect(semPonteiro).toEqual([]);
	});

	it('o aviso do rodape continua SEM ponteiro (ele nao pode roubar clique)', () => {
		expect(blocoDaRegra('te-aviso')).toContain('pointer-events: none');
	});
});
