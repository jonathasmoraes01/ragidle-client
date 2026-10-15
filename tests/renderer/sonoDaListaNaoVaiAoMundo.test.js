/**
 * O SONO DA LISTA NAO VAI AO MUNDO (J21, 14/10/2026, D-2478 e R128; rodada 2 da frente, B1 do critico).
 *
 * O char-server poe `OPT1_SLEEP` (4) no `bodystate` do bloco de quem dorme, para a selecao acender o icone. O
 * critico mediu, na pilha da frente, o jogador que dormiu entrando no mundo com `bodyState=4 anexos=[status-sleep]`:
 * `CharEngine.js` montava o `Player` com o objeto CRU da lista, `Entity.set` copia toda chave que o prototipo
 * conhece (`Entity.prototype._bodyState`), e o setter de `EntityState.js` (`updateBodyState`) poe o anexo do "zZz"
 * na cabeca. Nada no mundo o tira.
 *
 * Aqui a `Entity` e o `EntityState` sao os DE VERDADE (o setter, o `set`, o `Player`); so o que arrasta GL, GRF e UI
 * e trocado, no molde de `vidaNosPacotes.test.js`, e os anexos sao OBSERVADOS. O primeiro caso e o controle: sem ele,
 * um zero no segundo nao provaria nada (a montagem poderia nem chegar ao setter).
 */
import { describe, expect, it, vi } from 'vitest';

vi.doMock('Renderer/Renderer.js', () => ({ default: { tick: 0 } }));
vi.doMock('Renderer/EntityManager.js', () => ({ default: { pendingTransformations: {} } }));
vi.doMock('Core/Client.js', () => ({ default: { loadFile() {} } }));
vi.doMock('Engine/SessionStorage.js', () => ({ default: { AdminList: [] } }));
vi.doMock('Audio/SoundManager.js', () => ({ default: { play() {}, playPosition() {} } }));
vi.doMock('DB/Emotions.js', () => ({ default: {} }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: { getCellHeight: () => 0 } }));
for (const nome of [
	'EntityAction', 'EntityCast', 'EntityDisplay', 'EntityDialog', 'EntitySound', 'EntityView', 'EntityWalk',
	'EntityRender', 'EntityRoom', 'EntityAttachments', 'EntityAnimations', 'EntityAura', 'EntityDropEffect', 'EntityEmblem'
]) vi.doMock(`Renderer/Entity/${nome}.js`, () => ({ default() {} }));
vi.doMock('Renderer/Entity/EntityLife.js', () => ({ default() {
	this.life = { hp: -1, hp_max: -1, clean() {}, update() {} };
} }));
vi.doMock('Controls/EntityControl.js', () => ({ default: function () {
	this.ACTION = { IDLE: 0, WALK: 1, SIT: 2, ATTACK: 3, HURT: 4, DIE: 5, READYFIGHT: 6, FREEZE: 7, FREEZE2: 8 };
	this.setAction = () => {};
	this.files = { shadow: {} };
	this.animation = { tick: 0 };
	this.display = { name: '', clean() {}, update() {}, STYLE: {}, TYPE: {} };
	this.aura = { free() {} };
	this.animations = { free() {} };
	this.dropEffect = { free() {} };
	for (const campo of ['emblem', 'dialog', 'cast', 'room']) {
		this[campo] = { clean() {} };
	}
	// Os anexos OBSERVADOS: o que o setter do corpo pendura na entidade.
	const pendurados = new Map();
	this.attachments = {
		pendurados,
		add: anexo => void pendurados.set(anexo.uid, anexo),
		remove: uid => void pendurados.delete(uid),
		clean: () => pendurados.clear()
	};
} }));

const { default: Player } = await import('Renderer/Entity/Player.js');
const { default: Entity } = await import('Renderer/Entity/Entity.js');
const { semOSonoDaLista, estaDormindoNaLista } = await import('UI/Components/CharSelect/sonoNaSelecao.js');

/** O personagem como `PacketVerManager.parseCharList` o entrega, com o sinal do sono. */
const daLista = () => ({ GID: 150001, CharNum: 0, name: 'Dorminhoco', bodyState: 4, healthState: 0 });
const anexos = entidade => [...entidade.attachments.pendurados.keys()];

describe('o `bodyState` da lista e sinal da selecao, nunca o corpo no mundo (B1, D-2478, R128)', () => {
	it('CONTROLE: o objeto CRU da lista poe o jogador dormindo, com o "zZz" na cabeca (o defeito que o critico mediu)', () => {
		const cru = new Player(daLista());
		expect(cru.bodyState).toBe(4);
		expect(anexos(cru)).toEqual(['status-sleep']);
	});

	it('o `Player` da entrada nasce do corpo zerado: acordado e sem anexo, e a lista continua dizendo que ele dorme', () => {
		const lista = daLista();
		const jogador = new Player(semOSonoDaLista(lista));
		expect(jogador.bodyState, 'o jogador entrou no mundo dormindo').toBe(0);
		expect(anexos(jogador), 'o "zZz" do status-sleep foi para o mundo').toEqual([]);
		expect(jogador.GID).toBe(150001);
		expect(estaDormindoNaLista(lista), 'a selecao perdeu o sinal (o icone e a pergunta)').toBe(true);
	});

	it('o boneco da vaga da grade (`new Entity()` + `set`) tambem nasce acordado', () => {
		const boneco = new Entity();
		boneco.set(semOSonoDaLista(daLista()));
		expect(boneco.bodyState).toBe(0);
		expect(anexos(boneco)).toEqual([]);
	});
});
