/**
 * O GRAVADOR NAO PODE TRUNCAR A CAPTURA ANTERIOR (27/08/2026, auditoria).
 *
 * `npm run dev -- --gravar` grava em `dev-<YYYY-MM-DD>` — uma pasta por DIA. O
 * contador de conexoes reiniciava em 0 a cada processo, a etiqueta sai dele, e
 * `fs.createWriteStream` abre com flag 'w': a corrida da tarde TRUNCAVA
 * `01-login.c2s.bin`, `01-login.s2c.bin` e `01-login.jsonl` da manha.
 *
 * O resultado nao era uma pasta vazia — era uma pasta FRANKENSTEIN. As
 * etiquetas que a segunda corrida alcancava apagavam as da primeira; as que ela
 * nao alcancava sobreviviam, e o conjunto parecia uma sessao coerente.
 *
 * Medido no corpus antes do conserto: 113 inversoes de `ms` em
 * `capturas/sem-nome/` (2.345 conexoes) e 22 em `capturas/servidor-m1/` (125).
 *
 * ESTE TESTE SOBE O GRAVADOR DE VERDADE, DUAS VEZES. E integracao de proposito:
 * o defeito estava na interacao entre o contador do processo e a flag do
 * `createWriteStream`, e nenhum dos dois isolado o mostra.
 *
 * O criterio forte e o CONTEUDO, e nao o nome do arquivo: truncar preserva o
 * nome. A primeira escrita deste teste so conferia a lista de arquivos e
 * passava no codigo QUEBRADO — o proprio defeito que ele investiga, na forma
 * de criterio.
 */
import { describe, expect, it } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PASTA = path.join(RAIZ, 'oraculo', 'capturas', 'prova-numeracao');

// Abaixo de 49152: acima dele o Windows RESERVA faixas dinamicas (Hyper-V), e
// o sintoma e `EACCES` sem processo dono — intermitente, e parece regressao.
const PORTA_DO_ALVO = 45881;
const PORTA_DA_PONTE = 45882;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function umaCorrida() {
	const p = spawn(
		process.execPath,
		['oraculo/gravador-de-pacotes.js', '-p', String(PORTA_DA_PONTE), '-s', 'prova-numeracao'],
		{ cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
	);
	await new Promise((r) => {
		p.stdout.on('data', (d) => {
			if (String(d).includes('escutando')) r();
		});
	});
	const ws = new WebSocket(`ws://127.0.0.1:${PORTA_DA_PONTE}/127.0.0.1:${PORTA_DO_ALVO}`);
	await new Promise((r) => ws.on('open', r));
	ws.send(Buffer.from([0x9b, 0x0, ...Array(24).fill(0)]));
	await dormir(400);
	ws.close();
	await dormir(200);
	p.kill('SIGINT'); // SIGINT: e ele que faz o gravador fechar o indice
	await new Promise((r) => p.on('exit', r));
	return fs
		.readdirSync(PASTA)
		.filter((f) => f.endsWith('.jsonl'))
		.sort();
}

describe('o gravador do oraculo', () => {
	it('a segunda corrida do dia NAO apaga a primeira', async () => {
		fs.rmSync(PASTA, { recursive: true, force: true });
		const alvo = net.createServer((s) => s.write(Buffer.from([1, 2, 3, 4])));
		await new Promise((r) => alvo.listen(PORTA_DO_ALVO, '127.0.0.1', r));
		try {
			const primeira = await umaCorrida();
			expect(primeira.length, 'a primeira corrida nao gravou nada').toBeGreaterThan(0);

			// O conteudo da primeira, ANTES de a segunda subir. Truncar preserva o
			// nome do arquivo, entao so o conteudo distingue.
			const antes = primeira.map((f) => fs.readFileSync(path.join(PASTA, f), 'utf8'));
			expect(antes.every((t) => t.length > 0)).toBe(true);

			const segunda = await umaCorrida();

			const depois = primeira.map((f) => fs.readFileSync(path.join(PASTA, f), 'utf8'));
			expect(depois, 'a segunda corrida TRUNCOU os arquivos da primeira').toEqual(antes);

			const novas = segunda.filter((f) => !primeira.includes(f));
			expect(novas.length, 'a segunda corrida reusou as etiquetas da primeira').toBeGreaterThan(0);

			const indice = JSON.parse(fs.readFileSync(path.join(PASTA, 'indice.json'), 'utf8'));
			expect(indice.conexoes.length, 'o indice esqueceu a corrida anterior').toBe(
				primeira.length + novas.length
			);
			expect(
				new Set(indice.conexoes.map((c) => c.corridaEm)).size,
				'sem carimbo distinto o leitor funde as duas linhas do tempo'
			).toBe(2);
		} finally {
			alvo.close();
			fs.rmSync(PASTA, { recursive: true, force: true });
		}
	}, 30_000);
});
