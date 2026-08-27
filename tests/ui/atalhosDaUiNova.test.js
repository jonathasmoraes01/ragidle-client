/**
 * OS ATALHOS DA UI NOVA (27/08/2026) — o pino entre dois arquivos.
 *
 * `UI/atalhos-da-ui-nova.js` religa o `onShortCut` de SEIS componentes
 * nativos para as janelas novas. O modulo em si nao roda em teste de unidade
 * (importa os componentes inteiros, que pedem Renderer/DOM) — em runtime o
 * proprio `getComponent` lanca para nome desconhecido, e isso e o gate de
 * execucao. O que ESTE arquivo prende e a metade que falharia em silencio: o
 * MAPA e a TABELA falarem dos mesmos nomes.
 *
 *  - nome no mapa que a tabela de atalhos nao tem = atalho religado que
 *    nenhuma tecla dispara (codigo morto com cara de conserto);
 *  - nome de janela nativa ESCONDIDA pelo fork que fique fora do mapa =
 *    exatamente o defeito que o dono reportou ("Alt+A abre a UI antiga").
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

/** Os nomes religados no modulo, lidos do proprio fonte. */
function nomesDoMapa() {
	const fonte = ler('UI/atalhos-da-ui-nova.js');
	const bloco = fonte.slice(fonte.indexOf('const DESTINOS'), fonte.indexOf('export function'));
	return [...bloco.matchAll(/^\t([A-Za-z]+):/gm)].map((m) => m[1]);
}

describe('o mapa dos atalhos e a tabela falam dos mesmos nomes', () => {
	it('religa EXATAMENTE as seis janelas que o fork esconde', () => {
		// O conjunto e um pino com razao: cada nome aqui e uma janela nativa
		// que alguma *Idle substituiu. Quem esconder a setima volta aqui.
		expect(nomesDoMapa().sort()).toEqual(
			['BasicInfo', 'Equipment', 'Inventory', 'Quest', 'SkillList', 'WinStats'].sort()
		);
	});

	it('todo nome do mapa existe na tabela de atalhos com um gesto de verdade', () => {
		const tabela = ler('Preferences/ShortCutControls.js');
		for (const nome of nomesDoMapa()) {
			expect(tabela.includes(`component: '${nome}'`), `'${nome}' sumiu da tabela de atalhos`).toBe(
				true
			);
		}
	});

	it('o unico gesto que nao e TOGGLE e o EXTEND do BasicInfo — e o mapa o trata', () => {
		/*
		 * A tabela da ao BasicInfo o cmd EXTEND (expandir/recolher), e o mapa
		 * aponta para alternarCompacto — o MESMO gesto na janela nova. Se um
		 * cmd novo aparecer na tabela para qualquer um dos seis, este caso
		 * forca quem mexeu a decidir o destino dele.
		 */
		const tabela = ler('Preferences/ShortCutControls.js');
		for (const nome of nomesDoMapa()) {
			const trecho = tabela.slice(tabela.indexOf(`component: '${nome}'`));
			const cmd = /cmd: '([A-Z0-9]+)'/.exec(trecho)?.[1];
			expect(
				cmd === 'TOGGLE' || (nome === 'BasicInfo' && cmd === 'EXTEND'),
				`'${nome}' tem cmd '${cmd}' — o mapa nao conhece esse gesto`
			).toBe(true);
		}
		// E o destino do EXTEND existe de verdade no componente novo.
		expect(ler('UI/Components/BasicInfoIdle/BasicInfoIdle.js')).toContain('alternarCompacto');
	});
});
