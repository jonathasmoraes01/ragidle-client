/**
 * O PING DA REDE, SEPARADO DO PING DO JOGO (achado de rede 20, 15/10/2026,
 * D-2540 no repositorio do servidor).
 *
 * O ping que o jogador ve (e que o painel `/analytics` le) e o do JOGO: o
 * `CZ_REQUEST_TIME2` vai do navegador ate a thread do servidor e volta. Ele
 * soma a rede E a fila da thread do jogo — com o tique do p0 a 280-480 ms, o
 * numero nao diz qual das duas pesa. A varredura de 15/10 pediu o pedaco que
 * falta: so a rede.
 *
 * A ponte ja manda um `ping` de WebSocket a cada 30 s (D-1505). Ele e do
 * PROTOCOLO: o navegador responde o `pong` na pilha de rede, sem passar pelo
 * JavaScript da aba, e a resposta ecoa o mesmo conteudo. Entao basta o ping
 * levar o instante em que saiu: o `pong` que volta da o tempo de ida e volta
 * entre a ponte e o navegador (os dois saltos da Cloudflare e a internet do
 * jogador), sem a thread do jogo no meio.
 *
 * Junto, a cada ping, a ponte anota quantos bytes esperam no `bufferedAmount`
 * daquela conexao — a fila que o servidor nao ve (achado 19: ele so olha o
 * proprio socket, e a ponte segura ate 256 KiB antes de parar de ler). E o
 * numero que decide se vale baixar o teto.
 *
 * Tudo aqui so MEDE: uma linha por minuto no log da ponte. Nada no jogo muda.
 */

/** A janela de cada linha do log. */
export const JANELA_DA_REDE_MS = 60_000;

/** A partir de quantos bytes parados na ponte a fila conta como alta. */
export const FILA_ALTA_BYTES = 64 * 1024;

/** O teto de medidas guardadas por janela (500 conexoes a cada 30 s dao ~1.000). */
export const TETO_DE_MEDIDAS = 10_000;

/** O conteudo do ping: o instante em que ele saiu, em texto (o pong o ecoa). */
export function carimboDoPing(agora) {
	return Buffer.from(String(agora));
}

/**
 * O tempo de ida e volta que o pong diz, ou `null` quando ele nao veio de um
 * ping nosso (vazio, outro conteudo, ou um relogio que voltou).
 */
export function idaEVoltaDoPong(dados, agora) {
	const texto = dados === undefined || dados === null ? '' : String(dados);
	if (!/^\d{1,16}$/.test(texto)) return null;
	const saiu = Number(texto);
	if (!Number.isSafeInteger(saiu) || agora < saiu) return null;
	return agora - saiu;
}

function percentil(ordenadas, p) {
	const i = Math.min(ordenadas.length - 1, Math.ceil((p / 100) * ordenadas.length) - 1);
	return ordenadas[Math.max(0, i)];
}

export class MedidaDaRede {
	constructor(teto = TETO_DE_MEDIDAS) {
		this.teto = teto;
		this.medidas = [];
		this.amostrasDeFila = 0;
		this.filasAltas = 0;
		this.maiorFila = 0;
	}

	/** Um pong que voltou. */
	anotar(ms) {
		if (!Number.isFinite(ms) || ms < 0) return;
		if (this.medidas.length < this.teto) this.medidas.push(ms);
	}

	/** A fila parada na ponte de uma conexao, no instante do ping. */
	anotarFila(bytes) {
		if (!Number.isFinite(bytes) || bytes < 0) return;
		this.amostrasDeFila++;
		if (bytes >= FILA_ALTA_BYTES) this.filasAltas++;
		if (bytes > this.maiorFila) this.maiorFila = bytes;
	}

	/** Fecha a janela: o resumo, ou `null` se nada foi medido. */
	fechar() {
		const medidas = this.medidas;
		const amostrasDeFila = this.amostrasDeFila;
		const filasAltas = this.filasAltas;
		const maiorFila = this.maiorFila;
		this.medidas = [];
		this.amostrasDeFila = 0;
		this.filasAltas = 0;
		this.maiorFila = 0;
		if (medidas.length === 0 && amostrasDeFila === 0) return null;
		const ordenadas = medidas.slice().sort((a, b) => a - b);
		return {
			medidas: ordenadas.length,
			p50Ms: ordenadas.length === 0 ? null : percentil(ordenadas, 50),
			p95Ms: ordenadas.length === 0 ? null : percentil(ordenadas, 95),
			maiorMs: ordenadas.length === 0 ? null : ordenadas[ordenadas.length - 1],
			amostrasDeFila,
			filasAltas,
			maiorFilaKiB: Math.round(maiorFila / 1024)
		};
	}
}

/** A linha do log, com o nome fixo para o `grep` do dono. */
export function linhaDaRede(r) {
	const ms = (v) => (v === null ? '-' : `${String(v)} ms`);
	return (
		`[wsProxy] rede (pong, ${String(JANELA_DA_REDE_MS / 1000)} s): ${String(r.medidas)} medidas, ` +
		`p50 ${ms(r.p50Ms)}, p95 ${ms(r.p95Ms)}, maior ${ms(r.maiorMs)}; ` +
		`fila na ponte >= ${String(FILA_ALTA_BYTES / 1024)} KiB em ${String(r.filasAltas)} de ${String(r.amostrasDeFila)} amostras, maior ${String(r.maiorFilaKiB)} KiB`
	);
}
