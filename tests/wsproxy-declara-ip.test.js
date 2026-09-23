/**
 * A PONTE DECLARA O IP DO JOGADOR AO SERVIDOR (H23, auditoria 2 de 22/09/2026).
 *
 * O servidor so ve a ponte, que abre todo socket da propria maquina: sem esta
 * linha todo jogador era `127.0.0.1`, e a tranca de senha tinha de ser por
 * conta. Com `WSPROXY_DECLARAR_IP=1` a primeira coisa no socket TCP e a linha
 * do PROXY protocol v1, com o IP real (o `CF-Connecting-IP` da Cloudflare).
 *
 * Mede-se o processo de verdade: a ponte sobe, um alvo TCP falso guarda os
 * primeiros bytes que recebe, e um WebSocket manda um pacote.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 15993;
const PORTA_DO_ALVO = 15992;

let ponte = null;
let alvo = null;

afterEach(async () => {
  ponte?.kill();
  ponte = null;
  await new Promise((r) => (alvo ? alvo.close(() => r()) : r()));
  alvo = null;
});

async function medirPrimeirosBytes(extras) {
  const recebidos = [];
  alvo = net.createServer((socket) => {
    socket.on('data', (d) => recebidos.push(d));
    socket.on('error', () => {});
  });
  await new Promise((r) => alvo.listen(PORTA_DO_ALVO, '127.0.0.1', r));
  ponte = spawn(process.execPath, ['wsproxy.js', '-p', String(PORTA)], {
    cwd: RAIZ,
    env: {
      ...process.env,
      WSPROXY_ALVOS: `127.0.0.1:${String(PORTA_DO_ALVO)}`,
      WSPROXY_CONFIAR_CABECALHO_DE_IP: '1',
      ...extras,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let saida = '';
  ponte.stdout.on('data', (d) => (saida += String(d)));
  ponte.stderr.on('data', (d) => (saida += String(d)));
  const ate = Date.now() + 5_000;
  while (!saida.includes('Listening on')) {
    if (Date.now() > ate) throw new Error(`a ponte nao subiu: ${saida}`);
    await new Promise((r) => setTimeout(r, 50));
  }
  const ws = new WebSocket(`ws://127.0.0.1:${String(PORTA)}/127.0.0.1:${String(PORTA_DO_ALVO)}`, {
    headers: { 'CF-Connecting-IP': '200.1.2.3' },
  });
  await new Promise((r, f) => {
    ws.on('open', r);
    ws.on('error', f);
  });
  ws.send(Buffer.from([0x64, 0x00]));
  const prazo = Date.now() + 3_000;
  while (Buffer.concat(recebidos).length < 2 && Date.now() < prazo) await new Promise((r) => setTimeout(r, 25));
  await new Promise((r) => setTimeout(r, 100));
  ws.close();
  return Buffer.concat(recebidos);
}

describe('a ponte declara o IP do jogador (H23)', () => {
  it('com WSPROXY_DECLARAR_IP=1, a linha PROXY vem ANTES do primeiro pacote', async () => {
    const bytes = await medirPrimeirosBytes({ WSPROXY_DECLARAR_IP: '1' });
    const linha = `PROXY TCP4 200.1.2.3 127.0.0.1 0 ${String(PORTA_DO_ALVO)}\r\n`;
    expect(bytes.subarray(0, linha.length).toString('latin1')).toBe(linha);
    expect([...bytes.subarray(linha.length)]).toEqual([0x64, 0x00]);
  }, 30_000);

  it('CONTROLE: desligada (o padrao), o servidor recebe so o pacote, como antes', async () => {
    const bytes = await medirPrimeirosBytes({});
    expect([...bytes]).toEqual([0x64, 0x00]);
  }, 30_000);
});
