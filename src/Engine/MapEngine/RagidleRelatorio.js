/**
 * Engine/MapEngine/RagidleRelatorio.js
 *
 * RAGIDLE: the unattended-session return report (0x0ffc, server D-275/D-276).
 * When the player reconnects after the character kept farming with the client
 * closed, the server sends a one-shot JSON summary right after the map lot.
 * This engine prints it into the ChatBox — the humble, always-visible UI —
 * so the report never depends on any window being open.
 *
 * Contract v1 (server-side `servidor/mapa/servidor-mapa.ts`):
 *   { v: 1, abates, baseExp, jobExp, niveisBase, niveisJob,
 *     itens: [{ nome, quantidade }], encerradoPorCap }
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';

class RagidleRelatorioEngine {
	static init() {
		Network.hookPacket(PACKET.ZC.RAGIDLE_RELATORIO_OFFLINE, onRelatorio);
	}
}

function onRelatorio(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[RagidleRelatorio] Relatório offline ilegível:', e, pkt.json);
		return;
	}
	if (!data || data.v !== 1) {
		console.error('[RagidleRelatorio] Contrato incompatível (v=' + (data && data.v) + ').', data);
		return;
	}

	const linhas = [];
	linhas.push('[Enquanto você esteve fora]');
	linhas.push(
		'Abates: ' + (data.abates | 0) + ' · Exp: +' + (data.baseExp | 0) + ' base, +' + (data.jobExp | 0) + ' classe'
	);
	if ((data.niveisBase | 0) > 0 || (data.niveisJob | 0) > 0) {
		linhas.push('Níveis: +' + (data.niveisBase | 0) + ' base, +' + (data.niveisJob | 0) + ' de classe');
	}
	if (Array.isArray(data.itens) && data.itens.length) {
		linhas.push('Itens: ' + data.itens.map(i => i.nome + ' x' + (i.quantidade | 0)).join(', '));
	}
	if (data.encerradoPorCap) {
		linhas.push('A sessão desassistida atingiu o limite e o personagem parou de caçar.');
	}

	// FARM_LOG, nao PUBLIC_LOG (20/08/2026): o relatorio da sessao
	// desassistida e o resumo da CACA — abates, exp, niveis e itens. Ele
	// pertence ao canal Farm, junto com o log ao vivo da mesma coisa.
	linhas.forEach(l => ChatBox.addText(l, ChatBox.TYPE.BLUE, ChatBox.FILTER.FARM_LOG));
}

export default RagidleRelatorioEngine;
