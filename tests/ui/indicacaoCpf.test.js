/**
 * O CPF DO INDICADOR NA JANELA INDIQUE & GANHE (28/09/2026, D-1634 do
 * servidor - o desenho aprovado pelo dono para a auto-indicacao).
 *
 * Duas partes:
 *  1. a metade PURA (`cpfDoIndicador.js`): o passo do botao e o HTML da secao
 *     em cada estado que o painel do servidor pode mandar;
 *  2. a COSTURA com a janela, lendo o fonte (a janela importa o motor e nao
 *     carrega no jsdom): a secao existe no HTML, o envio e `{ acao: 'cpf' }`,
 *     o CPF e esquecido no envio e na troca de personagem, e a recusa do CPF
 *     nao vaza para a linha do codigo de indicacao.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	RECUSAS_DO_CPF,
	cpfHtml,
	ehRecusaDeCpf,
	passoDoCadastro,
	textoDoCadastroFeito
} from 'UI/Components/IndicacaoIdle/cpfDoIndicador.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');

/** Um CPF de exemplo com os dois verificadores certos (o mesmo da doacao). */
const CPF_VALIDO = '529.982.247-25';

/** O painel minimo que o servidor manda, com o que cada caso muda. */
const painel = extras => ({ v: 2, cpfDisponivel: true, cpfCadastrado: false, comissaoRetidaMinor: 0, ...extras });

function secao(html) {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div;
}

describe('passoDoCadastro: o clique em "Cadastrar CPF"', () => {
	it('CPF valido abre a confirmacao com os digitos e a forma mascarada', () => {
		expect(passoDoCadastro(CPF_VALIDO)).toEqual({ ok: true, digitos: '52998224725', mascarado: '529.982.247-25' });
		expect(passoDoCadastro('52998224725')).toMatchObject({ ok: true, digitos: '52998224725' });
	});

	it('menos de 11 numeros, ou verificador errado, fica no campo com o erro', () => {
		expect(passoDoCadastro('529.982')).toEqual({ ok: false, recado: 'O CPF tem 11 números.' });
		expect(passoDoCadastro('')).toMatchObject({ ok: false });
		expect(passoDoCadastro('123.456.789-00')).toEqual({ ok: false, recado: RECUSAS_DO_CPF['cpf-invalido'] });
		expect(passoDoCadastro('111.111.111-11')).toMatchObject({ ok: false });
	});
});

describe('cpfHtml: a secao em cada estado do painel', () => {
	it('sem o sal no servidor (cpfDisponivel falso ou ausente), a secao NAO existe', () => {
		expect(cpfHtml(painel({ cpfDisponivel: false }), null)).toBe('');
		expect(cpfHtml({ v: 2 }, null)).toBe('');
		expect(cpfHtml(null, null)).toBe('');
	});

	it('sem CPF: a explicacao, o campo numerico e o botao - e nenhum CPF escrito', () => {
		const s = secao(cpfHtml(painel({}), null));
		const campo = s.querySelector('.in-cpf-campo');
		expect(campo).not.toBeNull();
		expect(campo.getAttribute('inputmode')).toBe('numeric');
		expect(campo.getAttribute('autocomplete')).toBe('off');
		expect(s.querySelector('.in-cpf-cadastrar')).not.toBeNull();
		expect(s.textContent).toContain('CPF diferente do seu');
		expect(s.querySelector('.in-cpf-retida')).toBeNull();
	});

	it('com comissao RETIDA: diz quanto esta esperando o cadastro', () => {
		const s = secao(cpfHtml(painel({ comissaoRetidaMinor: 890 }), null));
		expect(s.querySelector('.in-cpf-retida').textContent).toContain('8,90 RO Cash');
	});

	it('na confirmacao: o CPF mascarado, "Confirmar" e "Corrigir", e o campo sai', () => {
		const s = secao(cpfHtml(painel({}), '529.982.247-25'));
		expect(s.querySelector('.in-cpf-confirma').textContent).toContain('529.982.247-25');
		expect(s.querySelector('.in-cpf-confirma').textContent).toContain('não pode ser trocado');
		expect(s.querySelector('.in-cpf-confirmar')).not.toBeNull();
		expect(s.querySelector('.in-cpf-corrigir')).not.toBeNull();
		expect(s.querySelector('.in-cpf-campo')).toBeNull();
	});

	it('cadastrado: o cartao verde, sem campo nem botao; e o aviso do que foi liberado, se veio', () => {
		const s = secao(cpfHtml(painel({ cpfCadastrado: true }), null));
		expect(s.querySelector('.in-cpf-ok')).not.toBeNull();
		expect(s.querySelector('.in-cpf-campo')).toBeNull();
		expect(s.querySelector('.in-cpf-cadastrar')).toBeNull();
		const feito = secao(cpfHtml(painel({ cpfCadastrado: true, cpfAviso: 'cadastrado', liberadoMinor: 890 }), null));
		expect(feito.querySelector('.in-cpf-recado').textContent).toContain('8,90 RO Cash');
		expect(textoDoCadastroFeito(painel({ cpfAviso: 'cadastrado', liberadoMinor: 0 }))).toContain('As próximas comissões');
		expect(textoDoCadastroFeito(painel({}))).toBe('');
	});

	it('a recusa do CPF aparece na secao, em vermelho; a do CODIGO de indicacao nao', () => {
		const s = secao(cpfHtml(painel({ recusa: 'cpf-ja-cadastrado' }), null));
		const recado = s.querySelector('.in-cpf-recado');
		expect(recado.classList.contains('is-erro')).toBe(true);
		expect(recado.textContent).toBe(RECUSAS_DO_CPF['cpf-ja-cadastrado']);
		const doCodigo = secao(cpfHtml(painel({ recusa: 'codigo-invalido' }), null));
		expect(doCodigo.querySelector('.in-cpf-recado').textContent).toBe('');
		expect(ehRecusaDeCpf('cpf-invalido')).toBe(true);
		expect(ehRecusaDeCpf('codigo-invalido')).toBe(false);
		expect(ehRecusaDeCpf(undefined)).toBe(false);
	});

	it('o texto que volta do servidor e escapado', () => {
		const html = cpfHtml(painel({}), '<img src=x onerror=1>');
		expect(html).not.toContain('<img');
	});
});

describe('a costura com a janela (lendo o fonte)', () => {
	const js = ler('src/UI/Components/IndicacaoIdle/IndicacaoIdle.js');
	const html = ler('src/UI/Components/IndicacaoIdle/IndicacaoIdle.html');
	const css = ler('src/UI/Components/IndicacaoIdle/IndicacaoIdle.css');

	it('a secao do CPF existe no HTML e e desenhada por cpfHtml', () => {
		expect(html).toContain('<section class="in-cpf"></section>');
		expect(js).toMatch(/cpf\.innerHTML = cpfHtml\(estado, _cpfEmConfirmacao \? _cpfEmConfirmacao\.mascarado : null\)/);
	});

	it('o envio e o verbo `cpf` com os DIGITOS, e o CPF e esquecido ANTES de enviar', () => {
		const confirmar = js.slice(js.indexOf('// Confirmar: envia e esquece'), js.indexOf('function onClickCorpo'));
		expect(confirmar).toContain("enviarAcao({ acao: 'cpf', cpf: envio.digitos });");
		expect(confirmar.indexOf('_cpfEmConfirmacao = null;')).toBeLessThan(confirmar.indexOf('enviarAcao('));
	});

	it('o CPF nao sobrevive a troca de personagem nem a janela fechada, e nunca vai para Preferences', () => {
		const limpar = js.slice(js.indexOf('IndicacaoIdle.limparEstadoDoPersonagem'), js.indexOf('IndicacaoIdle.init'));
		expect(limpar).toContain('_cpfEmConfirmacao = null;');
		const fechar = js.slice(js.indexOf('function closeWindow'), js.indexOf('function onClickClose'));
		expect(fechar).toContain('_cpfEmConfirmacao = null;');
		expect(js).not.toMatch(/localStorage|sessionStorage/);
		// Preferences guarda so a posicao da janela.
		expect(js).toMatch(/Preferences\.get\(\s*'IndicacaoIdle',\s*\{\s*x: null,\s*y: null\s*\}/);
	});

	it('a recusa do CPF nao vira "Nao foi possivel usar esse codigo" na linha do codigo', () => {
		expect(js).toContain('const recusaDoCodigo = estado.recusa && !ehRecusaDeCpf(estado.recusa) ? estado.recusa : null;');
	});

	it('o campo recebe a mesma mascara da doacao, e no DEDO o campo e os botoes tem 44px', () => {
		expect(js).toContain("corpo.addEventListener('input', onInputCorpo);");
		expect(js).toContain('const mascarado = mascararCpf(campo.value);');
		const dedo = css.slice(css.indexOf('@media (pointer: coarse)'));
		expect(dedo).toContain('#IndicacaoIdle .in-cpf-campo');
		expect(dedo).toContain('min-height: var(--hit-touch, 44px);');
	});
});
