/**
 * SOLTAR UM ITEM NUM SLOT DA MOCHILA PEDE AQUELE LADO (10/09/2026).
 *
 * O relato do dono foi *"acessorios estao bugados e todos estao equipando nos
 * 2 slots"*. A metade do servidor e dele (a posicao de vestir estreitada como
 * no `pc_equipitem` do rAthena). A metade daqui e o PEDIDO: o drop no painel de
 * equipamento mandava a mascara INTEIRA do item, entao o jogador nao tinha como
 * dizer "este anel vai na esquerda" — e e o mesmo caminho que o Assassino vai
 * usar para por uma adaga na mao esquerda.
 *
 * O caso le o fonte, como os vizinhos desta pasta: `MochilaIdle.js` arrasta a
 * cadeia de UI inteira, que nao sobe no jsdom.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTE = readFileSync(join(process.cwd(), 'src/UI/Components/MochilaIdle/MochilaIdle.js'), 'utf8').replace(
	/\r\n/g,
	'\n'
);

/** O corpo de uma funcao de topo, sem comentarios (o do conserto cita o proprio codigo). */
function corpoSemComentarios(nome) {
	const i = FONTE.indexOf(`function ${nome}(`);
	expect(i, `${nome} sumiu do MochilaIdle.js`).toBeGreaterThan(-1);
	return FONTE.slice(i, FONTE.indexOf('\n}\n', i))
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '');
}

describe('o drop no painel de equipamento pede o lado do slot', () => {
	it('manda a mascara do item CORTADA pelo slot onde ele foi solto', () => {
		const corpo = corpoSemComentarios('onPainelEsqDrop');
		expect(corpo).toContain('tentarEquipar(item, location & slotLoc)');
		expect(corpo).not.toContain('tentarEquipar(item, location)');
	});

	it('os dois slots de acessorio sao dois tiles, um lado cada — senao o corte nao escolheria nada', () => {
		expect(FONTE).toContain("location: EquipLocation.ACCESSORY1, cls: 'accessory1'");
		expect(FONTE).toContain("location: EquipLocation.ACCESSORY2, cls: 'accessory2'");
	});

	it('o "Equipar" do menu continua mandando a mascara inteira — ai quem escolhe o lado livre e o servidor', () => {
		const i = FONTE.indexOf("ContextMenu.addElement('Equipar'");
		expect(i, 'o Equipar do menu sumiu').toBeGreaterThan(-1);
		const trecho = FONTE.slice(i, i + 300);
		expect(trecho).toContain('tentarEquipar(item, location)');
	});
});
