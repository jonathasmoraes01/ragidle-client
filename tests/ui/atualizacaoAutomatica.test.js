/**
 * O jogo aberto ha dias se atualiza sozinho (D-997): a casca avisa
 * `ragidle:versao-nova`, e a contagem de 5 s so comeca na VOLTA da aba. Na
 * recarga a sessao e guardada para a pagina nova voltar ao mesmo personagem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = { AID: 2000123, AuthCode: 987654, UserLevel: 0, Sex: 1, Playing: true, GID: 150001 };
vi.mock('Engine/SessionStorage.js', () => ({ default: sessao }));
vi.mock('Engine/CharEngine.js', () => ({ default: { servidorAtual: { ip: 1, port: 6121, name: 'Ragnarok' } } }));
const cancelar = vi.fn();
vi.mock('Network/reconexao.js', () => ({ default: { cancelarParaFechamentoDeliberado: cancelar } }));

const {
	MS_DA_JANELA_DA_VOLTA,
	MS_SEM_REPETIR_A_MESMA_VERSAO,
	CHAVE_DA_ULTIMA_ATUALIZACAO,
	_definirRecargaParaTeste,
	_reiniciarParaTeste,
	deveComecarAContagem,
	ligarAtualizacaoAutomatica
} = await import('UI/atualizacaoAutomatica.js');
const { CHAVE_DA_RETOMADA } = await import('Engine/retomadaAposAtualizacao.js');

const BASE = { versaoPendente: '2.0.0-20260923120000', visivel: true, msDesdeAVolta: 1000, ultimaTentativa: null, agora: 1e9 };

describe('a decisao, pura', () => {
	it('versao nova + aba que ACABOU de voltar: comeca', () => {
		expect(deveComecarAContagem(BASE)).toBe(true);
	});
	it('aba em segundo plano: nunca', () => {
		expect(deveComecarAContagem({ ...BASE, visivel: false })).toBe(false);
	});
	it('sem volta registrada (o jogador olhando desde que abriu): espera a proxima volta', () => {
		expect(deveComecarAContagem({ ...BASE, msDesdeAVolta: null })).toBe(false);
	});
	it('volta velha demais: espera', () => {
		expect(deveComecarAContagem({ ...BASE, msDesdeAVolta: MS_DA_JANELA_DA_VOLTA + 1 })).toBe(false);
		expect(deveComecarAContagem({ ...BASE, msDesdeAVolta: MS_DA_JANELA_DA_VOLTA })).toBe(true);
	});
	it('sem versao pendente: nada', () => {
		expect(deveComecarAContagem({ ...BASE, versaoPendente: null })).toBe(false);
	});
	it('a MESMA versao ja tentada ha pouco: nao repete (sem laco)', () => {
		const tentada = { versao: BASE.versaoPendente, em: BASE.agora - 1000 };
		expect(deveComecarAContagem({ ...BASE, ultimaTentativa: tentada })).toBe(false);
		const antiga = { versao: BASE.versaoPendente, em: BASE.agora - MS_SEM_REPETIR_A_MESMA_VERSAO };
		expect(deveComecarAContagem({ ...BASE, ultimaTentativa: antiga })).toBe(true);
		const outra = { versao: 'outra', em: BASE.agora - 1000 };
		expect(deveComecarAContagem({ ...BASE, ultimaTentativa: outra })).toBe(true);
	});
});

describe('no jogo', () => {
	let recargas;
	let estado;

	function caixa() {
		return document.getElementById('ri-atualizando');
	}
	function mudarVisibilidade(valor) {
		estado = valor;
		document.dispatchEvent(new Event('visibilitychange'));
	}
	function versaoNova(versao = BASE.versaoPendente) {
		window.dispatchEvent(new CustomEvent('ragidle:versao-nova', { detail: { versao } }));
	}
	/* A recarga passa por dois `import()` dinamicos, e o carregador de modulo
	   do vitest leva varias voltas do laco para resolve-los: com poucas, a
	   SEGUNDA recarga de um toque duplo nao termina antes da conferencia, e o
	   caso do "uma vez so" passava com a trava removida (medido por mutante). */
	async function drenar() {
		for (let i = 0; i < 60; i++) {
			await new Promise(r => setImmediate(r));
		}
	}

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		vi.setSystemTime(1e12);
		estado = 'visible';
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
		window.sessionStorage.clear();
		document.body.innerHTML = '';
		recargas = 0;
		cancelar.mockClear();
		_reiniciarParaTeste();
		_definirRecargaParaTeste(() => recargas++);
		ligarAtualizacaoAutomatica();
	});
	afterEach(() => {
		_reiniciarParaTeste();
		vi.useRealTimers();
	});

	it('versao nova com o jogador olhando ha tempo: nada acontece (CONTROLE)', () => {
		versaoNova();
		expect(caixa()).toBeNull();
	});

	it('na VOLTA da aba: a contagem aparece, desce de 5 e recarrega', async () => {
		versaoNova();
		mudarVisibilidade('hidden');
		mudarVisibilidade('visible');
		expect(caixa().textContent).toContain('Atualizando em 5 s');
		vi.advanceTimersByTime(2000);
		expect(caixa().textContent).toContain('3 s');
		vi.advanceTimersByTime(2900);
		expect(recargas).toBe(0);
		vi.advanceTimersByTime(200);
		await drenar();
		expect(recargas).toBe(1);
	});

	it('a recarga GUARDA a sessao para nao deslogar, e cala a reconexao', async () => {
		versaoNova();
		mudarVisibilidade('visible');
		vi.advanceTimersByTime(5100);
		await drenar();
		const guardada = JSON.parse(window.sessionStorage.getItem(CHAVE_DA_RETOMADA));
		expect(guardada).toMatchObject({ AID: 2000123, AuthCode: 987654, gid: 150001 });
		expect(cancelar).toHaveBeenCalledTimes(1);
	});

	it('"Atualizar agora" nao espera a contagem, e recarrega uma vez so', async () => {
		/* Conta as ANOTACOES da tentativa, e nao so as recargas: com a trava
		   removida a atualizacao roda duas vezes, mas a segunda recarga nao chega
		   a tempo de ser contada — medido por mutante, o caso passava so com a
		   contagem de recargas. */
		const anotacoes = vi.spyOn(Storage.prototype, 'setItem');
		versaoNova();
		mudarVisibilidade('visible');
		const botao = caixa().querySelector('button');
		botao.click();
		botao.click();
		expect(anotacoes.mock.calls.filter(c => c[0] === CHAVE_DA_ULTIMA_ATUALIZACAO)).toHaveLength(1);
		anotacoes.mockRestore();
		await drenar();
		vi.advanceTimersByTime(10_000);
		await drenar();
		expect(recargas).toBe(1);
	});

	it('a aba sai no meio da contagem: ela para, e volta na proxima volta', async () => {
		versaoNova();
		mudarVisibilidade('visible');
		vi.advanceTimersByTime(2000);
		mudarVisibilidade('hidden');
		expect(caixa()).toBeNull();
		vi.advanceTimersByTime(10_000);
		await drenar();
		expect(recargas).toBe(0);
		mudarVisibilidade('visible');
		expect(caixa().textContent).toContain('5 s');
	});

	it('a versao que chega logo DEPOIS da volta (a conferencia da volta) tambem dispara', () => {
		mudarVisibilidade('visible');
		vi.advanceTimersByTime(8000);
		versaoNova();
		expect(caixa()).not.toBeNull();
	});

	it('a caixa leva a marca de UI — senao o toque morre no iPhone (D-1380)', () => {
		versaoNova();
		mudarVisibilidade('visible');
		expect(caixa().dataset.guiComponent).toBe('ri-atualizando');
	});
});
