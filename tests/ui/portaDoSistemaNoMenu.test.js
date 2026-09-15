/**
 * A PORTA DA JANELA DE SISTEMA (15/09/2026, D-1416 — pedido do dono).
 *
 * *"No RO pelo navegador, ao clicar em ESC tem como alterar as configuracoes
 * de video/audio. Quero que no mobile isso tambem seja possivel."*
 *
 * A janela `Escape` (video, audio, atalho, trocar personagem, fechar jogo)
 * estava inteira e FUNCIONANDO — o que ela nao tinha era porta. A fusao
 * "Config + Menu" deixou isso escrito no cabecalho do `TopMenuIdle.js` como
 * pendencia [DONO]: *"a janela de sistema perdeu a porta de mouse e ficou so
 * na TECLA ESC"*. Num celular nao ha tecla ESC.
 *
 * Este arquivo le o FONTE, e nao levanta o menu: `TopMenuIdle.js` importa duas
 * dezenas de janelas (WebGL, sessao logada). O molde e o mesmo de
 * `analiseDeCacaEnxuta.test.js`, e pela mesma razao. Comentario e apagado
 * antes de medir — os comentarios desta entrega citam exatamente os nomes que
 * o portao procura, e medir a PROSA ja foi cicatriz aqui.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MENU = join(process.cwd(), 'src/UI/Components/TopMenuIdle');
const html = readFileSync(join(MENU, 'TopMenuIdle.html'), 'utf8');
const css = readFileSync(join(MENU, 'TopMenuIdle.css'), 'utf8');
const js = readFileSync(join(MENU, 'TopMenuIdle.js'), 'utf8');
const escape = readFileSync(join(process.cwd(), 'src/UI/Components/Escape/Escape.js'), 'utf8');

/** Sem comentario de bloco e sem a linha que COMECA com `//`. */
function semComentarios(fonte) {
	return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** O HTML sem os comentarios `<!-- ... -->`. */
const htmlSemComentario = html.replace(/<!--[\s\S]*?-->/g, '');
const jsSemComentario = semComentarios(js);
const escapeSemComentario = semComentarios(escape);

describe('a janela de sistema tem porta no menu (D-1416)', () => {
	it('o botao existe no HTML, com rotulo escrito por extenso', () => {
		expect(htmlSemComentario).toContain('class="tm-sistema"');
		expect(htmlSemComentario).toContain('Configurações do jogo');
		// A dica diz o que ha dentro: sem ela o jogador nao sabe que audio e
		// video moram ali, que e a pergunta que ele fez.
		expect(htmlSemComentario).toMatch(/Vídeo, áudio/);
	});

	it('o clique esta LIGADO — botao sem listener e botao morto', () => {
		expect(jsSemComentario).toContain("querySelector('.tm-sistema')");
		expect(jsSemComentario).toContain('Escape.abrirPeloMenu()');
		// Ligado de verdade: a funcao precisa ser CHAMADA no append.
		expect(jsSemComentario).toContain('ligarPortaDoSistema();');
	});

	it('o menu importa a janela que ele abre', () => {
		expect(jsSemComentario).toMatch(/import Escape from 'UI\/Components\/Escape\/Escape\.js'/);
	});

	it('fecha o leque antes de abrir — menu por cima da janela foi defeito medido', () => {
		const i = jsSemComentario.indexOf('function ligarPortaDoSistema');
		expect(i, 'a funcao sumiu').toBeGreaterThan(-1);
		const corpo = jsSemComentario.slice(i, i + 500);
		expect(corpo.indexOf('fecharLeque()')).toBeLessThan(corpo.indexOf('Escape.abrirPeloMenu()'));
	});

	it('`abrirPeloMenu` RESPEITA a trava da morte, como o ESC ja fazia', () => {
		const i = escapeSemComentario.indexOf('Escape.abrirPeloMenu =');
		expect(i, 'o metodo sumiu').toBeGreaterThan(-1);
		const corpo = escapeSemComentario.slice(i, i + 400);
		expect(corpo).toContain('DeathWindow.aMorteEstaNaTela()');
		// Focar importa: sem isso a janela abre sem receber o teclado.
		expect(corpo).toContain('this.focus()');
	});

	it('o alvo tem 48px — o piso tatil que a regra do dono cobra', () => {
		const bloco = css.slice(css.indexOf('.tm-sistema {'));
		expect(bloco.slice(0, 400)).toMatch(/min-height:\s*48px/);
	});

	it('NAO e escondida no desktop: a porta de mouse tambem tinha sumido', () => {
		const bloco = css.slice(css.indexOf('.tm-sistema {'), css.indexOf('.tm-instalar {'));
		expect(bloco).not.toMatch(/display:\s*none/);
	});
});
