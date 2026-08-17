/**
 * Re-fatia uma captura já gravada, com a tabela de opcodes ATUAL.
 *
 * Existe porque o `.bin` é a verdade e o `.jsonl` é conveniência derivada: se a
 * tabela melhora, a captura antiga passa a render mais sem precisar re-gravar
 * nada. Foi assim que o `ZC_NOTIFY_STANDENTRY11` apareceu — ele sempre esteve
 * nos bytes do M0; o que faltava era o tamanho certo do pacote anterior.
 *
 * NÃO reescreve o `.jsonl` — só imprime. A captura gravada continua sendo o
 * registro do que a tabela sabia NAQUELE dia.
 *
 * Uso:  node oraculo/refatiar.mjs <sessao> [etiqueta]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TABELA = JSON.parse(fs.readFileSync(path.join(AQUI, 'opcodes.json'), 'utf8'));

const sessao = process.argv[2];
const filtro = process.argv[3];
if (!sessao) {
	console.error('uso: node oraculo/refatiar.mjs <sessao> [etiqueta]');
	process.exit(1);
}

const pasta = path.join(AQUI, 'capturas', sessao);
const indice = JSON.parse(fs.readFileSync(path.join(pasta, 'indice.json'), 'utf8'));

for (const conexao of indice.conexoes) {
	if (filtro && !conexao.etiqueta.includes(filtro)) continue;

	const servidor = conexao.servidor ?? 'map';
	for (const dir of ['s2c', 'c2s']) {
		const arquivo = path.join(pasta, `${conexao.etiqueta}.${dir}.bin`);
		if (!fs.existsSync(arquivo)) continue;

		const b = fs.readFileSync(arquivo);
		if (b.length === 0) continue;

		const tabela = TABELA.tabelas[servidor][dir === 's2c' ? 'entrada' : 'saida'];
		console.log(`\n### ${conexao.etiqueta} ${dir} — ${b.length} bytes`);

		// O char-server responde 4 bytes crus (o account id) antes do 1o pacote.
		let o = servidor === 'char' && dir === 's2c' ? 4 : 0;
		if (o) console.log(`  (${o} bytes crus de account id, fora do enquadramento)`);

		let n = 0;
		while (o + 2 <= b.length) {
			const op = b.readUInt16LE(o);
			const k = '0x' + op.toString(16).padStart(4, '0');
			const info = tabela[k];

			if (!info) {
				console.log(`  PAROU em ${o}: ${k} AUSENTE da tabela`);
				break;
			}
			if (info.tamanho === null || info.tamanho === 0) {
				console.log(`  PAROU em ${o}: ${k} ${info.nome} sem tamanho`);
				break;
			}

			let sz = info.tamanho;
			if (sz === -1) {
				if (o + 4 > b.length) break;
				sz = b.readUInt16LE(o + 2);
				if (sz < 4) {
					console.log(`  PAROU em ${o}: ${k} ${info.nome} declarou ${sz}`);
					break;
				}
			}
			if (o + sz > b.length) break;

			const marca = info.fonteDoTamanho ? ` [${info.fonteDoTamanho}]` : '';
			console.log(`  ${String(o).padStart(5)}  ${k} ${info.nome.padEnd(34)} ${String(sz).padStart(5)}B${marca}`);
			o += sz;
			n++;
		}
		console.log(`  --> ${n} pacotes, ${o} de ${b.length} bytes`);
	}
}
