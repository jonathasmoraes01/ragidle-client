/**
 * O LOTE DO CORREIO FALA UMA VEZ (16/09/2026) — relato do dono: 7 cartas
 * apagadas ou coletadas de uma vez davam 7 linhas no chat.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	abrirLoteDoCorreio,
	fecharLoteDoCorreio,
	loteDoCorreioEmVoo
} from 'Engine/MapEngine/loteDoCorreio.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');

describe('o lote em voo', () => {
	it('abre, fecha, e vence sozinho pelo prazo', () => {
		abrirLoteDoCorreio(1000, 500);
		expect(loteDoCorreioEmVoo(1499)).toBe(true);
		expect(loteDoCorreioEmVoo(1500)).toBe(false);
		abrirLoteDoCorreio(1000, 500);
		fecharLoteDoCorreio();
		expect(loteDoCorreioEmVoo(1001)).toBe(false);
	});
});

describe('a costura', () => {
	const rodex = ler('src/Engine/MapEngine/Rodex.js');
	const correio = ler('src/UI/Components/CorreioIdle/CorreioIdle.js');

	it('as tres confirmacoes de SUCESSO calam em lote; as de falha continuam falando', () => {
		expect(rodex.match(/if \(!loteDoCorreioEmVoo\(\)\) \{/g) ?? []).toHaveLength(3);
		// A falha (1039, 2589, 2592) segue sem guarda.
		expect(rodex).toContain('ChatBox.addText(DB.getMessage(1039), ChatBox.TYPE.MAIL, ChatBox.FILTER.PUBLIC_LOG);');
	});

	it('os dois lotes abrem o silencio antes de mandar, e o relatorio fecha e resume uma vez', () => {
		const coletar = correio.indexOf("pkt.json = JSON.stringify({ acao: 'coletar-todos' });");
		expect(correio.lastIndexOf('abrirLoteDoCorreio();', coletar)).toBeGreaterThan(0);
		const apagar = correio.indexOf("pkt.json = JSON.stringify({ acao: 'apagar-todas' });");
		expect(correio.lastIndexOf('abrirLoteDoCorreio();', apagar)).toBeGreaterThan(coletar);
		expect(correio.match(/fecharLoteDoCorreio\(\);/g) ?? []).toHaveLength(2);
		expect(correio.match(/ChatBox\.addText\(fraseD/g) ?? []).toHaveLength(2);
	});
});
