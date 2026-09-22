/**
 * A METADE PURA da janela da Temporada (formatoDaTemporada.js), medida sem
 * levantar a janela — o mesmo corte de `tabelaDoPainel.js` no Painel de
 * Comando: entrada -> string, sem DOM, sem rede.
 *
 * Ela nasceu em 22/09/2026 com duas decisoes do dono na mao, e cada uma tem
 * um caso aqui de proposito:
 *
 *  1. AS CAIXAS PASSAM A CUSTAR 10 CASH. Enquanto o servidor de hoje ainda
 *     manda `preco: null`, a foto da janela mostra "Preco a definir" e o
 *     Comprar apagado — e nenhuma foto prova o outro lado. Este arquivo prova
 *     que, chegando `preco: 10` e `compra.pode: true`, o card desenha o preco
 *     e o botao LIGADO, sem a linha de recusa.
 *
 *  2. A CAIXA ENTREGA O VISUAL DIRETO NA MOCHILA. O reveal dizia "Enviado ao
 *     seu correio." por conta propria; hoje ele imprime a frase do SERVIDOR e,
 *     sem frase, diz o destino novo. Nunca mais "correio" escrito aqui.
 *
 * E o resto: o que a janela decide sozinha (ordem dos marcos, o que cada
 * situacao vira, o veredito do botao de passe que vem do servidor) e o que ela
 * NUNCA pode fazer (imprimir o token cru da raridade, escrever travessao para
 * o jogador).
 */

import { describe, expect, it } from 'vitest';
import {
	dataCurta,
	formatarPorcentagem,
	formatarPrecoCentavos,
	marcosDoPasse,
	renderAcaoDoPasseHtml,
	renderCaixaHtml,
	renderDestaquesHtml,
	renderMarcoHtml,
	renderModalConteudoHtml,
	renderPasseCompactoHtml,
	renderRevealHtml,
	renderSemanalHtml,
	renderVipHtml,
	textoDoSeloVip
} from 'UI/Components/TemporadaIdle/formatoDaTemporada.js';

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

function passe(extra = {}) {
	return {
		niveis: 50,
		pontos: 1200,
		nivel: 12,
		pontosPorNivel: 100,
		pontosNoNivel: 0,
		tetoDiario: 200,
		pontosHoje: 0,
		pontosPorAbate: 1,
		premium: false,
		precoPremium: null,
		compraPremium: { pode: false, motivo: 'fora-de-venda', texto: 'O Passe Premium ainda não está à venda.' },
		premios: [
			{ nivel: 50, trilha: 'premium', itemId: 9000324, nome: 'Rune-Midgarts Glory', animado: true, situacao: 'LOCKED' },
			{ nivel: 10, trilha: 'free', itemId: 20511, nome: 'Asas Azuis de Fada', animado: false, situacao: 'AVAILABLE' },
			{ nivel: 50, trilha: 'free', itemId: 9000320, nome: 'Valkyrie Wings', animado: false, situacao: 'LOCKED' },
			{ nivel: 15, trilha: 'premium', itemId: 9000321, nome: 'Shining Angel Wings', animado: true, situacao: 'LOCKED' }
		],
		...extra
	};
}

function estadoDoPasse(extra = {}) {
	return {
		v: 1,
		cash: 5000,
		passes: [
			{ tipo: 'semanal', cash: 50, dias: 7, ativo: false, expiraEm: 0, diasRestantes: 0, entregues: 0, diaDoCiclo: 0, recusa: null },
			{ tipo: 'vip', cash: 100, dias: 30, ativo: true, expiraEm: 20261021, diasRestantes: 29, entregues: 1, diaDoCiclo: 2, recusa: 'ainda-nao-vence' }
		],
		semanal: {
			cashbackTotal: 10,
			dias: [1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia, cash: dia === 7 ? 4 : 1, itens: [{ nome: 'Poção Branca', quantidade: dia === 7 ? 10 : 5 }] }))
		},
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
		visual: { itemId: 9000325, nome: 'Astra Blessing', resgatado: false, pode: true, texto: null },
		...extra
	};
}

describe('a caixa a venda (decisao do dono de 22/09/2026: 10 cash)', () => {
	it('com preco e `compra.pode`, desenha o preco e o Comprar LIGADO, sem a recusa', () => {
		const html = renderCaixaHtml(caixa({ preco: 10, compra: { pode: true, motivo: null, texto: null } }));
		expect(html).toContain('<strong>10</strong>');
		expect(html).toContain('RO Cash');
		expect(html).not.toContain('Preço a definir');
		expect(html).not.toContain('ainda não está à venda');
		const comprar = html.match(/<button[^>]*data-agir="comprar-caixa"[^>]*>/)[0];
		expect(comprar).not.toContain('disabled');
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

	it('a previa traz as recompensas em ordem, com o aro da raridade e a chance no title', () => {
		const html = renderCaixaHtml(caixa());
		expect(html).toContain('te-previa-item te-raridade--common');
		expect(html).toContain('te-previa-item te-raridade--legendary');
		expect(html).toContain('title="Asas de Anjo · Comum · 32,5%"');
		expect(html).toContain('title="Máscara do Senhor das Trevas · Lendária · 0,5%"');
		expect(html.indexOf('data-item-id="9000300"')).toBeLessThan(html.indexOf('data-item-id="9000305"'));
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
		/* A frase e DIFERENTE da reserva de proposito: o servidor e quem sabe
		   quando a mochila nao coube e o visual foi ao correio (a excecao). A
		   primeira versao usava a mesma frase da reserva, e o mutante que
		   ignorava `resultado.texto` sobreviveu. */
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

describe('o passe compacto dos Destaques', () => {
	it('ordena os marcos por nivel, e no mesmo nivel o free vem antes do premium', () => {
		const ordem = marcosDoPasse(passe()).map((p) => `${p.nivel}-${p.trilha}`);
		expect(ordem).toEqual(['10-free', '15-premium', '50-free', '50-premium']);
	});

	it('cada situacao vira uma coisa diferente na tela', () => {
		const p = passe();
		const disponivel = renderMarcoHtml({ nivel: 10, trilha: 'free', itemId: 1, nome: 'A', situacao: 'AVAILABLE' }, p);
		expect(disponivel).toContain('data-agir="resgatar"');
		expect(disponivel).toContain('data-nivel="10"');
		expect(disponivel).toContain('data-trilha="free"');

		const resgatado = renderMarcoHtml({ nivel: 10, trilha: 'free', itemId: 1, nome: 'A', situacao: 'CLAIMED' }, p);
		expect(resgatado).toContain('Resgatado');
		expect(resgatado).not.toContain('data-agir');

		/* Trancado por NIVEL: diz o nivel. Trancado so por falta do Premium
		   (nivel ja alcancado): diz "Premium" — o jogador precisa saber qual
		   dos dois para agir. */
		const estadoDe = (html) => html.match(/te-marco-estado is-bloqueado">.*?<span>([^<]*)<\/span>/)[1];
		expect(estadoDe(renderMarcoHtml({ nivel: 25, trilha: 'free', itemId: 1, nome: 'A', situacao: 'LOCKED' }, p))).toBe('Nível 25');
		/* `>Premium<` solto casaria o rotulo da TRILHA, e o mutante que nunca
		   diz "Premium" no estado sobreviveu a primeira versao deste caso. */
		expect(estadoDe(renderMarcoHtml({ nivel: 10, trilha: 'premium', itemId: 1, nome: 'A', situacao: 'LOCKED' }, p))).toBe('Premium');
	});

	it('a barra mostra os pontos do nivel, e no teto diz que chegou', () => {
		expect(renderPasseCompactoHtml(passe({ pontosNoNivel: 25 }))).toContain('width:25%');
		expect(renderPasseCompactoHtml(passe({ pontosNoNivel: 25 }))).toContain('25 / 100 pontos para o nível 13');
		const noTeto = renderPasseCompactoHtml(passe({ nivel: 50, pontosNoNivel: 100 }));
		expect(noTeto).toContain('width:100%');
		expect(noTeto).toContain('Nível máximo alcançado');
	});

	it('o Premium: selo se ja tem, "em breve" sem preco, botao com preco a venda', () => {
		expect(renderPasseCompactoHtml(passe({ premium: true }))).toContain('Premium ativo');
		expect(renderPasseCompactoHtml(passe())).toContain('Premium em breve');
		const aVenda = renderPasseCompactoHtml(passe({ precoPremium: 300, compraPremium: { pode: true, motivo: null, texto: null } }));
		expect(aVenda).toContain('data-agir="comprar-premium"');
		expect(aVenda).toContain('300 RO Cash');
		expect(aVenda.match(/<button[^>]*data-agir="comprar-premium"[^>]*>/)[0]).not.toContain('disabled');
	});

	it('os Destaques desenham as quatro partes, e os atalhos so TROCAM DE ABA', () => {
		const html = renderDestaquesHtml({ temporada: { id: 'S1', nome: 'Luz & Trevas', subtitulo: 'Herdeiros de Midgard', aberta: true, fimMs: 0 }, passe: passe(), caixas: [caixa({ fechadas: 3 })], vip: vip() }, estadoDoPasse());
		expect(html).toContain('te-banner');
		expect(html).toContain('Luz &amp; Trevas');
		expect(html).toContain('Passe da Temporada');
		expect(html).toContain('data-ir="caixas"');
		expect(html).toContain('data-ir="semanal"');
		expect(html).toContain('data-ir="vip"');
		expect(html).toContain('3 fechadas · Máscara do Senhor das Trevas');
		expect(html).toContain('Ativo · 29 dias');
		/* Os atalhos nunca carregam acao: um toque neles nao pode gastar nada. */
		expect(html.match(/data-ir="[a-z]+"[^>]*data-agir/)).toBeNull();
	});
});

describe('o Passe Semanal e o VIP (o que veio da janela de Recompensas)', () => {
	it('sem o estado do Passe, a aba diz que esta carregando', () => {
		expect(renderSemanalHtml(null)).toContain('Carregando');
	});

	it('o cashback e DERIVADO do preco e da tabela, nunca escrito a mao', () => {
		const html = renderSemanalHtml(estadoDoPasse());
		expect(html).toContain('7 dias · 20% de cashback no final');
		/* `te-dia` seguido de espaco ou aspas: `te-dia-num`/`-cash`/`-item` sao
		   filhos e nao contam — a primeira versao contava 28. */
		expect((html.match(/class="te-dia[ "]/g) || []).length).toBe(7);
		expect(html).toContain('is-premio');
		expect(html).toContain('data-agir="comprar-passe"');
		expect(html).toContain('data-tipo="semanal"');
		expect(html).toContain('Comprar · 50 cash');
	});

	it('o veredito do botao de passe vem do campo `recusa` do servidor', () => {
		const pode = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: false, recusa: null }, 5000);
		expect(pode.match(/<button[^>]*>/)[0]).not.toContain('disabled');
		expect(pode).toContain('O valor sai do seu saldo de cash na hora.');

		const semSaldo = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: false, recusa: 'saldo-insuficiente' }, 40);
		expect(semSaldo.match(/<button[^>]*>/)[0]).toContain('disabled');
		expect(semSaldo).toContain('Faltam 60 cash.');

		const aindaVale = renderAcaoDoPasseHtml({ tipo: 'vip', cash: 100, dias: 30, ativo: true, recusa: 'ainda-nao-vence' }, 5000);
		expect(aindaVale).toContain('Renovar · 100 cash');
		expect(aindaVale).toContain('A renovação abre no último dia');
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

	it('o visual do VIP so libera o botao pelo veredito do servidor, nunca por `vip.ativo`', () => {
		const semVip = renderVipHtml(vip({ ativo: false, visual: { itemId: 1, nome: 'Astra', resgatado: false, pode: false, texto: 'Resgate com o VIP ativo.' } }), estadoDoPasse());
		expect(semVip.match(/<button[^>]*data-agir="resgatar-visual-vip"[^>]*>/)[0]).toContain('disabled');
		expect(semVip).toContain('Resgate com o VIP ativo.');
		const comVipMasResgatado = renderVipHtml(vip({ visual: { itemId: 1, nome: 'Astra', resgatado: true, pode: false, texto: 'Já resgatado nesta temporada.' } }), estadoDoPasse());
		expect(comVipMasResgatado).toContain('>Resgatado</button>');
	});
});

describe('as pecas pequenas', () => {
	it('formata porcentagem, preco em centavos, data curta e o selo do VIP', () => {
		expect(formatarPorcentagem(3250, 10000)).toBe('32,5%');
		expect(formatarPorcentagem(50, 10000)).toBe('0,5%');
		expect(formatarPorcentagem(NaN, 10000)).toBe('0%');
		expect(formatarPrecoCentavos(900)).toBe('R$ 9,00');
		expect(formatarPrecoCentavos(123456)).toMatch(/^R\$ 1\.?234,56$/);
		expect(dataCurta(20261021)).toBe('21/10');
		expect(dataCurta(0)).toBe('');
		expect(textoDoSeloVip({ ativo: true, diasRestantes: 1 })).toBe('VIP · 1 dia');
		expect(textoDoSeloVip({ ativo: true, diasRestantes: 29 })).toBe('VIP · 29 dias');
		expect(textoDoSeloVip(null)).toBe('Sem VIP');
	});

	it('o modal de conteudo imprime o rotulo do servidor e a chance de cada linha', () => {
		const html = renderModalConteudoHtml(caixa());
		expect(html).toContain('>Comum<');
		expect(html).toContain('>Lendária<');
		expect(html).toContain('32,5%');
		expect(html).toContain('0,5%');
		expect(html).not.toContain('>COMMON<');
	});

	it('NENHUM texto que vira tela traz travessao (regra do dono)', () => {
		const tudo = [
			renderCaixaHtml(caixa({ preco: 10, compra: { pode: true, motivo: null, texto: null } })),
			renderCaixaHtml(caixa()),
			renderModalConteudoHtml(caixa()),
			renderPasseCompactoHtml(passe()),
			renderDestaquesHtml({ temporada: {}, passe: passe(), caixas: [caixa()], vip: vip() }, null),
			renderSemanalHtml(estadoDoPasse()),
			renderVipHtml(vip(), estadoDoPasse()),
			renderVipHtml(vip(), null),
			renderRevealHtml({ ok: true, texto: '', abertura: { itemId: 1, nome: 'X', raridade: 'RARE', rotuloDaRaridade: 'Rara' } })
		].join('\n');
		expect(tudo).not.toContain('—');
	});
});
