/**
 * O MODO LEITURA (09/09/2026) — a decisao, testada sem navegador.
 *
 * O modulo tem duas metades bem diferentes: a CONDICAO (pura: recebe o estado
 * e devolve sim/nao) e a PLUMBING (pedir e soltar a sentinela do wake lock,
 * escutar `visibilitychange`). Esta suite mede a primeira.
 *
 * A segunda nao se testa aqui de proposito: `navigator.wakeLock` nao existe no
 * jsdom, e um duble dele mediria o duble. Quem a mede e
 * `scripts/diag-modo-leitura.ts`, no navegador de verdade — e mesmo la fica
 * declarado que o APAGAMENTO POR INATIVIDADE so um aparelho prova.
 *
 * E a decisao mora em `decisaoDoModoLeitura.js`, e nao no modulo grande, por
 * uma razao MEDIDA: a primeira versao deste teste importava
 * `telaAcesaNoFarm.js`, que importa `IdleConfig`, que arrasta a cadeia de
 * render — e ela morreu em `Renderer/Map/Water.js` tentando WebGL no jsdom.
 */
import { describe, expect, it } from 'vitest';
import { deveManterAcesa, esperaAposRecusa } from '../../src/UI/decisaoDoModoLeitura.js';

describe('a condicao do modo leitura', () => {
	it('CONTROLE: com o Auto ligado, fora da cidade, a tela fica acesa', () => {
		// Sem este caso, todos os "false" abaixo passariam com a funcao
		// devolvendo `false` sempre — o "criterio que passa com zero" que este
		// projeto mais repete.
		expect(
			deveManterAcesa({ cacaAutomatica: true, ehCidade: false, contextoObsoleto: false, estavaAcesa: false }),
		).toBe(true);
	});

	it('com o Auto DESLIGADO, nao — e nem em campo de caca', () => {
		expect(
			deveManterAcesa({ cacaAutomatica: false, ehCidade: false, contextoObsoleto: false, estavaAcesa: true }),
		).toBe(false);
	});

	it('na CIDADE nao, mesmo com o Auto armado', () => {
		// O pedido cobra "nao consumir bateria fora do momento de uso", e
		// parado na cidade com o Auto ligado e exatamente isso: em cidade nao
		// ha populacao de mobs (D-246), entao nao ha farm acontecendo.
		expect(
			deveManterAcesa({ cacaAutomatica: true, ehCidade: true, contextoObsoleto: false, estavaAcesa: true }),
		).toBe(false);
	});

	describe('com o contexto OBSOLETO, ela mantem o que estava', () => {
		/*
		 * `contextoObsoleto` marca que o contexto na mao descreve o mapa
		 * ANTERIOR (ver o aviso em `IdleConfig.js`). Decidir com ele apagaria a
		 * tela no meio de uma viagem entre dois mapas de caca — o `ehCidade`
		 * que temos e o do mapa de onde o jogador SAIU.
		 */
		it('estava acesa: continua acesa, mesmo com `ehCidade` do mapa velho', () => {
			expect(
				deveManterAcesa({ cacaAutomatica: true, ehCidade: true, contextoObsoleto: true, estavaAcesa: true }),
			).toBe(true);
		});

		it('estava apagada: continua apagada, mesmo com `ehCidade` falso', () => {
			expect(
				deveManterAcesa({ cacaAutomatica: true, ehCidade: false, contextoObsoleto: true, estavaAcesa: false }),
			).toBe(false);
		});

		it('mas o Auto DESLIGADO ganha do obsoleto — soltar nunca e o risco', () => {
			// A guarda do obsoleto existe para nao APAGAR a tela por engano.
			// Com o Auto desligado nao ha farm nenhum, e segurar o lock ai
			// seria o desperdicio que o pedido manda evitar.
			expect(
				deveManterAcesa({ cacaAutomatica: false, ehCidade: false, contextoObsoleto: true, estavaAcesa: true }),
			).toBe(false);
		});
	});

	it('estado ausente nao acende', () => {
		expect(deveManterAcesa(null)).toBe(false);
		expect(deveManterAcesa(undefined)).toBe(false);
		expect(deveManterAcesa({})).toBe(false);
	});
});

describe('o freio depois de uma recusa', () => {
	/*
	 * Ele nasceu de uma MEDICAO, e nao de uma previsao: a
	 * `scripts/diag-modo-leitura.ts` contou 8 tentativas em 8 segundos num
	 * navegador que recusa o lock. Sem freio, o modulo pede a cada tique para
	 * sempre — e a recusa mais comum da especificacao e bateria fraca.
	 */
	it('CONTROLE: sem recusa nenhuma, nao ha espera', () => {
		// Sem este caso, uma funcao que devolvesse sempre o teto passaria em
		// todos os outros: o modo leitura nunca ligaria e nada acusaria.
		expect(esperaAposRecusa(0)).toBe(0);
	});

	it('a primeira recusa espera dois tiques do relogio', () => {
		expect(esperaAposRecusa(1)).toBe(2000);
	});

	it('cada recusa seguinte DOBRA a espera', () => {
		expect(esperaAposRecusa(2)).toBe(4000);
		expect(esperaAposRecusa(3)).toBe(8000);
		expect(esperaAposRecusa(4)).toBe(16000);
	});

	it('mas ela para de crescer no teto de um minuto', () => {
		// Sem teto, a 20a recusa pediria uma espera de 12 dias — na pratica o
		// modo leitura nunca mais voltaria, e a recusa pode ser passageira (o
		// aparelho entrou no carregador).
		expect(esperaAposRecusa(6)).toBe(60000);
		expect(esperaAposRecusa(20)).toBe(60000);
		expect(esperaAposRecusa(1000)).toBe(60000);
	});

	it('contagem sem sentido nao vira espera', () => {
		expect(esperaAposRecusa(-1)).toBe(0);
		expect(esperaAposRecusa(undefined)).toBe(0);
	});
});
