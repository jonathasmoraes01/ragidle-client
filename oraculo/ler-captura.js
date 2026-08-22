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
 *   node oraculo/ler-captura.js servidor-m1 --refatiar   ignora o .jsonl e
 *                                                        refatia o .bin com a
 *                                                        tabela de HOJE
 *
 * `--refatiar` existe porque captura VELHA foi gravada com tabela velha: o
 * `.jsonl` guarda so o que o gravador conseguiu ler naquele dia, e o `.bin`
 * guarda o que passou no fio. Quando a cobertura sai abaixo de 100%, e por
 * `--refatiar` que se recupera a sessao — sem regravar nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Fatiador, carregarTabela } from './fatiador.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CAPTURAS = path.join(AQUI, 'capturas');

const argv = process.argv.slice(2);
const sessao = argv.find((a) => !a.startsWith('-'));
const tudo = argv.includes('--tudo');
const comHex = argv.includes('--hex');
const refatiar = argv.includes('--refatiar');
const TABELA = refatiar ? carregarTabela() : null;
const filtro = argv[argv.indexOf('--so') + 1];
const soFiltrado = argv.includes('--so') && filtro && !filtro.startsWith('-');

if (!fs.existsSync(CAPTURAS)) {
	console.error(`[oraculo] nao ha capturas em ${path.relative(process.cwd(), CAPTURAS)}`);
	process.exit(1);
}

if (!sessao) {
	console.log('sessoes gravadas:');
	for (const nome of fs.readdirSync(CAPTURAS)) {
		const pastaDela = path.join(CAPTURAS, nome);
		if (!fs.statSync(pastaDela).isDirectory()) continue;
		const jsonls = fs.readdirSync(pastaDela).filter((f) => f.endsWith('.jsonl'));
		if (jsonls.length === 0) continue;
		const indice = path.join(pastaDela, 'indice.json');
		const i = fs.existsSync(indice) ? JSON.parse(fs.readFileSync(indice, 'utf8')) : null;
		const noIndice = i?.conexoes?.length ?? 0;
		console.log(
			`  ${nome}  (${jsonls.length} conexoes, packetver ${i?.packetver ?? '?'})` +
				(noIndice && noIndice !== jsonls.length
					? `  [o indice.json so lista ${noIndice} — ele e reescrito a cada corrida]`
					: '')
		);
	}
	process.exit(0);
}

const pasta = path.join(CAPTURAS, sessao);
if (!fs.existsSync(pasta)) {
	console.error(`[oraculo] sessao "${sessao}" nao existe`);
	process.exit(1);
}

const arquivoDeIndice = path.join(pasta, 'indice.json');
const indice = fs.existsSync(arquivoDeIndice)
	? JSON.parse(fs.readFileSync(arquivoDeIndice, 'utf8'))
	: { packetver: '?', conexoes: [] };

/*
 * A PASTA E A FONTE, E NAO O `indice.json`.
 *
 * O gravador reescreve `indice.json` a cada corrida, so com as conexoes DAQUELA
 * corrida, e reaproveita a numeracao das etiquetas. Percorrer `indice.conexoes`
 * — como este leitor fazia — apagava toda sessao anterior da mesma pasta, SEM
 * um aviso: em `capturas/servidor-m1` eram **36 dos 125 `.jsonl` invisiveis**, e
 * neles estava a MAIORIA dos pacotes gravados.
 *
 * O `.jsonl` se descreve sozinho — a primeira linha e
 * `{"tipo":"conexao","n":..,"alvo":..,"servidor":..,"etiqueta":..}` —, entao o
 * indice nunca foi necessario para ler: ele so acrescenta `travou`, que a
 * varredura abaixo redescobre do proprio arquivo.
 */
const metaDoIndice = new Map((indice.conexoes ?? []).map((c) => [c.etiqueta, c]));
const conexoes = [];

for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith('.jsonl')).sort()) {
	const etiqueta = arquivo.slice(0, -'.jsonl'.length);
	const linhas = fs.readFileSync(path.join(pasta, arquivo), 'utf8').split('\n');
	const abertura = linhas.find((l) => l.trim() && JSON.parse(l).tipo === 'conexao');
	const cabecalho = abertura ? JSON.parse(abertura) : {};
	const doIndice = metaDoIndice.get(etiqueta);

	/*
	 * `travou` sai do PROPRIO arquivo, e nao do indice: a linha de pacote com
	 * `incompleto` e a marca que o gravador deixou no instante em que desistiu.
	 * Quem tem a marca e o arquivo; o indice pode nem existir.
	 */
	const travou = { c2s: false, s2c: false };
	for (const linha of linhas) {
		if (!linha.trim()) continue;
		const o = JSON.parse(linha);
		if (o.incompleto && o.dir) travou[o.dir] = o.incompleto;
	}

	conexoes.push({
		etiqueta,
		alvo: cabecalho.alvo ?? doIndice?.alvo ?? '?',
		servidor: cabecalho.servidor ?? doIndice?.servidor ?? null,
		pacotes: doIndice?.pacotes ?? { c2s: 0, s2c: 0 },
		bytes: doIndice?.bytes ?? { c2s: 0, s2c: 0 },
		travou,
		foraDoIndice: doIndice === undefined,
	});
}

const foraDoIndice = conexoes.filter((c) => c.foraDoIndice).length;
console.log(
	`sessao ${sessao} · packetver ${indice.packetver} · ${conexoes.length} conexao(oes)` +
		(foraDoIndice ? ` (${foraDoIndice} delas AUSENTES do indice.json — lidas da pasta)` : '') +
		'\n'
);

/** Todos os pacotes de todas as conexões, na ordem em que passaram no fio. */
const pacotes = [];
const bytes = new Map();

for (const conexao of conexoes) {
	const jsonl = path.join(pasta, `${conexao.etiqueta}.jsonl`);

	for (const dir of ['c2s', 's2c']) {
		const bin = path.join(pasta, `${conexao.etiqueta}.${dir}.bin`);
		if (fs.existsSync(bin)) {
			const cru = fs.readFileSync(bin);
			bytes.set(`${conexao.etiqueta}.${dir}`, cru);
			// O `.bin` e a verdade sobre quantos bytes passaram — o indice pode
			// nao ter a conexao, e e dele que sai a fracao FATIADA abaixo.
			conexao.bytes[dir] = cru.length;
		}
	}

	let contados = { c2s: 0, s2c: 0 };

	if (refatiar && conexao.servidor) {
		/*
		 * REFATIAR: o `.jsonl` e o que o gravador CONSEGUIU ler naquele dia; o
		 * `.bin` e o que passou no fio. Quando a tabela de opcode estava velha o
		 * primeiro trunca e o segundo nao — foi assim que 125 sessoes viraram
		 * "evidencia de ausencia" sem nunca terem sido lidas por inteiro.
		 *
		 * Refatiar le o `.bin` com a tabela de HOJE. E o mesmo `Fatiador` do
		 * gravador, importado e nao copiado: um segundo fatiador divergiria em
		 * silencio, e o sintoma seria de novo um pacote que "nao apareceu".
		 */
		for (const dir of ['c2s', 's2c']) {
			const cru = bytes.get(`${conexao.etiqueta}.${dir}`);
			if (!cru) continue;

			/*
			 * O `travou` DO DIA DA GRAVACAO E APAGADO ANTES DE REFATIAR (D-489).
			 *
			 * Ele foi lido do `.jsonl`, que e o que o gravador conseguiu ler NAQUELE
			 * dia; refatiar responde a mesma pergunta com a tabela de HOJE. O laco
			 * abaixo so LIGA a marca, nunca a desliga — entao a marca velha
			 * sobrevivia ao refatiamento e a saida se contradizia na mesma linha:
			 *
			 *   18-map … s2c 454p/90227B  [FATIAMENTO PAROU: s2c:sem-tamanho]
			 *
			 * 454 pacotes de 90.227 bytes E "o fatiamento parou". Medido em
			 * 22/08/2026: **19 conexoes** marcadas assim, e ZERO delas trava com a
			 * tabela de hoje. Pior do que um aviso ausente: um aviso que contradiz
			 * o numero ao lado dele ensina a ignorar os dois.
			 *
			 * Apagar antes e o unico jeito honesto — a marca tem de descrever a
			 * corrida que a produziu.
			 */
			conexao.travou[dir] = false;

			const fatiador = new Fatiador(TABELA, conexao.servidor, dir);
			let deslocamento = 0;
			for (const p of fatiador.receber(cru)) {
				pacotes.push({
					ms: 0,
					dir,
					opcode: '0x' + p.opcode.toString(16).padStart(4, '0'),
					nome: p.nome,
					tamanho: p.tamanho,
					deslocamento,
					...(p.incompleto ? { incompleto: p.incompleto } : {}),
					etiqueta: conexao.etiqueta,
					servidor: conexao.servidor,
					refatiado: true,
				});
				if (p.incompleto) conexao.travou[dir] = p.incompleto;
				else {
					contados[dir]++;
					deslocamento += p.tamanho;
				}
			}
		}
		conexao.pacotes = contados;
		continue;
	}

	for (const linha of fs.readFileSync(jsonl, 'utf8').split('\n')) {
		if (!linha.trim()) continue;
		const o = JSON.parse(linha);
		if (o.tipo) continue; // linhas de abertura/fim da conexão
		if (!o.incompleto && o.dir) contados[o.dir]++;
		pacotes.push({ ...o, etiqueta: conexao.etiqueta, servidor: conexao.servidor });
	}
	conexao.pacotes = contados;
}

pacotes.sort((a, b) => a.ms - b.ms);

// --- resumo ---------------------------------------------------------------

console.log('CONEXOES');
for (const c of conexoes) {
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

/*
 * A COBERTURA VEM ANTES DO CENSO, E ELA E A METADE QUE FALTAVA.
 *
 * Este bloco existe por causa de um erro caro: o censo abaixo foi lido como
 * prova de AUSENCIA — "zero `ZC_USESKILL_ACK2`, zero EFST em 125 sessoes"
 * (`docs/varredura-habilidades-21-08-2026-B.md`) — quando o que havia era um
 * fatiador que tinha PARADO. A tabela de opcode estava congelada e nao conhecia
 * a faixa RAGIDLE, entao o gravador desistia no primeiro pacote NOSSO: **87% dos
 * bytes servidor->cliente nunca viraram linha de `.jsonl`**.
 *
 * O aviso por conexao ja existia e nao bastou — ele fica ACIMA da lista, e quem
 * conta ocorrencia le a lista. Zero so significa "nao aconteceu" quando a
 * cobertura e 100%; abaixo disso significa "nao foi fatiado", que e outra coisa.
 */
const somar = (f) => conexoes.reduce((t, c) => t + f(c), 0);
const bytesTotais = somar((c) => (c.bytes.c2s ?? 0) + (c.bytes.s2c ?? 0));
const bytesFatiados = pacotes.reduce((t, p) => t + (p.incompleto ? 0 : (p.tamanho ?? 0)), 0);
const cobertura = bytesTotais > 0 ? (bytesFatiados / bytesTotais) * 100 : 100;
const travadas = conexoes.filter((c) => c.travou.c2s || c.travou.s2c).length;

console.log('\nCOBERTURA DO FATIAMENTO');
console.log(
	`  ${bytesFatiados} de ${bytesTotais} bytes (${cobertura.toFixed(1)}%) · ` +
		`${travadas} de ${conexoes.length} conexao(oes) com fatiamento PARADO`
);
if (cobertura < 99.9 || travadas > 0) {
	console.log('');
	console.log('  !! O CENSO ABAIXO ESTA INCOMPLETO — NAO O USE COMO PROVA DE AUSENCIA. !!');
	console.log('  Contagem ZERO aqui nao quer dizer "nao aconteceu": quer dizer "nao foi');
	console.log('  fatiado". Regenere a tabela antes de concluir qualquer coisa:');
	console.log('      node oraculo/gerar-tabela-de-opcodes.mjs');
	console.log('  e refaca a captura. O `.bin` guarda os bytes crus e continua completo.');
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
for (const conexao of conexoes) {
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
