/**
 * A PONTE NAO PODE MORRER POR UM PEDIDO (08/09/2026).
 *
 * Ela e o ponto unico de falha do jogo: nao guarda estado, mas TODO jogador
 * entra por ela, e o supervisor de producao nao vigiava a saida dela — quando
 * morria, o painel seguia dizendo "NO AR" com o jogo inutilizavel.
 *
 * O caminho medido era `redirects[target]` com `target` vindo CRU da URL:
 * `const redirects = {}` tem a cadeia de prototipo, entao `/constructor`
 * devolvia a funcao `Object` (truthy), o codigo fazia `target = Object` e a
 * linha seguinte chamava `target.split(':')`. `TypeError` dentro de um
 * listener de evento nao tem quem o contenha, e o processo morria.
 *
 * Este arquivo SOBE A PONTE DE VERDADE, em porta isolada, e mede o processo —
 * porque o defeito nao era do valor devolvido por uma funcao: era de o
 * processo continuar existindo. Nenhum teste de unidade veria isso.
 *
 * O CONTROLE vem primeiro e importa tanto quanto o caso: sem ele, uma ponte
 * que se recusasse a subir passaria neste teste por nao ter morrido.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Porta isolada: a 5999 e a de producao/desenvolvimento e nao pode ser tocada. */
const PORTA = 15997;

let ponte = null;

/** Sobe a ponte com a configuracao EXATA de producao e espera ela escutar. */
async function subirAPonte() {
  ponte = spawn(process.execPath, ['wsproxy.js', '-p', String(PORTA)], {
    cwd: RAIZ,
    // Como em producao: lista de destinos definida, e NENHUM `-r`. Sem isto o
    // teste mediria um arranjo que ninguem usa.
    env: { ...process.env, WSPROXY_ALVOS: '127.0.0.1:6900,127.0.0.1:6121,127.0.0.1:5121' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let saida = '';
  ponte.stdout.on('data', (d) => (saida += String(d)));
  ponte.stderr.on('data', (d) => (saida += String(d)));
  const morreu = new Promise((resolve) => ponte.once('exit', (c) => resolve(c ?? -1)));
  await new Promise((resolve, reject) => {
    const prazo = setTimeout(() => reject(new Error(`a ponte nao subiu em 5 s: ${saida}`)), 5_000);
    const olhar = setInterval(() => {
      if (saida.includes('Listening on')) {
        clearInterval(olhar);
        clearTimeout(prazo);
        resolve();
      }
    }, 50);
  });
  return { morreu, saida: () => saida };
}

/** Abre um WebSocket, espera ele fechar (ou dar erro) e devolve. */
function bater(caminho) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${String(PORTA)}/${caminho}`);
    const pronto = () => resolve();
    ws.on('close', pronto);
    ws.on('error', pronto);
    ws.on('open', () => setTimeout(() => ws.close(), 150));
  });
}

/**
 * Espera uma linha aparecer na saida do processo, com prazo.
 *
 * **Ela nasceu de um vermelho que so aparecia na suite inteira** (08/09/2026):
 * o caso da tranca de D-540 passava sozinho e reprovava com os 87 arquivos
 * rodando. A causa nao era o codigo — era ESTE teste afirmando sobre a saida de
 * OUTRO processo no instante seguinte ao gesto. O `console.log` da ponte, o
 * `write` no pipe e a chegada ao nosso buffer sao tres passos assincronos, e
 * sob disputa de CPU eles nao cabem no mesmo tique.
 *
 * Afirmar direto sobre `saida()` e o mesmo defeito que "criterio que passa com
 * zero", do avesso: um teste que passa por sorte de escalonamento.
 */
async function esperarLinha(saida, texto, prazo = 5_000) {
  const ate = Date.now() + prazo;
  while (Date.now() < ate) {
    if (saida().includes(texto)) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

/** O processo continua vivo depois de `ms`? */
function continuaViva(morreu, ms) {
  return Promise.race([
    morreu.then(() => false),
    new Promise((r) => setTimeout(() => r(true), ms)),
  ]);
}

afterEach(() => {
  if (ponte && ponte.exitCode === null) ponte.kill();
  ponte = null;
});

describe('a ponte WebSocket', () => {
  it(
    'escuta so em LOOPBACK — quem alcanca a ponte e o tunel na mesma maquina, nao a internet',
    async () => {
      /*
       * Medido na VPS em 08/09/2026: a ponte aparecia como `*:5999` no
       * `ss -ltnp` — todas as interfaces — enquanto as seis portas do jogo
       * estavam em `127.0.0.1`. Quem segurava o mundo do lado de fora era so o
       * `ufw`, **protecao que mora fora deste repositorio**.
       *
       * O teste le a linha de subida porque ela e o COMPORTAMENTO observavel: o
       * processo diz onde ligou. Olhar o fonte provaria que a constante existe;
       * so a linha prova que ela chegou ao `listen`.
       */
      const { saida, morreu } = await subirAPonte();
      expect(await esperarLinha(saida, `Listening on 127.0.0.1:${String(PORTA)}`)).toBe(true);
      expect(saida(), 'sem aviso de porta aberta, porque ela nao esta aberta').not.toContain(
        'fora de loopback',
      );
      expect(await continuaViva(morreu, 100), 'e ela sobe, nao so imprime').toBe(true);
    },
    30_000,
  );

  it(
    'sobrevive a um pedido cuja chave so existe no PROTOTIPO — o caso que a matava',
    async () => {
      const { morreu, saida } = await subirAPonte();

      // CONTROLE: um destino legitimo. Se a ponte ja estivesse morta ou surda
      // aqui, o caso abaixo passaria de graca.
      await bater('127.0.0.1:6900');
      expect(
        await continuaViva(morreu, 200),
        'a ponte precisa estar viva ANTES do caso, senao o teste nao mede nada',
      ).toBe(true);
      expect(
        await esperarLinha(saida, 'Connection request from'),
        'o controle tem de ter sido ATENDIDO, e nao recusado',
      ).toBe(true);

      // O CASO: `constructor`, `__proto__` e companhia. Nenhum e um destino;
      // todos existem em `Object.prototype`.
      for (const chave of ['constructor', '__proto__', 'toString', 'valueOf']) {
        await bater(chave);
        expect(
          await continuaViva(morreu, 120),
          `a ponte morreu depois de um pedido para /${chave}`,
        ).toBe(true);
      }

      // E continua ATENDENDO — sobreviver calada nao serve de nada.
      const antes = saida().length;
      await bater('127.0.0.1:6121');
      expect(
        await esperarLinha(saida, '127.0.0.1:6121'),
        'a ponte tem de seguir atendendo depois dos pedidos ruins',
      ).toBe(true);
      expect(saida().length).toBeGreaterThan(antes);
    },
    30_000,
  );

  it(
    'um destino fora da lista e recusado sem derrubar a ponte (a tranca de D-540 continua)',
    async () => {
      const { morreu, saida } = await subirAPonte();
      await bater('10.0.0.1:22');
      expect(await esperarLinha(saida, 'RECUSADO destino fora da lista')).toBe(true);
      expect(await continuaViva(morreu, 200)).toBe(true);
    },
    30_000,
  );
});
