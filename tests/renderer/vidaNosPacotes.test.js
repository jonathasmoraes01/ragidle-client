import { beforeEach, describe, expect, it, vi } from 'vitest';
import Events from 'Core/Events.js';

// Os handlers, Entity.set, Life e o relogio visual sao reais. So assets/GL/UI
// alheios a barra sao substituidos; os retangulos desenhados sao observados.
const entidades = new Map();
const hooks = new Map();
const renderer = { tick: 1000 };
const numeros = [];
const config = { arco: false };
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
	isBow: () => config.arco, getWeaponType: () => 0, getMonsterName: () => 'Poring'
} }));
vi.doMock('DB/Status/StatusState.js', () => ({ default: { EffectState: {} } }));
vi.doMock('DB/Monsters/AttackEffectTable.js', () => ({ default: { PROJECTILE: {}, SPAWN: {} } }));
vi.doMock('DB/Skills/SkillAction.js', () => ({ default: { DEFAULT: () => ({ action: 2 }) } }));
vi.doMock('Renderer/Effects/Damage.js', () => ({ default: {
	add: (dano, alvo, t) => numeros.push({ dano, alvo, t }), TYPE: { COMBO: 16, COMBO_FINAL: 32 }
} }));
vi.doMock('Renderer/EffectManager.js', () => ({ default: {
	spam() {}, remove() {}, spamSkill() {}, spamSkillHit() {}, spamSkillBeforeHit() {}
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
]) vi.doMock(`UI/Components/${nome}/${nome}.js`, () => ({ default: { isGroupMember: () => false } }));
for (const nome of [
	'EntityAction', 'EntityCast', 'EntityDisplay', 'EntityDialog', 'EntitySound',
	'EntityView', 'EntityWalk', 'EntityRender', 'EntityRoom', 'EntityState',
	'EntityAttachments', 'EntityAnimations', 'EntityAura', 'EntityDropEffect', 'EntityEmblem'
]) vi.doMock(`Renderer/Entity/${nome}.js`, () => ({ default() {} }));
vi.doMock('Controls/EntityControl.js', () => ({ default: function () {
	this.ACTION = { IDLE: 0, WALK: 1, ATTACK: 2, HURT: 3, DIE: 4, READYFIGHT: 0 };
	this.setAction = ({ action }) => { this.action = action; };
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
function enviar(nome, dados) { hooks.get(packet.ZC[nome])(dados); }
function largura(e) {
	return e.life.ctx.fillRect.mock.calls.filter(c => c[0] === 1 && c[1] === 1 && c[3] === 3).at(-1)?.[2];
}
function avancar(t) { renderer.tick = t; Events.process(t); }
function nascer(hp = 1000) {
	enviar('NOTIFY_STANDENTRY11', { GID: 2, objecttype: Entity.TYPE_MOB, job: 1002, hp, maxhp: 1000 });
	return entidades.get(2);
}
function bater(damage = 300) {
	enviar('NOTIFY_ACT3', { GID: 1, targetGID: 2, action: 0, damage, leftDamage: 0, attackMT: 400, attackedMT: 200, count: 1 });
}
beforeEach(() => {
	Events.free(); entidades.clear(); numeros.length = 0; avancar(1000);
	config.arco = false;
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
		return { canvas: this, fillRect: vi.fn() };
	});
	const jogador = new Entity();
	jogador.set({ GID: 1, objecttype: Entity.TYPE_PC, job: 0 });
	entidades.set(1, jogador);
});

describe('vida no caminho real dos pacotes ate o desenho', () => {
	it('a flecha usa o instante real do projetil, nao um atraso fixo', () => {
		config.arco = true;
		const mob = nascer(); bater();
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 700, maxhp: 1000 });
		const impacto = numeros[0].t;
		expect(impacto).toBeGreaterThan(1400);
		avancar(impacto - 1); expect(largura(mob)).toBe(58);
		avancar(impacto); expect(largura(mob)).toBe(Math.round(58 * 0.7));
	});
	it('duas armas descontam a parte certa em cada impacto', () => {
		const mob = nascer();
		enviar('NOTIFY_ACT3', { GID: 1, targetGID: 2, action: 0, damage: 600, leftDamage: 100, attackMT: 400, attackedMT: 200, count: 1 });
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 300, maxhp: 1000 });
		avancar(1400); expect(largura(mob)).toBe(Math.round(58 * 0.4));
		avancar(1750); expect(largura(mob)).toBe(Math.round(58 * 0.3));
	});
	it('o STANDENTRY ja desenha a vida cheia antes de qualquer golpe', () => {
		const mob = nascer();
		expect(mob.life.hp).toBe(1000);
		expect(mob.life.hp_max).toBe(1000);
		expect(largura(mob)).toBe(58);
	});
	it('o primeiro hit e um MOVEENTRY nao baixam a barra antes do numero de dano', () => {
		const mob = nascer();
		bater();
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 700, maxhp: 1000 });
		enviar('NOTIFY_MOVEENTRY11', { GID: 2, objecttype: Entity.TYPE_MOB, job: 1002, hp: 700, maxhp: 1000, MoveData: [10,10,11,10] });
		expect(mob.life.hp).toBe(700);
		expect(largura(mob)).toBe(58);
		const impacto = numeros[0].t;
		avancar(impacto - 1);
		expect(largura(mob)).toBe(58);
		avancar(impacto);
		expect(largura(mob)).toBe(Math.round(58 * 0.7));
	});
	it('a habilidade de tres hits baixa em tres impactos e nao na conjuracao', () => {
		const mob = nascer();
		enviar('NOTIFY_SKILL2', { AID: 1, targetID: 2, SKID: 19, level: 1, damage: 300, count: 3, attackMT: 400, attackedMT: 100, action: 6 });
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 700, maxhp: 1000 });
		expect(largura(mob)).toBe(58);
		avancar(1400); expect(largura(mob)).toBe(Math.round(58 * 0.9));
		avancar(1600); expect(largura(mob)).toBe(Math.round(58 * 0.8));
		avancar(1800); expect(largura(mob)).toBe(Math.round(58 * 0.7));
	});
	it('o VANISH fatal so remove o mob no impacto', () => {
		const mob = nascer(); bater(1500);
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 0, maxhp: 1000 });
		enviar('NOTIFY_VANISH', { GID: 2, type: Entity.VT.DEAD });
		expect(entidades.get(2)).toBe(mob);
		expect(largura(mob)).toBe(58);
		avancar(numeros[0].t);
		expect(entidades.has(2)).toBe(false);
	});
	it('um novo nascimento com o mesmo GID nao herda o dano ou a morte antiga', () => {
		const velho = nascer(); bater(1500);
		enviar('NOTIFY_MONSTER_HP', { AID: 2, hp: 0, maxhp: 1000 });
		enviar('NOTIFY_VANISH', { GID: 2, type: Entity.VT.DEAD });
		const novo = nascer();
		expect(novo).not.toBe(velho);
		avancar(2000);
		expect(entidades.get(2)).toBe(novo);
		expect(largura(novo)).toBe(58);
	});
});
