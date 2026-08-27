/**
 * Gera `oraculo/opcodes.json` — as tabelas de opcode usadas pelo gravador para
 * nomear e FATIAR os pacotes, e pelo leitor para imprimi-los.
 *
 * A tabela NÃO é escrita à mão: sai das tabelas do próprio cliente.
 *
 * DOIS SENTIDOS, DUAS TABELAS. O opcode sozinho não identifica um pacote — o
 * mesmo número vale para pacotes diferentes em cada direção. Medido em
 * 17/08/2026: `0x0064` é `CA_LOGIN` do cliente para o servidor, e tratá-lo como
 * uma tabela só faz o gravador nomear pacote errado com cara de acerto.
 *
 * A classificação usa a convenção de nome do protocolo do RO, onde a família tem
 * duas letras <origem><destino> e `C` é o cliente (`A` = login, `H` = char,
 * `Z` = zone/map):
 *
 *   CA, CH, CZ  → SAÍDA   (cliente → servidor)
 *   AC, HC, ZC  → ENTRADA (servidor → cliente)
 *
 * FONTES, e o que cada uma dá:
 *
 *   src/Network/PacketVersions.js   entradas `[PACKET.XX.NOME, 0xNNNN, tamanho,
 *                                   ...offsets]` agrupadas por data de versão.
 *                                   Opcode E tamanho. Resolve por "piso", igual
 *                                   ao cliente (`PacketVerManager.js:27-38`):
 *                                   vale a última data <= o PACKETVER em vigor.
 *   src/Network/PacketStructure.js  `PACKET.XX.NOME.size = N` — tamanho TOTAL,
 *                                   incluindo os 2 bytes do opcode (conferido
 *                                   contra o rAthena em `HC.ACCEPT_DELETECHAR`
 *                                   = 2 e `HC.REFUSE_ENTER` = 3). E, para os
 *                                   pacotes de saída, o corpo do `build()`:
 *                                   `pkt_buf.writeShort(0xNN)` dá o opcode e
 *                                   `const pkt_len = 2 + 4 + …` dá o tamanho.
 *   src/Network/PacketRegister.js   `0xNNNN: PACKET.XX.NOME` — o que o cliente
 *                                   sabe RECEBER. Só nome.
 *
 * Uso:  node oraculo/gerar-tabela-de-opcodes.mjs [packetver]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');

const PACKETVER = parseInt(process.argv[2] || '20211103', 10);

const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const versoesJs = ler('src/Network/PacketVersions.js');
const estruturaJs = ler('src/Network/PacketStructure.js');
const registerJs = ler('src/Network/PacketRegister.js');

/**
 * O opcode é único POR SERVIDOR, não por sentido — e foi isso que a primeira
 * versão desta tabela errou. `0x0064` é `CA_LOGIN` no login-server e
 * `CZ_REQ_OPEN_WRITE_MAIL` no map-server: numa tabela só, o segundo sobrescrevia
 * o primeiro e o gravador nomeava o login de "abrir e-mail" com toda a
 * confiança do mundo.
 *
 * A convenção de nome do protocolo dá o servidor E o sentido em duas letras
 * <origem><destino>, com `C` = cliente, `A` = login, `H` = char, `Z` = zone/map.
 */
const SERVIDOR_POR_LETRA = { A: 'login', H: 'char', Z: 'map' };

function classificar(familia) {
  const m = /^([ACHZ])([ACHZ])$/.exec(familia);
  if (!m) return null;
  const [, origem, destino] = m;
  if (origem === 'C' && SERVIDOR_POR_LETRA[destino]) {
    return { servidor: SERVIDOR_POR_LETRA[destino], sentido: 'saida' };
  }
  if (destino === 'C' && SERVIDOR_POR_LETRA[origem]) {
    return { servidor: SERVIDOR_POR_LETRA[origem], sentido: 'entrada' };
  }
  return null;
}

const tabelas = {
  login: { entrada: new Map(), saida: new Map() },
  char: { entrada: new Map(), saida: new Map() },
  map: { entrada: new Map(), saida: new Map() },
};
const semSentido = new Set();

function registrar(familia, nome, opcode, tamanho, desde, naoSobrescrever = false) {
  const onde = classificar(familia);
  if (!onde) {
    semSentido.add(`${familia}_${nome}`);
    return;
  }
  const alvo = tabelas[onde.servidor][onde.sentido];

  /*
   * PRECEDÊNCIA: o `PacketVersions` GANHA do corpo do `build()`.
   *
   * O `PacketVersions` já resolve a versão (é uma entrada por data, e nós
   * aplicamos o piso). O `pkt_len` do `build()` é uma expressão literal que
   * ignora os `if (PACKETVER.value >= N) pkt_len += 4` que vêm depois dela.
   *
   * Medido: `CZ_ENTER2` tem `pkt_len = 2+4+4+4+4+1` = 19 no corpo e `+= 4` num
   * `if` logo abaixo, dando 23 para o nosso packetver — que é o que o
   * `PacketVersions` declara e o que o fio mostra. Sem esta guarda, o passo do
   * `build()` sobrescrevia 23 por 19 e o fatiamento do sentido de saída morria
   * no primeiro pacote do mapa.
   */
  if (naoSobrescrever && alvo.has(opcode) && alvo.get(opcode).desde !== null) return;

  alvo.set(opcode, { nome: `${familia}_${nome}`, tamanho, desde });
}

// --- 1. PacketVersions.js: opcode + tamanho, por data --------------------

const CHAVE_DE_VERSAO = /^\s*(\d+)\s*:\s*\[\s*$/;
const ENTRADA_DE_VERSAO = /^\s*\[\s*PACKET\.(\w+)\.(\w+)\s*,\s*(0x[0-9a-fA-F]+)\s*,\s*(-?\d+)/;

let versaoAtual = null;
let versoesLidas = 0;
let versoesAplicadas = 0;

for (const linha of versoesJs.split('\n')) {
  const chave = CHAVE_DE_VERSAO.exec(linha);
  if (chave) {
    versaoAtual = parseInt(chave[1], 10);
    versoesLidas++;
    if (versaoAtual <= PACKETVER) versoesAplicadas++;
    continue;
  }
  if (versaoAtual === null || versaoAtual > PACKETVER) continue;

  const m = ENTRADA_DE_VERSAO.exec(linha);
  if (!m) continue;
  registrar(m[1], m[2], parseInt(m[3], 16), parseInt(m[4], 10), versaoAtual);
}

// --- 2. PacketStructure.js: tamanho por nome (`.size = N`) ---------------

const TAMANHO_POR_NOME = /^\s*PACKET\.(\w+)\.(\w+)\.size\s*=\s*(-?\d+)\s*;/;
const tamanhoPorNome = new Map();
const nomesComMaisDeUmTamanho = new Set();

for (const linha of estruturaJs.split('\n')) {
  const m = TAMANHO_POR_NOME.exec(linha);
  if (!m) continue;
  const nome = `${m[1]}_${m[2]}`;
  if (tamanhoPorNome.has(nome)) nomesComMaisDeUmTamanho.add(nome);
  tamanhoPorNome.set(nome, parseInt(m[3], 10));
}

// --- 3. PacketStructure.js: os pacotes de SAÍDA, lidos do build() --------
//
// As famílias CA/CH/CZ quase não aparecem no PacketVersions — o opcode delas
// está escrito dentro do `build()`, no primeiro `writeShort`. Foi este furo que
// fez o gravador travar com "sem-tamanho" no primeiro pacote da sessão de
// 17/08: `0x0064` (CA_LOGIN) não existia em tabela nenhuma.

const CABECALHO_DE_BUILD = /^PACKET\.(\w+)\.(\w+)\.prototype\.build\s*=/;
const PKT_LEN = /^\s*(?:const|let|var)\s+pkt_len\s*=\s*([0-9+\s*]+);/;
const WRITE_SHORT = /writeShort\(\s*(0x[0-9a-fA-F]+)\s*\)/;

let dentroDe = null;
let lenDoBuild = null;
let buildsLidos = 0;

for (const linha of estruturaJs.split('\n')) {
  const cab = CABECALHO_DE_BUILD.exec(linha);
  if (cab) {
    dentroDe = { familia: cab[1], nome: cab[2] };
    lenDoBuild = null;
    continue;
  }
  if (!dentroDe) continue;

  const len = PKT_LEN.exec(linha);
  if (len) {
    // Só soma/multiplicação de literais. Qualquer variável no meio e o regex
    // não casa — nesse caso o tamanho fica nulo em vez de inventado.
    const expr = len[1].trim();
    if (/^[0-9+\s*]+$/.test(expr)) {
      // eslint-disable-next-line no-new-func
      lenDoBuild = Function(`"use strict";return (${expr});`)();
    }
    continue;
  }

  const ws = WRITE_SHORT.exec(linha);
  if (ws) {
    const opcode = parseInt(ws[1], 16);
    const nome = `${dentroDe.familia}_${dentroDe.nome}`;
    // O `.size` declarado ganha do pkt_len quando existe (é o que o cliente usa
    // para pacote de tamanho variável, com -1).
    const tamanho = tamanhoPorNome.has(nome) ? tamanhoPorNome.get(nome) : (lenDoBuild ?? null);
    registrar(dentroDe.familia, dentroDe.nome, opcode, tamanho, null, true);
    buildsLidos++;
    dentroDe = null; // só o PRIMEIRO writeShort do build é o opcode
  }
}

// --- 3.5. rAthena: o tamanho declarado por QUEM ENVIA --------------------
//
// Sobram pacotes de entrada sem tamanho porque o cliente não declara `.size`
// para todos — ele resolve alguns lendo até o fim do bloco. O gravador não tem
// esse luxo: sem tamanho, não acha a fronteira seguinte e para de fatiar (foi o
// que aconteceu no `ZC_SPRITE_CHANGE2`, pacote 41 da sessão de 17/08).
//
// A fonte certa para isso é o SERVIDOR, que é quem monta o pacote:
// `rathena/src/map/clif_packetdb.hpp` tem 601 linhas `packet(0xNNNN, tamanho)`,
// e lá `packet(0x01d7,11)` responde exatamente o que faltava.
//
// RESSALVA HONESTA: aquele arquivo é C com `#if PACKETVER >= ...`, e este leitor
// NÃO passa pelo pré-processador — lê todas as linhas. Por isso é usado só como
// RESERVA, onde a tabela do cliente não tem nada, e cada divergência entre
// declarações do mesmo opcode fica registrada em `conflitosNoRathena`. Preencher
// um vazio com o número do servidor é seguro; sobrescrever o número do cliente
// com ele não seria.

/*
 * ONDE O rATHENA MORA — e as DUAS razões de a reserva ter ficado morta (D-487).
 *
 * 1. **O caminho apontava para dentro deste repositório** (`rathena/src/map/…`),
 *    e o emulador mora no repositório do jogo, ao lado. O arquivo nunca existiu
 *    aqui, o `existsSync` pulava, e a reserva contribuía **zero** — em silêncio,
 *    porque pular não é erro.
 *
 * 2. **A regex era `^\s*packet\(`**, e o rAthena declara com DUAS formas:
 *    `packet(0xNNNN, N)` (609 linhas) e `parseable_packet(0xNNNN, N, handler…)`
 *    (**767** linhas). `parseable_packet` é exatamente como ele declara o que o
 *    CLIENTE ENVIA — ou seja, a reserva ignorava mais da metade das
 *    declarações, e justo a metade do sentido c2s.
 *
 * Efeito medido antes do conserto, sobre as 125 sessões gravadas: o s2c fatiava
 * **100,0%** dos bytes e o c2s **18,9%** — 12 conexões travadas em três opcodes
 * (`0x00bb` map, `0x0187` e `0x0360` char). Quatro quintos do que o cliente
 * mandou eram invisíveis, e qualquer contagem de "o cliente nunca enviou X"
 * saía de um fatiador que tinha parado no começo.
 *
 * `RAG_EMULADOR` é a mesma variável que o repositório do jogo usa
 * (`tools/caminhos.ts`, D-266); o padrão é o caminho relativo de sempre.
 */
const RAIZ_DO_EMULADOR =
	process.env.RAG_EMULADOR ?? path.resolve(RAIZ, '..', 'Rag Idle 2.0', 'Emulador-Serverside Ravena');
const CAMINHO_DO_PACKETDB = path.join(RAIZ_DO_EMULADOR, 'src/map/clif_packetdb.hpp');
const PACOTE_DO_RATHENA = /^\s*(?:parseable_)?packet\(\s*(0x[0-9a-fA-F]+)\s*,\s*(-?\d+)/;

const tamanhoNoRathena = new Map();
const conflitosNoRathena = [];
let preenchidosPeloRathena = 0;

if (!fs.existsSync(CAMINHO_DO_PACKETDB)) {
	// AVISO ALTO, e não silêncio: a reserva morta não quebra nada visivelmente —
	// ela só deixa o fatiador parar mais cedo, e o sintoma chega como "o pacote
	// não apareceu". Foi assim que ela ficou morta sem ninguém notar.
	console.warn(
		`[oraculo] AVISO: a reserva do rAthena NAO foi lida — ${CAMINHO_DO_PACKETDB} nao existe.\n` +
			'          A tabela sai so com o que o cliente declara, e o sentido c2s fica\n' +
			'          incompleto. Aponte RAG_EMULADOR para a raiz do emulador.'
	);
} else {
  for (const linha of fs.readFileSync(CAMINHO_DO_PACKETDB, 'utf8').split('\n')) {
    const m = PACOTE_DO_RATHENA.exec(linha);
    if (!m) continue;
    const opcode = parseInt(m[1], 16);
    const tamanho = parseInt(m[2], 10);
    if (tamanhoNoRathena.has(opcode) && tamanhoNoRathena.get(opcode) !== tamanho) {
      conflitosNoRathena.push({
        opcode: '0x' + opcode.toString(16).padStart(4, '0'),
        de: tamanhoNoRathena.get(opcode),
        para: tamanho
      });
    }
    tamanhoNoRathena.set(opcode, tamanho);
  }
}

// O PREENCHIMENTO acontece no passo 5, depois do PacketRegister — a maioria dos
// opcodes de entrada só ENTRA na tabela lá, e preencher antes não encontrava
// ninguém para preencher (medido: "0 vazios preenchidos" na primeira tentativa).

// --- 3.6. Exceções: tamanhos que o cliente declara por EXPRESSÃO ---------
//
// O extrator de `.size` casa `= <número>;`. Alguns pacotes declaram o tamanho
// com um ternário dependente de versão, e para esses o regex não casa nada —
// eles saem sem tamanho e o fatiador para neles.
//
// Em vez de complicar o extrator (avaliar expressão de outro arquivo é pedir
// para errar em silêncio), a exceção é declarada aqui, à mão, COM a conta.
// Cada entrada tem que dizer de onde saiu.

const EXCECOES = [
  {
    opcode: 0x09a0,
    servidor: 'char',
    sentido: 'entrada',
    tamanho: 6,
    // `PacketStructure.js:11562`:
    //   PACKETVER.value >= 20151001 && PACKETVER.value < 20180103 ? 10 : 6
    // 20211103 cai no `: 6`. Confirmado por
    // `packets2021_len_main.js` (length_list[0x09a0] = 6).
    porque: 'PacketStructure.js:11562 (ternario por versao); 20211103 -> 6'
  },
  {
    opcode: 0x0b6f,
    servidor: 'char',
    sentido: 'entrada',
    tamanho: 177,
    // O cliente declara `.size = 0` para este pacote (`PacketStructure.js:15235`
    // e seguintes), porque resolve o comprimento pela tabela de tamanhos e não
    // pela struct. O valor real vem de lá: `packets2021_len_main.js`,
    // `length_list[0x0b6f] = 177` — que é 2 + os 175 do bloco de personagem
    // deste packetver. Conferido chamando `init(20211103)` na própria tabela.
    porque: 'packets2021_len_main.js init(20211103) -> length_list[0x0b6f] = 177'
  },
  {
    opcode: 0x01d7,
    servidor: 'map',
    sentido: 'entrada',
    tamanho: 15,
    /*
     * A RESERVA DO rATHENA MENTIU AQUI, e este é o caso que justifica a
     * ressalva inteira sobre ela.
     *
     * `clif_packetdb.hpp:226` declara `packet(0x01d7,11)` — o tamanho de ANTES
     * de 2018. A struct de verdade, em `packets_struct.hpp:2591-2603`, para
     * `PACKETVER_RE_NUM >= 20180704` (o nosso caso), é
     * `int16 + uint32 + uint8 + uint32 + uint32` = **15 bytes**.
     *
     * Os 4 bytes de diferença jogavam o fatiador para dentro do pacote
     * seguinte: a captura do M0 parava no pacote 41, com 686 de 2.451 bytes
     * consumidos, e TUDO o que vinha depois — inclusive o
     * `ZC_NOTIFY_STANDENTRY11` que monta o avatar — ficava invisível.
     * Passamos a achar que o oráculo não mandava aquilo.
     */
    porque: 'rathena/src/map/packets_struct.hpp:2591-2603 (RE >= 20180704) = 15; o clif_packetdb declara 11, que e pre-2018'
  },
  {
    opcode: 0x0187,
    servidor: 'char',
    sentido: 'saida',
    nome: 'CH_PING',
    tamanho: 6,
    /*
     * O KEEPALIVE DO CLIENTE NA TELA DE PERSONAGENS, a cada 10 s.
     *
     * Ele nao entra por nenhuma das rotas automaticas: o rAthena o declara com
     * `packet(0x0187,6)` e nao com `parseable_packet`, entao o passo 5.2 nao o
     * alcanca; e a convencao de nome do cliente o classifica como `HC_PING`
     * (host->client), que o poe na ENTRADA — quando o trafego real e o
     * contrario. As duas fontes automaticas erram o sentido pelo mesmo motivo:
     * o nome mente sobre a direcao.
     *
     * O servidor do jogo ja o declara certo, com o mesmo tamanho:
     * `servidor/protocolo/pacotes-char.ts:287-294` (`CH_PING`, opcode 0x0187,
     * `sentido: 'entra'`, `campo.u32('contaId')`), citando
     * `packets2021_len_main.js (0x0187 = 6)`.
     *
     * Sem esta entrada, TRES conexoes de char das capturas travavam o
     * fatiamento c2s no primeiro keepalive.
     */
    porque: 'packets2021_len_main.js (0x0187 = 6); o rathena o declara com packet() e o cliente o classifica como HC_ (entrada), mas o trafego e c2s — ver servidor/protocolo/pacotes-char.ts:287-294'
  },
  {
    opcode: 0x08e2,
    servidor: 'map',
    sentido: 'entrada',
    nome: 'ZC_NAVIGATION_ACTIVE',
    tamanho: 27,
    /*
     * Nao esta no `PacketVersions` nem no `PacketRegister` do cliente, e o
     * `clif_packetdb.hpp` do emulador nao o declara — mas a TABELA DE
     * COMPRIMENTO do cliente, que e a autoridade de tamanho deste projeto, tem
     * `length_list[0x08e2] = 27`. O repositorio do jogo ja o carrega assim:
     * `servidor/protocolo/tamanhos-do-cliente.ts:948` -> `[0x08e2, 27]`.
     *
     * Era a ultima travada s2c das capturas (baseline-m0/03-map).
     */
    porque: 'packets2021_len_main.js length_list[0x08e2] = 27; espelhado em servidor/protocolo/tamanhos-do-cliente.ts:948'
  },
  {
    opcode: 0x0af4,
    servidor: 'map',
    sentido: 'saida',
    nome: 'CZ_USE_SKILL_TOGROUND3',
    tamanho: 11,
    /*
     * O `PacketVersions` DESTE CLIENTE diz 12, e o proprio cliente envia 11.
     *
     * Esta e a segunda vez que o `PacketVersions` mente (a primeira foi o
     * `0x01d7`, acima), e desta vez a contradicao esta DENTRO do mesmo
     * repositorio. Tres fontes contra uma:
     *
     *   `PacketStructure.js:14077-14087` — o `build()`, que e o que vai ao fio:
     *       `new BinaryWriter(11)` e 2+2+2+2+2+1 = 11 bytes escritos.
     *   `packets2021_len_main.js:4297` — `length_list[0x0af4] = 11`, a tabela de
     *       runtime, que a regra de `docs/mapa-de-pacotes.md` declara AUTORIDADE
     *       de tamanho deste projeto.
     *   `clif_packetdb.hpp:1901` — `parseable_packet(0x0AF4,11,…)`, o emulador.
     *
     *   `PacketVersions.js:5903` — `[…, 0x0af4, 12, 2,4,6,8,10]`. Os offsets
     *       sao os mesmos das outras tres; so o total diverge.
     *
     * A precedencia geral do gerador (`PacketVersions` ganha do `build()`) esta
     * CERTA e continua — ela existe por causa do `CZ_ENTER2`, cujo `pkt_len`
     * literal ignora um `+= 4` logo abaixo. Aqui o `build()` nao tem `if`
     * nenhum: o 11 esta cravado no construtor do buffer.
     *
     * Achado por `servidor/protocolo/oraculo-conhece-o-que-recebemos.test.ts`,
     * na primeira corrida dele.
     */
    porque: 'PacketStructure.js:14077-14087 (new BinaryWriter(11)) + packets2021_len_main.js:4297 (=11) + clif_packetdb.hpp:1901 (=11); o PacketVersions.js:5903 diz 12 e e o unico'
  }
];

// A aplicação acontece no passo 5, junto com a reserva do rAthena: a maioria
// destes opcodes só ENTRA na tabela no passo 4, e preencher antes não acharia
// ninguém — o mesmo erro de ordem que a reserva já cometeu uma vez.

// --- 4. PacketRegister.js: nome para o que entra e ficou sem tabela ------

const REGISTRO = /^\s*(0x[0-9a-fA-F]+)\s*:\s*PACKET\.(\w+)\.(\w+)/;

for (const linha of registerJs.split('\n')) {
  const m = REGISTRO.exec(linha);
  if (!m) continue;

  const familia = m[2];
  const onde = classificar(familia);
  if (!onde) {
    semSentido.add(`${familia}_${m[3]}`);
    continue;
  }

  const opcode = parseInt(m[1], 16);
  const alvo = tabelas[onde.servidor][onde.sentido];
  if (alvo.has(opcode)) continue;

  const nome = `${familia}_${m[3]}`;
  alvo.set(opcode, { nome, tamanho: tamanhoPorNome.has(nome) ? tamanhoPorNome.get(nome) : null, desde: null });
}

// --- 5. Preenche os vazios com o tamanho declarado pelo rAthena ----------
// Só onde FALTA, e só na ENTRADA: é o tamanho do que o servidor manda.

for (const servidor of ['login', 'char', 'map']) {
  for (const [opcode, dados] of tabelas[servidor].entrada) {
    if (dados.tamanho !== null) continue;
    if (!tamanhoNoRathena.has(opcode)) continue;
    dados.tamanho = tamanhoNoRathena.get(opcode);
    dados.fonteDoTamanho = 'rathena';
    preenchidosPeloRathena++;
  }
}

/*
 * --- 5.2. O SENTIDO c2s: ADICIONAR, e não só preencher (D-487) ------------
 *
 * O passo acima só toca entradas que JÁ EXISTEM na tabela. Os três opcodes que
 * travavam o fatiamento c2s não existiam nela de jeito nenhum — `0x00bb` (map),
 * `0x0187` e `0x0360` (char) saíam `undefined` no `saida` dos três servidores.
 * Preencher tamanho nunca ia alcançá-los.
 *
 * `parseable_packet(0xNNNN, tamanho, handler, …)` é, na definição do rAthena, o
 * que o servidor LÊ DO CLIENTE — exatamente o `saida` do gravador. São 767
 * linhas, contra 609 de `packet(…)`, e nenhuma delas entrava aqui.
 *
 * **Por que ADICIONAR em vez de preencher é seguro aqui, e não seria na
 * entrada:** uma entrada ausente no `saida` faz o fatiador TRAVAR e abandonar a
 * conexão inteira. Qualquer tamanho declarado, mesmo o de outro servidor, é
 * melhor do que isso — e um tamanho errado não passa despercebido: ele desalinha
 * o fatiamento e a cobertura despenca, que é justamente o que esta medição
 * mostra. O risco real é o inverso: **sobrescrever** o que o cliente declara,
 * e isso continua proibido (`if (alvo.has(opcode)) continue`).
 *
 * Vale nos TRÊS servidores porque o keepalive do mapa VAZA para o socket de
 * char durante a seleção de personagem — não é hipótese, é D-340, medido
 * jogando em 18/08, e é literalmente o `0x0360` desta lista.
 */
const PARSEABLE_DO_RATHENA = /^\s*parseable_packet\(\s*(0x[0-9a-fA-F]+)\s*,\s*(-?\d+)\s*,\s*(\w+)/;
let adicionadosNoC2s = 0;

if (fs.existsSync(CAMINHO_DO_PACKETDB)) {
  const doCliente = new Map();
  for (const linha of fs.readFileSync(CAMINHO_DO_PACKETDB, 'utf8').split('\n')) {
    const m = PARSEABLE_DO_RATHENA.exec(linha);
    if (!m) continue;
    // A ÚLTIMA declaração vence, como no arquivo: as guardas de PACKETVER que
    // este leitor não avalia põem a mais recente por último.
    doCliente.set(parseInt(m[1], 16), { tamanho: parseInt(m[2], 10), handler: m[3] });
  }
  for (const servidor of ['login', 'char', 'map']) {
    const alvo = tabelas[servidor].saida;
    for (const [opcode, { tamanho, handler }] of doCliente) {
      if (alvo.has(opcode)) continue;
      alvo.set(opcode, { nome: handler, tamanho, desde: null, fonteDoTamanho: 'rathena (parseable)' });
      adicionadosNoC2s++;
    }
  }
}

/*
 * --- 5.5. A TABELA DE COMPRIMENTO DO PROPRIO CLIENTE ---------------------
 *
 * ISTO NAO EXISTIA, E A AUSENCIA CUSTOU UMA RODADA INTEIRA DE AUDITORIA.
 *
 * Os passos acima derivam o tamanho da STRUCT (`PacketStructure.js`). Pacote de
 * comprimento VARIAVEL nao tem struct de tamanho fixo, entao ele saia daqui com
 * `tamanho: null` — e `null` faz o gravador declarar `travado = true` e
 * ABANDONAR o sentido inteiro daquela conexao. Sem barulho.
 *
 * O estrago medido (varredura de habilidades, rodada 3, achado 7): a tabela
 * congelada em 17/08 nao conhecia a faixa RAGIDLE, o gravador parava no PRIMEIRO
 * pacote NOSSO, e **87% dos bytes servidor->cliente nunca entraram no `.jsonl`**.
 * Foi desse arquivo truncado que saiu o censo "ZERO `ZC_USESKILL_ACK2`, ZERO
 * EFST" citado em `docs/varredura-habilidades-21-08-2026-B.md` — um instrumento
 * quebrado virando evidencia de AUSENCIA, que e o pior modo de falha que uma
 * medicao tem.
 *
 * A fonte certa e a que o proprio cliente usa em runtime: `PacketLength.js`
 * escolhe UM `packets<ANO>_len_main.js` pelo packetver e chama `init()`. Aqui
 * fazemos a mesma escolha, com a mesma lista de anos — e e por isso que a faixa
 * RAGIDLE entra sozinha: ela ja esta declarada la (`length_list[0x0ffa] = -1`).
 *
 * SO PREENCHE O QUE FALTA, nunca sobrescreve. A struct e mais confiavel quando
 * existe — a excecao do `0x01d7` abaixo e a prova de que a outra fonte pode
 * mentir. E divergencia entre as duas fica REGISTRADA em vez de escolhida em
 * silencio.
 */

const ANOS_DO_CLIENTE = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010,
  2009, 2008, 2007, 2006, 2005, 2004, 2003,
];
const anoDoPacketver = ANOS_DO_CLIENTE.find((a) => PACKETVER >= a * 10000) ?? 2003;
const arquivoDeComprimentos = `src/Network/Packets/packets${anoDoPacketver}_len_main.js`;

let comprimentosDoCliente = [];
let preenchidosPeloCliente = 0;
const divergenciasDeComprimento = [];
try {
  // `pathToFileURL`, e nao string: no Windows um caminho absoluto (`c:\...`)
  // chega ao carregador ESM como se `c:` fosse um esquema de URL.
  const modulo = await import(pathToFileURL(path.join(RAIZ, arquivoDeComprimentos)).href);
  const init = (modulo.default ?? modulo).init;
  comprimentosDoCliente = typeof init === 'function' ? init(PACKETVER) : [];
} catch (erro) {
  // Falhar ALTO: sem esta tabela o gravador volta a ficar surdo, e a captura
  // seguinte pareceria so "vazia". O erro diz o que fazer.
  throw new Error(
    `nao consegui ler ${arquivoDeComprimentos} (a tabela de comprimento do cliente). ` +
      `Sem ela todo pacote de tamanho VARIAVEL sai sem tamanho e o gravador abandona ` +
      `a conexao em silencio. Causa: ${erro instanceof Error ? erro.message : String(erro)}`,
  );
}

for (const servidor of ['login', 'char', 'map']) {
  for (const sentido of ['entrada', 'saida']) {
    for (const [opcode, dados] of tabelas[servidor][sentido]) {
      const doCliente = comprimentosDoCliente[opcode];
      if (doCliente === undefined) continue;
      /*
       * `null` E `0`, e o zero e o mais perigoso dos dois.
       *
       * O cliente escreve `.size = 0` para o pacote cujo comprimento ele resolve
       * por ESTA tabela e nao pela struct (`HC_ACCEPT_MAKECHAR`,
       * `ZC_REQ_WEAR_EQUIP_ACK`). Zero nao e "desconhecido": o gravador tem uma
       * guarda dedicada a ele (`gravador-de-pacotes.js`, "TAMANHO ZERO NAO E
       * TAMANHO") porque `subarray(0)` dentro de um `while` nao consome nada e
       * empilha o mesmo pacote ate a memoria acabar.
       *
       * Preencher o zero daqui e tirar o alcapao da frente em vez de continuar
       * caindo nele com elegancia — a fonte e a MESMA que o cliente consulta
       * quando ve zero.
       */
      if (dados.tamanho === null || dados.tamanho === 0) {
        dados.tamanho = doCliente;
        dados.fonteDoTamanho = 'cliente';
        preenchidosPeloCliente++;
      } else if (dados.tamanho !== doCliente) {
        /*
         * NA DIVERGENCIA, O CLIENTE VENCE (27/08/2026, auditoria).
         *
         * Ate aqui a divergencia era apenas REGISTRADA e o valor do rAthena
         * ficava na tabela. Isso inverte a autoridade: **o gravador fatia o
         * trafego que o CLIENTE enquadra**, e quem decide onde um pacote acaba
         * naquele fluxo e `PacketLength.getPacketLength`
         * (`src/Network/NetworkManager.js:266`), que le exatamente
         * `comprimentosDoCliente`. O tamanho da struct do emulador descreve o
         * que o emulador MANDARIA — outra pergunta.
         *
         * O caso que custou: `0x0add` (ZC_ITEM_FALL_ENTRY3, o item caindo no
         * chao) ficou com **22** do rAthena contra **24** do cliente. Dois
         * bytes a menos por item que cai, e o fatiador nao erra so aquele
         * pacote: ele perde o alinhamento e **abandona a sessao inteira dali
         * em diante**. Como todo mob dropa, isso acontecia no primeiro abate —
         * e as 125 sessoes gravadas sao a unica evidencia EXECUTADA que este
         * projeto tem.
         *
         * A divergencia continua sendo REGISTRADA (o array abaixo alimenta o
         * relatorio): saber que os dois discordam vale, e escolher o lado certo
         * tambem. As EXCECOES manuais rodam depois daqui e continuam vencendo
         * as duas — e o lugar certo para uma decisao caso a caso.
         */
        divergenciasDeComprimento.push({
          opcode: '0x' + opcode.toString(16).padStart(4, '0'),
          nome: dados.nome,
          servidor,
          sentido,
          struct: dados.tamanho,
          cliente: doCliente,
        });
        dados.tamanho = doCliente;
        dados.fonteDoTamanho = 'cliente (venceu a struct do rathena)';
      }
    }
  }
}

let preenchidosPorExcecao = 0;
let sobrescritosPorExcecao = 0;
for (const e of EXCECOES) {
  const atual = tabelas[e.servidor][e.sentido].get(e.opcode);

  /*
   * A EXCEÇÃO TAMBÉM CRIA, e não só preenche (D-487).
   *
   * Até 22/08/2026 ela desistia calada quando o opcode não existia na tabela
   * daquele sentido — e "não existe" é justamente o caso mais grave, porque o
   * fatiador TRAVA e abandona a conexão inteira, em vez de errar um campo.
   *
   * Toda exceção que cria precisa de `nome`: sem ele o pacote entraria na
   * tabela como `undefined` e o censo o contaria por opcode cru.
   */
  if (!atual) {
    if (!e.nome) continue;
    tabelas[e.servidor][e.sentido].set(e.opcode, {
      nome: e.nome,
      tamanho: e.tamanho,
      desde: null,
      fonteDoTamanho: 'excecao',
      porque: e.porque
    });
    preenchidosPorExcecao++;
    continue;
  }
  // Vale para tamanho ausente, para tamanho ZERO ("resolvo isto noutro lugar"),
  // para tamanho vindo da RESERVA do rAthena e para o da TABELA DO CLIENTE —
  // as duas sao palpite bom, nao verdade: a excecao e escrita a mao com a
  // conta, entao ela ganha.
  //
  // `'cliente'` entrou aqui depois de o passo 5.5 nascer e ROUBAR duas das tres
  // excecoes ("1 de 3 aplicadas"): ele preenche antes, e sem esta clausula a
  // excecao encontrava o campo ja ocupado e desistia calada. E a excecao do
  // `0x01d7` existe exatamente porque a outra fonte mente.
  /*
   * A EXCEÇÃO GANHA DE TODA FONTE AUTOMÁTICA, inclusive do `PacketVersions`
   * (D-487). O comentário acima já dizia *"a exceção é escrita à mão com a
   * conta, então ela ganha"* — e a condição não implementava isso: um valor
   * vindo do `PacketVersions` (que tem `desde` preenchido e nenhum
   * `fonteDoTamanho`) não casava em nenhuma das quatro cláusulas, e a exceção
   * desistia calada.
   *
   * Não é hipótese: `0x0af4` diverge exatamente assim, e o `PacketVersions` é a
   * fonte errada nas duas vezes em que este arquivo precisou de exceção.
   *
   * O que protege contra abuso é o formulário, não a condição: toda entrada de
   * `EXCECOES` carrega `porque`, com `arquivo:linha` das fontes que a
   * sustentam, e ele viaja para o `opcodes.json`.
   */
  if (atual) {
    if (atual.tamanho !== e.tamanho) sobrescritosPorExcecao++;
    atual.tamanho = e.tamanho;
    atual.fonteDoTamanho = 'excecao';
    atual.porque = e.porque;
    preenchidosPorExcecao++;
  }
}

// --- 6. Grava ------------------------------------------------------------

function paraObjeto(mapa) {
  const o = {};
  for (const [opcode, dados] of [...mapa.entries()].sort((a, b) => a[0] - b[0])) {
    o['0x' + opcode.toString(16).padStart(4, '0')] = dados;
  }
  return o;
}

const contarSemTamanho = (m) => [...m.values()].filter((v) => v.tamanho === null).length;

const resumo = {};
for (const servidor of Object.keys(tabelas)) {
  resumo[servidor] = {
    entrada: { total: tabelas[servidor].entrada.size, semTamanho: contarSemTamanho(tabelas[servidor].entrada) },
    saida: { total: tabelas[servidor].saida.size, semTamanho: contarSemTamanho(tabelas[servidor].saida) },
  };
}

const saidaJson = {
  packetver: PACKETVER,
  geradoPor: 'oraculo/gerar-tabela-de-opcodes.mjs',
  fontes: [
    'src/Network/PacketVersions.js',
    'src/Network/PacketStructure.js',
    'src/Network/PacketRegister.js',
    arquivoDeComprimentos,
  ],
  resumo,
  // A tabela de comprimento do PROPRIO cliente (a mesma que `PacketLength.js`
  // usa em runtime). Ela e quem traz os pacotes de tamanho VARIAVEL (-1) —
  // inclusive a faixa RAGIDLE. Sem ela o gravador abandona a conexao calado.
  comprimentosDoCliente: {
    arquivo: arquivoDeComprimentos,
    declarados: comprimentosDoCliente.filter((x) => x !== undefined).length,
    preencheram: preenchidosPeloCliente,
    // Struct e tabela discordando. A struct GANHA (ver a excecao do 0x01d7),
    // mas a divergencia fica escrita: e o primeiro suspeito de fatiamento torto.
    divergencias: divergenciasDeComprimento,
  },
  // Nomes com `.size` atribuído mais de uma vez (atribuição dependente de
  // versão): vale a última do arquivo, que pode não ser a de runtime. Ficam
  // declarados para serem os primeiros suspeitos quando um fatiamento sair torto.
  nomesComMaisDeUmTamanho: [...nomesComMaisDeUmTamanho].sort(),
  rathena: {
    arquivo: 'rathena/src/map/clif_packetdb.hpp',
    lido: fs.existsSync(CAMINHO_DO_PACKETDB),
    declarados: tamanhoNoRathena.size,
    preencheram: preenchidosPeloRathena,
    // Quantas entradas o `parseable_packet` ADICIONOU ao sentido c2s (D-487).
    adicionadosNoC2s,
    // Mesmo opcode com tamanhos diferentes no arquivo (guardas de PACKETVER que
    // este leitor não avalia). Primeiros suspeitos de fatiamento torto.
    conflitos: conflitosNoRathena
  },
  // Famílias fora da convenção <origem><destino>: não classificadas.
  semSentido: [...semSentido].sort(),
  tabelas: {
    login: { entrada: paraObjeto(tabelas.login.entrada), saida: paraObjeto(tabelas.login.saida) },
    char: { entrada: paraObjeto(tabelas.char.entrada), saida: paraObjeto(tabelas.char.saida) },
    map: { entrada: paraObjeto(tabelas.map.entrada), saida: paraObjeto(tabelas.map.saida) },
  },
};

const destino = path.join(AQUI, 'opcodes.json');
fs.writeFileSync(destino, JSON.stringify(saidaJson, null, '\t') + '\n');

console.log(`packetver                 ${PACKETVER}`);
console.log(`versoes no PacketVersions ${versoesLidas} (aplicadas: ${versoesAplicadas})`);
console.log(`builds de saida lidos     ${buildsLidos}`);
for (const s of ['login', 'char', 'map']) {
  const r = resumo[s];
  console.log(
    `${s.padEnd(6)} entrada ${String(r.entrada.total).padStart(4)} (${r.entrada.semTamanho} s/tam) · ` +
      `saida ${String(r.saida.total).padStart(4)} (${r.saida.semTamanho} s/tam)`,
  );
}
console.log(
  `rathena (reserva)         ${tamanhoNoRathena.size} declarados, ${adicionadosNoC2s} adicionados no c2s, ` +
    `${preenchidosPeloRathena} vazios preenchidos, ${conflitosNoRathena.length} conflitos`
);
console.log(
  `tabela do cliente         ${arquivoDeComprimentos} — ` +
    `${comprimentosDoCliente.filter((x) => x !== undefined).length} declarados, ` +
    `${preenchidosPeloCliente} vazios preenchidos, ${divergenciasDeComprimento.length} divergencias`,
);
console.log(`excecoes a mao            ${preenchidosPorExcecao} de ${EXCECOES.length} aplicadas (${sobrescritosPorExcecao} sobrescreveram fonte automatica)`);
if (semSentido.size) console.log(`familias nao classificadas: ${[...semSentido].join(', ')}`);
console.log(`gravado em                ${path.relative(RAIZ, destino)}`);
