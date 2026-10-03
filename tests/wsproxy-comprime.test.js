/**
 * A PONTE COMPRIME O FIO (03/10/2026, `permessage-deflate`).
 *
 * Sobe a ponte DE VERDADE, com um alvo TCP que manda um fio repetitivo (como o
 * do jogo: o mesmo pacote de passo de monstro mil vezes), e mede no SOCKET do
 * cliente quantos bytes atravessaram — nao o tamanho da mensagem montada, que
 * e o mesmo com e sem compressao. O controle e a mesma corrida com
 * `WSPROXY_COMPRESSAO=0`: sem ele, um teste que so olhasse o cabecalho da
 * extensao passaria com a compressao negociada e nada comprimido.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Portas isoladas: as de `wsproxy-nao-morre` (15996/15997) e as do jogo ficam de fora. */
const PORTA = 15983;
const PORTA_DO_ALVO = 15982;

/** Um "passo de monstro" (0x0086, 16 bytes) repetido: o caso dominante do fio do jogo. */
const PASSO = Buffer.from([0x86, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee]);
const FIO = Buffer.concat(Array.from({ length: 2000 }, (_, i) => {
  const p = Buffer.from(PASSO);
  p.writeUInt16LE(i, 2); // o id muda, como muda no jogo
  return p;
}));

let ponte = null;
let alvo = null;

afterEach(async () => {
  ponte?.kill();
  ponte = null;
  await new Promise((r) => (alvo ? alvo.close(() => r()) : r()));
  alvo = null;
});

function subirOAlvo() {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer((socket) => {
      socket.on('error', () => {});
      // Em pedacos PEQUENOS e ESPACADOS, como o servidor do jogo escreve: cada
      // um vira UMA mensagem. E o caso que importa: a economia vem do contexto
      // mantido ENTRE mensagens pequenas, e nao de comprimir um bloco grande.
      let k = 0;
      const mandar = () => {
        if (k >= FIO.length || socket.destroyed) return;
        socket.write(FIO.subarray(k, k + 64));
        k += 64;
        setTimeout(mandar, 1);
      };
      mandar();
    });
    servidor.on('error', reject);
    servidor.listen(PORTA_DO_ALVO, '127.0.0.1', () => resolve(servidor));
  });
}

async function subirAPonte(extras = {}) {
  ponte = spawn(process.execPath, ['wsproxy.js', '-p', String(PORTA)], {
    cwd: RAIZ,
    env: { ...process.env, WSPROXY_ALVOS: `127.0.0.1:${PORTA_DO_ALVO}`, ...extras },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let saida = '';
  ponte.stdout.on('data', (d) => (saida += String(d)));
  ponte.stderr.on('data', (d) => (saida += String(d)));
  const ate = Date.now() + 5_000;
  while (!saida.includes('Listening on')) {
    if (Date.now() > ate) throw new Error(`a ponte nao subiu: ${saida}`);
    await new Promise((r) => setTimeout(r, 25));
  }
  return () => saida;
}

/** Conecta, junta o fio inteiro e devolve o que chegou e quanto passou no socket. */
function receberOFio() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${String(PORTA)}/127.0.0.1:${String(PORTA_DO_ALVO)}`);
    ws.binaryType = 'nodebuffer';
    const partes = [];
    let total = 0;
    const prazo = setTimeout(() => reject(new Error(`so chegaram ${String(total)} de ${String(FIO.length)} bytes`)), 15_000);
    ws.on('error', reject);
    ws.on('message', (dado) => {
      partes.push(dado);
      total += dado.length;
      if (total >= FIO.length) {
        clearTimeout(prazo);
        const noSocket = ws._socket.bytesRead;
        const extensao = ws.extensions;
        ws.close();
        resolve({ recebido: Buffer.concat(partes), noSocket, extensao });
      }
    });
  });
}

describe('a ponte comprime o fio do jogo (permessage-deflate)', () => {
  it('negocia a extensao, entrega os bytes INTACTOS e passa menos da metade pelo socket', async () => {
    alvo = await subirOAlvo();
    const saida = await subirAPonte();
    expect(saida()).toContain('compressao ligada');
    const r = await receberOFio();
    expect(r.extensao).toContain('permessage-deflate');
    expect(r.recebido.equals(FIO), 'os bytes do jogo chegam iguais').toBe(true);
    expect(r.noSocket, `passaram ${String(r.noSocket)} de ${String(FIO.length)}`).toBeLessThan(FIO.length / 2);
  });

  it('CONTROLE: com WSPROXY_COMPRESSAO=0 nada e negociado e o fio passa inteiro', async () => {
    alvo = await subirOAlvo();
    const saida = await subirAPonte({ WSPROXY_COMPRESSAO: '0' });
    expect(saida()).toContain('compressao desligada');
    const r = await receberOFio();
    expect(r.extensao).toBe('');
    expect(r.recebido.equals(FIO)).toBe(true);
    expect(r.noSocket).toBeGreaterThanOrEqual(FIO.length);
  });
});
