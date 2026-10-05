/**
 * NO MAPA DA MISSAO, A JORNADA CONFIRMA EM VEZ DE ALERTAR (04/10/2026, relato
 * de 30/09: "por mais que eu mate (...) as kills nao sao contabilizadas").
 *
 * O cartao da missao mostrava "Ir para X" APAGADO, com o glifo de alerta e
 * "Voce ja esta neste mapa.", justamente para quem estava cacando no lugar
 * certo, e isso lia como bloqueio. Agora e uma confirmacao: "cada abate conta".
 */
import { describe, expect, it } from 'vitest';
import { jornadaHtml } from 'UI/Components/CodexIdle/jornadaHtml.js';

function render(mapaAtual) {
	const capitulo = { id: 'c1', ordem: 1, titulo: 'Os campos', estado: 'disponivel', concluidas: 0, total: 1 };
	const jornada = { desbloqueada: true, capitulos: [capitulo], premio: {}, concluidas: 0, total: 1 };
	const missao = {
		id: 'm1',
		mobId: 1002,
		monstro: 'Poring',
		mapa: 'prt_fild08',
		mapaRotulo: 'Campo de Prontera',
		meta: 80,
		abates: 0,
		estado: 'disponivel'
	};
	return jornadaHtml(
		{ jornada },
		{
			estado: { jornada },
			vista: 'capitulo',
			capituloAberto: 'c1',
			missoesPorCapitulo: { c1: [missao] },
			situacao: { mapaAtual, morto: false, nivelDoJogador: 30 },
			nivelQueAbre: () => 1
		}
	);
}

describe('a Jornada no mapa da missao', () => {
	it('no mapa certo: confirma que cada abate conta, sem botao apagado nem alerta', () => {
		const html = render('prt_fild08');
		expect(html).toContain('cx-jor-aqui');
		expect(html).toContain('cada abate conta');
		expect(html).not.toContain('cx-jor-motivo');
		expect(html).not.toContain('Você já está neste mapa');
	});
	it('CONTROLE: em outro mapa, o botao de viagem continua', () => {
		const html = render('prontera');
		expect(html).toContain('data-viajar="prt_fild08"');
		expect(html).not.toContain('cx-jor-aqui');
	});
});
