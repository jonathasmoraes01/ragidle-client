/**
 * O PEDIDO DE CARGA DO MAPA QUE QUALQUER VERSAO DO WORKER ENTENDE (07/10/2026).
 *
 * A D-2055 passou o `LOAD_MAP` de `msg.data = "mapa.rsw"` para
 * `msg.data = { filename, carga }`. Em producao, no deploy dela, o fio principal
 * NOVO conversou com um `ThreadEventHandler.js` VELHO (o worker tem nome fixo,
 * sem o `?v=` dos bundles), que faz `map.load(msg.data)`: o objeto virava
 * "[object Object]" e a carga falhava com `Can't find file "[object Object]"`
 * (8 relatos no /analytics na primeira meia hora).
 *
 * Agora o nome do mapa volta a ser o `data` (TEXTO, o contrato antigo) e o
 * numero da carga vai num campo a parte do envelope (`msg.carga`), que o
 * worker velho ignora. O worker novo aceita as tres formas: o texto com o
 * numero ao lado (o `MapRenderer` de hoje), o texto sozinho (o GrfViewer) e o
 * objeto (o `MapRenderer` da D-2055, que pode estar aberto numa aba velha).
 *
 * @param {{ data: unknown, carga?: unknown }} msg
 * @returns {{ filename: string, carga: number | undefined }}
 */
export function pedidoDeCargaDoMapa(msg) {
	const dado = msg.data;
	if (typeof dado === 'string') {
		return { filename: dado, carga: typeof msg.carga === 'number' ? msg.carga : undefined };
	}
	if (dado && typeof dado === 'object' && typeof dado.filename === 'string') {
		return { filename: dado.filename, carga: typeof dado.carga === 'number' ? dado.carga : undefined };
	}
	return { filename: String(dado), carga: undefined };
}
