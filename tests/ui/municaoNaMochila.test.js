/**
 * A FLECHA NO CELULAR (05/10/2026, relato de jogador): *"que dificuldade
 * equipar flechas pelo Cell, voce tem que dar varios clicks e nem sempre
 * equipa... poderia ter so uma opcao de 'equipar' igual os equips normais"*.
 *
 * As tres causas (ver o cabecalho de `municaoNaMochila.js`): o menu da flecha
 * nao tinha "Equipar"; a checagem de recusa dizia "nao foi possivel" a todo
 * vestir de flecha que dava certo; e a grade era refeita a cada tiro, trocando
 * a celula debaixo do dedo.
 *
 * A regra e medida no modulo puro; a costura com `MochilaIdle.js` e lida no
 * fonte, como os vizinhos desta pasta (a janela arrasta a cadeia de UI
 * inteira, que nao sobe no jsdom).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ItemType from 'DB/Items/ItemType.js';
import EquipLocation from 'DB/Items/EquipmentLocation.js';
import {
	acaoPrincipalDoItem,
	assinaturasDaGrade,
	atualizarQuantidadesNaGrade,
	mascaraDaMunicao,
	municaoVestida,
	municaoVestiuOIndice,
	oQueRefazerNaGrade,
	vestidoEmParaADica
} from 'UI/Components/MochilaIdle/municaoNaMochila.js';

const TAB = { USABLE: 0, EQUIP: 1, ETC: 2 };

describe('a acao principal do menu', () => {
	it('a flecha (aba Diversos) ganha o MESMO Equipar de um toque da arma', () => {
		expect(acaoPrincipalDoItem({ type: ItemType.AMMO }, TAB.ETC, TAB, 0)).toBe('equipar-municao');
	});

	it('a flecha JA vestida nao ganha Equipar (o rotulo prometeria uma troca que nao acontece)', () => {
		expect(acaoPrincipalDoItem({ type: ItemType.AMMO }, TAB.ETC, TAB, EquipLocation.AMMO)).toBeNull();
	});

	it('uma mascara de OUTRO espaco nao conta como municao vestida', () => {
		expect(acaoPrincipalDoItem({ type: ItemType.AMMO }, TAB.ETC, TAB, EquipLocation.WEAPON)).toBe(
			'equipar-municao'
		);
	});

	it('o resto continua como antes: arma equipa, pocao usa, carta encaixa, etc nada', () => {
		expect(acaoPrincipalDoItem({ type: ItemType.WEAPON }, TAB.EQUIP, TAB, 0)).toBe('equipar');
		expect(acaoPrincipalDoItem({ type: ItemType.HEALING }, TAB.USABLE, TAB, 0)).toBe('usar');
		expect(acaoPrincipalDoItem({ type: ItemType.CARD }, TAB.ETC, TAB, 0)).toBe('encaixar');
		expect(acaoPrincipalDoItem({ type: ItemType.ETC }, TAB.ETC, TAB, 0)).toBeNull();
	});
});

describe('a recusa da municao olha o espaco, e nao a mochila', () => {
	it('o indice no espaco Municao = vestiu', () => {
		expect(municaoVestiuOIndice(EquipLocation.AMMO)).toBe(true);
		expect(municaoVestida(EquipLocation.AMMO | EquipLocation.WEAPON)).toBe(true);
	});

	it('o indice fora do espaco Municao = recusado', () => {
		expect(municaoVestiuOIndice(0)).toBe(false);
		expect(municaoVestiuOIndice(EquipLocation.SHIELD)).toBe(false);
	});

	it('a mascara pedida e a do item, e cai no espaco Municao quando o item nao traz uma', () => {
		expect(mascaraDaMunicao({ location: EquipLocation.AMMO })).toBe(EquipLocation.AMMO);
		expect(mascaraDaMunicao({})).toBe(EquipLocation.AMMO);
		expect(mascaraDaMunicao({ location: 0 })).toBe(EquipLocation.AMMO);
	});
});

describe('a grade so e refeita quando a estrutura muda', () => {
	const flechas = (n, extra = {}) => ({ index: 5, count: n, IsIdentified: true, ...extra });

	it('a flecha disparada (so a quantidade desceu) atualiza o numero no lugar', () => {
		const antes = assinaturasDaGrade(2, [flechas(300)]);
		const agora = assinaturasDaGrade(2, [flechas(299)]);
		expect(oQueRefazerNaGrade(antes, agora)).toBe('quantidade');
	});

	it('nada mudou = nada a refazer', () => {
		expect(oQueRefazerNaGrade(assinaturasDaGrade(2, [flechas(3)]), assinaturasDaGrade(2, [flechas(3)]))).toBe(
			'nada'
		);
	});

	it('item novo, aba trocada, identificacao ou trava = refaz tudo', () => {
		const base = assinaturasDaGrade(2, [flechas(3)]);
		expect(oQueRefazerNaGrade(null, base)).toBe('tudo');
		expect(oQueRefazerNaGrade(base, assinaturasDaGrade(2, [flechas(3), { index: 6, count: 1 }]))).toBe('tudo');
		expect(oQueRefazerNaGrade(base, assinaturasDaGrade(1, [flechas(3)]))).toBe('tudo');
		expect(oQueRefazerNaGrade(base, assinaturasDaGrade(2, [flechas(3, { IsIdentified: false })]))).toBe('tudo');
		expect(oQueRefazerNaGrade(base, assinaturasDaGrade(2, [flechas(3, { travado: true })]))).toBe('tudo');
	});
});

describe('o selo "Equipado" da dica', () => {
	it('a flecha da mochila com WearState = AMMO (a mascara do bloco normal) NAO e vestida', () => {
		expect(vestidoEmParaADica({ type: ItemType.AMMO, WearState: EquipLocation.AMMO }, undefined, () => 0)).toBe(0);
	});

	it('a flecha que esta no espaco Municao e vestida', () => {
		const vestida = vestidoEmParaADica({ type: ItemType.AMMO, WearState: EquipLocation.AMMO }, undefined, () => EquipLocation.AMMO);
		expect(vestida).toBe(EquipLocation.AMMO);
	});

	it('o resto segue a regra de antes: o slot manda, senao o WearState', () => {
		expect(vestidoEmParaADica({ type: ItemType.ARMOR, WearState: 16 }, undefined, () => 0)).toBe(16);
		expect(vestidoEmParaADica({ type: ItemType.ARMOR, WearState: 16 }, 2, () => 0)).toBe(2);
		expect(vestidoEmParaADica({ type: ItemType.ARMOR }, undefined, () => 0)).toBe(0);
	});
});

describe('o numero muda no lugar, e a celula continua a MESMA', () => {
	function grade() {
		const g = document.createElement('div');
		g.innerHTML =
			'<div class="mo-item" data-index="5"><img class="mo-item-icone"><span class="mo-item-qtd">300</span></div>' +
			'<div class="mo-item" data-index="6"><img class="mo-item-icone"><span class="mo-item-fantasia"></span></div>';
		return g;
	}

	it('desce o contador sem trocar o elemento debaixo do dedo', () => {
		const g = grade();
		const celula = g.querySelector('[data-index="5"]');
		atualizarQuantidadesNaGrade(g, [{ index: 5, count: 299 }]);
		expect(g.querySelector('[data-index="5"]')).toBe(celula);
		expect(celula.querySelector('.mo-item-qtd').textContent).toBe('299');
	});

	it('a pilha que chega a 1 perde o contador; a que passa de 1 ganha, logo depois do icone', () => {
		const g = grade();
		atualizarQuantidadesNaGrade(g, [
			{ index: 5, count: 1 },
			{ index: 6, count: 7 }
		]);
		expect(g.querySelector('[data-index="5"] .mo-item-qtd')).toBeNull();
		const qtd = g.querySelector('[data-index="6"] .mo-item-qtd');
		expect(qtd.textContent).toBe('7');
		expect(qtd.previousElementSibling.className).toBe('mo-item-icone');
	});
});

const FONTE = readFileSync(join(process.cwd(), 'src/UI/Components/MochilaIdle/MochilaIdle.js'), 'utf8')
	.replace(/\r\n/g, '\n');

function corpoSemComentarios(nome) {
	const i = FONTE.indexOf(`function ${nome}(`);
	expect(i, `${nome} sumiu do MochilaIdle.js`).toBeGreaterThan(-1);
	return FONTE.slice(i, FONTE.indexOf('\n}\n', i))
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '');
}

describe('a costura com a Mochila', () => {
	it('o menu do item decide pela acao principal e oferece Equipar a municao', () => {
		const corpo = corpoSemComentarios('abrirMenuDoItem');
		expect(corpo).toContain('acaoPrincipalDoItem(item, tab, TAB, mascaraVestidaDoIndice(String(item.index)))');
		expect(corpo).toMatch(
			/acao === 'equipar-municao'\) \{\s*ContextMenu\.addElement\('Equipar', \(\) => \{\s*tentarEquipar\(item, mascaraDaMunicao\(item\)\);/
		);
	});

	it('o vestir de municao agenda a checagem PROPRIA (menu e arrasto passam por tentarEquipar)', () => {
		const corpo = corpoSemComentarios('tentarEquipar');
		expect(corpo).toContain("tipo: item.type === ItemType.AMMO ? 'equipar-municao' : 'equipar'");
	});

	it('a checagem da municao pergunta ao espaco Municao', () => {
		const corpo = corpoSemComentarios('verificarRecusa');
		expect(corpo).toMatch(
			/ctx\.tipo === 'equipar-municao'\) \{\s*if \(!municaoVestiuOIndice\(mascaraVestidaDoIndice\(String\(ctx\.indice\)\)\)\)/
		);
	});

	it('a dica le o selo por vestidoEmParaADica', () => {
		const corpo = corpoSemComentarios('mostrarDicaItem');
		expect(corpo).toContain('vestidoEmParaADica(item, vestidoEmForcado, () => mascaraVestidaDoIndice(String(item.index)))');
	});

	it('a grade atualiza a quantidade no lugar quando so ela mudou', () => {
		const corpo = corpoSemComentarios('syncGrade');
		expect(corpo).toMatch(
			/if \(refazer === 'quantidade'\) \{\s*atualizarQuantidadesNaGrade\(root\.querySelector\('\.mo-grade'\), lista\);\s*return;/
		);
	});
});
