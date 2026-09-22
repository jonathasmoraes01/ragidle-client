/**
 * Utils/roCash.js
 *
 * A UNICA forma de escrever RO Cash na tela (RO Shop, 22/09/2026 - contrato
 * `docs/ro-shop/CONTRATO.md` do servidor, secao 1).
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE E MINOR, E O FORMATO E UM SO
 * ---------------------------------------------------------------------------
 * O servidor passou a guardar a carteira em MINOR UNITS inteiras (1 RO Cash =
 * 100): o catalogo tem preco de 1,50 e 3,50, e "nunca float" e regra do dono.
 * Todo campo de dinheiro no fio termina em `Minor`.
 *
 * O formato decidido (Agente 2, 22/09/2026): SEMPRE duas casas, virgula
 * decimal e ponto de milhar, sem simbolo - `862000 -> "8.620,00"`,
 * `350 -> "3,50"`, `200 -> "2,00"`. A unidade ("RO Cash") e texto VIZINHO,
 * escrito por quem desenha, nunca colado aqui: o card mostra "2,00 RO Cash",
 * a pilula da HUD mostra so o numero ao lado do rotulo "Cash".
 *
 * Por que sempre duas casas, e nao "8.620" quando os centavos sao zero: um
 * saldo de "8.620" ao lado de um preco "1,50" faria o jogador ler os dois
 * numeros em escalas diferentes. Um formato so, em todo lugar.
 *
 * NENHUMA conta passa por ponto flutuante: a parte inteira e o resto saem de
 * `Math.trunc`/`%` sobre um inteiro, e o milhar e posto por string (sem
 * `toLocaleString`, que muda com o navegador e com o Node dos testes).
 */

/** Minor units inteiras -> "8.620,00". Entrada invalida vira "0,00". */
export function formatarRoCash(minor) {
	const n = Math.trunc(Number(minor));
	if (!Number.isFinite(n)) {
		return '0,00';
	}
	const negativo = n < 0;
	const abs = Math.abs(n);
	const inteiro = String(Math.trunc(abs / 100));
	const centavos = String(abs % 100).padStart(2, '0');
	let milhar = '';
	for (let i = 0; i < inteiro.length; i++) {
		if (i > 0 && (inteiro.length - i) % 3 === 0) {
			milhar += '.';
		}
		milhar += inteiro[i];
	}
	return `${negativo ? '-' : ''}${milhar},${centavos}`;
}

/** Um numero e minor valido? (inteiro finito, nunca float nem string). */
export function ehMinor(valor) {
	return typeof valor === 'number' && Number.isInteger(valor);
}

/**
 * O VALOR EM MINOR de um objeto que pode vir na forma NOVA (`<campo>Minor`)
 * ou na forma ANTIGA (`<campo>` em RO Cash inteiro).
 *
 * A Temporada (v2) e o Passe mandavam RO Cash inteiro; o contrato do RO Shop
 * move tudo para minor (secao 5 do CONTRATO.md). Enquanto os dois lados nao
 * sobem juntos, a janela aceita as duas formas SEM adivinhar: o campo
 * `...Minor` ganha sempre; o inteiro antigo e multiplicado por 100, que e a
 * mesma conta da migracao do servidor (D-RS-02). Nada presente -> null.
 */
export function minorDe(objeto, campo) {
	if (!objeto || typeof objeto !== 'object') {
		return null;
	}
	const novo = objeto[`${campo}Minor`];
	if (ehMinor(novo)) {
		return novo;
	}
	const antigo = objeto[campo];
	if (ehMinor(antigo)) {
		return antigo * 100;
	}
	return null;
}

/**
 * O primeiro `minorDe` que existir, na ordem dos campos. Serve para quando a
 * versao nova trocou o NOME do campo, e nao so a unidade: o `ZC_RAGIDLE_PASSE`
 * v2 manda `passes[].precoMinor` e `saldoMinor` onde o v1 mandava `cash`
 * (CONTRATO.md do RO Shop, secao 5). `minorDePrimeiro(passe, ['preco', 'cash'])`
 * le `precoMinor`, depois `preco` x100, depois `cashMinor`, depois `cash` x100.
 */
export function minorDePrimeiro(objeto, campos) {
	for (const campo of campos || []) {
		const valor = minorDe(objeto, campo);
		if (valor !== null) {
			return valor;
		}
	}
	return null;
}
