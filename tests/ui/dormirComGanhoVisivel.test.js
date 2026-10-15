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

const MOTOR_CRU = semComentario(readFileSync('src/Engine/MapEngine.js', 'utf8'));
const SELECAO_CRU = semComentario(readFileSync('src/UI/Components/CharSelect/CharSelectCommon.js', 'utf8'));
const SELECAO_HTML = readFileSync('src/UI/Components/CharSelect/CharSelectV4/CharSelectV4.html', 'utf8');
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
		expect(n).toEqual({ ateAgora: { base: 0, classe: 0 }, porHora: { base: 0, classe: 0 }, pelaFrente: { base: 0, classe: 0 }, rendendo: false });
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
		const texto = document.body.lastElementChild.textContent;
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
		expect(linha().textContent).toContain('~0 EXP base');
		vi.advanceTimersByTime(3000);
		expect(linha().textContent).toMatch(/~3[.,]?000 EXP base/);
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
});

describe('o botao da Analise de Caca diz quando a cacada ainda nao deu EXP (D-2477)', () => {
	it('sem EXP de base na cacada, o botao fica desabilitado com o motivo', () => {
		const i = ANALISADOR_CRU.indexOf('function sincronizarDormir(');
		const corpo = ANALISADOR_CRU.slice(i, ANALISADOR_CRU.indexOf('\n}', i));
		expect(corpo).toContain('const semExp = emCaca && !(Number(r.expBase) > 0);');
		expect(corpo).toContain('const pronto = emCaca && !semExp && mapaElegivel && faltamMs <= 0;');
		expect(corpo).toContain("motivo = 'a caçada ainda não deu EXP';");
	});
});
