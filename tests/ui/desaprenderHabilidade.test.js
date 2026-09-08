/**
 * DESAPRENDER / REGREDIR — o pedido do dono no alfa (07/09/2026).
 *
 * *"Permita reduzir o nível de uma habilidade e desaprendê-la, devolvendo os
 * pontos correspondentes. Respeite os pré-requisitos da árvore e impeça
 * combinações inválidas. Ao desaprender, remova a habilidade dos espaços
 * equipados e atualize seus efeitos."*
 *
 * A REGRA mora no servidor (`avaliarEsquecimento`, `game/progressao.ts`, com
 * bateria de mutação própria) e a LIMPEZA também (`aoEsquecerSkill` tira das
 * duas rotações, da barra de atalhos e rederiva a ficha). O que se mede aqui é
 * a costura do cliente — que os botões existem, que a confirmação existe e que
 * o verbo sai pelo canal certo.
 *
 * Ler o fonte é o método porque levantar a `IdleSkills` puxa WebGL, o GRF e uma
 * sessão logada; o que importa neste arquivo é o CONTRATO entre a janela e o
 * servidor, e isso está no texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const js = readFileSync(join(process.cwd(), 'src/UI/Components/IdleSkills/IdleSkills.js'), 'utf8');

describe('a janela oferece o caminho de volta', () => {
	it('há um botão de UM NÍVEL e um de DESAPRENDER', () => {
		expect(js).toContain('is-btn-esquecer');
		expect(js).toContain('is-btn-desaprender');
		expect(js).toContain("data-niveis=\"1\"");
		expect(js).toContain("data-niveis=\"tudo\"");
	});

	it('a habilidade de QUEST não mostra botão — o jogo a deu de graça', () => {
		/*
		 * Devolver ponto por uma habilidade concedida seria IMPRIMIR ponto, e o
		 * servidor recusa (`naoRegridem`). Mostrar o botão seria a janela
		 * prometendo o que ele nega — o mesmo argumento do `motivoDaRotacao`.
		 */
		const trecho = js.slice(js.indexOf('function esquecerHtml'), js.indexOf('function confirmacaoDeEsquecerHtml'));
		expect(trecho).toContain('skill.deQuest');
		expect(trecho).toContain('skill.aprendido <= 0');
	});

	it('DESAPRENDER pede confirmação; o ▼ de um nível não', () => {
		/*
		 * O ▼ tira um nível e o jogador o recompra com um clique. Perder a
		 * habilidade inteira não tem esse desfazer barato — e pedir confirmação
		 * a cada seta seria a janela atrapalhando.
		 */
		const trecho = js.slice(js.indexOf('function onClickEsquecer'), js.indexOf('function onClickRotacao'));
		expect(trecho).toContain("dataset.niveis === 'tudo'");
		expect(trecho).toContain('_confirmandoEsquecer = skillId');
		expect(trecho).toContain('sendEsquecer(skillId, 1)');
	});

	it('o verbo vai no MESMO canal da árvore, com `acao`', () => {
		// Um opcode por botão é o caminho mais curto para a faixa RAGIDLE
		// encher de novo — ela já ficou cheia uma vez.
		const trecho = js.slice(js.indexOf('function sendEsquecer'), js.indexOf('function sendPriorizar'));
		expect(trecho).toContain("acao: 'esquecer'");
		expect(trecho).toContain('PACKET.CZ.RAGIDLE_APRENDER');
	});

	it('a janela NÃO reimplementa a regra de pré-requisito', () => {
		/*
		 * Quem decide é `avaliarEsquecimento`, no servidor, e a recusa chega em
		 * `problemas`. Uma segunda leitura aqui divergiria no dia em que a
		 * regra mudasse — e o jogador veria dois vereditos para o mesmo clique.
		 */
		const trecho = js.slice(js.indexOf('function esquecerHtml'), js.indexOf('function confirmacaoDeEsquecerHtml'));
		expect(trecho).not.toContain('preRequisitos');
	});
});

/*
 * "PRIMEIROS SOCORROS VOLTA SOZINHA AO TROCAR DE MAPA" — a metade do cliente.
 *
 * O mecanismo inteiro está descrito em
 * `servidor/mapa/config-nao-ecoa-velha.test.ts`: o servidor gravava a config
 * por nove caminhos sem avisar o cliente, e o botão de Caçar reenviava a cópia
 * velha — com a skill que o jogador tinha acabado de tirar.
 *
 * O conserto do servidor é empurrar a config a cada gravação. Do lado de cá,
 * duas coisas precisam continuar valendo, e as duas estão medidas aqui.
 */
describe('a config do cliente não ecoa uma cópia velha', () => {
	const cfg = readFileSync(join(process.cwd(), 'src/UI/Components/IdleConfig/IdleConfig.js'), 'utf8');

	it('o botão de Caçar monta o pedido a partir do `serverConfig`', () => {
		/*
		 * É este o passo que ecoa. Ele não vai mudar — mandar um delta exigiria
		 * outro contrato de pacote, e o `aplicar` é transacional de propósito —,
		 * e por isso o `serverConfig` tem de estar fresco.
		 */
		const inicio = cfg.indexOf('function alternarCacaAutomatica');
		const corte = cfg.indexOf(String.fromCharCode(10) + 'function ', inicio + 10);
		const trecho = cfg.slice(inicio, corte);
		expect(trecho).toContain('IdleConfig.serverConfig');
	});

	it('o empurrão do servidor atualiza a BASE sem apagar o rascunho', () => {
		/*
		 * Com o empurrão a cada gravação, adotar o pacote inteiro apagaria a
		 * edição em curso do jogador várias vezes por sessão. A base anda
		 * sempre (é ela que o botão de Caçar usa); o rascunho, só quando não há
		 * rascunho a perder.
		 */
		const inicio = cfg.indexOf('function onConfigReceived');
		const trecho = cfg.slice(inicio, cfg.indexOf(String.fromCharCode(10) + 'function ', inicio + 10));
		expect(trecho).toContain('IdleConfig.serverConfig = data.config;');
		expect(trecho).toContain('IdleConfig.dirty && !isApplyResponse');
	});
});
