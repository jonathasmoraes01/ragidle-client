/**
 * GERADOR DO Config.local.js DE PRODUCAO (E3 — "cliente no dominio"),
 * parametrizado por RAG_DOMINIO — para o dia em que o jogo sair do
 * Cloudflare Tunnel gratuito (URLs que mudam a cada reinicio do
 * `cloudflared`, documentado no cabecalho de `preparar-deploy.mjs`) para um
 * dominio proprio, com WebSocket/HTTP estaveis.
 *
 * NAO PUBLICA NADA — so gera o TEXTO do arquivo, em memoria. Quem decide
 * usar isto e `preparar-deploy.mjs`, e SO quando `RAG_DOMINIO` esta setada;
 * sem a variavel, o passo 4/6 continua copiando o `Config.local.js` de tunel
 * gravado a mao (`applications/deploy/Config.local.js`), byte a byte, como
 * hoje.
 *
 * OS TRES ENDERECOS (pedido do dono, E3): a ponte (WebSocket) em
 * `wss://ws.<dominio>`, os assets em `https://assets.<dominio>`, o balcao de
 * cadastro em `https://api.<dominio>`.
 *
 * O QUE NAO MUDA COM O DOMINIO: `address`/`port` do servidor continuam
 * `127.0.0.1:6900` — e o destino que o cliente pede A PONTE, resolvido do
 * lado dela (que roda ao lado do servidor do jogo), nunca pelo navegador
 * (mesmo comentario em `applications/deploy/Config.local.js:10-12`). Trocar
 * isso por um endereco publico quebraria o caminho.
 */

/**
 * @param {string} dominio - ex.: "ragidle.com.br" (sem protocolo, sem barra final)
 * @returns {string} o conteudo completo de Config.local.js
 */
export function gerarConfigLocalDeProducao(dominio) {
	if (typeof dominio !== 'string' || dominio.trim() === '') {
		throw new Error(
			'gerarConfigLocalDeProducao: dominio vazio — RAG_DOMINIO precisa ser algo como "ragidle.com.br"'
		);
	}
	const d = dominio.trim();
	return `/**
 * Config do DEPLOY DE PRODUCAO — GERADO por oraculo/gerar-config-de-producao.mjs
 * a partir de RAG_DOMINIO="${d}". NAO EDITE A MAO: edite o gerador, ou rode
 * \`RAG_DOMINIO=${d} node oraculo/preparar-deploy.mjs\` de novo.
 *
 * Os tres enderecos publicos deste dominio:
 *   ponte (WebSocket):   wss://ws.${d}
 *   assets:              https://assets.${d}
 *   balcao de cadastro:  https://api.${d}
 *
 * address/port continuam 127.0.0.1:6900 DE PROPOSITO — e o destino que o
 * cliente pede A PONTE, resolvido do lado dela na maquina do dono, nunca
 * pelo navegador.
 */
window.ROConfigLocal = {
	cadastroUrl: 'https://api.${d}',
	remoteClient: 'https://assets.${d}/',
	servers: [
		{
			display: 'Rag Idle',
			desc: 'cadastre-se com _M ou _F no fim do usuario',
			address: '127.0.0.1',
			port: 6900,
			packetver: 20211103,
			renewal: true,
			version: 55,
			langtype: 12,
			packetKeys: false,
			socketProxy: 'wss://ws.${d}',
			remoteClient: 'https://assets.${d}/',
			worldMapSettings: { episode: 21 },
			// VAZIA de proposito (ver applications/deploy/Config.local.js): o
			// SERVIDOR manda a lista de administradores em tempo de entrada
			// (ZC_RAGIDLE_ADMINS, 0x0fd0) e sobrescreve isto.
			adminList: []
		}
	],
	skipIntro: true,
	skipServerList: true,
	loadLua: false,
	packetDump: false,
	development: false
};
`;
}
