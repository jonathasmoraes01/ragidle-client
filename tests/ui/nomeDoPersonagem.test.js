import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	CARACTERES_APARADOS,
	CODIGO_NOME_COM_SIMBOLO,
	MENSAGEM_NOME_COM_ESPACO,
	NOME_MAXIMO,
	NOME_MINIMO,
	normalizarNomeDoPersonagem,
	recusaDoNomeNoCliente,
	textoDaRecusaDeCriacao
} from '../../src/UI/Components/CharCreate/nomeDoPersonagem.js';
import { parametrosDoServico } from '../../src/UI/Components/RoShop/formatoDoRoShop.js';

/*
 * O nome do personagem e aparado como a fonte apara (`normalize_name`,
 * `strlib.cpp:59-93`) e conferido como o cliente oficial confere
 * (`char.cpp:1341`) - o relato do dono foi "no celular nao da para criar
 * personagem", e o teclado do celular deixa espaco no fim do nome.
 *
 * Os caracteres invisiveis vao por ESCAPE neste arquivo, e nunca literais: a
 * primeira versao deste teste levou um hifen suave literal que nao chegou ao
 * disco, e o caso passou a medir outra coisa sem ninguem ver.
 */
describe('o nome do personagem antes de ir ao servidor', () => {
	it('a lista de aparados e a TRIM_CHARS da fonte, com o \\255 octal lido como 0xAD', () => {
		expect(CARACTERES_APARADOS).toBe('\u00ad\u00a0\u001a\t\n\r ');
		expect(CARACTERES_APARADOS.length).toBe(7);
	});

	it('o espaco que a sugestao do teclado deixa no fim SAI', () => {
		expect(normalizarNomeDoPersonagem('Fulano ')).toBe('Fulano');
		expect(normalizarNomeDoPersonagem('  Fulano')).toBe('Fulano');
	});

	it('uma sequencia de aparados no MEIO vira um espaco so', () => {
		expect(normalizarNomeDoPersonagem('Ana   Bob')).toBe('Ana Bob');
		expect(normalizarNomeDoPersonagem('Ana\t\nBob')).toBe('Ana Bob');
		expect(normalizarNomeDoPersonagem('Ana Bob')).toBe('Ana Bob');
	});

	it('o hifen suave, o espaco duro e o SUB tambem sao aparados', () => {
		expect(normalizarNomeDoPersonagem('\u00adFulano\u001a')).toBe('Fulano');
		expect(normalizarNomeDoPersonagem('Fulano\u00a0')).toBe('Fulano');
	});

	it('nome sem aparado nenhum passa intacto, e so aparados vira vazio', () => {
		expect(normalizarNomeDoPersonagem('Cobaia')).toBe('Cobaia');
		expect(normalizarNomeDoPersonagem('   ')).toBe('');
		expect(normalizarNomeDoPersonagem(undefined)).toBe('');
	});

	it('curto e longo sao recusados AQUI, com a razao certa - e as pontas exatas passam', () => {
		expect(recusaDoNomeNoCliente('Ana')).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('')).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MAXIMO + 1))).toMatch(/de 4 a 23/);
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MINIMO))).toBeNull();
		expect(recusaDoNomeNoCliente('a'.repeat(NOME_MAXIMO))).toBeNull();
	});

	it('"Joe " com o espaco da sugestao era 4 caracteres e passava - aparado, ele e curto', () => {
		// Cru, desde 25/09/2026 o espaco ja o recusa (ordem do dono); aparado, o motivo certo e o tamanho.
		expect(recusaDoNomeNoCliente('Joe ')).toBe('O nome não pode ter espaços.');
		expect(recusaDoNomeNoCliente(normalizarNomeDoPersonagem('Joe '))).toMatch(/de 4 a 23/);
	});
});

/*
 * ORDEM DO DONO (25/09/2026): *"Nao deixe criar personagens que tenham espaco
 * entre os nomes, ok? Esse 'Testem an' deveria ser 'Testeman'."* O espaco
 * quebra `#darcash Testem an 99`. O servidor recusa com o 0x02; o cliente diz o
 * motivo ANTES de mandar, e tambem quando a recusa vem do servidor.
 */
describe('nome com espaco e recusado com a frase certa (ordem do dono, 25/09/2026)', () => {
	it('a frase e a que o dono pediu, em portugues com acento', () => {
		expect(MENSAGEM_NOME_COM_ESPACO).toBe('O nome não pode ter espaços.');
	});

	it('"Testem an", o nome do relato, e recusado AQUI - e "Testeman" passa', () => {
		expect(recusaDoNomeNoCliente('Testem an')).toBe(MENSAGEM_NOME_COM_ESPACO);
		expect(recusaDoNomeNoCliente(normalizarNomeDoPersonagem('  Testem   an '))).toBe(MENSAGEM_NOME_COM_ESPACO);
		expect(recusaDoNomeNoCliente('Testeman')).toBeNull();
	});

	it('o espaco duro e o TAB do meio viram espaco e sao recusados; os Unicode tambem', () => {
		for (const bruto of ['Ana\u00a0Bob', 'Ana\tBob', 'Ana\u2003Bob', 'Ana\u3000Bob', 'Ana\u200bBob', 'Ana\u180eBob', 'Ana\ufeffBob']) {
			expect(recusaDoNomeNoCliente(normalizarNomeDoPersonagem(bruto)), JSON.stringify(bruto)).toBe(MENSAGEM_NOME_COM_ESPACO);
		}
	});

	it('espaco so nas PONTAS nao e recusa: a normalizacao o tira (o teclado do celular)', () => {
		expect(recusaDoNomeNoCliente(normalizarNomeDoPersonagem(' Testeman '))).toBeNull();
	});

	it('curto E com espaco: o tamanho e dito primeiro', () => {
		expect(recusaDoNomeNoCliente('A B')).toMatch(/de 4 a 23/);
	});

	it('acento, digito e simbolo seguem aceitos: a recusa e SO de espaco', () => {
		for (const nome of ['Joãozinho', 'Jhow_99', 'Ana-Bob', 'Ação']) {
			expect(recusaDoNomeNoCliente(nome), nome).toBeNull();
		}
	});

	it('a troca de nome do RO Shop usa a MESMA regra e a MESMA frase', () => {
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Testem an' })).toEqual({ ok: false, erro: MENSAGEM_NOME_COM_ESPACO });
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Novo\u3000Nome' }).ok).toBe(false);
		expect(parametrosDoServico('troca-de-nome', { novoNome: '  Testeman  ' })).toEqual({ ok: true, parametros: { novoNome: 'Testeman' } });
	});
});

describe('a recusa do SERVIDOR vira texto (HC_REFUSE_MAKECHAR)', () => {
	const lerMensagem = id => `msg${id}`;

	it('o 0x02 e o nome com espaco, e sai em portugues', () => {
		expect(CODIGO_NOME_COM_SIMBOLO).toBe(0x02);
		expect(textoDaRecusaDeCriacao(0x02, lerMensagem)).toBe(MENSAGEM_NOME_COM_ESPACO);
	});

	it('os outros codigos seguem com as mensagens de sempre do cliente', () => {
		expect(textoDaRecusaDeCriacao(0x00, lerMensagem)).toBe('msg10');
		expect(textoDaRecusaDeCriacao(0x01, lerMensagem)).toBe('msg298');
		expect(textoDaRecusaDeCriacao(0x03, lerMensagem)).toBe('msg1355');
		expect(textoDaRecusaDeCriacao(0xff, lerMensagem)).toBe('msg11');
		expect(textoDaRecusaDeCriacao(0x42, lerMensagem)).toBe('msg11');
	});

	it('o CharEngine mostra o texto desta funcao, e nao mais o msg 1272', () => {
		const fonte = readFileSync(join(process.cwd(), 'src/Engine/CharEngine.js'), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/[^\n]*/g, '');
		expect(fonte).toContain('UIManager.showMessageBox(textoDaRecusaDeCriacao(pkt.ErrorCode, id => DB.getMessage(id)), ');
		expect(fonte).not.toContain('1272');
	});
});
