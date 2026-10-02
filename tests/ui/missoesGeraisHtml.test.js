/**
 * A ABA "MISSÕES GERAIS" (16/09/2026).
 *
 * O que este arquivo mede é o mesmo tipo de coisa que `jornadaDeMidgard.test.js`
 * mede para a Jornada: as regras PURAS, não o desenho (o desenho tem prova de
 * tela, `docs/provas-jornada/`). O caso que mais importa aqui é o da
 * PRIORIDADE do contador — achado ao fotografar a integração pela primeira
 * vez, e não por leitura de código: "Recarga de Poções" em recarga mostrava
 * "0 de 10" em vez de "5 min" na primeira versão.
 */
import { describe, expect, it } from 'vitest';

import { contadorDaLinha, cliqueDeMissoesGerais } from '../../src/UI/Components/CodexIdle/missoesGeraisHtml.js';

describe('contadorDaLinha: o que a linha da lista mostra ao lado do glifo', () => {
	it('em recarga, mostra o tempo — NÃO o progresso do objetivo (o achado da foto)', () => {
		const missao = { cooldownS: 245, naFila: false, objetivos: [{ progresso: 0, alvo: 10 }] };
		expect(contadorDaLinha(missao)).toEqual({ texto: '5 min' });
	});

	/*
	 * 01/10/2026: a FILA saiu (até três missões andam juntas) — "Na fila" não
	 * existe mais. No lugar dela, a PRONTA diz "Pronta": é a ação que o jogador
	 * tem a fazer, e o "8 de 8" do objetivo não a nomeia.
	 */
	it('pronta para finalizar, mostra "Pronta" — antes do progresso do objetivo', () => {
		const missao = { cooldownS: 0, pronta: true, objetivos: [{ progresso: 8, alvo: 8 }] };
		expect(contadorDaLinha(missao)).toEqual({ texto: 'Pronta' });
	});

	it('o `naFila` de um pacote antigo não pinta mais "Na fila"', () => {
		const missao = { cooldownS: 0, naFila: true, objetivos: [{ progresso: 3, alvo: 10 }] };
		expect(contadorDaLinha(missao)).toEqual({ texto: '3 de 10' });
	});

	it('sem trava nenhuma, mostra o progresso do objetivo único', () => {
		const missao = { cooldownS: 0, naFila: false, objetivos: [{ progresso: 24, alvo: 50 }] };
		expect(contadorDaLinha(missao)).toEqual({ texto: '24 de 50' });
	});

	it('com MAIS de um objetivo, não inventa qual mostrar — devolve null', () => {
		const missao = {
			cooldownS: 0,
			naFila: false,
			objetivos: [
				{ progresso: 1, alvo: 3 },
				{ progresso: 0, alvo: 1 }
			]
		};
		expect(contadorDaLinha(missao)).toBeNull();
	});

	it('sem objetivo nenhum (a Troca de Classe), devolve null — a linha fica só com o glifo', () => {
		expect(contadorDaLinha({ cooldownS: 0, naFila: false, objetivos: [] })).toBeNull();
	});

	it('o arredondamento da recarga é PARA CIMA — 245s não pode virar "4 min" (viraria 0 antes de acabar)', () => {
		expect(contadorDaLinha({ cooldownS: 61, naFila: false, objetivos: [] })).toEqual({ texto: '2 min' });
		expect(contadorDaLinha({ cooldownS: 60, naFila: false, objetivos: [] })).toEqual({ texto: '1 min' });
	});
});

describe('cliqueDeMissoesGerais: a delegação de clique', () => {
	/** Um alvo falso o bastante para `closest` funcionar nos testes. */
	function elementoComAtributo(atributo, valor) {
		return {
			closest(seletor) {
				const chave = seletor.replace(/^\[|\]$/g, '').split('=')[0];
				if (chave !== atributo) return null;
				return { dataset: { [paraCamel(atributo)]: valor } };
			}
		};
	}
	function paraCamel(attr) {
		return attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
	}
	function evento() {
		let parado = false;
		return {
			stopImmediatePropagation() {
				parado = true;
			},
			get parado() {
				return parado;
			}
		};
	}

	it('uma linha de missão abre a missão, e para a propagação', () => {
		const chamadas = [];
		const e = evento();
		const tratado = cliqueDeMissoesGerais(e, elementoComAtributo('data-mg-missao', 'primeiros-passos'), {
			abrirMissao: id => chamadas.push(['abrir', id])
		});
		expect(tratado).toBe(true);
		expect(e.parado).toBe(true);
		expect(chamadas).toEqual([['abrir', 'primeiros-passos']]);
	});

	it('o botão de ação manda "executar" com a ação e o id', () => {
		// 01/10/2026: o "Pausar" daqui estava morto (o servidor tirou o verbo);
		// virou "Ir caçar" (`teleporte`), e TODA ação leva o id da missão.
		const chamadas = [];
		const alvo = {
			closest(seletor) {
				return seletor === '[data-mg-executar]'
					? { disabled: false, dataset: { mgExecutar: 'teleporte', mgId: 'primeiros-passos' } }
					: null;
			}
		};
		cliqueDeMissoesGerais(evento(), alvo, { executar: (acao, id) => chamadas.push([acao, id]) });
		expect(chamadas).toEqual([['teleporte', 'primeiros-passos']]);
	});

	it('o botão APAGADO ("Finalizar" sem os objetivos, o "3 de 3") não manda nada, mas o clique é tratado', () => {
		const chamadas = [];
		const e = evento();
		const alvo = {
			closest(seletor) {
				return seletor === '[data-mg-executar]'
					? { disabled: true, dataset: { mgExecutar: 'finalizar', mgId: 'primeiros-passos' } }
					: null;
			}
		};
		const tratado = cliqueDeMissoesGerais(e, alvo, { executar: (acao, id) => chamadas.push([acao, id]) });
		expect(chamadas).toEqual([]);
		expect(tratado).toBe(true);
		expect(e.parado).toBe(true);
	});

	it('um alvo que não bate com nenhum gancho não é tratado (falso), e a propagação segue', () => {
		const e = evento();
		const tratado = cliqueDeMissoesGerais(e, elementoComAtributo('data-outra-coisa', 'x'), {});
		expect(tratado).toBe(false);
		expect(e.parado).toBe(false);
	});
});
