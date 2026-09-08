/**
 * O SELO "EQUIPADO" NA DICA DO ITEM — pedido do alfa (08/09/2026).
 *
 * *"Indique claramente quando o item estiver equipado e em qual espaço."*
 *
 * A dica de hover já dizia tudo sobre o item e nada sobre o ESTADO dele. A
 * regra do rótulo mora em `espacoEquipado.js` (pura, medida aqui com a máscara
 * REAL do cliente); a costura — a janela desenhar o selo — se confere no
 * fonte, porque levantar a MochilaIdle puxa WebGL e uma sessão logada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import EquipLocation from 'DB/Items/EquipmentLocation.js';
import { rotuloDoEspacoEquipado } from 'UI/Components/MochilaIdle/espacoEquipado.js';

/** O MESMO desenho de EQUIP_SLOTS da janela — máscara + rótulo. */
const SLOTS = [
	{ location: EquipLocation.HEAD_TOP, label: 'Chapéu' },
	{ location: EquipLocation.HEAD_MID, label: 'Óculos' },
	{ location: EquipLocation.HEAD_BOTTOM, label: 'Boca' },
	{ location: EquipLocation.WEAPON, label: 'Arma' },
	{ location: EquipLocation.SHIELD, label: 'Escudo' },
	{ location: EquipLocation.ARMOR, label: 'Armadura' },
	{ location: EquipLocation.GARMENT, label: 'Capa' },
	{ location: EquipLocation.SHOES, label: 'Sapato' },
	{ location: EquipLocation.ACCESSORY1, label: 'Acessório' },
	{ location: EquipLocation.ACCESSORY2, label: 'Acessório' },
	{ location: EquipLocation.AMMO, label: 'Munição' },
];

describe('rotuloDoEspacoEquipado', () => {
	it('não vestido é `null` — e não uma string vazia que renderiza um selo oco', () => {
		expect(rotuloDoEspacoEquipado(0, SLOTS)).toBeNull();
		expect(rotuloDoEspacoEquipado(undefined, SLOTS)).toBeNull();
	});

	it('um espaço só sai com o rótulo dele', () => {
		expect(rotuloDoEspacoEquipado(EquipLocation.WEAPON, SLOTS)).toBe('Arma');
		expect(rotuloDoEspacoEquipado(EquipLocation.ARMOR, SLOTS)).toBe('Armadura');
	});

	it('a arma de DUAS MÃOS tem nome próprio — ela toma Arma e Escudo juntos', () => {
		/*
		 * É a máscara real do rAthena para espada de duas mãos/arco: dizer só
		 * "Arma" esconderia que o escudo foi desalojado — exatamente o que a
		 * comparação de equipamento precisa deixar visível.
		 */
		expect(rotuloDoEspacoEquipado(EquipLocation.WEAPON | EquipLocation.SHIELD, SLOTS)).toBe(
			'Arma (duas mãos)',
		);
	});

	it('o chapéu grande lista os espaços SOMADOS, como o RO nativo descreve', () => {
		expect(rotuloDoEspacoEquipado(EquipLocation.HEAD_TOP | EquipLocation.HEAD_MID, SLOTS)).toBe(
			'Chapéu + Óculos',
		);
	});

	it('os dois espaços de acessório têm o MESMO rótulo, e ele não duplica', () => {
		expect(
			rotuloDoEspacoEquipado(EquipLocation.ACCESSORY1 | EquipLocation.ACCESSORY2, SLOTS),
		).toBe('Acessório');
	});
});

describe('a dica DESENHA o selo', () => {
	const js = readFileSync(
		join(process.cwd(), 'src/UI/Components/MochilaIdle/MochilaIdle.js'),
		'utf8',
	);

	it('mostrarDicaItem consulta a regra e renderiza `mo-dica-equipado`', () => {
		const trecho = js.slice(js.indexOf('function mostrarDicaItem'), js.indexOf('function mostrarDicaTexto'));
		/*
		 * `WearState`, e NAO `location`: `location` e onde o item PODE ir (o
		 * arco da mochila tem Arma|Escudo ali com WearState 0) — com a mascara
		 * errada, meia mochila ganharia o selo. O caso prende o campo certo.
		 */
		expect(trecho).toContain('rotuloDoEspacoEquipado(vestidoEm, EQUIP_SLOTS)');
		expect(trecho).toContain('item.WearState');
		expect(trecho).not.toContain('rotuloDoEspacoEquipado(location');
		expect(trecho).toContain('mo-dica-equipado');
		// O texto passa por escape antes do innerHTML, como todo texto da dica.
		expect(trecho).toMatch(/Equipado — \$\{escapeHTML\(espaco\)\}/);
	});

	it('o selo tem cor de ACENTO no CSS — estado, e não botão', () => {
		const css = readFileSync(
			join(process.cwd(), 'src/UI/Components/MochilaIdle/MochilaIdle.css'),
			'utf8',
		);
		expect(css).toContain('.mo-dica-equipado');
		expect(css).toMatch(/\.mo-dica-equipado\s*\{[^}]*var\(--accent\)/);
	});
});
