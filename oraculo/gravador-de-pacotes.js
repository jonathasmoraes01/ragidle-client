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

/*
 * O FATIADOR MORA EM `oraculo/fatiador.js`, e nao mais aqui.
 *
 * Ele saiu deste arquivo porque `ler-captura.js --refatiar` precisa da MESMA
 * logica sobre os `.bin` gravados, e este modulo sobe um WebSocketServer no
 * import — nao da para reusar sem ligar um servidor. A alternativa era copiar,
 * e copia de fatiador diverge em silencio: o erro dela aparece como pacote
 * AUSENTE, nunca como erro.
 */
import { Fatiador, carregarTabela, descreverOpcode, nomeDoAlvo } from './fatiador.js';

let TABELA;
try {
	TABELA = carregarTabela();
} catch (erro) {
	console.error('[oraculo] ' + (erro instanceof Error ? erro.message : String(erro)));
	process.exit(1);
}

// --- servidor -------------------------------------------------------------

fs.mkdirSync(pastaDaSessao, { recursive: true });

const t0 = Date.now();

/**
 * A NUMERACAO CONTINUA DE ONDE A CORRIDA ANTERIOR PAROU (27/08/2026, auditoria).
 *
 * `nConexoes` reiniciava em 0 a cada processo, e a etiqueta sai dele. Como a
 * sessao padrao e uma pasta por DIA (`dev-<YYYY-MM-DD>`, scripts/dev.ts), rodar
 * de manha e de novo a tarde fazia a segunda corrida reusar `01-login`,
 * `01-char`, `01-map`... e o `createWriteStream` abre com flag 'w': TRUNCA.
 *
 * O resultado nao era uma pasta vazia — era uma pasta FRANKENSTEIN, que parece
 * uma sessao coerente. As etiquetas que a segunda corrida alcancava apagavam as
 * da primeira; as que ela nao alcancava sobreviviam.
 *
 * Medido no corpus ANTES do conserto: dentro de UM processo o `ms` de abertura
 * tem de ser nao-decrescente em `n`, e havia 113 inversoes em
 * `capturas/sem-nome/` (2.345 conexoes) e 22 em `capturas/servidor-m1/` (125).
 * Cada inversao e um par de arquivos de corridas diferentes com a mesma etiqueta.
 *
 * Continuar a contagem custa uma leitura de diretorio na subida e nao muda
 * layout nenhum: o `ler-captura.js` ja varre a pasta por `*.jsonl`.
 */
function ultimaEtiquetaEm(pasta) {
	let maior = 0;
	try {
		for (const nome of fs.readdirSync(pasta)) {
			const m = /^(\d+)-/.exec(nome);
			if (m) maior = Math.max(maior, parseInt(m[1], 10));
		}
	} catch {
		// pasta nova: a corrida comeca em 1, que e o que sempre valeu.
	}
	return maior;
}

let nConexoes = ultimaEtiquetaEm(pastaDaSessao);
const PRIMEIRA_DESTA_CORRIDA = nConexoes + 1;
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
		/*
		 * O CARIMBO DA CORRIDA (27/08/2026, auditoria).
		 *
		 * `abertaEm` e relativo ao `t0` DESTE processo, entao ele reinicia em zero a
		 * cada corrida. O `ler-captura.js` ordena a linha do tempo por `ms` e, com
		 * duas corridas na mesma pasta, produzia uma sequencia que nunca existiu —
		 * misturando sessoes de dias diferentes como se fossem uma so conversa.
		 *
		 * Numerar sem colidir impede a DESTRUICAO; este campo impede a FUSAO. Sao
		 * dois defeitos, e so o primeiro deles some sozinho.
		 */
		corridaEm: t0,
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
		c2s: new Fatiador(TABELA, servidor, 'c2s'),
		s2c: new Fatiador(TABELA, servidor, 's2c')
	};

	jsonl.write(
		JSON.stringify({ tipo: 'conexao', n, alvo, servidor, etiqueta, corridaEm: t0, ms: registro.abertaEm }) +
			'\n'
	);

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
		const info = opcode === null ? null : descreverOpcode(TABELA, servidor, 'c2s', opcode);

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
	/*
	 * O INDICE MESCLA (27/08/2026, auditoria).
	 *
	 * Ele era reescrito com as conexoes DAQUELA corrida so, e o `ler-captura.js`
	 * ja avisava disso na tela: "o indice.json so lista N — ele e reescrito a cada
	 * corrida". Agora que as etiquetas nao colidem mais, as conexoes das corridas
	 * anteriores CONTINUAM existindo em disco, e um indice que as omite passa a
	 * ser mentira em vez de simplificacao.
	 *
	 * A chave e a etiqueta, e as desta corrida ganham das antigas — so elas tem
	 * contagem definitiva.
	 */
	const caminho = path.join(pastaDaSessao, 'indice.json');
	const anteriores = [];
	try {
		const velho = JSON.parse(fs.readFileSync(caminho, 'utf8'));
		if (Array.isArray(velho.conexoes)) anteriores.push(...velho.conexoes);
	} catch {
		// primeiro indice da pasta, ou indice ilegivel: a corrida atual basta.
	}
	const desta = new Set(conexoes.map(c => c.etiqueta));
	const todas = [...anteriores.filter(c => !desta.has(c.etiqueta)), ...conexoes];

	fs.writeFileSync(
		caminho,
		JSON.stringify(
			{
				sessao,
				packetver: TABELA.packetver,
				gravadoPor: 'oraculo/gravador-de-pacotes.js',
				primeiraDestaCorrida: PRIMEIRA_DESTA_CORRIDA,
				corridaEm: t0,
				conexoes: todas
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
