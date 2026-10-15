/**
 * A JANELA DE GRUPO E O LOCALIZADOR, 15/10/2026 (J11, J18/J9; R125, D-2463,
 * D-2464, D-2465): o botão "Chamar o grupo", o grupo FECHADO no Localizador e
 * o "Entrar rápido".
 *
 * As decisões moram em dois módulos sem DOM (`chamarOGrupo.js`,
 * `visibilidadeDoGrupo.js`) e são testadas rodando; a costura nas janelas é
 * conferida pelo fonte, como em `transferirLideranca.test.js` (levantar as
 * janelas em jsdom puxa GUIComponent, Renderer e o GRF).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chamarCabe } from '../../src/UI/Components/GrupoIdle/chamarOGrupo.js';
import {
	botaoDeVisibilidadeAceso,
	entrarRapidoAparece,
	grupoFechado,
	gruposAbertos,
	seloDoGrupo
} from '../../src/UI/Components/LFGIdle/visibilidadeDoGrupo.js';

const ler = (caminho) => readFileSync(join(process.cwd(), caminho), 'utf8');

describe('"Chamar o grupo" só para o líder, e só com mais alguém no grupo', () => {
	it('líder com dois ou mais membros: aparece', () => {
		expect(chamarCabe({ eu: { souLider: true }, grupo: { membros: [{}, {}] } })).toBe(true);
	});
	it('líder sozinho: não há quem chamar', () => {
		expect(chamarCabe({ eu: { souLider: true }, grupo: { membros: [{}] } })).toBe(false);
	});
	it('membro comum: nunca', () => {
		expect(chamarCabe({ eu: { souLider: false }, grupo: { membros: [{}, {}, {}] } })).toBe(false);
	});
	it('sem grupo, sem estado: nunca (e não quebra)', () => {
		expect(chamarCabe({ eu: { souLider: true }, grupo: null })).toBe(false);
		expect(chamarCabe(null)).toBe(false);
	});
});

describe('o grupo fechado no Localizador (D-2464)', () => {
	it('fechado só com `anunciado: false`; ausente (servidor antigo) é aberto', () => {
		expect(grupoFechado({ anunciado: false })).toBe(true);
		expect(grupoFechado({ anunciado: true })).toBe(false);
		expect(grupoFechado({})).toBe(false);
		expect(grupoFechado(null)).toBe(false);
	});

	it('o selo: Fechado vence o Privado', () => {
		expect(seloDoGrupo({ anunciado: false, privado: true })).toBe('Fechado');
		expect(seloDoGrupo({ anunciado: true, privado: true })).toBe('Privado');
		expect(seloDoGrupo({ anunciado: true, privado: false })).toBe('Público');
	});

	it('o seletor do líder acende exatamente um botão', () => {
		const acesos = (g) => ['0', '1', 'fechado'].filter((v) => botaoDeVisibilidadeAceso(v, g));
		expect(acesos({ anunciado: true, privado: false })).toEqual(['0']);
		expect(acesos({ anunciado: true, privado: true })).toEqual(['1']);
		expect(acesos({ anunciado: false, privado: false })).toEqual(['fechado']);
		expect(acesos({ anunciado: false, privado: true })).toEqual(['fechado']);
	});

	it('a contagem do topo não conta o meu grupo fechado', () => {
		expect(gruposAbertos([{ anunciado: true }, { anunciado: false }, {}])).toBe(2);
		expect(gruposAbertos([])).toBe(0);
		expect(gruposAbertos(undefined)).toBe(0);
	});
});

describe('"Entrar rápido" (D-2465)', () => {
	it('aparece para quem não tem grupo, some para quem tem', () => {
		expect(entrarRapidoAparece(null)).toBe(true);
		expect(entrarRapidoAparece({ grupoId: 1, souLider: false })).toBe(false);
	});
});

describe('a costura nas janelas', () => {
	const grupo = ler('src/UI/Components/GrupoIdle/GrupoIdle.js');
	const grupoHtml = ler('src/UI/Components/GrupoIdle/GrupoIdle.html');
	const lfg = ler('src/UI/Components/LFGIdle/LFGIdle.js');
	const lfgHtml = ler('src/UI/Components/LFGIdle/LFGIdle.html');

	it('o botão "Chamar o grupo" nasce escondido e manda o verbo `chamar` pela janela de Grupo', () => {
		expect(grupoHtml).toContain('<button type="button" class="ri-btn gi-chamar" hidden>Chamar o grupo</button>');
		expect(grupo).toContain('botao.hidden = !chamarCabe(e);');
		expect(grupo).toContain("mandar({ acao: 'chamar' });");
	});

	it('o seletor do líder tem o "Fechado", que manda `fechar-anuncio`', () => {
		expect(lfgHtml).toContain('data-privado="fechado"');
		expect(lfg).toContain("mandar({ acao: 'fechar-anuncio' });");
		expect(lfg).toContain('botaoDeVisibilidadeAceso(botao.dataset.privado, g)');
	});

	it('o "Entrar rápido" manda `entrar-rapido` e a recusa tem lugar próprio', () => {
		expect(lfgHtml).toContain('class="ri-btn lfg-entrar-rapido" hidden');
		expect(lfg).toContain("mandar({ acao: 'entrar-rapido' });");
		expect(lfg).toContain("} else if (acao === 'entrar-rapido') {");
	});
});
