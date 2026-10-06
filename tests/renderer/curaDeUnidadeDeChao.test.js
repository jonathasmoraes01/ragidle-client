import { beforeEach, describe, expect, it, vi } from 'vitest';
import Events from 'Core/Events.js';

/*
 * A CURA DE UMA UNIDADE DE CHAO (D-2036, 06/10/2026). O servidor manda o tique
 * do Santuario e da Macada de Idun como o emulador: `ZC_USE_SKILL` com AL_HEAL
 * e a UNIDADE como origem (`clif_skill_nodamage(unit, *bl, AL_HEAL, heal)`,
 * skill.cpp:6941). O handler e o REAL (`onEntityUseSkill`); o aparelho e o de
 * `umaAnimacaoPorArea.test.js`. Mede-se o que o jogador ve: o numero verde e a
 * luz da Cura no ALVO, e nenhuma pose na unidade desenhada.
 */
const entidades = new Map();
const hooks = new Map();
const renderer = { tick: 1000 };
const numeros = [];
const efeitos = { spamSkill: vi.fn(), spamSkillHit: vi.fn() };
const packet = { ZC: new Proxy({}, { get(alvo, nome) {
	return alvo[nome] ??= function Pacote() {};
} }) };
const manager = {
	get: id => entidades.get(id),
	add: e => entidades.set(e.GID, e),
	remove: id => { entidades.get(id)?.clean(); entidades.delete(id); },
	removeGID: id => entidades.delete(id),
	storeLife: vi.fn(), getLife: () => null, removeLife: vi.fn(),
	getFocusEntity: () => null
};
vi.doMock('Renderer/Renderer.js', () => ({ default: renderer }));
vi.doMock('Renderer/EntityManager.js', () => ({ default: manager }));
vi.doMock('Network/NetworkManager.js', () => ({ default: { hookPacket: (p, f) => hooks.set(p, f) } }));
vi.doMock('Network/PacketStructure.js', () => ({ default: packet }));
vi.doMock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.doMock('Core/Client.js', () => ({ default: { loadFile() {} } }));
vi.doMock('Engine/SessionStorage.js', () => ({ default: { AdminList: [], Entity: { GID: 9000 }, pet: {} } }));
vi.doMock('DB/DBManager.js', () => ({ default: {
	getJobClass: () => 'Novice', getWeaponSound: () => null,
	isDualWeapon: () => false, getPCAttackMotion: () => 6,
	isBow: () => false, isDoram: () => false, getWeaponType: () => 0, getMonsterName: () => 'Poring'
} }));
vi.doMock('DB/Status/StatusState.js', () => ({ default: { EffectState: {} } }));
vi.doMock('DB/Monsters/AttackEffectTable.js', () => ({ default: { PROJECTILE: {}, SPAWN: {} } }));
vi.doMock('DB/Skills/SkillAction.js', () => ({ default: { DEFAULT: () => ({ action: 2 }) } }));
vi.doMock('Renderer/Effects/Damage.js', () => ({ default: {
	add: (dano, alvo, t, _x, tipo) => numeros.push({ dano, alvo, t, tipo }), TYPE: { COMBO: 16, COMBO_FINAL: 32, HEAL: 64 }
} }));
vi.doMock('Renderer/EffectManager.js', () => ({ default: {
	spam() {}, remove() {}, spamSkillBeforeHit() {},
	spamSkill: (...args) => efeitos.spamSkill(...args),
	spamSkillSuccess() {},
	spamSkillHit: (...args) => efeitos.spamSkillHit(...args)
} }));
const sons = [];
vi.doMock('Audio/SoundManager.js', () => ({ default: { playPosition: nome => sons.push(nome), play() {} } }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: { getCellHeight: () => 0 } }));
vi.doMock('Renderer/Entity/EntityOverlay.js', () => ({ default: { append() {} } }));
vi.doMock('Engine/MapEngine/NomesDosJogadores.js', () => ({ default: { aplicar() {} } }));
vi.doMock('UI/Components/HuntAnalyzer/registroDaCaca.js', () => ({ registrarAbate() {}, registrarExp() {} }));

for (const nome of [
	'DB/Skills/SkillInfo.js', 'DB/Status/StatusConst.js',
	'DB/Emotions.js', 'DB/Skills/SkillEffect.js', 'DB/Effects/EffectConst.js',
	'DB/Pets/PetMessageConst.js', 'DB/Jobs/JobConst.js',
	'Engine/MapEngine/Guild.js', 'Renderer/Effects/MagicTarget.js',
	'Renderer/Effects/LockOnTarget.js', 'Renderer/Effects/MagicRing.js',
	'Renderer/ScreenEffectManager.js'
]) vi.doMock(nome, () => ({ default: {} }));
for (const nome of [
	'BasicInfo', 'ChatBox', 'ChatRoom', 'Escape', 'DeathWindow', 'HomunInformations',
	'MercenaryInformations', 'Inventory', 'ShortCut', 'StatusIcons', 'StatusIdle',
	'MiniMap', 'PartyFriends', 'Equipment'
]) vi.doMock(`UI/Components/${nome}/${nome}.js`, () => ({ default: {
	isGroupMember: () => false,
	addText() {},
	TYPE: { INFO: 2, BLUE: 16, ERROR: 32 },
	FILTER: { BATTLE: 15, PARTY_BATTLE: 16 }
} }));
for (const nome of [
	'EntityAction', 'EntityCast', 'EntityDisplay', 'EntityDialog', 'EntitySound',
	'EntityView', 'EntityWalk', 'EntityRender', 'EntityRoom', 'EntityState',
	'EntityAttachments', 'EntityAnimations', 'EntityAura', 'EntityDropEffect', 'EntityEmblem'
]) vi.doMock(`Renderer/Entity/${nome}.js`, () => ({ default() {} }));
vi.doMock('Controls/EntityControl.js', () => ({ default: function () {
	this.ACTION = { IDLE: 0, WALK: 1, ATTACK: 2, HURT: 3, DIE: 4, READYFIGHT: 0, SIT: 5 };
	this.setAction = ({ action }) => { this.action = action; this.poses = (this.poses ?? 0) + 1; };
	this.files = { shadow: {} };
	this.display = { name: '', update() {}, clean() {}, STYLE: {}, TYPE: {} };
	this.walk = { speed: 150, index: 0, total: 0 };
	this.walkTo = vi.fn();
	this.aura = { remove() {}, load() {}, free() {} };
	this.animations = { free() {} };
	this.dropEffect = { free() {} };
	for (const campo of ['emblem', 'dialog', 'cast', 'room', 'attachments']) {
		this[campo] = { clean() {}, set() {}, remove() {} };
	}
} }));

const { default: Entity } = await import('Renderer/Entity/Entity.js');
const { default: iniciar } = await import('Engine/MapEngine/Entity.js');
const { default: SkillId } = await import('DB/Skills/SkillConst.js');
iniciar();

const JOGADOR = 9000;
const SACERDOTE = 9001;
const SANTUARIO = 5000009;
function cura(de, valor = 100) {
	hooks.get(packet.ZC.USE_SKILL2)({ SKID: SkillId.AL_HEAL, level: valor, targetAID: JOGADOR, srcAID: de, result: 1 });
}

beforeEach(() => {
	Events.free(); entidades.clear(); numeros.length = 0; sons.length = 0;
	efeitos.spamSkill.mockClear(); efeitos.spamSkillHit.mockClear();
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
		return { canvas: this, fillRect: vi.fn() };
	});
	const jogador = new Entity();
	jogador.set({ GID: JOGADOR, objecttype: Entity.TYPE_PC, job: 0 });
	entidades.set(JOGADOR, jogador);
	const sacerdote = new Entity();
	sacerdote.set({ GID: SACERDOTE, objecttype: Entity.TYPE_PC, job: 8 });
	entidades.set(SACERDOTE, sacerdote);
	const santuario = new Entity();
	santuario.set({ GID: SANTUARIO, objecttype: Entity.TYPE_EFFECT, job: 0 });
	entidades.set(SANTUARIO, santuario);
});

describe('o tique do Santuario no cliente (skill.cpp:6941)', () => {
	it('o numero verde, o som e a luz da Cura aparecem no ALVO', () => {
		cura(SANTUARIO, 100);
		expect(numeros).toHaveLength(1);
		expect(numeros[0].dano).toBe(100);
		expect(numeros[0].alvo).toBe(entidades.get(JOGADOR));
		expect(numeros[0].tipo).toBe(64);
		expect(sons).toEqual(['_heal_effect.wav']);
		expect(efeitos.spamSkill).toHaveBeenCalledTimes(1);
		expect(efeitos.spamSkill.mock.calls[0].slice(0, 2)).toEqual([SkillId.AL_HEAL, JOGADOR]);
	});

	it('a unidade desenhada (a origem) nao faz pose a cada tique', () => {
		const santuario = entidades.get(SANTUARIO);
		const antes = santuario.poses ?? 0;
		cura(SANTUARIO);
		cura(SANTUARIO);
		expect(santuario.poses ?? 0, 'o Santuario ganhou setAction').toBe(antes);
	});

	it('CONTROLE: a Cura conjurada por um personagem continua pondo ELE em pose', () => {
		const sacerdote = entidades.get(SACERDOTE);
		const antes = sacerdote.poses ?? 0;
		cura(SACERDOTE);
		expect(sacerdote.poses ?? 0).toBe(antes + 1);
		expect(numeros).toHaveLength(1);
	});
});
