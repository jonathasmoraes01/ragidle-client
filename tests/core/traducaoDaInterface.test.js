/**
 * A TRADUCAO DAS JANELAS (D-1929): o observador em cada raiz de sombra
 * traduz o que nasce e o que muda, pula o que o JOGADOR escreveu
 * (`translate="no"`) e nao traduz a propria traducao de novo.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { absorverCatalogo, desligarTraducao } from 'Core/Traducao.js';
import { esquecerRaizes, observarRaiz, retraduzirTudo } from 'UI/traducaoDaInterface.js';
import { caminhoDaTabela, TABELAS_TRADUZIDAS } from 'DB/tabelasNoIdioma.js';
import {
	definirIdioma,
	emIngles,
	esquecerIdiomaLido,
	IDIOMA_PADRAO,
	idiomaAtual,
	idiomaFoiEscolhido,
	localeDoIdioma
} from 'Core/Idioma.js';

const CATALOGO = {
	v: 1,
	exatos: { Fechar: 'Close', 'Agora nao': 'Not now', Missões: 'Missions', 'Buscar item': 'Search item', Comprar: 'Buy' },
	modelos: [{ pt: 'Você tem {0} missões', en: 'You have {0} missions' }]
};

/** Uma janela de mentira: host com raiz de sombra, como o GUIComponent monta. */
function janela(html) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const sombra = host.attachShadow({ mode: 'open' });
	const raiz = document.createElement('div');
	raiz.innerHTML = html;
	sombra.appendChild(raiz);
	return { host, sombra, raiz };
}

/** O MutationObserver entrega em microtarefa. */
const microtarefa = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
	document.body.innerHTML = '';
});

afterEach(() => {
	esquecerRaizes();
	desligarTraducao();
});

describe('o observador', () => {
	it('traduz o que ja esta na janela, inclusive title/placeholder/value de botao', () => {
		absorverCatalogo(CATALOGO);
		const { sombra, raiz } = janela(
			'<h1>Missões</h1><button title="Fechar">Fechar</button><input placeholder="Buscar item"><input type="button" value="Comprar">'
		);
		observarRaiz(sombra);
		expect(raiz.querySelector('h1').textContent).toBe('Missions');
		expect(raiz.querySelector('button').textContent).toBe('Close');
		expect(raiz.querySelector('button').getAttribute('title')).toBe('Close');
		expect(raiz.querySelector('input').getAttribute('placeholder')).toBe('Search item');
		expect(raiz.querySelector('input[type=button]').value).toBe('Buy');
	});

	it('traduz o que o componente escreve DEPOIS (innerHTML e textContent)', async () => {
		absorverCatalogo(CATALOGO);
		const { sombra, raiz } = janela('<p id="a"></p><p id="b">x</p>');
		observarRaiz(sombra);
		raiz.querySelector('#a').innerHTML = '<b>Agora nao</b>';
		raiz.querySelector('#b').firstChild.nodeValue = 'Você tem 3 missões';
		await microtarefa();
		expect(raiz.querySelector('#a').textContent).toBe('Not now');
		expect(raiz.querySelector('#b').textContent).toBe('You have 3 missions');
	});

	it('o que o JOGADOR escreveu (translate="no") fica intacto', async () => {
		absorverCatalogo(CATALOGO);
		const { sombra, raiz } = janela('<div class="chat" translate="no"><span>Fechar</span></div><p>Fechar</p>');
		observarRaiz(sombra);
		raiz.querySelector('.chat').insertAdjacentHTML('beforeend', '<span>Agora nao</span>');
		await microtarefa();
		expect(raiz.querySelector('.chat').textContent).toBe('FecharAgora nao');
		expect(raiz.querySelector('p').textContent).toBe('Close');
	});

	it('<style> e <textarea> nao sao tocados', () => {
		absorverCatalogo(CATALOGO);
		const { sombra, raiz } = janela('<style>.Fechar{}</style><textarea>Fechar</textarea>');
		observarRaiz(sombra);
		expect(raiz.querySelector('style').textContent).toBe('.Fechar{}');
		expect(raiz.querySelector('textarea').value).toBe('Fechar');
	});

	it('janela que nasceu ANTES do catalogo e traduzida quando ele chega', () => {
		const { sombra, raiz } = janela('<p>Fechar</p>');
		observarRaiz(sombra);
		expect(raiz.querySelector('p').textContent).toBe('Fechar');
		absorverCatalogo(CATALOGO);
		retraduzirTudo();
		expect(raiz.querySelector('p').textContent).toBe('Close');
	});

	it('em portugues (sem catalogo) nada muda', async () => {
		const { sombra, raiz } = janela('<p>Fechar</p>');
		observarRaiz(sombra);
		raiz.querySelector('p').textContent = 'Agora nao';
		await microtarefa();
		expect(raiz.querySelector('p').textContent).toBe('Agora nao');
	});
});

describe('o idioma do aparelho', () => {
	beforeEach(() => {
		localStorage.clear();
		esquecerIdiomaLido();
	});

	it('quem nunca escolheu fica em portugues (o padrao), e o passo zero ainda pergunta', () => {
		expect(IDIOMA_PADRAO).toBe('pt-BR');
		expect(idiomaAtual()).toBe('pt-BR');
		expect(emIngles()).toBe(false);
		expect(idiomaFoiEscolhido()).toBe(false);
		expect(localeDoIdioma()).toBe('pt-BR');
	});

	it('a escolha fica gravada (e sobrevive a reler o localStorage)', () => {
		expect(definirIdioma('en')).toBe(true);
		esquecerIdiomaLido();
		expect(idiomaAtual()).toBe('en');
		expect(emIngles()).toBe(true);
		expect(idiomaFoiEscolhido()).toBe(true);
		expect(localeDoIdioma()).toBe('en-US');
		expect(definirIdioma('en')).toBe(false); // ja era
	});

	it('escolher portugues tambem conta como escolha (o passo zero nao pergunta de novo)', () => {
		definirIdioma('pt-BR');
		esquecerIdiomaLido();
		expect(idiomaFoiEscolhido()).toBe(true);
		expect(emIngles()).toBe(false);
	});

	it('idioma desconhecido recusa alto', () => {
		expect(() => definirIdioma('es')).toThrow(/idioma desconhecido/);
	});
});

describe('as tabelas do GRF no idioma', () => {
	it('em ingles, as tabelas traduzidas vao para data/english/; o resto fica', () => {
		expect(caminhoDaTabela('data/idnum2itemdisplaynametable.txt', true)).toBe('data/english/idnum2itemdisplaynametable.txt');
		expect(caminhoDaTabela('data/msgstringtable.csv', true)).toBe('data/english/msgstringtable.csv');
		expect(caminhoDaTabela('data/resnametable.txt', true)).toBe('data/resnametable.txt');
		expect(TABELAS_TRADUZIDAS).toHaveLength(7);
	});

	it('em portugues, todo caminho fica como sempre foi', () => {
		for (const caminho of TABELAS_TRADUZIDAS) {
			expect(caminhoDaTabela(caminho, false)).toBe(caminho);
		}
	});
});
