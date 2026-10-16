/**
 * O RESUMO DA VOLTA VEM ANTES DA "NOVIDADES" (frente I do segundo plano,
 * D-2595, 16/10/2026).
 *
 * A `prove:dormir` mediu o resumo do Dormir COBERTO pela caixa de boas-vindas
 * (`elementFromPoint` no "Continuar" deu "img (em #BoasVindasIdle)"). Aqui se
 * cobra:
 *   1. a decisao pura (`resumoAntesDasNovidades.js`), nos tres casos;
 *   2. o cartaz DE VERDADE (`BoasVindasIdle.onAppend`) pedindo pela fila - o
 *      CONTROLE que reprova na base: la ele abria por cima do resumo;
 *   3. as tres costuras que o jsdom nao monta (o popup do sono no
 *      `UIManager.js`, a janela da ausencia, o tutorial), no fonte SEM
 *      comentario.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { criarFilaDaVolta } from '../../src/UI/resumoAntesDasNovidades.js';

function semComentario(texto) {
	return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

function cartazFalso() {
	const c = { aberto: false, mostrou: 0, escondeu: 0 };
	c.pecas = {
		estaAberta: () => c.aberto,
		esconder: () => {
			c.aberto = false;
			c.escondeu++;
		},
		mostrar: () => {
			c.aberto = true;
			c.mostrou++;
		}
	};
	return c;
}

describe('a fila da volta (pura)', () => {
	let fila;
	let cartaz;
	beforeEach(() => {
		fila = criarFilaDaVolta();
		cartaz = cartazFalso();
		fila.registrarNovidades(cartaz.pecas);
	});

	it('CONTROLE: sem resumo na tela, a Novidades abre na hora', () => {
		expect(fila.pedirNovidades()).toBe(true);
		expect(cartaz.mostrou).toBe(1);
		expect(fila.novidadesEspera()).toBe(false);
	});

	it('com o resumo do sono na tela, a Novidades espera e abre quando ele fecha', () => {
		fila.resumoAbriu('sono');
		expect(fila.pedirNovidades()).toBe(false);
		expect(cartaz.mostrou).toBe(0);
		expect(fila.novidadesEspera()).toBe(true);
		fila.resumoFechou('sono');
		expect(cartaz.mostrou).toBe(1);
		expect(cartaz.aberto).toBe(true);
		expect(fila.novidadesEspera()).toBe(false);
	});

	it('o resumo que chega DEPOIS do cartaz o tira da frente, e ele volta ao fechar', () => {
		fila.pedirNovidades();
		expect(cartaz.aberto).toBe(true);
		fila.resumoAbriu('ausencia');
		expect(cartaz.aberto, 'o cartaz continuou cobrindo o resumo').toBe(false);
		expect(cartaz.escondeu).toBe(1);
		fila.resumoFechou('ausencia');
		expect(cartaz.aberto, 'o cartaz que saiu da frente nao voltou').toBe(true);
		expect(cartaz.mostrou).toBe(2);
	});

	it('o resumo com o cartaz JA FECHADO pelo jogador nao o reabre', () => {
		fila.pedirNovidades();
		cartaz.pecas.esconder(); // o jogador fechou
		fila.resumoAbriu('sono');
		fila.resumoFechou('sono');
		expect(cartaz.mostrou).toBe(1);
		expect(cartaz.aberto).toBe(false);
	});

	it('dois resumos: a Novidades so abre quando o ULTIMO fecha', () => {
		fila.resumoAbriu('sono');
		fila.resumoAbriu('ausencia');
		fila.pedirNovidades();
		fila.resumoFechou('sono');
		expect(cartaz.mostrou, 'abriu por cima do resumo que ainda estava na tela').toBe(0);
		expect(fila.haResumoAberto()).toBe(true);
		fila.resumoFechou('ausencia');
		expect(cartaz.mostrou).toBe(1);
		expect(fila.haResumoAberto()).toBe(false);
	});

	it('o mesmo resumo aberto duas vezes (o servidor manda de novo) fecha com um clique', () => {
		fila.resumoAbriu('ausencia');
		fila.resumoAbriu('ausencia');
		fila.pedirNovidades();
		fila.resumoFechou('ausencia');
		expect(cartaz.mostrou).toBe(1);
	});

	it('a troca de personagem esquece a espera sem abrir a Novidades', () => {
		fila.resumoAbriu('sono');
		fila.pedirNovidades();
		fila.esquecer();
		expect(cartaz.mostrou).toBe(0);
		expect(fila.haResumoAberto()).toBe(false);
		fila.resumoFechou('sono'); // o popup velho fechando depois nao abre nada
		expect(cartaz.mostrou).toBe(0);
	});

	it('fechar um resumo sem a Novidades pendente nao abre nada', () => {
		fila.resumoAbriu('sono');
		fila.resumoFechou('sono');
		expect(cartaz.mostrou).toBe(0);
	});

	it('um cartaz que lanca ao ser lido nao derruba o resumo', () => {
		fila.registrarNovidades({
			estaAberta: () => {
				throw new Error('sem DOM');
			},
			esconder: () => {},
			mostrar: () => {}
		});
		expect(() => fila.resumoAbriu('sono')).not.toThrow();
		expect(fila.haResumoAberto()).toBe(true);
	});
});

vi.mock('UI/GUIComponent.js', () => ({
	default: class {
		static MouseMode = { CROSS: 0, STOP: 1, FREEZE: 2 };
		constructor(nome) {
			this.name = nome;
		}
	}
}));
vi.mock('Core/Preferences.js', () => ({
	default: { get: (_nome, padrao) => ({ ...padrao, save() {} }) }
}));
vi.mock('../../src/UI/Components/limpezaDeJanelaIdle.js', () => ({ fecharEEsquecer: () => {} }));

describe('o cartaz de verdade (BoasVindasIdle.onAppend) pede pela fila', () => {
	let BoasVindasIdle;
	let fila;
	let mostrou;
	let aberto;
	beforeEach(async () => {
		BoasVindasIdle = (await import('UI/Components/BoasVindasIdle/BoasVindasIdle.js')).default;
		fila = (await import('UI/resumoAntesDasNovidades.js')).default;
		mostrou = 0;
		aberto = false;
		BoasVindasIdle.mostrar = () => {
			mostrou++;
			aberto = true;
		};
		BoasVindasIdle.fechar = () => {
			aberto = false;
		};
		BoasVindasIdle.estaAberta = () => aberto;
		BoasVindasIdle.limparEstadoDoPersonagem();
	});

	it('CONTROLE: entrada sem resumo, o cartaz abre', () => {
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(1);
	});

	it('o resumo do sono ja na tela: o cartaz NAO abre por cima, e abre quando o resumo fecha', () => {
		fila.resumoAbriu('sono');
		BoasVindasIdle.onAppend();
		expect(mostrou, 'a Novidades abriu por cima do resumo do sono (o defeito da prove:dormir)').toBe(0);
		fila.resumoFechou('sono');
		expect(mostrou).toBe(1);
	});

	it('o resumo da ausencia chega com o cartaz aberto: o cartaz sai e volta depois', () => {
		BoasVindasIdle.onAppend();
		expect(aberto).toBe(true);
		fila.resumoAbriu('ausencia');
		expect(aberto, 'o cartaz continuou por cima de "Enquanto voce esteve fora"').toBe(false);
		fila.resumoFechou('ausencia');
		expect(aberto).toBe(true);
	});

	it('a troca de personagem esquece a espera (o proximo entra limpo)', () => {
		fila.resumoAbriu('sono');
		BoasVindasIdle.onAppend();
		BoasVindasIdle.limparEstadoDoPersonagem();
		BoasVindasIdle.onAppend();
		expect(mostrou).toBe(1);
	});
});

describe('as costuras (fonte sem comentario)', () => {
	const uiManager = semComentario(readFileSync('src/UI/UIManager.js', 'utf8').replace(/\r\n/g, '\n'));
	const ausencia = semComentario(
		readFileSync('src/UI/Components/AusenciaIdle/AusenciaIdle.js', 'utf8').replace(/\r\n/g, '\n')
	);
	const tutorial = semComentario(
		readFileSync('src/UI/Components/TutorialIdle/TutorialIdle.js', 'utf8').replace(/\r\n/g, '\n')
	);

	function corpoDe(fonte, inicio, fim) {
		const i = fonte.indexOf(inicio);
		expect(i, `${inicio} sumiu`).toBeGreaterThan(-1);
		const j = fonte.indexOf(fim, i + inicio.length);
		return fonte.slice(i, j === -1 ? undefined : j);
	}

	it('o resumo do sono avisa a fila ao abrir e ao fechar', () => {
		const corpo = corpoDe(uiManager, 'static showResumoDoSono(', '\n\tstatic ');
		expect(corpo).toContain("filaDaVolta.resumoAbriu('sono');");
		expect(corpo).toContain("filaDaVolta.resumoFechou('sono');");
		// O aviso de fechar vem antes de voltar ao mundo (a volta reabre o mapa).
		const fechar = corpoDe(corpo, 'function fechar()', '\n\t\t}');
		expect(fechar.indexOf("resumoFechou('sono')")).toBeGreaterThan(-1);
		expect(fechar.indexOf("resumoFechou('sono')")).toBeLessThan(fechar.indexOf('onContinuar()'));
	});

	it('a janela da ausencia avisa ao abrir (pela porta da pilha) e ao fechar como visto', () => {
		const toggle = corpoDe(ausencia, 'AusenciaIdle.toggle = function toggle()', '\n};');
		expect(toggle).toContain("filaDaVolta.resumoAbriu('ausencia');");
		const fechar = corpoDe(ausencia, 'function fecharComoVisto()', '\n}');
		expect(fechar).toContain("filaDaVolta.resumoFechou('ausencia');");
		const limpar = corpoDe(ausencia, 'AusenciaIdle.limparEstadoDoPersonagem = function', '\n};');
		expect(limpar).toContain('filaDaVolta.esquecer();');
		expect(limpar).not.toContain('resumoFechou');
	});

	it('o "Continuar" do resumo do sono ganha o piso tatil SO no dedo (o desktop fica como estava)', () => {
		const corpo = corpoDe(uiManager, 'static showResumoDoSono(', '\n\tstatic ');
		expect(corpo).toContain("continuar.classList.add('ri-btn--dedo');");
		const css = readFileSync('src/UI/Common.css', 'utf8').replace(/\r\n/g, '\n');
		const regra = css.indexOf('.ri-btn--dedo {\n\t\tmin-height: var(--hit-touch, 44px);');
		expect(regra, 'a regra do piso tatil sumiu do Common.css').toBeGreaterThan(-1);
		expect(css.lastIndexOf('@media', regra), 'a regra saiu do bloco do dedo').toBe(css.lastIndexOf('@media (pointer: coarse)', regra));
	});

	it('o tutorial cede enquanto um resumo da volta esta na tela', () => {
		expect(tutorial).toContain('!filaDaVolta.haResumoAberto() &&');
	});
});
