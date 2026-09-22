/**
 * RO SHOP, RODADA 2 (22/09/2026) - as decisoes do dono que viraram tela, e os
 * riscos da QA que cabem ao cliente.
 *
 * Mesmo aparelho de `roShop.test.js`: o HTML de verdade, o controlador de
 * verdade, `enviar` falso e relogio manual. O estado e o de exemplo fiel ao
 * contrato da rodada 2 (`tests/fixtures/roShopEstado.js`, CONTRATO.md do
 * servidor 06e5e71c).
 *
 *  - Troca de Nome e Troca de Aparencia: formulario, `parametros`, chave presa
 *    aos parametros, `parametrosRecusados`, `requerRelog`, `desequipados`;
 *  - "X de Y" das cartas de conta (`estado.conta`);
 *  - P1-02: UMA fonte de saldo (`Utils/saldoDeCash.js`) entre RO Shop,
 *    Temporada, Passe e HUD;
 *  - as vagas da conta na selecao de personagem (`vagasDaSelecao.js`);
 *  - a caixa do modal da Temporada por cima do fundo no celular.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarControlador, TIMEOUT_MS } from 'UI/Components/RoShop/controladorDoRoShop.js';
import {
	contadorDaConta,
	limitesDoServico,
	normalizarNome,
	parametrosDoServico,
	servicosHtml
} from 'UI/Components/RoShop/formatoDoRoShop.js';
import { saldoParaMostrar } from 'UI/Components/TemporadaIdle/formatoDaTemporada.js';
import {
	assinarSaldoDeCash,
	esquecerSaldoDeCash,
	publicarSaldoDeCash,
	saldoDeCashConhecido
} from 'Utils/saldoDeCash.js';
import Session from 'Engine/SessionStorage.js';
import {
	aplicarVagas,
	podeCriarNaVaga,
	textoDasVagas,
	vagaDoCursor,
	vagasDaConta,
	VAGAS_DESENHAVEIS
} from 'UI/Components/CharSelect/vagasDaSelecao.js';
import { completarFicha } from 'DB/Items/FichaDoItem.js';
import StatusInfo from 'DB/Status/StatusInfo.js';
import { emPortugues } from 'DB/Status/StatusInfoPtBr.js';
import { DESCRICOES_LOCAIS, NOMES_LOCAIS } from 'DB/Items/nomesLocais.js';
import { estadoDeExemplo } from '../fixtures/roShopEstado.js';

const SRC = join(process.cwd(), 'src');
const ler = p => readFileSync(join(SRC, ...p.split('/')), 'utf8');
const HTML = ler('UI/Components/RoShop/RoShop.html');

function relogio() {
	let id = 0;
	const fila = new Map();
	return {
		agendar: (fn, ms) => {
			id += 1;
			fila.set(id, { fn, ms });
			return id;
		},
		cancelar: i => fila.delete(i),
		disparar: minimo => {
			[...fila.entries()].forEach(([i, t]) => {
				if (t.ms >= minimo) {
					fila.delete(i);
					t.fn();
				}
			});
		}
	};
}

function montar(opcoes = {}) {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const enviados = [];
	const saldos = [];
	const r = relogio();
	let n = 0;
	const c = criarControlador({
		raiz,
		enviar: corpo => enviados.push(JSON.parse(JSON.stringify(corpo))),
		gerarChave: () => `chave-${++n}`,
		resolverIcone: (_id, _ok, falha) => falha(),
		agendar: r.agendar,
		cancelar: r.cancelar,
		aoSaldo: minor => saldos.push(minor),
		...opcoes
	});
	const $ = sel => raiz.querySelector(sel);
	const clicar = seletor => {
		const el = typeof seletor === 'string' ? $(seletor) : seletor;
		expect(el, `nao achei ${seletor}`).not.toBeNull();
		return c.onClick({ target: el });
	};
	/* Digitar como o navegador: muda o value e dispara o `input` que o
	   RoShop.js repassa ao controlador. */
	const digitar = (seletor, valor) => {
		const el = $(seletor);
		expect(el, `nao achei ${seletor}`).not.toBeNull();
		el.value = valor;
		c.onInput({ target: el });
		return el;
	};
	return { raiz, c, enviados, saldos, relogio: r, clicar, digitar, $ };
}

let t;
beforeEach(() => {
	document.body.innerHTML = '';
	esquecerSaldoDeCash();
	t = montar();
	t.c.abrir();
	t.c.receber(estadoDeExemplo());
	t.enviados.length = 0;
});

const usarBotao = t => t.$('[data-rs="confirmar-servico"]');

describe('Seus servicos: cada credito na categoria do SKU', () => {
	it('Utilidades lista os resets; Conta lista as duas trocas', () => {
		t.clicar('[data-categoria="utilidades"]');
		const util = [...t.raiz.querySelectorAll('.rs-servico')].map(l => l.textContent);
		expect(util).toHaveLength(1);
		expect(util[0]).toContain('Reset de Skills');
		t.clicar('[data-categoria="conta"]');
		const conta = [...t.raiz.querySelectorAll('.rs-servico')].map(l => l.textContent);
		expect(conta.map(x => x.replace(/\s+/g, ' '))).toEqual([
			expect.stringContaining('Troca de Nome'),
			expect.stringContaining('Alteração Visual/Sexo')
		]);
	});

	it('servicosHtml sem categoria lista todos os que tem credito (a forma da rodada 1)', () => {
		const html = servicosHtml(estadoDeExemplo());
		expect(html).toContain('Reset de Skills');
		expect(html).toContain('Troca de Nome');
		expect(html).not.toContain('Reset de Status'); // 0 creditos
	});
});

describe('Troca de Nome', () => {
	beforeEach(() => {
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-nome"]');
	});

	it('abre o formulario com o nome atual, o campo de 23 e o Usar apagado', () => {
		const modal = t.$('.rs-modal--servico');
		expect(modal.hidden).toBe(false);
		expect(modal.textContent).toContain('Nome atual: Jhow');
		const campo = t.$('[data-rs-campo="novoNome"]');
		expect(campo.getAttribute('maxlength')).toBe('23');
		expect(usarBotao(t).disabled).toBe(true);
		expect(t.enviados).toEqual([]);
	});

	it('so acende com 4 a 23 caracteres, e manda o nome NORMALIZADO em `parametros`', () => {
		t.digitar('[data-rs-campo="novoNome"]', 'Abc');
		expect(usarBotao(t).disabled).toBe(true);
		t.digitar('[data-rs-campo="novoNome"]', '  Novo   Nome  ');
		expect(usarBotao(t).disabled).toBe(false);
		t.clicar('[data-rs="confirmar-servico"]');
		t.clicar('[data-rs="confirmar-servico"]'); // clique duplo
		expect(t.enviados).toEqual([
			{ acao: 'usar-servico', chave: 'chave-1', servico: 'troca-de-nome', parametros: { novoNome: 'Novo Nome' } }
		]);
	});

	it('com o botao ligado por fora (DOM defasado), nome invalido AINDA nao sai: o controlador confere', () => {
		t.digitar('[data-rs-campo="novoNome"]', 'Ab');
		const btn = usarBotao(t);
		btn.disabled = false;
		t.clicar(btn);
		expect(t.enviados).toEqual([]);
		expect(t.$('.rs-aviso').textContent).toContain('de 4 a 23 caracteres');
	});

	it('digitar NAO redesenha o formulario (o campo e o mesmo elemento, com o cursor)', () => {
		const antes = t.digitar('[data-rs-campo="novoNome"]', 'Aur');
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.c.receber(estadoDeExemplo()); // um estado novo no meio da digitacao
		t.c.atualizarSaldo(12345); // e um saldo novo
		const depois = t.$('[data-rs-campo="novoNome"]');
		expect(depois).toBe(antes);
		expect(depois.value).toBe('Aurora');
	});

	it('sem resposta em 10 s reenvia a MESMA chave; nome trocado depois disso e OUTRO pedido', () => {
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.clicar('[data-rs="confirmar-servico"]');
		t.relogio.disparar(TIMEOUT_MS);
		t.clicar('[data-rs="confirmar-servico"]');
		t.relogio.disparar(TIMEOUT_MS);
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora Boreal');
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados.map(e => [e.chave, e.parametros.novoNome])).toEqual([
			['chave-1', 'Aurora'],
			['chave-1', 'Aurora'],
			['chave-2', 'Aurora Boreal']
		]);
	});

	it('recusa: o texto do servidor, e "Corrigir" volta ao campo com a frase do motivo; mexer apaga a frase', () => {
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: false,
			chave: 'chave-1',
			motivo: 'parametros-invalidos',
			texto: 'Este nome já está em uso. Escolha outro.',
			parametrosRecusados: { novoNome: 'em-uso' }
		});
		const modal = t.$('.rs-modal--servico');
		expect(modal.textContent).toContain('Este nome já está em uso. Escolha outro.');
		t.clicar('[data-rs="voltar-servico"]');
		const campo = t.$('[data-rs-campo="novoNome"]');
		expect(campo.value).toBe('Aurora');
		expect(campo.classList.contains('is-invalido')).toBe(true);
		expect(t.$('[data-rs-erro="novoNome"]').textContent).toBe('Este nome já está em uso.');
		t.digitar('[data-rs-campo="novoNome"]', 'Aurorinha');
		expect(t.$('[data-rs-erro="novoNome"]')).toBeNull();
		expect(t.$('[data-rs-campo="novoNome"]').classList.contains('is-invalido')).toBe(false);
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados.map(e => e.chave)).toEqual(['chave-1', 'chave-2']);
	});

	it('ok com `requerRelog: true` avisa que a mudanca aparece ao entrar de novo; `false` nao avisa', () => {
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-1',
			servico: 'troca-de-nome',
			repetido: false,
			texto: 'Seu personagem agora se chama Aurora.',
			creditosRestantes: 0,
			requerRelog: true,
			desequipados: []
		});
		const modal = t.$('.rs-modal--servico');
		expect(modal.textContent).toContain('Seu personagem agora se chama Aurora.');
		expect(modal.querySelector('.rs-relog').textContent).toContain('aparece quando você entrar de novo');

		t.clicar('[data-rs="fechar-servico"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-nome"]');
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-2',
			texto: 'Feito.',
			requerRelog: false
		});
		expect(t.$('.rs-modal--servico .rs-relog')).toBeNull();
	});
});

describe('Alteracao Visual/Sexo', () => {
	beforeEach(() => {
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-aparencia"]');
	});

	it('mostra Manter / Masculino (atual) / Feminino, as faixas do servidor e o aviso de Bardo/Odalisca', () => {
		const opcoes = [...t.raiz.querySelectorAll('[data-rs="aparencia-sexo"] .rs-opcao-rotulo')].map(b => b.textContent);
		expect(opcoes).toEqual(['Manter', 'Masculino', 'Feminino']);
		/* o sexo atual do personagem logado (`personagem.sexo: 1`) vem marcado */
		expect(t.$('[data-rs="aparencia-sexo"][data-valor="1"] .rs-opcao-atual').textContent).toBe('atual');
		expect(t.$('[data-rs="aparencia-sexo"][data-valor="0"] .rs-opcao-atual')).toBeNull();
		/* Uma opcao marcada so: "Manter" (e nao o Feminino junto - Number(null) e 0). */
		const marcadas = () =>
			[...t.raiz.querySelectorAll('[data-rs="aparencia-sexo"][aria-pressed="true"]')].map(b => b.dataset.valor);
		expect(marcadas()).toEqual(['']);
		t.clicar('[data-rs="aparencia-sexo"][data-valor="0"]');
		expect(marcadas()).toEqual(['0']);
		t.clicar('[data-rs="aparencia-sexo"][data-valor=""]');
		expect(marcadas()).toEqual(['']);
		const modal = t.$('.rs-modal--servico');
		expect(modal.textContent).toContain('0 a 27');
		expect(modal.textContent).toContain('0 a 8');
		expect(t.$('[data-rs-campo="cabelo"]').getAttribute('placeholder')).toBe('Atual: 5');
		expect(modal.textContent).toContain('Bardo, Odalisca');
		expect(usarBotao(t).disabled).toBe(true); // nada escolhido
	});

	it('manda SO o que foi escolhido (o vazio e "manter")', () => {
		t.clicar('[data-rs="aparencia-sexo"][data-valor="0"]');
		expect(usarBotao(t).disabled).toBe(false);
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados).toEqual([
			{ acao: 'usar-servico', chave: 'chave-1', servico: 'troca-de-aparencia', parametros: { sexo: 0 } }
		]);
	});

	it('cabelo fora da faixa do servidor nao sai; dentro sai sem o sexo', () => {
		t.digitar('[data-rs-campo="cabelo"]', '28');
		expect(usarBotao(t).disabled).toBe(true);
		t.digitar('[data-rs-campo="cabelo"]', '12');
		t.digitar('[data-rs-campo="corDoCabelo"]', '3');
		t.clicar('[data-rs="confirmar-servico"]');
		expect(t.enviados[0].parametros).toEqual({ cabelo: 12, corDoCabelo: 3 });
	});

	it('classe de sexo FIXO: as duas opcoes de sexo nascem desligadas, com o motivo', () => {
		const estado = estadoDeExemplo();
		estado.servicos[3].limites.sexo.fixo = true;
		t.c.receber(estado);
		t.clicar('[data-rs="fechar-servico"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-aparencia"]');
		expect(t.$('[data-rs="aparencia-sexo"][data-valor="1"]').disabled).toBe(true);
		expect(t.$('[data-rs="aparencia-sexo"][data-valor="0"]').disabled).toBe(true);
		expect(t.$('.rs-modal--servico').textContent).toContain('não troca de sexo');
	});

	it('ok lista o que foi DESEQUIPADO e ficou na mochila', () => {
		t.clicar('[data-rs="aparencia-sexo"][data-valor="0"]');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-1',
			texto: 'Aparência trocada.',
			creditosRestantes: 0,
			requerRelog: true,
			desequipados: [{ itemId: 1950, nome: 'Chicote' }]
		});
		const lista = t.$('.rs-desequipados');
		expect(lista.textContent).toContain('Guardado na mochila');
		expect(lista.textContent).toContain('Chicote');
	});
});

describe('metade pura dos servicos', () => {
	it('normalizarNome faz o que o servidor faz: apara e junta espacos', () => {
		expect(normalizarNome('  a   b  ')).toBe('a b');
	});

	it('sem `limites` valem as faixas do CONTRATO (4-23, 0-27, 0-8, sexo 0/1)', () => {
		const l = limitesDoServico(null);
		expect(l.novoNome).toEqual({ min: 4, max: 23 });
		expect(l.cabelo).toEqual({ min: 0, max: 27 });
		expect(l.corDoCabelo).toEqual({ min: 0, max: 8 });
		expect(l.sexos.map(s => s.valor)).toEqual([1, 0]);
		expect(l.sexoFixo).toBe(false);
	});

	it('os limites do servidor VENCEM a reserva', () => {
		const servico = { limites: { novoNome: { min: 2, max: 5 }, cabelo: { min: 1, max: 3 } } };
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Abcdef' }, servico).ok).toBe(false);
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Ab' }, servico).ok).toBe(true);
		expect(parametrosDoServico('troca-de-aparencia', { cabelo: '0' }, servico).ok).toBe(false);
	});

	it('nome conta CARACTERES (acento e emoji valem 1)', () => {
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Ção' }).ok).toBe(false);
		expect(parametrosDoServico('troca-de-nome', { novoNome: 'Joãoz' }).parametros).toEqual({ novoNome: 'Joãoz' });
	});

	it('os resets nao levam `parametros`', () => {
		expect(parametrosDoServico('reset-de-skills', {})).toEqual({ ok: true, parametros: null });
	});
});

describe('"X de Y" das cartas de conta (so exibicao de `estado.conta`)', () => {
	it('armazem, vagas e carga saem do servidor; no teto a etiqueta muda de pele', () => {
		t.clicar('[data-categoria="conta"]');
		const texto = sku => {
			const el = t.$(`.rs-card[data-sku="${sku}"] .rs-contador`);
			return el ? el.textContent : null;
		};
		expect(texto('ACCOUNT_STORAGE_100')).toBe('10 de 10 expansões');
		expect(texto('ACCOUNT_CHARACTER_SLOT')).toBe('12 de 15 vagas');
		expect(texto('ACCOUNT_INVENTORY_10')).toBe('1 de 5 expansões');
		expect(t.$('.rs-card[data-sku="ACCOUNT_STORAGE_100"] .rs-contador').classList.contains('is-no-teto')).toBe(true);
		expect(texto('SERVICE_RENAME')).toBeNull();
	});

	it('sem o bloco (servidor antigo) ou com numero torto, a carta fica SEM contador', () => {
		const produto = { sku: 'ACCOUNT_CHARACTER_SLOT' };
		expect(contadorDaConta(produto, { conta: {} })).toBeNull();
		expect(contadorDaConta(produto, { conta: { slots: { total: '12', teto: 15 } } })).toBeNull();
		expect(contadorDaConta(produto, { conta: { slots: { total: 12, teto: 0 } } })).toBeNull();
		expect(contadorDaConta(produto, null)).toBeNull();
	});

	it('o modal de detalhes tambem mostra o contador', () => {
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="detalhes"][data-sku="ACCOUNT_CHARACTER_SLOT"]');
		expect(t.$('.rs-modal--detalhes .rs-contador').textContent).toBe('12 de 15 vagas');
	});
});

describe('P1-02: uma fonte de saldo para RO Shop, Temporada, Passe e HUD', () => {
	it('a fonte: publica minor, avisa quem assina, ignora o que nao e minor e esquece na troca de conta', () => {
		esquecerSaldoDeCash();
		expect(saldoDeCashConhecido()).toBeNull();
		const ouvidos = [];
		const desligar = assinarSaldoDeCash(m => ouvidos.push(m));
		expect(publicarSaldoDeCash(500)).toBe(true);
		expect(publicarSaldoDeCash(500)).toBe(false); // igual: ninguem e acordado
		expect(publicarSaldoDeCash(1.5)).toBe(false);
		expect(publicarSaldoDeCash('700')).toBe(false);
		expect(publicarSaldoDeCash(-1)).toBe(false);
		expect(Session.cash).toBe(500); // a pilula da HUD le daqui
		expect(saldoDeCashConhecido()).toBe(500);
		expect(ouvidos).toEqual([500]);
		desligar();
		publicarSaldoDeCash(600);
		expect(ouvidos).toEqual([500]);
		esquecerSaldoDeCash();
		expect(saldoDeCashConhecido()).toBeNull();
	});

	it('um ouvinte com defeito nao cala os outros', () => {
		const ouvidos = [];
		const a = assinarSaldoDeCash(() => {
			throw new Error('defeito');
		});
		const b = assinarSaldoDeCash(m => ouvidos.push(m));
		expect(() => publicarSaldoDeCash(4242)).not.toThrow();
		expect(ouvidos).toEqual([4242]);
		a();
		b();
	});

	it('o RO Shop PUBLICA o saldo do estado e o `saldoDepoisMinor` da compra (nunca o de um replay)', () => {
		expect(t.saldos).toEqual([862000]);
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: true,
			chave: 'chave-1',
			pedido: { id: 'p', repetido: false, totalMinor: 350, saldoAntesMinor: 862000, saldoDepoisMinor: 861650, itens: [] }
		});
		expect(t.saldos).toEqual([862000, 861650]);
		t.clicar('[data-rs="fechar-checkout"]');
		t.clicar('[data-rs="adicionar"][data-sku="POTION_SURVIVAL_PACK"]');
		t.clicar('[data-rs="comprar"]');
		t.clicar('[data-rs="confirmar"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: true,
			chave: 'chave-2',
			pedido: { id: 'p', repetido: true, totalMinor: 350, saldoAntesMinor: 862000, saldoDepoisMinor: 861650, itens: [] }
		});
		expect(t.saldos).toEqual([862000, 861650]);
	});

	it('um saldo de FORA (Temporada, HUD) entra na carteira, no carrinho e na confirmacao abertos', () => {
		t.clicar('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]');
		t.clicar('[data-rs="comprar"]');
		t.c.atualizarSaldo(1000);
		expect(t.$('.rs-carteira-valor strong').textContent).toBe('10,00');
		expect(t.$('.rs-modal--checkout').textContent).toContain('10,00');
		expect(t.$('.rs-carrinho-corpo .rs-total-linha--apos').textContent).toContain('3,00');
		t.c.atualizarSaldo(300); // agora nao da: o aviso aparece ANTES do clique
		expect(t.$('.rs-carrinho-corpo .rs-aviso-saldo')).not.toBeNull();
		/* Lixo de fora nao vira saldo: negativo, float, texto. */
		[-5, 1.5, '999'].forEach(v => t.c.atualizarSaldo(v));
		expect(t.$('.rs-carteira-valor strong').textContent).toBe('3,00');
		expect(t.saldos).toEqual([862000]); // o que veio de fora nao volta a ser publicado
	});

	it('ponta a ponta no cliente: comprar no RO Shop muda o saldo que a Temporada MOSTRA, e vice-versa', () => {
		/* O RO Shop ligado a fonte como o RoShop.js liga. */
		document.body.innerHTML = '';
		esquecerSaldoDeCash();
		const loja = montar({ aoSaldo: publicarSaldoDeCash });
		const desligar = assinarSaldoDeCash(m => loja.c.atualizarSaldo(m));
		loja.c.abrir();
		loja.c.receber(estadoDeExemplo());
		/* A Temporada aberta com o estado DELA (saldo velho: 8.620,00). */
		const estadoDaTemporada = { v: 3, moeda: { saldoMinor: 862000 } };
		const mostraATemporada = () => saldoParaMostrar(estadoDaTemporada, null, saldoDeCashConhecido());
		expect(mostraATemporada()).toBe(862000);

		loja.clicar('[data-rs="adicionar"][data-sku="COMPLETE_FARM_PACK"]');
		loja.clicar('[data-rs="comprar"]');
		loja.clicar('[data-rs="confirmar"]');
		loja.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'checkout',
			ok: true,
			chave: 'chave-1',
			pedido: { id: 'p', repetido: false, totalMinor: 700, saldoAntesMinor: 862000, saldoDepoisMinor: 861300, itens: [] }
		});
		expect(mostraATemporada()).toBe(861300); // sem pacote novo da Temporada
		expect(Session.cash).toBe(861300); // e a pilula da HUD

		/* Agora o caminho inverso: a Temporada (ou a HUD) publica um saldo novo. */
		publicarSaldoDeCash(860900);
		expect(loja.$('.rs-carteira-valor strong').textContent).toBe('8.609,00');
		desligar();
	});

	it('saldoParaMostrar: conta, depois Temporada, depois Passe', () => {
		expect(saldoParaMostrar({ moeda: { saldoMinor: 100 } }, { saldoMinor: 200 }, 300)).toBe(300);
		expect(saldoParaMostrar({ moeda: { saldoMinor: 100 } }, { saldoMinor: 200 }, null)).toBe(100);
		expect(saldoParaMostrar(null, { saldoMinor: 200 }, null)).toBe(200);
		expect(saldoParaMostrar(null, { cash: 2 }, null)).toBe(200); // Passe v1: inteiro x100
		expect(saldoParaMostrar(null, null, null)).toBeNull();
	});

	it('a costura: HUD, RO Shop, Temporada e Passe passam TODOS pela fonte unica', () => {
		const hud = ler('Engine/MapEngine/RagidleCash.js');
		expect(hud).toMatch(/publicarSaldoDeCash\(pkt\.saldo\)/);
		expect(hud).not.toMatch(/Session\.cash\s*=/);
		const loja = ler('UI/Components/RoShop/RoShop.js');
		expect(loja).toMatch(/aoSaldo:\s*publicarSaldoDeCash/);
		expect(loja).toMatch(/assinarSaldoDeCash\(/);
		const temporada = ler('UI/Components/TemporadaIdle/TemporadaIdle.js');
		expect(temporada).toMatch(/publicarSaldoDeCash\(minorDe\(dados\.moeda, 'saldo'\)\)/);
		expect(temporada).toMatch(/assinarSaldoDeCash\(/);
		expect(temporada).toMatch(/saldoParaMostrar\(/);
		const passe = ler('UI/Components/PasseIdle/PasseIdle.js');
		expect(passe).toMatch(/publicarSaldoDeCash\(/);
		expect(passe).toMatch(/assinarSaldoDeCash\(/);
		expect(passe).toMatch(/saldoDeCashConhecido\(\)/);
		/* E ninguem mais escreve o campo por fora da fonte. */
		['UI/Components/BasicInfoIdle/BasicInfoIdle.js', 'UI/Components/NpcStore/NpcStoreV2/NpcStoreV2.js'].forEach(
			f => expect(ler(f), f).not.toMatch(/Session\.cash\s*=[^=]/)
		);
	});
});

describe('P1-10: payload torto nao derruba a janela', () => {
	it('resultado de servico com campos do tipo errado desenha sem excecao', () => {
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-aparencia"]');
		t.clicar('[data-rs="aparencia-sexo"][data-valor="0"]');
		t.clicar('[data-rs="confirmar-servico"]');
		expect(() =>
			t.c.receber({
				versao: 1,
				tipo: 'resultado',
				acao: 'usar-servico',
				ok: false,
				chave: 'chave-1',
				texto: 'x',
				parametrosRecusados: 'nao-e-objeto'
			})
		).not.toThrow();
		expect(() => t.clicar('[data-rs="voltar-servico"]')).not.toThrow();
		expect(() =>
			t.c.receber({ versao: 1, tipo: 'estado', conta: 'x', servicos: [null, 3], personagem: 7, produtos: [] })
		).not.toThrow();
	});

	it('ok com `desequipados` que nao e lista, e `requerRelog` que nao e booleano: sem excecao e sem aviso inventado', () => {
		t.clicar('[data-categoria="conta"]');
		t.clicar('[data-rs="usar-servico"][data-servico="troca-de-nome"]');
		t.digitar('[data-rs-campo="novoNome"]', 'Aurora');
		t.clicar('[data-rs="confirmar-servico"]');
		t.c.receber({
			versao: 1,
			tipo: 'resultado',
			acao: 'usar-servico',
			ok: true,
			chave: 'chave-1',
			texto: 'ok',
			desequipados: 'x',
			requerRelog: 'sim'
		});
		expect(t.$('.rs-desequipados')).toBeNull();
		expect(t.$('.rs-relog')).toBeNull();
	});

	it('o RoShop.js segura JSON quebrado e excecao do desenho (um dono so do 0x0fb8)', () => {
		const fonte = ler('UI/Components/RoShop/RoShop.js');
		expect(fonte).toMatch(/JSON\.parse\(pkt\.json\)[\s\S]*catch/);
		expect(fonte).toMatch(/c\.receber\(dados\)[\s\S]*catch/);
	});
});

describe('selecao de personagem: as vagas que o servidor informa', () => {
	const HTML_V4 = ler('UI/Components/CharSelect/CharSelectV4/CharSelectV4.html');

	function grade(total, ocupadas) {
		document.body.innerHTML = '';
		const raiz = document.createElement('div');
		raiz.innerHTML = HTML_V4;
		document.body.appendChild(raiz);
		const vagas = vagasDaConta({ TotalSlotNum: total, PremiumStartSlot: 0, PremiumEndSlot: 0 }, 15);
		const visiveis = aplicarVagas(raiz, vagas, i => ocupadas.indexOf(i) !== -1);
		const naTela = [...raiz.querySelectorAll('.char_canvas')].filter(el => !el.hidden).length;
		return { raiz, vagas, visiveis, naTela };
	}

	it('9, 12 e 15: a grade desenha exatamente o total, e o contador diz "X de Y"', () => {
		for (const total of [9, 12, 15]) {
			const g = grade(total, [0, 1, 2]);
			expect(g.naTela, String(total)).toBe(total);
			expect(g.visiveis).toBe(total);
			expect(g.raiz.querySelector('.cs-vagas').textContent).toBe(`3 de ${total} vagas em uso`);
		}
	});

	it('personagem numa vaga ALEM do total continua na tela (nunca some um personagem)', () => {
		const g = grade(9, [0, 10]);
		expect(g.naTela).toBe(10);
		expect(g.raiz.querySelector('#slot10').closest('.char_canvas').hidden).toBe(false);
		expect(g.raiz.querySelector('#slot11').closest('.char_canvas').hidden).toBe(true);
	});

	it('vagasDaConta: soma do pacote, reserva sem campo, teto na grade', () => {
		expect(vagasDaConta({ TotalSlotNum: 12, PremiumStartSlot: 0 })).toBe(12);
		expect(vagasDaConta({ TotalSlotNum: 9, PremiumStartSlot: 3 })).toBe(12);
		expect(vagasDaConta({ TotalSlotNum: 20, PremiumStartSlot: 0 })).toBe(VAGAS_DESENHAVEIS);
		expect(vagasDaConta({}, 15)).toBe(15);
		expect(vagasDaConta({ TotalSlotNum: 0 }, 9)).toBe(9);
	});

	it('nunca cria numa vaga que a conta nao tem, nem numa ocupada', () => {
		expect(podeCriarNaVaga(8, 9, false)).toBe(true);
		expect(podeCriarNaVaga(9, 9, false)).toBe(false);
		expect(podeCriarNaVaga(11, 12, false)).toBe(true);
		expect(podeCriarNaVaga(3, 9, true)).toBe(false);
		expect(podeCriarNaVaga(-1, 9, false)).toBe(false);
	});

	it('o cursor para na ultima vaga da conta, salvo personagem alem dela', () => {
		const vazia = () => false;
		expect(vagaDoCursor(14, 9, vazia)).toBe(8);
		expect(vagaDoCursor(9, 9, vazia)).toBe(8);
		expect(vagaDoCursor(-3, 9, vazia)).toBe(0);
		expect(vagaDoCursor(10, 9, i => i === 10)).toBe(10);
		expect(textoDasVagas(1, 1)).toBe('1 de 1 vaga em uso');
	});

	it('a costura na V4: o total vem do pacote e `create()` recusa a vaga que a conta nao tem', () => {
		const comum = ler('UI/Components/CharSelect/CharSelectCommon.js');
		expect(comum).toMatch(/_maxSlots = vagasDaConta\(pkt, defaultMaxSlots\)/);
		expect(comum).toMatch(/gridLayout && !podeCriarNaVaga\(_index, _maxSlots, !!_slots\[_index\]\)/);
		expect(comum).toMatch(/aplicarVagas\(root, _maxSlots, i => !!_slots\[i\]\)/);
		expect(comum).toMatch(/_index = vagaDoCursor\(index, _maxSlots/);
		const css = ler('UI/Components/CharSelect/CharSelectV4/CharSelectV4.css');
		expect(css).toMatch(/\.char_canvas\[hidden\]\s*\{\s*display:\s*none\s*!important/);
	});
});

describe('os itens do RO Shop (9.000.100-110) tem nome e descricao no cliente', () => {
	it('ausente da tabela: sai com o nome de itens-custom.ts e a descricao documentada', () => {
		const ficha = completarFicha(9000103, undefined);
		expect(ficha.identifiedDisplayName).toBe('Pack Poção Azul');
		expect(ficha.identifiedDescriptionName).toContain('entrega 1000 Poções Azuis');
		expect(ficha.identifiedDescriptionName).toContain('Não pode ser negociado');
		expect(completarFicha(9000102, undefined).identifiedDisplayName).toBe('Bênção da Fortuna');
		expect(completarFicha(9000100, undefined).identifiedDisplayName).toBe('Manual de Experiência');
	});

	it('os onze tem nome e descricao, e nenhum texto traz travessao', () => {
		for (let id = 9000100; id <= 9000110; id++) {
			expect(NOMES_LOCAIS[id], String(id)).toBeTruthy();
			expect(DESCRICOES_LOCAIS[id], String(id)).toBeTruthy();
			expect(`${NOMES_LOCAIS[id]} ${DESCRICOES_LOCAIS[id]}`).not.toMatch(/[–—]/);
		}
	});

	it('estube e GRF: a descricao local so tapa o buraco, nunca atropela a do GRF', () => {
		expect(completarFicha(9000105, { ClassNum: 0 }).identifiedDescriptionName).toContain('1000 Poções Azuis');
		const doGrf = { identifiedResourceName: 'x', identifiedDescriptionName: 'Do GRF' };
		expect(completarFicha(9000105, doGrf).identifiedDescriptionName).toBe('Do GRF');
	});
});

describe('os icones de buff dos boosts do RO Shop (CONTRATO.md secao 5)', () => {
	it('252 Bencao, 312 Manual de Job e 923 Manual de EXP tem icone, relogio e titulo em portugues', () => {
		const casos = [
			[252, 'item.tga', 'Bênção da Fortuna'],
			[312, 'job.tga', 'Manual de Experiência de Classe'],
			[923, 'exp.tga', 'Manual de Experiência']
		];
		for (const [efst, icone, titulo] of casos) {
			const info = StatusInfo[efst];
			expect(info, String(efst)).toBeTruthy();
			expect(info.icon).toBe(icone);
			expect(info.haveTimeLimit).toBe(1);
			/* posTimeLimitStr e 1-based e aponta a linha do relogio (%s). */
			expect(info.descript[info.posTimeLimitStr - 1][0]).toBe('%s');
			expect(emPortugues(info.descript[0][0])).toBe(titulo);
			info.descript.slice(1).forEach(l => {
				if (l[0] !== '%s') {
					expect(emPortugues(l[0])).not.toBe(l[0]); // toda linha traduzida
				}
			});
		}
		/* O 250 continua sendo o do EVENTO de EXP: o Manual nao o reusa. */
		expect(emPortugues(StatusInfo[250].descript[0][0])).toBe('Evento de EXP');
	});
});

describe('Temporada: a caixa do modal fica por cima do fundo no celular', () => {
	it('a regra D-932 (static !important em .ri-window) e vencida SO na caixa do modal', () => {
		const css = ler('UI/Components/TemporadaIdle/TemporadaIdle.css');
		const regra = css.match(/#TemporadaIdle \.te-modal-caixa\.ri-window\s*\{([^}]*)\}/);
		expect(regra, 'a regra do conserto sumiu').not.toBeNull();
		expect(regra[1]).toMatch(/position:\s*relative\s*!important/);
		expect(regra[1]).toMatch(/z-index:\s*1/);
		/* A regra que ela vence continua la: o conserto nao mexeu no Common.css. */
		expect(ler('UI/Common.css')).toMatch(/\.ri-window,[\s\S]*?position: static !important/);
	});
});
