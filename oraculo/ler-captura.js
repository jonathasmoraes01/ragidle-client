/**
 * Lê uma captura do oráculo e imprime legível.
 *
 * A captura é dois arquivos por conexão: o `.bin` com os bytes crus (a verdade) e
 * o `.jsonl` com um objeto por pacote (a conveniência). Este leitor cruza os dois
 * e imprime nome, opcode, tamanho, instante e — com `--hex` — o conteúdo.
 *
 * É a ferramenta que responde "como é o pacote X no original?" nos prompts
 * M1–M4. A resposta vem daqui e do fonte do rAthena com `arquivo:linha`, nunca
 * de chute — é a regra 1 do projeto aplicada ao fio.
 *
 * Uso:
 *   node oraculo/ler-captura.js                      lista as sessões
 *   node oraculo/ler-captura.js baseline-m0          resumo da sessão
 *   node oraculo/ler-captura.js baseline-m0 --tudo   todos os pacotes, em ordem
 *   node oraculo/ler-captura.js baseline-m0 --hex    idem, com os bytes
 *   node oraculo/ler-captura.js baseline-m0 --so ZC_ACCEPT_ENTER2 --hex
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CAPTURAS = path.join(AQUI, 'capturas');

const argv = process.argv.slice(2);
const sessao = argv.find((a) => !a.startsWith('-'));
const tudo = argv.includes('--tudo');
const comHex = argv.includes('--hex');
const filtro = argv[argv.indexOf('--so') + 1];
const soFiltrado = argv.includes('--so') && filtro && !filtro.startsWith('-');

if (!fs.existsSync(CAPTURAS)) {
	console.error(`[oraculo] nao ha capturas em ${path.relative(process.cwd(), CAPTURAS)}`);
	process.exit(1);
}

if (!sessao) {
	console.log('sessoes gravadas:');
	for (const nome of fs.readdirSync(CAPTURAS)) {
		const indice = path.join(CAPTURAS, nome, 'indice.json');
		if (!fs.existsSync(indice)) continue;
		const i = JSON.parse(fs.readFileSync(indice, 'utf8'));
		console.log(`  ${nome}  (${i.conexoes.length} conexoes, packetver ${i.packetver})`);
	}
	process.exit(0);
}

const pasta = path.join(CAPTURAS, sessao);
if (!fs.existsSync(pasta)) {
	console.error(`[oraculo] sessao "${sessao}" nao existe`);
	process.exit(1);
}

const indice = JSON.parse(fs.readFileSync(path.join(pasta, 'indice.json'), 'utf8'));

console.log(`sessao ${sessao} · packetver ${indice.packetver} · ${indice.conexoes.length} conexao(oes)\n`);

/** Todos os pacotes de todas as conexões, na ordem em que passaram no fio. */
const pacotes = [];
const bytes = new Map();

for (const conexao of indice.conexoes) {
	const jsonl = path.join(pasta, `${conexao.etiqueta}.jsonl`);
	if (!fs.existsSync(jsonl)) continue;

	for (const dir of ['c2s', 's2c']) {
		const bin = path.join(pasta, `${conexao.etiqueta}.${dir}.bin`);
		if (fs.existsSync(bin)) bytes.set(`${conexao.etiqueta}.${dir}`, fs.readFileSync(bin));
	}

	for (const linha of fs.readFileSync(jsonl, 'utf8').split('\n')) {
		if (!linha.trim()) continue;
		const o = JSON.parse(linha);
		if (o.tipo) continue; // linhas de abertura/fim da conexão
		pacotes.push({ ...o, etiqueta: conexao.etiqueta, servidor: conexao.servidor });
	}
}

pacotes.sort((a, b) => a.ms - b.ms);

// --- resumo ---------------------------------------------------------------

console.log('CONEXOES');
for (const c of indice.conexoes) {
	const travou = Object.entries(c.travou ?? {})
		.filter(([, v]) => v)
		.map(([d, v]) => `${d}:${v}`)
		.join(' ');
	console.log(
		`  ${c.etiqueta.padEnd(10)} ${String(c.alvo).padEnd(16)} ` +
			`c2s ${String(c.pacotes.c2s).padStart(4)}p/${String(c.bytes.c2s).padStart(6)}B · ` +
			`s2c ${String(c.pacotes.s2c).padStart(4)}p/${String(c.bytes.s2c).padStart(6)}B` +
			(travou ? `  [FATIAMENTO PAROU: ${travou}]` : '')
	);
}

console.log('\nPACOTES POR NOME');
const porNome = new Map();
for (const p of pacotes) {
	const chave = `${p.dir} ${p.nome ?? '(sem nome) ' + p.opcode}`;
	porNome.set(chave, (porNome.get(chave) ?? 0) + 1);
}
for (const [nome, n] of [...porNome.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}x  ${nome}`);
}

const semNome = pacotes.filter((p) => !p.nome);
if (semNome.length) {
	console.log(`\n${semNome.length} pacote(s) sem nome na tabela — opcodes: ` + [...new Set(semNome.map((p) => p.opcode))].join(' '));
}

/*
 * ONDE O FATIAMENTO PAROU, E QUEM É O SUSPEITO.
 *
 * Um opcode desconhecido no meio do fluxo quase nunca é um pacote novo: é o
 * fatiador já fora de compasso, lendo o miolo do pacote anterior como se fosse
 * cabeçalho. E ele sai de compasso quando usa um TAMANHO ERRADO.
 *
 * Os tamanhos de reserva (fonte `rathena`) são os candidatos naturais, porque o
 * `clif_packetdb.hpp` é lido sem passar pelo pré-processador e pode entregar o
 * número de outra faixa de PACKETVER. Caso real medido em 17/08/2026:
 * `ZC_SPRITE_CHANGE2` (0x01d7) está lá como 11 bytes, que é o tamanho de antes
 * de 2018; para RE >= 20180704 a struct é `int16 + uint32 + uint8 + uint32 +
 * uint32` = 15 bytes (`rathena/src/map/packets_struct.hpp:2591-2603`). Os 4
 * bytes de diferença jogaram o fatiador para dentro de uma mensagem de texto.
 *
 * Por isso o leitor aponta o dedo em vez de deixar o mistério.
 */
for (const conexao of indice.conexoes) {
	const parou = Object.entries(conexao.travou ?? {}).filter(([, v]) => v);
	if (!parou.length) continue;

	for (const [dir] of parou) {
		const daConexao = pacotes.filter((p) => p.etiqueta === conexao.etiqueta && p.dir === dir && p.nome);
		const ultimoDeReserva = [...daConexao].reverse().find((p) => p.fonteDoTamanho);
		const ultimo = daConexao[daConexao.length - 1];

		console.log(`\n${conexao.etiqueta} ${dir}: fatiamento parou depois de ${daConexao.length} pacote(s).`);
		if (ultimo) console.log(`  ultimo lido:  ${ultimo.nome} (${ultimo.tamanho}B)`);
		if (ultimoDeReserva) {
			console.log(
				`  SUSPEITO:     ${ultimoDeReserva.nome} — tamanho ${ultimoDeReserva.tamanho}B veio da ` +
					`fonte de reserva "${ultimoDeReserva.fonteDoTamanho}", que nao conhece o PACKETVER em vigor.`
			);
		}
	}
}

const divergentes = pacotes.filter((p) => p.tamanhoNaTabela);
if (divergentes.length) {
	console.log(`\n${divergentes.length} pacote(s) com tamanho DIFERENTE do declarado na tabela do cliente:`);
	for (const p of divergentes.slice(0, 10)) {
		console.log(`  ${p.nome ?? p.opcode}: fio ${p.tamanho}B, tabela ${p.tamanhoNaTabela}B`);
	}
}

// --- listagem -------------------------------------------------------------

if (tudo || soFiltrado) {
	console.log('\nSEQUENCIA');
	const t0 = pacotes.length ? pacotes[0].ms : 0;

	for (const p of pacotes) {
		if (soFiltrado && !(p.nome ?? '').includes(filtro)) continue;

		const seta = p.dir === 'c2s' ? '-->' : '<--';
		console.log(
			`  +${String(p.ms - t0).padStart(7)}ms ${p.etiqueta.padEnd(10)} ${seta} ` +
				`${p.opcode ?? '??????'} ${(p.nome ?? '(sem nome)').padEnd(34)} ${String(p.tamanho ?? '?').padStart(5)}B` +
				(p.incompleto ? `  [${p.incompleto}]` : '')
		);

		if (comHex && p.tamanho) {
			const buf = bytes.get(`${p.etiqueta}.${p.dir}`);
			if (buf) {
				const fatia = buf.subarray(p.deslocamento, p.deslocamento + p.tamanho);
				for (let i = 0; i < fatia.length; i += 16) {
					const linha = fatia.subarray(i, i + 16);
					const hex = linha.toString('hex').replace(/(..)/g, '$1 ').padEnd(48);
					const texto = [...linha].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
					console.log(`            ${String(i).padStart(4)}  ${hex} ${texto}`);
				}
			}
		}
	}
}

console.log(`\n${pacotes.length} pacotes na sessao.`);
if (!tudo && !soFiltrado) console.log('use --tudo para a sequencia, --hex para os bytes, --so <NOME> para filtrar.');
