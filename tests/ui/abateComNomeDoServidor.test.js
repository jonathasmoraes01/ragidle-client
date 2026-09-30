/**
 * O HUNT ANALYZER CONTA O ABATE PELO NOME QUE O SERVIDOR MANDOU (30/09/2026).
 *
 * O servidor da o nome distinto ao homonimo ("Goblin (Vento)", D-1870) na
 * entrada do mob, e o cliente o guarda em `entity.display.name`. O registro do
 * abate lia so a tabela do cliente (`DB.getMonsterName`), que diz "Goblin" para
 * os cinco, e o ranking os somava numa linha. Le o fonte sem comentarios.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const JS = readFileSync('src/Engine/MapEngine/Entity.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const bloco = (() => {
	const i = JS.indexOf('registrarAbate(Session.Entity.GID');
	return JS.slice(JS.lastIndexOf('if (entity.objecttype === Entity.TYPE_MOB && Session.Entity) {', i), i + 120);
})();

describe('o nome do abate no Hunt Analyzer', () => {
	it('o nome do servidor vem primeiro, e a tabela do cliente e a reserva', () => {
		expect(bloco).toContain("const doServidor = entity.display && entity.display.name ? entity.display.name : '';");
		expect(bloco).toContain('const nome = doServidor || DB.getMonsterName(entity.job);');
	});

	it('o "Unknown" da tabela continua virando o balde explicito', () => {
		expect(bloco).toContain("registrarAbate(Session.Entity.GID, nome === 'Unknown' ? '' : nome, entity.job);");
	});
});
