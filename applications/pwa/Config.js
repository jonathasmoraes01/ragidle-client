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
	/*
	 * D-937 — A BANDEIRA DE ROLLOUT DA HUD ADAPTAVEL.
	 *
	 * `true` e o estado normal. Pondo `false` no `Config.local.js` — que e
	 * publicado como arquivo SEPARADO, com `Cache-Control: no-cache` —, o jogo
	 * volta ao layout anterior **sem rebuild e sem esperar cache**.
	 *
	 * Ela desliga as tres camadas de 05/09 que mudam a APARENCIA: o `zoom` que
	 * encolhe a HUD (D-934), a janela virando painel de tela cheia (D-932) e as
	 * bordas seguras (D-936). NAO desliga as faixas de largura e altura
	 * (D-929/D-930): elas so agem em tela pequena, onde o layout anterior
	 * estava medidamente quebrado — desliga-las devolveria o defeito.
	 */
	enableHudAdaptavel: true,
	enableCashShop: true,
	enableCheckAttendance: false,
	enableDmgSuffix: false,
	enableHomunAutoFeed: false,
	enableMapName: false,
	/*
	 * A JANELA DE REFINO (01/09/2026, queixa do dono: *"clico no Hollgrehenn e
	 * nao acontece nada"*).
	 *
	 * Os dois lados do refino ja existiam e mesmo assim o clique era MUDO,
	 * porque esta chave ausente (que e o mesmo que `false`) desliga tres coisas:
	 *
	 *   - `Refine.prepare()` (`src/Engine/MapEngine.js:539`), sem o qual a
	 *     janela nao tem `ui` para aparecer;
	 *   - `onOpenRefineUI` (`src/UI/Components/Refine/Refine.js:371`), que
	 *     recebe o `ZC_OPEN_REFINING_UI` e RETORNA sem abrir nada — deixando so
	 *     um `console.warn` que ninguem le enquanto joga;
	 *   - o resultado do refino (`src/Engine/MapEngine/Item.js:421`).
	 *
	 * O servidor SEMPRE atendeu: `npc.tipo === 'refino'` -> `ZC_OPEN_REFINING_UI`
	 * (`rag-idle-master/servidor/mapa/servidor-mapa.ts:21014`), e por isso as
	 * provas de TCP (`prove:refino`, `prove-ferreiro-na-casa`) sao verdes com o
	 * jogador vendo nada acontecer. Quem nao escutava era o cliente — a MESMA
	 * forma do `enableCashShop` logo acima.
	 *
	 * A outra metade da guarda ja passava: `packetver` 20211103 >= 20161012.
	 */
	enableRefineUI: true,
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
