/**
 * QUANTO TEMPO A BORDA AGUENTA UMA CONEXAO OCIOSA? (16/09/2026)
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA SONDA EXISTE
 * ---------------------------------------------------------------------------
 * O caminho do jogador e `navegador -> Cloudflare -> cloudflared -> ponte
 * (5999) -> TCP -> servidor de mapa`. A auditoria do disconnect cronometrou os
 * dois matadores DO NOSSO LADO (teto de escrita e prazo de ociosidade), mas o
 * salto do meio nunca foi medido: o repositorio so tem um COMENTARIO afirmando
 * "~100 s de ociosidade para WebSocket em alguns planos".
 *
 * **Isso e uma alegacao, nao uma medicao** — e ela esta sendo usada para
 * justificar o conserto D-1505 (a ponte mandando ping). Uma sonda que custa
 * onze minutos resolve a duvida em vez de herda-la.
 *
 * ---------------------------------------------------------------------------
 * A ARMADILHA QUE ESTA SONDA TEVE DE CONTORNAR
 * ---------------------------------------------------------------------------
 * A versao ingenua — abrir um WebSocket e ficar mudo — mediria a coisa errada.
 * A ponte abre um TCP para o servidor de LOGIN, e o transporte tem
 * `PRAZO_DE_SAUDACAO_MS = 30_000`: quem nao enquadra **um pacote sequer** em
 * 30 s e arrancado por NOS, nao pela borda. As tres conexoes morreriam aos 30 s
 * e a sonda concluiria que a borda mata em meio minuto.
 *
 * Por isso toda conexao manda UM `CZ_REQUEST_TIME2` logo ao abrir: ele enquadra,
 * satisfaz a saudacao, e e tolerado no login-server de proposito (D-340). A
 * partir dai o unico prazo do nosso lado e o de ociosidade, 600 s — e qualquer
 * morte MUITO antes disso e da borda.
 *
 * ---------------------------------------------------------------------------
 * AS TRES CONEXOES, E O QUE CADA UMA SEPARA
 * ---------------------------------------------------------------------------
 *   A  MUDA          — so o pacote inicial. E a producao de HOJE: a ponte nao
 *                      manda ping (D-1505 nao esta publicado) e a aba congelada
 *                      nao manda nada.
 *   B  KEEPALIVE     — `CZ_REQUEST_TIME2` a cada 30 s. O jogador com a aba em
 *                      primeiro plano. Se ESTE cair, o problema nao e ociosidade
 *                      de ninguem — e outra coisa, e grave.
 *   C  SO PING WS    — quadros `ping` de WebSocket, que NAO viram pacote de
 *                      jogo. E exatamente o que D-1505 faz.
 *
 * COMO LER O RESULTADO:
 *   A morre bem antes de 600 s, C sobrevive  -> a borda TEM prazo de ociosidade,
 *                                               e o ping da ponte e o remedio.
 *   A e C morrem juntos, perto de 600 s      -> a borda NAO tem prazo curto; quem
 *                                               mata e o nosso prazo de ociosidade,
 *                                               e o ping sozinho nao salva o jogo.
 *   B morre                                  -> achado novo; investigar antes de
 *                                               concluir qualquer coisa das outras.
 *
 * Ela nao faz login, nao toca personagem nenhum e nao escreve nada: abre tres
 * sockets e cronometra. Uso:
 *
 *   node oraculo/diag-borda-de-producao.mjs [--minutos=11] [--host=ws.dominio]
 */

import WebSocket from 'ws';

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado === undefined ? padrao : achado.slice(nome.length + 3);
};

const HOST = arg('host', 'ws.roclassicidle.com.br');
/** O alvo da ponte — a lista permitida dela (`ALVOS_PADRAO`, wsproxy.js). */
const ALVO = arg('alvo', '127.0.0.1:6900');
const TETO_MIN = Number(arg('minutos', '11'));
const PING_MS = 30_000;

/** `CZ_REQUEST_TIME2`: opcode 0x0360 + tick u32 = 6 bytes fixos. */
function keepalive() {
  const b = Buffer.alloc(6);
  b.writeUInt16LE(0x0360, 0);
  b.writeUInt32LE(Date.now() >>> 0, 2);
  return b;
}

class Sonda {
  constructor(nome, modo) {
    this.nome = nome;
    this.modo = modo; // 'mudo' | 'keepalive' | 'ping'
    this.abriuEm = 0;
    this.morreuEm = null;
    this.motivo = '';
    this.bytesRecebidos = 0;
    this.relogio = null;
  }

  abrir() {
    const url = `wss://${HOST}/${ALVO}`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const falhaNaAbertura = (e) => reject(new Error(`${this.nome}: ${e.message}`));
      ws.once('error', falhaNaAbertura);

      ws.on('open', () => {
        ws.off('error', falhaNaAbertura);
        ws.on('error', () => undefined);
        this.abriuEm = Date.now();

        // O pacote que satisfaz o prazo de saudacao — ver o cabecalho.
        ws.send(keepalive());

        if (this.modo === 'keepalive') {
          this.relogio = setInterval(() => {
            if (ws.readyState === ws.OPEN) ws.send(keepalive());
          }, PING_MS);
        } else if (this.modo === 'ping') {
          this.relogio = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
              try {
                ws.ping();
              } catch {
                /* o close limpa */
              }
            }
          }, PING_MS);
        }
        this.relogio?.unref?.();
        resolve();
      });

      ws.on('message', (d) => {
        this.bytesRecebidos += d.length ?? 0;
      });

      ws.on('close', (codigo, motivo) => {
        if (this.morreuEm === null) {
          this.morreuEm = Date.now();
          this.motivo = `codigo=${codigo}${motivo?.length ? ` motivo=${String(motivo)}` : ''}`;
        }
        if (this.relogio) clearInterval(this.relogio);
      });
    });
  }

  get viveuS() {
    const fim = this.morreuEm ?? Date.now();
    return Math.round((fim - this.abriuEm) / 1000);
  }

  get vivo() {
    return this.morreuEm === null;
  }

  fechar() {
    if (this.relogio) clearInterval(this.relogio);
    try {
      this.ws?.close();
    } catch {
      /* fechar ja fechado nao e problema de ninguem */
    }
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  console.log('QUANTO TEMPO A BORDA AGUENTA UMA CONEXAO OCIOSA?\n');
  console.log(`  alvo  : wss://${HOST}/${ALVO}`);
  console.log(`  teto  : ${TETO_MIN} min`);
  console.log('  nota  : o prazo de ociosidade NOSSO e 600 s — morte muito antes disso e da BORDA.\n');

  const sondas = [
    new Sonda('A  mudo     ', 'mudo'),
    new Sonda('B  keepalive', 'keepalive'),
    new Sonda('C  ping ws  ', 'ping'),
  ];

  for (const s of sondas) {
    try {
      await s.abrir();
      console.log(`  ${s.nome} aberta`);
    } catch (e) {
      console.log(`  ${s.nome} NAO ABRIU — ${e.message}`);
    }
    await dormir(400); // a ponte tem freio de conexoes novas por IP
  }

  if (sondas.every((s) => s.abriuEm === 0)) {
    console.log('\nNenhuma conexao abriu. A sonda nao mediu nada — nao conclua da ausencia.');
    process.exitCode = 1;
    return;
  }

  console.log('\n   min | A mudo | B keepalive | C ping ws');
  const ate = Date.now() + TETO_MIN * 60_000;
  let ultimo = '';
  while (Date.now() < ate && sondas.some((s) => s.vivo && s.abriuEm > 0)) {
    await dormir(15_000);
    const linha = sondas
      .map((s) => (s.abriuEm === 0 ? '  --  ' : s.vivo ? '  ok  ' : `${String(s.viveuS)}s`))
      .join(' | ');
    if (linha !== ultimo) {
      console.log(`  ${((Date.now() - sondas[0].abriuEm) / 60_000).toFixed(1).padStart(4)} | ${linha}`);
      ultimo = linha;
    }
  }

  console.log('\n--- RESULTADO ---');
  for (const s of sondas) {
    if (s.abriuEm === 0) {
      console.log(`  ${s.nome} nao abriu`);
    } else if (s.vivo) {
      console.log(`  ${s.nome} SOBREVIVEU aos ${String(s.viveuS)}s · ${String(s.bytesRecebidos)}B recebidos`);
    } else {
      console.log(`  ${s.nome} morreu aos ${String(s.viveuS)}s · ${s.motivo} · ${String(s.bytesRecebidos)}B recebidos`);
    }
  }

  /*
   * A LEITURA ERRAVA O DESFECHO MAIS INFORMATIVO (corrigido em 16/09/2026, na
   * primeira corrida).
   *
   * A versao anterior so sabia ler dois mundos — "a borda mata" ou "a borda nao
   * mata" — e testava `c.vivo`, ou seja, supunha que a conexao do ping ou
   * sobrevivia ate o fim ou morria junto com a muda. **O que aconteceu foi o
   * terceiro caso, e ele e o mais util de todos**: C atravessou os 125 s da
   * borda e morreu aos 600 s, no NOSSO prazo de ociosidade. Com isso a sonda
   * imprimiu "resultado misto" sobre numeros que nao tem nada de ambiguo.
   *
   * A licao e a de sempre neste projeto: o rotulo automatico so enxerga os
   * desfechos que quem o escreveu imaginou, e o desfecho que ensina e
   * justamente o que ninguem imaginou. Hoje a leitura compara CADA morte com o
   * prazo que a explicaria, em vez de casar padroes de "vivo/morto".
   */
  const [a, , c] = sondas;
  const NOSSO_PRAZO_S = 600;
  const daBorda = (s) => !s.vivo && s.viveuS < NOSSO_PRAZO_S - 60;
  const doNossoPrazo = (s) => !s.vivo && Math.abs(s.viveuS - NOSSO_PRAZO_S) <= 60;

  console.log('\n--- LEITURA ---');
  if (daBorda(a)) {
    console.log(`  1. A BORDA TEM PRAZO DE OCIOSIDADE: a conexao muda morreu aos ${String(a.viveuS)}s,`);
    console.log('     muito antes do nosso prazo de 600 s. Nao ha nada a consertar nela — ela nao e nossa.');
  } else if (a.vivo) {
    console.log(`  1. A conexao MUDA sobreviveu ${String(a.viveuS)}s — a borda nao tem prazo abaixo disso.`);
  } else {
    console.log(`  1. A conexao muda morreu aos ${String(a.viveuS)}s, perto do nosso prazo: a borda nao foi a causa.`);
  }

  if (daBorda(a) && !daBorda(c)) {
    console.log('  2. O PING DE WEBSOCKET ATRAVESSA A BORDA — e o conserto D-1505 esta provado:');
    console.log(`     C mandou so ping e passou dos ${String(a.viveuS)}s que mataram A.`);
  } else if (daBorda(a) && daBorda(c)) {
    console.log('  2. O PING NAO SALVA: C morreu junto com A. D-1505 seria placebo — investigar antes de publicar.');
  }

  if (doNossoPrazo(c)) {
    console.log(`  3. MAS O PING NAO SALVA O JOGO: C morreu aos ${String(c.viveuS)}s, no NOSSO prazo de`);
    console.log('     ociosidade. Quadro de WebSocket nao vira pacote de jogo, entao o relogio do');
    console.log('     servidor continua correndo. E o que o proprio D-1505 ja dizia por escrito:');
    console.log('     "isto NAO ressuscita o jogador" — ele compra a CONEXAO, nao a sessao.');
  }

  for (const s of sondas) s.fechar();
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
