/**
 * O `doacao-estado` de exemplo, fiel ao que o servidor manda
 * (servidor/doacao/janela-da-doacao.ts, `estadoDaJanela`) com as faixas de
 * 23/09/2026 (servidor/doacao/faixas.ts). Usado pelos testes e pela prova de
 * tela; o cliente NAO le estes numeros em producao - eles vem no fio.
 */
export function estadoDaDoacao(sobrescrever = {}) {
	return {
		tipo: 'doacao',
		acao: 'doacao-estado',
		disponivel: true,
		minimo: 5,
		maximo: 2898,
		tetoCentavos: 200000,
		faixas: [
			{ aPartirDe: 5, precoPorCashCentavos: 100 },
			{ aPartirDe: 50, precoPorCashCentavos: 94 },
			{ aPartirDe: 100, precoPorCashCentavos: 89 },
			{ aPartirDe: 250, precoPorCashCentavos: 83 },
			{ aPartirDe: 500, precoPorCashCentavos: 79 },
			{ aPartirDe: 1000, precoPorCashCentavos: 69 }
		],
		bonusPercent: 0,
		dividaMinor: 0,
		abertos: [],
		...sobrescrever
	};
}

/** Um QR de exemplo em data URI SVG (o formato que a Efi devolve). */
export const QR_DE_EXEMPLO =
	'data:image/svg+xml;base64,' +
	(typeof btoa === 'function' ? btoa : s => Buffer.from(s, 'utf8').toString('base64'))(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges">' +
			'<rect width="29" height="29" fill="#fff"/>' +
			'<path d="M1 1h7v7H1zM21 1h7v7h-7zM1 21h7v7H1z" fill="#000"/>' +
			'<path d="M2 2h5v5H2zM22 2h5v5h-5zM2 22h5v5H2z" fill="#fff"/>' +
			'<path d="M3 3h3v3H3zM23 3h3v3h-3zM3 23h3v3H3zM10 2h2v2h-2zM13 4h2v3h-2zM10 9h4v2h-4zM16 10h3v3h-3zM9 14h2v5H9zM12 16h3v2h-3zM20 12h2v4h-2zM23 15h4v2h-4zM17 20h3v3h-3zM21 22h2v5h-2zM24 19h3v2h-3zM11 21h2v6h-2zM14 24h4v2h-4z" fill="#000"/>' +
			'</svg>'
	);

/** A resposta de um `doacao-gerar` aceito. */
export function geradaDeExemplo(agoraMs, sobrescrever = {}) {
	return {
		tipo: 'doacao',
		acao: 'doacao-gerar',
		ok: true,
		txid: 'RAGIDLEDOACAO0000000000000000001',
		quantidade: 100,
		creditoMinor: 10000,
		totalCentavos: 8900,
		copiaECola:
			'00020101021226830014BR.GOV.BCB.PIX2561qrcodespix.sejaefi.com.br/v2/41e0badf811a4ce6ad8a80b306821fce5204000053039865802BR5905EFISA6008SAOPAULO62070503***61040000',
		imagemQrcode: QR_DE_EXEMPLO,
		expiraEmMs: agoraMs + (29 * 60 + 41) * 1000,
		...sobrescrever
	};
}
