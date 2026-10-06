/**
 * O PROGRAMA DO SPRITE TEM RESERVA (06/10/2026, D-2048).
 *
 * ---------------------------------------------------------------------------
 * O DEFEITO
 * ---------------------------------------------------------------------------
 * Em celulares com a GPU PowerVR B-Series BXM-8-256 (moto g54 5G, Poco M7 Pro;
 * Chrome via ANGLE sobre OpenGL ES 3.2) os SPRITES sumiam: monstros, jogadores,
 * o proprio personagem e os numeros de dano. O mapa, as arvores, os nomes, as
 * barras de HP e a HUD apareciam. Tudo o que some passa por UM programa, o do
 * `SpriteRenderer` (o dano tambem: `Damage.js` desenha com ele). O `/analytics`
 * registrou `WebGL::CompileShader() - Fail to compile Vertex shader: null`.
 *
 * Ate aqui havia um programa so: se ele falhasse, `SpriteRenderer.init`
 * lancava DENTRO do `onMapComplete`, antes do `Background.remove` que monta a
 * HUD e manda o `CZ_NOTIFY_ACTORINIT` (D-993). E se ele compilasse mas o driver
 * o executasse errado, nao havia como saber: o sprite saia fora do recorte e
 * ninguem lancava nada.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO FAZ
 * ---------------------------------------------------------------------------
 * Tenta as variantes em ordem (`VARIANTES_DO_SPRITE` em `SpriteRenderer.js`):
 *
 *   1. `principal`     — o shader de sempre, com a correcao de profundidade;
 *   2. `sem-correcao`  — o mesmo sem o bloco de raio-plano por vertice;
 *   3. `minima`        — billboard sem funcao auxiliar, paleta sem bilinear.
 *
 * A escolhida e a PRIMEIRA que compila, linka E desenha na sonda
 * (`sondaDoSprite.js`: um quad branco num framebuffer 32x32, com e sem a
 * correcao, lido de volta). A sonda e o que pega o "compila mas nao desenha".
 *
 * Duas guardas contra a sonda mentir:
 *   - sonda que LANCA ou nao consegue montar o framebuffer devolve `null`
 *     ("nao sei") e a variante e ACEITA — sonda quebrada nunca rebaixa nada;
 *   - se NENHUMA variante passar na sonda, fica a primeira que compilou (o
 *     comportamento de antes), e nao a lista vazia.
 *
 * Se nenhuma compilar, o programa e `null`: o `SpriteRenderer` vira um
 * desenhista mudo e o MAPA CONTINUA DE PE. Nada aqui lanca.
 *
 * O relato ao `/analytics` sai DEPOIS do `CZ_NOTIFY_ACTORINIT`
 * (`relatarEscolhaDoSprite`, chamado pelo `MapRenderer` depois do `onLoad`).
 *
 * Teste: `tests/renderer/programaDoSprite.test.js`.
 */

/** A chave de URL que força a reserva (o dono testa com os jogadores). */
export const CHAVE_DE_RESERVA_FORCADA = 'forcarSpriteReserva';

/** A expressao que reconhece a GPU do defeito no texto do renderizador. */
const GPU_DO_DEFEITO = /powervr|imagination|\bimg\b/i;

/**
 * Quantas variantes PULAR, lido da busca da URL: `?forcarSpriteReserva=1` pula
 * a principal; `=2` pula tambem a sem-correcao; um numero maior que a lista
 * pula todas (para provar que o jogo nao cai sem programa). Valor nao numerico
 * e nao vazio conta como 1.
 *
 * @param {string} [busca] `location.search`
 * @return {number}
 */
export function nivelDeReservaForcado(busca) {
	try {
		if (!busca) return 0;
		const valor = new URLSearchParams(busca).get(CHAVE_DE_RESERVA_FORCADA);
		if (valor === null) return 0;
		const texto = String(valor).trim();
		if (texto === '' || texto === '0') return 0;
		const numero = Number.parseInt(texto, 10);
		if (Number.isFinite(numero)) return Math.max(0, Math.min(numero, 9));
		return 1;
	} catch (_e) {
		return 0;
	}
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
 * @param {Array<{nome: string, vs: string, fs: string}>} opcoes.variantes em ordem de preferencia
 * @param {function} opcoes.criarPrograma `(gl, vs, fs) => programa`, lanca se falhar
 * @param {function} [opcoes.sondar] `(gl, programa) => { desenhou: true|false|null }`
 * @param {function} [opcoes.apagarPrograma] `(gl, programa)` para a variante descartada
 * @param {number} [opcoes.pular] quantas variantes pular de proposito
 * @return {{ programa: object|null, variante: string|null, falhas: Array, sondas: object }}
 */
export function escolherProgramaDoSprite(gl, opcoes) {
	const variantes = (opcoes && opcoes.variantes) || [];
	const pular = (opcoes && opcoes.pular) || 0;
	const falhas = [];
	const sondas = {};
	let reserva = null;

	for (let i = 0; i < variantes.length; i++) {
		const v = variantes[i];

		if (i < pular) {
			falhas.push({ variante: v.nome, etapa: 'forcada', log: null, contextoPerdido: null });
			continue;
		}

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

		// `true` ou "nao sei": esta serve.
		if (desenhou !== false) {
			if (reserva && reserva.programa !== programa) apagar(opcoes, gl, reserva.programa);
			return { programa, variante: v.nome, falhas, sondas };
		}

		// Compilou e nao desenhou: guarda a PRIMEIRA como ultimo recurso.
		falhas.push({ variante: v.nome, etapa: 'sonda', log: 'nao desenhou', contextoPerdido: null });
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
	if (f.etapa === 'forcada') return f.variante + ': forcada';
	const perdido = f.contextoPerdido === true ? ' contexto-perdido' : '';
	return f.variante + ': ' + f.etapa + ' log=' + textoDoLog(f.log).slice(0, 60) + perdido;
}

/**
 * Ha o que relatar? Sim quando alguma variante falhou (ou foi pulada), e
 * tambem quando a GPU e a do defeito — o "principal ok" no PowerVR e o que diz
 * se o conserto pegou la, e sem ele o silencio seria igual a "ninguem abriu".
 */
export function precisaRelatar(escolha, gpu) {
	if (!escolha) return false;
	if (escolha.falhas && escolha.falhas.length > 0) return true;
	if (escolha.variante !== 'principal') return true;
	return GPU_DO_DEFEITO.test((gpu && gpu.renderizador) || '');
}

/**
 * A mensagem do relato. Ela e a CHAVE de agregacao do `/analytics` (cortada em
 * 300), por isso leva a GPU: a linha da tabela "Erros do cliente" ja diz em
 * qual aparelho e qual variante ficou valendo.
 */
export function mensagemDoRelato(escolha, gpu) {
	const valendo = escolha.variante || 'nenhuma';
	const cabeca =
		escolha.falhas.length === 0 ? '[sprite] diagnostico: ' + valendo + ' ok' : '[sprite] valendo=' + valendo;
	const falhas = escolha.falhas.map(textoDaFalha).join('; ');
	const placa = (gpu && gpu.renderizador) || '?';
	return (cabeca + (falhas ? ' | ' + falhas : '') + ' | gpu=' + placa).slice(0, 300);
}

/** A "pilha" do relato: os detalhes que nao cabem na chave. Sem dado pessoal. */
export function detalheDoRelato(escolha, gpu) {
	try {
		return JSON.stringify({
			variante: escolha.variante,
			falhas: escolha.falhas.map(f => ({
				variante: f.variante,
				etapa: f.etapa,
				log: f.log === null || f.log === undefined ? f.log : String(f.log).slice(0, 300),
				contextoPerdido: f.contextoPerdido
			})),
			sondas: escolha.sondas,
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
			falhas: escolha ? escolha.falhas : [],
			sondas: escolha ? escolha.sondas : {},
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
