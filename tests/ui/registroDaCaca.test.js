/**
 * O REGISTRO DAS CAÇADAS (Análise de Caça).
 *
 * O que estes casos guardam não é "a soma soma" — é a lista de coisas que a
 * janela tem o direito de AFIRMAR. Um analisador é uma tela feita inteira de
 * números derivados, e o modo de falha dele não é quebrar: é mostrar um
 * número com toda a seriedade quando não havia amostra para calculá-lo.
 *
 * Três casos abaixo existem só por causa disso — o ritmo antes de haver
 * tempo medido, a taxa de item sem abate nenhum, e a estimativa de nível com
 * ritmo zero. Nos três a resposta certa é `null`, e a errada é um número.
 *
 * Desde D-943 o registro tem CICLO DE VIDA (entrar no mapa de caça inicia,
 * morrer ou voltar à cidade trava, reentrar arquiva e recomeça) e um
 * HISTÓRICO das 2 últimas caçadas — os dois blocos novos no fim cobrem as
 * transições uma a uma, inclusive as que NÃO podem acontecer (situação
 * desconhecida transicionando, evento ressuscitando caçada travada).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	HISTORICO_MAX,
	MS_MINIMOS_PARA_RITMO,
	atualizarSituacao,
	ehDropDeCaca,
	estimarMsAteONivel,
	ler,
	lerHistorico,
	registrarAbate,
	registrarExp,
	registrarItem,
	zerar,
	zerarCacadaAtual
} from 'UI/Components/HuntAnalyzer/registroDaCaca.js';

const EU = 2000001;
const OUTRO = 2000002;
const T0 = 1_000_000;

/** Um instante confortavelmente além da janela mínima de medida. */
const T_MEDIDO = T0 + MS_MINIMOS_PARA_RITMO;

/** As situações que o tique da janela entrega ao registro. */
const NO_MAPA = { emMapaDeCaca: true, morto: false, mapa: 'prt_fild08', rotuloDoMapa: 'Campos de Prontera' };
const NA_CIDADE = { emMapaDeCaca: false, morto: false, mapa: 'prontera', rotuloDoMapa: 'Prontera' };
const DESCONHECIDA = { emMapaDeCaca: null, morto: false, mapa: null, rotuloDoMapa: null };

beforeEach(() => {
	zerar();
});

describe('o relógio da medida', () => {
	it('sem situação nenhuma, começa no PRIMEIRO evento — e não no login', () => {
		// Nada aconteceu ainda: o retrato é vazio, mesmo com o tempo andando.
		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(0);
		expect(ler(EU, T0 + 60_000).fase).toBe('ociosa');

		registrarAbate(EU, 'Poring', 1002, T0 + 60_000);

		// O decorrido conta do abate, não dos 60 s parado antes dele.
		expect(ler(EU, T0 + 70_000).decorridoMs).toBe(10_000);
	});

	it('experiência ZERO não inicia a janela de medida', () => {
		registrarExp(EU, 'base', 0, T0);
		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(0);

		registrarExp(EU, 'base', 50, T0 + 60_000);
		expect(ler(EU, T0 + 70_000).decorridoMs).toBe(10_000);
	});

	it('conta há quanto tempo nada acontece', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		expect(ler(EU, T0 + 5_000).ociosoMs).toBe(5_000);
	});

	/*
	 * ESTE CASO NASCEU DE UM MUTANTE SOBREVIVENTE.
	 *
	 * Reiniciar a janela a cada evento (em vez de fixá-la no primeiro) passava
	 * nos 16 casos anteriores: todos tinham os eventos no MESMO instante,
	 * então "primeiro" e "último" coincidiam e a diferença era invisível.
	 * O ritmo viraria o instantâneo — que num idle oscila de 300/h a 20.000/h.
	 */
	it('a janela abrange do PRIMEIRO ao agora, mesmo com eventos espalhados', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 30_000);

		expect(ler(EU, T0 + 60_000).decorridoMs).toBe(60_000);
		// ...e o ocioso continua medindo a partir do ÚLTIMO: são coisas diferentes.
		expect(ler(EU, T0 + 60_000).ociosoMs).toBe(30_000);
	});
});

describe('o ritmo por hora', () => {
	it('é null enquanto a janela medida for curta demais', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarExp(EU, 'base', 100, T0);

		const cedo = ler(EU, T0 + MS_MINIMOS_PARA_RITMO - 1);

		// O ponto do caso: 1 abate em 1 ms projetaria 3.600.000 abates/hora, e
		// a tela mostraria isso sem piscar.
		expect(cedo.abatesPorHora).toBeNull();
		expect(cedo.expBasePorHora).toBeNull();
		expect(cedo.itensPorHora).toBeNull();
		// ...mas o ACUMULADO é real desde o primeiro evento, e aparece.
		expect(cedo.abatesTotal).toBe(1);
		expect(cedo.expBase).toBe(100);
	});

	it('aparece assim que há janela, e a conta é a proporção', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, 'Lunatic', 1063, T0);
		registrarExp(EU, 'base', 300, T0);
		registrarExp(EU, 'classe', 100, T0);

		// 10 s medidos = 1/360 de hora. 2 abates -> 720/h; 300 exp -> 108.000/h.
		const r = ler(EU, T_MEDIDO);
		expect(r.abatesPorHora).toBeCloseTo(720, 6);
		expect(r.expBasePorHora).toBeCloseTo(108_000, 6);
		expect(r.expClassePorHora).toBeCloseTo(36_000, 6);
	});

	it('base e classe são somadas em trilhos separados', () => {
		registrarExp(EU, 'base', 500, T0);
		registrarExp(EU, 'classe', 7, T0);

		const r = ler(EU, T_MEDIDO);
		expect(r.expBase).toBe(500);
		expect(r.expClasse).toBe(7);
	});
});

describe('o ranking de monstro', () => {
	it('ordena do mais morto para o menos', () => {
		registrarAbate(EU, 'Lunatic', 1063, T0);
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, 'Fabre', 1007, T0);
		registrarAbate(EU, 'Fabre', 1007, T0);

		expect(ler(EU, T_MEDIDO).ranking).toEqual([
			{ nome: 'Poring', abates: 3, mobId: 1002 },
			{ nome: 'Fabre', abates: 2, mobId: 1007 },
			{ nome: 'Lunatic', abates: 1, mobId: 1063 }
		]);
	});

	it('guarda o mobId para o avatar; sem id vale null, e o primeiro visto fica', () => {
		// Chamador sem identidade não quebra nada — a linha sai sem avatar.
		registrarAbate(EU, 'Poring', null, T0);
		expect(ler(EU, T_MEDIDO).ranking).toEqual([{ nome: 'Poring', abates: 1, mobId: null }]);

		// O id que chegar depois preenche o buraco em vez de ser jogado fora.
		registrarAbate(EU, 'Poring', 1002, T0);
		expect(ler(EU, T_MEDIDO).ranking).toEqual([{ nome: 'Poring', abates: 2, mobId: 1002 }]);
	});

	it('mob sem nome vai para um balde EXPLÍCITO, e não some da contagem', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarAbate(EU, '', null, T0);

		const r = ler(EU, T_MEDIDO);
		// O total continua honesto: 2 morreram, e o ranking diz onde foi o
		// segundo. Descartar o anônimo faria total e ranking divergirem.
		expect(r.abatesTotal).toBe(2);
		expect(r.ranking).toContainEqual({ nome: 'Nao identificado', abates: 1, mobId: null });
	});
});

describe('os itens e a taxa observada', () => {
	it('soma por nome e ordena pela quantidade', () => {
		registrarItem(EU, 'Jellopy', 3, 909, T0);
		registrarItem(EU, 'Poção Vermelha', 1, 501, T0);
		registrarItem(EU, 'Jellopy', 2, 909, T0);

		expect(ler(EU, T_MEDIDO).itens).toEqual([
			{ nome: 'Jellopy', quantidade: 5, itid: 909 },
			{ nome: 'Poção Vermelha', quantidade: 1, itid: 501 }
		]);
	});

	it('guarda o ITID para o ícone; sem id vale null, e o primeiro id visto fica', () => {
		// Chamador antigo (sem id) não quebra nada — o quadrado sai com a
		// inicial em vez de um ícone quebrado.
		registrarItem(EU, 'Jellopy', 1, null, T0);
		expect(ler(EU, T_MEDIDO).itens).toEqual([{ nome: 'Jellopy', quantidade: 1, itid: null }]);

		// O id que chegar depois preenche o buraco em vez de ser jogado fora.
		registrarItem(EU, 'Jellopy', 1, 909, T0);
		expect(ler(EU, T_MEDIDO).itens).toEqual([{ nome: 'Jellopy', quantidade: 2, itid: 909 }]);
	});

	it('a taxa é null sem abate nenhum — dividir por zero não vira "0%"', () => {
		registrarItem(EU, 'Jellopy', 1, 909, T0);
		expect(ler(EU, T_MEDIDO).itensPor100Abates).toBeNull();
	});

	it('a taxa é por 100 abates, para taxa pequena não virar "0,0"', () => {
		for (let i = 0; i < 200; i += 1) {
			registrarAbate(EU, 'Poring', 1002, T0);
		}
		registrarItem(EU, 'Card', 1, 4001, T0);

		// 1 em 200 = 0,5 por 100 abates. Por ABATE seria 0,005 e a tela
		// arredondaria para zero.
		expect(ler(EU, T_MEDIDO).itensPor100Abates).toBeCloseTo(0.5, 9);
	});

	it('quantidade não-positiva é ignorada', () => {
		registrarItem(EU, 'Jellopy', 0, 909, T0);
		expect(ler(EU, T_MEDIDO).itensTotal).toBe(0);
	});
});

describe('a troca de personagem', () => {
	it('zera o registro — o ganho de um não pode virar o do outro', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		registrarExp(EU, 'base', 500, T0);
		expect(ler(EU, T_MEDIDO).abatesTotal).toBe(1);

		// Mesmo processo, outro GID: é a lição já registrada em
		// Engine/MapEngine/Main.js:206-210 para nível e zeny.
		registrarAbate(OUTRO, 'Fabre', 1007, T_MEDIDO);

		const doOutro = ler(OUTRO, T_MEDIDO + MS_MINIMOS_PARA_RITMO);
		expect(doOutro.abatesTotal).toBe(1);
		expect(doOutro.expBase).toBe(0);
	});

	it('ler com o GID errado devolve vazio, e não o registro alheio', () => {
		registrarAbate(EU, 'Poring', 1002, T0);
		expect(ler(OUTRO, T_MEDIDO).abatesTotal).toBe(0);
	});

	it('o histórico também é por personagem', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 1_000);
		atualizarSituacao(EU, NA_CIDADE, T0 + 10_000);
		atualizarSituacao(EU, NO_MAPA, T0 + 20_000);
		expect(lerHistorico(EU)).toHaveLength(1);

		// Ler com outro GID não entrega o histórico alheio...
		expect(lerHistorico(OUTRO)).toEqual([]);

		// ...e o OUTRO assumindo o registro apaga o do anterior.
		atualizarSituacao(OUTRO, NO_MAPA, T0 + 30_000);
		expect(lerHistorico(EU)).toEqual([]);
	});
});

describe('o que conta como drop da caçada', () => {
	/*
	 * ESTE BLOCO NASCEU DE UM DEFEITO NA TELA (25/08/2026).
	 *
	 * A janela listava "Poção Vermelha 200" e "Poção Azul 200" — o KIT INICIAL,
	 * que chega pelo correio. `ZC_ITEM_PICKUP_ACK` não é "o item que caiu": é a
	 * resposta a qualquer item entrando no inventário, e das cinco rotas que o
	 * servidor usa para mandá-lo, quatro não são caça (correio, loja, carrinho,
	 * armazém) — e as quatro acontecem na CIDADE.
	 */
	it('na cidade NÃO conta — é correio, loja, carrinho ou armazém', () => {
		expect(ehDropDeCaca({ ehCidade: true })).toBe(false);
	});

	it('em mapa de caça conta', () => {
		expect(ehDropDeCaca({ ehCidade: false })).toBe(true);
	});

	/*
	 * A DIREÇÃO DO ERRO É ESCOLHIDA, e estes três casos são o que a fixa.
	 *
	 * `contexto` chega por resposta do servidor e pode faltar ou atrasar um
	 * instante ao trocar de mapa. Se a dúvida virasse "não conta", esse instante
	 * DESCARTARIA drop de verdade — e some sem deixar rastro na tela. Contar a
	 * mais o jogador vê e reclama; descartar ninguém descobre.
	 */
	it('na DÚVIDA conta, em vez de descartar em silêncio', () => {
		expect(ehDropDeCaca(null), 'contexto ainda não chegou').toBe(true);
		expect(ehDropDeCaca(undefined), 'contexto ausente').toBe(true);
		expect(ehDropDeCaca({}), 'contexto sem o campo').toBe(true);
	});

	it('só o booleano TRUE bloqueia — nada de valor parecido com verdadeiro', () => {
		// Um `ehCidade: 'sim'` vindo de um contrato mudado não pode calar o
		// registro por acidente: a comparação é estrita, e a dúvida conta.
		expect(ehDropDeCaca({ ehCidade: 'sim' })).toBe(true);
		expect(ehDropDeCaca({ ehCidade: 1 })).toBe(true);
	});
});

describe('a estimativa de tempo até o nível', () => {
	it('converte o que falta no ritmo medido', () => {
		// Faltam 54.000 de exp a 108.000/h = meia hora.
		expect(estimarMsAteONivel(54_000, 108_000)).toBeCloseTo(1_800_000, 6);
	});

	it('é null quando não há resposta, em vez de Infinity ou de um número grande', () => {
		expect(estimarMsAteONivel(54_000, null)).toBeNull(); // ritmo ainda não medido
		expect(estimarMsAteONivel(54_000, 0)).toBeNull(); // parado: nunca chega
		expect(estimarMsAteONivel(0, 108_000)).toBeNull(); // o cliente não sabe o teto
	});
});

/*
 * ─── O CICLO AUTOMÁTICO (D-943) ─────────────────────────────────────────
 * Entrar no mapa de caça INICIA sozinho; morrer ou voltar à cidade TRAVA;
 * reentrar ARQUIVA e recomeça. As transições que NÃO podem acontecer estão
 * cobertas com o mesmo peso das que podem — travar por situação desconhecida
 * apagaria caçada viva na troca de mapa, e evento ressuscitando caçada
 * travada faria o cadáver "caçar".
 */
describe('o ciclo automático da caçada', () => {
	it('entrar num mapa de caça inicia a contagem sozinho, sem abate nenhum', () => {
		atualizarSituacao(EU, NO_MAPA, T0);

		const r = ler(EU, T0 + 20_000);
		expect(r.fase).toBe('ativa');
		expect(r.decorridoMs).toBe(20_000);
		expect(r.mapa).toBe('prt_fild08');
		expect(r.rotuloDoMapa).toBe('Campos de Prontera');
	});

	it('morrer TRAVA o relógio no instante da morte', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 5_000);
		atualizarSituacao(EU, { ...NO_MAPA, morto: true }, T0 + 30_000);

		// Muito depois, o retrato continua descrevendo os 30 s medidos.
		const r = ler(EU, T0 + 900_000);
		expect(r.fase).toBe('travada');
		expect(r.motivoDoFim).toBe('morte');
		expect(r.decorridoMs).toBe(30_000);
		// ...e o ritmo é sobre a janela que DE FATO foi medida.
		expect(r.abatesPorHora).toBeCloseTo((1 * 3_600_000) / 30_000, 6);
	});

	it('voltar para a cidade TRAVA, com o motivo dizendo isso', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarExp(EU, 'base', 100, T0 + 1_000);
		atualizarSituacao(EU, NA_CIDADE, T0 + 20_000);

		const r = ler(EU, T0 + 500_000);
		expect(r.fase).toBe('travada');
		expect(r.motivoDoFim).toBe('cidade');
		expect(r.expBasePorHora).toBeCloseTo((100 * 3_600_000) / 20_000, 6);
	});

	it('caçada travada IGNORA evento — mob morrendo à vista do cadáver não conta', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 1_000);
		atualizarSituacao(EU, { ...NO_MAPA, morto: true }, T0 + 2_000);

		registrarAbate(EU, 'Poring', 1002, T0 + 3_000);
		registrarExp(EU, 'base', 50, T0 + 3_000);
		registrarItem(EU, 'Jellopy', 1, 909, T0 + 3_000);

		const r = ler(EU, T0 + 10_000);
		expect(r.abatesTotal).toBe(1);
		expect(r.expBase).toBe(0);
		expect(r.itensTotal).toBe(0);
	});

	it('situação DESCONHECIDA não trava nem inicia — a troca de mapa tem um vão sem contexto', () => {
		// Desconhecida sem caçada: nada nasce.
		atualizarSituacao(EU, DESCONHECIDA, T0);
		expect(ler(EU, T0).fase).toBe('ociosa');

		// Desconhecida com caçada viva: ela segue viva. Travar aqui apagaria
		// a caçada a CADA viagem, no instante entre sondar e responder.
		atualizarSituacao(EU, NO_MAPA, T0);
		atualizarSituacao(EU, DESCONHECIDA, T0 + 5_000);
		expect(ler(EU, T0 + 5_000).fase).toBe('ativa');
	});

	it('morto NÃO inicia caçada nova, mesmo dentro do mapa de caça', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		atualizarSituacao(EU, { ...NO_MAPA, morto: true }, T0 + 5_000);
		// O tique seguinte ainda vê "no mapa, morto": a travada fica.
		atualizarSituacao(EU, { ...NO_MAPA, morto: true }, T0 + 6_000);
		expect(ler(EU, T0 + 6_000).fase).toBe('travada');
	});

	it('a sessão nascida por EVENTO adota o mapa quando o contexto chega, sem reiniciar', () => {
		// O abate chegou antes de o servidor responder a sondagem do mapa.
		registrarAbate(EU, 'Poring', 1002, T0);
		atualizarSituacao(EU, NO_MAPA, T0 + 2_000);

		const r = ler(EU, T0 + 12_000);
		expect(r.mapa).toBe('prt_fild08');
		expect(r.abatesTotal).toBe(1);
		// O relógio continua sendo o do evento — é a MESMA caçada.
		expect(r.decorridoMs).toBe(12_000);
	});

	it('pular direto para OUTRO mapa de caça encerra a caçada do primeiro', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 1_000);
		atualizarSituacao(EU, { emMapaDeCaca: true, morto: false, mapa: 'pay_fild01', rotuloDoMapa: 'Payon' }, T0 + 30_000);

		const r = ler(EU, T0 + 30_000);
		expect(r.fase).toBe('ativa');
		expect(r.mapa).toBe('pay_fild01');
		expect(r.decorridoMs).toBe(0);
		expect(r.abatesTotal).toBe(0);

		const hist = lerHistorico(EU);
		expect(hist).toHaveLength(1);
		expect(hist[0].mapa).toBe('prt_fild08');
		expect(hist[0].motivoDoFim).toBe('mapa');
	});

	it('"Zerar" numa caçada viva recomeça AGORA, no mesmo mapa, sem tocar no histórico', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 1_000);
		zerarCacadaAtual(T0 + 5_000);

		const r = ler(EU, T0 + 8_000);
		expect(r.fase).toBe('ativa');
		expect(r.abatesTotal).toBe(0);
		expect(r.decorridoMs).toBe(3_000);
		expect(r.mapa).toBe('prt_fild08');
	});

	it('"Zerar" numa caçada travada a DESCARTA — zerar é jogar fora, não arquivar', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		registrarAbate(EU, 'Poring', 1002, T0 + 1_000);
		atualizarSituacao(EU, NA_CIDADE, T0 + 10_000);
		zerarCacadaAtual(T0 + 11_000);

		expect(ler(EU, T0 + 11_000).fase).toBe('ociosa');
		expect(lerHistorico(EU)).toEqual([]);
	});
});

describe('o histórico das últimas caçadas', () => {
	/** Uma caçada completa com `n` abates, encerrada voltando à cidade. */
	function cacar(inicio, n, mapa = 'prt_fild08') {
		atualizarSituacao(EU, { emMapaDeCaca: true, morto: false, mapa, rotuloDoMapa: mapa }, inicio);
		for (let i = 0; i < n; i += 1) {
			registrarAbate(EU, 'Poring', 1002, inicio + 1_000);
		}
		atualizarSituacao(EU, NA_CIDADE, inicio + 20_000);
	}

	it('reentrar no mapa de caça arquiva a travada e recomeça do zero', () => {
		cacar(T0, 3);
		atualizarSituacao(EU, NO_MAPA, T0 + 60_000);

		const r = ler(EU, T0 + 60_000);
		expect(r.fase).toBe('ativa');
		expect(r.abatesTotal).toBe(0);
		expect(r.decorridoMs).toBe(0);

		const hist = lerHistorico(EU);
		expect(hist).toHaveLength(1);
		expect(hist[0].fase).toBe('encerrada');
		expect(hist[0].abatesTotal).toBe(3);
		// O retrato arquivado é o da janela travada: 20 s, não "até agora".
		expect(hist[0].decorridoMs).toBe(20_000);
		expect(hist[0].motivoDoFim).toBe('cidade');
	});

	it(`guarda no máximo ${HISTORICO_MAX}, mais recente primeiro`, () => {
		cacar(T0, 1);
		cacar(T0 + 100_000, 2);
		cacar(T0 + 200_000, 3);
		// A terceira reentrada arquiva a caçada de 3 abates.
		atualizarSituacao(EU, NO_MAPA, T0 + 300_000);

		const hist = lerHistorico(EU);
		expect(hist).toHaveLength(HISTORICO_MAX);
		expect(hist.map(h => h.abatesTotal)).toEqual([3, 2]);
	});

	it('caçada SEM evento nenhum não vira histórico — olhar a paisagem não é caçar', () => {
		atualizarSituacao(EU, NO_MAPA, T0);
		atualizarSituacao(EU, NA_CIDADE, T0 + 30_000);
		atualizarSituacao(EU, NO_MAPA, T0 + 60_000);

		// Um retrato todo zerado expulsaria uma caçada de verdade das 2 vagas.
		expect(lerHistorico(EU)).toEqual([]);
	});

	it('o retrato arquivado é um RETRATO — mexer na caçada nova não o altera', () => {
		cacar(T0, 2);
		atualizarSituacao(EU, NO_MAPA, T0 + 60_000);
		registrarAbate(EU, 'Fabre', 1007, T0 + 61_000);

		const hist = lerHistorico(EU);
		expect(hist[0].abatesTotal).toBe(2);
		expect(hist[0].ranking).toEqual([{ nome: 'Poring', abates: 2, mobId: 1002 }]);
	});
});
