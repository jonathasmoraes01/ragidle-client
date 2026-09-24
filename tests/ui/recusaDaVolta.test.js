/**
 * A VOLTA RECUSADA CHEGA A RECONEXAO (16/09/2026, D-1520 do servidor).
 *
 * O servidor manda `SC_NOTIFY_BAN` (0x81) codigo 0 quando recusa a entrada no
 * mapa — o `pc_authfail` do rAthena. O tratador do 0x81 e o do `LoginEngine`
 * (o gancho e um so por pacote), e ele tem de perguntar a reconexao ANTES de
 * mostrar a caixa de "desconectado": em ciclo, quem decide e ela.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const login = readFileSync(join(process.cwd(), 'src/Engine/LoginEngine.js'), 'utf8');

describe('a recusa da volta', () => {
	it('o tratador do SC_NOTIFY_BAN consulta a reconexao primeiro', () => {
		const inicio = login.indexOf('function onServerClosed(pkt) {');
		expect(inicio).toBeGreaterThan(0);
		const corpo = login.slice(inicio, login.indexOf('switch (pkt.ErrorCode)', inicio));
		expect(corpo).toContain('if (pkt.ErrorCode === 0 && Reconexao.aoSerRecusado()) {');
		expect(corpo.indexOf('Reconexao.aoSerRecusado()')).toBeLessThan(corpo.indexOf('let msg_id;'));
	});

	it('o gancho do 0x81 continua sendo o onServerClosed', () => {
		expect(login).toContain('Network.hookPacket(PACKET.SC.NOTIFY_BAN, onServerClosed);');
		expect(login).toContain("import Reconexao from 'Network/reconexao.js';");
	});

	it('o limite por IP (106) para a reconexao ANTES da caixa, e tem frase propria', () => {
		const inicio = login.indexOf('function onServerClosed(pkt) {');
		const corpo = login.slice(inicio, login.indexOf('switch (pkt.ErrorCode)', inicio));
		const ramo = corpo.slice(corpo.indexOf('if (pkt.ErrorCode === CODIGO_DE_LIMITE_POR_IP) {'));
		expect(ramo.length).toBeGreaterThan(0);
		expect(ramo.indexOf('Reconexao.cancelarParaFechamentoDeliberado();')).toBeGreaterThan(0);
		expect(ramo.indexOf('Reconexao.cancelarParaFechamentoDeliberado();')).toBeLessThan(ramo.indexOf('UIManager.showMessageBox('));
		expect(ramo).toContain('TEXTO_DO_LIMITE_POR_IP');
		expect(ramo).toContain('Network.close();');
		// O mesmo numero do servidor (`servidor/mapa/limite-por-ip.ts`).
		expect(login).toContain('export const CODIGO_DE_LIMITE_POR_IP = 106;');
	});
});
