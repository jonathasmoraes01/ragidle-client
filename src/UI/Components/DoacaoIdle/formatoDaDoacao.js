/**
 * UI/Components/DoacaoIdle/formatoDaDoacao.js
 *
 * A METADE PURA da janela "Doacao via PIX" (23/09/2026): a conta de faixa,
 * total, desconto e "leve mais", a formatacao em reais, a mascara de CPF, o
 * nome completo e a contagem regressiva. Nao importa Network, Renderer nem
 * GUIComponent - e isso que deixa o teste e o arnes de foto a lerem sem motor.
 *
 * ---------------------------------------------------------------------------
 * AS FAIXAS SAO DO SERVIDOR
 * ---------------------------------------------------------------------------
 * Nenhum preco mora aqui. `faixas`, `minimo`, `maximo` e `tetoCentavos` chegam
 * no `doacao-estado` (servidor/doacao/janela-da-doacao.ts), e o cliente so
 * repete a MESMA regra do servidor (servidor/doacao/faixas.ts) para DESENHAR
 * antes do clique: o preco de uma quantidade e o da ULTIMA faixa cujo
 * `aPartirDe` ela alcanca, e o total e `quantidade * preco`, em centavos
 * INTEIROS. Quem cobra continua sendo o servidor - o total que vale e o que
 * volta no `doacao-gerar`.
 *
 * O PRECO CHEIO e o da PRIMEIRA faixa (hoje 100 centavos = R$ 1,00 por RO
 * Cash): o desconto e medido contra ela, e nao contra um 100 escrito aqui.
 */

import { formatarRoCash } from 'Utils/roCash.js';

/** Os atalhos da quantidade (pilulas). Os que passam do maximo somem. */
export const ATALHOS_DE_QUANTIDADE = [10, 50, 100, 250, 500, 1000, 2000];

/** Quanto o "Ja paguei" fica travado depois de um clique. */
export const TRAVA_DO_JA_PAGUEI_MS = 3000;

/* ------------------------------------------------------------------ */
/* Leitura do estado                                                   */
/* ------------------------------------------------------------------ */

const inteiroPositivo = v => Number.isSafeInteger(v) && v > 0;

/**
 * As faixas do estado, validadas e em ordem crescente. Faixa torta (sem
 * inteiro positivo nos dois campos) e descartada: desenhar um preco
 * adivinhado seria pior que nao desenhar.
 */
export function faixasDoEstado(estado) {
	const brutas = estado && Array.isArray(estado.faixas) ? estado.faixas : [];
	return brutas
		.filter(f => f && inteiroPositivo(f.aPartirDe) && inteiroPositivo(f.precoPorCashCentavos))
		.map(f => ({ aPartirDe: f.aPartirDe, precoPorCashCentavos: f.precoPorCashCentavos }))
		.sort((a, b) => a.aPartirDe - b.aPartirDe);
}

/** Os limites do estado (o que o servidor aceita). */
export function limitesDoEstado(estado) {
	const faixas = faixasDoEstado(estado);
	const minimo = estado && inteiroPositivo(estado.minimo) ? estado.minimo : faixas.length ? faixas[0].aPartirDe : 1;
	const maximo = estado && inteiroPositivo(estado.maximo) ? estado.maximo : minimo;
	const tetoCentavos = estado && inteiroPositivo(estado.tetoCentavos) ? estado.tetoCentavos : Infinity;
	const bonusPercent =
		estado && Number.isSafeInteger(estado.bonusPercent) && estado.bonusPercent > 0 ? estado.bonusPercent : 0;
	return { minimo, maximo: Math.max(minimo, maximo), tetoCentavos, bonusPercent };
}

/** O indice da faixa de `quantidade`, ou -1 abaixo da primeira. */
export function indiceDaFaixa(faixas, quantidade) {
	let indice = -1;
	faixas.forEach((f, i) => {
		if (quantidade >= f.aPartirDe) {
			indice = i;
		}
	});
	return indice;
}

/** Desconto de vitrine (inteiro arredondado) de um preco contra o cheio. */
export function descontoPercent(precoCheio, preco) {
	if (!inteiroPositivo(precoCheio) || !Number.isFinite(preco)) {
		return 0;
	}
	return Math.round(((precoCheio - preco) * 100) / precoCheio);
}

/** O credito em minor (centavo de RO Cash): quantidade x 100, mais o bonus. */
export function creditoMinor(quantidade, bonusPercent = 0) {
	return Math.floor((quantidade * 100 * (100 + bonusPercent)) / 100);
}

/**
 * "Leve mais e pague menos": entre os COMECOS das faixas acima da atual, o que
 * custa menos ou igual ao total atual e economiza mais (empate: a maior
 * quantidade). A mesma regra de `sugerir` no servidor.
 */
export function sugestaoLeveMais(faixas, quantidade, totalCentavos, limites) {
	let melhor = null;
	for (const f of faixas) {
		if (f.aPartirDe <= quantidade) {
			continue;
		}
		if (limites && (f.aPartirDe > limites.maximo || f.aPartirDe * f.precoPorCashCentavos > limites.tetoCentavos)) {
			continue;
		}
		const total = f.aPartirDe * f.precoPorCashCentavos;
		if (total > totalCentavos) {
			continue;
		}
		const economia = totalCentavos - total;
		if (
			melhor === null ||
			economia > melhor.economiaCentavos ||
			(economia === melhor.economiaCentavos && f.aPartirDe > melhor.quantidade)
		) {
			melhor = { quantidade: f.aPartirDe, totalCentavos: total, economiaCentavos: economia };
		}
	}
	return melhor;
}

/**
 * A cotacao de `quantidade` pelo estado do servidor.
 *
 * { ok: true, quantidade, indice, precoPorCashCentavos, totalCentavos,
 *   descontoPercent, creditoMinor, sugestao }
 * { ok: false, recusa: 'sem-faixas' | 'invalida' | 'abaixo-do-minimo' | 'acima-do-maximo' | 'acima-do-teto' }
 */
export function cotar(estado, quantidade) {
	const faixas = faixasDoEstado(estado);
	if (faixas.length === 0) {
		return { ok: false, recusa: 'sem-faixas' };
	}
	if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
		return { ok: false, recusa: 'invalida' };
	}
	const limites = limitesDoEstado(estado);
	if (quantidade < limites.minimo) {
		return { ok: false, recusa: 'abaixo-do-minimo' };
	}
	if (quantidade > limites.maximo) {
		return { ok: false, recusa: 'acima-do-maximo' };
	}
	const indice = indiceDaFaixa(faixas, quantidade);
	if (indice < 0) {
		return { ok: false, recusa: 'abaixo-do-minimo' };
	}
	const preco = faixas[indice].precoPorCashCentavos;
	const totalCentavos = quantidade * preco;
	if (totalCentavos > limites.tetoCentavos) {
		return { ok: false, recusa: 'acima-do-teto' };
	}
	return {
		ok: true,
		quantidade,
		indice,
		precoPorCashCentavos: preco,
		totalCentavos,
		descontoPercent: descontoPercent(faixas[0].precoPorCashCentavos, preco),
		creditoMinor: creditoMinor(quantidade, limites.bonusPercent),
		sugestao: sugestaoLeveMais(faixas, quantidade, totalCentavos, limites)
	};
}

/* ------------------------------------------------------------------ */
/* Formatacao                                                          */
/* ------------------------------------------------------------------ */

/** Centavos inteiros -> "R$ 89,00" (mesma escala do minor: 100 = 1,00). */
export function formatarReais(centavos) {
	return `R$ ${formatarRoCash(centavos)}`;
}

/** Inteiro -> "2.898" (ponto de milhar, sem toLocaleString). */
export function formatarInteiro(n) {
	const s = String(Math.trunc(Math.abs(Number(n) || 0)));
	let out = '';
	for (let i = 0; i < s.length; i++) {
		if (i > 0 && (s.length - i) % 3 === 0) {
			out += '.';
		}
		out += s[i];
	}
	return out;
}

/**
 * O rotulo de uma faixa: "100 – 249". A ultima vai ate o maximo por doacao
 * ("1.000 – 2.898"); sem maximo, "1.000+".
 */
export function rotuloDaFaixa(faixas, i, maximo) {
	const f = faixas[i];
	if (!f) {
		return '';
	}
	const proxima = faixas[i + 1];
	const fim = proxima ? proxima.aPartirDe - 1 : Number.isSafeInteger(maximo) ? maximo : null;
	if (fim === null) {
		return `${formatarInteiro(f.aPartirDe)}+`;
	}
	return `${formatarInteiro(f.aPartirDe)} – ${formatarInteiro(fim)}`;
}

/** "29:41" (mm:ss); a partir de uma hora, "1:02:03". Nunca negativo. */
export function contagemRegressiva(msRestantes) {
	const total = Math.max(0, Math.ceil((Number(msRestantes) || 0) / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const dois = n => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */

export function soDigitos(texto) {
	return String(texto == null ? '' : texto).replace(/\D+/g, '');
}

/** A quantidade digitada: so digitos, sem zero a esquerda, ate o maximo. */
export function lerQuantidade(texto, maximo) {
	const d = soDigitos(texto).replace(/^0+/, '').slice(0, 7);
	if (!d) {
		return null;
	}
	const n = Number(d);
	return Number.isSafeInteger(maximo) && n > maximo ? maximo : n;
}

/** Prende a quantidade entre o minimo e o maximo. */
export function limitarQuantidade(n, minimo, maximo) {
	if (!Number.isFinite(n)) {
		return minimo;
	}
	return Math.min(maximo, Math.max(minimo, Math.round(n)));
}

/**
 * O SLIDER E QUADRATICO, e nao linear: com a faixa de 5 a 2.898, um slider
 * linear deixava 5..250 - onde mora quase toda doacao - espremido nos
 * primeiros 8% do trilho (medido na foto: 99 e 100 no mesmo pixel). Com a
 * curva, 100 fica a ~18% do trilho e o fim continua sendo o maximo exato.
 */
export const PASSOS_DO_SLIDER = 1000;

export function posicaoDoSlider(quantidade, minimo, maximo) {
	if (!(maximo > minimo)) {
		return 0;
	}
	const q = Math.min(maximo, Math.max(minimo, quantidade));
	return Math.round(Math.sqrt((q - minimo) / (maximo - minimo)) * PASSOS_DO_SLIDER);
}

export function quantidadeDoSlider(posicao, minimo, maximo) {
	const p = Math.min(PASSOS_DO_SLIDER, Math.max(0, Number(posicao) || 0)) / PASSOS_DO_SLIDER;
	return Math.round(minimo + (maximo - minimo) * p * p);
}

/** Mascara progressiva: "12345678901" -> "123.456.789-01". */
export function mascararCpf(texto) {
	const d = soDigitos(texto).slice(0, 11);
	let out = d.slice(0, 3);
	if (d.length > 3) {
		out += '.' + d.slice(3, 6);
	}
	if (d.length > 6) {
		out += '.' + d.slice(6, 9);
	}
	if (d.length > 9) {
		out += '-' + d.slice(9, 11);
	}
	return out;
}

/**
 * CPF com 11 digitos E os dois verificadores da Receita (a mesma regra do
 * `cpf.ts` do servidor). Conferir aqui so poupa o jogador de uma volta ao
 * servidor para ouvir "CPF invalido" - quem decide continua sendo o servidor.
 */
export function cpfValido(texto) {
	const d = soDigitos(texto);
	if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
		return false;
	}
	const dv = n => {
		let soma = 0;
		for (let i = 0; i < n; i++) {
			soma += Number(d[i]) * (n + 1 - i);
		}
		const resto = (soma * 10) % 11;
		return resto === 10 ? 0 : resto;
	};
	return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

const PALAVRA = /^[\p{L}\p{M}'’-]+$/u;
const TEM_LETRA = /\p{L}/u;

/** Nome completo: a regra do `nome.ts` do servidor (duas palavras, so letras, 5..140). */
export function nomeCompletoValido(texto) {
	const nome = String(texto == null ? '' : texto)
		.normalize('NFC')
		.trim()
		.replace(/\s+/g, ' ');
	if (nome.length < 5 || nome.length > 140) {
		return false;
	}
	const palavras = nome.split(' ');
	return palavras.length >= 2 && palavras.every(p => PALAVRA.test(p) && TEM_LETRA.test(p));
}

/** O nome como vai no pedido: aparado, com um espaco entre as palavras. */
export function nomeParaEnvio(texto) {
	return String(texto == null ? '' : texto)
		.normalize('NFC')
		.trim()
		.replace(/\s+/g, ' ');
}

/** Tudo pronto para gerar o PIX? */
export function podeGerar({ cotacao, nome, cpf, aceite, disponivel }) {
	return !!(
		disponivel &&
		cotacao &&
		cotacao.ok === true &&
		nomeCompletoValido(nome) &&
		cpfValido(cpf) &&
		aceite === true
	);
}

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

/**
 * As recusas do `doacao-gerar`, com acento (o `texto` do servidor vem sem).
 * Codigo desconhecido cai no texto do servidor, e so entao no generico.
 */
const RECUSAS = {
	indisponivel: 'A doação está indisponível no momento. Tente mais tarde.',
	'quantidade-invalida': 'Quantidade inválida.',
	'abaixo-do-minimo': 'A doação mínima é de 5 RO Cash.',
	'acima-do-teto': 'Cada doação pode ser de no máximo R$ 2.000,00.',
	'nome-invalido': 'Informe o nome completo do titular da conta que vai pagar.',
	'cpf-invalido': 'CPF inválido. Confira os números.',
	'codigos-demais': 'Você já tem códigos PIX abertos. Pague um deles ou espere expirar (30 minutos).',
	'falha-na-efi': 'Não foi possível gerar o código agora. Tente de novo em instantes.'
};

export function textoDaRecusa(resposta) {
	const r = resposta || {};
	if (typeof r.recusa === 'string' && RECUSAS[r.recusa]) {
		return RECUSAS[r.recusa];
	}
	const t = typeof r.texto === 'string' ? r.texto.trim() : '';
	return t || 'Não foi possível gerar o código PIX. Tente de novo.';
}

/** A dica abaixo da quantidade quando ela nao cota. */
export function textoDaCotacaoRecusada(recusa, limites) {
	switch (recusa) {
		case 'abaixo-do-minimo':
		case 'invalida':
			return `A doação mínima é de ${formatarInteiro(limites.minimo)} RO Cash.`;
		case 'acima-do-maximo':
			return `Cada doação pode ser de no máximo ${formatarInteiro(limites.maximo)} RO Cash.`;
		case 'acima-do-teto':
			return `Cada doação pode ser de no máximo ${formatarReais(limites.tetoCentavos)}.`;
		default:
			return 'Carregando as faixas…';
	}
}

/** O aviso da divida de estorno, ou '' sem divida. */
export function textoDaDivida(dividaMinor) {
	if (!Number.isSafeInteger(dividaMinor) || dividaMinor <= 0) {
		return '';
	}
	return `Você tem uma dívida de ${formatarRoCash(dividaMinor)} RO Cash por um estorno. A próxima doação paga a dívida primeiro.`;
}

export function escapeHtml(valor) {
	return String(valor == null ? '' : valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * A imagem do QR so e aceita como data URI de imagem: o `src` vem do fio, e
 * uma URL qualquer ali faria o cliente buscar algo que o servidor nao disse.
 */
export function imagemDoQrSegura(uri) {
	return typeof uri === 'string' && /^data:image\/(svg\+xml|png|jpeg|gif|webp)[;,]/i.test(uri) ? uri : null;
}

export const LINKS = {
	termos: 'https://roclassicidle.com.br/termos.html',
	privacidade: 'https://roclassicidle.com.br/privacidade.html'
};
