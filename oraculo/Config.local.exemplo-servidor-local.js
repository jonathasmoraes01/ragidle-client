/**
 * Config do cliente para jogar contra o SERVIDOR DO RAG IDLE nesta maquina.
 *
 * Reconstruida em 18/08/2026 (o arquivo e gitignored e vivia so na maquina do
 * Jhow — docs/m0-baseline.md do repo principal cita exatamente estes valores):
 * - packetver 20211103: o pino de D-331 — o maior que as DUAS pontas suportam
 *   (src/Network/PacketVersions.js para em 20211103).
 * - packetKeys false: cliente pos-2018 usa chave zero (clif_obfuscation.hpp:
 *   421-422 do rAthena) — ligar quebraria o handshake do map-server.
 * - socketProxy ws://127.0.0.1:5999: o gravador de pacotes (oraculo/
 *   gravador-de-pacotes.js) — o proxy WS->TCP que TAMBEM e o grampo.
 * - remoteClient /remote-client/: o proxy do vite para o servidor de assets
 *   do repo principal (npm run oraculo:assets, porta 8000).
 *
 * Instalar com: npm run oraculo:config
 */
window.ROConfigLocal = {
	remoteClient: '/remote-client/',
	// A arte da WinLoginV2 nao existe no GRF ROLatam desta maquina
	// (bt_start_normal, bg_login.tga...): sem isto a tela de login vem
	// invisivel, com so o hover aparecendo. 'default' = a V1 classica,
	// que o GRF tem inteira (61 arquivos em login_interface).
	uiVersions: { WinLogin: 'default' },
	skipIntro: true,
	servers: [
		{
			display: 'Rag Idle (servidor local)',
			desc: 'o servidor TS do Rag Idle',
			address: '127.0.0.1',
			port: 6900,
			version: 25,
			langtype: 12,
			packetver: 20211103,
			renewal: true,
			worldMapSettings: { episode: 12 },
			packetKeys: false,
			socketProxy: 'ws://127.0.0.1:5999'
			// A LISTA DE ADMINISTRADORES SAIU DAQUI (28/08/2026).
			//
			// Ela era `adminList: [2000000]` — o equivalente do bloco <aid><admin>
			// do clientinfo.xml oficial, que decide quem o cliente desenha com o
			// sprite de GM e o nome amarelo.
			//
			// Estatica nao serve mais: no nosso servidor qualquer conta vira
			// administradora por comando, e uma lista cravada aqui so mudaria com
			// redeploy — dois conceitos de administrador discordando. Hoje quem
			// manda a lista e o SERVIDOR, no pacote 0x0fd0 (ZC_RAGIDLE_ADMINS),
			// logo no comeco do lote do mapa.
		}
	]
};
