/**
 * UI/Components/StatusIdle/geraisDaFicha.js
 *
 * A secao "Gerais" da janela de Status e as secoes RECOLHIVEIS (25/09/2026,
 * pedido do dono): *"a ideia e o player saber na pratica os atributos gerais
 * (incluindo o Codex) e como eles estao impactando o status atual"*, e as
 * secoes Atributos, Estatisticas e Gerais recolhem *"para reduzir essa UI que
 * vai ficar enorme"*.
 *
 * Estado puro: sem DOM, sem rede, sem timer -- roda no Node dos testes. Quem
 * desenha e `StatusIdle.js`; aqui mora o que DECIDE (o texto de cada linha, o
 * que e ignorado, e o estado de recolhido).
 *
 * ── O CAMPO `gerais` E ADITIVO, E A VERSAO DA FICHA NAO SUBIU ─────────────
 * O servidor manda `ficha.gerais` (uma lista de linhas) DENTRO da ficha v2,
 * sem trocar o `v`. No mesmo dia, o Codex subiu o retrato dele para v2 e a
 * guarda `v !== 1` desta mesma base descartou a resposta em silencio -- a
 * janela ficou em "Carregando" para sempre. Aqui o contrario: servidor velho
 * nao manda o campo e a secao some; chave desconhecida (linha nova de um
 * servidor mais novo) e PULADA, e nao derruba a ficha inteira. Numero, rotulo e
 * unidade sao conferidos linha a linha -- linha estragada sai, as outras ficam.
 *
 * ── OS NUMEROS SAO DO SERVIDOR ─────────────────────────────────────────────
 * Cada valor e o que o motor calcula (`servidor/ficha-gerais.ts`, no repo do
 * servidor, cita a fonte de cada um). Este arquivo so FORMATA: nenhuma conta
 * de jogo acontece aqui.
 */

/** As secoes que recolhem, na ordem da janela. "Personagem" nao recolhe. */
export const SECOES_RECOLHIVEIS = ['atributos', 'estatisticas', 'gerais'];

/**
 * O que a janela escreve para cada chave, e se o numero leva sinal.
 *
 * `sinal`: bonus e reducao sao ACRESCIMOS, entao "+10%" le certo. Esquiva
 * perfeita e custo de SP sao TAXAS absolutas ("2,5%", "85%"), e um "+" ali
 * diria que o personagem ganhou algo que ele so tem.
 */
export const ROTULOS = {
	regenHp: { rotulo: 'Recuperação de HP', sinal: false, dica: 'HP recuperado por segundo, parado e sem efeitos de status.' },
	regenSp: { rotulo: 'Recuperação de SP', sinal: false, dica: 'SP recuperado por segundo, parado e sem efeitos de status.' },
	danoFisico: { rotulo: 'Dano físico', sinal: true, dica: 'Dano físico causado a mais, contra qualquer alvo.' },
	danoMagico: { rotulo: 'Dano mágico', sinal: true, dica: 'MATK a mais (equipamento e Codex, um multiplicando o outro).' },
	reducaoFisica: { rotulo: 'Redução de dano físico', sinal: true, dica: 'Dano físico recebido a menos, de qualquer atacante.' },
	reducaoMagica: { rotulo: 'Redução de dano mágico', sinal: true, dica: 'Dano mágico recebido a menos, de qualquer atacante.' },
	hpMaximo: { rotulo: 'HP máximo', sinal: false, dica: 'HP máximo atual, já com equipamento, buffs e Codex.' },
	spMaximo: { rotulo: 'SP máximo', sinal: false, dica: 'SP máximo atual, já com equipamento, buffs e Codex.' },
	ataquesPorSegundo: { rotulo: 'Ataques por segundo', sinal: false, dica: 'Golpes básicos por segundo, pela velocidade de ataque atual.' },
	esquivaPerfeita: { rotulo: 'Esquiva perfeita', sinal: false, dica: 'Chance de anular o golpe inteiro, inclusive crítico.' },
	danoCorpoACorpo: { rotulo: 'Dano corpo a corpo', sinal: true, dica: 'Dano a mais nos golpes de perto.' },
	danoADistancia: { rotulo: 'Dano à distância', sinal: true, dica: 'Dano a mais nos golpes de longe.' },
	danoCritico: { rotulo: 'Dano crítico', sinal: true, dica: 'Dano a mais quando o golpe sai crítico.' },
	reducaoADistancia: { rotulo: 'Redução de dano à distância', sinal: true, dica: 'Dano recebido de longe a menos.' },
	custoDeSp: { rotulo: 'Custo de SP', sinal: false, dica: 'Quanto do custo de SP das habilidades você paga.' },
	curaConjurada: { rotulo: 'Poder de cura', sinal: true, dica: 'Cura conjurada a mais.' }
};

const UNIDADES = ['porSegundo', 'porcento', 'pontos'];

/**
 * "1.234" / "2,17" / "0,5" -- pt-BR, no maximo duas casas, sem zero pendurado.
 * O servidor ja arredondou; o `toFixed(2)` aqui so impede que um 0,1 + 0,2 de
 * ponto flutuante chegue na tela como 0,30000000000000004.
 */
export function formatarNumero(n) {
	const negativo = n < 0;
	const [inteira, fracao] = Math.abs(n).toFixed(2).split('.');
	let milhar = '';
	for (let i = 0; i < inteira.length; i++) {
		if (i > 0 && (inteira.length - i) % 3 === 0) {
			milhar += '.';
		}
		milhar += inteira[i];
	}
	const casas = fracao.replace(/0+$/, '');
	return (negativo ? '-' : '') + milhar + (casas ? ',' + casas : '');
}

function comSinal(n, texto) {
	return n > 0 ? '+' + texto : texto;
}

function comUnidade(unidade, texto) {
	if (unidade === 'porSegundo') return texto + '/s';
	if (unidade === 'porcento') return texto + '%';
	return texto;
}

/** O texto do valor da linha: "+10,55%", "2,17/s", "5.230". */
export function textoDoValor(linha, def) {
	const base = comUnidade(linha.unidade, formatarNumero(linha.valor));
	return def.sinal ? comSinal(linha.valor, base) : base;
}

/**
 * A parte do Codex, ou string vazia.
 *
 * - `codex === null`: o servidor NAO conseguiu medir -- nada na linha (o title
 *   diz por que). Escrever "Codex +0" seria afirmar uma medicao que nao houve;
 * - zero de tudo: nada. O jogador sem Codex nao le "Codex +0" em dez linhas;
 * - onde o Codex multiplica outra grandeza, o percentual que o motor aplica vai
 *   entre parenteses: "Codex +26 (+0,5%)".
 */
export function textoDoCodex(linha) {
	const codex = linha.codex;
	const porcento = Number.isFinite(linha.codexPorcento) ? linha.codexPorcento : 0;
	if (codex === null || codex === undefined || !Number.isFinite(codex)) return '';
	if (codex === 0 && porcento === 0) return '';
	const doPorcento = porcento !== 0 ? comSinal(porcento, formatarNumero(porcento) + '%') : '';
	if (codex === 0) return 'Codex ' + doPorcento;
	const doValor = comSinal(codex, comUnidade(linha.unidade, formatarNumero(codex)));
	return 'Codex ' + doValor + (doPorcento && linha.unidade !== 'porcento' ? ' (' + doPorcento + ')' : '');
}

function segundos(ms) {
	return formatarNumero(ms / 1000) + ' s';
}

/** O title da linha: a dica, os canais de recuperacao e o que nao deu para medir. */
export function tituloDaLinha(linha, def) {
	const partes = [def.rotulo + ': ' + textoDoValor(linha, def), def.dica];
	const recurso = linha.chave === 'regenSp' ? 'SP' : 'HP';
	if (Array.isArray(linha.canais)) {
		for (const c of linha.canais) {
			if (!c || !Number.isFinite(c.quantidade) || !Number.isFinite(c.intervaloMs) || c.intervaloMs <= 0) continue;
			const fonte = c.fonte === 'habilidade' ? 'Habilidade' : 'Natural';
			partes.push(fonte + ': ' + formatarNumero(c.quantidade) + ' ' + recurso + ' a cada ' + segundos(c.intervaloMs));
		}
	}
	if (linha.codex === null) {
		partes.push('Não foi possível medir a parte do Codex agora.');
	}
	return partes.join('\n');
}

/**
 * As linhas prontas para desenhar, ou `null` quando o servidor nao mandou a
 * secao (servidor anterior a 25/09/2026) -- e ai a janela esconde o card em vez
 * de mostrar um "Gerais" vazio que parece defeito.
 */
export function linhasParaDesenhar(gerais) {
	if (!Array.isArray(gerais)) return null;
	const saida = [];
	for (const linha of gerais) {
		if (!linha || typeof linha !== 'object') continue;
		const def = Object.prototype.hasOwnProperty.call(ROTULOS, linha.chave) ? ROTULOS[linha.chave] : null;
		if (!def) continue; // chave de um servidor mais novo: pula so ela
		if (!UNIDADES.includes(linha.unidade) || !Number.isFinite(linha.valor)) continue;
		saida.push({
			chave: linha.chave,
			rotulo: def.rotulo,
			valor: textoDoValor(linha, def),
			codex: textoDoCodex(linha),
			titulo: tituloDaLinha(linha, def)
		});
	}
	return saida;
}

/* ── As secoes recolhidas ─────────────────────────────────────────────────
 *
 * Guardadas por quem VE a janela (Preferences/localStorage), e nao no servidor:
 * e conveniencia de tela, e cada aparelho do mesmo jogador pode querer outra
 * (o celular em pe recolhe mais que o monitor).
 */

/** Le o que veio do armazenamento: so secoes conhecidas, sem repeticao. */
export function lerRecolhidas(bruto) {
	if (!Array.isArray(bruto)) return [];
	return SECOES_RECOLHIVEIS.filter(s => bruto.includes(s));
}

/** Recolhe a secao aberta e abre a recolhida. Secao desconhecida nao muda nada. */
export function alternarSecao(recolhidas, secao) {
	const atual = lerRecolhidas(recolhidas);
	if (!SECOES_RECOLHIVEIS.includes(secao)) return atual;
	return atual.includes(secao) ? atual.filter(s => s !== secao) : lerRecolhidas(atual.concat(secao));
}

export function estaRecolhida(recolhidas, secao) {
	return lerRecolhidas(recolhidas).includes(secao);
}

export default {
	SECOES_RECOLHIVEIS,
	ROTULOS,
	formatarNumero,
	textoDoValor,
	textoDoCodex,
	tituloDaLinha,
	linhasParaDesenhar,
	lerRecolhidas,
	alternarSecao,
	estaRecolhida
};
