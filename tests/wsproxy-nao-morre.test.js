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
import net from 'node:net';
import path from 'node:path';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Porta isolada: a 5999 e a de producao/desenvolvimento e nao pode ser tocada. */
const PORTA = 15997;

/**
 * O ALVO FALSO — um servidor TCP que ACEITA e nao diz nada (11/09/2026).
 *
 * Ele nasceu com os testes de teto, e a razao e um detalhe que quase custou uma
 * tarde: as tres portas do jogo (6900/6121/5121) **nao estao escutando durante
 * a suite**. Uma conexao pela ponte para uma delas recebe `ECONNREFUSED` no
 * `net.connect`, o `cleanup` dispara e o WebSocket cai sozinho em
 * milissegundos — ou seja, ela nunca SEGURA vaga nenhuma, e um teto de
 * simultaneas medido contra ela mediria zero.
 *
 * Com um destino que aceita e fica quieto, a conexao pela ponte vive enquanto o
 * teste quiser, que e a unica forma de provar que a terceira entra, a quarta e
 * recusada, e a vaga VOLTA quando a primeira sai.
 */
const PORTA_DO_ALVO = 15996;
const ALVO_FALSO = `127.0.0.1:${PORTA_DO_ALVO}`;

let ponte = null;
let alvo = null;
const socketsDoAlvo = [];
const clientes = [];

/** Sobe o destino que aceita conexao e a mantem aberta. */
function subirOAlvoFalso() {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer((socket) => {
      socketsDoAlvo.push(socket);
      // Um `error` sem ouvinte num socket derruba o processo do TESTE, e o
      // final normal daqui e a ponte morrendo com estes sockets abertos.
      socket.on('error', () => {});
    });
    servidor.on('error', reject);
    servidor.listen(PORTA_DO_ALVO, '127.0.0.1', () => resolve(servidor));
  });
}

/**
 * Sobe a ponte com a configuracao EXATA de producao e espera ela escutar.
 *
 * `extras` entra no ambiente por cima do resto: e como cada teto e medido, com
 * um numero pequeno o bastante para o teste bater nele em segundos. Medir o
 * padrao (512 conexoes) exigiria abrir 513 sockets, que mede o aparelho e nao a
 * regra — o que precisa ser provado e que o numero do ambiente CHEGA ao teto,
 * e a linha de subida diz isso.
 */
async function subirAPonte(extras = {}) {
  ponte = spawn(process.execPath, ['wsproxy.js', '-p', String(PORTA)], {
    cwd: RAIZ,
    // Como em producao: lista de destinos definida, e NENHUM `-r`. Sem isto o
    // teste mediria um arranjo que ninguem usa. O alvo falso entra na lista
    // porque os tetos precisam de um destino que aceite — ver `PORTA_DO_ALVO`.
    env: {
      ...process.env,
      WSPROXY_ALVOS: `127.0.0.1:6900,127.0.0.1:6121,127.0.0.1:5121,${ALVO_FALSO}`,
      ...extras,
    },
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

/**
 * Abre um WebSocket e NAO o fecha — o oposto do `bater`, para os testes de teto.
 *
 * `cabecalhos` e como o teste finge ser o tunel: em producao quem diz o
 * endereco do jogador e o `cf-connecting-ip` que a Cloudflare escreve, e sem
 * ele toda conexao chega como `127.0.0.1` (ver o teste da degradacao, mais
 * abaixo). Passar o cabecalho aqui e medir o caminho de producao, e nao um
 * arranjo de laboratorio.
 *
 * Ela resolve o `pronto` tanto em `open` quanto em `close` porque a conexao
 * RECUSADA tambem abre: o aperto de mao termina antes de o handler da ponte
 * rodar, e so entao vem o fechamento com o codigo. Esperar so por `open`
 * funcionaria, mas por motivo errado — e um dia deixaria de funcionar.
 */
function abrir(destino, cabecalhos) {
  const ws = new WebSocket(
    `ws://127.0.0.1:${String(PORTA)}/${destino}`,
    cabecalhos ? { headers: cabecalhos } : undefined,
  );
  clientes.push(ws);
  let avisarQueFechou;
  const fechou = new Promise((r) => (avisarQueFechou = r));
  ws.on('close', (codigo, motivo) => avisarQueFechou({ codigo, motivo: String(motivo) }));
  // Erro de socket vira `close` logo em seguida; sem este ouvinte ele derruba
  // o processo do teste.
  ws.on('error', () => {});
  const pronto = new Promise((resolve) => {
    ws.on('open', () => resolve());
    ws.on('close', () => resolve());
  });
  return { ws, fechou, pronto };
}

/** Abre e espera o aperto de mao terminar (aceito ou recusado). */
async function abrirEsperando(destino, cabecalhos) {
  const conexao = abrir(destino, cabecalhos);
  await conexao.pronto;
  return conexao;
}

/** A conexao continua aberta depois de `ms`? O espelho do `continuaViva`. */
function continuouAberta(conexao, ms) {
  return Promise.race([
    conexao.fechou.then(() => false),
    new Promise((r) => setTimeout(() => r(true), ms)),
  ]);
}

afterEach(async () => {
  if (ponte && ponte.exitCode === null) ponte.kill();
  ponte = null;
  for (const ws of clientes) {
    try {
      ws.terminate();
    } catch {
      /* fechar ja fechado nao e problema de ninguem */
    }
  }
  clientes.length = 0;
  for (const socket of socketsDoAlvo) socket.destroy();
  socketsDoAlvo.length = 0;
  if (alvo) {
    await new Promise((r) => alvo.close(r));
    alvo = null;
  }
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

/**
 * OS TETOS DE CONEXAO (11/09/2026).
 *
 * A ponte limitava o TAMANHO do frame e o DESTINO, e nunca a QUANTIDADE. Sem
 * teto, uma origem so enche as 4096 conexoes que o servidor de jogo aceita por
 * porta — e ai a defesa DELE recusa todo jogador legitimo — ou acaba com os
 * descritores da propria ponte, que e o caminho unico de todo mundo.
 *
 * Estes casos sobem a ponte de verdade, com o teto vindo do ambiente, e medem o
 * comportamento observavel: quem entra, quem e recusado, com que codigo de
 * fechamento, e — o que mais importa — se a vaga VOLTA. Um teto cuja
 * contabilidade vaza e pior que teto nenhum: ele vira uma queda lenta, em que a
 * ponte recusa cada vez mais gente conforme o dia passa.
 */
describe('os tetos de conexao da ponte', () => {
  it(
    'o teto TOTAL recusa a conexao seguinte — e a vaga volta quando alguem sai',
    async () => {
      alvo = await subirOAlvoFalso();
      const { morreu, saida } = await subirAPonte({ WSPROXY_TETO_DE_CONEXOES: '3' });

      // O numero do ambiente CHEGOU ao teto? Sem isto, um teto que ignorasse a
      // variavel passaria neste teste por recusar a quarta por outro motivo.
      expect(await esperarLinha(saida, 'tetos de conexao: 3 no total')).toBe(true);

      // CONTROLE: as tres primeiras entram e FICAM. Sem esta metade, uma ponte
      // que recusasse TODO mundo passaria no caso abaixo de graca.
      const vivas = [];
      for (let i = 0; i < 3; i++) vivas.push(await abrirEsperando(ALVO_FALSO));
      for (const conexao of vivas) {
        expect(await continuouAberta(conexao, 150), 'as tres do controle tem de continuar de pe').toBe(true);
      }

      // O CASO: a quarta e recusada, e recusada com o codigo que manda esperar
      // (`1013 Try Again Later`). Fechar com `1000` faria todo cliente
      // bem-educado reconectar na hora, e o teto viraria um gerador de laco.
      const quarta = await abrirEsperando(ALVO_FALSO);
      expect((await quarta.fechou).codigo).toBe(1013);
      expect(await esperarLinha(saida, 'RECUSADO teto total')).toBe(true);
      expect(await continuaViva(morreu, 150), 'recusar nao pode derrubar a ponte').toBe(true);

      // E A VAGA VOLTA. Este e o passo que separa "tem teto" de "tem teto que
      // funciona amanha": se o contador nao decrementasse, a ponte ficaria
      // recusando para sempre a partir da terceira conexao do dia.
      vivas[0].ws.close();
      expect(await esperarLinha(saida, 'Connection closed for')).toBe(true);
      const quinta = await abrirEsperando(ALVO_FALSO);
      expect(await continuouAberta(quinta, 250), 'a vaga liberada tem de ser reutilizavel').toBe(true);
    },
    30_000,
  );

  it(
    'o teto POR IP conta por endereco, e quem diz o endereco e o cabecalho do tunel',
    async () => {
      alvo = await subirOAlvoFalso();
      const { morreu, saida } = await subirAPonte({ WSPROXY_TETO_POR_IP: '2' });
      const jogador = { 'cf-connecting-ip': '203.0.113.7' };

      const primeira = await abrirEsperando(ALVO_FALSO, jogador);
      const segunda = await abrirEsperando(ALVO_FALSO, jogador);
      expect(await continuouAberta(primeira, 150)).toBe(true);
      expect(await continuouAberta(segunda, 150)).toBe(true);

      const terceira = await abrirEsperando(ALVO_FALSO, jogador);
      expect((await terceira.fechou).codigo).toBe(1013);
      expect(await esperarLinha(saida, 'RECUSADO por IP')).toBe(true);

      /*
       * O CONTROLE QUE FAZ ESTE TESTE VALER: outro endereco continua entrando.
       *
       * Sem ele, um teto global escrito errado — ou o proprio teto por IP
       * aplicado sobre uma chave unica — passaria aqui exatamente igual. A
       * diferenca entre "teto por IP" e "teto global disfarcado" e esta linha.
       */
      const outroJogador = await abrirEsperando(ALVO_FALSO, { 'cf-connecting-ip': '203.0.113.8' });
      expect(await continuouAberta(outroJogador, 250)).toBe(true);
      expect(await continuaViva(morreu, 100)).toBe(true);
    },
    30_000,
  );

  it(
    'no x-forwarded-for vale o ULTIMO salto — o primeiro e escrito pelo cliente',
    async () => {
      /*
       * O cabecalho e uma lista em que cada salto ANEXA o que viu, e o cliente
       * controla o comeco dela: quem mandar `X-Forwarded-For: 1.2.3.4` faz o
       * tunel anexar o endereco real depois do valor inventado. Ler o primeiro
       * elemento seria ler o campo que o atacante escreve — e trocar de
       * "endereco" a cada conexao derrubaria o teto por IP inteiro.
       *
       * As duas primeiras conexoes tem o primeiro elemento DIFERENTE e o ultimo
       * IGUAL: numa ponte que lesse o primeiro, as duas entrariam.
       */
      alvo = await subirOAlvoFalso();
      const { saida } = await subirAPonte({ WSPROXY_TETO_POR_IP: '1' });

      const umaSo = await abrirEsperando(ALVO_FALSO, { 'x-forwarded-for': '198.51.100.9, 203.0.113.7' });
      expect(await continuouAberta(umaSo, 150)).toBe(true);

      const disfarcada = await abrirEsperando(ALVO_FALSO, { 'x-forwarded-for': '198.51.100.10, 203.0.113.7' });
      expect((await disfarcada.fechou).codigo).toBe(1013);
      expect(await esperarLinha(saida, 'RECUSADO por IP')).toBe(true);

      // E o ultimo salto DIFERENTE e outra pessoa, que entra normalmente.
      const outra = await abrirEsperando(ALVO_FALSO, { 'x-forwarded-for': '198.51.100.9, 203.0.113.8' });
      expect(await continuouAberta(outra, 250)).toBe(true);
    },
    30_000,
  );

  it(
    'a RAJADA e cortada mesmo com as conexoes morrendo logo depois de abrir',
    async () => {
      /*
       * O teto de simultaneas nao ve este abuso: abrir e fechar em laco nunca
       * segura vaga nenhuma e mesmo assim custa, a cada volta, um aperto de
       * mao, um `connect` TCP contra o jogo e uma sessao la por um instante.
       *
       * Por isso cada conexao daqui e FECHADA antes de a seguinte abrir — se o
       * que estivesse sendo contado fosse simultaneidade, nenhuma seria
       * recusada. A janela vai a um minuto para o teste nao correr contra o
       * relogio: o que se mede e a contagem, e nao a passagem do tempo.
       */
      alvo = await subirOAlvoFalso();
      const { morreu, saida } = await subirAPonte({
        WSPROXY_NOVAS_POR_JANELA: '3',
        WSPROXY_JANELA_DE_NOVAS_MS: '60000',
      });
      const jogador = { 'cf-connecting-ip': '203.0.113.20' };

      for (let i = 0; i < 3; i++) {
        const conexao = await abrirEsperando(ALVO_FALSO, jogador);
        conexao.ws.close();
        await conexao.fechou;
      }

      const quarta = await abrirEsperando(ALVO_FALSO, jogador);
      expect((await quarta.fechou).codigo).toBe(1013);
      expect(await esperarLinha(saida, 'RECUSADO rajada')).toBe(true);

      // CONTROLE: a janela e por endereco, e nao do mundo inteiro.
      const outroJogador = await abrirEsperando(ALVO_FALSO, { 'cf-connecting-ip': '203.0.113.21' });
      expect(await continuouAberta(outroJogador, 250)).toBe(true);
      expect(await continuaViva(morreu, 100)).toBe(true);
    },
    30_000,
  );

  it(
    'sem endereco distinguivel os tetos por IP ficam INERTES — e a ponte diz isso em voz alta',
    async () => {
      /*
       * ESTE CASO PINA O CAVEAT, para que ninguem o "conserte" e crie a queda.
       *
       * Quando o tunel nao passa o endereco do cliente, toda conexao do mundo
       * chega como `127.0.0.1`. Um teto "por IP" sobre uma chave unica nao e
       * teto por IP: e um teto global bem mais baixo, disfarcado — com 32 por
       * IP, o 33o jogador do dia seria recusado. A ponte entao DESLIGA os dois
       * tetos por endereco e avisa uma vez, e quem segura a ponte nesse regime
       * e so o teto total.
       *
       * Os tetos vao a 1 de proposito: se eles fossem aplicados, a segunda
       * conexao ja seria recusada.
       */
      alvo = await subirOAlvoFalso();
      const { morreu, saida } = await subirAPonte({
        WSPROXY_TETO_POR_IP: '1',
        WSPROXY_NOVAS_POR_JANELA: '1',
      });

      // Nenhum cabecalho: e assim que chega quem esta atras de um tunel calado.
      const primeira = await abrirEsperando(ALVO_FALSO);
      const segunda = await abrirEsperando(ALVO_FALSO);
      const terceira = await abrirEsperando(ALVO_FALSO);
      expect(await continuouAberta(primeira, 150)).toBe(true);
      expect(await continuouAberta(segunda, 150), 'o teto por IP nao pode valer aqui').toBe(true);
      expect(await continuouAberta(terceira, 150), 'nem o de rajada').toBe(true);

      expect(await esperarLinha(saida, 'endereco indistinguivel')).toBe(true);
      expect(await esperarLinha(saida, 'INERTES')).toBe(true);
      expect(saida(), 'ninguem pode ter sido recusado por endereco').not.toContain('RECUSADO por IP');
      expect(saida()).not.toContain('RECUSADO rajada');
      expect(await continuaViva(morreu, 100)).toBe(true);
    },
    30_000,
  );
});
