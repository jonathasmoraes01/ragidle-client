/**
 * O SOM NO iPHONE — o vazamento (D-1415) e a migracao para Web Audio (D-1484).
 *
 * ---------------------------------------------------------------------------
 * O RELATO, E O NUMERO QUE ELE VIROU
 * ---------------------------------------------------------------------------
 * Dono, 15/09/2026, jogando no iPhone: *"meu Cacador ainda esta travando...
 * trava muito todas as vezes em que usa as habilidades automaticas no mapa de
 * caca, talvez tenha realmente alguma coisa a ver com o som"* — e, junto,
 * *"nitidamente esta ocorrendo um vazamento"*. Depois, o A/B mais direto que
 * existe: *"com o som desabilitado, funciona perfeitamente; quando ativo o som,
 * continua travando"*.
 *
 * A instrumentacao de fase deu o numero no aparelho dele:
 *
 *     som: 895 pedidos · 19.617 ms no total · **21,92 ms POR SOM**
 *
 * Um efeito sonoro custava mais que o orcamento inteiro de um quadro a 60 fps
 * (16,7 ms). A causa era a tecnologia: cada golpe ativava um
 * `HTMLAudioElement`, que e um elemento de MIDIA. A versao de hoje decodifica
 * o arquivo uma vez para um `AudioBuffer` e dispara um no descartavel por
 * golpe.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO PRENDE AGORA
 * ---------------------------------------------------------------------------
 * O vazamento que ele nasceu para prender (elementos `<audio>` presos para
 * sempre quando `play()` era recusado por politica) **deixou de ser possivel**:
 * nao ha elemento de midia. Medir `NotAllowedError` e `AbortError` hoje seria
 * medir uma API que o arquivo nao usa mais — teste verde por ausencia de
 * sujeito, que e a "prova que passa com zero" que este projeto ja pagou caro.
 *
 * Entao os casos foram REAIMADOS para os riscos que a arquitetura nova tem de
 * verdade, e os dois primeiros sao os que quase entraram em producao:
 *
 *   1. **o `.wav` chega como URL em TEXTO**, e nao como bytes (o atalho de
 *      `FileManager.getHTTP`) — a primeira versao desta migracao descartava
 *      isso com um `instanceof ArrayBuffer` e teria deixado o jogo MUDO no
 *      unico caminho que ele usa de verdade;
 *   2. **o contexto nasce suspenso** e so acorda com um gesto. `start()` num
 *      contexto suspenso nao lanca e nao avisa — o som some em silencio.
 *
 * Som mudo e pior que som caro: o caro o dono ve no FPS, o mudo ele so
 * descobre jogando.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	/** O que `Client.getFile` entrega: 'url' (o caminho de producao) ou 'bytes'. */
	forma: 'url',
	pedidos: 0
}));

vi.mock('Core/Client.js', () => ({
	default: {
		getFile: (caminho, aoCarregar) => {
			mocks.pedidos++;
			if (mocks.forma === 'bytes') {
				aoCarregar(new ArrayBuffer(64));
				return;
			}
			aoCarregar(`http://assets.exemplo/${caminho}`);
		}
	}
}));
vi.mock('Core/MemoryManager.js', () => ({
	default: { search: () => [], remove: () => {} }
}));
vi.mock('Engine/SessionStorage.js', () => ({
	default: { Entity: { position: [0, 0, 0] } }
}));

class GanhoFalso {
	constructor() {
		this.gain = { value: 1 };
	}
	connect() {}
	disconnect() {}
}

class FonteFalsa {
	constructor(ctx) {
		this.ctx = ctx;
		this.buffer = null;
		this.onended = null;
		this.parou = false;
	}
	connect() {}
	disconnect() {}
	start() {
		this.ctx.iniciadas++;
	}
	stop() {
		this.parou = true;
	}
	/** O que o navegador faz quando o som termina de tocar. */
	terminar() {
		if (this.onended) {
			this.onended();
		}
	}
}

class AudioContextFalso {
	constructor() {
		// Como no navegador de verdade, e como no iOS em especial.
		this.state = 'suspended';
		this.destination = {};
		this.decodificacoes = 0;
		this.iniciadas = 0;
		this.fontes = [];
		this.mestre = null;
	}
	createGain() {
		const g = new GanhoFalso();
		if (!this.mestre) {
			this.mestre = g;
		}
		return g;
	}
	createBufferSource() {
		const f = new FonteFalsa(this);
		this.fontes.push(f);
		return f;
	}
	decodeAudioData(bytes, aoPronto) {
		this.decodificacoes++;
		this.ultimoTamanho = bytes.byteLength;
		aoPronto({ duration: 0.4 });
	}
	resume() {
		this.state = 'running';
		return Promise.resolve();
	}
}

/** O ultimo contexto que o modulo criou — o modulo nao o expoe. */
let ctxCriado = null;
/** O relogio que o intervalo minimo enxerga. */
let agora = 1_000_000;

async function deixarAsPromessasRodarem() {
	for (let i = 0; i < 12; i++) {
		await Promise.resolve();
	}
}

async function carregar() {
	const { default: SoundManager } = await import('Audio/SoundManager.js');
	SoundManager.volume = 1;
	return SoundManager;
}

describe('o som no iPhone: Web Audio, sem elemento de midia', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.forma = 'url';
		mocks.pedidos = 0;
		ctxCriado = null;
		agora = 1_000_000;

		vi.spyOn(Date, 'now').mockImplementation(() => agora);

		vi.stubGlobal(
			'AudioContext',
			class extends AudioContextFalso {
				constructor() {
					super();
					ctxCriado = this;
				}
			}
		);
		vi.stubGlobal('fetch', () =>
			Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(128)) })
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('O CAMINHO DE PRODUCAO: o `.wav` que chega como URL em TEXTO vira som', async () => {
		// `FileManager.getHTTP` tem um atalho para audio que devolve a URL, e nao
		// os bytes — e e por ele que TODO som deste jogo passa (`remoteClient`).
		// A primeira versao desta migracao exigia `ArrayBuffer` e teria calado o
		// jogo inteiro sem lancar um unico erro.
		const SoundManager = await carregar();

		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		expect(ctxCriado, 'nenhum contexto de audio foi criado').not.toBeNull();
		expect(
			ctxCriado.iniciadas,
			'o som chegou como URL em texto e nao tocou — e assim que o jogo fica mudo em producao'
		).toBe(1);
		expect(ctxCriado.decodificacoes).toBe(1);
	});

	it('o `.wav` que chega como BYTES (o GRF direto) tambem vira som', async () => {
		mocks.forma = 'bytes';
		const SoundManager = await carregar();

		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		expect(ctxCriado.iniciadas).toBe(1);
		expect(ctxCriado.decodificacoes).toBe(1);
	});

	it('O GANHO DA MIGRACAO: tocar o mesmo som 30 vezes decodifica UMA vez', async () => {
		const SoundManager = await carregar();

		for (let i = 0; i < 30; i++) {
			SoundManager.play('golpe.wav');
			// Fora do intervalo minimo, para cada toque ser um toque de verdade.
			agora += 500;
			await deixarAsPromessasRodarem();
			// O som de 0,4 s acabou antes do golpe seguinte, como no navegador.
			// Sem isto o teto de vozes cortaria em 24 e o caso mediria o teto, e
			// nao a decodificacao — que e o que ele existe para medir.
			for (const fonte of ctxCriado.fontes) {
				fonte.terminar();
			}
		}

		expect(ctxCriado.iniciadas, 'os 30 toques tem de sair').toBe(30);
		expect(
			ctxCriado.decodificacoes,
			'decodificar de novo a cada golpe seria repetir, em Web Audio, o custo que a migracao veio tirar'
		).toBe(1);
		expect(mocks.pedidos, 'o arquivo so precisa ser buscado uma vez').toBe(1);
		expect(SoundManager.diagnostico().emCache).toBe(1);
	});

	it('O DESTRAVE: o contexto nasce SUSPENSO e um gesto do jogador o acorda', async () => {
		const SoundManager = await carregar();

		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		// CONTROLE: sem gesto, ele continua suspenso. Sem esta linha, o caso
		// passaria mesmo que o contexto ja nascesse acordado e o `resume` nunca
		// fosse chamado.
		expect(ctxCriado.state, 'o contexto deveria nascer suspenso, como no navegador de verdade').toBe('suspended');

		window.dispatchEvent(new Event('pointerdown'));
		await deixarAsPromessasRodarem();

		expect(
			ctxCriado.state,
			'o toque do jogador nao acordou o audio — no iPhone isso e o jogo inteiro sem som, em silencio'
		).toBe('running');
	});

	it('o destrave continua valendo DEPOIS do primeiro gesto (o iOS suspende de novo)', async () => {
		const SoundManager = await carregar();
		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		window.dispatchEvent(new Event('pointerdown'));
		await deixarAsPromessasRodarem();
		expect(ctxCriado.state).toBe('running');

		// A aba foi para segundo plano e o iOS suspendeu o contexto. Com ouvinte
		// `once`, o proximo toque nao traria o som de volta.
		ctxCriado.state = 'suspended';
		// **O MESMO tipo de evento, de proposito.** Com `pointerdown` e depois
		// `touchstart` este caso passava mesmo com `once: true` — sao ouvintes
		// diferentes, e o segundo ainda estava armado. O mutante sobreviveu
		// exatamente assim, e o caso media a coisa errada.
		window.dispatchEvent(new Event('pointerdown'));
		await deixarAsPromessasRodarem();

		expect(ctxCriado.state, 'o som nao voltou depois de a aba voltar do segundo plano').toBe('running');
	});

	it('o mesmo som em rajada respeita o intervalo minimo', async () => {
		const SoundManager = await carregar();

		// A caca automatica batendo no mesmo alvo: vinte pedidos do mesmo wav na
		// mesma fatia de tempo.
		for (let i = 0; i < 20; i++) {
			SoundManager.play('golpe.wav');
		}
		await deixarAsPromessasRodarem();

		expect(ctxCriado.iniciadas, 'vinte disparos do mesmo som na mesma fatia de tempo nao podem virar vinte vozes').toBe(
			1
		);
	});

	it('as vozes simultaneas tem teto, e elas SAEM quando o som acaba', async () => {
		const SoundManager = await carregar();

		for (let i = 0; i < 40; i++) {
			SoundManager.play(`golpe-${String(i)}.wav`);
		}
		await deixarAsPromessasRodarem();

		const vivas = SoundManager.diagnostico().players;
		expect(vivas, `${String(vivas)} vozes ao mesmo tempo — o teto existe para isto nao virar uma parede de som`).toBeLessThanOrEqual(24);
		expect(vivas, 'nenhuma voz tocou').toBeGreaterThan(0);

		// E o essencial do que o caso antigo media, na forma nova: o que toca
		// tem de SAIR sozinho. Se `onended` nao limpasse, o teto acima travaria
		// o som do jogo para sempre depois de 24 golpes.
		for (const fonte of ctxCriado.fontes) {
			fonte.terminar();
		}
		expect(SoundManager.diagnostico().players, 'as vozes terminadas ficaram presas — o teto vira uma mordaca').toBe(0);
	});

	it('`stop()` para o que esta tocando', async () => {
		const SoundManager = await carregar();

		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();
		expect(SoundManager.diagnostico().players).toBe(1);

		SoundManager.stop();

		expect(ctxCriado.fontes[0].parou).toBe(true);
		expect(SoundManager.diagnostico().players).toBe(0);
	});

	it('com o som DESLIGADO nas preferencias, nada e pedido nem tocado', async () => {
		const { default: Preferences } = await import('Preferences/Audio.js');
		const SoundManager = await carregar();
		const antes = Preferences.Sound.play;
		Preferences.Sound.play = false;

		try {
			for (let i = 0; i < 10; i++) {
				SoundManager.play(`golpe-${String(i)}.wav`);
			}
			await deixarAsPromessasRodarem();

			// Este e o A/B do dono virado teste: com o som desligado o caminho
			// inteiro tem de sair de cena, sem buscar arquivo nem decodificar.
			expect(mocks.pedidos, 'com o som desligado nenhum arquivo deveria ser buscado').toBe(0);
			expect(ctxCriado, 'com o som desligado nem o contexto de audio precisa nascer').toBeNull();
		} finally {
			Preferences.Sound.play = antes;
		}
	});

	it('`setVolume` move o ganho MESTRE, e nao uma voz de cada vez', async () => {
		const SoundManager = await carregar();
		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		SoundManager.setVolume(0.25);

		expect(SoundManager.volume).toBe(0.25);
		expect(
			ctxCriado.mestre.gain.value,
			'o volume geral mora no no mestre: um valor, e nao um laco por instancia'
		).toBe(0.25);
	});
});
