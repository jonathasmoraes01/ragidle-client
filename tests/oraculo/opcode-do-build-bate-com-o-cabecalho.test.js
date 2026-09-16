/**
 * O OPCODE QUE O `build()` ESCREVE TEM DE SER O DO CABECALHO (15/09/2026).
 *
 * Nasceu de um defeito real, achado neste dia com os 1329 testes VERDES: no
 * merge que moveu a trava de itens para `0x0fc0`/`0x0fc1` (a quarta mudanca de
 * endereco dela), a substituicao de numero pegou tambem o bloco vizinho, e o
 * `CZ_RAGIDLE_ECONOMIA_ACAO` passou a escrever `0x0fc0` - o endereco da trava.
 * O cabecalho dele dizia `0x0fc0`, o `length_list` dizia `0x0fc2`, e o
 * servidor le `0x0fc2`: o cliente pediria economia de energia e o servidor
 * ouviria "tranque um slot" com um JSON que ele nao entende.
 *
 * **Por que nada pegou:** os testes do cliente exercitam o PARSE (o que desce)
 * e a interface. O opcode escrito pelo `build()` so aparece no BYTE que sai, e
 * nenhuma prova o lia. O `PacketRegister.js` indexa por NUMERO e a ultima
 * entrada vence, entao a colisao tambem nao estoura no carregamento - morre
 * calada, que e a familia de defeito que este repositorio ja registrou tres
 * vezes com opcode.
 *
 * As tres afirmacoes, e as tres sobre o ARQUIVO DE VERDADE:
 *
 *  1. todo bloco RAGIDLE que constroi pacote escreve o opcode do proprio
 *     cabecalho;
 *  2. todo opcode de cabecalho RAGIDLE tem tamanho declarado em
 *     `packets2021_len_main.js` - declarar tamanho nao e implementar, mas NAO
 *     declarar e pacote que o codec descarta;
 *  3. dois nomes RAGIDLE diferentes nunca reivindicam o mesmo opcode.
 *
 * Cada uma tem CONTROLE POSITIVO com texto sintetico: sem ele, "zero
 * divergencias" no arquivo real nao prova que o portao consegue reprovar.
 * O piso de 60 cabecalhos e 30 construtores existe pela mesma razao - um
 * regex que deixa de casar devolve lista vazia, e lista vazia passa.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTRUTURA = fs.readFileSync(path.join(RAIZ, 'src/Network/PacketStructure.js'), 'utf8');
const TAMANHOS = fs.readFileSync(
	path.join(RAIZ, 'src/Network/Packets/packets2021_len_main.js'),
	'utf8'
);

/** `// 0xXXXX - RAGIDLE: NOME (...)` - o cabecalho de cada bloco nosso. */
const CABECALHO = /^\/\/ (0x[0-9a-f]{4}) - RAGIDLE: ((?:CZ|ZC)_RAGIDLE_[A-Z_0-9]+)/gm;

/**
 * Os blocos RAGIDLE do arquivo: do cabecalho ate o cabecalho seguinte (ou o
 * fim). O opcode escrito e o PRIMEIRO `writeShort(0x....)` do bloco - e so o
 * CZ tem um, porque quem constroi pacote e o cliente.
 */
export function blocosDeRagidle(texto) {
	const achados = [...texto.matchAll(CABECALHO)];
	return achados.map((m, i) => {
		const inicio = m.index;
		const fim = i + 1 < achados.length ? achados[i + 1].index : texto.length;
		const corpo = texto.slice(inicio, fim);
		const escrito = corpo.match(/write(?:U?Short)\((0x[0-9a-f]{4})\)/);
		return {
			nome: m[2],
			doCabecalho: m[1].toLowerCase(),
			escrito: escrito ? escrito[1].toLowerCase() : null,
		};
	});
}

/** Quem escreve um opcode diferente do que o proprio cabecalho anuncia. */
export function divergencias(blocos) {
	return blocos
		.filter((b) => b.escrito && b.escrito !== b.doCabecalho)
		.map((b) => `${b.nome}: cabecalho ${b.doCabecalho}, build escreve ${b.escrito}`);
}

/** Opcode de cabecalho sem tamanho declarado no codec. */
export function semTamanhoDeclarado(blocos, textoDosTamanhos) {
	return blocos
		// `includes` e nao `RegExp`: `[0x0fc0]` num padrao e CLASSE DE CARACTERES,
		// e foi assim que a primeira versao deste portao acusou 64 de 64 - o
		// instrumento errado, nao o arquivo.
		.filter((b) => !textoDosTamanhos.toLowerCase().includes(`length_list[${b.doCabecalho}]`))
		.map((b) => `${b.nome} (${b.doCabecalho})`);
}

/** Dois nomes diferentes no mesmo endereco. */
export function opcodesEmDobro(blocos) {
	const porOpcode = new Map();
	for (const b of blocos) {
		if (!porOpcode.has(b.doCabecalho)) porOpcode.set(b.doCabecalho, new Set());
		porOpcode.get(b.doCabecalho).add(b.nome);
	}
	return [...porOpcode.entries()]
		.filter(([, nomes]) => nomes.size > 1)
		.map(([op, nomes]) => `${op}: ${[...nomes].sort().join(' + ')}`);
}

describe('o leitor de blocos - o que faz o portao poder reprovar', () => {
	const SINTETICO = [
		'// 0x0fc0 - RAGIDLE: CZ_RAGIDLE_UM (client -> server)',
		'PACKET.CZ.RAGIDLE_UM.prototype.build = function () {',
		'\tpkt_buf.writeShort(0x0fc0);',
		'};',
		'// 0x0fc2 - RAGIDLE: CZ_RAGIDLE_DOIS (client -> server)',
		'PACKET.CZ.RAGIDLE_DOIS.prototype.build = function () {',
		'\tpkt_buf.writeShort(0x0fc0);',
		'};',
		'// 0x0fc3 - RAGIDLE: ZC_RAGIDLE_TRES (server -> client)',
		'PACKET.ZC.RAGIDLE_TRES.size = -1;',
	].join('\n');

	it('acha os tres blocos e le o opcode escrito de cada um', () => {
		const b = blocosDeRagidle(SINTETICO);
		expect(b.map((x) => x.nome)).toEqual([
			'CZ_RAGIDLE_UM',
			'CZ_RAGIDLE_DOIS',
			'ZC_RAGIDLE_TRES',
		]);
		expect(b[1].escrito).toBe('0x0fc0');
		expect(b[2].escrito).toBeNull(); // ZC nao constroi: nao e divergencia
	});

	// O CONTROLE POSITIVO da afirmacao 1 - e ele e o defeito de 15/09 em miniatura.
	it('REPROVA quem escreve opcode diferente do cabecalho', () => {
		expect(divergencias(blocosDeRagidle(SINTETICO))).toEqual([
			'CZ_RAGIDLE_DOIS: cabecalho 0x0fc2, build escreve 0x0fc0',
		]);
	});

	it('nao acusa o bloco que escreve o proprio opcode', () => {
		const b = blocosDeRagidle(SINTETICO).filter((x) => x.nome === 'CZ_RAGIDLE_UM');
		expect(divergencias(b)).toEqual([]);
	});

	// O CONTROLE POSITIVO da afirmacao 2.
	it('REPROVA opcode de cabecalho sem tamanho no codec', () => {
		const tamanhos = 'length_list[0x0fc0] = -1;';
		expect(semTamanhoDeclarado(blocosDeRagidle(SINTETICO), tamanhos)).toEqual([
			'CZ_RAGIDLE_DOIS (0x0fc2)',
			'ZC_RAGIDLE_TRES (0x0fc3)',
		]);
	});

	// O CONTROLE POSITIVO da afirmacao 3.
	it('REPROVA dois nomes no mesmo endereco', () => {
		const dobrado = [
			'// 0x0fc0 - RAGIDLE: CZ_RAGIDLE_UM (client -> server)',
			'// 0x0fc0 - RAGIDLE: CZ_RAGIDLE_OUTRO (client -> server)',
		].join('\n');
		expect(opcodesEmDobro(blocosDeRagidle(dobrado))).toEqual([
			'0x0fc0: CZ_RAGIDLE_OUTRO + CZ_RAGIDLE_UM',
		]);
	});
});

describe('o PacketStructure.js DE VERDADE', () => {
	const BLOCOS = blocosDeRagidle(ESTRUTURA);

	it('leu os blocos - piso contra regex que para de casar', () => {
		expect(BLOCOS.length, 'cabecalhos RAGIDLE lidos').toBeGreaterThanOrEqual(60);
		expect(
			BLOCOS.filter((b) => b.escrito).length,
			'blocos com opcode escrito no build'
		).toBeGreaterThanOrEqual(30);
	});

	it('todo build escreve o opcode do proprio cabecalho', () => {
		expect(divergencias(BLOCOS)).toEqual([]);
	});

	it('todo opcode RAGIDLE tem tamanho declarado no codec', () => {
		expect(semTamanhoDeclarado(BLOCOS, TAMANHOS)).toEqual([]);
	});

	it('nenhum endereco RAGIDLE serve a dois nomes', () => {
		expect(opcodesEmDobro(BLOCOS)).toEqual([]);
	});
});
