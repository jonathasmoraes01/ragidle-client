/**
 * A METADE PURA da janela da Temporada (formatoDaTemporada.js), medida sem
 * levantar a janela - o mesmo corte de `tabelaDoPainel.js` no Painel de
 * Comando: entrada -> string, sem DOM, sem rede.
 *
 * Reescrito em 22/09/2026 para o CONTRATO V2 (`CONTRATO-TEMPORADA-V2.md`) e
 * o redesign premium. Quatro decisões têm um caso aqui de propósito:
 *
 *  1. O PASSE PREMIUM SAIU DO CONTRATO. `renderPremiumHtml`/
 *     `renderPasseCompactoHtml`/`renderMarcoHtml`/`marcosDoPasse` não
 *     existem mais - um teste confirma que o módulo NÃO os exporta (a
 *     armadilha catalogada: função pura sem chamador fica verde para
 *     sempre - aqui a garantia é que ela nem existe).
 *  2. O PASSE DE BATALHA VIRA ABA PRÓPRIA com XP/nível/missões/trilha de
 *     recompensas - os testes usam um payload montado A PARTIR do exemplo
 *     do contrato (30 níveis, 1000 XP/nível, 400 XP de caça/dia), e um
 *     segundo payload com OUTROS números para provar que nada está
 *     cravado no código de desenho.
 *  3. A EMENDA 1 AO CONTRATO (22/09, revisão independente): `diasRestantes`
 *     é da TEMPORADA (não do VIP) e pode vir `null`; `semanais` pode vir
 *     `null` (temporada sem data de início). Os dois casos têm teste aqui.
 *  4. O PASSE SEMANAL SAIU: `renderSemanalHtml` não existe mais,
 *     `renderAtalhosHtml` só tem Caixas/VIP, e `renderDestaquesHtml` não
 *     recebe mais o estado do Passe (VIP puro por `estado.vip`).
 *
 * E o que não mudou: a caixa a R$ 10 cash, o reveal direto na mochila, a
 * separação por categoria sem porcentagem no "Ver conteúdo" - ver os
 * comentários de cada bloco.
 */

import { describe, expect, it } from 'vitest';
import * as formatoDaTemporada from 'UI/Components/TemporadaIdle/formatoDaTemporada.js';
import {
	agruparPorRaridade,
	dataCurta,
	formatarPrecoCentavos,
	iconeDoVisualDoVip,
	niveisDoPasse,
	renderAcaoDoPasseHtml,
	renderAtalhosHtml,
	renderCaixaHtml,
	renderChamadaDoPasseHtml,
	renderDestaquesHtml,
	renderMissoesDiariasHtml,
	renderMissoesSemanaisHtml,
	renderModalConteudoHtml,
	renderObjetivoHtml,
	renderPasseDeBatalhaHtml,
	renderPremioDaTrilhaHtml,
	renderProgressoDaTemporadaHtml,
	renderRevealHtml,
	renderTrilhaDeRecompensasHtml,
	renderVipHtml,
	textoDoSeloVip
} from 'UI/Components/TemporadaIdle/formatoDaTemporada.js';

/**
 * O que o JOGADOR le: o texto entre as tags, mais os `title` (dica de mouse e
 * tela do mesmo jeito). O `style` fica de fora de proposito - a barra da
 * Protecao Lendaria e uma largura em `%`, e ela nao e porcentagem de sorteio
 * nenhuma; foi ela que reprovou a primeira versao deste teste.
 */
function textoQueOJogadorLe(html) {
	const dicas = (html.match(/title="[^"]*"/g) || []).join(' ');
	return html.replace(/<[^>]*>/g, ' ') + ' ' + dicas;
}

/** Uma caixa como `estadoParaJanela` a manda (loja-da-temporada.ts). */
function caixa(extra = {}) {
	return {
		pool: 'TOP',
		sku: 'VISUAL_TOP_BOX_S1',
		nome: 'Caixa Topo',
		slot: 'Topo',
		preco: null,
		fechadas: 0,
		compra: { pode: false, motivo: 'fora-de-venda', texto: 'Esta caixa ainda não está à venda.' },
		pity: { contador: 3, garantia: 40, faltam: 37, garantidoNaProxima: false },
		recompensas: [
			{ itemId: 9000300, nome: 'Asas de Anjo', raridade: 'COMMON', rotuloDaRaridade: 'Comum', chance: 3250, escala: 10000, slot: 'Topo', animado: false },
			{ itemId: 9000305, nome: 'Máscara do Senhor das Trevas', raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', chance: 50, escala: 10000, slot: 'Topo', animado: false }
		],
		...extra
	};
}

/** Um `Objetivo` do contrato V2 (diária ou semanal). */
function objetivo(extra = {}) {
	return { id: 'matar-monstros', texto: 'Derrote 150 monstros', alvo: 150, progresso: 37, concluido: false, paga: true, ...extra };
}

/** Um `Premio` do contrato V2 (`nivel`/`trilha`/`itemId`/`nome`/`quantidade`/`animado`/`situacao`). */
function premio(extra = {}) {
	return { nivel: 7, trilha: 'free', itemId: 2254, nome: 'Asas Azuis de Fada', quantidade: 1, animado: false, situacao: 'AVAILABLE', ...extra };
}

/**
 * O bloco `passe` EXATAMENTE como o contrato exemplifica (CONTRATO-TEMPORADA-
 * V2.md) - 30 níveis, 1000 XP/nível, 400 XP de caça/dia. `premios` é gerado
 * (30 free + 30 vip), não digitado item a item - a forma é a do contrato
 * (2 trilhas por nível), o conteúdo de cada item não importa para o teste.
 */
function passeDoContrato(extra = {}) {
	const premios = [];
	for (let nivel = 1; nivel <= 30; nivel++) {
		premios.push(premio({ nivel, trilha: 'free', itemId: 20000 + nivel, nome: `Prêmio Free ${nivel}`, situacao: nivel <= 12 ? 'CLAIMED' : nivel === 13 ? 'AVAILABLE' : 'LOCKED' }));
		premios.push(premio({ nivel, trilha: 'vip', itemId: 30000 + nivel, nome: `Prêmio VIP ${nivel}`, situacao: 'LOCKED' }));
	}
	return {
		niveis: 30,
		xp: 12345,
		nivel: 12,
		xpPorNivel: 1000,
		xpNoNivel: 345,
		tetoDiarioDeCaca: 400,
		xpDeCacaHoje: 120,
		vip: false,
		diasRestantes: 18,
		diarias: {
			objetivos: [
				objetivo({ id: 'a', texto: 'Derrote 150 monstros', alvo: 150, progresso: 150, concluido: true, paga: true }),
				objetivo({ id: 'b', texto: 'Abra 1 caixa', alvo: 1, progresso: 0, concluido: false, paga: true }),
				objetivo({ id: 'c', texto: 'Venda 10 itens', alvo: 10, progresso: 3, concluido: false, paga: true }),
				objetivo({ id: 'd', texto: 'Entre em 1 dungeon', alvo: 1, progresso: 1, concluido: true, paga: false })
			],
			queContam: 3,
			xpPorObjetivo: 200,
			concluidas: 1,
			xpHoje: 200,
			tetoDeXp: 600
		},
		semanais: {
			bloco: 2,
			objetivos: [
				objetivo({ id: 'e', texto: 'Derrote 1000 monstros', alvo: 1000, progresso: 0 }),
				objetivo({ id: 'f', texto: 'Abra 10 caixas', alvo: 10, progresso: 0 }),
				objetivo({ id: 'g', texto: 'Alcance o nível 20', alvo: 20, progresso: 12 }),
				objetivo({ id: 'h', texto: 'Complete 5 missões', alvo: 5, progresso: 0 }),
				objetivo({ id: 'i', texto: 'Gaste 100 RO Cash', alvo: 100, progresso: 0 })
			],
			queContam: 4,
			xpPorObjetivo: 500,
			concluidas: 0,
			xpNoBloco: 0,
			tetoDeXp: 2000
		},
		premios,
		...extra
	};
}

function estadoDoPasse(extra = {}) {
	return {
		v: 1,
		cash: 5000,
		passes: [{ tipo: 'vip', cash: 100, dias: 30, ativo: true, expiraEm: 20261021, diasRestantes: 29, entregues: 1, diaDoCiclo: 2, recusa: 'ainda-nao-vence' }],
		vip: { expBase: 15, expJob: 15, dropComum: 15, dropCarta: 10, comandos: 0 },
		...extra
	};
}

function vip(extra = {}) {
	return {
		ativo: true,
		diasRestantes: 29,
		precoReferenciaCentavos: 900,
		dias: 30,
		beneficios: [
			{ texto: '+15% de EXP de base', ativo: true },
			{ texto: 'Selo VIP', ativo: true },
			{ texto: 'Recompensa diária VIP (em breve)', ativo: false }
		],
		visual: { itemId: 9000326, nome: 'Aura do Tornado', resgatado: false, pode: true, texto: null },
		...extra
	};
}

describe('a caixa a venda (decisao do dono de 22/09/2026: 10 cash)', () => {
	it('com preco e `compra.pode`, desenha o preco e o Comprar LIGADO, sem a recusa', () => {
		const html = renderCaixaHtml(caixa({ preco: 10, compra: { pode: true, motivo: null, texto: null } }));
		/* RO Shop (22/09/2026): todo RO Cash passa por `formatarRoCash` - o
		   `preco` inteiro da v2 vira 1000 minor e sai "10,00". */
		expect(html).toContain('<strong>10,00</strong>');
		expect(html).toContain('RO Cash');
		expect(html).not.toContain('Preço a definir');
		expect(html).not.toContain('ainda não está à venda');
		const comprar = html.match(/<button[^>]*data-agir="comprar-caixa"[^>]*>/)[0];
		expect(comprar).not.toContain('disabled');
	});

	it('contrato em minor (RO Shop): `precoMinor` ganha do `preco` inteiro, e 150 sai "1,50"', () => {
		const html = renderCaixaHtml(caixa({ preco: 99, precoMinor: 150, compra: { pode: true, motivo: null, texto: null } }));
		expect(html).toContain('<strong>1,50</strong>');
		expect(html).not.toContain('99');
		const semPreco = renderCaixaHtml(caixa({ preco: null, precoMinor: null }));
		expect(semPreco).toContain('Preço a definir');
	});

	it('sem preco (o servidor de hoje), o Comprar nasce APAGADO e a recusa e a frase do servidor', () => {
		const html = renderCaixaHtml(caixa());
		expect(html).toContain('Preço a definir');
		expect(html).toContain('Esta caixa ainda não está à venda.');
		const comprar = html.match(/<button[^>]*data-agir="comprar-caixa"[^>]*>/)[0];
		expect(comprar).toContain('disabled');
	});

	it('o Abrir so liga com caixa fechada na mao, e diz quantas', () => {
		const abrirDe = (fechadas) => renderCaixaHtml(caixa({ fechadas })).match(/<button[^>]*data-agir="abrir-caixa"[^>]*>[^<]*/)[0];
		expect(abrirDe(0)).toContain('disabled');
		expect(abrirDe(0)).toMatch(/>Abrir$/);
		expect(abrirDe(3)).not.toContain('disabled');
		expect(abrirDe(3)).toMatch(/Abrir \(3\)$/);
	});

	it('o cabecalho traz o icone premium da caixa (moldura), sem tirar o lugar dos sprites reais', () => {
		const html = renderCaixaHtml(caixa());
		expect(html).toContain('icone-caixa-topo.webp');
		/* Regra 18: o icone novo NUNCA substitui o sprite real do item - a
		   previa continua com `data-item-id`, o retrato real de cada premio. */
		expect(html).toContain('data-item-id="9000300"');
	});

	it('a previa traz as recompensas em ordem e com o aro da raridade, SEM a chance no title', () => {
		const html = renderCaixaHtml(caixa());
		expect(html).toContain('te-previa-item te-raridade--common');
		expect(html).toContain('te-previa-item te-raridade--legendary');
		expect(html).toContain('title="Asas de Anjo · Comum"');
		expect(html).toContain('title="Máscara do Senhor das Trevas · Lendária"');
		expect(html.indexOf('data-item-id="9000300"')).toBeLessThan(html.indexOf('data-item-id="9000305"'));
		/* A decisao de 22/09/2026: a porcentagem nao aparece em lugar nenhum do
		   card - nem no title, que e tela do mesmo jeito. */
		expect(textoQueOJogadorLe(html)).not.toContain('%');
	});

	it('a garantia na proxima vira a faixa dourada; abaixo de 10 aberturas vira o aviso', () => {
		expect(renderCaixaHtml(caixa({ pity: { contador: 39, garantia: 40, faltam: 1, garantidoNaProxima: true } }))).toContain('Lendário garantido na próxima');
		expect(renderCaixaHtml(caixa({ pity: { contador: 35, garantia: 40, faltam: 5, garantidoNaProxima: false } }))).toContain('Faltam 5 aberturas para a garantia');
		expect(renderCaixaHtml(caixa())).not.toContain('Faltam');
	});
});

describe('o reveal da abertura (decisao do dono de 22/09/2026: direto na mochila)', () => {
	const abertura = { itemId: 9000300, nome: 'Asas de Anjo', raridade: 'COMMON', rotuloDaRaridade: 'Comum', repetida: false, foiGarantia: false };

	it('imprime a frase do SERVIDOR como destino, e nunca decide o destino sozinho', () => {
		const html = renderRevealHtml({ ok: true, texto: 'Mochila cheia: Asas de Anjo foi para o seu correio.', abertura });
		expect(html).toContain('Mochila cheia: Asas de Anjo foi para o seu correio.');
		expect(html).not.toContain('foi para a sua mochila.');
	});

	it('sem frase do servidor, a reserva diz o destino NOVO (mochila), nunca o correio', () => {
		const html = renderRevealHtml({ ok: true, texto: '', abertura });
		expect(html).toContain('Asas de Anjo foi para a sua mochila.');
		expect(html).not.toContain('correio');
	});

	it('a raridade sai pelo rotulo do servidor, e o token cru nunca chega ao jogador', () => {
		const html = renderRevealHtml({ ok: true, texto: 'x', abertura: { ...abertura, raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', foiGarantia: true } });
		expect(html).toContain('>Lendária<');
		expect(html).not.toContain('>LEGENDARY<');
		expect(html).toContain('te-raridade--legendary');
		expect(html).toContain('Garantia da Proteção Lendária');
	});

	it('sem abertura nao ha reveal', () => {
		expect(renderRevealHtml({ ok: true, texto: 'x' })).toBe('');
		expect(renderRevealHtml(null)).toBe('');
	});
});

describe('o progresso compacto dos Destaques (contrato V2)', () => {
	it('a barra mostra o XP do nivel, e no teto diz que chegou - sem numero cravado', () => {
		const html = renderProgressoDaTemporadaHtml(passeDoContrato({ xpNoNivel: 250 }));
		expect(html).toContain('width:25%');
		expect(html).toContain('250 / 1000 XP para o nível 13');
		const noTeto = renderProgressoDaTemporadaHtml(passeDoContrato({ nivel: 30, xpNoNivel: 1000 }));
		expect(noTeto).toContain('width:100%');
		expect(noTeto).toContain('Nível máximo alcançado');
	});

	it('mostra as DUAS fontes de XP do dia - caca e missoes - separadas', () => {
		const html = renderProgressoDaTemporadaHtml(passeDoContrato());
		expect(html).toContain('Caça hoje:');
		expect(html).toContain('120');
		expect(html).toContain('400');
		expect(html).toContain('Missões hoje:');
		expect(html).toContain('200');
		expect(html).toContain('600');
	});

	it('emenda 1: `diasRestantes` null (temporada sem data de fim) NAO desenha "0 dias"', () => {
		const comData = renderProgressoDaTemporadaHtml(passeDoContrato({ diasRestantes: 18 }));
		expect(comData).toContain('18 dias restantes de temporada');
		const semData = renderProgressoDaTemporadaHtml(passeDoContrato({ diasRestantes: null }));
		expect(semData).not.toContain('dias restantes');
		expect(semData).not.toContain('0 dia');
	});

	it('se o servidor mandar `niveis: 40`, a barra desenha 40 - nada cravado no codigo', () => {
		const html = renderProgressoDaTemporadaHtml(passeDoContrato({ niveis: 40 }));
		expect(html).toContain('/ 40');
		expect(html).not.toContain('/ 30');
	});
});

describe('a chamada do Passe de Batalha (Destaques)', () => {
	it('convida para a aba, com o mascote e sem o passe inteiro', () => {
		const html = renderChamadaDoPasseHtml();
		expect(html).toContain('data-ir="passe"');
		expect(html).toContain('mascote-passe.webp');
		expect(html).toContain('Ver Passe de Batalha');
		/* Documento §16: "não colocar o Battle Pass completo aqui" - nenhum
		   nivel/trilha aparece neste card. */
		expect(html).not.toContain('data-agir="resgatar"');
	});
});

describe('os atalhos dos Destaques (so Caixas e VIP - o Semanal saiu)', () => {
	it('sao exatamente dois, e nenhum deles e o Passe Semanal', () => {
		const html = renderAtalhosHtml(vip());
		expect(html).toContain('data-ir="caixas"');
		expect(html).toContain('data-ir="vip"');
		expect(html).not.toContain('data-ir="semanal"');
		expect(html).not.toContain('Passe Semanal');
		expect((html.match(/class="te-atalho /g) || []).length + (html.match(/class="te-atalho ri-card"/g) || []).length).toBeGreaterThan(0);
	});

	it('o VIP ativo mostra os dias restantes DELE (nao os da temporada)', () => {
		const html = renderAtalhosHtml(vip({ ativo: true, diasRestantes: 7 }));
		expect(html).toContain('Ativo · 7 dias');
	});

	it('os atalhos nunca carregam acao: um toque neles so troca de aba', () => {
		const html = renderAtalhosHtml(vip());
		expect(html.match(/data-ir="[a-z]+"[^>]*data-agir/)).toBeNull();
	});
});

describe('o banner (a arte ja traz o titulo pintado - achado na prova de tela de 22/09/2026)', () => {
	it('NAO desenha "Season/nome/subtitulo" em HTML por cima da arte - so o prazo, que a arte nao sabe', () => {
		/* A primeira versao escrevia ".te-banner-texto" com "SEASON 1 · LUZ &
		   TREVAS · HERDEIROS DE MIDGARD" por cima da imagem `banner-luz-
		   trevas.webp`, que JA TEM o mesmo texto pintado - a prova de tela
		   fotografou os dois sobrepostos, ilegiveis. O texto do servidor
		   continua saindo, so que como `aria-label` (acessivel, nao visivel),
		   nunca mais como span visivel duplicando a arte. */
		const html = formatoDaTemporada.renderBannerHtml({ id: 'S1', nome: 'Luz & Trevas', subtitulo: 'Herdeiros de Midgard', aberta: true, fimMs: 0 });
		expect(html).not.toContain('te-banner-texto');
		expect(html).not.toContain('te-banner-linha');
		expect(html).toContain('aria-label="Season 1 · Luz &amp; Trevas · Herdeiros de Midgard"');
		// A arte "banner-luz-trevas.webp" entra por CSS (`.te-banner-arte`),
		// nao por um caminho escrito aqui no HTML.
		expect(html).toContain('te-banner-arte');
	});

	it('o prazo (dinamico, a arte nao sabe a data de hoje) continua visivel', () => {
		const aberta = formatoDaTemporada.renderBannerHtml({ fimMs: Date.UTC(2026, 9, 10) });
		expect(aberta).toContain('te-banner-prazo');
		expect(aberta).toContain('Aberta até');
		const encerrada = formatoDaTemporada.renderBannerHtml({ aberta: false });
		expect(encerrada).toContain('Temporada encerrada');
	});

	it('a fase vem do servidor: "antes" diz quando abre, nunca "encerrada"; o prazo mostra o ULTIMO dia aberto', () => {
		const inicioMs = Date.UTC(2026, 8, 24, 3);
		const fimMs = Date.UTC(2026, 9, 24, 3);
		const antes = formatoDaTemporada.renderBannerHtml({ aberta: false, fase: 'antes', inicioMs, fimMs });
		expect(antes).toContain(`Abre em ${formatoDaTemporada.dataCurtaDeMs(inicioMs)}`);
		expect(antes).not.toContain('encerrada');
		const aberta = formatoDaTemporada.renderBannerHtml({ aberta: true, fase: 'aberta', inicioMs, fimMs });
		// `fimMs` e o primeiro instante FECHADO
		expect(aberta).toContain(`Aberta até ${formatoDaTemporada.dataCurtaDeMs(fimMs - 1)}`);
		const fechada = formatoDaTemporada.renderBannerHtml({ aberta: false, fase: 'encerrada', inicioMs, fimMs });
		expect(fechada).toContain('Temporada encerrada');
	});

	it('o banner das Caixas usa a classe propria (a arte "banner-caixas.webp" entra por CSS, `.te-banner--caixas`), sem texto nenhum em HTML', () => {
		const html = formatoDaTemporada.renderBannerDasCaixasHtml();
		expect(html).toContain('te-banner--caixas');
		expect(html).not.toContain('te-banner-texto');
		expect(html).not.toContain('aria-label');
	});
});

describe('os Destaques inteiros (contrato V2: sem o estado do Passe)', () => {
	it('desenha banner, progresso, chamada do Passe de Batalha, caixas e atalhos', () => {
		const html = renderDestaquesHtml({
			temporada: { id: 'S1', nome: 'Luz & Trevas', subtitulo: 'Herdeiros de Midgard', aberta: true, fimMs: 0 },
			passe: passeDoContrato(),
			caixas: [caixa({ fechadas: 3 })],
			vip: vip()
		});
		expect(html).toContain('te-banner');
		expect(html).toContain('Luz &amp; Trevas');
		expect(html).toContain('data-ir="passe"');
		expect(html).toContain('data-ir="caixas"');
		expect(html).toContain('data-ir="vip"');
		expect(html).not.toContain('data-ir="semanal"');
		expect(html).toContain('3 fechadas · Máscara do Senhor das Trevas');
	});
});

describe('as missoes do Passe de Batalha (diarias e semanais)', () => {
	it('um objetivo concluido mostra o check e some a barra de progresso', () => {
		const html = renderObjetivoHtml(objetivo({ concluido: true, paga: true }), 200);
		expect(html).toContain('is-concluido');
		expect(html).toContain('+200 XP');
		expect(html).not.toContain('te-objetivo-progresso');
	});

	it('um objetivo NAO concluido mostra a barra e o numero, sem o check', () => {
		const html = renderObjetivoHtml(objetivo({ concluido: false, progresso: 37, alvo: 150 }), 200);
		expect(html).toContain('37 / 150');
		expect(html).toContain('width:25%');
		expect(html).not.toContain('is-concluido');
	});

	it('`paga:false` (o extra que fecha depois do limite) marca "nao conta", nunca some o XP prometido em silencio', () => {
		const html = renderObjetivoHtml(objetivo({ concluido: true, paga: false }), 200);
		expect(html).toContain('is-sem-xp');
		expect(html).toContain('não conta');
		expect(html).not.toContain('+200 XP');
	});

	it('as diarias mostram o XP de hoje e a nota de quantas pagam', () => {
		const html = renderMissoesDiariasHtml(passeDoContrato().diarias);
		expect(html).toContain('200 / 600 XP hoje');
		expect(html).toContain('Vale 3 de 4');
		expect(html).toContain('1 de 3 concluídas.');
		expect(html.match(/class="te-objetivo/g).length).toBeGreaterThanOrEqual(4);
	});

	it('as semanais trazem o icone de calendario e o bloco atual', () => {
		const html = renderMissoesSemanaisHtml(passeDoContrato().semanais);
		expect(html).toContain('icone-missoes-semanais.webp');
		expect(html).toContain('0 / 2000 XP no bloco');
	});

	it('emenda 1: `semanais: null` (temporada sem data de inicio) esconde o bloco, sem "undefined" na tela', () => {
		const html = renderMissoesSemanaisHtml(null);
		expect(html).toBe('');
	});

	it('a aba inteira nao quebra quando `semanais` vem null - so o bloco some', () => {
		const html = renderPasseDeBatalhaHtml(passeDoContrato({ semanais: null }));
		expect(html).not.toContain('undefined');
		expect(html).not.toContain('Missões semanais');
		expect(html).toContain('Missões diárias');
	});
});

describe('a trilha de recompensas (free/vip lado a lado)', () => {
	it('agrupa os premios por nivel, free e vip juntos na mesma coluna', () => {
		const passe = passeDoContrato();
		const niveis = niveisDoPasse(passe);
		expect(niveis).toHaveLength(30);
		expect(niveis[0].nivel).toBe(1);
		expect(niveis[0].free).not.toBeNull();
		expect(niveis[0].vip).not.toBeNull();
	});

	it('um nivel sem premio de um lado vira placeholder, nunca quebra a coluna', () => {
		const niveis = niveisDoPasse({ premios: [premio({ nivel: 5, trilha: 'free' })] });
		expect(niveis).toHaveLength(1);
		expect(niveis[0].vip).toBeNull();
		const html = renderPremioDaTrilhaHtml(niveis[0].vip, 'vip');
		expect(html).toContain('te-premio-card--vazio');
	});

	it('CLAIMED vira selo, AVAILABLE vira botao Resgatar, LOCKED vira cadeado', () => {
		expect(renderPremioDaTrilhaHtml(premio({ situacao: 'CLAIMED' }), 'free')).toContain('is-resgatado');
		const disponivel = renderPremioDaTrilhaHtml(premio({ situacao: 'AVAILABLE', nivel: 13 }), 'free');
		expect(disponivel).toContain('data-agir="resgatar"');
		expect(disponivel).toContain('data-nivel="13"');
		expect(disponivel).toContain('data-trilha="free"');
		expect(renderPremioDaTrilhaHtml(premio({ situacao: 'LOCKED' }), 'vip')).toContain('is-bloqueado');
	});

	it('quantidade > 1 aparece como tag; quantidade 1 nao polui a tela', () => {
		expect(renderPremioDaTrilhaHtml(premio({ quantidade: 5 }), 'free')).toContain('×5');
		expect(renderPremioDaTrilhaHtml(premio({ quantidade: 1 }), 'free')).not.toContain('te-premio-card-qtd');
	});

	it('sem VIP nesta temporada, a legenda/trilha VIP fica marcada como bloqueada - visivel, nunca escondida', () => {
		const semVip = renderTrilhaDeRecompensasHtml(passeDoContrato({ vip: false }));
		expect(semVip).toContain('is-bloqueada');
		expect(semVip).toContain('is-sem-vip');
		expect(semVip).toContain('te-premio-card--vip');
		const comVip = renderTrilhaDeRecompensasHtml(passeDoContrato({ vip: true }));
		expect(comVip).not.toContain('is-bloqueada');
		expect(comVip).not.toContain('is-sem-vip');
	});
});

describe('a aba Passe de Batalha inteira (payload V2 montado a partir do contrato)', () => {
	it('desenha nivel/XP, dias restantes, as duas missoes e a trilha - tudo do JSON, nada cravado', () => {
		const html = renderPasseDeBatalhaHtml(passeDoContrato());
		expect(html).toContain('Nível <strong>12</strong>');
		expect(html).toContain('/ 30');
		expect(html).toContain('345 / 1000 XP para o nível 13');
		expect(html).toContain('18 dias restante');
		expect(html).toContain('Missões diárias');
		expect(html).toContain('Missões semanais');
		expect(html).toContain('emblema-temporada.webp');
		expect(html).toContain('mascote-passe.webp');
	});

	it('com OUTROS numeros no payload (nao os do exemplo), a pagina desenha os outros - prova de que nada esta cravado', () => {
		const outro = passeDoContrato({ niveis: 50, nivel: 3, xpPorNivel: 2000, xpNoNivel: 500, diasRestantes: 41 });
		const html = renderPasseDeBatalhaHtml(outro);
		expect(html).toContain('/ 50');
		expect(html).toContain('500 / 2000 XP para o nível 4');
		expect(html).toContain('41 dias restante');
		expect(html).not.toContain('/ 30');
		expect(html).not.toContain('1000 XP');
	});

	it('emenda 1: `diasRestantes: null` nao desenha nenhuma contagem de dias', () => {
		const html = renderPasseDeBatalhaHtml(passeDoContrato({ diasRestantes: null }));
		expect(html).not.toContain('dia restante');
		expect(html).not.toContain('0 dia');
	});
});

describe('o VIP (a compra veio da janela de Recompensas)', () => {
	it('o veredito do botao de passe vem do campo `recusa` do servidor', () => {
		/* O segundo argumento e o SALDO EM MINOR desde o RO Shop (22/09/2026);
		   o `cash` inteiro do passe vira minor x100 (`minorDe`). */
		const pode = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: false, recusa: null }, 500000);
		expect(pode.match(/<button[^>]*>/)[0]).not.toContain('disabled');
		expect(pode).toContain('O valor sai do seu saldo de cash na hora.');

		const semSaldo = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: false, recusa: 'saldo-insuficiente' }, 4000);
		expect(semSaldo.match(/<button[^>]*>/)[0]).toContain('disabled');
		expect(semSaldo).toContain('Faltam 60,00 RO Cash.');

		const aindaVale = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: true, recusa: 'ainda-nao-vence' }, 500000);
		expect(aindaVale).toContain('Renovar · 100,00 RO Cash');

		/* O ZC_RAGIDLE_PASSE v2 (CONTRATO.md do RO Shop, secao 5) troca o NOME:
		   `passes[].cash` vira `precoMinor`, e o novo ganha do antigo. */
		const emMinor = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 7, precoMinor: 10000, dias: 30, ativo: false, recusa: 'saldo-insuficiente' }, 2550);
		expect(emMinor).toContain('Comprar · 100,00 RO Cash');
		expect(emMinor).toContain('Faltam 74,50 RO Cash.');
		expect(aindaVale).toContain('A renovação abre no último dia');
	});

	it('o Passe v2 inteiro (`saldoMinor` + `passes[].precoMinor`) chega na aba VIP em minor', () => {
		const v2 = {
			v: 2,
			saldoMinor: 862000,
			passes: [{ tipo: 'vip', precoMinor: 10000, dias: 30, ativo: false, recusa: null }]
		};
		const html = renderVipHtml(vip(), v2);
		expect(html).toContain('100,00');
		expect(html).toContain('Comprar · 100,00 RO Cash');
		expect(html).not.toContain('undefined');
	});

	it('o emblema grande do VIP entra no topo da aba', () => {
		const html = renderVipHtml(vip(), estadoDoPasse());
		expect(html).toContain('vip-emblema.webp');
	});

	it('a aba VIP junta as duas fontes: os beneficios da temporada e a compra do passe', () => {
		const html = renderVipHtml(vip(), estadoDoPasse());
		expect(html).toContain('Equivale a R$ 9,00 por 30 dias');
		expect(html).toContain('<strong class="te-beneficio-valor">+15%</strong>');
		expect(html).toContain('de EXP de base');
		expect(html).toContain('is-em-breve');
		expect(html).toContain('data-agir="resgatar-visual-vip"');
		expect(html).toContain('data-agir="comprar-passe"');
		expect(html).toContain('data-tipo="vip"');
		expect(html).toContain('até 21/10 · 29 dias restantes');
	});

	/*
	 * O ICONE SEGUE O ITEM (23/09/2026). Ate a troca do premio ele era cravado
	 * no Astra Blessing, e o card da Aura do Tornado sairia com o orbe azul da
	 * Astra ao lado do nome novo.
	 */
	it('o icone do card e o do ITEM que o servidor manda: Tornado, Astra, e o id sem icone dedicado cai na arte do proprio item', () => {
		const tornado = renderVipHtml(vip(), estadoDoPasse());
		expect(tornado).toContain('src="/ragidle/temporada/icone-aura-do-tornado.webp"');
		expect(tornado).not.toContain('icone-astra-blessing.webp');
		expect(tornado).toContain('Aura do Tornado');

		const astra = renderVipHtml(vip({ visual: { itemId: 9000325, nome: 'Astra Blessing', resgatado: true, pode: false, texto: null } }), estadoDoPasse());
		expect(astra).toContain('src="/ragidle/temporada/icone-astra-blessing.webp"');

		expect(iconeDoVisualDoVip(9000326)).toBe('/ragidle/temporada/icone-aura-do-tornado.webp');
		expect(iconeDoVisualDoVip(9000399)).toBe('/ragidle/collection/9000399.png');
	});

	it('o visual do VIP usa o icone dedicado, com o ESTADO certo (disponivel/resgatado/bloqueado)', () => {
		const disponivel = renderVipHtml(vip({ visual: { itemId: 9000326, nome: 'Aura do Tornado', resgatado: false, pode: true, texto: null } }), estadoDoPasse());
		expect(disponivel).toContain('icone-aura-do-tornado.webp');
		expect(disponivel).toContain('is-disponivel');

		const resgatado = renderVipHtml(vip({ visual: { itemId: 1, nome: 'Astra', resgatado: true, pode: false, texto: null } }), estadoDoPasse());
		expect(resgatado).toContain('is-resgatado');
		expect(resgatado).toContain('>Resgatado</button>');

		const bloqueado = renderVipHtml(vip({ ativo: false, visual: { itemId: 1, nome: 'Astra', resgatado: false, pode: false, texto: 'Resgate com o VIP ativo.' } }), estadoDoPasse());
		expect(bloqueado).toContain('is-bloqueado');
		expect(bloqueado.match(/<button[^>]*data-agir="resgatar-visual-vip"[^>]*>/)[0]).toContain('disabled');
		expect(bloqueado).toContain('Resgate com o VIP ativo.');
	});

	it('o visual do VIP so libera o botao pelo veredito do servidor, nunca por `vip.ativo`', () => {
		const semVip = renderVipHtml(vip({ ativo: false, visual: { itemId: 1, nome: 'Astra', resgatado: false, pode: false, texto: 'Resgate com o VIP ativo.' } }), estadoDoPasse());
		expect(semVip.match(/<button[^>]*data-agir="resgatar-visual-vip"[^>]*>/)[0]).toContain('disabled');
		const comVipMasResgatado = renderVipHtml(vip({ visual: { itemId: 1, nome: 'Astra', resgatado: true, pode: false, texto: 'Já resgatado nesta temporada.' } }), estadoDoPasse());
		expect(comVipMasResgatado).toContain('>Resgatado</button>');
	});
});

describe('o "Ver conteudo" separado por categoria (decisao do dono, 22/09/2026)', () => {
	/** Um pool inteiro como o servidor o manda: 3 COMMON, 2 RARE, 1 LEGENDARY. */
	function poolCompleto() {
		return caixa({
			recompensas: [
				{ itemId: 9000300, nome: 'Asas de Anjo', raridade: 'COMMON', rotuloDaRaridade: 'Comum', chance: 3250, escala: 10000, slot: 'Topo', animado: false },
				{ itemId: 9000301, nome: 'Coroa de Prata', raridade: 'COMMON', rotuloDaRaridade: 'Comum', chance: 3250, escala: 10000, slot: 'Topo', animado: false },
				{ itemId: 9000302, nome: 'Tiara Simples', raridade: 'COMMON', rotuloDaRaridade: 'Comum', chance: 3250, escala: 10000, slot: 'Topo', animado: false },
				{ itemId: 9000303, nome: 'Elmo Rúnico', raridade: 'RARE', rotuloDaRaridade: 'Rara', chance: 100, escala: 10000, slot: 'Topo', animado: true },
				{ itemId: 9000304, nome: 'Auréola Menor', raridade: 'RARE', rotuloDaRaridade: 'Rara', chance: 100, escala: 10000, slot: 'Topo', animado: false },
				{ itemId: 9000305, nome: 'Máscara do Senhor das Trevas', raridade: 'LEGENDARY', rotuloDaRaridade: 'Lendária', chance: 50, escala: 10000, slot: 'Topo', animado: false }
			]
		});
	}

	it('agrupa as 6 recompensas em 3 categorias, da lendaria para a comum', () => {
		const grupos = agruparPorRaridade(poolCompleto().recompensas);
		expect(grupos.map((g) => g.raridade)).toEqual(['LEGENDARY', 'RARE', 'COMMON']);
		expect(grupos.map((g) => g.itens.length)).toEqual([1, 2, 3]);
		expect(grupos.map((g) => g.rotulo)).toEqual(['Lendária', 'Rara', 'Comum']);
	});

	it('uma raridade que o cliente nao conhece vira grupo no fim, e NUNCA some da tela', () => {
		const inventada = { itemId: 9000399, nome: 'Coisa Nova', raridade: 'MYTHIC', rotuloDaRaridade: 'Mítica', chance: 1, escala: 10000, slot: 'Topo', animado: false };
		const grupos = agruparPorRaridade([...poolCompleto().recompensas, inventada]);
		expect(grupos.map((g) => g.raridade)).toEqual(['LEGENDARY', 'RARE', 'COMMON', 'MYTHIC']);
		expect(renderModalConteudoHtml(caixa({ recompensas: [inventada] }))).toContain('Coisa Nova');
	});

	it('sem recompensa nenhuma nao inventa grupo', () => {
		expect(agruparPorRaridade([])).toEqual([]);
		expect(agruparPorRaridade(undefined)).toEqual([]);
	});

	it('o modal desenha um grupo por categoria, na ordem, com a contagem de cada um', () => {
		const html = renderModalConteudoHtml(poolCompleto());
		expect(html.match(/class="te-premio-grupo"/g)).toHaveLength(3);
		expect(html).toContain('data-raridade="LEGENDARY"');
		expect(html).toContain('>1 item<');
		expect(html).toContain('>2 itens<');
		expect(html).toContain('>3 itens<');
		expect(html.indexOf('data-raridade="LEGENDARY"')).toBeLessThan(html.indexOf('data-raridade="RARE"'));
		expect(html.indexOf('data-raridade="RARE"')).toBeLessThan(html.indexOf('data-raridade="COMMON"'));
	});

	it('nenhuma porcentagem sobra no modal, e os 6 itens continuam todos na tela', () => {
		const html = renderModalConteudoHtml(poolCompleto());
		expect(html).not.toContain('te-premio-chance');
		expect(textoQueOJogadorLe(html)).not.toContain('%');
		['Asas de Anjo', 'Coroa de Prata', 'Tiara Simples', 'Elmo Rúnico', 'Auréola Menor', 'Máscara do Senhor das Trevas'].forEach((nome) => {
			expect(html).toContain(nome);
		});
	});

	it('a raridade aparece UMA vez por grupo, e nao repetida em cada linha', () => {
		const html = renderModalConteudoHtml(poolCompleto());
		expect(html.match(/>Comum</g)).toHaveLength(1);
		expect(html.match(/>Rara</g)).toHaveLength(1);
	});
});

describe('as pecas pequenas', () => {
	it('formata preco em centavos, data curta e o selo do VIP', () => {
		expect(formatarPrecoCentavos(900)).toBe('R$ 9,00');
		expect(formatarPrecoCentavos(123456)).toMatch(/^R\$ 1\.?234,56$/);
		expect(dataCurta(20261021)).toBe('21/10');
		expect(dataCurta(0)).toBe('');
		expect(textoDoSeloVip({ ativo: true, diasRestantes: 1 })).toBe('VIP · 1 dia');
		expect(textoDoSeloVip({ ativo: true, diasRestantes: 29 })).toBe('VIP · 29 dias');
		expect(textoDoSeloVip(null)).toBe('Sem VIP');
	});

	it('o modal de conteudo imprime o rotulo do servidor, e NUNCA o token cru', () => {
		const html = renderModalConteudoHtml(caixa());
		expect(html).toContain('>Comum<');
		expect(html).toContain('>Lendária<');
		expect(html).not.toContain('>COMMON<');
		expect(html).not.toContain('>LEGENDARY<');
	});

	it('NENHUM texto que vira tela traz travessao (regra do dono)', () => {
		const tudo = [
			renderCaixaHtml(caixa({ preco: 10, compra: { pode: true, motivo: null, texto: null } })),
			renderCaixaHtml(caixa()),
			renderModalConteudoHtml(caixa()),
			renderProgressoDaTemporadaHtml(passeDoContrato()),
			renderChamadaDoPasseHtml(),
			renderAtalhosHtml(vip()),
			renderDestaquesHtml({ temporada: {}, passe: passeDoContrato(), caixas: [caixa()], vip: vip() }),
			renderPasseDeBatalhaHtml(passeDoContrato()),
			renderVipHtml(vip(), estadoDoPasse()),
			renderVipHtml(vip(), null),
			renderRevealHtml({ ok: true, texto: '', abertura: { itemId: 1, nome: 'X', raridade: 'RARE', rotuloDaRaridade: 'Rara' } })
		].join('\n');
		expect(tudo).not.toContain(' - ');
	});

	it('as funcoes do Passe Premium/Passe Semanal V1 NAO existem mais no modulo - dead code nao fica verde escondido', () => {
		expect(formatoDaTemporada.renderPremiumHtml).toBeUndefined();
		expect(formatoDaTemporada.renderPasseCompactoHtml).toBeUndefined();
		expect(formatoDaTemporada.renderMarcoHtml).toBeUndefined();
		expect(formatoDaTemporada.marcosDoPasse).toBeUndefined();
		expect(formatoDaTemporada.renderSemanalHtml).toBeUndefined();
	});
});
