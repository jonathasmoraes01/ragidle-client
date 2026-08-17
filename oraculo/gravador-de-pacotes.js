/**
 * O ORÁCULO — ponte WebSocket→TCP que GRAVA tudo o que atravessa.
 *
 * Derivado do `wsproxy.js` da raiz deste repositório (roBrowser Legacy, GPL-3.0):
 * mesma linha de comando, mesmo comportamento de proxy, mesma porta padrão
 * 5999. A diferença é que aqui cada byte é gravado em disco, nos dois sentidos.
 *
 * Por que um arquivo novo em vez de instrumentar o `wsproxy.js`: aquele arquivo
 * é do upstream e vai receber correções que queremos puxar. Todo diff nosso
 * dentro dele é pedágio para sempre. Este mora em `oraculo/`, é nosso, e o
 * upstream nem sabe que existe.
 *
 * O que sai de cada sessão de gravação, em `oraculo/capturas/<sessao>/`:
 *
 *   NN-<alvo>.c2s.bin   fluxo CRU cliente→servidor, byte a byte
 *   NN-<alvo>.s2c.bin   fluxo CRU servidor→cliente, byte a byte
 *   NN-<alvo>.jsonl     um objeto por PACOTE fatiado: { ms, dir, opcode, nome,
 *                       tamanho, deslocamento }
 *   indice.json         resumo da sessão: conexões, contagens, e o que não deu
 *                       para fatiar
 *
 * Os `.bin` são a verdade: mesmo que o fatiamento falhe, os bytes ficam e a
 * captura continua comparável byte a byte. O `.jsonl` é conveniência derivada.
 *
 * O fatiamento usa `oraculo/opcodes.json`, gerado das tabelas do próprio cliente
 * por `oraculo/gerar-tabela-de-opcodes.mjs`. Opcode cujo tamanho a tabela não
 * conhece NÃO é adivinhado: o gravador registra `desconhecido` e para de fatiar
 * aquele sentido, porque sem o tamanho não há como achar a fronteira seguinte.
 * O `.bin` continua completo.
 *
 * Uso:
 *   node oraculo/gravador-de-pacotes.js --sessao baseline-m0
 *   node oraculo/gravador-de-pacotes.js --porta 5999 --saida oraculo/capturas
 */

import { WebSocketServer } from 'ws';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// --- linha de comando (mesmo parser do wsproxy.js) ------------------------

const args = {};
for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i];
	if (arg.startsWith('-')) {
		const key = arg.replace(/^-+/, '');
		const val = process.argv[i + 1];
		if (val && !val.startsWith('-')) {
			args[key] = val;
			i++;
		} else {
			args[key] = true;
		}
	}
}

const porta = parseInt(args.p || args.porta || args.port || process.env.PORT || '5999', 10);
const sessao = String(args.sessao || args.s || 'sem-nome');
const raizDeSaida = path.resolve(AQUI, '..', String(args.saida || 'oraculo/capturas'));
const pastaDaSessao = path.join(raizDeSaida, sessao);

const redirectStr = args.r || args.redirect || '';
const redirects = {};
if (redirectStr) {
	String(redirectStr)
		.split(',')
		.forEach(par => {
			const [de, para] = par.split('=');
			if (de && para) redirects[de.trim()] = para.trim();
		});
}

// --- tabela de opcodes ----------------------------------------------------

const caminhoDaTabela = path.join(AQUI, 'opcodes.json');
if (!fs.existsSync(caminhoDaTabela)) {
	console.error(
		`[oraculo] falta ${path.relative(process.cwd(), caminhoDaTabela)}.\n` +
			'          rode: node oraculo/gerar-tabela-de-opcodes.mjs'
	);
	process.exit(1);
}
const TABELA = JSON.parse(fs.readFileSync(caminhoDaTabela, 'utf8'));

/**
 * Qual servidor está do outro lado. Não é enfeite de nome de arquivo: o opcode
 * só identifica o pacote DENTRO de um servidor (`0x0064` é `CA_LOGIN` no login e
 * `CZ_REQ_OPEN_WRITE_MAIL` no map), então é isto que escolhe a tabela.
 */
function nomeDoAlvo(porta) {
	if (porta === 6900) return 'login';
	if (porta === 6121) return 'char';
	if (porta === 5121) return 'map';
	return null;
}

function descreverOpcode(servidor, dir, opcode) {
	const tabela = TABELA.tabelas[servidor];
	if (!tabela) return null;
	const sentido = dir === 'c2s' ? 'saida' : 'entrada';
	return tabela[sentido]['0x' + opcode.toString(16).padStart(4, '0')] || null;
}

// --- fatiador -------------------------------------------------------------

/**
 * Acumula bytes de um sentido e devolve os pacotes completos que já couberam.
 * Guarda o resto para o próximo pedaço — pacote partido entre dois writes de
 * TCP é normal e não pode virar "pacote desconhecido".
 */
class Fatiador {
	constructor(servidor, dir) {
		this.servidor = servidor;
		this.dir = dir;
		this.resto = Buffer.alloc(0);
		this.travado = false; // achou opcode sem tamanho: não dá mais para fatiar
		this.bytes = 0;

		/*
		 * O CHAR-SERVER NÃO COMEÇA COM UM PACOTE.
		 *
		 * Logo depois do `CH_ENTER`, ele responde 4 bytes CRUS com o account id —
		 * sem opcode, sem cabeçalho. Não é suposição: o próprio cliente lê assim,
		 * fora do enquadramento de pacote, e o comentário está no código
		 * (`src/Engine/CharEngine.js:96-99`: "Server send back (new) AID" seguido
		 * de `Network.read(fp => { Session.AID = fp.readLong(); })`).
		 *
		 * Sem descontar esses 4 bytes, o fatiador lia `80 84 1e 00` como o opcode
		 * `0x8480`, não achava na tabela e desistia da conexão inteira no primeiro
		 * byte — foi o `travou: sem-tamanho` de toda conexão de char da sessão de
		 * 17/08, com 1.308 bytes gravados e ZERO pacotes nomeados.
		 */
		this.bytesCrusNoInicio = servidor === 'char' && dir === 's2c' ? 4 : 0;
	}

	receber(pedaco) {
		this.bytes += pedaco.length;
		if (this.travado) return [];

		this.resto = this.resto.length ? Buffer.concat([this.resto, pedaco]) : pedaco;

		if (this.bytesCrusNoInicio > 0) {
			const descartar = Math.min(this.bytesCrusNoInicio, this.resto.length);
			this.resto = this.resto.subarray(descartar);
			this.bytesCrusNoInicio -= descartar;
		}
		const pacotes = [];

		while (this.resto.length >= 2) {
			const opcode = this.resto.readUInt16LE(0);
			const info = descreverOpcode(this.servidor, this.dir, opcode);

			if (!info || info.tamanho === null) {
				pacotes.push({ opcode, nome: info ? info.nome : null, tamanho: null, incompleto: 'sem-tamanho' });
				this.travado = true;
				break;
			}

			let tamanho = info.tamanho;

			/*
			 * TAMANHO ZERO NÃO É TAMANHO — e não é "desconhecido" tampouco.
			 *
			 * O cliente declara `.size = 0` para alguns pacotes cujo comprimento
			 * ele resolve por outro caminho (`HC_ACCEPT_MAKECHAR`, por exemplo).
			 * O zero atravessava as duas guardas daqui: não é `null`, não é `-1`.
			 * O resultado era `subarray(0)`, que não consome nada, dentro de um
			 * `while` — laço infinito empilhando o MESMO pacote até a memória
			 * acabar.
			 *
			 * Medido em 17/08/2026: o gravador morreu com "JavaScript heap out of
			 * memory" no meio da prova do M1 e, ao morrer, parou de encaminhar —
			 * o cliente ficou sem receber e a prova acusou o SERVIDOR. Um
			 * fatiador que trava é irritante; um que consome zero é um alçapão.
			 */
			if (tamanho === 0) {
				pacotes.push({ opcode, nome: info.nome, tamanho: null, incompleto: 'tamanho-zero' });
				this.travado = true;
				break;
			}

			if (tamanho === -1) {
				// Variável: o comprimento total vem nos bytes 2-3.
				if (this.resto.length < 4) break;
				tamanho = this.resto.readUInt16LE(2);
				// Tamanho declarado menor que o próprio cabeçalho é dado corrompido
				// ou tabela errada — não seguimos adivinhando.
				if (tamanho < 4) {
					pacotes.push({ opcode, nome: info.nome, tamanho, incompleto: 'tamanho-invalido' });
					this.travado = true;
					break;
				}
			}

			if (this.resto.length < tamanho) break; // chega no próximo pedaço

			pacotes.push({ opcode, nome: info.nome, tamanho, fonteDoTamanho: info.fonteDoTamanho });
			this.resto = this.resto.subarray(tamanho);
		}

		return pacotes;
	}
}

// --- servidor -------------------------------------------------------------

fs.mkdirSync(pastaDaSessao, { recursive: true });

const t0 = Date.now();
let nConexoes = 0;
const conexoes = [];

const wss = new WebSocketServer({ port: porta });

console.log(`[oraculo] gravando a sessao "${sessao}" em ${path.relative(process.cwd(), pastaDaSessao)}`);
for (const s of ['login', 'char', 'map']) {
	const r = TABELA.resumo[s];
	console.log(`[oraculo] tabela ${s}: entrada ${r.entrada.total} · saida ${r.saida.total} (packetver ${TABELA.packetver})`);
}
console.log(`[oraculo] escutando em ws://localhost:${porta}`);
if (Object.keys(redirects).length) console.log('[oraculo] redirecionamentos:', redirects);

wss.on('connection', (ws, req) => {
	let alvo = req.url.slice(1);
	if (redirects[alvo]) alvo = redirects[alvo];

	const partes = alvo.split(':');
	if (partes.length !== 2) {
		console.log(`[oraculo] alvo invalido: ${alvo}`);
		ws.close();
		return;
	}

	const [host, portaStr] = partes;
	const portaAlvo = parseInt(portaStr, 10);

	const n = ++nConexoes;
	const servidor = nomeDoAlvo(portaAlvo);
	const etiqueta = `${String(n).padStart(2, '0')}-${servidor ?? 'porta' + portaAlvo}`;

	if (!servidor) {
		// Sem saber o servidor não há tabela de opcode certa, e nomear pelo balde
		// errado é pior que não nomear. Grava os bytes e diz que não fatiou.
		console.log(`[oraculo] ${etiqueta}: porta desconhecida — vou gravar os bytes SEM fatiar.`);
	}

	const registro = {
		n,
		alvo,
		servidor,
		etiqueta,
		abertaEm: Date.now() - t0,
		pacotes: { c2s: 0, s2c: 0 },
		bytes: { c2s: 0, s2c: 0 },
		travou: { c2s: false, s2c: false }
	};
	conexoes.push(registro);

	const bin = {
		c2s: fs.createWriteStream(path.join(pastaDaSessao, `${etiqueta}.c2s.bin`)),
		s2c: fs.createWriteStream(path.join(pastaDaSessao, `${etiqueta}.s2c.bin`))
	};
	const jsonl = fs.createWriteStream(path.join(pastaDaSessao, `${etiqueta}.jsonl`));
	const fatiador = {
		c2s: new Fatiador(servidor, 'c2s'),
		s2c: new Fatiador(servidor, 's2c')
	};

	jsonl.write(JSON.stringify({ tipo: 'conexao', n, alvo, servidor, etiqueta, ms: registro.abertaEm }) + '\n');

	/**
	 * Cliente → servidor NÃO precisa de fatiamento: WebSocket preserva fronteira
	 * de mensagem, e o cliente chama `socket.send()` uma vez por pacote
	 * (`src/Network/NetworkManager.js`, `sendPacket`). Então cada mensagem que
	 * chega aqui É um pacote, com tamanho EXATO — medido, não inferido de tabela.
	 *
	 * Isso também tira do caminho a dependência de tabela para o sentido de saída:
	 * a tabela só nomeia. Opcode sem nome vira `null` e o pacote continua gravado
	 * com o tamanho certo, em vez de travar a sessão como acontecia antes.
	 */
	function anotarSaida(pedaco) {
		const ms = Date.now() - t0;
		const deslocamento = fatiador.c2s.bytes;
		bin.c2s.write(pedaco);
		fatiador.c2s.bytes += pedaco.length;

		const opcode = pedaco.length >= 2 ? pedaco.readUInt16LE(0) : null;
		const info = opcode === null ? null : descreverOpcode(servidor, 'c2s', opcode);

		jsonl.write(
			JSON.stringify({
				ms,
				dir: 'c2s',
				opcode: opcode === null ? null : '0x' + opcode.toString(16).padStart(4, '0'),
				nome: info ? info.nome : null,
				tamanho: pedaco.length,
				deslocamento,
				// O tamanho declarado na tabela do cliente, quando existe e difere
				// do que foi de fato enviado. Divergência aqui é achado, não erro
				// do gravador: quem manda é o fio.
				...(info && info.tamanho > 0 && info.tamanho !== pedaco.length
					? { tamanhoNaTabela: info.tamanho }
					: {})
			}) + '\n'
		);

		registro.pacotes.c2s++;
		registro.bytes.c2s = fatiador.c2s.bytes;
	}

	function anotar(dir, pedaco) {
		const ms = Date.now() - t0;
		const deslocamentoInicial = fatiador[dir].bytes;
		bin[dir].write(pedaco);

		let deslocamento = deslocamentoInicial;
		for (const p of fatiador[dir].receber(pedaco)) {
			jsonl.write(
				JSON.stringify({
					ms,
					dir,
					opcode: '0x' + p.opcode.toString(16).padStart(4, '0'),
					nome: p.nome,
					tamanho: p.tamanho,
					deslocamento,
					// De onde veio o tamanho usado para achar a fronteira. Só é
					// gravado quando NÃO veio do cliente — ver o comentário do
					// campo no leitor: tamanho de fonte de reserva é o primeiro
					// suspeito quando o fatiamento sai torto.
					...(p.fonteDoTamanho ? { fonteDoTamanho: p.fonteDoTamanho } : {}),
					...(p.incompleto ? { incompleto: p.incompleto } : {})
				}) + '\n'
			);
			if (p.incompleto) {
				registro.travou[dir] = p.incompleto;
				console.log(
					`[oraculo] ${etiqueta} ${dir}: fatiamento PAROU no opcode ` +
						`0x${p.opcode.toString(16)} (${p.incompleto}). O .bin continua completo.`
				);
			} else {
				registro.pacotes[dir]++;
				deslocamento += p.tamanho;
			}
		}
		registro.bytes[dir] = fatiador[dir].bytes;
	}

	const tcp = net.connect(portaAlvo, host, () => {
		console.log(`[oraculo] ${etiqueta}: ligado em ${host}:${portaAlvo}`);
	});
	tcp.setNoDelay(true);

	ws.on('message', mensagem => {
		const pedaco = Buffer.isBuffer(mensagem) ? mensagem : Buffer.from(mensagem);
		anotarSaida(pedaco);
		if (tcp.writable) tcp.write(pedaco);
	});

	tcp.on('data', dados => {
		anotar('s2c', dados);
		if (ws.readyState === ws.OPEN) ws.send(dados);
	});

	let fechada = false;
	const encerrar = () => {
		if (fechada) return;
		fechada = true;
		registro.fechadaEm = Date.now() - t0;
		jsonl.write(JSON.stringify({ tipo: 'fim', ms: registro.fechadaEm, ...registro }) + '\n');
		jsonl.end();
		bin.c2s.end();
		bin.s2c.end();
		tcp.end();
		ws.close();
		gravarIndice();
		console.log(
			`[oraculo] ${etiqueta}: fechada. ` +
				`c2s ${registro.pacotes.c2s} pacotes / ${registro.bytes.c2s} B · ` +
				`s2c ${registro.pacotes.s2c} pacotes / ${registro.bytes.s2c} B`
		);
	};

	ws.on('close', encerrar);
	ws.on('error', encerrar);
	tcp.on('close', encerrar);
	tcp.on('error', err => {
		console.error(`[oraculo] ${etiqueta}: erro TCP: ${err.message}`);
		encerrar();
	});
});

function gravarIndice() {
	fs.writeFileSync(
		path.join(pastaDaSessao, 'indice.json'),
		JSON.stringify(
			{
				sessao,
				packetver: TABELA.packetver,
				gravadoPor: 'oraculo/gravador-de-pacotes.js',
				conexoes
			},
			null,
			'\t'
		) + '\n'
	);
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
	process.on(sinal, () => {
		gravarIndice();
		console.log(`[oraculo] indice gravado. ${conexoes.length} conexao(oes) na sessao "${sessao}".`);
		process.exit(0);
	});
}
