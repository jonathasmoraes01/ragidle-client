/**
 * O DORMIR COM O GANHO VISIVEL, A VOLTA A SELECAO E O ICONE DE QUEM DORME (J21 do jogador "lucas seabra",
 * 14/10/2026, D-2477 e D-2478).
 *
 * O relato: "varias vezes pus o personagem para dormir e, ao voltar, nao tinha subido nada de XP"; o pedido: mostrar
 * melhor que ele esta dormindo E ganhando, um botao que volte a selecao depois de por um para dormir, e um icone de
 * dormir na selecao ao lado do icone da classe.
 *
 * A tela preta e o modulo puro da selecao sao exercitados de verdade no jsdom; o motor (`MapEngine.js`), o
 * componente da selecao e a Analise de Caca nao carregam aqui (arrastam renderizador, socket e GRF), e o fio deles
 * e cobrado lendo o fonte SEM comentario, no idioma que `dormirEmTelaPreta.test.js` ja usa.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

function semComentario(texto) {
	return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

// As linhas do resumo levam o espaco SEM QUEBRA (U+00A0) dentro de cada metade (rodada 3, N4): o texto que o jogador
// le e o mesmo, e e esse que estes testes conferem. Onde a linha pode dobrar e cobrado no bloco do N4, abaixo.
const comEspacoComum = texto => texto.replace(/\u00a0/g, ' ');

const MOTOR_CRU = semComentario(readFileSync('src/Engine/MapEngine.js', 'utf8'));
const SELECAO_CRU = semComentario(readFileSync('src/UI/Components/CharSelect/CharSelectCommon.js', 'utf8'));
const SELECAO_HTML = readFileSync('src/UI/Components/CharSelect/CharSelectV4/CharSelectV4.html', 'utf8');
const SELECAO_CSS = readFileSync('src/UI/Components/CharSelect/CharSelectV4/CharSelectV4.css', 'utf8');
const COMMON_CSS = readFileSync('src/UI/Common.css', 'utf8');
const CHAR_ENGINE_CRU = semComentario(readFileSync('src/Engine/CharEngine.js', 'utf8'));
const ANALISADOR_CRU = semComentario(readFileSync('src/UI/Components/HuntAnalyzer/HuntAnalyzer.js', 'utf8'));

describe('os numeros da tela "Dormindo..." (D-2478)', () => {
	it('ganho ate agora, ritmo por hora e o que falta saem da MESMA taxa, com o piso do acerto', async () => {
		const { numerosDoSono } = await import('UI/numerosDoSono.js');
		const n = numerosDoSono({ restanteMs: 2 * 3600_000, dormidoMs: 3600_000, expBasePorMs: 0.0015, expClassePorMs: 0.00075 });
		expect(n.ateAgora).toEqual({ base: 5400, classe: 2700 });
		expect(n.porHora).toEqual({ base: 5400, classe: 2700 });
		expect(n.pelaFrente).toEqual({ base: 10800, classe: 5400 });
		expect(n.rendendo).toBe(true);
		// O piso (nunca inventar fracao de EXP, como o acerto do servidor).
		expect(numerosDoSono({ restanteMs: 1, dormidoMs: 999, expBasePorMs: 0.001, expClassePorMs: 0 }).ateAgora.base).toBe(0);
	});

	it('a taxa ZERO (o sono aceito antes da D-2477) nao rende: `rendendo` falso', async () => {
		const { numerosDoSono } = await import('UI/numerosDoSono.js');
		const n = numerosDoSono({ restanteMs: 8 * 3600_000, dormidoMs: 0, expBasePorMs: 0, expClassePorMs: 0 });
		expect(n.rendendo).toBe(false);
		expect(n.pelaFrente).toEqual({ base: 0, classe: 0 });
		// So classe tambem nao rende: o acerto paga a classe junto da base.
		expect(numerosDoSono({ restanteMs: 1000, dormidoMs: 0, expBasePorMs: 0, expClassePorMs: 1 }).rendendo).toBe(false);
	});

	it('entrada torta (ausente, negativa, texto) vira zero, nunca NaN na tela', async () => {
		const { numerosDoSono } = await import('UI/numerosDoSono.js');
		const n = numerosDoSono({ restanteMs: -5, dormidoMs: 'x', expBasePorMs: undefined, expClassePorMs: -1 });
		expect(n).toEqual({
			ateAgora: { base: 0, classe: 0 },
			porHora: { base: 0, classe: 0 },
			pelaFrente: { base: 0, classe: 0 },
			rendendo: false,
			completo: true
		});
	});

	it('o sono so e COMPLETO quando nao falta nada (rodada 2, N1): um milissegundo antes ainda rende', async () => {
		const { numerosDoSono } = await import('UI/numerosDoSono.js');
		const taxa = { expBasePorMs: 0.001, expClassePorMs: 0.0005 };
		expect(numerosDoSono({ ...taxa, restanteMs: 1, dormidoMs: 8 * 3600_000 - 1 }).completo).toBe(false);
		expect(numerosDoSono({ ...taxa, restanteMs: 0, dormidoMs: 8 * 3600_000 }).completo).toBe(true);
	});
});

describe('a tela "Dormindo..." diz que esta ganhando, e volta a selecao sem acordar (D-2478)', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('mostra "Dormindo e ganhando EXP", o ganho ate agora e o ritmo', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(7 * 3600_000, { expBasePorMs: 0.001, expClassePorMs: 0.0005 }, () => {}, {
			dormidoMs: 3600_000
		});
		const texto = comEspacoComum(document.body.lastElementChild.textContent);
		expect(texto).toContain('Dormindo e ganhando EXP');
		expect(texto).toMatch(/Ganho até agora: ~3[.,]?600 EXP base · ~1[.,]?800 EXP classe/);
		expect(texto).toMatch(/Ritmo: ~3[.,]?600 EXP base\/h/);
		expect(texto).toMatch(/pela frente/);
		tela.remove();
	});

	it('o ganho ate agora ANDA com o relogio da tela (o que sai do restante entra no dormido)', async () => {
		vi.useFakeTimers();
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(3600_000, { expBasePorMs: 1, expClassePorMs: 0 }, () => {}, { dormidoMs: 0 });
		const linha = () => [...document.body.lastElementChild.querySelectorAll('div')].find(d => d.textContent.startsWith('Ganho até agora'));
		expect(comEspacoComum(linha().textContent)).toContain('~0 EXP base');
		vi.advanceTimersByTime(3000);
		expect(comEspacoComum(linha().textContent)).toMatch(/~3[.,]?000 EXP base/);
		tela.remove();
	});

	it('o relogio chega a zero: a faixa deixa de dizer "ganhando" e mostra o ganho do sono inteiro (rodada 2, N1)', async () => {
		vi.useFakeTimers();
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(2000, { expBasePorMs: 1, expClassePorMs: 0.5 }, () => {}, { dormidoMs: 8 * 3600_000 - 2000 });
		const janela = document.body.lastElementChild;
		expect(janela.textContent, 'PRE-CONDICAO: com tempo pela frente, ainda rende').toContain('Dormindo e ganhando EXP');
		// Rodada 3: o "pela frente" e o "Ritmo" ESTAO na tela antes do zero, lidos do mesmo jeito que o "nao" de baixo
		// (com o espaco comum): sem isto, o espaco sem quebra do N4 deixava o "nao contem" verdadeiro de graca.
		expect(comEspacoComum(janela.textContent), 'PRE-CONDICAO: o que falta esta na tela').toContain('pela frente');
		expect(comEspacoComum(janela.textContent), 'PRE-CONDICAO: o ritmo esta na tela').toContain('Ritmo:');
		vi.advanceTimersByTime(2000);
		expect(janela.textContent).not.toContain('Dormindo e ganhando EXP');
		expect(janela.textContent).toContain('Sono completo: acorde para receber a EXP');
		expect(comEspacoComum(janela.textContent)).toMatch(/Ganho do sono: ~28[.,]?800[.,]?000 EXP base · ~14[.,]?400[.,]?000 EXP classe/);
		expect(comEspacoComum(janela.textContent), 'o ritmo de um sono parado').not.toContain('Ritmo:');
		expect(comEspacoComum(janela.textContent), 'o "pela frente" de um sono parado').not.toContain('pela frente');
		expect(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(janela.textContent), 'travessao na tela').toBe(false);
		tela.remove();
	});

	it('o sono a taxa ZERO que chega ao fim continua com o aviso laranja, e nao "Sono completo" com ganho zero', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(0, { expBasePorMs: 0, expClassePorMs: 0 }, () => {}, { dormidoMs: 8 * 3600_000 });
		const texto = document.body.lastElementChild.textContent;
		expect(texto).toContain('Este sono não está rendendo EXP');
		expect(texto).not.toContain('Sono completo');
		tela.remove();
	});

	it('com a taxa zero, o aviso diz que o sono nao rende (em vez de "ganhando")', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(8 * 3600_000, { expBasePorMs: 0, expClassePorMs: 0 }, () => {}, { dormidoMs: 0 });
		const texto = document.body.lastElementChild.textContent;
		expect(texto).not.toContain('Dormindo e ganhando EXP');
		expect(texto).toContain('Este sono não está rendendo EXP');
		tela.remove();
	});

	it('"Voltar à seleção de personagem" chama a volta UMA vez, e depois dele o "Acordar" nao pede nada', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		let voltas = 0;
		let acordares = 0;
		const tela = UIManager.showDormindo(
			1000,
			{ expBasePorMs: 0.001 },
			() => {
				acordares++;
			},
			{
				onVoltarASelecao: () => {
					voltas++;
				}
			}
		);
		const botoes = [...document.body.lastElementChild.querySelectorAll('button')];
		expect(botoes.map(b => b.textContent)).toEqual(['Acordar agora', 'Voltar à seleção de personagem']);
		botoes[1].dispatchEvent(new Event('click'));
		botoes[1].dispatchEvent(new Event('click'));
		botoes[0].dispatchEvent(new Event('click'));
		expect(voltas).toBe(1);
		expect(acordares, 'voltar a selecao NAO acorda: o sono segue no servidor').toBe(0);
		expect(botoes[1].style.minHeight, 'o piso tatil vale para o segundo botao').toBe('44px');
		tela.remove();
	});

	it('sem a volta (quem chama nao pediu), a tela fica com um botao so', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(1000, {}, () => {});
		expect(document.body.lastElementChild.querySelectorAll('button')).toHaveLength(1);
		tela.remove();
	});

	it('o rodape avisa que entrar com outro personagem da conta encerra o sono, sem travessao', async () => {
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(1000, {}, () => {});
		const texto = document.body.lastElementChild.textContent;
		expect(texto).toContain('Entrar com outro personagem desta conta encerra este sono.');
		expect(/[\u2013\u2014]/.test(texto)).toBe(false);
		tela.remove();
	});
});

describe('a linha do resumo so dobra no rotulo ou depois do "·" (rodada 3 da D-2478, N4)', () => {
	// O espaco COMUM e o unico ponto onde o navegador dobra a linha: cortar por ele da os pedacos que nunca se separam.
	// O defeito do celular em pe da rodada 2 ("classe" sozinha embaixo) seria um pedaco "classe".
	const NB = '\u00a0';
	const pedacos = linha => linha.replace(/~[\d.,]+/g, '~N').split(' ');
	const folha = (janela, teste) => [...janela.querySelectorAll('div')].find(d => d.children.length === 0 && teste(d.textContent));

	afterEach(() => {
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('cada metade e o "·" ficam inteiros nas quatro formas de linha, e o texto lido e o mesmo', async () => {
		const { semQuebraDentroDasMetades } = await import('UI/numerosDoSono.js');
		const casos = [
			['Ganho até agora: ~22.733 EXP base · ~14.072 EXP classe', ['Ganho', 'até', 'agora:', `~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe`]],
			['Ritmo: ~7.559 EXP base/h · ~4.680 EXP classe/h', ['Ritmo:', `~N${NB}EXP${NB}base/h${NB}·`, `~N${NB}EXP${NB}classe/h`]],
			['~37.746 EXP base · ~23.367 EXP classe pela frente', [`~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe${NB}pela${NB}frente`]],
			// o numero de nivel alto e o separador do ingles
			['Ganho do sono: ~1.234.567 EXP base · ~617,283 EXP classe', ['Ganho', 'do', 'sono:', `~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe`]]
		];
		for (const [linha, esperado] of casos) {
			const saida = semQuebraDentroDasMetades(linha);
			expect(pedacos(saida), linha).toEqual(esperado);
			expect(comEspacoComum(saida), 'nada some: so muda onde a linha dobra').toBe(linha);
		}
	});

	it('na tela, as tres linhas do sono que rende e a do sono completo saem com as metades inteiras', async () => {
		vi.useFakeTimers();
		const { default: UIManager } = await import('UI/UIManager.js');
		const tela = UIManager.showDormindo(2000, { expBasePorMs: 1, expClassePorMs: 0.5 }, () => {}, { dormidoMs: 8 * 3600_000 - 2000 });
		const janela = document.body.lastElementChild;
		const ateAgora = folha(janela, t => t.startsWith('Ganho até agora'));
		const ritmo = folha(janela, t => t.startsWith('Ritmo:'));
		const pelaFrente = folha(janela, t => t.endsWith(`pela${NB}frente`));
		expect(pedacos(ateAgora.textContent)).toEqual(['Ganho', 'até', 'agora:', `~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe`]);
		expect(pedacos(ritmo.textContent)).toEqual(['Ritmo:', `~N${NB}EXP${NB}base/h${NB}·`, `~N${NB}EXP${NB}classe/h`]);
		expect(pedacos(pelaFrente.textContent)).toEqual([`~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe${NB}pela${NB}frente`]);
		vi.advanceTimersByTime(2000);
		const doSono = folha(janela, t => t.startsWith('Ganho do sono'));
		expect(pedacos(doSono.textContent)).toEqual(['Ganho', 'do', 'sono:', `~N${NB}EXP${NB}base${NB}·`, `~N${NB}EXP${NB}classe`]);
		tela.remove();
	});

	it('o ingles do catalogo publicado casa a linha com o espaco sem quebra (o tradutor le o U+00A0 como espaco)', async () => {
		const { absorverCatalogo, desligarTraducao, traduzir } = await import('Core/Traducao.js');
		const { semQuebraDentroDasMetades } = await import('UI/numerosDoSono.js');
		absorverCatalogo(JSON.parse(readFileSync('public/ragidle/i18n/en/catalogo.json', 'utf8')));
		try {
			const em = linha => traduzir(semQuebraDentroDasMetades(linha));
			expect(em('Ganho até agora: ~22.733 EXP base · ~14.072 EXP classe')).toBe('Earned so far: ~22,733 Base EXP · ~14,072 Job EXP');
			expect(em('Ritmo: ~7.559 EXP base/h · ~4.680 EXP classe/h')).toBe('Rate: ~7,559 Base EXP/h · ~4,680 Job EXP/h');
			expect(em('~37.746 EXP base · ~23.367 EXP classe pela frente')).toBe('~37,746 Base EXP · ~23,367 Job EXP to go');
			expect(em('Ganho do sono: ~60.479 EXP base · ~37.440 EXP classe')).toBe('Sleep earnings: ~60,479 Base EXP · ~37,440 Job EXP');
		} finally {
			desligarTraducao();
		}
	});
});

describe('o motor liga a tela ao servidor (D-2477, D-2478)', () => {
	it('a recusa `amostra-sem-exp` tem texto proprio, sem travessao', () => {
		const i = MOTOR_CRU.indexOf('const TEXTO_DA_RECUSA_DE_SONO = {');
		const bloco = MOTOR_CRU.slice(i, MOTOR_CRU.indexOf('};', i));
		const linha = bloco.slice(bloco.indexOf("'amostra-sem-exp':"), bloco.indexOf("'amostra-sem-exp':") + 300);
		expect(linha).toContain('não ganhou EXP');
		expect(/[\u2013\u2014]/.test(bloco), 'travessao nos textos do Dormir').toBe(false);
	});

	it('a tela recebe o `dormidoMs` do servidor e a volta a selecao', () => {
		const i = MOTOR_CRU.indexOf('if (corpo.dormindo === true) {');
		const ramo = MOTOR_CRU.slice(i, MOTOR_CRU.indexOf('// dormindo === false', i));
		expect(ramo).toContain('Number(corpo.dormidoMs)');
		expect(ramo).toContain('onVoltarASelecao');
		expect(ramo).toContain('irParaASelecaoDePersonagem()');
		expect(ramo).toMatch(/\}, extrasDoSono\);/);
	});

	it('a volta a selecao e UMA so: o "Selecionar personagem" do menu passa pela mesma funcao', () => {
		const i = MOTOR_CRU.indexOf('function onRestartAnswer(pkt) {');
		const corpo = MOTOR_CRU.slice(i, MOTOR_CRU.indexOf('\n}', i));
		expect(corpo).toContain('irParaASelecaoDePersonagem();');
		const f = MOTOR_CRU.indexOf('function irParaASelecaoDePersonagem() {');
		expect(f).toBeGreaterThan(-1);
		expect(MOTOR_CRU.slice(f, MOTOR_CRU.indexOf('\n}', f))).toContain('onRestart();');
	});
});

describe('a selecao de personagem mostra quem dorme e pergunta antes de encerrar o sono (D-2478)', () => {
	const dorminhoco = { GID: 1, name: 'Dorminhoco', bodyState: 4 };
	const acordado = { GID: 2, name: 'Acordado', bodyState: 0 };

	it('`OPT1_SLEEP` (4) no `bodyState` da lista e o dormindo; o resto nao', async () => {
		const { estaDormindoNaLista } = await import('UI/Components/CharSelect/sonoNaSelecao.js');
		expect(estaDormindoNaLista(dorminhoco)).toBe(true);
		expect(estaDormindoNaLista(acordado)).toBe(false);
		expect(estaDormindoNaLista({ GID: 3, bodyState: 1 }), 'pedra nao e sono').toBe(false);
		expect(estaDormindoNaLista(undefined)).toBe(false);
	});

	it('entrar com OUTRO personagem lista quem dorme; entrar com o proprio dorminhoco nao encerra nada', async () => {
		const { sonosQueAEntradaEncerra } = await import('UI/Components/CharSelect/sonoNaSelecao.js');
		const slots = [dorminhoco, undefined, acordado];
		expect(sonosQueAEntradaEncerra(slots, acordado)).toEqual([dorminhoco]);
		expect(sonosQueAEntradaEncerra(slots, dorminhoco)).toEqual([]);
		expect(sonosQueAEntradaEncerra([acordado], acordado)).toEqual([]);
	});

	it('a pergunta diz quem dorme, com quem entra e o que acontece, sem travessao', async () => {
		const { perguntaAntesDeEncerrarOSono } = await import('UI/Components/CharSelect/sonoNaSelecao.js');
		const t = perguntaAntesDeEncerrarOSono([dorminhoco], acordado);
		expect(t).toBe(
			'Dorminhoco está dormindo. Entrar com Acordado encerra o sono agora: ele recebe só a EXP do tempo já dormido. Entrar mesmo assim?'
		);
		expect(/[\u2013\u2014]/.test(t)).toBe(false);
	});

	it('a grade da V4 tem o icone de dormir em TODA vaga, ao lado do da classe, e a linha da ficha', () => {
		expect(SELECAO_HTML.match(/<div class="job_icon"><\/div>\s*<div class="sono_icon" hidden><\/div>/g)).toHaveLength(15);
		expect(SELECAO_HTML).toMatch(/<p class="cs-sono" hidden>/);
	});

	it('o componente acende o icone pela lista, carrega a arte do GRF e pergunta antes de entrar', () => {
		expect(SELECAO_CRU).toContain("querySelector('.sono_icon')");
		expect(SELECAO_CRU).toContain('sonoIcon.hidden = !dorme;');
		expect(SELECAO_CRU).toContain('item/${ICONE_DO_SONO}.bmp');
		const i = SELECAO_CRU.indexOf('function connect() {');
		const corpo = SELECAO_CRU.slice(i, SELECAO_CRU.indexOf('function reserve()', i));
		expect(corpo).toContain('sonosQueAEntradaEncerra(_slots, escolhido)');
		expect(corpo).toMatch(/UIManager\.showPromptBox\(perguntaAntesDeEncerrarOSono\(encerra, escolhido\), 'yes', 'no', entrar, null\)/);
	});

	/*
	 * B1 DO CRITICO (rodada 2): o `bodyState` da lista ia para a entidade do jogador DENTRO do mundo (`Entity.set`
	 * copia a chave e o setter poe o `status-sleep`; nada o tira). O mecanismo, com a `Entity` de verdade, mora em
	 * `tests/renderer/sonoDaListaNaoVaiAoMundo.test.js`; aqui, o corte puro e as tres costuras.
	 */
	it('`semOSonoDaLista` da uma COPIA com o corpo zerado; a lista guarda o 4 para o icone e a pergunta', async () => {
		const { semOSonoDaLista, estaDormindoNaLista } = await import('UI/Components/CharSelect/sonoNaSelecao.js');
		const daLista = { GID: 7, CharNum: 2, name: 'Dorminhoco', job: 4012, effectState: 0, bodyState: 4 };
		const corpo = semOSonoDaLista(daLista);
		expect(corpo).not.toBe(daLista);
		expect(corpo).toEqual({ ...daLista, bodyState: 0 });
		expect(daLista.bodyState, 'o objeto da lista perdeu o sinal: o icone apagaria').toBe(4);
		expect(estaDormindoNaLista(daLista)).toBe(true);
		expect(estaDormindoNaLista(corpo)).toBe(false);
	});

	it('o `Player` da entrada e os dois bonecos da grade nascem do corpo zerado, nunca do objeto cru da lista', () => {
		expect(CHAR_ENGINE_CRU).toContain('Session.Entity = new Player(semOSonoDaLista(entity));');
		expect(CHAR_ENGINE_CRU).not.toMatch(/new Player\(entity\)/);
		expect(SELECAO_CRU.match(/_entitySlots\[character\.CharNum\]\.set\(semOSonoDaLista\(character\)\);/g)).toHaveLength(2);
		expect(SELECAO_CRU).not.toMatch(/\.set\(character\)/);
	});

	/*
	 * B2 DO CRITICO (rodada 2): a linha da ficha saia no verde da tela PRETA do sono, 1,53:1 sobre o cartao claro.
	 * O cartao e branco translucido (`--surface-card`); o print mediu (253, 253, 254) atras da linha.
	 */
	it('a linha da ficha usa o verde do design system e passa de 4,5:1 sobre o cartao (WCAG AA)', () => {
		const regra = SELECAO_CSS.slice(SELECAO_CSS.indexOf('#CharSelectV4 .charinfo .cs-sono {'));
		const cor = /color:\s*([^;]+);/.exec(regra.slice(0, regra.indexOf('}')))?.[1].trim();
		expect(cor).toBe('var(--ri-verde)');
		const token = nome => new RegExp(`${nome}:\\s*([^;]+);`).exec(COMMON_CSS)?.[1].trim();
		expect(token('--ri-verde')).toBe('var(--green-600)');
		const hex = token('--green-600');
		const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
		const lin = c => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
		const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
		const contraste = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
		expect(contraste(rgb, [253, 253, 254])).toBeGreaterThanOrEqual(4.5);
		expect(contraste(rgb, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
	});
});

describe('o resumo do sono que venceu as 8 h no login (D-2482)', () => {
	it('semReconectar: o Continuar so fecha o resumo, sem tocar no acordar nem na janela do sono', () => {
		const i = MOTOR_CRU.indexOf('function onSonoRecebido(');
		const corpo = MOTOR_CRU.slice(i, MOTOR_CRU.indexOf('\n}', i));
		expect(corpo).toContain('const jaNoMundo = corpo.semReconectar === true;');
		// O guarda do acordar e a janela de espera ficam so para o ack do "Acordar agora".
		const guarda = corpo.slice(corpo.indexOf('if (!jaNoMundo) {'));
		expect(guarda.slice(0, guarda.indexOf('const resumo'))).toContain('if (_acordarResolvido) return;');
		expect(corpo).toContain('UIManager.showResumoDoSono(resumo, jaNoMundo ? () => {} : voltarAoMundoDepoisDoSono);');
	});
});

describe('o botao da Analise de Caca diz quando a cacada ainda nao deu EXP (D-2477)', () => {
	it('sem EXP de base na cacada, o botao fica desabilitado com o motivo', () => {
		const i = ANALISADOR_CRU.indexOf('function sincronizarDormir(');
		const corpo = ANALISADOR_CRU.slice(i, ANALISADOR_CRU.indexOf('\n}', i));
		expect(corpo).toContain('const semExp = emCaca && !(Number(r.expBase) > 0);');
		expect(corpo).toContain('const pronto = emCaca && !semExp && mapaElegivel && faltamMs <= 0;');
		expect(corpo).toContain("motivo = 'a caçada ainda não deu EXP';");
	});

	it('D-2481: sem numero do servidor (o relogio da caca nao comecou), o motivo diz de onde os 10 minutos partem, e nao um "disponivel em 10:00" parado', () => {
		const i = ANALISADOR_CRU.indexOf('function sincronizarDormir(');
		const corpo = ANALISADOR_CRU.slice(i, ANALISADOR_CRU.indexOf('\n}', i));
		expect(corpo).toContain("const relogioAndando = !!ctx && typeof ctx.faltamMsParaDormir === 'number';");
		expect(corpo).toContain("motivo = relogioAndando ? `disponível em ${duracao(faltamMs)}` : 'os 10 minutos contam a partir do primeiro abate';");
	});
});
