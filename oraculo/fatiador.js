/**
 * O FATIADOR — a UNICA rota que transforma bytes de TCP em pacotes nomeados.
 *
 * Ele morava dentro de `gravador-de-pacotes.js`, e o gravador sobe um
 * WebSocketServer no import: quem quisesse fatiar em outro lugar teria de
 * reescrever a logica. Este projeto ja tem nome para o que acontece a seguir —
 * "duas rotas, e a segunda escrita a mao" —, e uma copia divergente do
 * fatiador seria a pior das versoes, porque o erro dela apareceria como
 * AUSENCIA de pacote e nao como erro.
 *
 * Entao ele saiu para ca inteiro, sem uma linha mudada, e os dois lados
 * importam: o gravador (ao vivo) e `ler-captura.js --refatiar` (sobre o `.bin`,
 * que guarda os bytes crus e continua completo mesmo quando o `.jsonl` truncou).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** Carrega `opcodes.json`, falando alto quando ele falta. */
export function carregarTabela() {
	const caminho = path.join(AQUI, 'opcodes.json');
	if (!fs.existsSync(caminho)) {
		throw new Error(
			`falta ${path.relative(process.cwd(), caminho)}.\n` +
				'          rode: node oraculo/gerar-tabela-de-opcodes.mjs'
		);
	}
	return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

/**
 * Qual servidor está do outro lado. Não é enfeite de nome de arquivo: o opcode
 * só identifica o pacote DENTRO de um servidor (`0x0064` é `CA_LOGIN` no login e
 * `CZ_REQ_OPEN_WRITE_MAIL` no map), então é isto que escolhe a tabela.
 */
export function nomeDoAlvo(porta) {
	if (porta === 6900) return 'login';
	if (porta === 6121) return 'char';
	if (porta === 5121) return 'map';
	return null;
}

export function descreverOpcode(TABELA, servidor, dir, opcode) {
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
export class Fatiador {
	constructor(TABELA, servidor, dir) {
		this.TABELA = TABELA;
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
			const info = descreverOpcode(this.TABELA, this.servidor, this.dir, opcode);

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
