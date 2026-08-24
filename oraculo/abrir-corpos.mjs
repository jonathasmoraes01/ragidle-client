/**
 * Abre o CORPO dos pacotes gravados — e não só conta o opcode.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO EXISTE (D-485)
 * ---------------------------------------------------------------------------
 * O crítico de completude da rodada 3 nomeou a modalidade que ninguém usou:
 *
 * > *"Uma das nove áreas tocou as 125 sessões. As outras oito fizeram afirmação
 * > de fio por leitura de código. Pior: a área que as usou **contou opcodes e
 * > nunca abriu um campo**. A regra é 'abra o corpo', não 'conte o opcode'."*
 *
 * Contar opcode responde *"o pacote saiu?"*. Abrir o corpo responde *"ele saiu
 * com o que deveria?"* — e foi assim que o próprio crítico derrubou uma
 * afirmação da rodada (as 51 `ZC_NOTIFY_SKILL2` que "saem todas do cérebro
 * idle": 37 têm GID de MOB).
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE LÊ, E POR QUE ESSES
 * ---------------------------------------------------------------------------
 * - `ZC_COUPLESTATUS` (0x00bd/0x0141): o maior volume nunca inspecionado. Ele
 *   carrega os atributos da janela de Status, e é onde um bônus que não
 *   atravessa aparece como zero.
 * - `ZC_NOTIFY_SKILL2` (0x01de): o `alvoId` dos casts de MOB — o achado 13
 *   (buff de mob mirando o jogador) precisa dele para sair do papel.
 * - `ZC_NOTIFY_MONSTER_HP` (0x0977): as subidas de HP, que D-474 pôs no fio.
 *
 * ---------------------------------------------------------------------------
 * A COBERTURA VEM ANTES DE QUALQUER CONTAGEM
 * ---------------------------------------------------------------------------
 * Uma contagem ZERO só quer dizer *"não aconteceu"* se os bytes viraram pacote.
 * Se o fatiador travou no meio, tudo depois dele fica invisível e o zero quer
 * dizer *"não foi fatiado"* — que é o alçapão de D-464. Por isso a primeira
 * linha da saída é a fração dos bytes fatiados, e as conclusões vêm depois
 * dela.
 *
 * Uso:  node oraculo/abrir-corpos.mjs [sessao]
 *       node oraculo/abrir-corpos.mjs --todas
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Fatiador, carregarTabela } from './fatiador.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TABELA = carregarTabela();
const RAIZ = path.join(AQUI, 'capturas');

/** O GID a partir do qual um id é de MOB (`servidor/mapa/servidor-mapa.ts`). */
const GID_BASE_DOS_MOBS = 3_000_000;

/*
 * OS DESLOCAMENTOS DE CAMPO, NUMA TABELA — e não espalhados pelo laço (D-485).
 *
 * Isto é uma SEGUNDA rota: os campos verdadeiros são declarados em
 * `servidor/protocolo/pacotes-mapa.ts`, e aqui eles são reescritos à mão. Esse é
 * o defeito mais frequente deste projeto, e ele já cobrou o preço nesta mesma
 * ferramenta: `ZC_COUPLESTATUS` tem o atributo como **long**, foi lido como
 * word, e os três campos saíram 2 bytes deslocados. O sintoma não foi erro —
 * foi um dado plausível: `base` vinha 65536, 131072, 196608, todos múltiplos de
 * 0x10000, porque o valor verdadeiro estava deslocado 16 bits.
 *
 * A tabela existe para que a segunda rota seja **conferível**: um teste do
 * repositório principal (`servidor/protocolo/leitor-de-corpos-confere.test.ts`)
 * lê estes números e os compara com a soma dos campos declarados. Espalhados
 * pelo laço, eles não teriam como ser conferidos por nada.
 *
 * O `de` é o deslocamento em bytes desde o começo do pacote (opcode incluído).
 */
const CAMPOS = {
	ZC_COUPLESTATUS: { opcode: 0x0141, tamanho: 14, de: { atributo: 2, base: 6, bonus: 10 } },
	ZC_NOTIFY_SKILL2: { opcode: 0x01de, tamanho: 33, de: { skillId: 2, id: 4, alvoId: 8 } },
	ZC_NOTIFY_MONSTER_HP: { opcode: 0x0977, tamanho: 14, de: { id: 2, hp: 6, hpMaximo: 10 } },
	ZC_NOTIFY_VANISH: { opcode: 0x0080, tamanho: 7, de: { id: 2, tipo: 6 } },
	// Variável: o cabeçalho tem 4 bytes (opcode + comprimento), não 2.
	ZC_NOTIFY_STANDENTRY11: { opcode: 0x09ff, tamanho: -1, de: { tipoDeObjeto: 4, id: 5 } },
};

const pedido = process.argv[2] ?? '--todas';
const SESSOES =
	pedido === '--todas'
		? fs
				.readdirSync(RAIZ, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name)
		: [pedido];

/**
 * QUAL servidor falou. Não é enfeite: o opcode só identifica o pacote DENTRO de
 * um servidor (`0x0064` é `CA_LOGIN` no login e `CZ_REQ_OPEN_WRITE_MAIL` no
 * map), então é isto que escolhe a tabela.
 *
 * O nome do arquivo é a etiqueta da conexão: `01-login.s2c.bin`, `03-map…`. A
 * primeira versão disto tentava extrair a PORTA do nome (`/-(\d+)\./`), e o
 * nome não tem porta nenhuma: a regex não casava, a porta virava 0, e o
 * fallback era a string `'mapa'` — que não existe na tabela, cuja chave é
 * `'map'`. Resultado: `descreverOpcode` devolvia null no PRIMEIRO opcode de
 * cada arquivo, o fatiador travava, e a saída dizia **0,0% de cobertura e zero
 * de tudo**, em 127 arquivos com 8,7 MB de tráfego real.
 *
 * É a chave errada dando zero pela enésima vez neste projeto, e o motivo de
 * este ramo **lançar** em vez de escolher um padrão: um servidor adivinhado
 * errado não dá erro, dá silêncio.
 */
function servidorDoArquivo(arquivo) {
	const etiqueta = arquivo.replace(/\.s2c\.bin$/, '');
	const sufixo = etiqueta.slice(etiqueta.indexOf('-') + 1);
	if (!TABELA.tabelas[sufixo]) {
		throw new Error(
			`"${arquivo}": nao sei qual servidor e "${sufixo}". ` +
				`A tabela conhece: ${Object.keys(TABELA.tabelas).join(', ')}.`,
		);
	}
	return sufixo;
}

/**
 * Percorre a PASTA, e não o `indice.json` — a lição de D-455: o índice é
 * reescrito a cada corrida e some com as sessões antigas.
 */
function arquivosDeSaida(pasta) {
	if (!fs.existsSync(pasta)) return [];
	return fs
		.readdirSync(pasta)
		.filter((f) => f.endsWith('.s2c.bin'))
		.sort();
}

const censo = new Map();
const corpos = { couple: [], skill: [], hpDeMob: [] };
/** Nascimentos e sumiços, para saber se um GID trocou de dono entre dois HPs. */
const nasceu = [];
const sumiu = [];
/** Um relógio de ORDEM, não de tempo: só serve para dizer o que veio antes. */
let eventos = 0;
let bytesTotais = 0;
let bytesFatiados = 0;
let arquivos = 0;
let travados = 0;

for (const sessao of SESSOES) {
	const pasta = path.join(RAIZ, sessao);
	for (const arquivo of arquivosDeSaida(pasta)) {
		const bytes = fs.readFileSync(path.join(pasta, arquivo));
		if (bytes.length === 0) continue;
		arquivos += 1;
		bytesTotais += bytes.length;

		const fatiador = new Fatiador(TABELA, servidorDoArquivo(arquivo), 's2c');
		for (const p of fatiador.receber(bytes)) {
			if (p.corpo === undefined) {
				travados += 1;
				continue;
			}
			bytesFatiados += p.tamanho;
			const nome = p.nome ?? `0x${p.opcode.toString(16).padStart(4, '0')}`;
			censo.set(nome, (censo.get(nome) ?? 0) + 1);
			const b = p.corpo;

			const C = CAMPOS;
			if (p.opcode === C.ZC_COUPLESTATUS.opcode && b.length >= C.ZC_COUPLESTATUS.tamanho) {
				const de = C.ZC_COUPLESTATUS.de;
				corpos.couple.push({
					tipo: b.readUInt32LE(de.atributo),
					base: b.readInt32LE(de.base),
					bonus: b.readInt32LE(de.bonus),
				});
			}
			if (p.opcode === C.ZC_NOTIFY_SKILL2.opcode && b.length >= C.ZC_NOTIFY_SKILL2.tamanho) {
				const de = C.ZC_NOTIFY_SKILL2.de;
				corpos.skill.push({
					skillId: b.readUInt16LE(de.skillId),
					src: b.readUInt32LE(de.id),
					dst: b.readUInt32LE(de.alvoId),
				});
			}
			if (p.opcode === C.ZC_NOTIFY_MONSTER_HP.opcode && b.length >= C.ZC_NOTIFY_MONSTER_HP.tamanho) {
				const de = C.ZC_NOTIFY_MONSTER_HP.de;
				corpos.hpDeMob.push({
					gid: b.readUInt32LE(de.id),
					hp: b.readInt32LE(de.hp),
					max: b.readInt32LE(de.hpMaximo),
					// A ORDEM É A EVIDÊNCIA. Sem saber se o GID renasceu entre dois
					// pacotes de HP, "o HP subiu" não distingue cura de monstro novo
					// com o mesmo id — e reúso de GID é a regra, não a exceção.
					ordem: eventos,
				});
			}
			if (p.opcode === C.ZC_NOTIFY_STANDENTRY11.opcode && b.length >= 9) {
				nasceu.push({ gid: b.readUInt32LE(C.ZC_NOTIFY_STANDENTRY11.de.id), ordem: eventos });
			}
			if (p.opcode === C.ZC_NOTIFY_VANISH.opcode && b.length >= C.ZC_NOTIFY_VANISH.tamanho) {
				sumiu.push({ gid: b.readUInt32LE(C.ZC_NOTIFY_VANISH.de.id), ordem: eventos });
			}
			eventos += 1;
		}
	}
}

const cobertura = bytesTotais === 0 ? 0 : (bytesFatiados / bytesTotais) * 100;
console.log(`sessoes: ${SESSOES.length}  ·  arquivos s2c com bytes: ${arquivos}`);
console.log(
	`COBERTURA: ${cobertura.toFixed(1)}% dos bytes viraram pacote  ` +
		`(${bytesFatiados} de ${bytesTotais}; ${travados} conexao(oes) travada(s))`,
);
console.log(
	cobertura >= 95
		? '  (>= 95%: contagem ZERO pode ser lida como "nao aconteceu")'
		: '  ATENCAO: abaixo de 95%, contagem ZERO quer dizer "nao foi fatiado" — ver D-464',
);

console.log(`\n=== ZC_COUPLESTATUS: ${corpos.couple.length} pacotes, corpo aberto ===`);
const porTipo = new Map();
for (const c of corpos.couple) {
	if (!porTipo.has(c.tipo)) porTipo.set(c.tipo, { n: 0, base: new Set(), bonus: new Set() });
	const e = porTipo.get(c.tipo);
	e.n += 1;
	e.base.add(c.base);
	e.bonus.add(c.bonus);
}
for (const [tipo, e] of [...porTipo].sort((a, b) => a[0] - b[0])) {
	const bonus = [...e.bonus];
	console.log(
		`  tipo ${String(tipo).padStart(4)}  n=${String(e.n).padStart(4)}  ` +
			`base=${[...e.base].slice(0, 6).join(',')}  bonus=${bonus.slice(0, 6).join(',')}` +
			(bonus.length === 1 && bonus[0] === 0 ? '   <- bonus SEMPRE zero' : ''),
	);
}

console.log(`\n=== ZC_NOTIFY_SKILL2: ${corpos.skill.length} pacotes ===`);
const deMob = corpos.skill.filter((s) => s.src >= GID_BASE_DOS_MOBS);
console.log(`  com CONJURADOR na faixa de mob (>= ${GID_BASE_DOS_MOBS}): ${deMob.length}`);
const porSkill = new Map();
for (const s of deMob) {
	if (!porSkill.has(s.skillId)) porSkill.set(s.skillId, { n: 0, alvoMob: 0, alvoOutro: 0 });
	const e = porSkill.get(s.skillId);
	e.n += 1;
	if (s.dst >= GID_BASE_DOS_MOBS) e.alvoMob += 1;
	else e.alvoOutro += 1;
}
for (const [skillId, e] of [...porSkill].sort((a, b) => b[1].n - a[1].n)) {
	console.log(
		`    skill ${String(skillId).padStart(4)}  n=${String(e.n).padStart(3)}  ` +
			`alvo=MOB ${e.alvoMob} · alvo=jogador/outro ${e.alvoOutro}`,
	);
}

/*
 * ZC_NOTIFY_MONSTER_HP — e a armadilha do GID REUSADO.
 *
 * "Subida de HP" comparando o mesmo GID entre dois pacotes parece medir cura, e
 * não mede: quando um monstro morre e outro nasce com o **mesmo id**, o HP volta
 * ao cheio e a comparação chama isso de subida. Por isso a subida sai partida em
 * duas, e só a que NÃO vai ao máximo é candidata a cura de verdade.
 */
console.log(`\n=== ZC_NOTIFY_MONSTER_HP: ${corpos.hpDeMob.length} pacotes ===`);
/** O GID nasceu ou sumiu entre estes dois instantes de ordem? */
function trocouDeDono(gid, de, ate) {
	return (
		nasceu.some((n) => n.gid === gid && n.ordem > de && n.ordem < ate) ||
		sumiu.some((s) => s.gid === gid && s.ordem > de && s.ordem < ate)
	);
}

let subiuAoCheio = 0;
let subiuComOutroMaximo = 0;
let subiuComGidNovo = 0;
let subiuCurando = 0;
let desceu = 0;
let igual = 0;
const ultimo = new Map();
for (const h of corpos.hpDeMob) {
	const antes = ultimo.get(h.gid);
	if (antes !== undefined) {
		if (h.hp > antes.hp) {
			// A ordem das quatro guardas importa: as tres primeiras sao os jeitos
			// de o GID ser de OUTRO monstro, e so o que sobra depois delas e cura.
			// A terceira e a decisiva — as duas primeiras sao heuristicas de
			// formato, esta e o marcador de nascimento no proprio fio.
			if (h.hp >= h.max) subiuAoCheio += 1;
			else if (h.max !== antes.max) subiuComOutroMaximo += 1;
			else if (trocouDeDono(h.gid, antes.ordem, h.ordem)) subiuComGidNovo += 1;
			else subiuCurando += 1;
		} else if (h.hp < antes.hp) desceu += 1;
		else igual += 1;
	}
	ultimo.set(h.gid, { hp: h.hp, max: h.max, ordem: h.ordem });
}
console.log(`  gids distintos: ${ultimo.size}  ·  nascimentos: ${nasceu.length}  ·  sumicos: ${sumiu.length}`);
console.log(`  descidas: ${desceu}  ·  iguais: ${igual}`);
console.log(`  subidas AO CHEIO (gid reusado, monstro novo): ${subiuAoCheio}`);
console.log(`  subidas com OUTRO maximo (gid reusado por outra especie): ${subiuComOutroMaximo}`);
console.log(`  subidas com NASCIMENTO no meio (gid reusado, mesma especie): ${subiuComGidNovo}`);
console.log(`  subidas de CURA (nada explica: mesmo maximo, sem renascer): ${subiuCurando}`);

console.log('\n=== os 12 opcodes s2c mais frequentes ===');
for (const [nome, n] of [...censo].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
	console.log(`  ${String(n).padStart(6)}  ${nome}`);
}

/*
 * A DATA DA CAPTURA É PARTE DA EVIDÊNCIA, e sem ela um zero mente.
 *
 * As sessões gravadas são do servidor DAQUELE DIA. `ZC_USE_SKILL` (0x09cb), por
 * exemplo, só passou a existir em 21/08 — contá-lo como zero numa captura de
 * 18/08 seria "provar" que habilidade sem dano não atravessa, quando o que se
 * mediu foi um servidor que ainda não a enviava.
 *
 * Por isso a última linha da saída é a faixa de datas: quem for concluir
 * ausência a partir daqui tem de comparar com a data do código.
 */
const datas = new Set();
for (const sessao of SESSOES) {
	const pasta = path.join(RAIZ, sessao);
	for (const arquivo of arquivosDeSaida(pasta)) {
		datas.add(fs.statSync(path.join(pasta, arquivo)).mtime.toISOString().slice(0, 10));
	}
}
const ordenadas = [...datas].sort();
console.log(
	`\nAS CAPTURAS SAO DE ${ordenadas[0]} a ${ordenadas[ordenadas.length - 1]}. ` +
		'Elas descrevem o servidor DAQUELE DIA — ausencia aqui nao e ausencia hoje.',
);
console.log(`  ZC_USE_SKILL (0x09cb, existe desde 21/08): ${censo.get('ZC_USE_SKILL') ?? 0}`);
