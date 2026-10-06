/**
 * O DESEJO ARCANO NA CONFIG IDLE (06/10/2026, decisao do dono).
 *
 * O cartao so existe com o `contexto.desejoArcano` do servidor (quem aprendeu
 * o SA_AUTOSPELL), mostra a magia que sai, a chance e o nivel, o que
 * recomendamos e por que, e o seletor grava `magiaDoDesejoArcano` pelo
 * `data-set` generico. A costura no IdleConfig e lida no fonte, como os
 * vizinhos desta pasta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
	aoMudarStatusDoDesejo,
	chaveDoEstado,
	EFST_AUTOSPELL,
	escutarRelogioDoDesejo,
	esquecerRelogioDoDesejo,
	htmlDoDesejoArcano,
	htmlDoEstadoDoDesejo,
	magiaEscolhida,
	QUEM_CONJURA,
	restanteDoDesejoAgora,
	sincronizarRelogioDoDesejo,
	textoDoRestante,
	MOTIVO_DA_RECOMENDACAO,
	SEGUIR_A_RECOMENDACAO,
	temDesejoArcano
} from '../../src/UI/Components/IdleConfig/desejoArcano.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', '..', 'src', 'UI', 'Components', 'IdleConfig');
const JS = readFileSync(join(PASTA, 'IdleConfig.js'), 'utf8').replaceAll('\r\n', '\n');
const CSS = readFileSync(join(PASTA, 'IdleConfig.css'), 'utf8').replaceAll('\r\n', '\n');
const RENDER_ATAQUE = JS.slice(JS.indexOf('function renderAtaque()'), JS.indexOf('function bindNiveis('));
const ENTITY = readFileSync(join(AQUI, '..', '..', 'src', 'Engine', 'MapEngine', 'Entity.js'), 'utf8').replaceAll('\r\n', '\n');

const escapar = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const NOMES = {
	SA_AUTOSPELL: 'Desejo Arcano',
	MG_FIREBOLT: 'Lanças de Fogo',
	MG_LIGHTNINGBOLT: 'Relâmpago',
	MG_SOULSTRIKE: 'Espíritos Anciões'
};
const nomeDaSkill = id => NOMES[id] || id;

const DESEJO = {
	nivelDoDesejo: 10,
	chance: 25,
	duracaoSegundos: 390,
	magias: [
		{ magia: 'MG_FIREBOLT', nivelMaximo: 3, razaoEsperada: 165, spNoNivelMaximo: 10 },
		{ magia: 'MG_LIGHTNINGBOLT', nivelMaximo: 3, razaoEsperada: 165, spNoNivelMaximo: 10 },
		{ magia: 'MG_SOULSTRIKE', nivelMaximo: 3, razaoEsperada: 115, spNoNivelMaximo: 10 }
	],
	recomendada: { magia: 'MG_FIREBOLT', motivo: 'maior-dano-por-disparo', empatadas: ['MG_LIGHTNINGBOLT'] },
	escolhida: null,
	efetiva: { magia: 'MG_FIREBOLT', nivelMaximo: 3 },
	escolhidaIndisponivel: false,
	ativo: null,
	quemConjura: 'buffs'
};

function cartao(cfg, desejo) {
	return htmlDoDesejoArcano({ cfg, ctx: desejo === undefined ? {} : { desejoArcano: desejo }, escapar, nomeDaSkill });
}

describe('so quem aprendeu o Desejo ve o cartao', () => {
	it('sem contexto.desejoArcano (outra classe, ou servidor antigo) nao desenha nada', () => {
		expect(cartao({}, undefined)).toBe('');
		expect(htmlDoDesejoArcano({ cfg: {}, ctx: null, escapar, nomeDaSkill })).toBe('');
		expect(cartao({}, { magias: 'x' })).toBe('');
		expect(temDesejoArcano({ desejoArcano: DESEJO })).toBe(true);
	});

	it('menu vazio: o cartao diz o que aprender, sem seletor', () => {
		const html = cartao({}, { ...DESEJO, magias: [], recomendada: null, efetiva: null });
		expect(html).toContain('Nenhuma magia aprendida');
		expect(html).not.toContain('data-set="magiaDoDesejoArcano"');
		// O menu vazio manda, mesmo que um servidor torto mande uma efetiva.
		expect(cartao({}, { ...DESEJO, magias: [] })).toContain('Nenhuma magia aprendida');
	});
});

describe('o que sai, a chance e o seletor', () => {
	it('mostra a magia que sai, a chance, o nivel e a duracao', () => {
		const html = cartao({}, DESEJO);
		expect(html).toContain('data-magia-efetiva="MG_FIREBOLT"');
		expect(html).toContain('ri-badge--verde">Lanças de Fogo</span>');
		expect(html).toContain('Chance de 25% a cada golpe básico, com o Desejo no nível 10, por 390 segundos.');
		expect(html).toContain(MOTIVO_DA_RECOMENDACAO['maior-dano-por-disparo']);
	});

	it('uma opcao por magia do menu, mais "seguir a recomendacao", com o detalhe de cada uma', () => {
		const html = cartao({}, DESEJO);
		const opcoes = html.match(/data-set="magiaDoDesejoArcano"/g) || [];
		expect(opcoes).toHaveLength(4);
		expect(html).toContain(`data-valor="${SEGUIR_A_RECOMENDACAO}" aria-pressed="true"`);
		expect(html).toContain('Até o nível 3 · 165% do ataque mágico por disparo · 10 de SP');
		// So a recomendada leva o selo.
		expect(html.match(/>Recomendada</g) || []).toHaveLength(1);
	});

	it('a escolhida fica marcada; a que saiu do menu volta a "seguir a recomendacao" e o aviso aparece', () => {
		const html = cartao({ magiaDoDesejoArcano: 'MG_SOULSTRIKE' }, { ...DESEJO, efetiva: { magia: 'MG_SOULSTRIKE', nivelMaximo: 3 } });
		expect(html).toContain('data-valor="MG_SOULSTRIKE" aria-pressed="true"');
		// O selo de "sai agora" e o da EFETIVA, e nao o da recomendada.
		expect(html).toContain('ri-badge--verde">Espíritos Anciões</span>');
		expect(magiaEscolhida({ magiaDoDesejoArcano: 'MG_FROSTDIVER' }, { desejoArcano: DESEJO })).toBe(SEGUIR_A_RECOMENDACAO);
		const fora = cartao({ magiaDoDesejoArcano: 'MG_FROSTDIVER' }, { ...DESEJO, escolhida: 'MG_FROSTDIVER', escolhidaIndisponivel: true });
		expect(fora).toContain('ic-desejo-aviso');
		expect(cartao({}, DESEJO)).not.toContain('ic-desejo-aviso');
	});

	it('os dois motivos do servidor tem texto', () => {
		for (const m of ['maior-dano-por-disparo', 'unica-disponivel']) {
			expect(MOTIVO_DA_RECOMENDACAO[m]).toBeTruthy();
		}
	});
});

describe('a costura e o celular', () => {
	it('a aba Ataque desenha o cartao com o nome da habilidade no idioma', () => {
		expect(RENDER_ATAQUE).toContain(
			'htmlDoDesejoArcano({ cfg, ctx, escapar: escapeHtml, nomeDaSkill, restanteMs: restanteDoDesejoAgora(Date.now()) })'
		);
	});

	it('no celular cada opcao tem 44px, e o seletor e em coluna', () => {
		const bloco = CSS.slice(CSS.indexOf('#IdleConfig .ic-seg--desejo {'));
		expect(bloco).toMatch(/flex-direction: column/);
		expect(CSS).toMatch(/@media \(pointer: coarse\) \{\n\t#IdleConfig \.ic-seg--desejo \.ic-seg-btn \{\n\t\tmin-height: var\(--hit-touch, 44px\);/);
	});
});


/*
 * O DESEJO ATIVO NO CARTAO (D-2046, pedido do dono: "precisa mostrar que esta
 * ativo: X minutos restantes").
 */
describe('o relogio do Desejo', () => {
	afterEach(() => esquecerRelogioDoDesejo());

	it('o texto: os minutos inteiros que faltam (nunca promete a mais), depois os segundos', () => {
		expect(textoDoRestante(390000)).toBe('Ativo: 6 minutos restantes');
		expect(textoDoRestante(359999)).toBe('Ativo: 5 minutos restantes');
		expect(textoDoRestante(360000)).toBe('Ativo: 6 minutos restantes');
		expect(textoDoRestante(120000)).toBe('Ativo: 2 minutos restantes');
		expect(textoDoRestante(119999)).toBe('Ativo: 1 minuto restante');
		expect(textoDoRestante(60001)).toBe('Ativo: 1 minuto restante');
		expect(textoDoRestante(60000)).toBe('Ativo: 1 minuto restante');
		expect(textoDoRestante(59999)).toBe('Ativo: 60 segundos restantes');
		expect(textoDoRestante(45000)).toBe('Ativo: 45 segundos restantes');
		expect(textoDoRestante(1000)).toBe('Ativo: 1 segundo restante');
		expect(textoDoRestante(1)).toBe('Ativo: 1 segundo restante');
	});

	it('a resposta da config acerta o relogio, e ele desce sozinho ate vencer', () => {
		sincronizarRelogioDoDesejo({ desejoArcano: { ...DESEJO, ativo: { restanteMs: 390000 } } }, 1000);
		expect(restanteDoDesejoAgora(1000)).toBe(390000);
		expect(restanteDoDesejoAgora(61000)).toBe(330000);
		expect(restanteDoDesejoAgora(391000)).toBeNull();
		// Inativo na resposta seguinte: o relogio some.
		sincronizarRelogioDoDesejo({ desejoArcano: DESEJO }, 2000);
		expect(restanteDoDesejoAgora(2000)).toBeNull();
		// Sem o cartao (outra classe), a resposta nao mexe no relogio.
		sincronizarRelogioDoDesejo({ desejoArcano: { ...DESEJO, ativo: { restanteMs: 5000 } } }, 0);
		sincronizarRelogioDoDesejo({}, 0);
		expect(restanteDoDesejoAgora(0)).toBe(5000);
		// Restante zero nao e ativo.
		sincronizarRelogioDoDesejo({ desejoArcano: { ...DESEJO, ativo: { restanteMs: 0 } } }, 0);
		expect(restanteDoDesejoAgora(0)).toBeNull();
	});

	it('o icone EFST_AUTOSPELL acerta o relogio com a janela aberta: entra, reconjura, vence', () => {
		let avisos = 0;
		const desligar = escutarRelogioDoDesejo(() => {
			avisos += 1;
		});
		try {
			expect(EFST_AUTOSPELL).toBe(65);
			// Outro icone: nada muda, ninguem e avisado.
			expect(aoMudarStatusDoDesejo(12, 1, 240000, 0)).toBe(false);
			expect(restanteDoDesejoAgora(0)).toBeNull();
			// Entrou (0983 com o restante).
			expect(aoMudarStatusDoDesejo(65, 1, 390000, 0)).toBe(true);
			expect(restanteDoDesejoAgora(10000)).toBe(380000);
			// Reconjurado: o relogio volta ao cheio.
			expect(aoMudarStatusDoDesejo(65, 1, 390000, 200000)).toBe(true);
			expect(restanteDoDesejoAgora(200000)).toBe(390000);
			// O pacote sem `state` (o ENTER) vale como ativo.
			expect(aoMudarStatusDoDesejo(65, undefined, 100000, 300000)).toBe(true);
			expect(restanteDoDesejoAgora(300000)).toBe(100000);
			// "Sem fim" (0 ou 9999) nao e do Desejo: nao mexe no relogio.
			expect(aoMudarStatusDoDesejo(65, 1, 9999, 300000)).toBe(false);
			expect(aoMudarStatusDoDesejo(65, 1, 0, 300000)).toBe(false);
			expect(restanteDoDesejoAgora(300000)).toBe(100000);
			// Venceu (0196, estado 0): inativo.
			expect(aoMudarStatusDoDesejo(65, 0, undefined, 310000)).toBe(true);
			expect(restanteDoDesejoAgora(310000)).toBeNull();
			expect(avisos).toBe(4);
		} finally {
			desligar();
		}
	});

	it('um ouvinte quebrado nao impede o relogio nem os outros', () => {
		let viu = 0;
		const a = escutarRelogioDoDesejo(() => {
			throw new Error('quebrado');
		});
		const b = escutarRelogioDoDesejo(() => {
			viu += 1;
		});
		const erro = console.error;
		console.error = () => {};
		try {
			expect(aoMudarStatusDoDesejo(65, 1, 1000, 0)).toBe(true);
		} finally {
			console.error = erro;
			a();
			b();
		}
		expect(viu).toBe(1);
		expect(restanteDoDesejoAgora(0)).toBe(1000);
	});
});

describe('a linha de estado do cartao', () => {
	it('ativo: o selo verde com o relogio, logo abaixo do titulo', () => {
		const html = htmlDoDesejoArcano({
			cfg: {},
			ctx: { desejoArcano: DESEJO },
			escapar,
			nomeDaSkill,
			restanteMs: 185000
		});
		expect(html).toContain('<span class="ri-badge ri-badge--verde ic-desejo-relogio">Ativo: 3 minutos restantes</span>');
		expect(html).toContain('data-desejo-estado="Ativo: 3 minutos restantes"');
		expect(html.indexOf('ic-desejo-estado')).toBeLessThan(html.indexOf('ic-perfil-agora'));
		expect(html).not.toContain('Inativo');
	});

	it('inativo: o selo cinza e quem o conjura de novo, pela config do servidor', () => {
		for (const [quem, frase] of Object.entries(QUEM_CONJURA)) {
			const html = cartao({}, { ...DESEJO, quemConjura: quem });
			expect(html).toContain('<span class="ri-badge ri-badge--cinza">Inativo</span>');
			expect(html).toContain(`<span class="ic-desejo-porque">${escapar(frase)}</span>`);
			expect(html).toContain(`data-desejo-estado="inativo:${quem}"`);
		}
		expect(Object.keys(QUEM_CONJURA).sort()).toEqual(['buffs', 'caca-desligada', 'clique', 'rotacao']);
		// Servidor antigo (sem `quemConjura`): so o selo.
		expect(htmlDoEstadoDoDesejo({}, null, escapar)).toBe('<span class="ri-badge ri-badge--cinza">Inativo</span>');
	});

	it('a chave so muda quando o texto muda (o tique nao reescreve a linha a cada segundo)', () => {
		expect(chaveDoEstado(DESEJO, 300000)).toBe(chaveDoEstado(DESEJO, 359999));
		expect(chaveDoEstado(DESEJO, 300000)).not.toBe(chaveDoEstado(DESEJO, 299999));
		expect(chaveDoEstado(DESEJO, null)).toBe('inativo:buffs');
		expect(chaveDoEstado({ ...DESEJO, quemConjura: 'clique' }, null)).toBe('inativo:clique');
	});
});

describe('a costura do relogio', () => {
	it('a resposta da config acerta o relogio; o tique so reescreve a linha quando a chave muda', () => {
		expect(JS).toContain('sincronizarRelogioDoDesejo(data.contexto, Date.now());');
		expect(JS).toContain("if (linha.getAttribute('data-desejo-estado') !== chave) {");
		expect(JS).toContain('_tiqueDoDesejo = setInterval(atualizarEstadoDoDesejo, 1000);');
		// Janela fechada ou cartao fora da tela: o tique para sozinho.
		expect(JS).toMatch(/if \(!win \|\| !win\.classList\.contains\('is-open'\) \|\| !linha \|\| !d\) \{\n\t\tpararTiqueDoDesejo\(\);/);
		// A troca de personagem esquece o relogio.
		const limpar = JS.slice(JS.indexOf('IdleConfig.limparEstadoDoPersonagem = function'));
		expect(limpar.slice(0, 900)).toContain('esquecerRelogioDoDesejo();');
	});

	it('o pacote de status do proprio jogador chega ao relogio (o mesmo handler dos icones)', () => {
		const handler = ENTITY.slice(ENTITY.indexOf('StatusIcons.update(pkt.index, pkt.state, pkt.RemainMS);'));
		expect(handler.slice(0, 2200)).toContain('aoMudarStatusDoDesejo(pkt.index, pkt.state, pkt.RemainMS, Date.now());');
	});

	it('no celular o porque quebra na largura do cartao, e o selo nao quebra', () => {
		expect(CSS).toMatch(/#IdleConfig \.ic-desejo-estado \{\n\tdisplay: flex;\n\tflex-wrap: wrap;/);
		expect(CSS).toMatch(/#IdleConfig \.ic-desejo-estado \.ri-badge \{\n\twhite-space: nowrap;/);
		expect(CSS).toMatch(/#IdleConfig \.ic-desejo-porque \{\n\tflex: 1 1 12em;\n\tmin-width: 0;/);
	});
});
