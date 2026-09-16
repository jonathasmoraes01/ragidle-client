/**
 * O BOTAO "COLETAR TODOS" SO ACENDE COM ANEXO (16/09/2026, D-1525) — o tipo da
 * carta chega na lista (0x2 zeny, 0x4 item, 0x8 NPC), como no rAthena.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semOBit, temAnexoParaColetar, TIPO_ITEM, TIPO_ZENY } from 'UI/Components/CorreioIdle/anexosDaCaixa.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');

describe('temAnexoParaColetar', () => {
	it('so texto (0x8) ou lista vazia: nada a coletar', () => {
		expect(temAnexoParaColetar([])).toBe(false);
		expect(temAnexoParaColetar([{ type: 0x8 }, { type: 0 }])).toBe(false);
		expect(temAnexoParaColetar(null)).toBe(false);
	});

	it('zeny ou item por retirar acendem', () => {
		expect(temAnexoParaColetar([{ type: 0x8 }, { type: 0x8 | TIPO_ITEM }])).toBe(true);
		expect(temAnexoParaColetar([{ type: 0x8 | TIPO_ZENY }])).toBe(true);
	});

	it('a retirada avulsa apaga so o bit dela', () => {
		expect(semOBit(0xe, TIPO_ITEM)).toBe(0xa);
		expect(semOBit(0xa, TIPO_ZENY)).toBe(0x8);
	});
});

describe('a costura', () => {
	const correio = ler('src/UI/Components/CorreioIdle/CorreioIdle.js');
	const rodex = ler('src/Engine/MapEngine/Rodex.js');

	it('o botao fica indisponivel sem anexo, e ressincroniza a cada tique', () => {
		expect(correio).toContain('const indisponivel = _coletaDeLoteEmVoo || !temAnexoParaColetar(cartas());');
		const tudo = correio.slice(correio.indexOf('function sincronizarTudo()'));
		expect(tudo.slice(0, tudo.indexOf('}'))).toContain('sincronizarBotaoDaColeta();');
	});

	it('as confirmacoes de retirada apagam o bit na lista local', () => {
		expect(rodex).toContain('apagarBitDaCarta(pkt.MailID, TIPO_ZENY);');
		expect(rodex).toContain('apagarBitDaCarta(pkt.MailID, TIPO_ITEM);');
	});
});
