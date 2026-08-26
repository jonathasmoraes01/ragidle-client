/**
 * OS SLOTS DE FANTASIA DA MOCHILA (pedido do dono, 26/08/2026): "ja coloque
 * a opcao de costume no nosso inventario tambem, tanto para equipar como na
 * mochila".
 *
 * O que estes casos guardam:
 *
 * 1. O RECONHECIMENTO (eDeFantasia): e a mascara de vestir do proprio item
 *    que diz se ele e costume -- o mesmo dado que decide em qual slot ele
 *    cai. Um chapeu comum (HEAD_TOP) NAO pode ler como fantasia, senao o
 *    selo da grade mente; e shadow gear (SHADOW_*) tambem nao, apesar de a
 *    celula nativa do robe de costume se chamar "shadow_garment" (ver 2).
 *
 * 2. O CONTRATO COM O HOST NATIVO ESCONDIDO: syncEquipSlots le a peca
 *    vestida da celula da Equipment nativa pela CLASSE. Para costume as
 *    celulas moram na tabela #costume de EquipmentV3.html (a versao que o
 *    PACKETVER 20211103 seleciona) -- e a do robe se chama
 *    '.shadow_garment', porque getSelectorFromLocation
 *    (EquipmentCommon.js:79) mapeia COSTUME_ROBE para la e
 *    '.costume_garment' NAO existe no HTML. Quem "corrigir" esse nome em
 *    slotsDeFantasia.js quebra a leitura em silencio (o slot ficaria vazio
 *    para sempre, com a asa vestida). Estes casos leem o FONTE dos dois
 *    lados do contrato -- mesma tecnica de hudIdleLeDaEntidade.test.js:
 *    levantar a janela de verdade exigiria WebGL + GRF + sessao logada, e o
 *    que importa aqui e o contrato entre arquivos distantes, que se confere
 *    no texto.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import EquipLocation from 'DB/Items/EquipmentLocation.js';
import {
	FANTASIA_SLOTS,
	MASCARA_DE_FANTASIA,
	eDeFantasia
} from 'UI/Components/MochilaIdle/slotsDeFantasia.js';

const ler = nome => readFileSync(join(process.cwd(), 'src', nome), 'utf8');

describe('eDeFantasia -- o item e costume?', () => {
	it('cada bit de costume, sozinho, e fantasia (FLOOR incluso: reconhecer nao exige slot)', () => {
		const bits = ['COSTUME_HEAD_TOP', 'COSTUME_HEAD_MID', 'COSTUME_HEAD_BOTTOM', 'COSTUME_ROBE', 'COSTUME_FLOOR'];
		bits.forEach(nome => {
			expect(eDeFantasia(EquipLocation[nome]), nome).toBe(true);
		});
	});

	it('nenhum slot normal -- nem shadow -- e fantasia', () => {
		const bits = [
			'HEAD_TOP', 'HEAD_MID', 'HEAD_BOTTOM', 'ARMOR', 'WEAPON', 'SHIELD',
			'GARMENT', 'SHOES', 'ACCESSORY1', 'ACCESSORY2', 'AMMO',
			'SHADOW_ARMOR', 'SHADOW_WEAPON', 'SHADOW_SHIELD', 'SHADOW_SHOES',
			'SHADOW_R_ACCESSORY_SHADOW', 'SHADOW_L_ACCESSORY_SHADOW'
		];
		bits.forEach(nome => {
			expect(eDeFantasia(EquipLocation[nome]), nome).toBe(false);
		});
	});

	it('mascara combinada comum do RO (chapeu topo+meio) segue nao sendo fantasia', () => {
		expect(eDeFantasia(EquipLocation.HEAD_TOP | EquipLocation.HEAD_MID)).toBe(false);
	});

	it('zero/ausente nunca e fantasia (item nao equipavel: pocao, carta, etc)', () => {
		expect(eDeFantasia(0)).toBe(false);
		expect(eDeFantasia(undefined)).toBe(false);
	});
});

describe('FANTASIA_SLOTS -- o contrato com o host nativo escondido', () => {
	const htmlNativo = ler('UI/Components/Equipment/EquipmentV3/EquipmentV3.html');

	it('sao exatamente os 4 slots com celula nativa (FLOOR fica de fora: sem bit no servidor, sem celula no host)', () => {
		expect(FANTASIA_SLOTS.map(s => s.location)).toEqual([
			EquipLocation.COSTUME_HEAD_TOP,
			EquipLocation.COSTUME_HEAD_MID,
			EquipLocation.COSTUME_HEAD_BOTTOM,
			EquipLocation.COSTUME_ROBE
		]);
	});

	it('toda celula que a Mochila le EXISTE no HTML da Equipment nativa', () => {
		FANTASIA_SLOTS.forEach(slot => {
			expect(htmlNativo, `celula .${slot.cls}`).toMatch(new RegExp(`class="${slot.cls}[" ]`));
		});
	});

	it("a celula do robe e '.shadow_garment' -- e 'costume_garment' NAO existe para cair no lugar", () => {
		const robe = FANTASIA_SLOTS.find(s => s.location === EquipLocation.COSTUME_ROBE);
		expect(robe.cls).toBe('shadow_garment');
		// A armadilha que este caso prega: o nome "obvio" nao existe no host.
		expect(htmlNativo).not.toContain('costume_garment');
		// E o outro lado do contrato: e NELA que o equip() nativo escreve.
		const common = ler('UI/Components/Equipment/EquipmentCommon.js');
		expect(common).toMatch(/COSTUME_ROBE\)\s*selector\.push\('\.shadow_garment'\)/);
	});

	it('cada slot esta dentro da mascara de reconhecimento (selo e slot nunca discordam)', () => {
		FANTASIA_SLOTS.forEach(slot => {
			expect(MASCARA_DE_FANTASIA & slot.location, slot.label).toBe(slot.location);
		});
	});
});

describe('a janela liga as pecas', () => {
	it('syncEquipSlots desenha os slots de fantasia junto dos normais, e a grade sela o item de costume', () => {
		const js = ler('UI/Components/MochilaIdle/MochilaIdle.js');
		// O spread e o que garante UMA passada so (mesma assinatura, mesmos
		// handlers delegados) -- remover FANTASIA_SLOTS daqui deixaria a
		// fileira vazia pra sempre sem nenhum erro.
		expect(js).toMatch(/\[\.\.\.EQUIP_SLOTS, \.\.\.FANTASIA_SLOTS\]/);
		expect(js).toContain('mo-fantasia-slots');
		// O selo da grade usa o MESMO criterio do slot (eDeFantasia).
		expect(js).toContain('mo-item-fantasia');
		expect(js).toContain('eDeFantasia(');

		const html = ler('UI/Components/MochilaIdle/MochilaIdle.html');
		expect(html).toContain('mo-fantasia-slots');

		const css = ler('UI/Components/MochilaIdle/MochilaIdle.css');
		expect(css).toContain('.mo-fantasia-slots');
		expect(css).toContain('.mo-item-fantasia');
	});
});
