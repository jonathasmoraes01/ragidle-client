/**
 * O ATRASO ANTES DE ENTRAR NA ECONOMIA DE ENERGIA / MODO DESCANSO (23/09/2026,
 * ordem do dono: "Aumente esse tempo para 14 segundos"; era 3 s desde D-1394).
 * De volta em 13/10/2026 (bug #10, decisao do dono: "sim, trazer de volta" para o
 * Bot novo).
 *
 * D-2598 (16/10/2026): o interruptor escolhe so a TELA PRETA. O `entrar` (que
 * segura o personagem farmando no mundo quando a conexao cai) sai sempre, e a
 * volta sem a tela na frente manda `sair` sozinha. Os casos com `tela: true` sao
 * os da tela escolhida (D-1392: so o botao sai); os com `tela: false` (o padrao
 * novo) sao o segundo plano invisivel.
 *
 * Comportamento com RELOGIO FALSO, nao casamento de texto: o gatilho mora em
 * `Engine/gatilhoDaEconomia.js` (puro) e o `MapEngine.js` so o liga.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA, criarGatilhoDaEconomia } from '../../src/Engine/gatilhoDaEconomia.js';

function montar({ oculta = true, tela = true, dedo = false } = {}) {
	const estado = { oculta, tela, dedo };
	const pedidos = [];
	const telas = [];
	const gatilho = criarGatilhoDaEconomia({
		oculta: () => estado.oculta,
		telaPretaEscolhida: () => estado.tela,
		armarNaHora: () => estado.dedo,
		pedirEntrar: () => pedidos.push('entrar'),
		pedirSair: () => pedidos.push('sair'),
		abrirTela: decorrido => telas.push(decorrido)
	});
	return { estado, pedidos, telas, gatilho };
}

describe('o atraso da economia de energia', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('o atraso e de 14 s', () => {
		expect(MS_DE_ATRASO_ANTES_DE_ENTRAR_NA_ECONOMIA).toBe(14000);
	});

	it('a aba escondida espera 14 s antes de pedir a economia, e pede UMA vez', () => {
		const { pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(13_999);
		expect(pedidos).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(pedidos).toEqual(['entrar']);
		vi.advanceTimersByTime(60_000);
		expect(pedidos).toEqual(['entrar']);
	});

	it('um segundo evento de visibilidade com a aba ainda oculta nao empilha outro atraso', () => {
		const { pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(5_000);
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(9_000);
		expect(pedidos).toEqual(['entrar']);
		// Um atraso so: o segundo evento nao deixou um segundo aviso para 5 s depois.
		vi.advanceTimersByTime(60_000);
		expect(pedidos).toEqual(['entrar']);
	});

	it('voltar antes do atraso cancela: nunca chegou a avisar', () => {
		const { estado, pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(10_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(gatilho.agendado(), 'voltar a aba derruba o atraso na hora').toBe(false);
		vi.advanceTimersByTime(60_000);
		expect(pedidos).toEqual([]);
	});

	it('esconder, voltar e esconder de novo: o atraso conta a partir da SEGUNDA vez (o primeiro caiu)', () => {
		const { estado, pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade(); // t = 0
		vi.advanceTimersByTime(10_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade(); // t = 10 s: cancela
		vi.advanceTimersByTime(2_000);
		estado.oculta = true;
		gatilho.aoMudarVisibilidade(); // t = 12 s: novo atraso, vence em t = 26 s
		vi.advanceTimersByTime(13_999); // t = 25,999 s: o atraso velho (t = 14 s) ja teria avisado
		expect(pedidos).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(pedidos).toEqual(['entrar']);
	});

	it('com a tela ESCOLHIDA, voltar a aba depois de avisar nao manda `sair` (so o botao "Voltar a jogar" sai, D-1392)', () => {
		const { estado, pedidos, gatilho } = montar({ tela: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar']);
		expect(gatilho.fase()).toBe('liberada');
	});

	it('a aba que volta no instante exato do disparo nao avisa (confere de novo)', () => {
		const { estado, pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(13_000);
		estado.oculta = false; // sem passar pelo evento: o disparo reconfere
		vi.advanceTimersByTime(1_000);
		expect(pedidos).toEqual([]);
	});

	it('`cancelar` (a reentrada, o fim da sessao) derruba o atraso pendente', () => {
		const { pedidos, gatilho } = montar();
		gatilho.aoMudarVisibilidade();
		gatilho.cancelar();
		vi.advanceTimersByTime(60_000);
		expect(pedidos).toEqual([]);
	});

	it('o MapEngine liga o gatilho: o ouvinte de visibilidade, o pacote `entrar` e o desmonte', () => {
		const motor = readFileSync('src/Engine/MapEngine.js', 'utf8');
		expect(motor).toContain("document.addEventListener('visibilitychange', onVisibilidadeMudouParaEconomia);");
		expect(motor).toContain("document.removeEventListener('visibilitychange', onVisibilidadeMudouParaEconomia);");
		expect(motor).toContain("pedirEntrar: () => pedirAcaoDaEconomia('entrar'),");
		expect(motor).toContain("pedirSair: () => pedirAcaoDaEconomia('sair'),");
		expect(motor).toContain('criarGatilhoDaEconomia({');
		// O criterio de celular e o do projeto (`ehDedo`), nao um `matchMedia` novo; e o `pagehide` esta ligado.
		expect(motor).toContain('armarNaHora: () => ehDedo(),');
		expect(motor).toContain("window.addEventListener('pagehide', onPaginaEscondida);");
		// D-2598: o interruptor escolhe a TELA, pela chave nova (a velha ficou gravada `true` em todo jogador antigo).
		expect(motor).toContain('telaPretaEscolhida: () => GraphicsSettings.telaPretaAoTrocarDeAba === true,');
		expect(motor).not.toMatch(/economiaDeEnergiaAutomatica/);
	});
});

/*
 * D-2598 (16/10/2026): O SEGUNDO PLANO INVISIVEL. Medido no `prove:segundo-plano` (D-2594) e no codigo de antes: com o
 * interruptor desligado o `entrar` nunca saia, e a queda da conexao tirava o personagem do mundo; com ele ligado, a tela
 * preta cobria o jogo na volta. Cada caso abaixo REPROVA no gatilho de antes (o controle: ele lia `automaticaLigada`, que
 * aqui nem existe, e seguia em frente sem `entrar`).
 */
describe('D-2598: sem a tela escolhida, o aviso sai e a volta nao se ve', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('desktop: a aba escondida manda `entrar` depois dos 14 s mesmo sem a tela escolhida', () => {
		const { pedidos, telas, gatilho } = montar({ tela: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(13_999);
		expect(pedidos).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(pedidos, 'o aviso que segura o personagem no mundo').toEqual(['entrar']);
		expect(gatilho.fase()).toBe('armada');
		expect(gatilho.aoResponderAtiva(14_000), 'a resposta do servidor nao abre tela nenhuma').toBe(false);
		vi.advanceTimersByTime(600_000);
		expect(telas).toEqual([]);
		expect(pedidos).toEqual(['entrar']);
	});

	it('desktop: a volta da aba manda `sair` sozinha, e o ack devolve ao comeco', () => {
		const { estado, pedidos, telas, gatilho } = montar({ tela: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(180_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar', 'sair']);
		expect(gatilho.fase()).toBe('desarmando');
		expect(gatilho.aoResponderAtiva(180_000), 'a resposta atrasada do `entrar` nao abre tela').toBe(false);
		gatilho.aoResponderInativa();
		expect(gatilho.fase()).toBe('livre');
		expect(telas).toEqual([]);
	});

	it('dedo: `entrar` na hora, a tela nunca abre, e a volta (mesmo depois dos 14 s) manda `sair`', () => {
		const { estado, pedidos, telas, gatilho } = montar({ tela: false, dedo: true });
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar']);
		expect(gatilho.aoResponderAtiva(1)).toBe(false);
		vi.advanceTimersByTime(60_000);
		expect(telas, 'o atraso passou e a tela segue fechada').toEqual([]);
		expect(gatilho.fase()).toBe('armada');
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar', 'sair']);
	});

	it('dedo: o `pagehide` arma sem a tela escolhida (o celular que congela a pagina)', () => {
		const { pedidos, gatilho } = montar({ tela: false, dedo: true, oculta: false });
		gatilho.aoEsconderPagina();
		expect(pedidos).toEqual(['entrar']);
	});

	it('o rearme depois da reentrada (cancelar com a aba oculta) volta a mandar `entrar`', () => {
		const { pedidos, gatilho } = montar({ tela: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		gatilho.cancelar(); // a conexao nova (`onConnectionAccepted`)
		gatilho.aoMudarVisibilidade(); // a aba segue oculta: o MapEngine reagenda pelo mesmo caminho
		vi.advanceTimersByTime(14_000);
		expect(pedidos).toEqual(['entrar', 'entrar']);
	});

	it('desligar a tela com o atraso correndo nao derruba o aviso (o farm continua)', () => {
		const { estado, pedidos, telas, gatilho } = montar({ tela: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(5_000);
		estado.tela = false;
		vi.advanceTimersByTime(9_000);
		expect(pedidos).toEqual(['entrar']);
		expect(gatilho.fase()).toBe('armada');
		expect(gatilho.aoResponderAtiva(1)).toBe(false);
		expect(telas).toEqual([]);
	});

	it('a resposta `ativa:true` em `livre` (o `resumo` em voo quando o botao fechou) nao reabre a tela', () => {
		const { gatilho } = montar({ tela: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		gatilho.cancelar(); // o "Voltar a jogar"
		expect(gatilho.aoResponderAtiva(20_000)).toBe(false);
	});
});

describe('o celular arma na hora (decisao do dono, 13/10/2026)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('no dedo o `entrar` sai NO INSTANTE em que a aba some, sem esperar os 14 s', () => {
		const { pedidos, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar']);
		vi.advanceTimersByTime(60_000);
		expect(pedidos, 'um aviso so').toEqual(['entrar']);
	});

	it('no desktop o `entrar` continua so depois dos 14 s (D-1394)', () => {
		const { pedidos, gatilho } = montar({ dedo: false });
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual([]);
		vi.advanceTimersByTime(14_000);
		expect(pedidos).toEqual(['entrar']);
	});

	it('a TELA PRETA escolhida do celular so abre depois dos 14 s, mesmo com a resposta do servidor ja ter chegado', () => {
		const { telas, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		expect(gatilho.aoResponderAtiva(1_000), 'a resposta chega na hora: a tela espera').toBe(false);
		vi.advanceTimersByTime(13_999);
		expect(telas).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(telas, 'passou o atraso: abre com o tempo fora guardado').toEqual([1_000]);
		expect(gatilho.aoResponderAtiva(15_000), 'depois do atraso a tela abre direto').toBe(true);
	});

	it('se a resposta chega DEPOIS do atraso, a tela abre direto (nada guardado)', () => {
		const { telas, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		expect(telas).toEqual([]);
		expect(gatilho.aoResponderAtiva(1)).toBe(true);
	});

	it('voltar antes dos 14 s manda `sair` e a tela nunca abre', () => {
		const { estado, pedidos, telas, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		gatilho.aoResponderAtiva(1_000);
		vi.advanceTimersByTime(8_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar', 'sair']);
		// A resposta atrasada do `entrar` (ativa:true) e ignorada ate o ack do `sair`.
		expect(gatilho.aoResponderAtiva(1_000)).toBe(false);
		vi.advanceTimersByTime(60_000);
		expect(telas).toEqual([]);
		gatilho.aoResponderInativa();
		expect(gatilho.fase()).toBe('livre');
	});

	it('voltar DEPOIS que a tela escolhida abriu nao manda `sair` (D-1392)', () => {
		const { estado, pedidos, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar']);
	});

	it('o `pagehide` arma na hora no dedo, uma vez, e nao no desktop', () => {
		const dedo = montar({ dedo: true });
		dedo.gatilho.aoEsconderPagina();
		dedo.gatilho.aoEsconderPagina();
		expect(dedo.pedidos).toEqual(['entrar']);
		const mouse = montar({ dedo: false });
		mouse.gatilho.aoEsconderPagina();
		expect(mouse.pedidos).toEqual([]);
	});

	it('o `pagehide` seguido do visibilitychange nao manda dois `entrar`', () => {
		const { pedidos, gatilho } = montar({ dedo: true });
		gatilho.aoEsconderPagina();
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar']);
	});

	it('o ack tardio do `sair` nao apaga um novo `entrar` cedo (esconder, voltar, esconder)', () => {
		const { estado, pedidos, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		estado.oculta = true;
		gatilho.aoMudarVisibilidade();
		expect(pedidos).toEqual(['entrar', 'sair', 'entrar']);
		gatilho.aoResponderInativa();
		expect(gatilho.fase(), 'o ack do sair velho nao desfaz o entrar novo').toBe('armada');
	});
});

describe('rodada 3 do bug #10: achados do critico (a tela escolhida)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('A1: com a tela preta ja aberta, esconder de novo e voltar em menos de 14 s NAO manda `sair` (D-1392)', () => {
		const { estado, pedidos, telas, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		gatilho.aoResponderAtiva(1_000);
		vi.advanceTimersByTime(14_000);
		expect(telas).toEqual([1_000]);
		// Voltou sem clicar no botao, escondeu de novo e voltou depressa.
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		estado.oculta = true;
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(5_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		// D-2578: esconder de novo REARMA (o `entrar` repetido, na hora no dedo); o que A1 cobra segue: nada de `sair`.
		expect(pedidos, 'so o botao fecha a tela: nada de `sair`').toEqual(['entrar', 'entrar']);
		expect(gatilho.fase()).toBe('liberada');
	});

	/*
	 * D-2578 (15/10/2026): ate aqui a tela liberada NAO reenviava o `entrar` (A1 no desktop, de 13/10), e o servidor
	 * que desarmou CALADO deixava o cliente em `liberada` sem economia nenhuma - a proxima queda tirava o personagem do
	 * mundo. Esconder de novo rearma, pelo mesmo atraso de 14 s do desktop.
	 */
	it('D-2578 no desktop: esconder de novo com a tela liberada rearma DEPOIS dos 14 s, e a fase segue liberada', () => {
		const { estado, pedidos, gatilho } = montar({ dedo: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		estado.oculta = true;
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(13_999);
		expect(pedidos, 'rearmou antes do atraso (fechar a aba ja nao encerraria)').toEqual(['entrar']);
		vi.advanceTimersByTime(1);
		expect(pedidos).toEqual(['entrar', 'entrar']);
		expect(gatilho.fase()).toBe('liberada');
	});

	it('D-2578 no desktop: voltar antes dos 14 s so cancela o rearme, sem `sair`', () => {
		const { estado, pedidos, gatilho } = montar({ dedo: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		estado.oculta = true;
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(5_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(60_000);
		expect(pedidos).toEqual(['entrar']);
		expect(gatilho.fase()).toBe('liberada');
	});

	it('D-2578: cada esconder rearma uma vez (sem empilhar com o evento repetido)', () => {
		const { estado, pedidos, gatilho } = montar({ dedo: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		for (let i = 0; i < 3; i++) {
			estado.oculta = false;
			gatilho.aoMudarVisibilidade();
			estado.oculta = true;
			gatilho.aoMudarVisibilidade();
			gatilho.aoMudarVisibilidade(); // o evento repetido com a aba ja oculta
			vi.advanceTimersByTime(14_000);
		}
		expect(pedidos).toEqual(['entrar', 'entrar', 'entrar', 'entrar']);
	});

	it('D-2578: a resposta `ativa:true` do rearme so atualiza a tela que ja esta aberta (nao guarda nem ignora)', () => {
		const { estado, gatilho } = montar({ dedo: false });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		estado.oculta = false;
		gatilho.aoMudarVisibilidade();
		estado.oculta = true;
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		expect(gatilho.aoResponderAtiva(1000)).toBe(true);
	});

	it('A1: o botao "Voltar a jogar" (`cancelar`) devolve o gatilho ao comeco', () => {
		const { pedidos, gatilho } = montar({ dedo: true });
		gatilho.aoMudarVisibilidade();
		vi.advanceTimersByTime(14_000);
		gatilho.cancelar();
		gatilho.aoMudarVisibilidade();
		expect(pedidos, 'depois do botao, esconder arma de novo').toEqual(['entrar', 'entrar']);
	});

	it('A2: o `pagehide` sozinho arma e AGENDA a tela como o esconder: abre depois dos 14 s se a aba estiver oculta', () => {
		const { estado, telas, gatilho } = montar({ dedo: true, oculta: false });
		gatilho.aoEsconderPagina();
		gatilho.aoResponderAtiva(1_000);
		expect(gatilho.agendado()).toBe(true);
		estado.oculta = true; // a aba ficou oculta sem passar pelo visibilitychange
		vi.advanceTimersByTime(14_000);
		expect(telas).toEqual([1_000]);
	});

	it('A2: o `pagehide` com a aba ainda visivel no disparo nao abre tela nenhuma', () => {
		const { telas, gatilho } = montar({ dedo: true, oculta: false });
		gatilho.aoEsconderPagina();
		gatilho.aoResponderAtiva(1_000);
		vi.advanceTimersByTime(60_000);
		expect(telas).toEqual([]);
	});
});
