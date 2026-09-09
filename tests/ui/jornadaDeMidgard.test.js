/**
 * AS REGRAS DA JORNADA DE MIDGARD (08/09/2026).
 *
 * O que este arquivo mede e o que decide COISA na aba "Missoes do Codex": onde
 * cai um pino do mapa-mundi, o que cada estado escreve, o contador em palavra,
 * e POR QUE a viagem nao vai sair. Nada disso e desenho - o desenho tem prova
 * de tela (`docs/provas-jornada/`), porque contar elemento nao prova que da
 * para ver.
 *
 * O caso que mais importa daqui a um mes e o do PINO: a regra e "capitulo cujo
 * lugar nao for reconhecido pelo NOME nao ganha pino", e ela existe porque um
 * pino no lugar errado ensina geografia falsa. Um dia alguem vai querer
 * "melhorar" o casamento por semelhanca; que ele reprove aqui antes.
 */
import { describe, expect, it } from 'vitest';

import {
	ESTADOS_DA_JORNADA,
	PONTOS_DO_MAPA,
	contadorEscrito,
	missoesDaEspecie,
	motivoDeNaoViajar,
	normalizarNome,
	pinosDosCapitulos,
	placarDoPremio,
	porcentagem,
	proximoPasso,
	recompensaEmTexto,
	seloDoEstado
} from 'UI/Components/CodexIdle/jornadaDeMidgard.js';

describe('os pontos medidos do mapa', () => {
	it('todos caem DENTRO da imagem', () => {
		// Um ponto fora de 0..100 desenharia o pino do lado de fora da caixa, e
		// `overflow:hidden` o esconderia - um capitulo sumido sem nada dizer.
		for (const p of PONTOS_DO_MAPA) {
			expect(p.x, p.lugar).toBeGreaterThanOrEqual(0);
			expect(p.x, p.lugar).toBeLessThanOrEqual(100);
			expect(p.y, p.lugar).toBeGreaterThanOrEqual(0);
			expect(p.y, p.lugar).toBeLessThanOrEqual(100);
		}
	});

	it('nenhum lugar aparece duas vezes', () => {
		const nomes = PONTOS_DO_MAPA.map(p => normalizarNome(p.lugar));
		expect(new Set(nomes).size).toBe(nomes.length);
	});
});

describe('pinosDosCapitulos', () => {
	it('casa pelo nome do lugar, dentro do titulo do capitulo', () => {
		const pinos = pinosDosCapitulos([{ id: 'cap-01-prt', titulo: 'Os campos ao redor de Prontera', ordem: 1 }]);
		expect(pinos['cap-01-prt'].lugar).toBe('Prontera');
	});

	it('casa pelo ID quando o titulo nao diz o lugar', () => {
		const pinos = pinosDosCapitulos([{ id: 'cap-04-niflheim', titulo: 'A cidade dos mortos', ordem: 4 }]);
		expect(pinos['cap-04-niflheim'].lugar).toBe('Niflheim');
	});

	it('o MAIS ESPECIFICO ganha: os esgotos nao viram a cidade', () => {
		const pinos = pinosDosCapitulos([
			{ id: 'a', titulo: 'Os campos de Prontera', ordem: 1 },
			{ id: 'b', titulo: 'Os esgotos de Prontera', ordem: 2 }
		]);
		expect(pinos.a.lugar).toBe('Prontera');
		expect(pinos.b.lugar).toBe('Esgotos de Prontera');
	});

	it('capitulo que nao cita lugar nenhum NAO ganha pino', () => {
		// A regra inteira desta rodada. Ele continua na lista de capitulos - o
		// que ele nao ganha e uma marca sobre um lugar que ninguem mediu.
		const pinos = pinosDosCapitulos([{ id: 'cap-99', titulo: 'As terras do norte', ordem: 99 }]);
		expect(pinos['cap-99']).toBeUndefined();
	});

	it('dois capitulos no MESMO lugar: fica o de menor ordem', () => {
		// Dois pinos no mesmo pixel deixariam o de baixo inalcancavel.
		const pinos = pinosDosCapitulos([
			{ id: 'tarde', titulo: 'Prontera de novo', ordem: 8 },
			{ id: 'cedo', titulo: 'Prontera', ordem: 2 }
		]);
		expect(pinos.cedo.lugar).toBe('Prontera');
		expect(pinos.tarde).toBeUndefined();
	});

	it('acento e maiuscula nao atrapalham', () => {
		const pinos = pinosDosCapitulos([{ id: 'gh', titulo: 'Os CALABOÇOS de Glast Heim', ordem: 3 }]);
		expect(pinos.gh.lugar).toBe('Calabocos de Glast Heim');
	});

	it('entrada torta nao derruba nada', () => {
		expect(pinosDosCapitulos(null)).toEqual({});
		expect(pinosDosCapitulos([null, {}, { titulo: 'Prontera' }])).toEqual({});
	});
});

describe('os quatro estados, por texto E imagem', () => {
	it('cada um tem palavra, glifo e FORMA proprios', () => {
		const chaves = Object.keys(ESTADOS_DA_JORNADA);
		expect(chaves.sort()).toEqual(['bloqueado', 'concluido', 'disponivel', 'em-andamento']);

		// A forma e o sinal que sobrevive ao print em preto e branco: se duas
		// forem iguais, a distincao volta a depender de cor.
		const formas = chaves.map(k => ESTADOS_DA_JORNADA[k].forma);
		expect(new Set(formas).size).toBe(4);
		const glifos = chaves.map(k => ESTADOS_DA_JORNADA[k].glifo);
		expect(new Set(glifos).size).toBe(4);
		const rotulos = chaves.map(k => ESTADOS_DA_JORNADA[k].rotulo);
		expect(new Set(rotulos).size).toBe(4);
	});

	it('estado desconhecido APARECE com a sigla crua, em vez de sumir', () => {
		const s = seloDoEstado('estado-que-o-servidor-inventou');
		expect(s.rotulo).toBe('estado-que-o-servidor-inventou');
		expect(s.classe).toBe('is-desconhecido');
	});

	it('sem estado nenhum ainda diz alguma coisa', () => {
		expect(seloDoEstado(undefined).rotulo).toBe('Sem estado');
	});
});

describe('o contador ESCRITO', () => {
	it('e "3 de 10", e nao "3/10" - o pedido do dono e literal', () => {
		expect(contadorEscrito(3, 10)).toBe('3 de 10');
	});

	it('nao passa da meta nem desce de zero', () => {
		expect(contadorEscrito(30, 10)).toBe('10 de 10');
		expect(contadorEscrito(-5, 10)).toBe('0 de 10');
	});

	it('aguenta lixo', () => {
		expect(contadorEscrito(null, undefined)).toBe('0 de 0');
		expect(contadorEscrito('abc', 4)).toBe('0 de 4');
	});
});

describe('porcentagem da barra', () => {
	it('nunca passa de 100 - o teto e da LARGURA, nao do dado', () => {
		expect(porcentagem(30, 10)).toBe(100);
		expect(porcentagem(5, 10)).toBe(50);
		expect(porcentagem(1, 0)).toBe(0);
	});
});

describe('o proximo passo', () => {
	const capitulos = [
		{ id: 'a', ordem: 1, estado: 'concluido' },
		{ id: 'b', ordem: 2, estado: 'em-andamento' },
		{ id: 'c', ordem: 3, estado: 'bloqueado' }
	];

	it('o `capituloAtual` do servidor MANDA', () => {
		expect(proximoPasso({ capitulos, capituloAtual: 'c' }).id).toBe('c');
	});

	it('sem ele, e o primeiro nao concluido na ordem', () => {
		expect(proximoPasso({ capitulos }).id).toBe('b');
	});

	it('um `capituloAtual` que nao existe nao trava a tela', () => {
		expect(proximoPasso({ capitulos, capituloAtual: 'zzz' }).id).toBe('b');
	});

	it('jornada inteira concluida nao tem proximo passo', () => {
		expect(proximoPasso({ capitulos: [{ id: 'a', ordem: 1, estado: 'concluido' }] })).toBeNull();
		expect(proximoPasso({ capitulos: [] })).toBeNull();
		expect(proximoPasso(null)).toBeNull();
	});
});

describe('o premio, anunciado desde a primeira abertura', () => {
	it('conta os capitulos fechados e diz o que falta', () => {
		const p = placarDoPremio({
			capitulos: [{ estado: 'concluido' }, { estado: 'em-andamento' }, { estado: 'bloqueado' }],
			premio: { descricao: 'Asa de Midgard', entregue: false }
		});
		expect(p.concluidos).toBe(1);
		expect(p.total).toBe(3);
		expect(p.falta).toBe('Faltam 2 capítulos para receber.');
	});

	it('o SINGULAR tem frase própria - "Faltam 1 capítulo" seria descuido na tela', () => {
		const p = placarDoPremio({ capitulos: [{ estado: 'concluido' }, { estado: 'bloqueado' }] });
		expect(p.falta).toBe('Falta 1 capítulo para receber.');
	});

	it('ja entregue diz isso, e nao um numero', () => {
		const p = placarDoPremio({ capitulos: [{ estado: 'concluido' }], premio: { entregue: true } });
		expect(p.entregue).toBe(true);
		expect(p.falta).toBe('Já está com você.');
	});

	it('com a jornada TRANCADA ele ainda responde - o premio e anunciado antes', () => {
		const p = placarDoPremio({ desbloqueada: false, capitulos: [] });
		expect(p.total).toBe(0);
		expect(p.falta).toContain('Jornada de Midgard inteira');
	});
});

describe('POR QUE a viagem nao vai sair', () => {
	/*
	 * As tres recusas SILENCIOSAS do `viajar()` do servidor. Elas nao respondem
	 * nada: o personagem nao sai do lugar e o botao parece quebrado. Este e o
	 * unico lugar do cliente que sabe prever as tres.
	 */
	it('morto nao viaja de menu', () => {
		const m = motivoDeNaoViajar({ mapa: 'prt_fild08', morto: true, nivelDoJogador: 99, nivelQueAbre: 1 });
		expect(m.codigo).toBe('morto');
		expect(m.frase).toContain('reviva');
	});

	it('a morte vence a tranca de nivel - o jogador conserta uma coisa por vez', () => {
		const m = motivoDeNaoViajar({ mapa: 'gl_dun01', morto: true, nivelDoJogador: 1, nivelQueAbre: 80 });
		expect(m.codigo).toBe('morto');
	});

	it('o mapa em que ele JA esta', () => {
		const m = motivoDeNaoViajar({ mapa: 'prt_fild08', mapaAtual: 'prt_fild08', nivelDoJogador: 50 });
		expect(m.codigo).toBe('ja-esta-aqui');
	});

	it('mapa acima do nivel diz OS DOIS numeros', () => {
		const m = motivoDeNaoViajar({ mapa: 'gl_dun01', nivelDoJogador: 30, nivelQueAbre: 80 });
		expect(m.codigo).toBe('nivel');
		expect(m.frase).toContain('Nv. 80');
		expect(m.frase).toContain('Nv. 30');
	});

	it('nivel suficiente: pode ir', () => {
		expect(motivoDeNaoViajar({ mapa: 'gl_dun01', nivelDoJogador: 90, nivelQueAbre: 80 })).toBeNull();
	});

	it('SEM o catalogo, DEIXA clicar - recusar por falta de dado seria inventar', () => {
		// O catalogo do Mapa de Caca pode nao ter chegado ainda. Bloquear aqui
		// poria na tela uma tranca que o servidor talvez nem aplique.
		expect(motivoDeNaoViajar({ mapa: 'gl_dun01', nivelDoJogador: 1, nivelQueAbre: null })).toBeNull();
		expect(motivoDeNaoViajar({ mapa: 'gl_dun01', nivelDoJogador: 0, nivelQueAbre: 80 })).toBeNull();
	});

	it('entrada vazia nao inventa recusa', () => {
		expect(motivoDeNaoViajar(null)).toBeNull();
		expect(motivoDeNaoViajar({})).toBeNull();
	});
});

describe('a ponte por especie', () => {
	const indice = {
		'cap-01': [
			{ id: 'j-1', capitulo: 'cap-01', ordem: 2, mobId: 1002, mapa: 'prt_fild08' },
			{ id: 'j-2', capitulo: 'cap-01', ordem: 1, mobId: 1113, mapa: 'prt_fild08' }
		],
		'cap-05': [{ id: 'j-9', capitulo: 'cap-05', ordem: 1, mobId: 1002, mapa: 'pay_fild04' }]
	};

	it('junta os mapas de uma especie que vive em varios', () => {
		const achadas = missoesDaEspecie(indice, 1002);
		expect(achadas.map(m => m.mapa)).toEqual(['prt_fild08', 'pay_fild04']);
	});

	it('ordena por capitulo e depois por ordem', () => {
		const achadas = missoesDaEspecie({ 'cap-01': indice['cap-01'] }, 1113);
		expect(achadas).toHaveLength(1);
		expect(achadas[0].id).toBe('j-2');
	});

	it('especie sem missao devolve lista vazia, e nao explode', () => {
		expect(missoesDaEspecie(indice, 9999)).toEqual([]);
		expect(missoesDaEspecie(null, 1002)).toEqual([]);
		expect(missoesDaEspecie(indice, NaN)).toEqual([]);
	});
});

describe('a recompensa em texto de jogador', () => {
	it('traduz os tres tipos que o servidor manda hoje', () => {
		expect(
			recompensaEmTexto([
				{ tipo: 'expBase', quantidade: 600 },
				{ tipo: 'expClasse', quantidade: 400 }
			])
		).toBe('600 EXP de base · 400 EXP de classe');
	});

	it('tipo desconhecido SOME da frase, em vez de imprimir o campo cru', () => {
		expect(recompensaEmTexto([{ tipo: 'coisa-nova', quantidade: 1 }, { tipo: 'zeny', quantidade: 50 }])).toBe(
			'50 zeny'
		);
	});

	it('sem recompensa, frase vazia', () => {
		expect(recompensaEmTexto(null)).toBe('');
		expect(recompensaEmTexto([])).toBe('');
	});
});
