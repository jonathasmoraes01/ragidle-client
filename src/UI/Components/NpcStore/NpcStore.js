/**
 * UI/Components/NpcStore/NpcStore.js
 *
 * Controlador de versao da loja de NPC — mesmo padrao de WinLogin/CharSelect.
 *
 * A V2 (01/09/2026, pedido do dono: "algo mais moderno e atual, que seja mais
 * facil de comprar", organizacao inspirada no Ragnarok Origin, forma 100% do
 * nosso design system) e uma janela SO: lista com busca, quantidade por
 * degrau +/- na propria linha, total vivo e um botao primario. A V1 e a
 * classica de duas janelas com arrasto, e fica como reserva: o override
 * `uiVersions: { NpcStore: 'default' }` no Config devolve a antiga sem tocar
 * em codigo (a valvula que ja salvou a WinLoginV2 no GRF LATAM).
 *
 * Quem consome (Engine/MapEngine/Store.js) chama NpcStore.getUI().<metodo> —
 * o contrato dos metodos e identico nas duas versoes, incluindo os ganchos de
 * DOM que o motor cutuca por seletor (.seller, .cashuser .buyer,
 * .cashuser .cashpoints, .priceLimit).
 */

import NpcStoreV1 from './NpcStoreV1/NpcStoreV1.js';
import NpcStoreV2 from './NpcStoreV2/NpcStoreV2.js';
import UIVersionManager from 'UI/UIVersionManager.js';

const publicName = 'NpcStore';

const versionInfo = {
	default: NpcStoreV1,
	common: {
		// A V2 nao depende de packetver de verdade (e UI nossa); o numero so
		// precisa ser <= ao packetver do projeto (20211103) pra ser eleita.
		20211103: NpcStoreV2
	},
	re: {},
	prere: {}
};

const Controller = UIVersionManager.getUIController(publicName, versionInfo);

export default Controller;
