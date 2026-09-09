/**
 * O ACESSORIO DA HUD NAO DERRUBA A ENTRADA NO MAPA (09/09/2026).
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ELE MEDE, E POR QUE A PROVA E2E NAO BASTAVA
 * ════════════════════════════════════════════════════════════════════════════
 * Relato do Bob no alfa: o modo leitura no celular quebrou a entrada no jogo, e
 * foi preciso voltar ao commit anterior. A prova que ele rodou —
 * `npm run prove:e2e` com o modulo lancando de proposito — saiu **9/9
 * APROVADA**, e a leitura foi "entao nao e o modo leitura".
 *
 * Conferido nas duas direcoes em 09/09/2026: **os 9/9 sao verdade, e nao
 * respondem a pergunta**. Os nove passos daquela prova terminam ANTES da linha
 * do acessorio — a UI de jogo ja apareceu, e o servidor ja sabe do personagem
 * pelo `MAPMOVE`. O que quebra fica DEPOIS, no mesmo handler de ~460 linhas:
 *
 *   - `CheckAttendance.append()` — a janela de presenca diaria (D-1162);
 *   - `PluginManager.init()`;
 *   - `Network.sendPacket(CZ.NOTIFY_ACTORINIT)` — o "estou pronto" ao servidor;
 *   - o anuncio de taxas e a lista da loja de cash.
 *
 * "O jogador entra" e verdade e nao e o bastante. Este arquivo mede a parte que
 * a outra prova nao alcanca: que a excecao FICA no acessorio.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ELE TESTA O AJUDANTE, E NAO O `onMapChange`
 * ════════════════════════════════════════════════════════════════════════════
 * `MapEngine.js` arrasta a cadeia de render inteira — a primeira tentativa
 * morreu em WebGL no jsdom, como ja tinha acontecido com o modo leitura. O que
 * da para executar sem navegador e a REGRA: um acessorio que lanca nao pode
 * interromper quem o chamou. E ela e lida do fonte, para o teste falhar se
 * alguem tirar a guarda.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `process.cwd()`, e nao `import.meta.url`: neste projeto o segundo nao e uma
// URL de arquivo (o vitest resolve por alias), e `fileURLToPath` lanca.
const FONTE = readFileSync(join(process.cwd(), 'src/Engine/MapEngine.js'), 'utf8');

/** A mesma forma do ajudante que vive no `MapEngine`. */
function ligarAcessorioDaHud(nome, ligar, aoErrar) {
	try {
		ligar();
	} catch (erro) {
		aoErrar(nome, erro);
	}
}

describe('a regra: acessorio que lanca nao interrompe quem o chamou', () => {
	it('o que vem DEPOIS do acessorio ainda roda', () => {
		const feitos = [];
		const erros = [];

		ligarAcessorioDaHud('modo leitura', () => {
			throw new Error('explodiu');
		}, (nome, erro) => erros.push(nome + ': ' + erro.message));
		// Estas quatro linhas representam o que existe depois dele no handler.
		feitos.push('presenca diaria');
		feitos.push('plugins');
		feitos.push('NOTIFY_ACTORINIT');
		feitos.push('loja de cash');

		expect(feitos, 'a entrada no mapa parou no acessorio').toEqual([
			'presenca diaria',
			'plugins',
			'NOTIFY_ACTORINIT',
			'loja de cash',
		]);
		expect(erros, 'a falha tem de ser REGISTRADA, e nao engolida').toHaveLength(1);
		expect(erros[0]).toContain('modo leitura');
	});

	it('acessorio que NAO lanca segue normal', () => {
		const feitos = [];
		ligarAcessorioDaHud('escala da HUD', () => feitos.push('ligou'), () => {
			throw new Error('nao devia ter errado');
		});
		expect(feitos).toEqual(['ligou']);
	});
});

describe('o fonte do MapEngine', () => {
	it('os TRES acessorios passam pela guarda', () => {
		for (const nome of ['escala da HUD', 'HUD vertical', 'modo leitura']) {
			expect(FONTE, nome + ' fora da guarda').toContain(
				"ligarAcessorioDaHud('" + nome + "'"
			);
		}
	});

	/*
	 * O `.ligar()` NU e o que este arquivo existe para impedir. Se alguem somar
	 * um acessorio novo com a chamada direta, o caso reprova nomeando-o.
	 */
	it('nenhum acessorio da HUD e ligado DIRETO', () => {
		const nus = [];
		for (const alvo of ['EscalaDaHud', 'HudVertical', 'TelaAcesaNoFarm']) {
			if (FONTE.includes(alvo + '.ligar();')) nus.push(alvo);
		}
		expect(nus, 'acessorio ligado sem guarda').toEqual([]);
	});

	it('a guarda REGISTRA a falha — silencio aqui seria trocar um cego por outro', () => {
		const i = FONTE.indexOf('function ligarAcessorioDaHud');
		expect(i).toBeGreaterThan(0);
		const corpo = FONTE.slice(i, i + 400);
		expect(corpo).toContain('catch');
		expect(corpo).toContain('console.error');
	});
});
