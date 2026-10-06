/**
 * O PROGRAMA DO SPRITE TEM RESERVA (06/10/2026, D-2048 e D-2054).
 *
 * ---------------------------------------------------------------------------
 * O DEFEITO
 * ---------------------------------------------------------------------------
 * Em celulares com a GPU PowerVR B-Series BXM-8-256 (moto g54 5G, Poco M7 Pro;
 * Chrome via ANGLE sobre OpenGL ES 3.2) os SPRITES sumiam: monstros, jogadores,
 * o proprio personagem e os numeros de dano. O mapa, as arvores, os nomes, as
 * barras de HP e a HUD apareciam. Tudo o que some passa por UM programa, o do
 * `SpriteRenderer` (o dano tambem: `Damage.js` desenha com ele).
 *
 * ---------------------------------------------------------------------------
 * O QUE O CAMPO DISSE (06/10/2026, depois da D-2048)
 * ---------------------------------------------------------------------------
 * No moto g54 o `/analytics` registrou
 *   `[sprite] diagnostico: principal ok | gpu=ANGLE (Imagination Technologies,
 *    PowerVR B-Series BXM-8-256, OpenGL ES 3.2)`
 * e os sprites CONTINUARAM invisiveis: a primeira sonda (um quad branco, sem
 * mistura de cor, so contando pixel aceso) aprovou um programa que nao desenha
 * na cena. Com `?forcarSpriteReserva=1` (`sem-correcao`) o jogador nao viu
 * nada; com `=2` (`minima`) os sprites e o dano VOLTARAM. Daí as tres pecas
 * da D-2054:
 *
 *   1. a REGRA DO POWERVR B-SERIES: a cascata comeca pela `minima` ali
 *      (`GPU_DA_REGRA`, abaixo, com a evidencia);
 *   2. a CHAVE GUARDADA: `?forcarSpriteReserva=N` fica no aparelho e vale nas
 *      proximas aberturas; `=0` limpa (`lerChaveDeReserva`);
 *   3. a SONDA FIEL (`sondaDoSprite.js`): desenha pelo MESMO caminho do jogo
 *      (`SpriteRenderer.render`), com textura RGBA de mob, indice+paleta de
 *      jogador e o dano, com a mistura e a profundidade do jogo, e so aprova
 *      a COR esperada;
 *   4. as VARIANTES DE DIAGNOSTICO (`CHAVES_DE_RESERVA`), cada uma tirando
 *      UMA peca da principal, para achar a peca que o driver erra.
 *
 * ---------------------------------------------------------------------------
 * A ESCOLHA
 * ---------------------------------------------------------------------------
 * `ordemDasVariantes` decide a ordem e a ORIGEM da decisao:
 *   - `chave-url` / `chave-guardada`: a variante da chave primeiro, aceita se
 *     COMPILAR (a sonda e anotada, mas nao manda: o jogador esta testando
 *     justamente o que ela desenha), depois a `minima` e o resto;
 *   - `regra-powervr`: `minima`, `sem-correcao`, `principal`, pela sonda;
 *   - `sonda`: `principal`, `sem-correcao`, `minima`, pela sonda.
 * Sonda que lanca ou nao sabe ("null") aceita; se nenhuma passa, fica a
 * primeira que compilou; se nenhuma compila, programa `null` e o mapa segue.
 * Nada aqui lanca.
 *
 * O relato ao `/analytics` sai DEPOIS do `CZ_NOTIFY_ACTORINIT`
 * (`relatarEscolhaDoSprite`, chamado pelo `MapRenderer` depois do `onLoad`).
 *
 * Teste: `tests/renderer/programaDoSprite.test.js`.
 */

/** A chave de URL que força a reserva (o dono testa com os jogadores). */
export const CHAVE_DE_RESERVA_FORCADA = 'forcarSpriteReserva';

/** Onde a chave fica guardada no aparelho (D-2054). */
export const CHAVE_DE_ARMAZENAMENTO = 'ragidle.forcarSpriteReserva';

/**
 * CHAVE -> VARIANTE (D-2054). Cada variante de diagnostico tira UMA peca da
 * principal; `=5` e `=6` partem o problema em fragment x vertex.
 *
 *   =0  limpa a chave guardada (volta a escolha automatica)
 *   =1  sem-correcao  vertex sem o bloco de correcao de profundidade
 *                     (raio-plano, `uViewModelMat`, `normalize`, `min` em z)
 *                     e sem o `uniform bool`; fragment principal
 *   =2  minima        tudo: vertex sem `Project`, sem bool, sem correcao;
 *                     fragment sem a paleta bilinear e sem `sampler2D` como
 *                     parametro (a que funcionou no moto g54)
 *   =3  sem-funcao    vertex principal com o `Project` escrito em linha (sem
 *                     funcao que recebe e reescreve uma `mat4`); fragment principal
 *   =4  sem-bool      vertex principal com `uniform int` no lugar do
 *                     `uniform bool`; fragment principal
 *   =5  fs-minimo     vertex principal; fragment da minima
 *   =6  vs-minimo     vertex da minima; fragment principal
 *   =9  nenhuma       nao guarda; so prova que o jogo nao cai sem programa
 */
export const CHAVES_DE_RESERVA = {
	1: 'sem-correcao',
	2: 'minima',
	3: 'sem-funcao',
	4: 'sem-bool',
	5: 'fs-minimo',
	6: 'vs-minimo'
};

/** A chave que tira TODAS as variantes (teste); nunca e guardada. */
export const CHAVE_SEM_PROGRAMA = 9;

/** Telemetria: o relato sai sempre que a GPU e PowerVR, mesmo com tudo ok. */
const GPU_DO_DEFEITO = /powervr|imagination|\bimg\b/i;

/*
 * A REGRA DO POWERVR B-SERIES (D-2054). Evidencia: DOIS aparelhos com a MESMA
 * GPU, BXM-8-256 (moto g54 5G, Android 15, driver "OpenGL ES 3.2 build
 * 1.15@6133110"; Poco M7 Pro, Dimensity 7025), relato de 06/10/2026: sprites
 * invisiveis com a `principal` e a `sem-correcao`, visiveis com a `minima`.
 *
 * O ALCANCE e a familia B-Series inteira (BXE, BXM, BXS), e nao so a BXM-8-256:
 * as tres saem do mesmo compilador de shader (o DDK 1.15+ da Imagination), e o
 * custo de errar e assimetrico — a `minima` num B-Series que funcionaria perde
 * so o alisamento da paleta e a correcao de profundidade da perna; a principal
 * num B-Series que nao funciona apaga o jogo. A geracao ANTERIOR (Rogue:
 * GE8320, GM9446, GX6250...) fica DE FORA: outro compilador, e nenhum relato.
 * O relato do `/analytics` sai em todo PowerVR (`GPU_DO_DEFEITO`), e e ele que
 * diz se o Rogue precisa entrar.
 */
export const GPU_DA_REGRA = /powervr\s*b-series|\bbx[ems]-\d/i;

/** A ordem automatica, sem chave nem regra. */
const ORDEM_PADRAO = ['principal', 'sem-correcao', 'minima'];

/** A ordem no PowerVR B-Series. */
const ORDEM_DO_POWERVR = ['minima', 'sem-correcao', 'principal'];

/**
 * A GPU cai na regra do PowerVR B-Series?
 *
 * @param {string} renderizador `UNMASKED_RENDERER_WEBGL`
 * @return {boolean}
 */
export function caiNaRegraDoPowerVR(renderizador) {
	return GPU_DA_REGRA.test(String(renderizador || ''));
}

function numeroDaChave(texto) {
	const t = String(texto === null || texto === undefined ? '' : texto).trim();
	if (t === '') return null;
	const n = Number.parseInt(t, 10);
	if (!Number.isFinite(n)) return 1;
	return n;
}

function chaveValida(n) {
	return n === CHAVE_SEM_PROGRAMA || Object.prototype.hasOwnProperty.call(CHAVES_DE_RESERVA, n);
}

/**
 * A chave da reserva: a da URL vence e e GUARDADA (`=0` limpa; `=9` vale so
 * nesta abertura); sem ela, vale a guardada. O armazenamento pode faltar ou
 * lancar (aba anonima, Safari com o site bloqueado): a chave da URL ainda vale.
 *
 * @param {string} [busca] `location.search`
 * @param {{getItem: Function, setItem: Function, removeItem: Function}|null} [armazenamento]
 * @return {{ chave: number, origem: 'chave-url'|'chave-guardada'|null, limpou: boolean }}
 */
export function lerChaveDeReserva(busca, armazenamento) {
	let daUrl = null;
	try {
		if (busca) {
			const valor = new URLSearchParams(busca).get(CHAVE_DE_RESERVA_FORCADA);
			if (valor !== null) daUrl = numeroDaChave(valor);
			if (valor !== null && daUrl === null) daUrl = 0;
		}
	} catch (_e) {
		daUrl = null;
	}

	if (daUrl !== null) {
		if (daUrl === 0) {
			tentar(() => armazenamento && armazenamento.removeItem(CHAVE_DE_ARMAZENAMENTO));
			return { chave: 0, origem: null, limpou: true };
		}
		if (chaveValida(daUrl)) {
			if (daUrl !== CHAVE_SEM_PROGRAMA) {
				tentar(() => armazenamento && armazenamento.setItem(CHAVE_DE_ARMAZENAMENTO, String(daUrl)));
			}
			return { chave: daUrl, origem: 'chave-url', limpou: false };
		}
		return { chave: 0, origem: null, limpou: false };
	}

	let guardada = null;
	tentar(() => {
		guardada = armazenamento ? numeroDaChave(armazenamento.getItem(CHAVE_DE_ARMAZENAMENTO)) : null;
	});
	if (guardada !== null && guardada !== CHAVE_SEM_PROGRAMA && chaveValida(guardada)) {
		return { chave: guardada, origem: 'chave-guardada', limpou: false };
	}
	return { chave: 0, origem: null, limpou: false };
}

function tentar(fn) {
	try {
		fn();
	} catch (_e) {
		/* armazenamento ausente ou bloqueado: a escolha segue sem ele */
	}
}

/**
 * A ordem das variantes e quem a decidiu.
 *
 * @param {Array<{nome: string}>} variantes todas, em qualquer ordem
 * @param {{ chave?: number, origemDaChave?: string|null, renderizador?: string }} contexto
 * @return {{ ordem: Array, origem: string, confiarNaPrimeira: boolean }}
 */
export function ordemDasVariantes(variantes, contexto) {
	const porNome = {};
	for (const v of variantes || []) porNome[v.nome] = v;
	const montar = nomes => {
		const vistos = {};
		const ordem = [];
		for (const n of nomes) {
			if (porNome[n] && !vistos[n]) {
				vistos[n] = true;
				ordem.push(porNome[n]);
			}
		}
		return ordem;
	};
	const c = contexto || {};

	if (c.chave === CHAVE_SEM_PROGRAMA) {
		return { ordem: [], origem: c.origemDaChave || 'chave-url', confiarNaPrimeira: true };
	}
	const daChave = c.chave ? CHAVES_DE_RESERVA[c.chave] : undefined;
	if (daChave) {
		return {
			ordem: montar([daChave, 'minima', ...ORDEM_PADRAO]),
			origem: c.origemDaChave || 'chave-url',
			confiarNaPrimeira: true
		};
	}
	if (caiNaRegraDoPowerVR(c.renderizador)) {
		return { ordem: montar(ORDEM_DO_POWERVR), origem: 'regra-powervr', confiarNaPrimeira: false };
	}
	return { ordem: montar(ORDEM_PADRAO), origem: 'sonda', confiarNaPrimeira: false };
}

/**
 * O que a falha diz de si: a etapa (compilar-vertex, compilar-fragment, link),
 * o log CRU do driver (`null` e diferente de `""`) e se o contexto estava
 * perdido. `WebGL.js` pendura os tres no erro; um erro sem eles vira `erro`.
 */
function descreverFalha(nome, erro) {
	return {
		variante: nome,
		etapa: (erro && erro.etapaDoShader) || 'erro',
		log:
			erro && 'logDoShader' in erro
				? erro.logDoShader
				: erro && erro.message
					? String(erro.message)
					: String(erro),
		contextoPerdido: erro && typeof erro.contextoPerdido === 'boolean' ? erro.contextoPerdido : null
	};
}

/**
 * A cascata. Nunca lanca.
 *
 * @param {object} gl contexto
 * @param {object} opcoes
 * @param {Array<{nome: string, vs: string, fs: string}>} opcoes.variantes JA na ordem (`ordemDasVariantes`)
 * @param {function} opcoes.criarPrograma `(gl, vs, fs) => programa`, lanca se falhar
 * @param {function} [opcoes.sondar] `(gl, programa) => { desenhou: true|false|null }`
 * @param {function} [opcoes.apagarPrograma] `(gl, programa)` para a variante descartada
 * @param {boolean} [opcoes.confiarNaPrimeira] a primeira fica se COMPILAR (a chave)
 * @return {{ programa: object|null, variante: string|null, falhas: Array, sondas: object }}
 */
export function escolherProgramaDoSprite(gl, opcoes) {
	const variantes = (opcoes && opcoes.variantes) || [];
	const falhas = [];
	const sondas = {};
	let reserva = null;

	for (let i = 0; i < variantes.length; i++) {
		const v = variantes[i];

		let programa;
		try {
			programa = opcoes.criarPrograma(gl, v.vs, v.fs);
		} catch (erro) {
			falhas.push(descreverFalha(v.nome, erro));
			continue;
		}
		if (!programa) {
			falhas.push({ variante: v.nome, etapa: 'erro', log: 'programa vazio', contextoPerdido: null });
			continue;
		}

		let desenhou = null;
		if (opcoes.sondar) {
			try {
				const sonda = opcoes.sondar(gl, programa);
				sondas[v.nome] = sonda;
				desenhou = sonda ? sonda.desenhou : null;
			} catch (erro) {
				sondas[v.nome] = { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };
				desenhou = null;
			}
		}

		// A chave manda na primeira: o jogador testa o que ELA desenha.
		const confiada = i === 0 && opcoes.confiarNaPrimeira === true;

		// `true`, "nao sei" ou confiada: esta serve.
		if (desenhou !== false || confiada) {
			if (reserva && reserva.programa !== programa) apagar(opcoes, gl, reserva.programa);
			return { programa, variante: v.nome, falhas, sondas };
		}

		// Compilou e nao desenhou: guarda a PRIMEIRA como ultimo recurso.
		falhas.push({ variante: v.nome, etapa: 'sonda', log: resumoDaSonda(sondas[v.nome]), contextoPerdido: null });
		if (!reserva) {
			reserva = { programa, nome: v.nome };
		} else {
			apagar(opcoes, gl, programa);
		}
	}

	if (reserva) {
		return { programa: reserva.programa, variante: reserva.nome, falhas, sondas };
	}
	return { programa: null, variante: null, falhas, sondas };
}

function apagar(opcoes, gl, programa) {
	try {
		if (opcoes.apagarPrograma) opcoes.apagarPrograma(gl, programa);
	} catch (_e) {
		/* apagar e limpeza; falhar nela nao muda a escolha */
	}
}

/**
 * Uma palavra sobre a sonda: `ok`, `?` (nao sabe) ou `reprovou(<casos>)`.
 */
export function resumoDaSonda(sonda) {
	if (!sonda || sonda.desenhou === null || sonda.desenhou === undefined) return '?';
	if (sonda.desenhou === true) return 'ok';
	const casos = sonda.casos
		? Object.keys(sonda.casos)
				.filter(k => sonda.casos[k] && !sonda.casos[k].passou)
				.join(',')
		: '';
	return 'reprovou(' + casos + ')';
}

/**
 * O texto da GPU: `UNMASKED_RENDERER_WEBGL` quando a extensao existe, senao o
 * `RENDERER` mascarado. Nunca lanca.
 *
 * @param {object} gl
 * @return {{ renderizador: string, versao: string, glsl: string }}
 */
export function descreverGpu(gl) {
	const ler = nome => {
		try {
			const v = gl.getParameter(nome);
			return v === null || v === undefined ? '' : String(v);
		} catch (_e) {
			return '';
		}
	};
	let renderizador = '';
	try {
		const ext = gl.getExtension && gl.getExtension('WEBGL_debug_renderer_info');
		if (ext) renderizador = ler(ext.UNMASKED_RENDERER_WEBGL);
	} catch (_e) {
		renderizador = '';
	}
	if (!renderizador) renderizador = ler(gl.RENDERER);
	return { renderizador, versao: ler(gl.VERSION), glsl: ler(gl.SHADING_LANGUAGE_VERSION) };
}

function textoDoLog(log) {
	if (log === null) return 'null';
	if (log === undefined) return 'undefined';
	const texto = String(log).replace(/\s+/g, ' ').trim();
	return texto === '' ? '""' : texto;
}

function textoDaFalha(f) {
	const perdido = f.contextoPerdido === true ? ' contexto-perdido' : '';
	return f.variante + ': ' + f.etapa + ' log=' + textoDoLog(f.log).slice(0, 60) + perdido;
}

/**
 * Ha o que relatar? Sim quando a escolha nao foi a automatica pura (chave ou
 * regra), quando alguma variante falhou, e tambem quando a GPU e PowerVR — o
 * "principal ok" la e o que diz se a sonda acertou.
 */
export function precisaRelatar(escolha, gpu) {
	if (!escolha) return false;
	if (escolha.origem && escolha.origem !== 'sonda') return true;
	if (escolha.falhas && escolha.falhas.length > 0) return true;
	if (escolha.variante !== 'principal') return true;
	return GPU_DO_DEFEITO.test((gpu && gpu.renderizador) || '');
}

/**
 * A mensagem do relato. Ela e a CHAVE de agregacao do `/analytics` (cortada em
 * 300), por isso leva a GPU: a linha da tabela "Erros do cliente" ja diz em
 * qual aparelho, qual variante ficou valendo, QUEM decidiu (chave da URL,
 * chave guardada, regra do PowerVR ou sonda) e o que a sonda achou dela.
 */
export function mensagemDoRelato(escolha, gpu) {
	const valendo = escolha.variante || 'nenhuma';
	const origem = escolha.origem || 'sonda';
	const automatica = origem === 'sonda' && escolha.falhas.length === 0;
	const cabeca = automatica
		? '[sprite] diagnostico: ' + valendo + ' ok'
		: '[sprite] valendo=' + valendo + ' origem=' + origem;
	const partes = [cabeca];
	if (!automatica && escolha.variante) partes.push('sonda=' + resumoDaSonda(escolha.sondas[escolha.variante]));
	if (escolha.sondaDoPrincipal) partes.push('principal-na-sonda=' + resumoDaSonda(escolha.sondaDoPrincipal));
	const falhas = escolha.falhas.map(textoDaFalha).join('; ');
	if (falhas) partes.push(falhas);
	partes.push('gpu=' + ((gpu && gpu.renderizador) || '?'));
	return partes.join(' | ').slice(0, 300);
}

/** A "pilha" do relato: os detalhes que nao cabem na chave. Sem dado pessoal. */
export function detalheDoRelato(escolha, gpu) {
	try {
		return JSON.stringify({
			variante: escolha.variante,
			origem: escolha.origem || 'sonda',
			chave: escolha.chave || 0,
			falhas: escolha.falhas.map(f => ({
				variante: f.variante,
				etapa: f.etapa,
				log: f.log === null || f.log === undefined ? f.log : String(f.log).slice(0, 200),
				contextoPerdido: f.contextoPerdido
			})),
			sondas: escolha.sondas,
			sondaDoPrincipal: escolha.sondaDoPrincipal,
			gpu
		}).slice(0, 1000);
	} catch (_e) {
		return undefined;
	}
}

/*
 * O estado da sessao: a escolha fica guardada ate o relato sair, UMA vez.
 */
let _escolha = null;
let _gpu = null;
let _relatado = false;

/** Guarda a escolha feita no `SpriteRenderer.init` (antes do aperto de mao). */
export function guardarEscolhaDoSprite(escolha, gpu) {
	_escolha = escolha;
	_gpu = gpu;
	_relatado = false;
	try {
		// Para a sonda na tela e para quem abre o console no aparelho.
		globalThis.__ragidleProgramaDoSprite = {
			variante: escolha ? escolha.variante : null,
			origem: escolha ? escolha.origem || 'sonda' : null,
			chave: escolha ? escolha.chave || 0 : 0,
			falhas: escolha ? escolha.falhas : [],
			sondas: escolha ? escolha.sondas : {},
			sondaDoPrincipal: escolha ? escolha.sondaDoPrincipal : undefined,
			gpu
		};
	} catch (_e) {
		/* diagnostico nao e caminho critico */
	}
}

/** A escolha da sessao (para teste e diagnostico). */
export function escolhaDoSprite() {
	return _escolha;
}

/**
 * Manda o relato, se houver, UMA vez por sessao. Chamado DEPOIS do
 * `CZ_NOTIFY_ACTORINIT` (D-993). Nunca lanca.
 *
 * @param {function} relatar `(mensagem, pilha)`, o `relatarErro`
 * @return {boolean} se mandou
 */
export function relatarEscolhaDoSprite(relatar) {
	try {
		if (_relatado || !_escolha) return false;
		if (!precisaRelatar(_escolha, _gpu)) {
			_relatado = true;
			return false;
		}
		_relatado = true;
		relatar(mensagemDoRelato(_escolha, _gpu), detalheDoRelato(_escolha, _gpu));
		return true;
	} catch (_e) {
		return false;
	}
}
