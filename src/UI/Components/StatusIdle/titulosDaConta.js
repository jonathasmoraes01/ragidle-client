/**
 * TITULOS E AURA DA CONTA - Recompensas do Alfa, 23/09/2026.
 *
 * O UNICO dono do ZC_RAGIDLE_TITULOS_E_AURA (0x0fb6): `Network.hookPacket`
 * SUBSTITUI o handler do opcode (memoria "hookPacket substitui e rouba o
 * pacote"; portao `um-dono-por-pacote.test.ts` no servidor). Quem mais quiser
 * saber do estado assina aqui (`assinar`), nunca fisga o pacote.
 *
 * O que ele faz:
 * - registra o TEXTO dos titulos do jogo (90001+) no TitleTable do cliente,
 *   que e de onde `DB.getTitleString` tira o que o letreiro desenha;
 * - reaplica o texto nos letreiros que ja receberam o 0x0a30 ANTES da tabela
 *   chegar (o id fica em `display.title_id`, ver Engine/MapEngine/Entity.js);
 * - manda os tres verbos do contrato: pedir o estado, equipar/remover titulo
 *   (o nativo 0x0a2e). A aura virou ITEM de costume em 23/09/2026 e nao passa
 *   por aqui.
 *
 * O cliente nao decide posse: o seletor lista o que o servidor diz que a conta
 * tem, e mesmo assim o servidor revalida cada pedido.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import DB from 'DB/DBManager.js';
import EntityManager from 'Renderer/EntityManager.js';
import { estadoVazio, lerEstadoDeTitulos } from './formatoDosTitulos.js';

let _estado = estadoVazio();
const _assinantes = new Set();

function avisar() {
	for (const fn of _assinantes) {
		try {
			fn(_estado);
		} catch (e) {
			console.error('[titulos] assinante falhou', e);
		}
	}
}

/** Reaplica o texto nos letreiros que tem id de titulo mas ainda nao o texto. */
function reaplicarNosLetreiros() {
	EntityManager.forEach(entity => {
		const display = entity && entity.display;
		if (!display || !display.title_id) {
			return true;
		}
		const nome = DB.getTitleString(display.title_id);
		if (nome && nome !== display.title_name) {
			display.title_name = nome;
			display.refresh(entity);
		}
		return true;
	});
}

/*
 * Defensivo por regra do projeto: uma excecao num handler aborta o laco de
 * rede e descarta o resto do quadro WS (memoria "excecao no laco de rede do
 * cliente").
 */
function onEstado(pkt) {
	try {
		const novo = lerEstadoDeTitulos(pkt.json);
		if (!novo) {
			return;
		}
		for (const def of novo.definicoes) {
			DB.registrarTitulo(def.id, def.nome);
		}
		_estado = novo;
		reaplicarNosLetreiros();
		avisar();
	} catch (e) {
		console.error('[titulos] 0x0fb6 ilegivel', e);
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_TITULOS_E_AURA, onEstado);

function enviar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_TITULOS_E_AURA();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

const TitulosDaConta = {
	estado: () => _estado,

	/** @returns {function} para cancelar a assinatura */
	assinar(fn) {
		_assinantes.add(fn);
		return () => _assinantes.delete(fn);
	},

	pedir() {
		enviar({ acao: 'pedir' });
	},

	/** 0 remove. O servidor responde 0x0a2f e reenvia o 0x0fb6. */
	equipar(tituloId) {
		const pkt = new PACKET.CZ.REQ_CHANGE_TITLE();
		pkt.title_id = Number.isInteger(tituloId) && tituloId > 0 ? tituloId : 0;
		Network.sendPacket(pkt);
	},

	/** Troca de personagem: o proximo estado vem do servidor na entrada no mapa. */
	limpar() {
		_estado = estadoVazio();
		avisar();
	}
};

export default TitulosDaConta;
