/**
 * A ÁRVORE DE HABILIDADES — a parte provável dela (D-792, 31/08/2026).
 *
 * `IdleSkills.js` é DOM, pacote e preferência: só a pilha ao vivo e a foto o
 * julgam. Mas duas coisas dentro dele são função pura, e são justamente as duas
 * que erradas produzem um defeito MUDO:
 *
 * 1. **O plano** (`montarPlano`). Um nó na coluna errada não levanta exceção
 *    nenhuma — ele desenha um fio andando para trás, e o jogador conclui que a
 *    árvore do jogo é aquela. A regra que este arquivo prende é a que evita
 *    isso: coluna = caminho MAIS LONGO até a raiz, nunca o mais curto.
 * 2. **O juiz do rascunho** (`avaliarSubir`/`avaliarDescer`). Ele é a segunda
 *    rota de `avaliarAprendizado` (`game/progressao.ts`), e o que ele erra vira
 *    uma seta acesa que o "Aplicar" recusa. A ORDEM das recusas é copiada do
 *    servidor de propósito, e há caso para ela: duas rotas que recusam pelo
 *    mesmo motivo em ordem diferente dizem frases diferentes para o mesmo
 *    clique.
 *
 * Os dublês abaixo são payloads do contrato v2, escritos à mão. É o certo aqui:
 * a pergunta é sobre a GEOMETRIA e sobre a ORDEM DAS RECUSAS, e as duas se
 * respondem melhor com uma árvore que cabe na cabeça do que com a do Cavaleiro.
 * Quem cobre o dado real é `grau-da-habilidade.test.ts`, no repo do servidor.
 */
import { describe, expect, it } from 'vitest';
import {
	COL_W,
	NO_L,
	ROW_H,
	avaliarDescer,
	avaliarSubir,
	montarPlano,
	nivelEfetivo,
	ordemDoLote,
	pontosNoRascunho
} from 'UI/Components/IdleSkills/arvoreDeSkills.js';

/** Uma habilidade do contrato v2, com os campos que a árvore lê. */
function skill(skillId, extra) {
	return Object.assign(
		{
			skillId: skillId,
			nome: skillId,
			descricao: [],
			categoria: 'ativa',
			aprendido: 0,
			nivelMaximo: 10,
			mecanica: [],
			podeAprender: true,
			motivo: null,
			custo: 1,
			portada: true,
			semEfeitoDeCombate: false,
			naRotacao: null,
			motivoDaRotacao: null,
			preRequisitos: [],
			nivelBaseMinimo: 0,
			nivelClasseMinimo: 0,
			grau: 1,
			aceitaPeloMotor: true
		},
		extra || {}
	);
}

function indice(skills) {
	return new Map(skills.map(s => [s.skillId, s]));
}

function contexto(skills, extra) {
	return Object.assign(
		{
			porId: indice(skills),
			rascunho: {},
			pontos: 10,
			nivelBase: 99,
			nivelDeJob: 50
		},
		extra || {}
	);
}

describe('montarPlano — onde cada habilidade cai', () => {
	it('põe a raiz na coluna 0 e o filho na 1, e liga um fio entre os dois', () => {
		const skills = [skill('RAIZ'), skill('FILHO', { preRequisitos: [{ skillId: 'RAIZ', nivel: 5 }] })];
		const plano = montarPlano(skills, indice(skills));

		const porNome = new Map(plano.nos.map(no => [no.skill.skillId, no]));
		expect(porNome.get('RAIZ').coluna).toBe(0);
		expect(porNome.get('FILHO').coluna).toBe(1);
		expect(plano.fios).toHaveLength(1);
		expect(plano.fios[0].de).toBe('RAIZ');
		expect(plano.fios[0].para).toBe('FILHO');
		expect(plano.fios[0].nivel).toBe(5);
	});

	it('COLUNA É O CAMINHO MAIS LONGO — o fio nunca anda para trás', () => {
		/*
		 * ESTE É O CASO QUE JUSTIFICA O ARQUIVO. `NETO` exige a raiz E o filho.
		 * Pelo caminho MAIS CURTO ele estaria na coluna 1, ao lado de `FILHO` —
		 * e o fio de FILHO para NETO sairia da coluna 1 para a coluna 1, ou seja,
		 * andaria para trás no desenho. Nada acusaria: a janela abre, os ícones
		 * aparecem, e a árvore mente sobre a ordem.
		 */
		const skills = [
			skill('RAIZ'),
			skill('FILHO', { preRequisitos: [{ skillId: 'RAIZ', nivel: 1 }] }),
			skill('NETO', {
				preRequisitos: [
					{ skillId: 'RAIZ', nivel: 1 },
					{ skillId: 'FILHO', nivel: 3 }
				]
			})
		];
		const plano = montarPlano(skills, indice(skills));
		const porNome = new Map(plano.nos.map(no => [no.skill.skillId, no]));

		expect(porNome.get('NETO').coluna).toBe(2);
		for (const fio of plano.fios) {
			expect(fio.x2, fio.de + ' -> ' + fio.para + ' anda para trás').toBeGreaterThan(fio.x1);
		}
	});

	it('não empilha dois nós no mesmo lugar', () => {
		const skills = [
			skill('A'),
			skill('B'),
			skill('C'),
			skill('D', { preRequisitos: [{ skillId: 'A', nivel: 1 }] }),
			skill('E', { preRequisitos: [{ skillId: 'A', nivel: 1 }] })
		];
		const plano = montarPlano(skills, indice(skills));
		const casas = plano.nos.map(no => no.coluna + ':' + no.linha);
		expect(new Set(casas).size, 'dois nós na mesma casa').toBe(casas.length);
	});

	it('EMPACOTA sem deixar linha vazia — o indice na arvore nao e uma linha', () => {
		/*
		 * MEDIDO na arvore real do Cavaleiro, e por isso este caso existe: a
		 * primeira versao usava o INDICE na arvore como piso da linha quando o no
		 * nao tinha pai colocado. As raizes do Cavaleiro estao nos indices 0, 5, 6
		 * e 8 — o plano saia com **10 linhas para 10 nos**, quatro delas
		 * inteiramente vazias, e a aba abria mostrando 400px de nada antes da
		 * primeira habilidade. Nada acusava: os fios estavam certos, os nos
		 * estavam certos, e o desenho era so feio.
		 *
		 * Os indices aqui sao esparsos de proposito (0, 5, 6, 8), que e a forma
		 * exata do dado que produziu o defeito.
		 */
		const skills = [
			skill('R0'),
			skill('F1', { preRequisitos: [{ skillId: 'R0', nivel: 1 }] }),
			skill('F2', { preRequisitos: [{ skillId: 'R0', nivel: 1 }] }),
			skill('F3', { preRequisitos: [{ skillId: 'R0', nivel: 1 }] }),
			skill('F4', { preRequisitos: [{ skillId: 'R0', nivel: 1 }] }),
			skill('R5'),
			skill('R6'),
			skill('F7', { preRequisitos: [{ skillId: 'R6', nivel: 1 }] }),
			skill('R8')
		];
		const plano = montarPlano(skills, indice(skills));

		const ocupadas = new Set(plano.nos.map(no => no.linha));
		const maiorLinha = Math.max(...plano.nos.map(no => no.linha));
		expect(
			ocupadas.size,
			'ha linha vazia no meio do plano: ' + maiorLinha + ' linhas para ' + ocupadas.size + ' ocupadas'
		).toBe(maiorLinha + 1);

		// As quatro raizes ocupam as quatro primeiras linhas da coluna 0.
		const naColunaZero = plano.nos.filter(no => no.coluna === 0).map(no => no.linha).sort();
		expect(naColunaZero).toEqual([0, 1, 2, 3]);
	});

	it('o plano é grande o bastante para caber todo mundo', () => {
		const skills = [
			skill('A'),
			skill('B'),
			skill('C', { preRequisitos: [{ skillId: 'A', nivel: 1 }] })
		];
		const plano = montarPlano(skills, indice(skills));
		for (const no of plano.nos) {
			expect(no.x).toBeLessThan(plano.largura);
			expect(no.y).toBeLessThan(plano.altura);
		}
		expect(plano.largura).toBeGreaterThanOrEqual(2 * COL_W);
		expect(plano.altura).toBeGreaterThanOrEqual(2 * ROW_H);
	});

	it('fios que entram na MESMA coluna nao dividem a mesma vertical', () => {
		/*
		 * Visto no print da arvore do Cavaleiro: dois fios com o mesmo `xm`
		 * desciam na mesma vertical e viravam UM tronco verde atravessando a aba
		 * — da para ver que ha ligacao, e nao da para ver de onde para onde.
		 */
		const skills = [
			skill('A'),
			skill('B'),
			skill('C', { preRequisitos: [{ skillId: 'A', nivel: 1 }] }),
			skill('D', { preRequisitos: [{ skillId: 'B', nivel: 1 }] })
		];
		const plano = montarPlano(skills, indice(skills));
		expect(plano.fios).toHaveLength(2);
		const verticais = plano.fios.map(fio => fio.xm);
		expect(new Set(verticais).size, 'fios fundidos na mesma vertical: ' + verticais.join(', ')).toBe(2);
		// E cada vertical continua DENTRO do vao entre as colunas.
		for (const fio of plano.fios) {
			expect(fio.xm).toBeGreaterThan(fio.x1);
			expect(fio.xm).toBeLessThan(fio.x2);
		}
	});

	it('fio de MAIS DE UM VAO desce a vertical no vao do DESTINO', () => {
		/*
		 * O caso da Barreira Magica do Mago: `NETO` exige a raiz (coluna 0) e o
		 * filho (coluna 1), entao esta na coluna 2 — e o fio RAIZ -> NETO
		 * atravessa dois vaos. A vertical dele tem de descer no vao ENCOSTADO no
		 * destino: ancorada no pai, ela caia no primeiro vao, junto das faixas
		 * de OUTRO grupo (distribuidas sem saber dele), e o trecho horizontal
		 * corria na altura do filho riscando a coluna do meio inteira.
		 */
		const skills = [
			skill('RAIZ'),
			skill('FILHO', { preRequisitos: [{ skillId: 'RAIZ', nivel: 1 }] }),
			skill('NETO', {
				preRequisitos: [
					{ skillId: 'RAIZ', nivel: 1 },
					{ skillId: 'FILHO', nivel: 3 }
				]
			})
		];
		const plano = montarPlano(skills, indice(skills));
		const longo = plano.fios.find(fio => fio.de === 'RAIZ' && fio.para === 'NETO');
		expect(longo).toBeDefined();
		// Dentro do vao imediatamente a esquerda do destino, nunca no primeiro.
		expect(longo.xm).toBeGreaterThan(longo.x2 - (COL_W - NO_L));
		expect(longo.xm).toBeLessThan(longo.x2);
	});

	it('requisito de OUTRO degrau vira selo, e nunca um fio saindo do vazio', () => {
		/*
		 * O Cavaleiro exige `SM_BASH` do Espadachim, que mora em outra aba. Um
		 * fio para ele sairia de um nó que não está desenhado — e o `montarPlano`
		 * o devolve como `forasteiro` justamente para o nó poder dizer isso.
		 */
		const daAba = [skill('KN_BOWLINGBASH', { grau: 2, preRequisitos: [{ skillId: 'SM_BASH', nivel: 5 }] })];
		const todas = indice([daAba[0], skill('SM_BASH', { grau: 1, nome: 'Golpe Brutal' })]);
		const plano = montarPlano(daAba, todas);

		expect(plano.fios).toHaveLength(0);
		expect(plano.nos[0].forasteiros).toEqual([
			{ skillId: 'SM_BASH', nivel: 5, nome: 'Golpe Brutal' }
		]);
	});

	it('não trava com um ciclo — payload torto não pode congelar a aba', () => {
		const skills = [
			skill('A', { preRequisitos: [{ skillId: 'B', nivel: 1 }] }),
			skill('B', { preRequisitos: [{ skillId: 'A', nivel: 1 }] })
		];
		const plano = montarPlano(skills, indice(skills));
		expect(plano.nos).toHaveLength(2);
	});
});

describe('avaliarSubir — o juiz do rascunho', () => {
	it('deixa subir quando não falta nada', () => {
		const skills = [skill('A')];
		expect(avaliarSubir(skills[0], contexto(skills)).ok).toBe(true);
	});

	it('recusa no teto, e o teto é o DA ÁRVORE DA CLASSE', () => {
		const skills = [skill('A', { aprendido: 3, nivelMaximo: 3 })];
		const veredito = avaliarSubir(skills[0], contexto(skills));
		expect(veredito.ok).toBe(false);
		expect(veredito.motivo).toMatch(/nível máximo/);
	});

	it('recusa por nível base e por nível de classe, cada um com a sua frase', () => {
		const skills = [skill('A', { nivelBaseMinimo: 50, nivelClasseMinimo: 40 })];
		const base = avaliarSubir(skills[0], contexto(skills, { nivelBase: 10, nivelDeJob: 99 }));
		expect(base.motivo).toMatch(/nível base 50/);

		const job = avaliarSubir(skills[0], contexto(skills, { nivelBase: 99, nivelDeJob: 10 }));
		expect(job.motivo).toMatch(/nível de classe 40/);
	});

	it('recusa por pré-requisito, e nomeia a habilidade que falta pelo NOME', () => {
		const skills = [
			skill('PAI', { nome: 'Golpe Brutal' }),
			skill('FILHO', { preRequisitos: [{ skillId: 'PAI', nivel: 5 }] })
		];
		const veredito = avaliarSubir(skills[1], contexto(skills));
		expect(veredito.ok).toBe(false);
		expect(veredito.motivo).toContain('Golpe Brutal');
		expect(veredito.motivo).toMatch(/não aprendeu/);
	});

	it('O RASCUNHO DESTRAVA O FILHO — é a razão de este juiz existir', () => {
		/*
		 * O servidor só sabe responder sobre o estado de HOJE. Assim que o
		 * jogador põe cinco pontos no pai, o pai está no 5 em lugar nenhum — e
		 * alguém tem de dizer que o filho já pode. É este caso.
		 */
		const skills = [
			skill('PAI'),
			skill('FILHO', { preRequisitos: [{ skillId: 'PAI', nivel: 5 }] })
		];
		const comRascunho = contexto(skills, { rascunho: { PAI: 5 } });
		expect(avaliarSubir(skills[1], comRascunho).ok).toBe(true);
	});

	it('conta o rascunho no saldo de pontos', () => {
		const skills = [skill('A')];
		const semSaldo = contexto(skills, { pontos: 2, rascunho: { A: 2 } });
		const veredito = avaliarSubir(skills[0], semSaldo);
		expect(veredito.ok).toBe(false);
		expect(veredito.motivo).toMatch(/ponto de habilidade sobrando/);
	});

	it('a TRANCA DO MOTOR é a última da fila — a ordem é copiada do servidor', () => {
		/*
		 * Uma habilidade que o motor não aceita E cujo pré-requisito falta tem
		 * DUAS recusas possíveis. O servidor diz a do pré-requisito (regra do
		 * Ragnarok vem antes da divergência deste projeto, D-442), e esta janela
		 * tem de dizer a mesma — senão o jogador lê duas explicações diferentes
		 * para o mesmo botão morto, dependendo de onde clicou.
		 */
		const skills = [
			skill('PAI', { nome: 'Golpe Brutal' }),
			skill('FILHO', {
				preRequisitos: [{ skillId: 'PAI', nivel: 5 }],
				aceitaPeloMotor: false
			})
		];
		expect(avaliarSubir(skills[1], contexto(skills)).motivo).toContain('Golpe Brutal');

		// Com o pré-requisito cumprido, aí sim a tranca do motor aparece.
		const cumprido = contexto(skills, { rascunho: { PAI: 5 } });
		expect(avaliarSubir(skills[1], cumprido).motivo).toMatch(/motor de combate/);
	});
});

describe('avaliarDescer — a seta ◀ desfaz rascunho, e só', () => {
	it('recusa desfazer o que já foi aprendido', () => {
		const skills = [skill('A', { aprendido: 3 })];
		const veredito = avaliarDescer(skills[0], contexto(skills));
		expect(veredito.ok).toBe(false);
		expect(veredito.motivo).toMatch(/não devolve ponto/);
	});

	it('deixa tirar o que está no rascunho', () => {
		const skills = [skill('A', { aprendido: 3 })];
		expect(avaliarDescer(skills[0], contexto(skills, { rascunho: { A: 2 } })).ok).toBe(true);
	});

	it('NÃO DEIXA ÓRFÃO: recusa tirar o ponto de que outro rascunho depende', () => {
		const skills = [
			skill('PAI'),
			skill('FILHO', { nome: 'Investida', preRequisitos: [{ skillId: 'PAI', nivel: 5 }] })
		];
		const ctx = contexto(skills, { rascunho: { PAI: 5, FILHO: 1 } });
		const veredito = avaliarDescer(skills[0], ctx);
		expect(veredito.ok).toBe(false);
		expect(veredito.motivo).toContain('Investida');
	});

	it('deixa tirar assim que o dependente sai do rascunho', () => {
		const skills = [
			skill('PAI'),
			skill('FILHO', { preRequisitos: [{ skillId: 'PAI', nivel: 5 }] })
		];
		expect(avaliarDescer(skills[0], contexto(skills, { rascunho: { PAI: 5 } })).ok).toBe(true);
	});
});

describe('ordemDoLote — pai antes de filho', () => {
	it('manda o pré-requisito na frente, seja qual for a ordem do rascunho', () => {
		const skills = [
			skill('PAI'),
			skill('FILHO', { preRequisitos: [{ skillId: 'PAI', nivel: 5 }] })
		];
		// O rascunho tem o FILHO primeiro de propósito: é a ordem em que o objeto
		// ficaria se o jogador clicasse no filho antes de descobrir o requisito.
		const lote = ordemDoLote(indice(skills), { FILHO: 1, PAI: 5 });
		expect(lote.map(p => p.skillId)).toEqual(['PAI', 'FILHO']);
		expect(lote[0].niveis).toBe(5);
	});

	it('ignora quem não está no rascunho e não repete ninguém', () => {
		const skills = [
			skill('A'),
			skill('B', { preRequisitos: [{ skillId: 'A', nivel: 1 }] }),
			skill('C', { preRequisitos: [{ skillId: 'A', nivel: 1 }] })
		];
		const lote = ordemDoLote(indice(skills), { B: 1, C: 2 });
		expect(lote.map(p => p.skillId).sort()).toEqual(['B', 'C']);
	});

	it('não trava com ciclo', () => {
		const skills = [
			skill('A', { preRequisitos: [{ skillId: 'B', nivel: 1 }] }),
			skill('B', { preRequisitos: [{ skillId: 'A', nivel: 1 }] })
		];
		expect(ordemDoLote(indice(skills), { A: 1, B: 1 })).toHaveLength(2);
	});
});

describe('as contas do rascunho', () => {
	it('nivelEfetivo soma o aprendido com o rascunho', () => {
		expect(nivelEfetivo(skill('A', { aprendido: 3 }), { A: 2 })).toBe(5);
		expect(nivelEfetivo(skill('A', { aprendido: 3 }), {})).toBe(3);
	});

	it('pontosNoRascunho soma tudo o que está comprometido', () => {
		expect(pontosNoRascunho({ A: 3, B: 2 })).toBe(5);
		expect(pontosNoRascunho({})).toBe(0);
	});
});
