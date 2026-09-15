/**
 * O SOM QUE VAZA QUANDO O NAVEGADOR RECUSA TOCAR (15/09/2026, D-1415).
 *
 * ---------------------------------------------------------------------------
 * O RELATO
 * ---------------------------------------------------------------------------
 * Dono, 15/09/2026, jogando no iPhone: *"meu Cacador ainda esta travando...
 * trava muito todas as vezes em que usa as habilidades automaticas no mapa de
 * caca, talvez tenha realmente alguma coisa a ver com o som"* — e, junto,
 * *"nitidamente esta ocorrendo um vazamento"*.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO PRENDE
 * ---------------------------------------------------------------------------
 * `SoundManager.play()` criava o `<audio>`, empurrava para
 * `_sounds[nome].instances` e chamava `play()`. Quando essa promessa REJEITA
 * por politica do navegador (`NotAllowedError` — o caso do WebKit do iPhone
 * sem gesto que destrave o audio), o elemento:
 *
 *   - nunca dispara `ended` (nunca tocou), entao `onSoundEnded` nao roda e ele
 *     nao volta para o cache;
 *   - nunca dispara `error` (a fonte esta boa; quem recusou foi a politica),
 *     entao `onSoundError` nao roda e ele nao sai da lista;
 *   - fica em `instances` PARA SEMPRE, e `mediaPlayerCount` nunca decrementa.
 *
 * Como `mediaPlayerCount` so sobe, `balancedMax()` (que e
 * `max * (1 - contagem/800)`) desce junto: o teto por arquivo encolhe e, na
 * pratica, o gerenciador vai ficando surdo enquanto acumula elementos de midia
 * presos. Caca automatica dispara som a cada golpe e a cada habilidade — e o
 * cenario em que isso cresce mais rapido.
 *
 * O caso do `AbortError` fica de FORA de proposito: ele e o `play()`
 * interrompido por um `pause()`/novo `play()` no mesmo elemento, e ali o
 * elemento continua valido e reutilizavel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ erroDoPlay: null }));

vi.mock('Core/Client.js', () => ({
	default: {
		loadFile: (caminho, aoCarregar) => {
			aoCarregar(`blob:falso/${caminho}`);
		}
	}
}));
vi.mock('Core/MemoryManager.js', () => ({
	default: { search: () => [], remove: () => {} }
}));
vi.mock('Engine/SessionStorage.js', () => ({
	default: { Entity: { position: [0, 0, 0] } }
}));

/**
 * O `play()` do jsdom nao existe. Aqui ele vira o que o iPhone faz: uma
 * promessa REJEITADA com o nome do erro que a politica de autoplay usa.
 */
function fingirPlay() {
	HTMLMediaElement.prototype.play = function play() {
		if (!mocks.erroDoPlay) {
			return Promise.resolve();
		}
		const erro = new Error('bloqueado pela politica');
		erro.name = mocks.erroDoPlay;
		return Promise.reject(erro);
	};
	HTMLMediaElement.prototype.pause = function pause() {};
}

/** Deixa as promessas de `play()` (e os `catch` delas) rodarem. */
async function deixarAsPromessasRodarem() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
}

describe('o som nao acumula elemento de midia quando o navegador recusa tocar', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.erroDoPlay = null;
		fingirPlay();
	});

	afterEach(() => {
		mocks.erroDoPlay = null;
	});

	it('CONTROLE: com `play()` aceito, tocar 40 vezes nao estoura o teto por arquivo', async () => {
		const { default: SoundManager } = await import('Audio/SoundManager.js');
		SoundManager.volume = 1;

		for (let i = 0; i < 40; i++) {
			SoundManager.play('golpe.wav');
		}
		await deixarAsPromessasRodarem();

		// O teto por arquivo e `balancedMax(10)`; o importante e nao crescer
		// sem limite — 40 chamadas nao podem virar 40 elementos.
		expect(SoundManager.diagnostico().players).toBeLessThanOrEqual(12);
	});

	it('com `NotAllowedError` (o iPhone sem audio destravado), 40 toques nao deixam 40 elementos presos', async () => {
		mocks.erroDoPlay = 'NotAllowedError';
		const { default: SoundManager } = await import('Audio/SoundManager.js');
		SoundManager.volume = 1;

		for (let i = 0; i < 40; i++) {
			SoundManager.play(`golpe-${String(i)}.wav`);
		}
		await deixarAsPromessasRodarem();

		const d = SoundManager.diagnostico();
		expect(
			d.players,
			`${String(d.players)} elementos de midia presos depois de 40 recusas — cada um conta contra o teto de 800 e nunca volta`
		).toBe(0);
		expect(d.vivos, 'nenhuma instancia pode ficar na lista de tocando').toBe(0);
	});

	it('`AbortError` NAO descarta o elemento: ali ele continua valido', async () => {
		mocks.erroDoPlay = 'AbortError';
		const { default: SoundManager } = await import('Audio/SoundManager.js');
		SoundManager.volume = 1;

		SoundManager.play('golpe.wav');
		await deixarAsPromessasRodarem();

		expect(SoundManager.diagnostico().players).toBe(1);
	});

	it('o mesmo som em rajada respeita o intervalo minimo, inclusive vindo do CACHE', async () => {
		const { default: SoundManager } = await import('Audio/SoundManager.js');
		SoundManager.volume = 1;

		// Primeiro toque cria; os seguintes, na mesma fatia de tempo, sao a
		// rajada da caca automatica batendo no mesmo alvo.
		for (let i = 0; i < 20; i++) {
			SoundManager.play('golpe.wav');
		}
		await deixarAsPromessasRodarem();

		expect(
			SoundManager.diagnostico().vivos,
			'vinte disparos do MESMO som na mesma fatia de tempo nao podem virar vinte reproducoes simultaneas'
		).toBeLessThanOrEqual(2);
	});
});
