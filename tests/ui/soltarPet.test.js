/**
 * O "Soltar pet" da janela do pet (F07, auditoria de 22/09/2026). O servidor
 * entende o `cSub` 5 do `CZ_COMMAND_PET` (`COMANDO_DO_PET.SOLTAR`,
 * `servidor/protocolo/pacotes-mapa.ts`) e pergunta antes; aqui a costura do
 * cliente: a opcao existe, escolhe-la chama o pedido, e o pedido manda o 5.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const semComentarios = texto => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('Soltar pet (F07)', () => {
	it('a janela do pet oferece a opcao', () => {
		const html = readFileSync('src/UI/Components/PetInformations/PetInformations.html', 'utf8');
		expect(html).toMatch(/<option value="soltar">Soltar pet<\/option>/);
	});

	it('escolher a opcao chama o pedido de soltar', () => {
		const js = semComentarios(readFileSync('src/UI/Components/PetInformations/PetInformations.js', 'utf8'));
		expect(js).toMatch(/case 'soltar':\s*PetInformations\.reqSoltarPet\(\);\s*break;/);
	});

	it('o pedido manda o cSub 5 e fecha a janela, como o voltar ao ovo', () => {
		const js = semComentarios(readFileSync('src/Engine/MapEngine/Pet.js', 'utf8'));
		expect(js).toMatch(
			/PetInformations\.reqSoltarPet = function reqSoltarPet\(\) \{\s*const pkt = new PACKET\.CZ\.COMMAND_PET\(\);\s*pkt\.cSub = 5;\s*Network\.sendPacket\(pkt\);\s*PetInformations\.remove\(\);/
		);
	});
});
