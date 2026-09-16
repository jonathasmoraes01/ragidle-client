/**
 * A PORTA DA JANELA DE SISTEMA (D-1416, refeita em D-1479).
 *
 * *"No RO pelo navegador, ao clicar em ESC tem como alterar as configuracoes
 * de video/audio. Quero que no mobile isso tambem seja possivel."*
 *
 * A janela `Escape` (video, audio, atalho, trocar personagem, fechar jogo)
 * estava inteira e FUNCIONANDO. O que ela nao tinha era PORTA: a fusao
 * "Config + Menu" deixou escrito no cabecalho do `TopMenuIdle.js` que ela
 * "perdeu a porta de mouse e ficou so na TECLA ESC" — e celular nao tem ESC.
 *
 * ---------------------------------------------------------------------------
 * A PRIMEIRA VERSAO ESTAVA ERRADA DE DUAS FORMAS, E AS DUAS VIRARAM CASO
 * ---------------------------------------------------------------------------
 * 1. **Invisivel.** Usava `var(--ri-superficie-2, ...)` (token que NAO existe)
 *    com `var(--ri-texto, ...)` (token que existe e e tinta ESCURA): texto
 *    escuro sobre fundo escuro, um retangulo azul sem letra nenhuma em
 *    producao.
 * 2. **Inerte e torta.** Relato do dono, com foto: *"nao esta clicavel, nao
 *    esta responsivo"*. Ela nascia como LINHA LARGA no rodape do leque, FORA
 *    das duas colunas — sem a grade, sem o alvo tatil e, principalmente, sem o
 *    despachante de clique que todo `.tm-item` ganha de graca.
 *
 * O conserto das duas foi o mesmo: **ser um item como os outros**. Por isso os
 * casos abaixo medem PERTENCIMENTO a grade, e nao propriedades proprias — um
 * botao que e `.tm-item` herda clique, tamanho e layout de quem ja funciona, e
 * nao ha regra nova que possa apodrecer sozinha.
 *
 * Le o FONTE e nao levanta o menu: `TopMenuIdle.js` importa duas dezenas de
 * janelas (WebGL, sessao logada). Molde de `analiseDeCacaEnxuta.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MENU = join(process.cwd(), 'src/UI/Components/TopMenuIdle');
const html = readFileSync(join(MENU, 'TopMenuIdle.html'), 'utf8');
const css = readFileSync(join(MENU, 'TopMenuIdle.css'), 'utf8');
const js = readFileSync(join(MENU, 'TopMenuIdle.js'), 'utf8');
const escape = readFileSync(join(process.cwd(), 'src/UI/Components/Escape/Escape.js'), 'utf8');
const icones = readFileSync(join(process.cwd(), 'src/UI/ri-icones.js'), 'utf8');

/** Sem comentario de bloco e sem a linha que COMECA com `//`. */
function semComentarios(fonte) {
	return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const htmlSemComentario = html.replace(/<!--[\s\S]*?-->/g, '');
const jsSemComentario = semComentarios(js);
const escapeSemComentario = semComentarios(escape);

describe('a janela de sistema tem porta no menu (D-1416/D-1479)', () => {
	it('e um `.tm-item` DENTRO de uma coluna — era isso que faltava', () => {
		/*
		 * O caso mais importante do arquivo. Fora da coluna ela nao recebia o
		 * clique: `onClickAction` e ligado em `.tm-item[data-action]`, e o
		 * botao antigo tinha classe propria e listener proprio.
		 */
		expect(htmlSemComentario).toMatch(
			/<div class="tm-col[^"]*">[\s\S]*<button[^>]*class="tm-item"[^>]*data-action="sistema"/
		);
		expect(htmlSemComentario, 'a classe propria some junto: ela era a excecao').not.toContain(
			'class="tm-sistema"'
		);
		expect(css, 'sem regra propria de CSS: ela herda a do `.tm-item`').not.toContain('.tm-sistema');
	});

	it('tem `case` no despachante — a regra escrita do proprio menu', () => {
		// "TODO data-action daqui tem case abaixo, e todo case abre algo de
		// verdade." Ja houve botao com data-action e sem case aqui.
		expect(jsSemComentario).toContain("case 'sistema':");
		expect(jsSemComentario).toContain('Escape.abrirPeloMenu()');
		expect(jsSemComentario).toMatch(/import Escape from 'UI\/Components\/Escape\/Escape\.js'/);
	});

	it('o listener PROPRIO foi embora — duas rotas de clique seria o defeito de volta', () => {
		expect(jsSemComentario).not.toContain('ligarPortaDoSistema');
		expect(jsSemComentario).not.toContain("querySelector('.tm-sistema')");
	});

	it('tem icone PROPRIO, e nao a engrenagem do idle', () => {
		/*
		 * MEDE O HTML CRU, e nao o sem-comentario: o marcador de icone E um
		 * comentario HTML por desenho (`<!--RI_ICONE:chave-->`, ver o cabecalho
		 * de `ri-icones.js`). A primeira versao deste caso limpava os
		 * comentarios antes de procurar e reprovava sozinha — medir a prosa e
		 * cicatriz conhecida aqui, e desta vez o defeito foi o oposto: apagar o
		 * que NAO era prosa.
		 */
		expect(html).toContain('<!--RI_ICONE:sistema-->');
		expect(icones, 'o glifo `sistema` precisa existir no set').toMatch(/\n\tsistema: svg\(/);
		// A engrenagem e do IDLE ([DONO-4]) e ja nomeia o botao ao lado; dois
		// itens com a mesma cara obrigariam a ler o rotulo para distinguir.
		expect(html).not.toMatch(/data-action="sistema"[\s\S]{0,200}RI_ICONE:config/);
	});

	it('o rotulo diz o que ha dentro, no title', () => {
		expect(htmlSemComentario).toMatch(/title="Configurações do jogo[^"]*vídeo, áudio/i);
		expect(htmlSemComentario).toMatch(/<span class="tm-label">Configurações<\/span>/);
	});

	it('`abrirPeloMenu` RESPEITA a trava da morte, como o ESC ja fazia', () => {
		const i = escapeSemComentario.indexOf('Escape.abrirPeloMenu =');
		expect(i, 'o metodo sumiu').toBeGreaterThan(-1);
		const corpo = escapeSemComentario.slice(i, i + 400);
		expect(corpo).toContain('DeathWindow.aMorteEstaNaTela()');
		// Sem `focus()` a janela abre sem receber o teclado.
		expect(corpo).toContain('this.focus()');
	});
});
