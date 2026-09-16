import { beforeEach, describe, expect, it, vi } from 'vitest';
import Events from 'Core/Events.js';

/*
 * UMA ANIMACAO POR CONJURACAO DE AREA (14/09/2026, relato do dono: "quando a
 * nevasca pega em 3 mobs, aparecem 3 nevascas diferentes em vez de aparecer so
 * uma").
 *
 * O handler de golpe de habilidade (`onEntityUseSkillToAttack`) e o REAL; o
 * aparelho e o de `vidaNosPacotes.test.js`, com o `EffectManager` espiado. O
 * servidor manda o golpe do tique com a UNIDADE como origem e o alvo secundario
 * do splash como `DMG_SPLASH` (repo do jogo, `animacao-de-area-no-fio.ts`); aqui
 * se mede o que o cliente desenha com cada um.
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
	isBow: () => false, getWeaponType: () => 0, getMonsterName: () => 'Poring'
} }));
vi.doMock('DB/Status/StatusState.js', () => ({ default: { EffectState: {} } }));
vi.doMock('DB/Monsters/AttackEffectTable.js', () => ({ default: { PROJECTILE: {}, SPAWN: {} } }));
vi.doMock('DB/Skills/SkillAction.js', () => ({ default: { DEFAULT: () => ({ action: 2 }) } }));
vi.doMock('Renderer/Effects/Damage.js', () => ({ default: {
	add: (dano, alvo, t) => numeros.push({ dano, alvo, t }), TYPE: { COMBO: 16, COMBO_FINAL: 32 }
} }));
vi.doMock('Renderer/EffectManager.js', () => ({ default: {
	spam() {}, remove() {}, spamSkillBeforeHit() {},
	spamSkill: (...args) => efeitos.spamSkill(...args),
	spamSkillHit: (...args) => efeitos.spamSkillHit(...args)
} }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: { getCellHeight: () => 0 } }));
vi.doMock('Renderer/Entity/EntityOverlay.js', () => ({ default: { append() {} } }));
vi.doMock('Engine/MapEngine/NomesDosJogadores.js', () => ({ default: { aplicar() {} } }));
vi.doMock('UI/Components/HuntAnalyzer/registroDaCaca.js', () => ({ registrarAbate() {}, registrarExp() {} }));

for (const nome of [
	'DB/Skills/SkillConst.js', 'DB/Skills/SkillInfo.js', 'DB/Status/StatusConst.js',
	'DB/Emotions.js', 'DB/Skills/SkillEffect.js', 'DB/Effects/EffectConst.js',
	'DB/Pets/PetMessageConst.js', 'DB/Jobs/JobConst.js', 'Audio/SoundManager.js',
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
iniciar();

const WZ_STORMGUST = 89;
const MOB = 2;
function enviar(nome, dados) { hooks.get(packet.ZC[nome])(dados); }
function golpe(de, extra = {}) {
	enviar('NOTIFY_SKILL2', {
		AID: de, targetID: MOB, SKID: WZ_STORMGUST, level: 10, damage: 300, count: 1,
		attackMT: 400, attackedMT: 100, action: 6, ...extra
	});
}

beforeEach(() => {
	Events.free(); entidades.clear(); numeros.length = 0;
	efeitos.spamSkill.mockClear(); efeitos.spamSkillHit.mockClear();
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
		return { canvas: this, fillRect: vi.fn() };
	});
	const jogador = new Entity();
	jogador.set({ GID: 9000, objecttype: Entity.TYPE_PC, job: 0 });
	entidades.set(9000, jogador);
	enviar('NOTIFY_STANDENTRY11', { GID: MOB, objecttype: Entity.TYPE_MOB, job: 1002, hp: 1000, maxhp: 1000 });
});

describe('o golpe de habilidade desenha a habilidade UMA vez por conjuracao', () => {
	it('CONTROLE: o golpe do proprio jogador, com acao cheia, desenha a habilidade no alvo', () => {
		golpe(9000);
		expect(efeitos.spamSkill).toHaveBeenCalledTimes(1);
		expect(efeitos.spamSkillHit).toHaveBeenCalledTimes(1);
	});

	it('o alvo secundario do splash (DMG_SPLASH) leva o dano e o impacto, e nao a habilidade inteira', () => {
		golpe(9000, { action: 5 });
		expect(efeitos.spamSkill).not.toHaveBeenCalled();
		expect(efeitos.spamSkillHit).toHaveBeenCalledTimes(1);
		expect(numeros).toHaveLength(1);
	});

	it('o tique de uma unidade que o cliente NAO desenha como entidade (a Nevasca) nao redesenha a tempestade', () => {
		golpe(5000007);
		expect(efeitos.spamSkill).not.toHaveBeenCalled();
		expect(efeitos.spamSkillHit).toHaveBeenCalledTimes(1);
		expect(numeros).toHaveLength(1);
	});

	it('o tique de uma unidade que o cliente desenha como entidade (Magnus, Muralha de Fogo) tambem nao, e ela nao faz pose', () => {
		const unidade = new Entity();
		unidade.set({ GID: 5000008, objecttype: Entity.TYPE_EFFECT, job: 0 });
		entidades.set(5000008, unidade);
		const posesAntes = unidade.poses ?? 0;
		golpe(5000008);
		expect(efeitos.spamSkill).not.toHaveBeenCalled();
		expect(efeitos.spamSkillHit).toHaveBeenCalledTimes(1);
		expect(unidade.poses ?? 0, 'a unidade de chao fez pose de golpe').toBe(posesAntes);
	});
});
