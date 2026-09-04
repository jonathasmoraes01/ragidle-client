import { beforeEach, describe, expect, it } from 'vitest';
import Events from 'Core/Events.js';
import VidaNoImpacto from 'Renderer/Entity/VidaNoImpacto.js';

let agora;
let vida;
let hp;
let exibido;
function receber(valor) {
	hp = valor;
	exibido = vida.receber(hp, 1000);
}
function avancar(t) {
	agora = t;
	Events.process(t);
}
beforeEach(() => {
	Events.free();
	agora = 1000;
	Events.process(agora);
	vida = new VidaNoImpacto(() => agora, Events.setTimeout, Events.clearTimeout, () => receber(hp));
	receber(1000);
});

describe('a barra do mob acompanha o impacto, nao a chegada do pacote', () => {
	it('preserva a vida cheia ate o primeiro impacto sem mudar o HP real', () => {
		vida.registrar([1400]);
		receber(700);
		expect(hp).toBe(700);
		expect(exibido).toBe(1000);
		avancar(1399);
		expect(exibido).toBe(1000);
		avancar(1400);
		expect(exibido).toBe(700);
	});
	it('MOVEENTRY e HP repetidos nao antecipam nem repetem o dano', () => {
		vida.registrar([1400]);
		receber(700);
		receber(700);
		receber(700);
		expect(exibido).toBe(1000);
		avancar(1400);
		expect(exibido).toBe(700);
	});
	it('golpes multiplos baixam a barra nos respectivos impactos', () => {
		vida.registrar([1400, 1600, 1800]);
		receber(700);
		avancar(1400);
		expect(exibido).toBe(900);
		avancar(1600);
		expect(exibido).toBe(800);
		avancar(1800);
		expect(exibido).toBe(700);
	});
	it('dois atacantes com impactos fora de ordem nao fazem a barra subir', () => {
		vida.registrar([1800]);
		receber(800);
		vida.registrar([1400]);
		receber(500);
		avancar(1400);
		expect(exibido).toBe(700);
		avancar(1800);
		expect(exibido).toBe(500);
	});
	it('cura durante o golpe preserva a soma final, mesmo acima da barra cheia', () => {
		vida.registrar([1400]);
		receber(700);
		receber(1000);
		expect(exibido).toBe(1000);
		avancar(1400);
		expect(exibido).toBe(1000);
	});
	it('nao inventa vida cheia para um monstro ja ferido por outra luta', () => {
		vida.limpar();
		receber(300);
		expect(exibido).toBe(300);
		vida.registrar([1400]);
		receber(0);
		expect(exibido).toBe(300);
		avancar(1400);
		expect(exibido).toBe(0);
	});
	it('a morte espera o ultimo impacto, depois da barra chegar a zero', () => {
		vida.registrar([1400, 1600]);
		receber(0);
		let hpNaMorte;
		expect(vida.adiarMorte(() => { hpNaMorte = exibido; })).toBe(true);
		avancar(1599);
		expect(hpNaMorte).toBeUndefined();
		avancar(1600);
		expect(hpNaMorte).toBe(0);
	});
	it('trocar de mapa ou reutilizar o mob cancela as atualizacoes antigas', () => {
		vida.registrar([1400]);
		receber(0);
		let mortes = 0;
		vida.adiarMorte(() => mortes++);
		vida.limpar();
		receber(1000);
		avancar(2000);
		expect(exibido).toBe(1000);
		expect(mortes).toBe(0);
	});
	it('dano sem animacao e notificacao atrasada nao ficam pendurados', () => {
		receber(900);
		expect(exibido).toBe(900);
		vida.registrar([1400]);
		avancar(1500);
		receber(700);
		expect(exibido).toBe(700);
	});
});
