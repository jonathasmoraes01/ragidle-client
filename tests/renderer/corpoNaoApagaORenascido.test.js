/**
 * O CORPO QUE SAI NAO APAGA O GID DE QUEM RENASCEU (04/10/2026, relato de
 * 03/10: "quando muda pra uma aba que esta sem ver muito tempo, os bichos que
 * morreu fica tipo como se tivesse vivo").
 *
 * O `VANISH` libera o GID na hora (`removeGID`) e deixa o corpo na lista ate a
 * animacao de saida acabar, quem tira e o `render`. Se o mob renasce com o
 * MESMO GID antes disso, o GID passa a apontar para a entidade NOVA. A faxina do
 * corpo apagava o GID sem perguntar de quem ele era, e o vivo ficava na tela
 * sem ninguem conseguir acha-lo: nao andava, nao apanhava, nao sumia.
 *
 * Com a aba escondida o render para e todo renascimento cai nessa janela; por
 * isso a volta da aba enchia a tela de fantasmas que so o teleporte limpava.
 */
import { describe, expect, it, vi } from 'vitest';

vi.doMock('Renderer/Entity/Entity.js', () => ({ default: { TYPE_PC: 0, TYPE_MOB: 5, TYPE_EFFECT: 7 } }));
vi.doMock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.doMock('Renderer/SpriteRenderer.js', () => ({ default: { bind3DContext() {}, unbind() {} } }));
vi.doMock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.doMock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.doMock('Utils/PathFinding.js', () => ({ default: {} }));
vi.doMock('Preferences/Graphics.js', () => ({ default: {} }));
vi.doMock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.doMock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: { release() {}, remove() {} } }));

const { default: EntityManager } = await import('Renderer/EntityManager.js');

class Falsa {
	static TYPE_EFFECT = 7;
	constructor(GID, nome) {
		this.GID = GID;
		this.nome = nome;
		this.objecttype = 5;
		this.remove_tick = 0;
		this.remove_delay = 0;
		this.limpa = false;
		this.desenhos = 0;
	}
	set() {}
	clean() {
		this.limpa = true;
	}
	render() {
		this.desenhos++;
	}
}

const quadro = () => EntityManager.render({}, new Float32Array(16), new Float32Array(16), {}, false);

describe('o corpo que sai nao apaga o GID de quem renasceu', () => {
	it('morre, renasce com o mesmo GID, e a faxina do corpo deixa o vivo achavel', () => {
		EntityManager.free();
		const morto = EntityManager.add(new Falsa(7, 'corpo'));
		// VANISH (morte): o GID e liberado, o corpo segue na lista ate a animacao acabar.
		EntityManager.removeGID(7);
		morto.remove_tick = 1;
		// O renascimento chega ANTES do primeiro quadro (aba escondida).
		const vivo = EntityManager.add(new Falsa(7, 'renascido'));
		expect(vivo).not.toBe(morto);

		quadro();

		expect(morto.limpa).toBe(true);
		expect(EntityManager.get(7)).toBe(vivo);
		expect(vivo.limpa).toBe(false);
	});

	it('CONTROLE: sem renascimento, a faxina do corpo continua tirando o GID', () => {
		EntityManager.free();
		const morto = EntityManager.add(new Falsa(9, 'corpo'));
		morto.remove_tick = 1;
		quadro();
		expect(morto.limpa).toBe(true);
		expect(EntityManager.get(9)).toBeFalsy();
	});

	it('o foco do jogador no renascido sobrevive a faxina do corpo de mesmo GID', () => {
		EntityManager.free();
		const morto = EntityManager.add(new Falsa(11, 'corpo'));
		EntityManager.removeGID(11);
		morto.remove_tick = 1;
		const vivo = EntityManager.add(new Falsa(11, 'renascido'));
		let fimDoFoco = 0;
		vivo.onFocusEnd = () => fimDoFoco++;
		EntityManager.setFocusEntity(vivo);

		quadro();

		expect(EntityManager.getFocusEntity()).toBe(vivo);
		expect(fimDoFoco).toBe(0);
	});
});
