/**
 * A PORTA DO GRUPO (D-984, 08/09/2026) — os quatro casos do dono.
 *
 * O pedido, palavra por palavra:
 *
 *   sem party + clicar "Grupo"   -> o Localizador
 *   entrar num grupo             -> o Localizador fecha e o Grupo abre sozinho
 *   com party + clicar "Grupo"   -> a janela de Grupo
 *   sair do grupo (janela aberta)-> o Grupo fecha e o Localizador abre no lugar
 *
 * As demais provas deste arquivo não são zelo: cada uma é uma armadilha que o
 * próprio enunciado nomeia, ou uma que o código antigo já tinha.
 *
 * As janelas aqui são de mentira, e é de propósito: `portaDoGrupo.js` recebe as
 * duas INJETADAS (o mesmo padrão de `GrupoIdle.aoPedirLocalizador`), então a
 * decisão inteira se prova sem subir Renderer, Network e o GRF. Se um dia ela
 * importar os componentes, este arquivo para de compilar — e isso é o portão.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Session from 'Engine/SessionStorage.js';
import PortaDoGrupo from 'UI/Components/portaDoGrupo.js';

/**
 * Uma janela com a MESMA forma das duas de verdade: `abrir`/`fechar` e uma
 * flag de MÓDULO que diz se o jogador a queria aberta. A flag é a leitura que
 * as duas janelas reais oferecem (`estavaAberta`), e não a classe `is-open` do
 * DOM — que é justamente a que já sumiu por baixo dos panos numa troca de mapa.
 */
function janelaFalsa(nome) {
	const j = {
		nome,
		aberta: false,
		abriuVezes: 0,
		fechouVezes: 0,
	};
	return {
		estado: j,
		descritor: {
			componente: { nome },
			seletor: '.' + nome + '-window',
			abrir: () => {
				j.aberta = true;
				j.abriuVezes++;
			},
			fechar: () => {
				j.aberta = false;
				j.fechouVezes++;
			},
			estaAberta: () => j.aberta,
		},
	};
}

/** O que o servidor faz: mexe em `Session.hasParty` e avisa. */
function entrouNumGrupo() {
	Session.hasParty = true;
	PortaDoGrupo.partyMudou();
}
function saiuDoGrupo() {
	Session.hasParty = false;
	PortaDoGrupo.partyMudou();
}

describe('a porta do grupo: qual janela o botão "Grupo" abre', () => {
	let lfg;
	let grupo;

	beforeEach(() => {
		PortaDoGrupo._zerar();
		lfg = janelaFalsa('lfg');
		grupo = janelaFalsa('gi');
		PortaDoGrupo.ligar({ localizador: lfg.descritor, grupo: grupo.descritor });
		// A entrada no mundo: `MapEngine` zera `hasParty` e anota.
		Session.hasParty = false;
		PortaDoGrupo.sincronizar();
	});

	// ─── OS QUATRO CASOS DO ENUNCIADO ──────────────────────────────────────



	it('entrar em party -> o LFG fecha e o Grupo abre, sem tocar em nada', () => {
		lfg.descritor.abrir(); // o jogador estava olhando a lista, pelo botao dela
		expect(lfg.estado.aberta).toBe(true);

		entrouNumGrupo();

		expect(lfg.estado.aberta).toBe(false);
		expect(grupo.estado.aberta).toBe(true);
	});



	it('sair da party com a janela ABERTA -> o Grupo fecha e o LFG abre no lugar', () => {
		entrouNumGrupo();
		expect(grupo.estado.aberta).toBe(true);

		saiuDoGrupo();

		expect(grupo.estado.aberta).toBe(false);
		expect(lfg.estado.aberta).toBe(true);
	});

	// ─── AS ARMADILHAS QUE O ENUNCIADO NOMEIA ──────────────────────────────

	it('sair da party com a janela FECHADA -> não abre NADA (a tela não é roubada)', () => {
		Session.hasParty = true;
		PortaDoGrupo.sincronizar(); // em grupo, mas caçando de janela fechada

		saiuDoGrupo();

		expect(grupo.estado.aberta).toBe(false);
		expect(lfg.estado.aberta).toBe(false);
		expect(lfg.estado.abriuVezes).toBe(0);
	});

	it('entrar por CONVITE aceito (LFG fechado) também abre a janela de Grupo', () => {
		/* Um dos dois caminhos que o dono enumerou. Aqui o Localizador nunca
		   esteve na tela — e mesmo assim a janela de Grupo tem de aparecer. */
		expect(lfg.estado.aberta).toBe(false);

		entrouNumGrupo();

		expect(grupo.estado.aberta).toBe(true);
		expect(lfg.estado.fechouVezes).toBe(0); // não fecha o que não estava aberto
	});

	it('LOGAR já em grupo NÃO abre janela nenhuma', () => {
		/*
		 * A armadilha que separa os dois verbos. `hasParty` sobe de false para
		 * true também na entrada no mundo (D-1097: o servidor manda a lista
		 * inteira, porque o cliente zera `hasParty` em todo ZC_ACCEPT_ENTER).
		 * A borda é IDÊNTICA à de "entrei num grupo" — e abrir a janela aqui
		 * seria roubar a tela de quem só entrou no jogo.
		 */
		Session.hasParty = true;
		PortaDoGrupo.sincronizar();

		expect(grupo.estado.aberta).toBe(false);
		expect(grupo.estado.abriuVezes).toBe(0);
	});

	it('OUTRO membro entrando ou saindo não mexe em janela nenhuma', () => {
		/* O mesmo pacote (ADD/DELETE_MEMBER) chega quando é outra pessoa. Sem a
		   comparação com a última verdade, cada chegada reabriria a janela de
		   quem acabou de fechá-la. */
		entrouNumGrupo();
		grupo.descritor.fechar(); // o jogador fechou na mão
		const fechadas = grupo.estado.fechouVezes;

		PortaDoGrupo.partyMudou(); // chegou mais um membro: hasParty continua true
		PortaDoGrupo.partyMudou();

		expect(grupo.estado.aberta).toBe(false);
		expect(grupo.estado.abriuVezes).toBe(1);
		expect(grupo.estado.fechouVezes).toBe(fechadas);
	});









	it('a memória de party NÃO atravessa a troca de personagem', () => {
		/*
		 * `cleanGameUI()`/`onRestart()` não recarregam a página: todo estado de
		 * módulo sobrevive. Sem o `sincronizar()` do ZC_ACCEPT_ENTER, o
		 * personagem novo herdaria "estava em grupo" do anterior — e o primeiro
		 * grupo dele não seria borda nenhuma, então a janela nunca abriria.
		 */
		entrouNumGrupo();
		grupo.descritor.fechar();

		// A troca: MapEngine zera hasParty e anota.
		Session.hasParty = false;
		PortaDoGrupo.sincronizar();

		entrouNumGrupo();
		expect(grupo.estado.aberta).toBe(true);
	});
});

/**
 * ─── OS PINOS DE FIAÇÃO ────────────────────────────────────────────────────
 *
 * O que sobra é a metade que falharia em silêncio: o módulo estar certo e
 * NINGUÉM o chamar. Estes casos leem o fonte, o mesmo recurso de
 * `atalhosDaUiNova.test.js` — os arquivos envolvidos importam o cliente
 * inteiro e não sobem num teste de unidade.
 */
const ler = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

/**
 * O fonte SEM comentário. Este projeto comenta muito e de propósito — os
 * comentários citam a armadilha pelo nome ("era `GrupoIdle.toggle()`", "nunca
 * um `Session.hasParty ? ... : ...` aqui"). Um pino que lesse o arquivo cru
 * reprovaria exatamente a documentação que existe para impedir a volta do
 * defeito, e a saída de quem estivesse com pressa seria APAGAR o comentário.
 */
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a porta está ligada nos dois lados', () => {
	it('cada item de menu abre a SUA janela, nos dois switches (D-988)', () => {
		/*
		 * O arquivo registra QUATRO casos de "so um dos dois switches foi
		 * editado" — o que ABRE e o que acende o ARO. Com dois itens em vez de
		 * um, sao quatro pares para manter em pe, e este pino cobra os quatro.
		 */
		const fonte = semComentarios(ler('UI/Components/TopMenuIdle/TopMenuIdle.js'));
		/*
		 * O PAR, e nao a presenca. Cobrar so que as duas chamadas existem no
		 * arquivo passaria com elas TROCADAS — que e exatamente o defeito que
		 * D-980 consertou (o item escrito "Grupo" abrindo o sistema errado).
		 * Entao o que se mede e o que vem DEPOIS de cada `case`.
		 */
		const depoisDoCase = (acao) =>
			fonte.slice(fonte.indexOf(`case '${acao}':`)).slice(0, 120);
		expect(depoisDoCase('group')).toContain('GrupoIdle.toggle()');
		expect(depoisDoCase('lfg')).toContain('LFGIdle.toggle()');
		// o que acende o ARO
		expect(fonte.includes("isRagIdleWindowOpen(GrupoIdle, '.gi-window')")).toBe(true);
		expect(fonte.includes("isRagIdleWindowOpen(LFGIdle, '.lfg-window')")).toBe(true);
		// e a porta NAO decide mais o que o menu abre
		expect(fonte.includes('PortaDoGrupo')).toBe(false);
	});

	it('o menu tem UM item por janela de grupo, e nao mais nem menos', () => {
		/*
		 * D-980 tinha cortado para um item porque os DOIS diziam a coisa errada
		 * (o escrito "Grupo" caia no sistema antigo). O corte resolveu o rotulo
		 * e criou outro buraco: sem party, a janela de Grupo virava inalcancavel.
		 * Dois itens com o rotulo CERTO e o desenho de D-988 — e este pino existe
		 * para nenhum dos dois voltar a sumir ou a duplicar.
		 */
		const html = ler('UI/Components/TopMenuIdle/TopMenuIdle.html');
		const botoes = html.match(/<button[^>]*data-action="(?:group|lfg)"/g) ?? [];
		expect(botoes).toHaveLength(2);
		expect(botoes.filter((b) => b.includes('"group"'))).toHaveLength(1);
		expect(botoes.filter((b) => b.includes('"lfg"'))).toHaveLength(1);
	});

	it('o TopMenuIdle não decide sozinho quem tem party', () => {
		/* Um `Session.hasParty ? ... : ...` escrito lá seria a quinta vez do
		   defeito que o próprio arquivo registra: dois switches paralelos
		   ligados só pela disciplina de quem edita. */
		const fonte = semComentarios(ler('UI/Components/TopMenuIdle/TopMenuIdle.js'));
		expect(fonte.includes('Session.hasParty')).toBe(false);
	});

	it('os pacotes de party avisam a porta — evento e retrato, cada um no seu', () => {
		const fonte = ler('Engine/MapEngine/Group.js');
		// EVENTO: entrei / saí
		const entrou = fonte.slice(fonte.indexOf('function onPartyMemberJoin'));
		expect(entrou.slice(0, entrou.indexOf('\n}')).includes('PortaDoGrupo.partyMudou()')).toBe(true);
		const saiu = fonte.slice(fonte.indexOf('function onPartyMemberLeave'));
		expect(saiu.slice(0, saiu.indexOf('\n}')).includes('PortaDoGrupo.partyMudou()')).toBe(true);
		// RETRATO: a lista inteira
		const lista = fonte.slice(fonte.indexOf('function onPartyList'));
		expect(lista.slice(0, lista.indexOf('\n}')).includes('PortaDoGrupo.sincronizar()')).toBe(true);
	});

	it('a entrada no mundo anota a verdade zerada', () => {
		const fonte = ler('Engine/MapEngine.js');
		const trecho = fonte.slice(fonte.indexOf('Session.isPartyLeader = false;'));
		expect(trecho.slice(0, 600).includes('PortaDoGrupo.sincronizar()')).toBe(true);
	});

	it('o MapEngine liga as duas janelas na porta, com `estavaAberta` como leitura', () => {
		const fonte = ler('Engine/MapEngine.js');
		expect(fonte.includes('PortaDoGrupo.ligar(')).toBe(true);
		/* A flag de MÓDULO, e não a classe `is-open` do DOM: as duas janelas
		   registram por escrito que o `is-open` já sumiu numa troca de mapa. */
		expect(fonte.includes('estaAberta: () => LFGIdle.estavaAberta')).toBe(true);
		expect(fonte.includes('estaAberta: () => GrupoIdle.estavaAberta')).toBe(true);
	});

	it('a porta NÃO importa as duas janelas (ou a injeção não teria sentido)', () => {
		const fonte = ler('UI/Components/portaDoGrupo.js');
		expect(/import .*LFGIdle/.test(fonte)).toBe(false);
		expect(/import .*GrupoIdle/.test(fonte)).toBe(false);
		// E a verdade vem de onde o dono mandou.
		expect(fonte.includes("import Session from 'Engine/SessionStorage.js'")).toBe(true);
	});
});

describe('o teleporte para o líder tem UMA implementação só', () => {
	it('o pacote `{acao:"teleportar"}` só é montado no Localizador', () => {
		const lfg = semComentarios(ler('UI/Components/LFGIdle/LFGIdle.js'));
		const gi = semComentarios(ler('UI/Components/GrupoIdle/GrupoIdle.js'));
		expect(lfg.includes("mandar({ acao: 'teleportar' })")).toBe(true);
		expect(lfg.includes('LFGIdle.teleportarParaOLider = function')).toBe(true);
		/* A janela de Grupo oferece o botão e mais nada: ela não monta um
		   segundo CZ_RAGIDLE_LFG_ACAO — era o pedido literal do dono. O único
		   que existe lá é o 'dissolver', que já vinha de D-960. */
		expect(gi.includes('.gi-teleportar')).toBe(true);
		expect(gi.includes("acao: 'teleportar'")).toBe(false);
		expect(gi.match(/RAGIDLE_LFG_ACAO/g).length).toBe(1);
		expect(gi.includes("acao: 'dissolver'")).toBe(true);
	});

	it('a ponte é a IRMÃ de `aoPedirLocalizador`, ligada no MapEngine', () => {
		const gi = ler('UI/Components/GrupoIdle/GrupoIdle.js');
		const engine = ler('Engine/MapEngine.js');
		expect(gi.includes('GrupoIdle.aoPedirTeleporte = null;')).toBe(true);
		expect(engine.includes('GrupoIdle.aoPedirTeleporte = ()')).toBe(true);
		expect(engine.includes('LFGIdle.teleportarParaOLider()')).toBe(true);
	});
});
