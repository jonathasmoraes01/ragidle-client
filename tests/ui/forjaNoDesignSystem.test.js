/**
 * A JANELA DE REFINO NO DESIGN SYSTEM.
 *
 * ===========================================================================
 * 01/09/2026 — "está totalmente disproporcional"
 * ===========================================================================
 * A causa nao era alinhamento: esta janela nunca foi HTML. Ela era UM bitmap
 * de 262x301 do GRF (`bg_refining_*.bmp`) que desenhava a moldura inteira —
 * painel de cima, cinco sockets hexagonais, bigorna e ate as plaquinhas dos
 * botoes — com os elementos vivos cravados em pixel por cima.
 *
 * ===========================================================================
 * 07/09/2026 — "nao tem o botao de refinar"
 * ===========================================================================
 * A segunda queixa do dono sobre a mesma janela, e ela e a razao de o arquivo
 * ter sido reescrito do zero. O botao "Refinar" nascia com
 * `style.display = 'none'` e a UNICA linha que o acendia morava dentro do
 * clique no ladrilho do material — clique que comecava com
 * `if (clickedCount === 0) return;`. Quem nao tinha o minerio clicava e nao
 * acontecia nada: nem botao, nem mensagem.
 *
 * Entao esta rodada somou ao portao a invariante que faltava, e ela e a mais
 * importante do arquivo: **peca de decisao nao some por `style.display`**.
 * Botao escondido nao se depura — some da tela e leva o motivo junto.
 *
 * ===========================================================================
 * POR QUE O PORTAO MEDE CONTRATO, E NAO "a janela esta bonita"
 * ===========================================================================
 * O JS e escrito no padrao
 *
 *     const el = root.querySelector('.alguma_coisa');
 *     if (el) { ... }
 *
 * Esse `if` e uma defesa contra `null`, mas tem um preco: uma classe renomeada
 * no HTML NAO quebra nada. O codigo roda, verde, e a funcionalidade some da
 * tela sem uma linha de erro — a forma ja catalogada nesta casa ("prova verde
 * e jogador vendo nada", a mesma de `janelaDeRefinoLigada.test.js`). Um
 * redesenho e exatamente quando isso acontece: o HTML e reescrito do zero, o
 * JS nao.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../src/UI/Components/Refine'
);

const JS = fs.readFileSync(path.join(PASTA, 'Refine.js'), 'utf8');
const HTML = fs.readFileSync(path.join(PASTA, 'Refine.html'), 'utf8');
const CSS = fs.readFileSync(path.join(PASTA, 'Refine.css'), 'utf8');

/**
 * Portao que le fonte tem de ler CODIGO.
 *
 * A prosa deste projeto CITA classe, opcode e nome de funcao o tempo todo — e
 * um caso que casasse com o comentario passaria sem o codigo existir. Foi
 * assim que a versao anterior deste arquivo aprovava `.ri-window`: a classe
 * so aparecia num comentario do HTML, e nunca num `class="..."`.
 */
function semComentarios(fonte) {
	return fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const JS_CODIGO = semComentarios(JS);
const HTML_CODIGO = HTML.replace(/<!--[\s\S]*?-->/g, ' ');

/**
 * As classes que o proprio JS INSERE no DOM e que por isso nao moram no HTML:
 * as linhas da lista de pecas e os pinos da trilha de refino, todos montados
 * por `document.createElement`. Lista fechada de proposito — se uma delas
 * deixar de ser criada pelo JS, tirar daqui faz o portao cobrar o HTML.
 */
const CRIADAS_EM_TEMPO_DE_EXECUCAO = new Set([
	'rf-item',
	'rf-item-icone',
	'rf-item-texto',
	'rf-item-nome',
	'rf-item-nota',
	'rf-item-refino',
	'rf-pino',
	'icone'
]);

/**
 * Toda classe citada num seletor.
 *
 * Sao DOIS jeitos de perguntar pelo DOM neste arquivo: o `querySelector` cru
 * e o atalho `$('...')` do topo do modulo. Ler so o primeiro deixaria a maior
 * parte da janela sem portao — e foi o que aconteceu na primeira versao desta
 * rodada, que achou 5 seletores num arquivo com dezenas.
 */
function classesProcuradasPeloJs(fonte) {
	const classes = new Set();
	const seletores = [
		...fonte.matchAll(/querySelector(?:All)?\(\s*'([^']+)'/g),
		...fonte.matchAll(/[^\w.]\$\(\s*'([^']+)'/g)
	];
	for (const achado of seletores) {
		for (const token of achado[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) {
			classes.add(token[1]);
		}
	}
	return classes;
}

/** Toda classe declarada em algum `class="..."` do HTML. */
function classesDoHtml(fonte) {
	const classes = new Set();
	for (const achado of fonte.matchAll(/class="([^"]+)"/g)) {
		for (const nome of achado[1].split(/\s+/)) {
			if (nome) {
				classes.add(nome);
			}
		}
	}
	return classes;
}

describe('a janela de refino e o design system', () => {
	it('toda classe que o Refine.js procura existe no Refine.html', () => {
		const procuradas = classesProcuradasPeloJs(JS_CODIGO);
		const declaradas = classesDoHtml(HTML_CODIGO);

		expect(
			procuradas.size,
			'quase nenhum seletor encontrado — o Refine.js mudou de forma e o aparelho parou de medir'
		).toBeGreaterThan(20);

		const orfas = [...procuradas].filter(
			nome => !declaradas.has(nome) && !CRIADAS_EM_TEMPO_DE_EXECUCAO.has(nome)
		);

		expect(
			orfas,
			`o JS procura estas classes e o HTML nao tem nenhuma: ${orfas.join(', ')}. ` +
				'Cada busca do Refine.js esta atras de um `if (el)`, entao isto NAO lanca erro ' +
				'em jogo — a funcionalidade some calada.'
		).toEqual([]);
	});

	/**
	 * O bitmap que era MOLDURA nao pode voltar.
	 *
	 * A cena animada da fornalha (`bg_refining_*.bmp`) continua e deve
	 * continuar: ela e ARTE de conteudo, e e o palco desta janela. O que nao
	 * volta e o chrome — os sockets hexagonais e as plaquinhas de botao, que
	 * moram no design system (`.ri-tile` / `.ri-btn`). Meia troca foi o que
	 * produziu o print de 01/09.
	 */
	it('a moldura nao volta a ser bitmap do GRF', () => {
		const chrome = ['slot_select_', 'bt_refining_'];
		const reincidentes = chrome.filter(peca => HTML.includes(peca));
		expect(
			reincidentes,
			`arte de chrome de volta no HTML: ${reincidentes.join(', ')} — sockets e botoes ` +
				'moram no design system (.ri-tile / .ri-btn) desde 01/09/2026'
		).toEqual([]);
	});

	it('a janela usa as pecas do design system', () => {
		const declaradas = classesDoHtml(HTML_CODIGO);
		for (const peca of ['ri-header', 'ri-title', 'ri-close', 'ri-btn', 'ri-tile', 'ri-tab']) {
			expect(declaradas.has(peca), `a janela deixou de usar \`.${peca}\``).toBe(true);
		}
	});

	/**
	 * A MOLDURA E COBRADA POR TOKEN, e nao pela classe `.ri-window`.
	 *
	 * A classe chegou a estar aqui e SAIU no mesmo dia, com medicao: ela e a
	 * chave do painel de tela cheia de celular (D-932), que sob
	 * `max-width: 599px` impoe `position: static; width: 100%; height: auto`
	 * as janelas DE PILHA. Esta e nativa e nao passa pela `pilhaDeJanelas`,
	 * entao herdaria o corpo esticado sem herdar o ancoramento do host — o
	 * arnes de foto mediu 468x414 onde o CSS pedia 468x430, e no viewport de
	 * 400px a janela crescia para 445 de altura.
	 *
	 * Por isso o portao mede o que importa (a moldura sai do sistema) e nao o
	 * nome (que arrasta comportamento junto). ItemReform, LaphineSys e
	 * LaphineUpg fazem igual.
	 */
	it('a moldura da janela sai dos tokens do design system', () => {
		const janela = CSS.match(/#Refine\s*\{([^}]*)\}/);
		expect(janela, 'sumiu o bloco `#Refine` do Refine.css').not.toBeNull();
		for (const token of ['--window-fill', '--window-frame', '--window-shadow', '--blur-glass']) {
			expect(
				janela[1].includes(token),
				`a moldura deixou de usar \`${token}\` — ela sairia do design system`
			).toBe(true);
		}
		expect(
			classesDoHtml(HTML_CODIGO).has('ri-window'),
			'a classe `.ri-window` voltou ao HTML: ela liga o painel de celular de D-932 nesta ' +
				'janela, que nao e de pilha — o corpo estica e o host continua ancorado fora da tela'
		).toBe(false);
	});

	/**
	 * PIXEL CRAVADO no tamanho da janela.
	 *
	 * Largura/altura em porcentagem colapsam dentro do Shadow DOM e a janela
	 * SOME — a cicatriz de Enchant/EnchantGrade, e a armadilha que custou uma
	 * frota inteira em 01/09. O portao cobra numero em `px` nos dois lugares
	 * que decidem o tamanho (`:host` e `#Refine`).
	 */
	it('o tamanho da janela e cravado em px, nunca em porcentagem', () => {
		const host = CSS.match(/:host\s*\{([^}]*)\}/);
		expect(host, 'sumiu o bloco `:host` do Refine.css').not.toBeNull();
		expect(/width:\s*\d+px/.test(host[1]), '`:host` sem largura em px').toBe(true);
		expect(/height:\s*\d+px/.test(host[1]), '`:host` sem altura em px').toBe(true);

		const janela = CSS.match(/#Refine\s*\{([^}]*)\}/);
		expect(janela, 'sumiu o bloco `#Refine` do Refine.css').not.toBeNull();
		expect(/width:\s*\d+px/.test(janela[1]), '`#Refine` sem largura em px').toBe(true);
		expect(/height:\s*\d+px/.test(janela[1]), '`#Refine` sem altura em px').toBe(true);
	});

	/**
	 * O BOTAO DE FECHAR NAO PODE CARREGAR `.base` (foto do dono, 01/09/2026).
	 *
	 * A marcacao herdada dava ao X `class="base close ri-close"`, e cada uma
	 * destas janelas tem uma regra para a alca invisivel de arrasto:
	 *
	 *     #Refine .titlebar > div.base { position: absolute; left: 0; ... }
	 *
	 * Id + duas classes ganha de `.ri-close` (uma classe), entao o X ia parar
	 * no canto SUPERIOR ESQUERDO, esticado na altura do cabecalho. Nao era um
	 * escorregao de uma janela: a mesma dupla estava em ItemReform, LaphineSys
	 * e LaphineUpg, palavra por palavra — marcacao copiada carrega o defeito
	 * junto, e por isso o portao mede a MARCACAO e nao a posicao.
	 *
	 * A alca `.base` SAIU desta janela na reescrita de 07/09: quem arrasta e o
	 * proprio cabecalho, entao a colisao nao tem mais como acontecer aqui. As
	 * outras tres continuam com ela, e continuam apontando para este portao —
	 * por isso o caso fica, medindo a causa (a classe no botao) e nao a peca.
	 */
	it('o botao de fechar nao herda a classe da alca de arrasto', () => {
		const botaoFechar = HTML_CODIGO.match(/<button[^>]*\bri-close\b[^>]*>/);
		expect(botaoFechar, 'sumiu o botao `.ri-close` do cabecalho').not.toBeNull();
		expect(
			/\bclass="[^"]*\bbase\b/.test(botaoFechar[0]),
			'o X voltou a carregar `.base`: a regra `.titlebar > div.base` tem especificidade ' +
				'maior que `.ri-close` e joga o botao para o canto superior esquerdo'
		).toBe(false);

		/* E a alca de arrasto e o cabecalho, declarada nos dois lados. */
		expect(
			/draggable\('\.rf-header'\)/.test(JS_CODIGO),
			'o JS parou de tornar o cabecalho arrastavel — a janela ficaria presa no canto'
		).toBe(true);
		expect(classesDoHtml(HTML_CODIGO).has('rf-header'), 'sumiu o `.rf-header` do HTML').toBe(true);
	});

	/**
	 * A msgstringtable do cliente coreano e que fazia esta janela se chamar
	 * "Try Again" no print de 01/09 (msg 3241). O texto do jogador e nosso.
	 *
	 * O titulo e o rotulo que o Guia de Teleporte ja usa para o Hollgrehenn
	 * (D-552: *"o rotulo diz o que se faz, nao como o NPC se chama"*) — os dois
	 * lugares onde o jogador encontra este servico chamam ele pelo mesmo nome.
	 */
	it('os rotulos sao nossos, nao a msgstringtable', () => {
		expect(/<ui-text/.test(HTML_CODIGO), 'voltou `ui-text` no HTML').toBe(false);
		expect(
			HTML_CODIGO.includes('>Refinar equipamento<'),
			'a janela perdeu o titulo em portugues'
		).toBe(true);
	});

	/* ═══════════════════════════════════════════════════════════════════ */
	/* A queixa de 07/09: o botao que nao estava la                        */
	/* ═══════════════════════════════════════════════════════════════════ */

	/**
	 * PECA DE DECISAO NAO SOME POR `style.display`.
	 *
	 * Esta e a invariante que a janela anterior violava, e o defeito que o dono
	 * viu. Um botao com `display:none` nao e um botao desabilitado: e um botao
	 * que nao existe, e que por isso nao consegue explicar por que nao da para
	 * apertar.
	 *
	 * O portao e do ARQUIVO INTEIRO, e nao so do botao, de proposito: a janela
	 * velha escondia com `display` o botao, o rodape de mensagens, o nome da
	 * peca e a chance — quatro pecas, o mesmo recurso. Quem precisa sumir aqui
	 * usa o atributo `hidden` (que o CSS honra com `!important`), e ai o portao
	 * ve a intencao no fonte.
	 */
	it('nenhuma peca some por `style.display` — quem some usa `hidden`', () => {
		const escondidas = [...JS_CODIGO.matchAll(/(\w+)\.style\.display\s*=/g)].map(a => a[1]);
		expect(
			escondidas,
			`estas pecas voltaram a sumir por display: ${escondidas.join(', ')}. ` +
				'Foi assim que o botao "Refinar" deixou de existir na tela em vez de ficar ' +
				'desabilitado com um motivo ao lado.'
		).toEqual([]);
	});

	/**
	 * O BOTAO E O MOTIVO SAO A MESMA DECISAO.
	 *
	 * Desabilitar sem dizer por que devolve o defeito com outra pele: o jogador
	 * continua sem saber que falta um Phracon. O portao cobra que as duas
	 * coisas sejam escritas pela MESMA funcao — se um dia alguem separar,
	 * separa tambem a chance de esquecer uma delas.
	 */
	it('quem apaga o botao escreve o motivo, na mesma funcao', () => {
		const inicio = JS_CODIGO.indexOf('function pintarRodape');
		expect(inicio, 'sumiu a `pintarRodape` — o portao perdeu a ancora').toBeGreaterThan(-1);
		const corpo = JS_CODIGO.slice(inicio, JS_CODIGO.indexOf('\n}', inicio));

		expect(/\.disabled\s*=/.test(corpo), '`pintarRodape` parou de mexer no `disabled`').toBe(true);
		expect(corpo.includes('rf-motivo'), '`pintarRodape` parou de escrever o motivo').toBe(true);
		expect(
			corpo.includes('veredito()'),
			'o rodape parou de consultar o veredito — botao e motivo poderiam discordar'
		).toBe(true);
	});

	/**
	 * O ARRASTO NAO VOLTA.
	 *
	 * Era o unico jeito de por a peca na bigorna, e ele **nao existe no toque**
	 * (D-938, a mesma cicatriz da barra de atalhos): no celular a janela era
	 * inutilizavel por construcao. A peca entra por clique na lista.
	 */
	it('a peca entra por clique, e nao por arrasto', () => {
		for (const evento of ['dragstart', 'dragover', 'dragend', "'drop'"]) {
			expect(
				JS_CODIGO.includes(evento),
				`voltou o arrasto (${evento}) — ele nao existe no toque, e o celular ficaria sem janela`
			).toBe(false);
		}
	});

	/**
	 * OS NUMEROS SAO DO SERVIDOR.
	 *
	 * Chance, preco, material, niveis perdidos e bonus chegam em
	 * `ZC_RAGIDLE_REFINO` (0x0fd3), tirados do `refine.yml`. Uma janela que
	 * calculasse qualquer um deles poderia discordar do servidor, e a
	 * discordancia so apareceria no dia em que ela dissesse "pode" e o zeny nao
	 * saisse.
	 */
	it('a janela consome a ficha do servidor', () => {
		expect(
			/hookPacket\(\s*PACKET\.ZC\.RAGIDLE_REFINO/.test(JS_CODIGO),
			'a janela parou de ouvir a ficha de refino (0x0fd3) — os numeros teriam de sair de algum lugar'
		).toBe(true);
		expect(
			/hookPacket\(\s*PACKET\.ZC\.OPEN_REFINING_UI/.test(JS_CODIGO),
			'a janela parou de ouvir o pacote que a ABRE — o clique no NPC ficaria mudo'
		).toBe(true);
	});
});
