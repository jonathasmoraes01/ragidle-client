/**
 * A MANUTENCAO NAO PARECE BANIMENTO (relato de 23/09/2026: um jogador que
 * acabava de criar a conta leu "Seu acesso esta bloqueado... lista de
 * punidos" e achou que tinha sido banido). O servidor recusa o login da
 * manutencao com o motivo 6 (D-1590), e a frase do RO para o 6 e a 449.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const login = readFileSync(join(process.cwd(), 'src/Engine/LoginEngine.js'), 'utf8');

describe('a mensagem da manutencao', () => {
	it('o motivo 6 do AC_REFUSE_LOGIN mostra a frase da manutencao, e nao a 449', () => {
		const inicio = login.indexOf('function onConnectionRefused(pkt) {');
		const fim = login.indexOf('\n}\n', inicio);
		const corpo = login.slice(inicio, fim);
		expect(corpo).toContain('pkt.ErrorCode === 6 ? TEXTO_DA_MANUTENCAO');
	});

	it('a frase fala de manutencao e diz que a conta esta normal - sem "bloqueado" nem "punidos"', () => {
		const m = login.match(/export const TEXTO_DA_MANUTENCAO =\s*'([^']+)'/);
		expect(m).not.toBeNull();
		const texto = m[1];
		expect(texto).toContain('manutenção');
		expect(texto).toContain('Sua conta está normal');
		expect(texto).not.toMatch(/bloquead|punid|banid/i);
	});
});
