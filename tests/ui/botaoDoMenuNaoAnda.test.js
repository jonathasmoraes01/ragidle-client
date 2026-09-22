/**
 * O BOTAO MENU FICA NO MESMO LUGAR, ABERTO OU FECHADO (21/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O RELATO, E A CAUSA
 * ---------------------------------------------------------------------------
 * Dono, com print: *"quando voce clica no menu, ele sai do canto e vem para o
 * meio... e quando o menu esta fechado, o botao fica la no canto. Eu quero que
 * esse botao fique sempre centralizado."*
 *
 * **O `.tm-menu` ja tinha `min-width: 198px` EXATAMENTE para isso**, e o
 * comentario dele promete por escrito: *"o botao ocupa a MESMA posicao aberto
 * ou fechado"*. O leque nasce em `display:none` (decisao que fica — caixa
 * invisivel sobre o mundo e a familia de defeito que o gate de clique existe
 * para pegar), entao sem um piso o container encolheria para os 52px do botao
 * e o botao saltaria a cada fechamento.
 *
 * O piso cumpria a promessa enquanto o leque tinha a largura de 24/08/2026:
 * UMA coluna por lado, os 198px cravados. **D-1490 (15/09/2026) deu ao leque
 * ate TRES colunas por lado** quando a altura da janela nao comporta a fileira
 * unica — e ai ele passa dos 198. O container cresce ao abrir, o
 * `align-items: center` recentra o botao na largura NOVA, e o botao anda.
 *
 * Constante que era verdade quando foi escrita, e que ninguem reconferiu quando
 * o arranjo ao lado mudou. O irmao deste arquivo,
 * `lequeDoMenuCabeNaAltura.test.js`, prende a OUTRA metade do mesmo D-1490.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO NAO PROVA
 * ---------------------------------------------------------------------------
 * **Nada de geometria.** O defeito so existe com leiaute resolvido, e o jsdom
 * nao faz leiaute — `getBoundingClientRect()` devolve zero la, e a propria
 * funcao medida aqui trata o zero como "ainda nao estou no documento" e nao
 * escreve nada. Quem mede de verdade e o navegador: `prove:hud-responsiva` (com
 * o menu ABERTO) ou o olho de quem esta jogando.
 *
 * O que este portao impede e a REGRESSAO barata: alguem devolver o numero fixo
 * ao `min-width`, tirar a chamada da medicao de onde a largura muda, ou trocar
 * a variavel por um `style.minWidth` inline — que venceria o `min-width: 0` do
 * celular e da HUD vertical calado, e devolveria o botao para cima da barra do
 * chat (I1).
 *
 * Ele le o fonte com os comentarios REMOVIDOS: sem isso passaria pela propria
 * prosa que explica o conserto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const JS = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.js', 'utf8');
const CSS = readFileSync('src/UI/Components/TopMenuIdle/TopMenuIdle.css', 'utf8');

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const JS_CRU = semComentario(JS);
const CSS_CRU = semComentario(CSS);

const regraDe = (css, seletor) => {
	const i = css.indexOf(seletor + ' {');
	expect(i, `sumiu a regra ${seletor}`).toBeGreaterThan(-1);
	return css.slice(i, css.indexOf('}', i));
};

describe('o botao Menu nao anda ao abrir o leque', () => {
	it('o piso do container sai de VARIAVEL, e nao de numero cravado', () => {
		const regra = regraDe(CSS_CRU, '.tm-menu');
		expect(
			regra,
			'o piso voltou a ser numero fixo: com o leque em 2 ou 3 colunas ele passa do piso e o botao recentra ao abrir'
		).toMatch(/min-width:\s*var\(--tm-largura-do-menu/);
		// O 198 fica como PADRAO, e nao como valor: sem pacote medido a tela
		// continua igual ao que sempre foi.
		expect(regra).toMatch(/var\(--tm-largura-do-menu,\s*198px\)/);
	});

	it('o botao continua centralizado no container — o piso so existe por causa disso', () => {
		// Sem `align-items: center` o piso nao tem sujeito: o botao voltaria a
		// se alinhar pela direita e o pedido do dono estaria desfeito por outro
		// caminho, com o `min-width` intacto.
		expect(regraDe(CSS_CRU, '.tm-menu')).toMatch(/align-items:\s*center/);
	});

	it('quem escreve a variavel MEDE o leque montado', () => {
		expect(JS_CRU, 'sumiu a funcao que mede o piso').toContain('function fixarLarguraDoMenu');

		const i = JS_CRU.indexOf('function fixarLarguraDoMenu');
		const corpo = JS_CRU.slice(i, i + 1400);

		expect(corpo, 'parou de MEDIR — voltou a cravar um numero').toContain(
			'getBoundingClientRect'
		);
		expect(
			corpo,
			'parou de montar o leque para medir: fechado ele e display:none e nao tem caixa, entao a medida sairia zero'
		).toContain('is-mounted');
		expect(corpo, 'parou de escrever a variavel que o CSS le').toContain(
			'--tm-largura-do-menu'
		);
		expect(
			corpo,
			'passou a escrever min-width INLINE: isso vence o `min-width: 0` do celular e da HUD vertical, e devolve o botao para cima da barra do chat (I1)'
		).not.toMatch(/style\.minWidth|setProperty\(\s*['"]min-width/);
	});

	it('a medicao roda ONDE a largura muda', () => {
		/*
		 * `distribuirColunas` e quem decide o numero de colunas do leque — logo
		 * e ela quem muda a largura. Medir noutro lugar seria a segunda rota que
		 * este projeto passa o dia consertando: ela ja corre no `onAppend`, no
		 * `resize` e quando o item Admin aparece, e o piso precisa de todos os
		 * tres (quem abre o jogo grande e encolhe a janela ficaria com o piso da
		 * largada para sempre).
		 */
		const i = JS_CRU.indexOf('function distribuirColunas');
		expect(i, 'sumiu quem distribui as colunas').toBeGreaterThan(-1);
		const corpo = JS_CRU.slice(i, JS_CRU.indexOf('\nfunction ', i + 10));
		expect(
			corpo,
			'a medicao do piso saiu de onde a largura muda — o botao volta a andar quando o numero de colunas mudar'
		).toContain('fixarLarguraDoMenu()');
	});

	it('o celular e a HUD vertical continuam zerando o piso', () => {
		// Eles zeram de PROPOSITO (I1, 31/08/2026): 198px sao metade da largura
		// util de um celular, e o botao caia sobre "Global | Trade | Farm".
		// A variavel foi escolhida para nao atropelar isto; se alguem apagar
		// estas regras, o pedido de hoje quebra o de antes.
		expect(CSS_CRU, 'o celular deixou de zerar o piso do menu').toMatch(
			/\.tm-menu\s*\{[^}]*min-width:\s*0/
		);
		expect(CSS_CRU, 'a HUD vertical deixou de zerar o piso do menu').toMatch(
			/\.ri-vertical\s+\.tm-menu\s*\{[^}]*min-width:\s*0/
		);
	});
});
