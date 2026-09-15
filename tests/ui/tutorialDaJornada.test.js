/**
 * A regra sem DOM do tutorial guiado (frente D da Jornada de Midgard): a
 * tabela das dez etapas e a geometria da camada.
 *
 * O que este arquivo NAO prova, e nao pode: que da para VER. Isso e a prova de
 * tela (`scripts/prova-tutorial.mjs`), e a regra 5 do projeto existe por causa
 * disso. Aqui ficam as afirmacoes que sobrevivem sem navegador.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ETAPAS,
	FOLGA_DO_RECORTE,
	QUEM_GUIA,
	TOTAL_DE_ETAPAS,
	casaDoBalao,
	etapaDe,
	fraseDaEtapa,
	posicaoDaMao,
	recorteDoAlvo,
	retangulosDaMascara
} from '../../src/UI/Components/TutorialIdle/etapasDoTutorial.js';

const TELA = { largura: 1600, altura: 900 };
const MAO = { largura: 100, altura: 100, pontaX: 10, pontaY: 12 };

describe('as dez etapas', () => {
	it('são dez, numeradas de 1 a 10, sem buraco', () => {
		expect(ETAPAS).toHaveLength(TOTAL_DE_ETAPAS);
		expect(ETAPAS.map(e => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('cada etapa avança por um RESULTADO nomeado, e nenhum deles é um clique em "Próximo"', () => {
		for (const etapa of ETAPAS) {
			expect(typeof etapa.avancaPor).toBe('string');
			expect(etapa.avancaPor.length).toBeGreaterThan(0);
		}
		const nomes = ETAPAS.map(e => e.avancaPor);
		expect(new Set(nomes).size).toBe(ETAPAS.length);
		/* A regra 6 da gravacao: nenhum caminho de avanco pode ser um botao do
		   proprio tutorial. Se alguem inventar um, o nome dele aparece aqui. */
		expect(nomes.join(' ')).not.toMatch(/proximo|próximo|continuar|ok/i);
	});

	it('a frase é curta, imperativa e cita o rótulo do controle entre aspas', () => {
		for (const etapa of ETAPAS) {
			const frase = fraseDaEtapa(etapa, false);
			expect(frase.length).toBeLessThanOrEqual(90);
			expect(frase).not.toContain('{');
			if (etapa.rotulo) {
				expect(frase).toContain(`"${etapa.rotulo}"`);
			}
		}
	});

	it('o verbo troca com o ponteiro, e o rótulo continua o mesmo', () => {
		const etapa = etapaDe(1);
		expect(fraseDaEtapa(etapa, true)).toContain('Toque em "Menu"');
		expect(fraseDaEtapa(etapa, false)).toContain('Clique em "Menu"');
	});

	it('quem fala tem nome, e é o NPC que o jogador já conhece', () => {
		expect(QUEM_GUIA).toBe('Funcionária Kafra');
	});

	it('TRAVESSÃO É PROIBIDO em todo texto que o jogador lê', () => {
		const textos = [QUEM_GUIA];
		for (const etapa of ETAPAS) {
			textos.push(etapa.frase);
			if (etapa.rotulo) textos.push(etapa.rotulo);
			if (etapa.quandoSumir) textos.push(etapa.quandoSumir.frase);
		}
		/* Controle positivo: sem ele um detector quebrado parece aprovação. */
		expect('a — b').toMatch(/[—–]/);
		for (const texto of textos) {
			expect(texto).not.toMatch(/[—–]/);
		}
	});

	it('toda etapa cujo alvo pode sumir da tela tem caminho de volta', () => {
		/* As que apontam para dentro do leque ou de uma janela: fechar a janela
		   ou recolher o leque deixa o alvo em 0x0. */
		for (const numero of [2, 3, 4, 5, 6, 7, 10]) {
			const etapa = etapaDe(numero);
			expect(etapa.quandoSumir, `etapa ${numero}`).toBeTruthy();
			expect(etapa.quandoSumir.seletor).toBeTruthy();
			expect(fraseDaEtapa(etapa, false, etapa.quandoSumir.frase).length).toBeGreaterThan(10);
		}
	});

	it('a etapa 8 é a única sem alvo, e isso é declarado', () => {
		expect(ETAPAS.filter(e => e.alvo === null).map(e => e.numero)).toEqual([8]);
	});

	it('todo alvo mora num Shadow DOM identificado por host', () => {
		for (const etapa of ETAPAS) {
			if (!etapa.alvo) continue;
			expect(etapa.alvo.host).toMatch(/^[A-Za-z]+$/);
			expect(etapa.alvo.seletor.startsWith('.')).toBe(true);
		}
	});

	it('etapa fora da faixa não desenha nada', () => {
		expect(etapaDe(0)).toBeNull();
		expect(etapaDe(11)).toBeNull();
		expect(etapaDe(undefined)).toBeNull();
	});
});

describe('o recorte', () => {
	it('abre o furo com folga em volta do alvo', () => {
		const r = recorteDoAlvo({ left: 100, top: 200, width: 60, height: 40 }, TELA);
		expect(r).toEqual({
			x: 100 - FOLGA_DO_RECORTE,
			y: 200 - FOLGA_DO_RECORTE,
			w: 60 + FOLGA_DO_RECORTE * 2,
			h: 40 + FOLGA_DO_RECORTE * 2
		});
	});

	it('ALVO SEM CAIXA NÃO VIRA FURO (a armadilha 3: o leque fechado é display:none)', () => {
		expect(recorteDoAlvo({ left: 0, top: 0, width: 0, height: 0 }, TELA)).toBeNull();
		expect(recorteDoAlvo(null, TELA)).toBeNull();
	});

	it('alvo fora da tela também não vira furo', () => {
		expect(recorteDoAlvo({ left: -400, top: 10, width: 100, height: 20 }, TELA)).toBeNull();
		expect(recorteDoAlvo({ left: 10, top: 2000, width: 100, height: 20 }, TELA)).toBeNull();
	});

	it('alvo encostado na borda é cortado na tela, e não estoura', () => {
		const r = recorteDoAlvo({ left: 1560, top: 860, width: 40, height: 40 }, TELA);
		expect(r.x + r.w).toBe(TELA.largura);
		expect(r.y + r.h).toBe(TELA.altura);
	});
});

describe('a máscara de quatro retângulos', () => {
	const recorte = { x: 300, y: 200, w: 120, h: 80 };
	const rects = retangulosDaMascara(recorte, TELA);

	it('são quatro, e nenhum deles encosta no furo', () => {
		expect(rects).toHaveLength(4);
		for (const r of rects) {
			const cruzaX = r.x < recorte.x + recorte.w && r.x + r.w > recorte.x;
			const cruzaY = r.y < recorte.y + recorte.h && r.y + r.h > recorte.y;
			expect(cruzaX && cruzaY).toBe(false);
		}
	});

	it('juntos com o furo cobrem a tela EXATAMENTE (nem sobra nem falta)', () => {
		const area = rects.reduce((s, r) => s + r.w * r.h, 0) + recorte.w * recorte.h;
		expect(area).toBe(TELA.largura * TELA.altura);
	});

	it('sem furo, a máscara é um retângulo só do tamanho da tela', () => {
		const um = retangulosDaMascara(null, TELA);
		expect(um).toHaveLength(1);
		expect(um[0]).toEqual({ x: 0, y: 0, w: TELA.largura, h: TELA.altura });
	});

	it('furo colado no canto inferior direito não gera retângulo de área negativa', () => {
		const canto = { x: 1500, y: 820, w: 100, h: 80 };
		for (const r of retangulosDaMascara(canto, TELA)) {
			expect(r.w).toBeGreaterThanOrEqual(0);
			expect(r.h).toBeGreaterThanOrEqual(0);
		}
	});
});

describe('a mão', () => {
	it('no meio da tela ela fica ABAIXO E À DIREITA, sem espelhar (o dedo aponta para cima e para a esquerda)', () => {
		const pos = posicaoDaMao({ x: 700, y: 400, w: 100, h: 50 }, TELA, MAO);
		expect(pos.espelharX).toBe(false);
		expect(pos.espelharY).toBe(false);
		expect(pos.x).toBeGreaterThan(700);
		expect(pos.y).toBeGreaterThan(400);
	});

	it('NO CANTO INFERIOR DIREITO ela espelha nos dois eixos (é onde mora o botão "Menu")', () => {
		const fab = { x: 1480, y: 800, w: 100, h: 90 };
		const pos = posicaoDaMao(fab, TELA, MAO);
		expect(pos.espelharX).toBe(true);
		expect(pos.espelharY).toBe(true);
	});

	it('nunca sai da tela, em nenhum dos quatro cantos', () => {
		const cantos = [
			{ x: 0, y: 0, w: 60, h: 60 },
			{ x: TELA.largura - 60, y: 0, w: 60, h: 60 },
			{ x: 0, y: TELA.altura - 60, w: 60, h: 60 },
			{ x: TELA.largura - 60, y: TELA.altura - 60, w: 60, h: 60 }
		];
		for (const c of cantos) {
			const pos = posicaoDaMao(c, TELA, MAO);
			expect(pos.x).toBeGreaterThanOrEqual(0);
			expect(pos.y).toBeGreaterThanOrEqual(0);
			expect(pos.x + MAO.largura).toBeLessThanOrEqual(TELA.largura);
			expect(pos.y + MAO.altura).toBeLessThanOrEqual(TELA.altura);
		}
	});
});

describe('a casa do balão', () => {
	const balao = { altura: 120, margem: 96 };

	it('a casa padrão é embaixo, como na gravação', () => {
		expect(casaDoBalao({ x: 20, y: 20, w: 100, h: 40 }, TELA, balao)).toBe('baixo');
		expect(casaDoBalao(null, TELA, balao)).toBe('baixo');
	});

	it('SOBE quando o alvo mora na faixa de baixo, para não cobri-lo', () => {
		const fab = { x: 1480, y: 760, w: 100, h: 90 };
		expect(casaDoBalao(fab, TELA, balao)).toBe('cima');
	});

	it('num celular em pé o botão "Caçar" também empurra o balão para cima', () => {
		const celular = { largura: 393, altura: 852 };
		const botao = { x: 250, y: 700, w: 120, h: 56 };
		expect(casaDoBalao(botao, celular, { altura: 140, margem: 150 })).toBe('cima');
	});
});

/**
 * AS QUATRO LISTAS DE UM OPCODE NOVO.
 *
 * Faltar UMA emudece o fio, e o comentario de
 * `src/Network/Packets/packets2021_len_main.js` documenta o estrago: sem o
 * tamanho declarado o cliente para de fatiar no meio do fluxo e TUDO o que vem
 * depois fica invisivel, sem um erro no console. O trio do Passe ficou fora
 * desta lista por um dia e um clique no menu ENCERRAVA A CONEXAO do jogador.
 *
 * Este portao le o FONTE, e nao o modulo: importar `PacketStructure.js` num
 * jsdom puxa o resto do motor de rede junto, e o que se quer cobrar aqui e
 * textual mesmo - "o opcode esta escrito nas quatro casas?".
 */
describe('os pacotes do tutorial estao nas QUATRO listas', () => {
	/* Caminho a partir da RAIZ do projeto: o vitest roda com o cwd nela
	   (`vite.config.js` -> `root: './'`). Um `new URL(..., import.meta.url)`
	   com template nao sobreviveu a transformacao do vitest aqui. */
	const ler = caminho => readFileSync(resolve(process.cwd(), caminho), 'utf-8');

	it('PacketStructure.js declara os dois, com corpo de tamanho variavel', () => {
		const fonte = ler('src/Network/PacketStructure.js');
		expect(fonte).toContain('PACKET.CZ.RAGIDLE_TUTORIAL_ACAO');
		expect(fonte).toContain('PACKET.ZC.RAGIDLE_TUTORIAL');
		expect(fonte).toContain('pkt_buf.writeShort(0x0fde)');
		expect(fonte).toContain('PACKET.ZC.RAGIDLE_TUTORIAL.size = -1;');
	});

	it('PacketRegister.js registra SO o ZC (o CZ o cliente escreve, nao le)', () => {
		const fonte = ler('src/Network/PacketRegister.js');
		expect(fonte).toContain('0x0fdf: PACKET.ZC.RAGIDLE_TUTORIAL');
		expect(fonte).not.toContain('0x0fde: PACKET.CZ');
	});

	it('a tabela de TAMANHOS tem os dois (a lista que sempre falta)', () => {
		const fonte = ler('src/Network/Packets/packets2021_len_main.js');
		expect(fonte).toMatch(/length_list\[0x0fde\]\s*=\s*-1;/);
		expect(fonte).toMatch(/length_list\[0x0fdf\]\s*=\s*-1;/);
	});

	it('o componente engancha o ZC dele, e NENHUM pacote de outro dono', () => {
		const fonte = ler('src/UI/Components/TutorialIdle/TutorialIdle.js');
		expect(fonte).toContain('Network.hookPacket(PACKET.ZC.RAGIDLE_TUTORIAL, onTutorialRecebido)');
		/* `hookPacket` SOBRESCREVE (NetworkManager.js:200-210): enganchar
		   ZC_RAGIDLE_MISSOES aqui roubaria o pacote da janela de Missoes e do
		   rastreador. O estado dos outros e lido por polling. */
		/* `Network.hookPacket(` aparece TAMBEM no cabecalho, explicando por que
		   nao se engancha o pacote dos outros. Contar chamada, e nao mencao. */
		const enganches = fonte.match(/Network\.hookPacket\(PACKET\./g) || [];
		expect(enganches).toHaveLength(1);
	});

	it('o opcode nao colide com nenhum outro deste cliente', () => {
		const fonte = ler('src/Network/Packets/packets2021_len_main.js');
		for (const opcode of ['0x0fde', '0x0fdf']) {
			const ocorrencias = fonte.split(`length_list[${opcode}]`).length - 1;
			expect(ocorrencias, opcode).toBe(1);
		}
	});
});
