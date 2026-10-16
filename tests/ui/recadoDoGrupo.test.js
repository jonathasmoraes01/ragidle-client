/**
 * O RECADO DO RODAPE DA JANELA DE GRUPO (ML14, achado do critico do grupo): "Abra o Localizador de Grupos para entrar
 * num grupo." e o texto de quem NAO tem grupo e aparecia embaixo para quem JA estava em um. A regra e a funcao pura
 * `recadoDoEstado` (comportamento) e a costura em `GrupoIdle.js` (fonte: a janela nao monta em jsdom).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RECADO_SEM_GRUPO, recadoDoEstado } from '../../src/UI/Components/GrupoIdle/recadoDoGrupo.js';

const pasta = join(process.cwd(), 'src/UI/Components/GrupoIdle');
const fonte = readFileSync(join(pasta, 'GrupoIdle.js'), 'utf8');
const html = readFileSync(join(pasta, 'GrupoIdle.html'), 'utf8');

const EM_GRUPO = { grupo: { id: 1 } };

describe('recadoDoEstado: o que a linha do rodape mostra', () => {
	it('sem grupo, a linha convida a abrir o Localizador', () => {
		expect(recadoDoEstado({ grupo: null }, '')).toEqual({ texto: RECADO_SEM_GRUPO, ehProblema: false });
	});

	it('EM GRUPO, o texto de "sem grupo" que ficou na linha (de fabrica) sai', () => {
		expect(recadoDoEstado(EM_GRUPO, RECADO_SEM_GRUPO)).toEqual({ texto: '', ehProblema: false });
	});

	it('em grupo, um aviso de verdade que ja esta na linha NAO e apagado', () => {
		expect(recadoDoEstado(EM_GRUPO, 'Fulano entrou no grupo.')).toBeNull();
		expect(recadoDoEstado(EM_GRUPO, '')).toBeNull();
	});

	it('o recado do servidor vale, com ou sem grupo', () => {
		expect(recadoDoEstado({ ...EM_GRUPO, recado: 'Fulano entrou no grupo.' }, RECADO_SEM_GRUPO)).toEqual({
			texto: 'Fulano entrou no grupo.',
			ehProblema: false,
		});
		expect(recadoDoEstado({ grupo: null, recado: 'Voce saiu do grupo.' }, '')).toEqual({ texto: 'Voce saiu do grupo.', ehProblema: false });
	});

	it('a recusa do servidor sai como veio, em tom de problema, e vence o recado', () => {
		const r = recadoDoEstado({ ...EM_GRUPO, problemas: ['Sem vaga.', 'Nivel fora da faixa.'], recado: 'x' }, '');
		expect(r).toEqual({ texto: 'Sem vaga. · Nivel fora da faixa.', ehProblema: true });
	});

	it('problemas vazio nao conta como recusa', () => {
		expect(recadoDoEstado({ ...EM_GRUPO, problemas: [] }, RECADO_SEM_GRUPO)).toEqual({ texto: '', ehProblema: false });
	});
});

describe('a costura em GrupoIdle.js', () => {
	it('o texto de fabrica do HTML e o mesmo da constante (a regra so apaga o que reconhece)', () => {
		expect(html).toContain('<span class="gi-recado">' + RECADO_SEM_GRUPO + '</span>');
	});

	it('o empurrao do servidor passa pela funcao, lendo o que a linha mostra agora', () => {
		const i = fonte.indexOf('Network.hookPacket(PACKET.ZC.RAGIDLE_GRUPO,');
		expect(i, 'o gancho do grupo sumiu de GrupoIdle.js').toBeGreaterThan(-1);
		const corpo = fonte.slice(i, fonte.indexOf('});', i)); // o fim do gancho (o desenho mudou de nome na master: agendador `_desenho`)
		expect(corpo).toContain("recadoDoEstado(dados, raiz().querySelector('.gi-recado').textContent)");
		expect(corpo).toContain('mostrarRecado(recado.texto, recado.ehProblema)');
	});

	it('a troca de personagem volta ao texto de "sem grupo" pela constante', () => {
		const i = fonte.indexOf('GrupoIdle.limparEstadoDoPersonagem = function');
		expect(i).toBeGreaterThan(-1);
		expect(fonte.slice(i, i + 900)).toContain('mostrarRecado(RECADO_SEM_GRUPO, false);');
	});

	it('GrupoIdle.js nao carrega mais o texto solto', () => {
		expect(fonte).not.toContain("'Abra o Localizador de Grupos");
	});
});
