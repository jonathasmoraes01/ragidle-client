/**
 * ROBrowser Configuration - Default Settings
 *
 * This file contains default configuration values.
 * To override settings without modifying this file, create Config.local.js
 * with your custom values in window.ROConfigLocal.
 *
 * Example Config.local.js:
 *   window.ROConfigLocal = {
 *       servers: [{ display: 'My Server', address: '192.168.1.1', ... }],
 *       skipIntro: false
 *   };
 *
 * Ragnarok Classic Idle: `skipIntro` defaults to true HERE, not only in the
 * gitignored Config.local.js, because this file is the one every checkout
 * and deployment actually ships with. The GRF-selection Intro screen is a
 * roBrowser diagnostic/dev tool, never something a player should see; the
 * safe behavior has to be the one that ships by default, not one that
 * depends on a local file nobody is forced to create. To bring Intro back
 * for diagnostics, set `skipIntro: false` in Config.local.js.
 */
window.ROConfigBase = {
	type: 'FRAME',
	application: 'ONLINE',
	development: true,
	remoteClient: 'https://grf.robrowser.com/',
	servers: [
		{
			display: 'roBrowser Demo Server',
			desc: 'demo server',
			address: '127.0.0.1',
			port: 6900,
			version: 25,
			langtype: 12,
			packetver: 20130618,
			renewal: false,
			worldMapSettings: { episode: 12 },
			packetKeys: false,
			socketProxy: 'wss://connect.robrowser.com'
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
		// ADD PUBLIC TEST SERVERS HERE WITH _M _F REGISTRATION
	],
	packetDump: false,
	skipServerList: true,
	skipIntro: true,
	aura: {},
	autoLogin: [],
	BGMFileExtension: ['mp3'],
	calculateHash: false,
	CameraMaxZoomOut: 5,
	charBlockSize: 0,
	clientHash: null,
	clientVersionMode: 'PacketVer',
	disableConsole: false,
	enableAchievements: false,
	enableBank: false,
	/*
	 * A LOJA DE CASH TEM DE ESTAR LIGADA (RAGIDLE, I5 — 31/08/2026).
	 *
	 * Esta linha dizia `false`, e era o que fazia o item "RO Shop" do menu
	 * clicar e NAO ACONTECER NADA — o sintoma zero de sempre. Ela guarda TRES
	 * coisas em `MapEngine.js`, e nenhuma delas roda com `false`:
	 *
	 *   - `CashShopEngine()`, que registra os handlers dos pacotes da loja;
	 *   - `CashShop.prepare()`, sem o qual `CashShop.ui` fica `null` (o erro era
	 *     literalmente `Cannot read properties of null (reading 'is')`);
	 *   - `CashShopIcon.prepare()`, do icone solto que se aposentou da tela.
	 *
	 * O servidor SEMPRE atendeu o pedido (`CZ_SE_CASHSHOP_OPEN2` ->
	 * `ZC_SE_CASHSHOP_OPEN` + as abas, `servidor-mapa.ts:17147`). Quem nao
	 * escutava era o cliente.
	 */
	enableCashShop: true,
	enableCheckAttendance: false,
	enableDmgSuffix: false,
	enableHomunAutoFeed: false,
	enableMapName: false,
	FirstPersonCamera: false,
	grfList: null,
	hashFiles: [],
	loadLua: false,
	onReady: null,
	plugins: {},
	registrationweb: '',
	saveFiles: true,
	ThirdPersonCamera: false,
	transitionDuration: 500
};
