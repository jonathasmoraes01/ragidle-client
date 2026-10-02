/**
 * O AVISO DE VOTO UMA VEZ POR LIBERACAO (30/09/2026) — a peca pura que decide
 * se o modal "Seu voto esta liberado!" abre.
 *
 * O servidor manda `avisar: true` UMA VEZ POR CONEXAO, sempre que ha voto
 * liberado (`avisarVotoNaEntrada`, servidor-mapa.ts). Conexao nova acontece o
 * tempo todo: reconexao automatica, vigia de silencio, recarga de versao,
 * deploy, reabrir o app no celular. Com o voto liberado e o jogador sem votar,
 * o modal voltava a cada uma delas — o "esta aparecendo muito (spam)" que os
 * jogadores reclamaram ao dono.
 *
 * A regra daqui NAO recalcula o "liberado" (a escolha 1 de VotoIdle.js: quem
 * decide e o servidor). Ela so LEMBRA o que ja mostrou: a MARCA de uma liberacao
 * e a conta, a plataforma e o `ultimoVotoMs` que o servidor mandou. Enquanto o
 * jogador nao vota, a marca e a mesma e o modal nao volta; quando um voto e
 * creditado e a plataforma libera de novo, o `ultimoVotoMs` muda, a marca e
 * nova e o modal aparece uma vez. O botao "Votar" continua pulsando o tempo
 * todo — ele e o sinal permanente.
 *
 * Puro: sem DOM, sem `Preferences`.
 */

/** Quantas marcas guardar. Duas plataformas por conta; sobra para trocar de conta no mesmo aparelho. */
export const MARCAS_GUARDADAS = 40;

/** As marcas das plataformas LIGADAS e LIBERADAS neste pacote. */
export function marcasLiberadas(conta, plataformas) {
	if (!Array.isArray(plataformas)) {
		return [];
	}
	return plataformas
		.filter(p => p && p.ligada && p.liberado)
		.map(p => `${String(conta)}:${String(p.id)}:${String(Number(p.ultimoVotoMs) || 0)}`);
}

/** Ha alguma liberacao que este aparelho ainda nao mostrou? */
export function temAvisoNovo(conta, plataformas, vistas) {
	const jaVistas = new Set(Array.isArray(vistas) ? vistas : []);
	return marcasLiberadas(conta, plataformas).some(m => !jaVistas.has(m));
}

/** As marcas vistas depois de mostrar este aviso: as novas no fim, as mais velhas saem primeiro. */
export function comAsVistas(conta, plataformas, vistas) {
	const antes = Array.isArray(vistas) ? vistas : [];
	const novas = marcasLiberadas(conta, plataformas).filter(m => !antes.includes(m));
	return [...antes, ...novas].slice(-MARCAS_GUARDADAS);
}
