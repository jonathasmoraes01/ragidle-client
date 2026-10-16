/**
 * "ENQUANTO VOCE ESTEVE FORA" (frente C do segundo plano, D-2565..D-2567).
 *
 * O resumo e contado pelo SERVIDOR (`servidor/idle/ausencia.ts`); aqui se cobra
 * o que o cliente faz com ele: a formatacao pura (`resumoDaAusencia.js`), o fio
 * no `MapEngine.js` (que nao carrega em jsdom: cobrado no fonte SEM comentario)
 * e a janela na pilha, com o "visto" ao fechar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	avisoDeMorteNaTelaPreta,
	duracaoLegivel,
	linhaDaTelaPreta,
	resumoParaATela
} from '../../src/UI/Components/AusenciaIdle/resumoDaAusencia.js';

function semComentario(texto) {
	return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const nome = id => ({ 909: 'Jellopy', 501: 'Poção Vermelha' })[id] || '';
const num = n => String(n);

describe('a formatacao do resumo (pura)', () => {
	it('o tempo fora em horas e minutos, sem inventar segundos', () => {
		expect(duracaoLegivel(0)).toBe('menos de 1 min');
		expect(duracaoLegivel(59_999)).toBe('menos de 1 min');
		expect(duracaoLegivel(12 * 60_000)).toBe('12 min');
		expect(duracaoLegivel(60 * 60_000)).toBe('1 h');
		expect(duracaoLegivel(83 * 60_000)).toBe('1 h 23 min');
		expect(duracaoLegivel(undefined)).toBe('menos de 1 min');
	});

	it('os avisos com a contagem quando repetem; os numeros zerados somem (menos EXP e abates)', () => {
		const tela = resumoParaATela(
			{
				id: 7,
				duracaoMs: 3_600_000,
				expBase: 1200,
				expClasse: 300,
				niveisBase: 0,
				niveisClasse: 1,
				zeny: 0,
				abates: 40,
				mortes: 2,
				itens: [
					[909, 12],
					[501, 3]
				],
				outrosItens: 5,
				avisos: [
					{ texto: 'Você morreu para Poring.', vezes: 2 },
					{ texto: 'Suas poções acabaram: o Bot não tem mais poção de HP para usar.', vezes: 1 }
				]
			},
			nome,
			num
		);
		expect(tela.id).toBe(7);
		expect(tela.duracao).toBe('1 h');
		expect(tela.avisos.map(a => a.texto)).toEqual([
			'Você morreu para Poring. (2 vezes)',
			'Suas poções acabaram: o Bot não tem mais poção de HP para usar.'
		]);
		expect(tela.numeros).toEqual([
			{ rotulo: 'EXP base', valor: '+1200' },
			{ rotulo: 'EXP classe', valor: '+300' },
			{ rotulo: 'Níveis de classe', valor: '+1' },
			{ rotulo: 'Monstros derrotados', valor: '40' },
			{ rotulo: 'Mortes', valor: '2' }
		]);
		expect(tela.itens).toEqual([
			{ itemId: 909, nome: 'Jellopy', quantidade: 12 },
			{ itemId: 501, nome: 'Poção Vermelha', quantidade: 3 }
		]);
		expect(tela.outros).toBe(5);
		expect(tela.vazio).toBe(false);
	});

	it('zeny e niveis de base entram quando ha', () => {
		const tela = resumoParaATela({ zeny: 1500, niveisBase: 2 }, nome, num);
		expect(tela.numeros).toContainEqual({ rotulo: 'Zeny', valor: '+1500' });
		expect(tela.numeros).toContainEqual({ rotulo: 'Níveis de base', valor: '+2' });
	});

	it('o que vem torto do fio nao vira NaN nem linha fantasma', () => {
		const tela = resumoParaATela(
			{
				expBase: 'x',
				itens: [[0, 3], [909, -1], 'lixo', [999, 2]],
				avisos: [{}, { texto: '' }]
			},
			() => '',
			num
		);
		expect(tela.numeros[0]).toEqual({ rotulo: 'EXP base', valor: '+0' });
		expect(tela.itens).toEqual([{ itemId: 999, nome: 'Item 999', quantidade: 2 }]);
		expect(tela.avisos).toEqual([]);
		expect(resumoParaATela(null, nome, num).vazio).toBe(true);
	});

	it('a tela preta: os numeros do servidor e o aviso de morte que nao mente', () => {
		expect(linhaDaTelaPreta({ expBase: 10, expClasse: 4, abates: 3, itensTotal: 7 }, num)).toBe(
			'EXP base +10 · EXP classe +4 · Mobs mortos: 3 · Itens: 7'
		);
		expect(linhaDaTelaPreta(null, num)).toBe('EXP base +0 · EXP classe +0 · Mobs mortos: 0 · Itens: 0');
		const aviso = avisoDeMorteNaTelaPreta('Você morreu para Goblin (Vento).');
		expect(aviso).toContain('Você morreu para Goblin (Vento).');
		expect(aviso).toContain('voltou à cidade');
		expect(aviso).not.toMatch(/O Bot parou|relógio continua/);
		expect(avisoDeMorteNaTelaPreta(null)).toContain('Seu personagem morreu.');
	});

	it('os textos do jogador nao usam travessao (regra do dono)', () => {
		const fonte = readFileSync('src/UI/Components/AusenciaIdle/resumoDaAusencia.js', 'utf8');
		const textos = [...semComentario(fonte).matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map(m => m[2]).join('\n');
		expect(textos).not.toMatch(/[—–]/);
	});
});

describe('o fio no MapEngine', () => {
	const MOTOR = semComentario(readFileSync('src/Engine/MapEngine.js', 'utf8'));

	function corpoDe(assinatura) {
		const i = MOTOR.indexOf(assinatura);
		expect(i, assinatura).toBeGreaterThan(-1);
		return MOTOR.slice(i, MOTOR.indexOf('\n}', i));
	}

	it('o resumo do servidor abre a janela, num try proprio, ANTES do ramo ativa/inativa', () => {
		const corpo = corpoDe('function onEconomiaRecebida(pkt)');
		const i = corpo.indexOf('AusenciaIdle.mostrar(corpo.ausencia)');
		expect(i).toBeGreaterThan(-1);
		expect(i).toBeLessThan(corpo.indexOf('corpo.ativa === true'));
		expect(corpo.slice(0, i)).toMatch(/try \{\s*$/);
	});

	it('a tela preta guarda os numeros e a morte do servidor (e nao soma mais o registro da caca)', () => {
		const corpo = corpoDe('function onEconomiaRecebida(pkt)');
		expect(corpo).toContain('_parcialDaEconomia = corpo.parcial');
		expect(corpo).toContain('_morteDaEconomia = corpo.morte');
		const stats = corpoDe('function statsDaEconomia()');
		expect(stats).toContain('parcial: _parcialDaEconomia');
		expect(stats).toContain('morte: _morteDaEconomia');
		expect(MOTOR).not.toContain('lerRegistroDaCaca');
	});

	it('so a tela preta VISIVEL pede os numeros (resumo); a aba oculta fica calada', () => {
		const abrir = corpoDe('function abrirTelaDaEconomia(decorridoMs)'); // D-2599: o tempo fora
		expect(abrir).toMatch(/document\.visibilityState === 'visible' && --_segundosAteOResumo <= 0/);
		expect(abrir).toContain("pedirAcaoDaEconomia('resumo')");
		const volta = corpoDe('function onVisibilidadeMudouParaEconomia()');
		expect(volta).toMatch(/_janelaDaEconomia && document\.visibilityState === 'visible'/);
	});

	it('a janela esta na pilha, anexada, e na limpeza da troca de personagem', () => {
		expect(MOTOR).toContain("['ausencia', AusenciaIdle, '.au-window']");
		expect(MOTOR).toMatch(/AusenciaIdle\.append\(\)/);
		const i = MOTOR.indexOf('for (const modulo of [');
		expect(MOTOR.slice(i, MOTOR.indexOf(']', i))).toContain('AusenciaIdle');
	});
});

describe('a janela', () => {
	const JS = semComentario(readFileSync('src/UI/Components/AusenciaIdle/AusenciaIdle.js', 'utf8'));
	const CSS = readFileSync('src/UI/Components/AusenciaIdle/AusenciaIdle.css', 'utf8');

	it('fechar por qualquer porta (X, Continuar, ESC da pilha) e o "visto" com o id', () => {
		expect(JS).toMatch(/acao: 'visto', id: Number\(resumo\.id\)/);
		const toggle = JS.slice(JS.indexOf('AusenciaIdle.toggle = function toggle()'));
		expect(toggle.slice(0, toggle.indexOf('\n};'))).toContain('fecharComoVisto()');
		expect(JS).toMatch(/querySelector\('\.au-continuar'\)[\s\S]*?addEventListener\('click', onClickClose\)/);
		expect(JS).toMatch(/function onClickClose\(e\) \{[\s\S]*?AusenciaIdle\.toggle\(\);/);
	});

	it('a troca de personagem fecha SEM visto (o servidor manda de novo)', () => {
		const limpar = JS.slice(JS.indexOf('AusenciaIdle.limparEstadoDoPersonagem'));
		const corpo = limpar.slice(0, limpar.indexOf('\n};'));
		expect(corpo).not.toContain('visto');
		expect(corpo).toContain("fecharEEsquecer(_root(), '.au-window'");
	});

	it('cabe no celular: o host encolhe, o corpo rola por dentro e o botao tem o piso tatil', () => {
		expect(CSS).toMatch(/width: min\(420px, calc\(100vw - 16px\)\)/);
		const corpo = CSS.slice(CSS.indexOf('#AusenciaIdle .au-body {'));
		const regra = corpo.slice(0, corpo.indexOf('}'));
		expect(regra).toContain('overflow-y: auto;');
		expect(regra).toContain('min-height: 0;');
		expect(CSS).toMatch(/\.au-continuar \{[\s\S]*?min-height: 44px;/);
		expect(CSS).toMatch(/image-rendering: pixelated;/);
	});
});
