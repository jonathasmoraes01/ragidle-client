/**
 * @module Renderer/EntityManager
 *
 * Manage Entity
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

// Load dependencies
import Session from 'Engine/SessionStorage.js';
import Entity from './Entity/Entity.js';
import SpriteRenderer from './SpriteRenderer.js';
import Mouse from 'Controls/MouseEventHandler.js';
import KEYS from 'Controls/KeyEventHandler.js';
import PathFinding from 'Utils/PathFinding.js';
import GraphicsSettings from 'Preferences/Graphics.js';
import Altitude from 'Renderer/Map/Altitude.js';
import GR2ModelRenderer from 'Renderer/GR2/GR2ModelRenderer.js';
import glMatrix from 'Utils/gl-matrix.js';
const _list = [];

/**
 * Release an entity's GR2 model instance (if any) at the true-removal sites, so a
 * removed mob leaves no ghost in the renderer's instance list. Idempotent.
 * @param {Entity} entity
 */
function releaseGr2(entity) {
	if (entity.gr2Model) {
		GR2ModelRenderer.detach(entity.gr2Model);
		entity.gr2Model = null;
	}
}

/*
 * Vetores reaproveitados do descarte por tela (ver o bloco em `render`).
 *
 * Fora do laco de proposito: alocar um `Float32Array` por entidade por quadro
 * daria centenas de objetos por segundo de vida curtissima, e a pressao de
 * coletor aparece como engasgo — que e exatamente o que esta frente combate.
 */
const _cullVP = glMatrix.mat4.create();

/**
 * Quanto o clip space e esticado antes de considerar a entidade fora da tela.
 *
 * O teste e sobre o PONTO da entidade (os pes), e o sprite cresce a partir
 * dele — para cima, sobretudo. Uma margem apertada faria monstro grande sumir
 * ao encostar na borda. 1,6 na horizontal e 2,6 para cima cobrem com folga o
 * maior sprite do jogo; o custo de errar para mais e desenhar alguns a mais,
 * e o de errar para menos e um bicho que pisca na beirada.
 */
const MARGEM_DE_CLIP_X = 1.6;
const MARGEM_DE_CLIP_CIMA = 2.6;
const MARGEM_DE_CLIP_BAIXO = 1.4;

// O(1) GID lookup map
const _gidMap = new Map();

// Sort optimization flags
let _renderSortDirty = true;
let _renderFrameCounter = 0;
let _pickSortDirty = true;
let _pickList = [];
let _lastSupportPriority = false;

/**
 * Find an Entity and return it directly via Map lookup (O(1))
 *
 * @param {number} gid
 * @returns {object|null} Entity
 */
function getEntityByGID(gid) {
	if (gid < 0) {
		return null;
	}
	return _gidMap.get(gid) || null;
}

/**
 * Find an Entity and return its index
 *
 * @param {number} aid
 * @returns {number} position
 */
function getEntityIndexBy(getter, value) {
	if (value < 0) {
		return -1;
	}

	const count = _list.length;
	for (let i = 0; i < count; ++i) {
		if (getter(_list[i]) === value) {
			return i;
		}
	}

	return -1;
}

/**
 * Fetch all entities using a callback
 *
 * @param {function} callback
 */
function forEach(callback) {
	const count = _list.length;
	for (let i = 0; i < count; ++i) {
		if (callback(_list[i]) === false) {
			return;
		}
	}
}

/**
 * Find an Entity and return it
 *
 * @param {number} gid
 * @returns {object} Entity
 */
function getEntity(gid) {
	// Reason for this check:
	// - Most packets your received is for the main character, so
	//   this check speed up the process.
	// - When you load a map, the main character is not in the list yet
	//   so we skip a lot of vital informations
	if (Session.Entity && Session.Entity.GID === gid) {
		return Session.Entity;
	}

	return getEntityByGID(gid);
}

/**
 * Pending transformations that arrived before entity spawned
 * { GID: { monster_transform: value, active_monster_transform: value, job_transform: value } }
 */
const pendingTransformations = {};

/**
 * Helper to safely store a pending transformation before entity spawns
 *
 * @param {number} aid - Actor ID
 * @param {string} key - transformation property name
 * @param {*} value - transformation value (monster ID, JobId, or null to clear)
 */
function storePendingTransform(aid, key, value) {
	if (!pendingTransformations[aid]) {
		pendingTransformations[aid] = {};
	}
	pendingTransformations[aid][key] = value;
}

/**
 * Find an Entity via AID and return it
 * Note: Currently Character ID (CID) is stored as AID in Entity
 * Note2: Need to review all AID implementation in both packet and entity
 * @param {number} aid
 * @returns {object} Entity
 */
function getEntityByCID(aid) {
	if (Session.Entity && Session.Entity.AID === aid) {
		return Session.Entity;
	}

	const index = getEntityIndexBy(e => e.AID, aid);
	return index < 0 ? null : _list[index];
}

/**
 * Add or replace entity
 *
 * @param {object} entity
 * @return {object}
 */
function addEntity(entity) {
	const existing = getEntityByGID(entity.GID);
	if (!existing) {
		_list.push(entity);
		_gidMap.set(entity.GID, entity);
		_renderSortDirty = true;
		_pickSortDirty = true;
		return entity;
	} else {
		existing.set(entity);
		return existing;
	}
}

/**
 * Clean up entities from list
 */
function free() {
	_list.forEach(entity => {
		releaseGr2(entity);
		entity.clean();
	});

	_list.length = 0;
	_gidMap.clear();
	_pickList.length = 0;
	_renderSortDirty = true;
	_pickSortDirty = true;
}

/**
 * Remove a GID from the lookup map without removing from render list.
 * Used when entity vanishes (OUTOFSIGHT) so the fade-out animation
 * continues but the GID slot is freed for re-use if entity re-appears.
 * @param {number} gid
 */
function removeGID(gid) {
	_gidMap.delete(gid);
}

/**
 * Remove an entity
 * @param {number} gid
 */
function removeEntity(gid) {
	const entity = _gidMap.get(gid);

	if (entity) {
		releaseGr2(entity);
		entity.clean();
		_gidMap.delete(gid);
		const index = _list.indexOf(entity);
		if (index > -1) {
			_list.splice(index, 1);
		}
		_renderSortDirty = true;
		_pickSortDirty = true;
	}
}

/**
 * @let {Entity} mouse over
 */
let _over = null;

/**
 * Return the entity the mouse is over
 */
function getOverEntity() {
	return _over;
}

/**
 * Set over entity
 */
let _saveShift = false;

function setOverEntity(target) {
	const current = _over;

	if (target === current && _saveShift === KEYS.SHIFT) {
		return;
	}

	_saveShift = KEYS.SHIFT;

	if (current) {
		current.onMouseOut();
	}

	if (target) {
		_over = target;
		target.onMouseOver();
	} else {
		_over = null;
	}
}

/**
 * @let {Entity} target
 */
let _focus = null;

/**
 * Return the entity selected by the user
 */
function getFocusEntity() {
	return _focus;
}

/**
 * Set over entity
 * @param {Entity} entity
 */
function setFocusEntity(entity) {
	_focus = entity;
}

/**
 * Sort entities by z-Index
 *
 * @param {Entity} a
 * @param {Entity} b
 */
function sort(a, b) {
	const aDepth = a.depth + (a.GID % 100) / 1000;
	const bDepth = b.depth + (b.GID % 100) / 1000;

	return bDepth - aDepth;
}

let _supportPriority = false;

/**
 * Set reverse priority for entity sorting (for supportive skills)
 * @param {boolean} v
 */
function setSupportPicking(v) {
	if (_supportPriority !== v) {
		_supportPriority = v;
		_pickSortDirty = true;
	}
}

/**
 * Sort entities by z-index and priorities
 *
 * @param {Entity} a
 * @param {Entity} b
 */
function sortByPriority(a, b) {
	let aDepth = a.depth + (!isNaN(a.GID) ? a.GID % 100 : 0) / 1000;
	let bDepth = b.depth + (!isNaN(b.GID) ? b.GID % 100 : 0) / 1000;

	if (_supportPriority) {
		aDepth -= Entity.PickingPriority.Support[a.objecttype] * 100;
		bDepth -= Entity.PickingPriority.Support[b.objecttype] * 100;
	} else {
		aDepth -= Entity.PickingPriority.Normal[a.objecttype] * 100;
		bDepth -= Entity.PickingPriority.Normal[b.objecttype] * 100;
	}

	return aDepth - bDepth;
}

/**
 * Render all entities (picking or not)
 *
 * A entidade projeta FORA da tela? (07/09/2026, frente de FPS)
 *
 * A conta e a mesma de `renderGUI` (`EntityRender.js`): leva a posicao para o
 * espaco da camera, projeta, e testa o clip space com a margem declarada em
 * `MARGEM_DE_CLIP_*`. Um `w` menor ou igual a zero quer dizer ATRAS da camera.
 *
 * Devolve `false` (isto e, "desenhe") em toda duvida: sem posicao, sendo o
 * proprio jogador, ou sendo efeito. Descartar por engano some com algo da tela,
 * e nenhum ganho de quadro paga isso.
 *
 * @param {Entity} entity
 * @param {number|string|null} meuGID o GID do jogador — nunca descartado
 * @returns {boolean}
 */
function foraDaTela(entity, meuGID) {
	/*
	 * INTERRUPTOR DE MEDICAO (07/09/2026): `window.__ri_culling = false`
	 * desliga o descarte em tempo de execucao.
	 *
	 * Ele existe porque comparar duas CORRIDAS nao separa o efeito da
	 * variancia — o personagem esta noutro lugar, com outros bichos, e o
	 * numero anda sozinho. Com o interruptor a sonda mede A/B **na mesma
	 * cena, no mesmo minuto**. Em producao a propriedade nao existe e o teste
	 * e um `!== false` por quadro por entidade.
	 */
	if (typeof window !== 'undefined' && window.__ri_culling === false) {
		return false;
	}
	if (!entity.position || entity.objecttype === entity.constructor.TYPE_EFFECT) {
		return false;
	}
	if (meuGID !== null && entity.GID === meuGID) {
		return false;
	}

	/*
	 * UMA multiplicacao de VETOR, e nao duas de MATRIZ.
	 *
	 * A primeira versao fazia `mat4.translate` + `mat4.multiply` por entidade —
	 * ~128 multiplicacoes cada, so para descobrir onde um PONTO cai. Medido em
	 * caca real, ela cortou 77% dos desenhos e ainda assim **piorou** o quadro
	 * com o processador livre: o teste custava mais que o desenho que
	 * economizava.
	 *
	 * Projetar um ponto precisa de 16 multiplicacoes, nao de 128: a matriz
	 * combinada (`_cullVP = projection x modelView`) e calculada UMA vez por
	 * quadro em `render`, e aqui so passa o vetor por ela. A troca de eixos e a
	 * mesma de `renderGUI`: no mundo o Y e a altura e o Z e a profundidade.
	 */
	const x = entity.position[0] + 0.5;
	const y = -entity.position[2];
	const z = entity.position[1] + 0.5;
	const m = _cullVP;

	const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
	if (cw <= 0) {
		return true;
	}
	const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
	if (cx < -cw * MARGEM_DE_CLIP_X || cx > cw * MARGEM_DE_CLIP_X) {
		return true;
	}
	const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
	if (cy < -cw * MARGEM_DE_CLIP_BAIXO || cy > cw * MARGEM_DE_CLIP_CIMA) {
		return true;
	}
	return false;
}

/**
 * @param {object} gl webgl context
 * @param {mat4} modelView
 * @param {mat4} projection
 * @param {object} fog structure
 * @param {object} renderEffects effect entities? true/false
 *
 * Infos: RO Game doesn't seems to render ambiant and diffuse on Sprites
 */
function render(gl, modelView, projection, fog, renderEffects) {
	let i, count;
	const tick = Date.now();

	// Stop rendering if no units to render (should never happened...)
	if (!_list.length) {
		return;
	}

	// Sort only when dirty or every 3 frames to stay responsive to depth changes
	_renderFrameCounter++;
	if (_renderSortDirty || (GraphicsSettings.performanceMode ? _renderFrameCounter >= 6 : _renderFrameCounter >= 3)) {
		_list.sort(sort);
		_renderSortDirty = false;
		_renderFrameCounter = 0;
		_pickSortDirty = true;
	}

	// Use program
	SpriteRenderer.bind3DContext(gl, modelView, projection, fog);

	// Pre-compute culling values outside the loop
	const doCulling = GraphicsSettings.performanceMode;
	let playerX, playerY, viewAreaSq;
	if (doCulling && Session.Entity && Session.Entity.position) {
		playerX = Session.Entity.position[0];
		playerY = Session.Entity.position[1];
		viewAreaSq = GraphicsSettings.viewArea * GraphicsSettings.viewArea;
	}

	/*
	 * DESCARTE DO QUE ESTA FORA DA TELA (07/09/2026, frente de FPS).
	 *
	 * O descarte que existia era por DISTANCIA em celulas do mapa
	 * (`viewArea`, 400) e so ligava com `performanceMode` — que vem desligado.
	 * Com raio de 400 celulas ele nao descartava praticamente nada: a validacao
	 * em caca real mediu **325 chamadas de desenho por quadro com 133 mobs**,
	 * e boa parte deles estava fora da tela.
	 *
	 * Este aqui e por TELA, e vale sempre. A conta e a mesma que `renderGUI` ja
	 * faz para posicionar a interface da entidade: projeta a posicao pelo
	 * `projection * modelView` e testa o clip space. O que sai daqui nao paga
	 * sprite, nem interface, nem os elementos de tela da barra de vida.
	 *
	 * A MARGEM E GENEROSA DE PROPOSITO (`MARGEM_DE_CLIP`). O teste e sobre o
	 * PONTO da entidade (os pes), e o sprite sobe a partir dele: um monstro
	 * grande com os pes logo abaixo da borda ainda aparece na tela. Cortar no
	 * limite exato faria o bicho sumir na beirada, que e pior que o custo que
	 * se economiza — e por isso a margem e maior para cima do que para baixo.
	 *
	 * O que NAO e descartado, e a razao de cada um:
	 *   - o proprio jogador (a camera o segue; se ele sair do teste, e a
	 *     camera que esta errada e o jogo fica sem personagem);
	 *   - efeitos (`TYPE_EFFECT`), que se posicionam sozinhos e podem nascer
	 *     longe do ponto de origem;
	 *   - entidade sem `position` valida, que cairia no teste por acidente.
	 */
	const meuGID = Session.Entity ? Session.Entity.GID : null;
	// A matriz combinada UMA vez por quadro: e o que torna o teste barato o
	// bastante para pagar (ver `foraDaTela`).
	glMatrix.mat4.multiply(_cullVP, projection, modelView);

	// Rendering
	for (i = 0, count = _list.length; i < count; ++i) {
		if (
			(_list[i].objecttype != _list[i].constructor.TYPE_EFFECT && !renderEffects) ||
			(_list[i].objecttype == _list[i].constructor.TYPE_EFFECT && renderEffects)
		) {
			// Remove from list
			if (_list[i].remove_tick && _list[i].remove_tick + _list[i].remove_delay < tick) {
				// Remove focus
				const entityFocus = getFocusEntity();
				if (entityFocus && entityFocus.GID === _list[i].GID) {
					entityFocus.onFocusEnd();
					setFocusEntity(null);
				}

				_gidMap.delete(_list[i].GID);
				releaseGr2(_list[i]);
				_list[i].clean();
				_list.splice(i, 1);
				i--;
				count--;
				_pickSortDirty = true;
				continue;
			}
			if (doCulling) {
				const dx = _list[i].position[0] - playerX;
				const dy = _list[i].position[1] - playerY;
				if (dx * dx + dy * dy > viewAreaSq) {
					continue;
				}
			}
			if (foraDaTela(_list[i], meuGID)) {
				continue;
			}
			_list[i].render(modelView, projection);
		}
	}

	// Clean program
	SpriteRenderer.unbind(gl);
}

/**
 * Intersect Entities
 */
function intersect() {
	let i, count;
	let entity;

	// Stop rendering if no units to render (should never happened...)
	if (!_list.length) {
		return;
	}

	// Only re-sort pick list when entities or priority changed
	if (_pickSortDirty || _lastSupportPriority !== _supportPriority) {
		_pickList = _list.slice();
		_pickList.sort(sortByPriority);
		_pickSortDirty = false;
		_lastSupportPriority = _supportPriority;
	}

	const x = Mouse.screen.x;
	const y = Mouse.screen.y;

	/*
	 * RAGIDLE (27/08/2026): quando o cursor cobre VOCE e OUTRA entidade, a
	 * outra vence — voce mesmo so volta quando esta sozinho no pixel.
	 *
	 * O caso que criou isto e o do dono, testando a troca a dois: os dois
	 * personagens nascem NA MESMA CELULA de Prontera (bounding rects
	 * identicos, medido: x1=1250 y1=350 x2=1310 y2=458 nos dois), e o picking
	 * devolvia sempre o proprio jogador — que TODO consumidor ignora (o menu
	 * de contexto exige `entity !== Session.Entity`, MapControl.js:293). O
	 * clique direito no colega "nao funcionava" exatamente para quem estava
	 * perto o bastante para negociar.
	 */
	let proprio = null;

	// Culling for picking
	const doCulling = GraphicsSettings.performanceMode;
	let playerX, playerY, viewAreaSq;
	if (doCulling && Session.Entity && Session.Entity.position) {
		playerX = Session.Entity.position[0];
		playerY = Session.Entity.position[1];
		viewAreaSq = GraphicsSettings.viewArea * GraphicsSettings.viewArea;
	}

	for (i = 0, count = _pickList.length; i < count; ++i) {
		entity = _pickList[i];

		// Culling for picking
		if (doCulling) {
			const dx = entity.position[0] - playerX;
			const dy = entity.position[1] - playerY;
			if (dx * dx + dy * dy > viewAreaSq) {
				continue;
			}
		}

		// No picking on dead entites
		if ((entity.action !== entity.ACTION.DIE || entity.objecttype === Entity.TYPE_PC) && entity.remove_tick === 0) {
			if (
				x > entity.boundingRect.x1 &&
				x < entity.boundingRect.x2 &&
				y > entity.boundingRect.y1 &&
				y < entity.boundingRect.y2
			) {
				if (entity === Session.Entity) {
					proprio = entity;
					continue;
				}
				return entity;
			}
		}
	}

	return proprio;
}

/**
 * Returns the closest entity to the source entity
 *
 * @param {entity} source entity
 * @param {type} entity type to look for
 */
function getClosestEntity(sourceEntity, type) {
	let closestEntity = false;
	let distance = Infinity;

	const srcX = sourceEntity.position[0];
	const srcY = sourceEntity.position[1];
	const view_range = GraphicsSettings.performanceMode ? GraphicsSettings.viewArea : 20;
	const viewRangeSq = view_range * view_range;

	_list.forEach(entity => {
		if (
			entity.GID !== sourceEntity.GID &&
			entity.objecttype === type &&
			entity.action !== entity.ACTION.DIE &&
			entity.remove_tick === 0
		) {
			const dx = entity.position[0] - srcX;
			const dy = entity.position[1] - srcY;
			const distSq = dx * dx + dy * dy;
			if (distSq > viewRangeSq) {
				return;
			}

			let dst = Infinity;
			if (closestEntity) {
				// Only pathfind if potentially closer than current best
				if (distSq < distance * distance) {
					dst = getPathDistance(sourceEntity, entity);
					if (dst && dst < distance) {
						closestEntity = entity;
						distance = dst;
					}
				}
			} else {
				dst = getPathDistance(sourceEntity, entity);
				if (dst) {
					closestEntity = entity;
					distance = dst;
				}
			}
		}
	});

	return closestEntity;
}

/**
 * Returns the lowest HP entity to the source entity
 *
 * @param {entity} source entity
 * @param {type} entity type to look for
 */
function getLowestHpEntity(sourceEntity, type) {
	let lowestHpEntity = null;
	let lowestHp = Infinity;

	const srcX = sourceEntity.position[0];
	const srcY = sourceEntity.position[1];
	const view_range = GraphicsSettings.performanceMode ? GraphicsSettings.viewArea : 20;
	const viewRangeSq = view_range * view_range;

	_list.forEach(entity => {
		if (
			entity.GID !== sourceEntity.GID &&
			entity.objecttype === type &&
			entity.life &&
			entity.life.hp > 0 &&
			entity.action !== entity.ACTION.DIE &&
			entity.remove_tick === 0
		) {
			const dx = entity.position[0] - srcX;
			const dy = entity.position[1] - srcY;
			const distSq = dx * dx + dy * dy;
			if (distSq > viewRangeSq) {
				return;
			}

			if (entity.life.hp < lowestHp) {
				lowestHp = entity.life.hp;
				lowestHpEntity = entity;
			}
		}
	});

	return lowestHpEntity;
}

/**
 * Returns the distance between two entities based on direct walkpath
 *
 * @param {entity} from entity
 * @param {entity} to entity
 */
function getPathDistance(fromEntity, toEntity) {
	const out = [];
	const count = PathFinding.search(
		fromEntity.position[0] | 0,
		fromEntity.position[1] | 0,
		toEntity.position[0] | 0,
		toEntity.position[1] | 0,
		1,
		out,
		Altitude.TYPE.WALKABLE
	);
	return count;
}

const _lifeCache = new Map();

function storeLife(gid, data) {
	const existing = _lifeCache.get(gid) || {};
	// Merge parcial: só atualiza campos que foram passados (não undefined)
	if (data.hp !== undefined) existing.hp = data.hp;
	if (data.hp_max !== undefined) existing.hp_max = data.hp_max;
	if (data.sp !== undefined) existing.sp = data.sp;
	if (data.sp_max !== undefined) existing.sp_max = data.sp_max;
	if (data.hunger !== undefined) existing.hunger = data.hunger;
	if (data.hunger_max !== undefined) existing.hunger_max = data.hunger_max;
	_lifeCache.set(gid, existing);
}

function getLife(gid) {
	return _lifeCache.get(gid) || null;
}

function removeLife(gid) {
	_lifeCache.delete(gid);
}

function clearLifeCache() {
	_lifeCache.clear();
}

const EntityManager = {
	free: free,
	add: addEntity,
	remove: removeEntity,
	removeGID: removeGID,
	get: getEntity,
	getByCID: getEntityByCID,
	forEach: forEach,

	getOverEntity: getOverEntity,
	setOverEntity: setOverEntity,
	getFocusEntity: getFocusEntity,
	setFocusEntity: setFocusEntity,

	getClosestEntity: getClosestEntity,
	getLowestHpEntity: getLowestHpEntity,

	storeLife: storeLife,
	getLife: getLife,
	removeLife: removeLife,
	clearLifeCache: clearLifeCache,

	render: render,
	intersect: intersect,
	setSupportPicking: setSupportPicking,

	pendingTransformations: pendingTransformations,
	storePendingTransform: storePendingTransform
};

/**
 * Get access to manager from Entity object
 */
Entity.Manager = EntityManager;

/**
 * Export
 */
export default EntityManager;
