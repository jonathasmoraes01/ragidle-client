/**
 * O VIP E AS FLECHAS INFINITAS COM OS DIAS DE VERDADE NA BARRA (17/10/2026).
 *
 * O `RemainMS` do 0x0983 e u32 em ms e o servidor o apara em ~49 dias 17 h;
 * desde esta data ele manda tambem o que falta EM SEGUNDOS no `val[0]` dos
 * EFSTs 1902 e 1903 (`servidor/mapa/icone-dos-passes.ts`). Aqui:
 *  1. o pacote de 29 bytes, montado com a disposicao do servidor, e lido pelo
 *     `MSG_STATE_CHANGE4` com o `val[0]` no lugar;
 *  2. `restanteDoPacote` usa o `val[0]` so nesses dois EFSTs, e so quando ele
 *     vem maior que zero (servidor antigo: o `RemainMS` de sempre);
 *  3. o relogio da celula e a dica de um VIP de 90 dias leem "89d9h" e
 *     "89 dias 9 horas", e 400 dias nao estouram nenhuma conta;
 *  4. a costura: `onEntityStatusChange` entrega a `StatusIcons.update` o que
 *     `restanteDoPacote` decide, e nao o `RemainMS` cru.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import PACKET from 'Network/PacketStructure.js';
import BinaryReader from 'Utils/BinaryReader.js';
import { EFSTS_COM_SEGUNDOS_NO_VAL, restanteDoPacote } from '../../src/UI/Components/StatusIcons/restanteDosPasses.js';
import { formatarRelogioDoBuff, tempoDaDica } from '../../src/UI/Components/StatusIcons/statusTiming.js';

const VIP = 1902;
const FLECHAS = 1903;
const TETO_U32 = 0xffffffff;
const DIA_S = 86400;

/** O 0x0983 como o servidor escreve (`ZC_MSG_STATE_CHANGE3`, servidor/protocolo/pacotes-mapa.ts). */
function pacote(efst, restanteMs, val1, val2 = 0, val3 = 0) {
	const buf = new ArrayBuffer(29);
	const v = new DataView(buf);
	v.setUint16(0, 0x0983, true);
	v.setUint16(2, efst, true);
	v.setUint32(4, 2000001, true);
	v.setUint8(8, 1);
	v.setUint32(9, restanteMs, true);
	v.setUint32(13, restanteMs, true);
	v.setInt32(17, val1, true);
	v.setInt32(21, val2, true);
	v.setInt32(25, val3, true);
	const fp = new BinaryReader(buf);
	fp.seek(2);
	const pkt = new PACKET.ZC.MSG_STATE_CHANGE4(fp, buf.byteLength);
	expect(fp.tell(), 'sobrou ou faltou byte: a disposicao divergiu').toBe(buf.byteLength);
	return pkt;
}

describe('o VIP e as Flechas Infinitas com os dias de verdade', () => {
	it('o 0x0983 do servidor chega com o RemainMS aparado e os segundos no val[0]', () => {
		const segundos = 89 * DIA_S + 9 * 3600;
		const pkt = pacote(VIP, TETO_U32, segundos);
		expect(pkt.index).toBe(VIP);
		expect(pkt.state).toBe(1);
		expect(pkt.RemainMS).toBe(TETO_U32);
		expect(pkt.val).toEqual([segundos, 0, 0]);
	});

	it('so o VIP e as Flechas Infinitas leem o val[0], e so quando ele vem maior que zero', () => {
		expect([...EFSTS_COM_SEGUNDOS_NO_VAL].sort()).toEqual([VIP, FLECHAS]);
		const noventa = 90 * DIA_S;
		expect(restanteDoPacote(pacote(VIP, TETO_U32, noventa))).toBe(noventa * 1000);
		expect(restanteDoPacote(pacote(FLECHAS, TETO_U32, noventa))).toBe(noventa * 1000);
		// Servidor antigo: o val vem zerado, e vale o RemainMS de sempre.
		expect(restanteDoPacote(pacote(VIP, 3_600_000, 0))).toBe(3_600_000);
		expect(restanteDoPacote(pacote(VIP, TETO_U32, 0))).toBe(TETO_U32);
		// Outro EFST: o val[0] tem outro sentido, e nao e tocado.
		expect(restanteDoPacote(pacote(1901, 60_000, 5))).toBe(60_000);
		// O 0x0196 nao tem val nem RemainMS.
		expect(restanteDoPacote({ index: VIP, state: 0 })).toBeUndefined();
		// Negativo nao conta.
		expect(restanteDoPacote(pacote(VIP, 1000, -5))).toBe(1000);
	});

	it('o VIP de 90 dias le "89d9h" na celula e "89 dias 9 horas" na dica, e nao 49 dias', () => {
		const segundos = 89 * DIA_S + 9 * 3600 + 30;
		const ms = restanteDoPacote(pacote(VIP, TETO_U32, segundos));
		expect(formatarRelogioDoBuff(ms)).toBe('89d9h');
		expect(tempoDaDica(ms)).toBe('89 dias 9 horas');
		// O que o cliente antigo mostra com o mesmo pacote (o que o relato viu).
		expect(tempoDaDica(TETO_U32)).toBe('49 dias 17 horas');
	});

	it('400 dias nao estouram nenhuma conta de 32 bits', () => {
		const ms = restanteDoPacote(pacote(FLECHAS, TETO_U32, 400 * DIA_S));
		expect(ms).toBe(400 * DIA_S * 1000);
		expect(formatarRelogioDoBuff(ms)).toBe('400d');
		expect(tempoDaDica(ms)).toBe('400 dias');
	});

	it('a costura: o icone recebe o que restanteDoPacote decide', () => {
		const fonte = readFileSync(join(__dirname, '..', '..', 'src/Engine/MapEngine/Entity.js'), 'utf8');
		expect(fonte).toContain('StatusIcons.update(pkt.index, pkt.state, restanteDoPacote(pkt));');
		expect(fonte).not.toContain('StatusIcons.update(pkt.index, pkt.state, pkt.RemainMS);');
	});
});
