/**
 * O FLUSH DO CHAT EM FASES (auditoria de desempenho de 15/10/2026).
 *
 * O `flushMessageBuffer` lia a geometria de cada canal depois da escrita do
 * canal anterior (um layout forcado por canal), a poda serializava o innerHTML
 * de toda linha que saia procurando `blob:`, os badges eram refeitos (e o texto
 * reescrito igual) uma vez por canal, e todo acordar do repouso recriava o
 * `setTimeout`. As decisoes moram em `chatEmLote.js` e sao exercitadas de
 * verdade; a costura no `ChatBox` (que so carrega com meio cliente) e lida do
 * fonte.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	criarRelogioDoRepouso,
	drenarCanaisEmFases,
	escreverTextoSeMudou,
	linhaTemBlob,
	revogarBlobsDaLinha
} from '../../src/UI/Components/ChatBox/chatEmLote.js';

/**
 * Um navegador de mentira que conta LAYOUTS FORCADOS: ler a geometria depois
 * de uma escrita no DOM obriga o layout a ser refeito.
 */
function navegador() {
	const estado = { sujo: true, layouts: 0 };
	const lerGeometria = () => {
		if (estado.sujo) {
			estado.layouts++;
			estado.sujo = false;
		}
	};
	const canal = (nome, { altura, rolagem, conteudo }) => {
		const c = {
			nome,
			linhas: conteudo,
			_scrollTop: rolagem,
			get offsetHeight() {
				lerGeometria();
				return altura;
			},
			get scrollHeight() {
				lerGeometria();
				return c.linhas * 10;
			},
			get scrollTop() {
				lerGeometria();
				return c._scrollTop;
			},
			set scrollTop(v) {
				c._scrollTop = Math.min(v, Math.max(0, c.linhas * 10 - altura));
			},
			anexar(n) {
				c.linhas += n;
				estado.sujo = true;
			}
		};
		return { canal: nome, content: c };
	};
	return { estado, canal };
}

const noFim = ({ content }) => content.scrollTop + content.offsetHeight >= content.scrollHeight - 5;

/** O algoritmo de ANTES, canal a canal (le, escreve, le, escreve). */
function comoAntes(entradas, novas) {
	const avisos = [];
	for (const e of entradas) {
		const estava = noFim(e);
		e.content.anexar(novas);
		if (estava) e.content.scrollTop = e.content.scrollHeight;
		else avisos.push(e.canal);
	}
	return avisos;
}

function cenario() {
	const n = navegador();
	return {
		n,
		entradas: [
			n.canal('global', { altura: 100, rolagem: 0, conteudo: 10 }), // no fim
			n.canal('farm', { altura: 100, rolagem: 400, conteudo: 50 }), // no fim
			n.canal('logs', { altura: 100, rolagem: 0, conteudo: 50 }), // subiu no historico
			n.canal('party', { altura: 100, rolagem: 900, conteudo: 100 }) // no fim
		]
	};
}

describe('o flush em fases', () => {
	it('quatro canais: no maximo DOIS layouts, contra cinco antes; mesma rolagem e mesmos avisos', () => {
		const antes = cenario();
		const avisosAntes = comoAntes(antes.entradas, 3);

		const depois = cenario();
		const avisosDepois = [];
		const contados = [];
		const contou = drenarCanaisEmFases(depois.entradas, {
			estavaNoFim: noFim,
			anexar: e => e.content.anexar(3),
			avisarNovas: e => avisosDepois.push(e.canal),
			contarNaoLido: e => {
				contados.push(e.canal);
				return e.canal !== 'global';
			}
		});

		expect(antes.n.estado.layouts).toBe(5); // quatro canais, um ou dois layouts por canal
		expect(depois.n.estado.layouts).toBeLessThanOrEqual(2);
		expect(avisosDepois).toEqual(avisosAntes);
		expect(depois.entradas.map(e => e.content._scrollTop)).toEqual(antes.entradas.map(e => e.content._scrollTop));
		expect(contados).toEqual(['global', 'farm', 'logs', 'party']);
		expect(contou).toBe(true);
	});

	it('sem canal contando nao-lido, os badges nao sao refeitos', () => {
		const { entradas } = cenario();
		const contou = drenarCanaisEmFases(entradas, {
			estavaNoFim: noFim,
			anexar: e => e.content.anexar(1),
			avisarNovas: () => {},
			contarNaoLido: () => false
		});
		expect(contou).toBe(false);
	});
});

describe('a poda so revoga a linha marcada', () => {
	it('so a linha override com blob: e marcada', () => {
		expect(linhaTemBlob(true, '<a href="blob:http://x/1">x</a>')).toBe(true);
		expect(linhaTemBlob(true, 'sussurro sem link')).toBe(false);
		// o texto de jogador e escapado: um "blob:" digitado nao e URL nossa
		expect(linhaTemBlob(false, 'olha blob:http://x/1')).toBe(false);
		expect(linhaTemBlob(undefined, 'blob:')).toBe(false);
	});

	it('a linha marcada revoga as URLs; a nao marcada nem e serializada', () => {
		const revogadas = [];
		const marcada = document.createElement('div');
		marcada.innerHTML = '<a href="blob:http://x/1">a</a><a href="blob:http://x/2">b</a>';
		marcada.dataset.blob = '1';
		revogarBlobsDaLinha(marcada, url => revogadas.push(url));
		expect(revogadas).toEqual(['blob:http://x/1', 'blob:http://x/2']);

		const comum = document.createElement('div');
		let leituras = 0;
		Object.defineProperty(comum, 'innerHTML', {
			get() {
				leituras++;
				return '';
			}
		});
		revogarBlobsDaLinha(comum, url => revogadas.push(url));
		expect(leituras).toBe(0);
		expect(revogadas).toHaveLength(2);
	});
});

describe('o badge so reescreve o que mudou', () => {
	it('o mesmo texto nao e escrito de novo', () => {
		const el = document.createElement('span');
		el.textContent = '3';
		let escritas = 0;
		const proto = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
		Object.defineProperty(el, 'textContent', {
			get() {
				return proto.get.call(this);
			},
			set(v) {
				escritas++;
				proto.set.call(this, v);
			}
		});
		escreverTextoSeMudou(el, '3');
		expect(escritas).toBe(0);
		escreverTextoSeMudou(el, '4');
		expect(escritas).toBe(1);
		expect(el.textContent).toBe('4');
	});
});

describe('o relogio do repouso por prazo', () => {
	function montar() {
		const r = { agora: 0, timers: [], armados: 0, desarmados: 0, dormiu: [] };
		const relogio = criarRelogioDoRepouso({
			ms: 8000,
			agora: () => r.agora,
			armar: (fn, ms) => {
				r.armados++;
				const t = { fn, em: r.agora + ms, vivo: true };
				r.timers.push(t);
				return t;
			},
			desarmar: t => {
				r.desarmados++;
				t.vivo = false;
			},
			dormir: () => r.dormiu.push(r.agora)
		});
		const andar = ate => {
			for (;;) {
				const proximo = r.timers.filter(t => t.vivo && t.em <= ate).sort((a, b) => a.em - b.em)[0];
				if (!proximo) break;
				proximo.vivo = false;
				r.agora = proximo.em;
				proximo.fn();
			}
			r.agora = ate;
		};
		return { r, relogio, andar };
	}

	it('cem acordares num segundo: UM relogio armado, e o painel dorme 8 s depois do ULTIMO', () => {
		const { r, relogio, andar } = montar();
		for (let i = 0; i < 100; i++) {
			r.agora = i * 10;
			relogio.agendar();
		}
		expect(r.armados).toBe(1);
		expect(r.desarmados).toBe(0);
		andar(8989);
		expect(r.dormiu).toEqual([]);
		andar(9000);
		expect(r.dormiu).toEqual([990 + 8000]);
		expect(r.armados).toBe(2); // o primeiro venceu cedo e se rearmou pelo que faltava
	});

	it('sem novo acordar, dorme em 8 s, uma vez', () => {
		const { r, relogio, andar } = montar();
		relogio.agendar();
		andar(20000);
		expect(r.dormiu).toEqual([8000]);
	});

	it('cancelar (o repouso desligado) nao deixa dormir', () => {
		const { r, relogio, andar } = montar();
		relogio.agendar();
		relogio.cancelar();
		andar(20000);
		expect(r.dormiu).toEqual([]);
		relogio.agendar();
		andar(40000);
		expect(r.dormiu).toEqual([28000]);
	});
});

describe('a costura no ChatBox', () => {
	const fonte = readFileSync('src/UI/Components/ChatBox/ChatBox.js', 'utf8').replace(/\r\n/g, '\n');
	const corpo = inicio => {
		const i = fonte.indexOf(inicio);
		expect(i, inicio).toBeGreaterThan(-1);
		return fonte.slice(i, fonte.indexOf('\n}\n', i));
	};

	it('o flush passa pelas fases e refaz os badges uma vez', () => {
		const f = corpo('function flushMessageBuffer()');
		expect(f).toContain('drenarCanaisEmFases(entradas, {');
		expect(f).toContain('if (algumNaoLido) atualizarBadges(root);');
		expect(f).not.toMatch(/\.scrollTop = /);
	});

	it('o nao-lido de um canal nao refaz os badges sozinho', () => {
		expect(corpo('function contarNaoLido(canal)')).not.toContain('atualizarBadges');
	});

	it('a poda revoga pela marca, e a linha override com blob e marcada', () => {
		const a = corpo('function anexarAoCanal(canal, content, mensagens)');
		expect(a).toContain("if (linhaTemBlob(msg.override, msg.text)) div.dataset.blob = '1';");
		expect(a).toContain('revogarBlobsDaLinha(element,');
		expect(a).not.toContain('element.innerHTML.match');
	});

	it('os badges escrevem so o que mudou, e o repouso empurra o prazo', () => {
		const b = corpo('function atualizarBadges(root)');
		expect(b).not.toMatch(/badge\.textContent = /);
		expect(corpo('function agendarRepouso(root)')).toContain('_relogioDoRepouso.agendar();');
		expect(corpo('function agendarRepouso(root)')).not.toContain('setTimeout');
	});
});
