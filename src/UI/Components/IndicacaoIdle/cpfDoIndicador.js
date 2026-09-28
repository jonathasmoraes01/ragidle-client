/**
 * UI/Components/IndicacaoIdle/cpfDoIndicador.js
 *
 * RAGIDLE: O CPF DO INDICADOR (28/09/2026, D-1634 do servidor - o desenho
 * aprovado pelo dono para a auto-indicacao). A metade PURA do cadastro na
 * janela Indique & Ganhe: o HTML da secao, o passo do botao e os textos. Nao
 * importa Network, Renderer nem GUIComponent - e isso que deixa o teste le-la
 * sem motor.
 *
 * O que o servidor manda no painel (`ZC_RAGIDLE_INDICACAO`):
 *   cpfDisponivel        a instancia tem o sal do CPF (sem ele, a secao some);
 *   cpfCadastrado        so o booleano - nem a impressao desce;
 *   comissaoRetidaMinor  o que esta retido esperando o cadastro;
 *   cpfAviso/liberadoMinor, na resposta ao cadastro que deu certo;
 *   recusa               'cpf-indisponivel' | 'cpf-ja-cadastrado' | 'cpf-invalido'.
 *
 * O CPF NAO FICA NO CLIENTE: ele vive no campo enquanto o jogador digita, no
 * passo de confirmacao (uma variavel do modulo da janela) e no pacote. Depois
 * do envio, o campo e a variavel sao zerados. Quem valida de verdade e o
 * servidor; a conferencia daqui (a MESMA regra, `cpfValido` da doacao) so
 * poupa uma volta para ouvir "CPF invalido".
 *
 * UMA VEZ SO: o servidor recusa o segundo cadastro. Por isso ha a
 * confirmacao com o CPF mascarado antes do envio - um digito errado nao tem
 * conserto pela janela.
 */
import { cpfValido, escapeHtml, mascararCpf, soDigitos } from '../DoacaoIdle/formatoDaDoacao.js';
import { formatarRoCash } from 'Utils/roCash.js';

/** Os textos das recusas do cadastro, pelo codigo que o servidor manda. */
export const RECUSAS_DO_CPF = {
	'cpf-indisponivel': 'O cadastro de CPF está indisponível no momento. Tente mais tarde.',
	'cpf-ja-cadastrado': 'Sua conta já tem um CPF cadastrado, e ele não pode ser trocado.',
	'cpf-invalido': 'CPF inválido. Confira os números.'
};

/** A recusa e do cadastro de CPF (e nao do codigo de indicacao)? */
export function ehRecusaDeCpf(recusa) {
	return typeof recusa === 'string' && Object.prototype.hasOwnProperty.call(RECUSAS_DO_CPF, recusa);
}

/**
 * O clique em "Cadastrar CPF": valida o que foi digitado e devolve o proximo
 * passo. `{ ok: true, digitos, mascarado }` abre a confirmacao; `{ ok: false,
 * recado }` fica no campo com o erro.
 */
export function passoDoCadastro(texto) {
	const digitos = soDigitos(texto);
	if (digitos.length !== 11) {
		return { ok: false, recado: 'O CPF tem 11 números.' };
	}
	if (!cpfValido(digitos)) {
		return { ok: false, recado: RECUSAS_DO_CPF['cpf-invalido'] };
	}
	return { ok: true, digitos, mascarado: mascararCpf(digitos) };
}

/** A linha de sucesso do cadastro (com o que foi liberado), ou `''`. */
export function textoDoCadastroFeito(estado) {
	if (!estado || estado.cpfAviso !== 'cadastrado') {
		return '';
	}
	const liberado = Number(estado.liberadoMinor) || 0;
	return liberado > 0
		? `CPF cadastrado. ${formatarRoCash(liberado)} RO Cash de comissão foram liberados para você.`
		: 'CPF cadastrado. As próximas comissões chegam direto na sua carteira.';
}

/**
 * O HTML da secao do CPF. `confirmando` e o CPF mascarado esperando o
 * "Confirmar" (ou `null`, com o campo aberto). Sem `cpfDisponivel`, a secao
 * nao existe.
 */
export function cpfHtml(estado, confirmando) {
	if (!estado || estado.cpfDisponivel !== true) {
		return '';
	}
	const retida = Number(estado.comissaoRetidaMinor) || 0;
	let html = '<div class="in-rotulo">Seu CPF de indicador</div>';
	if (estado.cpfCadastrado === true) {
		const feito = textoDoCadastroFeito(estado);
		html +=
			'<div class="in-cartao-verde in-cpf-ok">CPF cadastrado ✓ A comissão sai quando quem doa usa um CPF diferente do seu.</div>';
		if (feito) {
			html += '<div class="in-recado is-ok in-cpf-recado">' + escapeHtml(feito) + '</div>';
		}
		return html;
	}
	html +=
		'<p class="in-cpf-explica">Para receber os 10% das doações dos seus indicados, cadastre o seu CPF. ' +
		'Guardamos só uma impressão cifrada dele, nunca o número. A comissão é paga quando quem doa usa um CPF diferente do seu.</p>';
	if (retida > 0) {
		html +=
			'<div class="in-cpf-retida">Você tem <strong>' +
			escapeHtml(formatarRoCash(retida)) +
			' RO Cash</strong> de comissão esperando este cadastro.</div>';
	}
	if (confirmando) {
		html +=
			'<div class="in-cpf-confirma">Confirme o CPF <strong>' +
			escapeHtml(confirmando) +
			'</strong>. Ele é cadastrado uma vez só e não pode ser trocado depois.</div>' +
			'<div class="in-usar-linha">' +
			'<button type="button" class="in-cpf-confirmar ri-btn">Confirmar</button>' +
			'<button type="button" class="in-cpf-corrigir ri-btn ri-btn--sec">Corrigir</button>' +
			'</div>';
	} else {
		html +=
			'<div class="in-usar-linha">' +
			'<input type="text" class="in-cpf-campo ri-input" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" aria-label="CPF">' +
			'<button type="button" class="in-cpf-cadastrar ri-btn ri-btn--sec">Cadastrar CPF</button>' +
			'</div>';
	}
	const recusa = ehRecusaDeCpf(estado.recusa) ? RECUSAS_DO_CPF[estado.recusa] : '';
	html += '<div class="in-recado in-cpf-recado' + (recusa ? ' is-erro' : '') + '">' + escapeHtml(recusa) + '</div>';
	return html;
}
