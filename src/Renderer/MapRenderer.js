/**
 * Renderer/MapRenderer.js
 *
 * Rendering sprite in 2D or 3D context
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Thread from 'Core/Thread.js';
import SoundManager from 'Audio/SoundManager.js';
import BGM from 'Audio/BGM.js';
import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import Background from 'UI/Background.js';
import Cursor from 'UI/CursorManager.js';
import Session from 'Engine/SessionStorage.js';
import MemoryManager from 'Core/MemoryManager.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import Camera from 'Renderer/Camera.js';

import { nevoaNoZoom } from 'Renderer/nevoaNoZoom.js';
import EntityManager from 'Renderer/EntityManager.js';
import GridSelector from 'Renderer/Map/GridSelector.js';
import Ground from 'Renderer/Map/Ground.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Water from 'Renderer/Map/Water.js';
import Models from 'Renderer/Map/Models.js';
import AnimatedModels from 'Renderer/Map/AnimatedModels.js';
import GR2ModelRenderer from 'Renderer/GR2/GR2ModelRenderer.js';
import Sounds from 'Renderer/Map/Sounds.js';
import Effects from 'Renderer/Map/Effects.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import EffectManager from 'Renderer/EffectManager.js';
import SignboardManager from 'Renderer/SignboardManager.js';
import ScreenEffectManager from 'Renderer/ScreenEffectManager.js';
import Sky from 'Renderer/Effects/Sky.js';
import Damage from 'Renderer/Effects/Damage.js';
import GraphicsSettings from 'Preferences/Graphics.js';
import MapPreferences from 'Preferences/Map.js';
import glMatrix from 'Utils/gl-matrix.js';
import PACKETVER from 'Network/PacketVerManager.js';
import JoystickUI from 'UI/Components/JoystickUI/JoystickUI.js';

import PostProcess from 'Renderer/Effects/PostProcess.js';
import Bloom from 'Renderer/Effects/Shaders/Bloom.js';
import VerticalFlip from 'Renderer/Effects/Shaders/VerticalFlip.js';
import GaussianBlur from 'Renderer/Effects/Shaders/GaussianBlur.js';
import CAS from 'Renderer/Effects/Shaders/CAS.js';
import FXAA from 'Renderer/Effects/Shaders/FXAA.js';
import Vibrance from 'Renderer/Effects/Shaders/Vibrance.js';
import Cartoon from 'Renderer/Effects/Shaders/Cartoon.js';
import Blind from 'Renderer/Effects/Shaders/Blind.js';

import Upsampling from 'Renderer/Effects/Shaders/Upsampling.js';
import WebGL from 'Utils/WebGL.js';
import { relatarErro } from 'UI/relatoDeErro.js';
import { relatarEscolhaDoSprite } from 'Renderer/programaDoSprite.js';
import { criarVigiaDoCarregamento } from 'Renderer/vigiaDoCarregamento.js';
import {
	anotarCargaRefeita,
	anotarErroDaCarga,
	anotarFimNoWorker,
	anotarMontado,
	anotarTravou,
	comecarCarregamento,
	relatarDesistencia
} from 'Renderer/relatoDoCarregamento.js';
import {
	esconderAviso,
	esconderSaida,
	esconderTudo,
	mostrarAviso,
	mostrarSaida,
	saidaVisivel,
	textoDoAviso
} from 'UI/saidaDoCarregamento.js';
import { NOVAS_TENTATIVAS_DE_ARQUIVO } from 'Core/tentativasDeArquivo.js';
import { ehDedo } from 'UI/escalaDaHud.js';

const mat4 = glMatrix.mat4;
const _pos = new Uint16Array(2);

/*
 * A CARGA DE MAPA QUE NAO FICA PRESA PARA SEMPRE (D-2055, 06/10/2026 - relatos
 * de producao: "a barra parou em 2% e nunca termina", sobretudo no celular).
 *
 * Cada carga real (o mapa muda) ganha um NUMERO; o worker o devolve em toda
 * mensagem dela, e a mensagem de uma carga que nao e mais a atual e descartada
 * - e o que deixa o "Tentar de novo" refazer a carga sem que o `MAP_GROUND`
 * da carga velha caia na nova. A vigia olha a carga inteira (o prazo por
 * arquivo mora em `Core/baixarComVigia.js`) e, se nada anda, mostra a saida.
 *
 * Tudo isto roda ANTES do `CZ_NOTIFY_ACTORINIT` e por isso passa por
 * `protegido`: uma excecao na medida, na vigia ou na saida vira uma linha no
 * console e um relato de erro, e nunca impede o mapa de carregar (D-993).
 */
let _carga = 0;
let _mapaDaCarga = '';
let _refazendo = false;

function protegido(nome, fn) {
	try {
		fn();
	} catch (erro) {
		console.error('[MapRenderer] ' + nome + ' falhou; o carregamento segue', erro);
		relatarErro('[MapRenderer] ' + nome + ': ' + (erro && erro.message), erro && erro.stack);
	}
}

/** So aceita a mensagem da carga atual (a sem numero e de quem nao numera: o GrfViewer). */
function daCargaAtual(fn) {
	return function (dado, envelope) {
		if (envelope && typeof envelope.carga === 'number' && envelope.carga !== _carga) {
			return;
		}
		fn.call(MapRenderer, dado);
	};
}

function mostrarSaidaDaCarga(texto) {
	anotarTravou();
	mostrarSaida({
		texto,
		dedo: ehDedo(),
		aoTentar: () => MapRenderer.refazerCarga(),
		aoRecarregar: () => {
			relatarDesistencia('recarregou');
			import('UI/recargaMantendoASessao.js')
				.then(m => m.recarregarMantendoASessao())
				.catch(() => {
					try {
						window.location.reload();
					} catch {
						/* sem recarga, o jogador ainda tem o botao do navegador */
					}
				});
		}
	});
}

/**
 * O WORKER FALHOU FORA DE QUALQUER PEDIDO (D-2055, achado A3) - `Core/Thread.js`.
 *
 * A mensagem que nao se le (`messageerror`, a memoria do celular acabando no
 * meio de um `postMessage`) derruba a carga em curso NA HORA: ela nunca vai
 * terminar, e esperar a vigia seria deixar o jogador 45 s olhando uma barra
 * que ja morreu. O erro solto (`error`) so e relatado: a montagem do mapa no
 * worker ja tem guarda propria (`MapLoader.carregarArquivo`), entao o que
 * escapa dela e quase sempre de outro pedido (um sprite), e derrubar a carga
 * por isso seria alarme falso - se for da carga, a vigia abre a saida.
 *
 * @param {{tipo: string, mensagem: string}} falha
 */
function onFalhaDoWorker(falha) {
	protegido('a falha do worker', () => {
		relatarErro('[Thread] ' + falha.tipo + ': ' + falha.mensagem);
		if (MapRenderer.loading && falha.tipo === 'messageerror') {
			falharCargaAtual('A memória do aparelho não deu conta do mapa (mensagem ilegível do carregador).');
		}
	});
}

/**
 * Desiste da carga em curso: ela ganha um numero novo (as mensagens tardias da
 * velha sao descartadas), o worker para de carrega-la, e a falha segue pelo
 * caminho de sempre (a saida com "Tentar de novo").
 *
 * @param {string} motivo
 */
function falharCargaAtual(motivo) {
	const carga = ++_carga;
	try {
		Thread.send('CANCEL_MAP', null);
	} catch {
		/* o worker que nao recebe nao muda a decisao */
	}
	onMapComplete.call(MapRenderer, carga, false, motivo, undefined);
}

const _vigia = criarVigiaDoCarregamento({
	aoTravar: () =>
		protegido('a saida da carga', () =>
			mostrarSaidaDaCarga(
				'O mapa parou de chegar do servidor. Toque em "Tentar de novo" para pedir o mapa outra vez.'
			)
		),
	aoDemorar: atividade =>
		protegido('o aviso da carga', () => mostrarAviso(textoDoAviso(atividade, NOVAS_TENTATIVAS_DE_ARQUIVO))),
	aoAndar: () => protegido('o aviso da carga', esconderAviso)
});

/**
 * @param {string} mapname
 * @returns {string} map name without its extension
 *
 * EXPORTADA (D-1385, 13/09/2026): era privada do modulo, e por isso
 * `MapEngine.onMapChange` nao tinha como fazer a MESMA pergunta que
 * `setMap` (linha ~169, abaixo) ja fazia — "isto e uma troca de mapa de
 * verdade, ou um teleporte no MESMO mapa (a Asa de Mosca)?" — e acabava
 * nao perguntando nada, sondando o mapa a cada `ZC_NPCACK_MAPMOVE`. Duas
 * rotas escritas a mao para a mesma resposta; agora e uma so.
 */
export function stripMapExtension(mapname) {
	return (mapname || '').replace(/\.[^.]*$/, '');
}

/**
 * Renderer Namespace
 */
class MapRenderer {
	/**
	 * @var {string} current map's name
	 */
	static currentMap = '';

	/** O `setMap` que chegou com um carregamento em curso (ver `setMap`). */
	static mapaPendente = null;

	/**
	 * @var {object} Global Light Structure
	 */
	static light = null;

	/**
	 * @var {object} Water Structure
	 */
	static water = null;

	/**
	 * @var {array} Sounds object list
	 */
	static sounds = null;

	/**
	 * @var {array} Effects object list
	 */
	static effects = null;

	/**
	 * @var {array} is loading a map ?
	 */
	static loading = false;

	/**
	 * @var {Float32Array} diffuse Modified diffuse color
	 */
	static diffuse = null;

	/**
	 * @var {Object} Fog structure
	 */
	static fog = {
		use: MapPreferences.useFog,
		exist: true,
		far: 30,
		near: 180,
		/**
		 * D-538: os valores COMO A TABELA OS ESCREVEU, antes de a distancia
		 * da camera entrar na conta. `near`/`far` acima sao os DERIVADOS, e
		 * mudam a cada quadro — sem guardar a base, escalar viraria
		 * composicao e a nevoa fugiria para o infinito em poucos segundos.
		 */
		baseNear: 180,
		baseFar: 30,
		factor: 1.0,
		color: new Float32Array([1, 1, 1])
	};

	/**
	 * Load a map
	 *
	 * @param {string} mapname to load
	 */
	static setMap(mapname) {
		/*
		 * PEDIDO DURANTE UM CARREGAMENTO (16/09/2026): guardado, e nao
		 * descartado. O ultimo vence, e ele e atendido quando o carregamento em
		 * curso termina (`atenderMapaPendente`). Descarta-lo deixava o cliente
		 * desenhando um mapa enquanto o servidor punha o personagem noutro — o
		 * caido em economia viaja (D-1511) e reconecta com a aba ainda oculta.
		 */
		if (this.loading) {
			this.mapaPendente = mapname;
			return;
		}
		MapRenderer.vigiarVisibilidade();

		// Support for instance map
		// Is it always 3 digits ?
		mapname = mapname
			.replace(/^(\d{3})(\d@)/, '$2') // 0061@tower   -> 1@tower
			.replace(/^\d{3}#/, ''); // 003#prontera -> prontera

		// Clean objects
		SoundManager.stop();
		Renderer.stop();
		/*
		 * O CHAT ATRAVESSA A TROCA DE MAPA (10/09/2026). Relato do alfa: "nem
		 * digitar no chat global" no celular. Toda troca de mapa passa por aqui
		 * — inclusive o teleporte no MESMO mapa (a Asa de Mosca, e a Asa
		 * automatica do VIP depois de 10 s sem alvo, servidor/idle/teleporte.ts)
		 * — e tirava o chat da pagina: o campo perdia o foco, o teclado do
		 * celular fechava, e o `onAppend` o devolvia MINIMIZADO. O cliente
		 * oficial nao fecha o chat num warp. O `MapEngine` so o anexa de novo se
		 * ele saiu (a entrada no jogo), e sair do jogo continua tirando tudo.
		 */
		UIManager.removeComponents(['ChatBox']);
		Cursor.setType(Cursor.ACTION.DEFAULT);

		// The server may address the same map with different extensions (.gat/.rsw)
		const oldMap = stripMapExtension(this.currentMap);
		const newMap = stripMapExtension(mapname);

		// Don't reload a map when it's just a local teleportation
		if (oldMap !== newMap) {
			this.loading = true;
			BGM.stop();
			this.currentMap = mapname;
			_mapaDaCarga = mapname;
			const carga = ++_carga;
			const refeita = _refazendo;
			_refazendo = false;
			protegido('a medida da carga', () => {
				esconderTudo();
				if (refeita) {
					anotarCargaRefeita();
				} else {
					comecarCarregamento(mapname);
				}
			});

			// Parse the filename (ugly RO)
			const filename = mapname.replace(/\.gat$/i, '.rsw');

			Background.setLoading(function () {
				// Hooking Thread
				Thread.hook('MAP_PROGRESS', daCargaAtual(onProgressUpdate));
				Thread.hook('MAP_ATIVIDADE', daCargaAtual(onAtividade));
				Thread.hook('MAP_WORLD', daCargaAtual(onWorldComplete));
				Thread.hook('MAP_GROUND', daCargaAtual(onGroundComplete));
				Thread.hook('MAP_ALTITUDE', daCargaAtual(onAltitudeComplete));
				Thread.hook('MAP_MODELS', daCargaAtual(onModelsComplete));
				Thread.hook('MAP_ANIMATED_MODEL', daCargaAtual(onAnimatedModelComplete));
				Thread.hook('THREAD_FALHOU', onFalhaDoWorker);

				// Start Loading
				MapRenderer.free();
				Renderer.remove();
				Thread.send('LOAD_MAP', { filename, carga }, (sucesso, erro, _pedido, medida) =>
					onMapComplete.call(MapRenderer, carga, sucesso, erro, medida)
				);
				protegido('a vigia da carga', () => _vigia.comecar());
			});

			return;
		}

		const gl = Renderer.getContext();
		EntityManager.free();
		Damage.free(gl);
		EffectManager.free(gl);
		JoystickUI.onRestore();

		// Basic TP
		Mouse.intersect = false;
		Background.remove(() => {
			// A mesma guarda do carregamento normal, mais abaixo (F28, auditoria
			// de 22/09/2026): sem ela, uma excecao na montagem do teleporte no
			// mesmo mapa impedia o `render` de recomecar — a tela congelava.
			try {
				MapRenderer.onLoad();
				Sky.setUpCloudData();
			} catch (erro) {
				console.error('[MapRenderer] a montagem do teleporte falhou; o jogo segue', erro);
				// O `console.error` do jogador nunca chega a ninguem (05/10/2026): a pilha
				// vai ao `/analytics/erro`, que e onde se descobre o que parou a entrada.
				relatarErro('[MapRenderer] montagem: ' + (erro && erro.message), erro && erro.stack);
			}

			Renderer.render(MapRenderer.onRender);
			Mouse.intersect = true;
		});
	}

	/**
	 * "TENTAR DE NOVO" (D-2055): refaz a carga do mapa SEM sair do jogo. O
	 * socket, o login e o `onLoad` (o estou-pronto do pacote mais novo, posto
	 * pelo `MapEngine`) ficam; so a carga recomeca, com outro numero - o worker
	 * cancela a velha e aborta os pedidos dela. Se havia um mapa guardado para
	 * depois (`mapaPendente`), e ele que carrega: ele e o mais novo.
	 */
	static refazerCarga() {
		const alvo = this.mapaPendente || _mapaDaCarga || this.currentMap;
		protegido('a vigia da carga', () => {
			_vigia.terminar();
			esconderTudo();
		});
		if (!alvo) {
			return;
		}
		this.mapaPendente = null;
		this.loading = false;
		this.currentMap = '';
		_refazendo = true;
		this.setMap(alvo);
	}

	/**
	 * Clean up data
	 */
	/**
	 * RAGIDLE (08/09/2026 — reporte do dono: "se eu deixar a aba em segundo
	 * plano alguns minutos, demora seculos ate a tela do game abrir de novo, e
	 * as vezes abre travando"). Em aba oculta o navegador nao entrega quadro
	 * (`requestAnimationFrame` para), mas o WebSocket continua chegando: cada
	 * golpe visto pelo servidor virava um numero de dano e um efeito, empilhados
	 * numa lista que so o render esvazia. Minutos depois eram milhares, cada um
	 * com textura, e o primeiro quadro da volta os percorria e removia um a um.
	 *
	 * Duas medidas, nas duas pontas: o que e efemero NAO NASCE em aba oculta
	 * (`Damage.add`), e o que ja venceu SAI DE UMA VEZ ao voltar, antes do
	 * primeiro quadro (`Damage.free`, `EffectManager.limparEfemeros`). O laco
	 * de render nao e reiniciado: o tick de servidor precisa do tempo real que
	 * passou. Registrado UMA vez; `setMap` chama a cada mapa e isto e idempotente.
	 */
	static vigiarVisibilidade() {
		if (MapRenderer._vigiaDeVisibilidade || typeof document === 'undefined') {
			return;
		}
		MapRenderer._vigiaDeVisibilidade = function aoMudarVisibilidade() {
			if (document.visibilityState !== 'visible') {
				return;
			}
			const gl = Renderer.getContext();
			if (!gl) {
				return;
			}
			try {
				Damage.free(gl);
				EffectManager.limparEfemeros(gl, Date.now());
			} catch (e) {
				console.error('[MapRenderer] limpeza ao voltar para a aba falhou', e);
			}
		};
		document.addEventListener('visibilitychange', MapRenderer._vigiaDeVisibilidade);
	}

	static free() {
		const gl = Renderer.getContext();
		EntityManager.free();
		EntityManager.clearLifeCache();
		GridSelector.free(gl);
		Sounds.free();
		Effects.free();
		Ground.free(gl);
		Water.free(gl);
		Models.free(gl);
		AnimatedModels.free(gl);
		GR2ModelRenderer.free(gl);
		Damage.free(gl);
		EffectManager.free(gl);
		SignboardManager.free();
		SoundManager.stop();
		BGM.stop();

		// Release WebGL resources for post-processing effects
		PostProcess.clean(gl);

		Mouse.intersect = false;

		this.light = null;
		this.water = null;
		this.sounds = null;
		this.effects = null;
	}

	/**
	 * Rendering world
	 *
	 * @param {number} tick - game tick
	 * @param {object} gl context
	 */
	/**
	 * A nevoa deste quadro (D-538). A regra mora em `Renderer/nevoaNoZoom.js`,
	 * com a medicao que a motivou; aqui so a aplicamos ao estado do renderer.
	 *
	 * Roda por QUADRO, e sempre a partir de `baseNear`/`baseFar`: escalar em
	 * cima do valor ja escalado seria composicao, e a nevoa fugiria para o
	 * infinito em poucos segundos de zoom.
	 */
	static ajustarNevoaAoZoom() {
		const fog = MapRenderer.fog;
		if (!fog.exist) {
			return;
		}
		const ajustada = nevoaNoZoom({ near: fog.baseNear, far: fog.baseFar }, Camera.zoom);
		fog.near = ajustada.near;
		fog.far = ajustada.far;
	}

	static onRender(tick, gl) {
		PostProcess.prepare(gl);

		const fog = MapRenderer.fog;
		fog.use = MapPreferences.fog;
		MapRenderer.ajustarNevoaAoZoom();
		const light = MapRenderer.light;

		let x, y;

		// Clean mouse position in world
		Mouse.world.x = -1;
		Mouse.world.y = -1;
		Mouse.world.z = -1;

		// Update camera
		Camera.update(tick);

		const modelView = Camera.modelView;
		const projection = Camera.projection;
		const normalMat = Camera.normalMat;

		// Render Ground
		Ground.render(gl, modelView, projection, normalMat, fog, light);

		// Spam map effects
		Effects.spam(Session.Entity.position, tick);

		if (Mouse.intersect && Altitude.intersect(modelView, projection, _pos)) {
			x = _pos[0];
			y = _pos[1];
			const isWalkable = Altitude.getCellType(x, y) & Altitude.TYPE.WALKABLE;

			Mouse.world.x = x;
			Mouse.world.y = y;
			Mouse.world.z = Altitude.getCellHeight(x, y);

			if (isWalkable) {
				if (Session.captchaGetIdOnFloorClick) {
					// render Grid Selector on floor range
					const range = Session.captchaGetIdOnFloorRange;

					// render on range
					const cells = Altitude.getCellsInSquareRange(x, y, range);
					cells.forEach(cell => {
						GridSelector.render(gl, modelView, projection, fog, cell.x, cell.y);
					});
				}
				GridSelector.render(gl, modelView, projection, fog, x, y);
			}

			// NO walk cursor
			// TODO: Know the packet version for this feature
			if (PACKETVER.value >= 20200101) {
				if (Cursor.getActualType() === Cursor.ACTION.NOWALK && isWalkable) {
					Cursor.setType(Cursor.ACTION.DEFAULT, false);
				}
				if (Cursor.getActualType() === Cursor.ACTION.DEFAULT && !isWalkable) {
					Cursor.setType(Cursor.ACTION.NOWALK, false);
				}
			}
		}

		// Display zone effects and entities
		Sky.render(gl, modelView, projection, fog, tick);

		Models.render(gl, modelView, projection, normalMat, fog, light);
		AnimatedModels.render(gl, modelView, projection, normalMat, fog, light, tick);
		// GR2 mobs render here with the opaque world models, before EntityManager.render below
		// -- hence the 1-frame lag documented in GR2ModelRenderer.render (syncFromEntity reads the
		// entity pose one frame stale). Ordering is intentional (opaque geometry pass).
		GR2ModelRenderer.render(gl, modelView, projection, normalMat, fog, light, tick);

		// Render transparent elements before ground
		ScreenEffectManager.render(gl, modelView, projection, fog, tick, true);

		EffectManager.render(gl, modelView, projection, fog, tick, true);

		//Render Entities (no effects)
		EntityManager.render(gl, modelView, projection, fog, false);

		// Rendering water (after sprites, billboard projection pushes it to back)
		Water.render(gl, modelView, projection, fog, light, tick);

		EffectManager.render(gl, modelView, projection, fog, tick, false);
		EntityManager.render(gl, modelView, projection, fog, true);

		Damage.render(gl, modelView, projection, fog, tick);

		// Render signboards
		SignboardManager.render(gl, modelView, projection);

		// Screen overlayed Effects
		ScreenEffectManager.render(gl, modelView, projection, fog, tick);

		// Play sounds
		Sounds.render(Session.Entity.position, tick);

		// Find entity over the cursor
		if (Mouse.intersect) {
			const entity = EntityManager.intersect();
			EntityManager.setOverEntity(entity);
		}

		// Clean up
		MemoryManager.clean(gl, tick);

		// Finalize frame with post-processing effects
		PostProcess.render(gl);
	}

	/**
	 * Callback to execute once the map is loaded
	 */
	static onLoad() {}
}

/**
 * Received progress from Thread
 *
 * @param {number} percent (progress)
 */
function onProgressUpdate(percent) {
	Background.setPercent(percent);
	protegido('a vigia da carga', () => {
		_vigia.progresso();
		// A carga que se recuperou sozinha depois da saida aberta: a saida sai.
		if (saidaVisivel()) esconderSaida();
	});
}

/**
 * A rede da carga deu sinal (bytes chegando, nova tentativa saindo) - D-2055.
 * @param {object} atividade
 */
function onAtividade(atividade) {
	protegido('a vigia da carga', () => _vigia.atividade(atividade));
}

/**
 * Received parsed world
 */
function onWorldComplete(data) {
	this.light = data.light;
	this.water = data.water;
	this.sounds = data.sound;
	this.effects = data.effect;
	this.diffuse = new Float32Array(this.light.diffuse);

	// Set default env color
	this.light.env = new Float32Array([
		1 - (1 - this.light.diffuse[0]) * (1 - this.light.ambient[0]),
		1 - (1 - this.light.diffuse[1]) * (1 - this.light.ambient[1]),
		1 - (1 - this.light.diffuse[2]) * (1 - this.light.ambient[2])
	]);

	// Calculate light direction
	this.light.direction = new Float32Array(3);
	const longitude = (this.light.longitude * Math.PI) / 180;
	const latitude = (this.light.latitude * Math.PI) / 180;

	const dirMat4 = mat4.create();
	// Original client first rotates around X then Y, but then multiplies matrixes in reverse order
	// Which means we have to rotate Y first then X
	mat4.rotateY(dirMat4, dirMat4, longitude);
	mat4.rotateX(dirMat4, dirMat4, latitude);
	const dirVec = mat4.multiplyVec3([0, 1, 0], dirMat4);

	this.light.direction[0] = -dirVec[0];
	this.light.direction[1] = -dirVec[1];
	this.light.direction[2] = -dirVec[2];
}

/**
 * Received ground data from Thread
 */
function onGroundComplete(data) {
	const gl = Renderer.getContext();

	this.water.mesh = data.waterMesh;
	this.water.vertCount = data.waterVertCount;

	Ground.init(gl, data);
	Water.init(gl, this.water);

	// Initialize sounds
	this.sounds.forEach(sound => {
		const tmp = -sound.pos[1];
		sound.pos[0] += data.width;
		sound.pos[1] = sound.pos[2] + data.height;
		sound.pos[2] = tmp;
		sound.range *= 0.2;
		sound.tick = 0;
		sound.cycle = !sound.cycle ? 7 : sound.cycle;
		Sounds.add(sound);
	});

	this.effects.forEach(effect => {
		// Note: effects objects do not need to be centered in a cell
		// as we apply +0.5 in the shader, we have to revert it.
		const tmp = -effect.pos[1] + 1; //WTF????????
		effect.pos[0] += data.width - 0.5;
		effect.pos[1] = effect.pos[2] + data.height - 0.5;
		effect.pos[2] = tmp;

		effect.tick = 0;

		Effects.add(effect);
	});

	this.effects.length = 0;
	this.sounds.length = 0;
}

/**
 * Receiving parsed GAT from Thread
 */
function onAltitudeComplete(data) {
	const gl = Renderer.getContext();
	Altitude.init(data);
	GridSelector.init(gl);
}

/**
 * Receiving parsed RSMs from Thread
 */
function onModelsComplete(data) {
	Models.init(Renderer.getContext(), data);
}

/**
 * Receiving animated RSM model from Thread
 */
function onAnimatedModelComplete(data) {
	const gl = Renderer.getContext();
	AnimatedModels.add(gl, data);
}

/**
 * Register PostProcessing Modules in pass order
 */
function registerPostProcessModules(gl) {
	if (WebGL.detectBadWebGL(gl)) {
		GraphicsSettings.bloom = false;
	} else {
		PostProcess.register(Bloom, gl);
	}
	PostProcess.register(GaussianBlur, gl);
	PostProcess.register(FXAA, gl);
	PostProcess.register(CAS, gl);
	PostProcess.register(Cartoon, gl);
	PostProcess.register(Vibrance, gl);
	PostProcess.register(VerticalFlip, gl);
	PostProcess.register(Blind, gl);

	// Final Pass GPU Upsampling for Performance Mode
	PostProcess.register(Upsampling, gl);
}

/**
 * Once the map finished to load
 *
 * @param {number} carga - o numero da carga (D-2055): a de uma carga que ja foi
 *   refeita e descartada
 * @param {boolean} success
 * @param {string} error
 * @param {object} [medida] - a medida por fase do worker (`Loaders/medidaDaCarga.js`)
 */
function onMapComplete(carga, success, error, medida) {
	if (carga !== _carga) {
		return;
	}
	protegido('a medida da carga', () => {
		_vigia.terminar();
		anotarFimNoWorker(success, medida);
	});
	const worldResource = this.currentMap.replace(/\.gat$/i, '.rsw');
	const mapInfo = DB.getMap(worldResource);

	// Problem during loading ?
	if (!success) {
		/*
		 * RAGIDLE (B1, 06/09/2026) — A BANDEIRA TEM DE CAIR AQUI TAMBEM.
		 *
		 * `setMap` comeca com `if (this.loading) return;`, e `loading` so
		 * voltava a `false` no caminho de SUCESSO (dentro do
		 * `Background.remove` la embaixo). Um mapa que falhasse ao carregar
		 * deixava a bandeira presa em `true`, e dai em diante TODA troca de
		 * mapa era descartada em silencio: o servidor movia o personagem e o
		 * cliente continuava desenhando o mapa velho, com a populacao dele.
		 *
		 * E a outra metade do "so o Ctrl+F5 desbuga" — e a unica saida sem
		 * recarregar nao existia.
		 */
		MapRenderer.loading = false;
		/*
		 * A FALHA TEM SAIDA (D-2055). A caixa de erro de antes ficava por cima
		 * da arte de carregamento, que NAO saia - o jogador lia "Can't find
		 * file", apertava OK e voltava a barra parada, para sempre. Agora a
		 * falha abre a mesma saida da carga parada, com o erro no texto.
		 *
		 * E o nome do mapa VOLTA A VAZIO: sem isto o "Tentar de novo" (ou o
		 * proximo pedido do servidor para o MESMO mapa) caia no ramo do
		 * teleporte no mesmo mapa - montava a HUD e mandava o estou-pronto sem
		 * mapa nenhum carregado.
		 */
		this.currentMap = '';
		protegido('a saida da carga', () => {
			anotarErroDaCarga(error);
			// A falha vai ao `/analytics/erro` tambem: e la que se ve QUAL arquivo.
			relatarErro('[carga do mapa] ' + String(error || 'erro desconhecido'));
			mostrarSaidaDaCarga('O mapa não carregou (' + String(error || 'erro desconhecido') + ').');
		});
		atenderMapaPendente();
		return;
	}

	// Play BGM
	BGM.play((mapInfo && mapInfo.mp3) || '01.mp3');

	// Apply fog to map
	this.fog.exist = !!(mapInfo && mapInfo.fog);
	if (this.fog.exist) {
		this.fog.baseNear = mapInfo.fog.near * 240;
		this.fog.baseFar = mapInfo.fog.far * 240;
		this.fog.near = this.fog.baseNear;
		this.fog.far = this.fog.baseFar;
		this.fog.factor = mapInfo.fog.factor;
		this.fog.color.set(mapInfo.fog.color);
	}

	// Initialize renderers
	Renderer.init();
	const gl = Renderer.getContext();

	SpriteRenderer.init(gl);
	Sky.init(gl, worldResource);
	Damage.init(gl);
	EffectManager.init(gl);
	ScreenEffectManager.init(gl, worldResource);
	registerPostProcessModules(gl);
	JoystickUI.onRestore();

	// Starting to render
	Background.remove(() => {
		MapRenderer.loading = false;
		protegido('a medida da carga', () => {
			esconderTudo();
			anotarMontado();
		});

		/*
		 * OUTRO MAPA PENDENTE: ESTE NAO MONTA (H08, auditoria 2 de 22/09/2026).
		 *
		 * O `onLoad` pendurado aqui ja e o do pacote MAIS NOVO (o `MapEngine` o
		 * troca a cada `onMapChange`), e ele manda o `CZ_NOTIFY_ACTORINIT`.
		 * Rodado sobre o mapa que o `atenderMapaPendente` logo abaixo vai
		 * descartar, o servidor descia o lote do mapa novo (NPCs, jogadores,
		 * mobs) e zerava o `carregandoMapa`; o `setMap` pendente apagava essas
		 * entidades, e o ACTORINIT do carregamento de verdade chegava a um
		 * servidor que, fiel ao rAthena (`clif_parse_LoadEndAck` sai cedo com o
		 * jogador ja no mapa), nao manda lote de novo. O mapa ficava vazio. Quem
		 * monta e avisa o servidor e o carregamento do mapa pendente.
		 */
		const vaiSerDescartado = temOutroMapaPendente();

		/*
		 * O JOGO APARECE MESMO QUE A MONTAGEM DA HUD FALHE (16/09/2026).
		 *
		 * `onLoad` monta a HUD inteira; uma excecao ali abortava este callback
		 * antes de `Renderer.show()`, e o jogador ficava sem canvas e sem HUD,
		 * atras do veu preto. O erro vai ao console com o nome de quem lancou —
		 * esconder a tela nao o conserta, so o esconde.
		 */
		try {
			if (!vaiSerDescartado) {
				MapRenderer.onLoad();
				Sky.setUpCloudData();
				ScreenEffectManager.startMapflagEffect(worldResource);
			}
		} catch (erro) {
			console.error('[MapRenderer] a montagem do mapa falhou; o jogo aparece mesmo assim', erro);
			// O `console.error` do jogador nunca chega a ninguem (05/10/2026): a pilha
			// vai ao `/analytics/erro`, que e onde se descobre o que parou a entrada.
			relatarErro('[MapRenderer] montagem: ' + (erro && erro.message), erro && erro.stack);
		}

		/*
		 * O RELATO DO PROGRAMA DO SPRITE SAI DEPOIS DO ESTOU-PRONTO (D-2048).
		 * A cascata roda no `SpriteRenderer.init` la em cima, ANTES do aperto
		 * de mao; o envio fica para depois dele (D-993). O `onLoad` agenda o
		 * `CZ_NOTIFY_ACTORINIT` num `setTimeout(0)` logo na primeira linha, e
		 * este relogio, mais longo e agendado depois, nunca passa na frente.
		 * O relato sai uma vez por pagina, e so quando ha o que dizer.
		 */
		if (!vaiSerDescartado) {
			setTimeout(() => {
				try {
					relatarEscolhaDoSprite(relatarErro);
				} catch (_e) {
					/* relato nao e caminho critico */
				}
			}, 1000);
		}

		// Display game
		Renderer.show();
		Renderer.render(MapRenderer.onRender);
		Mouse.intersect = true;

		atenderMapaPendente();
	});
}

/**
 * O pedido guardado durante o carregamento: outro mapa carrega agora; o mesmo
 * mapa ja esta na tela, e o `onLoad` que rodou acima ja e o da conexao mais
 * recente (`MapEngine` o reatribui a cada `onMapChange`).
 */
function atenderMapaPendente() {
	const pendente = MapRenderer.mapaPendente;
	const outroMapa = temOutroMapaPendente();
	MapRenderer.mapaPendente = null;
	if (outroMapa) {
		MapRenderer.setMap(pendente);
	}
}

/**
 * Ha um pedido guardado para um mapa DIFERENTE do que acabou de carregar (H08)?
 * Uma regra so para as duas perguntas: "este mapa monta?" e "carrego outro?".
 */
function temOutroMapaPendente() {
	const pendente = MapRenderer.mapaPendente;
	return !!pendente && stripMapExtension(pendente) !== stripMapExtension(MapRenderer.currentMap);
}

/**
 * Export
 */
export default MapRenderer;
