/**
 * A JANELA "DOACAO VIA PIX" (23/09/2026).
 *
 * Tres partes:
 *  1. a metade PURA (`formatoDaDoacao.js`): faixa, total, desconto, "leve
 *     mais", reais, CPF, nome e relogio - com os numeros das faixas de hoje,
 *     que chegam do servidor (o fixture as copia de servidor/doacao/faixas.ts);
 *  2. o CONTROLADOR no jsdom, com o HTML de verdade e um relogio manual: as
 *     telas, a trava do gerar, a trava de 3 s do "Ja paguei", o sucesso e o
 *     expirado;
 *  3. a COSTURA com o RO Shop e o MapEngine, lendo o fonte (o MapEngine nao
 *     carrega no jsdom): o Recarregar abre a janela so com a recarga
 *     disponivel, a loja ignora `tipo: 'doacao'`, o 0x0fb8 continua com um
 *     dono so, e a janela entra na pilha e na limpeza da troca de personagem.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	contagemRegressiva,
	cotar,
	cpfValido,
	faixasDoEstado,
	formatarReais,
	imagemDoQrSegura,
	lerQuantidade,
	mascararCpf,
	nomeCompletoValido,
	podeGerar,
	posicaoDoSlider,
	quantidadeDoSlider,
	rotuloDaFaixa,
	textoDaDivida,
	textoDaRecusa
} from 'UI/Components/DoacaoIdle/formatoDaDoacao.js';
import { criarControladorDaDoacao, TIMEOUT_DO_GERAR_MS } from 'UI/Components/DoacaoIdle/controladorDaDoacao.js';
import { criarControlador } from 'UI/Components/RoShop/controladorDoRoShop.js';
import { estadoDaDoacao, geradaDeExemplo } from '../fixtures/doacaoEstado.js';
import { estadoDeExemplo } from '../fixtures/roShopEstado.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');
const HTML = ler('src/UI/Components/DoacaoIdle/DoacaoIdle.html');
const HTML_DO_SHOP = ler('src/UI/Components/RoShop/RoShop.html');

/** Um CPF de exemplo com os dois verificadores certos. */
const CPF_VALIDO = '529.982.247-25';

/* ================================================================== */
/* 1. A metade pura                                                    */
/* ================================================================== */

describe('formatoDaDoacao: a cotacao pelas faixas do servidor', () => {
	const e = estadoDaDoacao();

	it('100 cash cai na faixa 100-249: R$ 0,89/un, R$ 89,00, 11% de desconto', () => {
		const c = cotar(e, 100);
		expect(c).toMatchObject({ ok: true, indice: 2, precoPorCashCentavos: 89, totalCentavos: 8900, descontoPercent: 11 });
		expect(formatarReais(c.totalCentavos)).toBe('R$ 89,00');
		expect(c.creditoMinor).toBe(10000);
		expect(c.sugestao).toBeNull();
	});

	it('99 cash: R$ 93,06, e a dica "leve 100 e pague R$ 4,06 a menos"', () => {
		const c = cotar(e, 99);
		expect(c.totalCentavos).toBe(9306);
		expect(c.sugestao).toEqual({ quantidade: 100, totalCentavos: 8900, economiaCentavos: 406 });
	});

	it('a dica escolhe a de MAIOR economia entre as faixas acima', () => {
		// 940 cash a 0,79 = 742,60; 1000 a 0,69 = 690,00 -> economiza 52,60.
		const c = cotar(e, 940);
		expect(c.sugestao).toEqual({ quantidade: 1000, totalCentavos: 69000, economiaCentavos: 5260 });
		// 700 a 0,79 = 553,00 < 690,00: levar 1000 custaria MAIS, sem dica.
		expect(cotar(e, 700).sugestao).toBeNull();
	});

	it('o preco cheio e o da PRIMEIRA faixa: 5 cash nao tem desconto', () => {
		expect(cotar(e, 5)).toMatchObject({ precoPorCashCentavos: 100, totalCentavos: 500, descontoPercent: 0 });
		expect(cotar(e, 1000).descontoPercent).toBe(31);
	});

	it('os limites do servidor valem: abaixo do minimo, acima do maximo e do teto recusam', () => {
		expect(cotar(e, 4)).toEqual({ ok: false, recusa: 'abaixo-do-minimo' });
		expect(cotar(e, 2898)).toMatchObject({ ok: true, totalCentavos: 199962 });
		expect(cotar(e, 2899)).toEqual({ ok: false, recusa: 'acima-do-maximo' });
		expect(cotar({ ...e, maximo: 5000 }, 2899)).toEqual({ ok: false, recusa: 'acima-do-teto' });
		expect(cotar(e, 0).ok).toBe(false);
		expect(cotar(e, 1.5).ok).toBe(false);
		expect(cotar({ ...e, faixas: [] }, 100)).toEqual({ ok: false, recusa: 'sem-faixas' });
	});

	it('o bonus de evento aumenta so o credito, nunca o preco', () => {
		const c = cotar({ ...e, bonusPercent: 10 }, 100);
		expect(c.totalCentavos).toBe(8900);
		expect(c.creditoMinor).toBe(11000);
	});

	it('faixa torta do fio e descartada, e a ordem e a de aPartirDe', () => {
		const f = faixasDoEstado({
			faixas: [{ aPartirDe: 50, precoPorCashCentavos: 94 }, { aPartirDe: 5, precoPorCashCentavos: 100 }, { aPartirDe: 'x' }, null]
		});
		expect(f.map(x => x.aPartirDe)).toEqual([5, 50]);
	});

	it('o rotulo da faixa: "100 – 249" e a ultima ate o maximo', () => {
		const f = faixasDoEstado(e);
		expect(rotuloDaFaixa(f, 2, 2898)).toBe('100 – 249');
		expect(rotuloDaFaixa(f, 5, 2898)).toBe('1.000 – 2.898');
		expect(rotuloDaFaixa(f, 5)).toBe('1.000+');
	});
});

describe('formatoDaDoacao: campos e textos', () => {
	it('a mascara de CPF e progressiva e so aceita digitos', () => {
		expect(mascararCpf('529')).toBe('529');
		expect(mascararCpf('5299')).toBe('529.9');
		expect(mascararCpf('5299822')).toBe('529.982.2');
		expect(mascararCpf('52998224725')).toBe('529.982.247-25');
		expect(mascararCpf('529.982.247-25999')).toBe('529.982.247-25');
		expect(mascararCpf('ab5c2')).toBe('52');
	});

	it('o CPF confere os dois verificadores e recusa sequencia repetida', () => {
		expect(cpfValido(CPF_VALIDO)).toBe(true);
		expect(cpfValido('529.982.247-24')).toBe(false);
		expect(cpfValido('111.111.111-11')).toBe(false);
		expect(cpfValido('529.982.247')).toBe(false);
	});

	it('o nome completo pede duas palavras de letras', () => {
		expect(nomeCompletoValido('Guilherme Andrade')).toBe(true);
		expect(nomeCompletoValido('  João   da  Silva ')).toBe(true);
		expect(nomeCompletoValido("D'Ávila Souza-Lima")).toBe(true);
		expect(nomeCompletoValido('Guilherme')).toBe(false);
		expect(nomeCompletoValido('Ana 2')).toBe(false);
		expect(nomeCompletoValido('A B')).toBe(false);
	});

	it('a quantidade digitada: so digitos, sem zero a esquerda, presa no maximo', () => {
		expect(lerQuantidade('0120', 2898)).toBe(120);
		expect(lerQuantidade('12a3', 2898)).toBe(123);
		expect(lerQuantidade('99999', 2898)).toBe(2898);
		expect(lerQuantidade('', 2898)).toBeNull();
	});

	it('podeGerar so com tudo: cotacao, nome, CPF valido, aceite e disponivel', () => {
		const base = { cotacao: cotar(estadoDaDoacao(), 100), nome: 'Ana Souza', cpf: CPF_VALIDO, aceite: true, disponivel: true };
		expect(podeGerar(base)).toBe(true);
		expect(podeGerar({ ...base, aceite: false })).toBe(false);
		expect(podeGerar({ ...base, nome: 'Ana' })).toBe(false);
		expect(podeGerar({ ...base, cpf: '529.982.247' })).toBe(false);
		expect(podeGerar({ ...base, disponivel: false })).toBe(false);
		expect(podeGerar({ ...base, cotacao: cotar(estadoDaDoacao(), 3) })).toBe(false);
	});

	it('o slider e quadratico: as pontas sao o minimo e o maximo exatos, e 100 fica visivel', () => {
		expect(quantidadeDoSlider(0, 5, 2898)).toBe(5);
		expect(quantidadeDoSlider(1000, 5, 2898)).toBe(2898);
		expect(posicaoDoSlider(100, 5, 2898)).toBeGreaterThan(150);
		expect(posicaoDoSlider(99, 5, 2898)).toBeLessThan(posicaoDoSlider(100, 5, 2898) + 1);
		for (const q of [5, 50, 100, 250, 1000, 2898]) {
			expect(Math.abs(quantidadeDoSlider(posicaoDoSlider(q, 5, 2898), 5, 2898) - q)).toBeLessThanOrEqual(3);
		}
	});

	it('o relogio: "29:41", nunca negativo, e hora quando passa de 60 min', () => {
		expect(contagemRegressiva((29 * 60 + 41) * 1000)).toBe('29:41');
		expect(contagemRegressiva(1)).toBe('00:01');
		expect(contagemRegressiva(-500)).toBe('00:00');
		expect(contagemRegressiva(3723000)).toBe('1:02:03');
	});

	it('a recusa do servidor ganha acento pelo codigo; codigo novo cai no texto dele', () => {
		expect(textoDaRecusa({ recusa: 'cpf-invalido', texto: 'CPF invalido. Confira os numeros.' })).toBe(
			'CPF inválido. Confira os números.'
		);
		expect(textoDaRecusa({ recusa: 'nova-recusa', texto: 'Algo novo.' })).toBe('Algo novo.');
		expect(textoDaRecusa({})).toMatch(/Não foi possível/);
	});

	it('a divida: o aviso so aparece com divida positiva', () => {
		expect(textoDaDivida(0)).toBe('');
		expect(textoDaDivida(700)).toBe(
			'Você tem uma dívida de 7,00 RO Cash por um estorno. A próxima doação paga a dívida primeiro.'
		);
	});

	it('a imagem do QR so passa como data URI de imagem', () => {
		expect(imagemDoQrSegura('data:image/svg+xml;base64,AAAA')).toBe('data:image/svg+xml;base64,AAAA');
		expect(imagemDoQrSegura('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
		expect(imagemDoQrSegura('https://exemplo.com/qr.png')).toBeNull();
		expect(imagemDoQrSegura('javascript:alert(1)')).toBeNull();
		expect(imagemDoQrSegura(null)).toBeNull();
	});
});

/* ================================================================== */
/* 2. O controlador                                                    */
/* ================================================================== */

function relogio() {
	let id = 0;
	let agora = 1_000_000;
	const fila = new Map();
	return {
		agora: () => agora,
		agendar: (fn, ms) => {
			id += 1;
			fila.set(id, { fn, quando: agora + ms });
			return id;
		},
		cancelar: i => fila.delete(i),
		/** Avanca o relogio e dispara o que venceu, em ordem. */
		andar: ms => {
			const alvo = agora + ms;
			for (;;) {
				const proximo = [...fila.entries()].filter(([, t]) => t.quando <= alvo).sort((a, b) => a[1].quando - b[1].quando)[0];
				if (!proximo) {
					break;
				}
				fila.delete(proximo[0]);
				agora = proximo[1].quando;
				proximo[1].fn();
			}
			agora = alvo;
		}
	};
}

function montar() {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	const r = relogio();
	const copias = [];
	const c = criarControladorDaDoacao({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		agora: r.agora,
		agendar: r.agendar,
		cancelar: r.cancelar,
		copiar: texto => {
			copias.push(texto);
			return Promise.resolve();
		}
	});
	const $ = sel => raiz.querySelector(sel);
	const clicar = sel => {
		const el = typeof sel === 'string' ? $(sel) : sel;
		expect(el, `nao achei ${sel}`).not.toBeNull();
		return c.onClick({ target: el });
	};
	const digitar = (campo, valor, tipo = 'input') => {
		const el = $(`[data-dc-campo="${campo}"]`);
		if (el.type === 'checkbox') {
			el.checked = valor;
		} else {
			el.value = valor;
		}
		c.onInput({ target: el, type: tipo });
	};
	const preencher = () => {
		digitar('nome', 'Ana Souza');
		digitar('cpf', '52998224725');
		digitar('aceite', true);
	};
	return { raiz, c, enviados, r, $, clicar, digitar, preencher, copias };
}

let t;
beforeEach(() => {
	document.body.innerHTML = '';
	t = montar();
	t.c.abrir();
});

describe('a janela: abrir e escolher', () => {
	it('abrir pede o estado da doacao, e so isso', () => {
		expect(t.enviados).toEqual([{ acao: 'doacao-estado' }]);
		expect(t.$('.dc-carregando')).not.toBeNull();
	});

	it('o estado desenha as SEIS faixas, com 100 marcada e a mais barata em ouro', () => {
		t.c.receber(estadoDaDoacao());
		const faixas = [...t.raiz.querySelectorAll('.dc-faixa')];
		expect(faixas).toHaveLength(6);
		expect(faixas[2].classList.contains('is-atual')).toBe(true);
		expect(faixas[2].textContent).toContain('100 – 249');
		expect(faixas[2].textContent).toContain('R$ 0,89');
		expect(faixas[5].classList.contains('is-melhor')).toBe(true);
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('100');
		expect(t.$('.dc-resumo').textContent).toContain('Faixa (100–249)');
		expect(t.$('.dc-total strong').textContent).toBe('R$ 89,00');
		expect(t.$('.dc-economia').textContent).toBe('Você economiza 11%');
	});

	it('os atalhos respeitam o maximo, e as pilulas acima dele nao aparecem', () => {
		t.c.receber(estadoDaDoacao({ maximo: 600 }));
		const q = [...t.raiz.querySelectorAll('[data-dc="atalho"]')].map(b => Number(b.dataset.quantidade));
		expect(q).toEqual([10, 50, 100, 250, 500]);
	});

	it('com 99 aparece "Leve 100", e o botao ajusta a quantidade', () => {
		t.c.receber(estadoDaDoacao());
		t.digitar('quantidade', '99');
		expect(t.$('.dc-total strong').textContent).toBe('R$ 93,06');
		expect(t.$('.dc-leve').textContent).toContain('Leve 100 e pague R$ 4,06 a menos!');
		t.clicar('[data-dc="levar"]');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('100');
		expect(t.$('.dc-total strong').textContent).toBe('R$ 89,00');
		expect(t.$('.dc-leve')).toBeNull();
	});

	it('menos/mais andam de um em um e param nos limites', () => {
		t.c.receber(estadoDaDoacao());
		t.clicar('[data-dc="menos"]');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('99');
		t.clicar('[data-dc="atalho"][data-quantidade="10"]');
		t.digitar('quantidade', '5');
		t.clicar('[data-dc="menos"]');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('5');
		t.digitar('quantidade', '99999');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('2898');
		t.clicar('[data-dc="mais"]');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('2898');
	});

	it('o slider e o campo andam juntos', () => {
		t.c.receber(estadoDaDoacao());
		t.digitar('slider', '1000');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('2898');
		t.digitar('slider', '0');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('5');
		t.digitar('quantidade', '500');
		expect(Number(t.$('[data-dc-campo="slider"]').value)).toBe(posicaoDoSlider(500, 5, 2898));
		t.digitar('slider', String(posicaoDoSlider(500, 5, 2898)));
		expect(Math.abs(Number(t.$('[data-dc-campo="quantidade"]').value) - 500)).toBeLessThanOrEqual(3);
	});

	it('quantidade abaixo do minimo avisa e, ao sair do campo, sobe ao minimo', () => {
		t.c.receber(estadoDaDoacao());
		t.digitar('quantidade', '3');
		expect(t.$('.dc-resumo').textContent).toContain('mínima é de 5 RO Cash');
		t.digitar('quantidade', '3', 'change');
		expect(t.$('[data-dc-campo="quantidade"]').value).toBe('5');
	});

	it('o botao so acende com nome de duas palavras, CPF valido e o aceite', () => {
		t.c.receber(estadoDaDoacao());
		const gerar = () => t.$('[data-dc="gerar"]');
		expect(gerar().disabled).toBe(true);
		t.digitar('nome', 'Ana');
		t.digitar('cpf', '52998224725');
		t.digitar('aceite', true);
		expect(t.$('[data-dc-campo="cpf"]').value).toBe(CPF_VALIDO);
		expect(gerar().disabled).toBe(true);
		t.digitar('nome', 'Ana Souza');
		expect(gerar().disabled).toBe(false);
		t.digitar('aceite', false);
		expect(gerar().disabled).toBe(true);
		t.digitar('aceite', true);
		t.digitar('cpf', '52998224724');
		expect(gerar().disabled).toBe(true);
		expect(t.$('[data-dc-regiao="erro-cpf"]').textContent).toBe('CPF inválido. Confira os números.');
	});

	it('o aceite traz os dois links, abrindo em aba nova', () => {
		t.c.receber(estadoDaDoacao());
		const links = [...t.raiz.querySelectorAll('.dc-aceite a')];
		expect(links.map(a => [a.textContent, a.href, a.target])).toEqual([
			['Termos de Uso', 'https://roclassicidle.com.br/termos.html', '_blank'],
			['Política de Privacidade', 'https://roclassicidle.com.br/privacidade.html', '_blank']
		]);
	});

	it('divida > 0 mostra o aviso do estorno', () => {
		t.c.receber(estadoDaDoacao({ dividaMinor: 1250 }));
		expect(t.$('.dc-alerta--divida').textContent).toBe(
			'Você tem uma dívida de 12,50 RO Cash por um estorno. A próxima doação paga a dívida primeiro.'
		);
	});

	it('indisponivel: a janela diz e nao oferece o formulario', () => {
		t.c.receber(estadoDaDoacao({ disponivel: false }));
		expect(t.$('.dc-recado-texto').textContent).toContain('indisponível');
		expect(t.$('[data-dc="gerar"]')).toBeNull();
	});

	it('digitar nao refaz o formulario (o foco e o cursor ficam)', () => {
		t.c.receber(estadoDaDoacao());
		const nome = t.$('[data-dc-campo="nome"]');
		t.digitar('nome', 'Ana Sou');
		t.c.receber(estadoDaDoacao());
		expect(t.$('[data-dc-campo="nome"]')).toBe(nome);
		expect(nome.value).toBe('Ana Sou');
	});

	it('mensagem que nao e da doacao e ignorada', () => {
		expect(t.c.receber({ versao: 1, tipo: 'estado' })).toBe(false);
		expect(t.c.receber(null)).toBe(false);
		expect(t.$('.dc-carregando')).not.toBeNull();
	});
});

describe('a janela: gerar, pagar e confirmar', () => {
	function ateOGerar() {
		t.c.receber(estadoDaDoacao());
		t.preencher();
		t.clicar('[data-dc="gerar"]');
	}

	it('gerar manda quantidade, nome aparado e o CPF so em digitos - e trava o clique duplo', () => {
		t.c.receber(estadoDaDoacao());
		t.digitar('nome', '  Ana   Souza ');
		t.digitar('cpf', '52998224725');
		t.digitar('aceite', true);
		t.clicar('[data-dc="gerar"]');
		t.clicar('[data-dc="gerar"]');
		const gerados = t.enviados.filter(e => e.acao === 'doacao-gerar');
		expect(gerados).toEqual([{ acao: 'doacao-gerar', quantidade: 100, nome: 'Ana Souza', cpf: '52998224725' }]);
		expect(t.$('[data-dc="gerar"]').disabled).toBe(true);
		expect(t.$('[data-dc="gerar"]').textContent).toBe('Gerando…');
	});

	it('sem resposta em 15 s a trava abre e avisa', () => {
		ateOGerar();
		t.r.andar(TIMEOUT_DO_GERAR_MS);
		expect(t.$('[data-dc="gerar"]').disabled).toBe(false);
		expect(t.$('.dc-erro').textContent).toContain('não respondeu');
	});

	it('recusa: o texto (com acento) aparece e o formulario fica', () => {
		ateOGerar();
		t.c.receber({ tipo: 'doacao', acao: 'doacao-gerar', ok: false, recusa: 'codigos-demais', texto: 'sem acento' });
		expect(t.$('.dc-erro').textContent).toBe(
			'Você já tem códigos PIX abertos. Pague um deles ou espere expirar (30 minutos).'
		);
		expect(t.$('[data-dc-campo="nome"]').value).toBe('Ana Souza');
		expect(t.$('[data-dc="gerar"]').disabled).toBe(false);
	});

	it('aceito: a tela do pagamento traz QR, copia-e-cola, total e o relogio', () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		expect(t.$('.dc-qr').getAttribute('src')).toBe(g.imagemQrcode);
		expect(t.$('.dc-copia').value).toBe(g.copiaECola);
		expect(t.$('.dc-pag-info').textContent).toContain('R$ 89,00');
		expect(t.$('.dc-pag-info').textContent).toContain('100,00 RO Cash');
		expect(t.$('[data-dc-regiao="relogio"]').textContent).toBe('29:41');
		t.r.andar(1000);
		expect(t.$('[data-dc-regiao="relogio"]').textContent).toBe('29:40');
		/* O estado que desce logo atras do gerar nao tira o jogador do pagamento. */
		t.c.receber(estadoDaDoacao());
		expect(t.$('.dc-qr')).not.toBeNull();
	});

	it('QR que nao e data URI de imagem nao vira <img>', () => {
		ateOGerar();
		t.c.receber(geradaDeExemplo(t.r.agora(), { imagemQrcode: 'https://mal.example/qr.png' }));
		expect(t.$('.dc-qr')).toBeNull();
		expect(t.$('.dc-copia')).not.toBeNull();
	});

	it('Copiar poe o copia-e-cola na area de transferencia', async () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		t.clicar('[data-dc="copiar"]');
		await Promise.resolve();
		await Promise.resolve();
		expect(t.copias).toEqual([g.copiaECola]);
	});

	it('"Ja paguei" pergunta o status e fica travado por 3 s', () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		t.clicar('[data-dc="ja-paguei"]');
		t.clicar('[data-dc="ja-paguei"]');
		expect(t.enviados.filter(e => e.acao === 'doacao-status')).toEqual([{ acao: 'doacao-status', txid: g.txid }]);
		expect(t.$('[data-dc="ja-paguei"]').disabled).toBe(true);
		t.c.receber({ tipo: 'doacao', acao: 'doacao-status', txid: g.txid, estado: 'pendente' });
		expect(t.$('.dc-recado').textContent).toContain('Ainda não recebemos');
		t.r.andar(3000);
		expect(t.$('[data-dc="ja-paguei"]').disabled).toBe(false);
		t.clicar('[data-dc="ja-paguei"]');
		expect(t.enviados.filter(e => e.acao === 'doacao-status')).toHaveLength(2);
	});

	it('status creditado leva ao sucesso', () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		t.c.receber({ tipo: 'doacao', acao: 'doacao-status', txid: g.txid, estado: 'creditada' });
		expect(t.$('.dc-sucesso-titulo').textContent).toBe('Obrigado pelo apoio!');
		expect(t.$('.dc-sucesso .dc-recado-texto').textContent).toBe('+100,00 RO Cash na sua carteira.');
	});

	it('status de OUTRO txid nao mexe na tela', () => {
		ateOGerar();
		t.c.receber(geradaDeExemplo(t.r.agora()));
		t.c.receber({ tipo: 'doacao', acao: 'doacao-status', txid: 'OUTRO', estado: 'creditada' });
		expect(t.$('.dc-qr')).not.toBeNull();
	});

	it('doacao-confirmada chega sozinha e mostra o credito dela', () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		t.c.receber({ tipo: 'doacao', acao: 'doacao-confirmada', txid: g.txid, quantidade: 100, creditoMinor: 11000 });
		expect(t.$('.dc-sucesso .dc-recado-texto').textContent).toBe('+110,00 RO Cash na sua carteira.');
	});

	it('o relogio zera: "O codigo expirou", e o botao volta a escolher', () => {
		ateOGerar();
		t.c.receber(geradaDeExemplo(t.r.agora(), { expiraEmMs: t.r.agora() + 2500 }));
		t.r.andar(3000);
		expect(t.$('.dc-recado-texto').textContent).toBe('O código expirou. Gere um novo.');
		t.clicar('[data-dc="nova-doacao"]');
		expect(t.$('[data-dc="gerar"]')).not.toBeNull();
		expect(t.enviados.at(-1)).toEqual({ acao: 'doacao-estado' });
	});

	it('Voltar leva a escolha e pede o estado (o codigo aberto vira "Retomar")', () => {
		ateOGerar();
		t.c.receber(geradaDeExemplo(t.r.agora()));
		t.clicar('[data-dc="voltar"]');
		expect(t.enviados.at(-1)).toEqual({ acao: 'doacao-estado' });
		t.c.receber(
			estadoDaDoacao({
				abertos: [{ txid: 'TX1', quantidade: 100, totalCentavos: 8900, expiraEmMs: t.r.agora() + 600000 }]
			})
		);
		expect(t.$('.dc-abertos').textContent).toContain('R$ 89,00');
		expect(t.$('.dc-abertos').textContent).toContain('expira em 10:00');
		t.clicar('[data-dc="retomar"]');
		/* Retomado: total e expiracao, sem copia-e-cola (o estado nao o traz). */
		expect(t.$('.dc-copia')).toBeNull();
		expect(t.$('.dc-nota').textContent).toContain('gere outro');
		expect(t.$('[data-dc-regiao="relogio"]').textContent).toBe('10:00');
		t.clicar('[data-dc="ja-paguei"]');
		expect(t.enviados.at(-1)).toEqual({ acao: 'doacao-status', txid: 'TX1' });
	});

	it('fechar depois do sucesso: reabrir volta a escolher', () => {
		ateOGerar();
		const g = geradaDeExemplo(t.r.agora());
		t.c.receber(g);
		t.c.receber({ tipo: 'doacao', acao: 'doacao-confirmada', txid: g.txid, quantidade: 100, creditoMinor: 10000 });
		t.c.fechar();
		t.c.abrir();
		expect(t.$('[data-dc="gerar"]')).not.toBeNull();
	});

	it('limpar (troca de personagem) apaga nome, CPF e o pagamento', () => {
		ateOGerar();
		t.c.receber(geradaDeExemplo(t.r.agora()));
		t.c.limpar();
		const s = t.c.estadoDaTela;
		expect(s).toMatchObject({ nome: '', cpf: '', pagamento: null, tela: 'carregando', estado: null });
	});
});

/* ================================================================== */
/* 3. A costura                                                        */
/* ================================================================== */

describe('a costura com o RO Shop', () => {
	function lojaCom(recarga) {
		const raiz = document.createElement('div');
		raiz.innerHTML = HTML_DO_SHOP;
		document.body.appendChild(raiz);
		const enviados = [];
		const aberturas = [];
		const c = criarControlador({
			raiz,
			enviar: corpo => enviados.push(corpo),
			gerarChave: () => 'k',
			abrirDoacao: () => aberturas.push(1),
			resolverIcone: (_id, _ok, falha) => falha(),
			agendar: () => 0,
			cancelar: () => {}
		});
		c.abrir();
		c.receber(estadoDeExemplo({ recarga }));
		return { raiz, c, enviados, aberturas };
	}

	it('com a recarga DISPONIVEL o Recarregar abre a doacao, sem pacote', () => {
		const l = lojaCom({ disponivel: true, texto: 'Doe via PIX e receba RO Cash na hora.' });
		const antes = l.enviados.length;
		l.c.onClick({ target: l.raiz.querySelector('[data-rs="recarregar"]') });
		expect(l.aberturas).toHaveLength(1);
		expect(l.enviados.length).toBe(antes);
	});

	it('sem recarga o Recarregar so mostra o texto do servidor', () => {
		const l = lojaCom({ disponivel: false, texto: 'A recarga ainda não está disponível.' });
		l.c.onClick({ target: l.raiz.querySelector('[data-rs="recarregar"]') });
		expect(l.aberturas).toHaveLength(0);
		expect(l.raiz.querySelector('.rs-aviso').textContent).toBe('A recarga ainda não está disponível.');
	});

	it('a loja IGNORA as mensagens tipo "doacao" (nem com versao 1)', () => {
		const l = lojaCom({ disponivel: true, texto: 'x' });
		const antes = l.raiz.innerHTML;
		l.c.receber({ tipo: 'doacao', acao: 'doacao-estado', versao: 1, disponivel: true });
		l.c.receber({ tipo: 'doacao', acao: 'doacao-confirmada', txid: 't', creditoMinor: 100 });
		expect(l.raiz.innerHTML).toBe(antes);
	});

	it('o RoShop.js e o dono do 0x0fb8 e repassa "doacao" pela ponte, antes do controlador', () => {
		const fonte = ler('src/UI/Components/RoShop/RoShop.js');
		const repasse = fonte.indexOf("dados.tipo === 'doacao'");
		expect(repasse).toBeGreaterThan(-1);
		expect(fonte.indexOf('RoShop.aoDoacao(dados)', repasse)).toBeGreaterThan(repasse);
		expect(fonte.indexOf('c.receber(dados)', repasse)).toBeGreaterThan(fonte.indexOf('RoShop.aoDoacao(dados)'));
		expect(fonte).toMatch(/abrirDoacao: \(\) => \{\s*if \(typeof RoShop\.aoAbrirDoacao === 'function'\)/);
	});

	it('a DoacaoIdle NAO fisga pacote (fisgar o 0x0fb8 roubaria o da loja)', () => {
		const fonte = ler('src/UI/Components/DoacaoIdle/DoacaoIdle.js');
		expect(fonte).not.toMatch(/Network\.hookPacket\(/);
		expect(fonte).toMatch(/new PACKET\.CZ\.RAGIDLE_ROSHOP\(\)/);
	});
});

describe('a costura com o MapEngine', () => {
	const mapa = ler('src/Engine/MapEngine.js');

	it('a janela entra na pilha (moldura de celular, ESC, uma por vez)', () => {
		expect(mapa).toContain("['doacao', DoacaoIdle, '.dc-window'],");
		const pilha = mapa.indexOf("['doacao', DoacaoIdle, '.dc-window']");
		expect(mapa.lastIndexOf('for (const [nome, componente, seletor] of [', pilha)).toBeGreaterThan(-1);
	});

	it('as duas pontes do RO Shop estao ligadas a ela', () => {
		expect(mapa).toContain('RoShop.aoAbrirDoacao = () => DoacaoIdle.abrir();');
		expect(mapa).toContain('RoShop.aoDoacao = dados => DoacaoIdle.receber(dados);');
	});

	it('prepare, append e a limpeza da troca de personagem', () => {
		expect(mapa).toContain('DoacaoIdle.prepare();');
		expect(mapa).toContain('DoacaoIdle.append();');
		const limpeza = mapa.indexOf('modulo.limparEstadoDoPersonagem()');
		const lista = mapa.lastIndexOf('for (const modulo of [', limpeza);
		expect(mapa.slice(lista, limpeza)).toMatch(/\bDoacaoIdle,/);
	});

	it('o append vem DEPOIS do CZ_NOTIFY_ACTORINIT (aviso D-993)', () => {
		expect(mapa.indexOf('DoacaoIdle.append();')).toBeGreaterThan(mapa.indexOf('new PACKET.CZ.NOTIFY_ACTORINIT()'));
	});

	it('a janela carrega .ri-window (a regra de painel do celular a alcanca)', () => {
		expect(HTML).toMatch(/class="dc-window ri-window ri-anima"/);
	});
});
