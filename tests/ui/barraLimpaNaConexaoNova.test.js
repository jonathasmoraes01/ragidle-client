/**
 * A BARRA DE ICONES LIMPA NA CONEXAO NOVA (D-2440).
 *
 * O defeito (D-2397 do servidor): a Bencao e a Agilidade que venceram durante os
 * 2 s de um relog seguiram acesas, sem relogio, ate a morte - o `estado: 0` delas
 * foi para a conexao que caiu, e a barra (`StatusIcons`) nunca era limpa numa
 * reconexao. O conserto limpa a barra UMA vez por conexao nova, logo depois do
 * primeiro `CZ_NOTIFY_ACTORINIT` dela.
 *
 * Duas metades, no molde de `acessorioDaHudNaoDerruba` e `estouProntoSempreSai`:
 *  - a REGRA, executada: `limpezaNaConexaoNova.js` num motor falso que segue a
 *    ordem do `MapEngine` (aceite -> carga -> ACTORINIT -> limpeza -> respostas);
 *  - a COSTURA, lida do fonte (o `MapEngine.js` nao carrega no jsdom): a marca so
 *    no aceite, a limpeza so no `estouPronto` e DEPOIS do pacote, com guarda.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { criarLimpezaNaConexaoNova } from 'UI/Components/StatusIcons/limpezaNaConexaoNova.js';

const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const MOTOR = semComentario(readFileSync('src/Engine/MapEngine.js', 'utf8').replace(/\r\n/g, '\n'));

/**
 * O motor falso: a barra (EFST -> aceso), a entidade do proprio (sem ela o icone
 * cai no chao, `Entity.js`), e a ordem do `MapEngine`. `servidor` responde ao
 * ACTORINIT com o que ele devolve; o motor so aplica DEPOIS de a carga terminar.
 */
function motorFalso() {
	const barra = new Set();
	const fio = [];
	let entidade = false;
	const limpeza = criarLimpezaNaConexaoNova(
		() => barra.clear(),
		erro => {
			throw erro;
		}
	);
	return {
		barra,
		fio,
		icone(efst, aceso) {
			if (!entidade) return;
			if (aceso) barra.add(efst);
			else barra.delete(efst);
		},
		/** `onConnectionAccepted`. */
		aceite() {
			entidade = false;
			limpeza.armar();
		},
		/** O `onLoad` de uma carga: a entidade volta, o ACTORINIT sai, a limpeza (se armada), e so entao as respostas. */
		carga(respostas = []) {
			entidade = true;
			fio.push('ACTORINIT');
			limpeza.depoisDoEstouPronto();
			for (const [efst, aceso] of respostas) this.icone(efst, aceso);
		},
		/** O `ZC_NPCACK_MAPMOVE`: a carga comeca, a entidade sai. */
		trocaDeMapa() {
			entidade = false;
		}
	};
}

describe('a regra (limpezaNaConexaoNova.js)', () => {
	it('o caso da D-2397: o que venceu desconectado sai da barra, e o que o servidor devolve acende de novo', () => {
		const m = motorFalso();
		m.aceite();
		m.carga();
		m.icone(10, true); // Bencao
		m.icone(12, true); // Agilidade
		m.icone(69, true); // o cantor
		// A conexao cai; Bencao e Agilidade vencem la fora (o `estado: 0` vai para a conexao morta).
		m.aceite();
		// O servidor devolve so o que vive: o 69 (D-2440 no servidor).
		m.carga([[69, true]]);
		expect([...m.barra]).toEqual([69]);
	});

	it('a SEGUNDA carga da mesma reconexao NAO limpa (ela apagaria o lote da primeira)', () => {
		const m = motorFalso();
		m.aceite();
		m.carga([[10, true], [673, true]]); // o lote: o que atravessa e o carrinho
		m.trocaDeMapa(); // o MAPMOVE logo atras do aceite carrega de novo
		m.carga(); // o servidor nao manda o lote de novo
		expect([...m.barra].sort((a, b) => a - b)).toEqual([10, 673]);
	});

	it('a troca de mapa comum (sem aceite) NAO limpa: o servidor nao reenvia tudo nela', () => {
		const m = motorFalso();
		m.aceite();
		m.carga([[10, true]]);
		m.trocaDeMapa();
		m.carga();
		m.trocaDeMapa();
		m.carga();
		expect([...m.barra]).toEqual([10]);
	});

	it('a limpeza vem DEPOIS do ACTORINIT, e o que chega em resposta nao e apagado', () => {
		const m = motorFalso();
		m.aceite();
		m.carga([[60, true]]);
		expect(m.fio).toEqual(['ACTORINIT']);
		expect([...m.barra]).toEqual([60]);
	});

	it('sem aceite nenhum, nunca limpa (o primeiro login com a barra vazia tambem e um aceite)', () => {
		const limpou = [];
		const l = criarLimpezaNaConexaoNova(
			() => limpou.push(1),
			() => {}
		);
		expect(l.depoisDoEstouPronto()).toBe(false);
		l.armar();
		expect(l.depoisDoEstouPronto()).toBe(true);
		expect(l.depoisDoEstouPronto()).toBe(false);
		expect(limpou).toEqual([1]);
	});

	it('a limpeza que lanca e RELATADA, nao sobe, e nao tenta de novo na carga seguinte', () => {
		const relatos = [];
		let tentativas = 0;
		const l = criarLimpezaNaConexaoNova(
			() => {
				tentativas++;
				throw new Error('explodiu');
			},
			erro => relatos.push(erro.message)
		);
		l.armar();
		expect(() => l.depoisDoEstouPronto()).not.toThrow();
		expect(relatos).toEqual(['explodiu']);
		expect(l.armada).toBe(false);
		l.depoisDoEstouPronto();
		expect(tentativas).toBe(1);
	});
});

describe('a costura no MapEngine', () => {
	const corpoDe = assinatura => {
		const i = MOTOR.indexOf(assinatura);
		expect(i, assinatura + ' sumiu').toBeGreaterThan(-1);
		return { i, corpo: MOTOR.slice(i, MOTOR.indexOf('\n}', i)) };
	};

	it('a marca e posta no aceite da conexao nova, e SO nele', () => {
		const { corpo } = corpoDe('function onConnectionAccepted(');
		expect(corpo).toContain('_limpezaDaBarra.armar();');
		expect(MOTOR.split('_limpezaDaBarra.armar();').length, 'a marca saiu do aceite ou foi posta em outra porta').toBe(2);
	});

	it('a limpeza e feita no estouPronto, DEPOIS do envio do ACTORINIT e com guarda (D-993)', () => {
		const inicio = MOTOR.indexOf('const estouPronto = () => {');
		expect(inicio).toBeGreaterThan(-1);
		const corpo = MOTOR.slice(inicio, MOTOR.indexOf('\n\t\t};', inicio));
		const envio = corpo.indexOf('Network.sendPacket(new PACKET.CZ.NOTIFY_ACTORINIT());');
		const limpeza = corpo.indexOf('_limpezaDaBarra.depoisDoEstouPronto();');
		expect(envio, 'o envio saiu do estouPronto').toBeGreaterThan(-1);
		expect(limpeza, 'a limpeza saiu do estouPronto').toBeGreaterThan(-1);
		expect(limpeza, 'a limpeza veio antes do ACTORINIT').toBeGreaterThan(envio);
		const antes = corpo.slice(0, limpeza);
		expect(antes.lastIndexOf('try {'), 'a limpeza esta sem guarda').toBeGreaterThan(antes.lastIndexOf('}'));
		expect(MOTOR.split('_limpezaDaBarra.depoisDoEstouPronto();').length).toBe(2);
	});

	it('a barra nao e limpa por fora da regra (so o logout/menu e a conexao nova)', () => {
		expect(MOTOR.match(/StatusIcons\.clean\(\)/g) ?? [], 'outra limpeza da barra apareceu').toHaveLength(1);
		expect(MOTOR).toContain('() => StatusIcons.clean(),');
		expect(MOTOR).toContain("[StatusIcons, 'clean'],");
	});
});
