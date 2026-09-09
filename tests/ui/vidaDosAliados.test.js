/**
 * A VIDA DOS ALIADOS — o relato do alfa, nas duas metades (07/09/2026).
 *
 * *"A vida dos aliados não aparece."*
 *
 * A janela de Grupo desenha a barra de cada companheiro, e ela estava parada
 * por DOIS motivos independentes. Este arquivo mede o lado do cliente e cobra
 * do servidor, por leitura de fonte, o lado de lá — as duas metades de um par
 * que só funciona junto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vidaDoMembro } from '../../src/UI/Components/GrupoIdle/vidaDoMembro.js';

describe('a conta da barra', () => {
	it('a fração e o número saem do par que o 0x080e depositou', () => {
		expect(vidaDoMembro({ hp: 300, hp_max: 1200 })).toEqual({
			fracao: 0.25,
			texto: '300 / 1200',
			vivo: true
		});
	});

	it('a morte zera a barra e derruba o "vivo"', () => {
		const morto = vidaDoMembro({ hp: 0, hp_max: 1200 });
		expect(morto.fracao).toBe(0);
		expect(morto.vivo).toBe(false);
		// E a volta acende de novo — o par é o mesmo pacote, e não dois.
		expect(vidaDoMembro({ hp: 1200, hp_max: 1200 }).vivo).toBe(true);
	});

	it('a cura não estoura a barra, e o HP negativo não a inverte', () => {
		// O servidor manda `Math.max(0, hp)`, mas a barra não pode DEPENDER
		// disso: um `-3` viraria uma largura negativa e um `1300/1200`, 108%.
		expect(vidaDoMembro({ hp: 1300, hp_max: 1200 }).fracao).toBe(1);
		expect(vidaDoMembro({ hp: -3, hp_max: 1200 }).fracao).toBe(0);
	});

	/*
	 * O CASO QUE SEPARA "não sei" de "morreu", e ele é a troca de mapa.
	 *
	 * `MapRenderer` ESVAZIA o cache de vida ao carregar um mapa novo
	 * (`clearLifeCache`). Entre a viagem e o primeiro lote de combate,
	 * `getLife` devolve `null` — e nesse instante o único dado honesto é o do
	 * empurrão da janela. Devolver `{fracao: 0}` aqui pintaria todo companheiro
	 * de morto a cada troca de mapa.
	 */
	it('sem dado guardado NÃO mexe na linha — o caso da troca de mapa', () => {
		expect(vidaDoMembro(null)).toBeNull();
		expect(vidaDoMembro(undefined)).toBeNull();
		expect(vidaDoMembro({})).toBeNull();
		// `hp_max` zero é "o servidor ainda não disse", e dividir por ele daria
		// uma largura `NaN%` que o navegador ignora em silêncio.
		expect(vidaDoMembro({ hp: 10, hp_max: 0 })).toBeNull();
	});
});

/*
 * A COSTURA. Sem ela, os casos acima passariam com a janela nunca chamando a
 * função — que é exatamente o estado de antes deste conserto.
 */
describe('a janela LÊ a vida ao vivo', () => {
	const fonte = readFileSync(
		join(process.cwd(), 'src/UI/Components/GrupoIdle/GrupoIdle.js'),
		'utf8'
	);

	it('a linha carrega a conta, que é a chave do EntityManager', () => {
		// `EntityManager.getLife` é indexado pelo AID, e o AID é o `contaId` que
		// o payload da janela já traz por membro.
		expect(fonte).toContain('data-conta="');
		expect(fonte).toContain('EntityManager.getLife(conta)');
	});

	it('ela LÊ o estado em vez de fisgar o pacote de vida', () => {
		/*
		 * `Network.hookPacket` SOBRESCREVE (um callback por pacote): fisgar o
		 * 0x080e trocaria em silêncio o `onMemberLifeUpdate` de
		 * `Engine/MapEngine/Group.js`, que desenha a barrinha sobre a cabeça e
		 * alimenta a janela nativa.
		 *
		 * A janela fisga o PRÓPRIO pacote (`RAGIDLE_GRUPO`), e só ele — esse
		 * não tem outro dono. O que ela não pode é fisgar os do motor nativo.
		 */
		const fisgados = [...fonte.matchAll(/hookPacket\(\s*PACKET\.ZC\.(\w+)/g)].map(m => m[1]);
		expect(fisgados).toEqual(['RAGIDLE_GRUPO']);
	});

	it('o ticker liga ao abrir e DESLIGA ao fechar e ao sair do mapa', () => {
		// Um ticker sobrevivente leria um DOM fora da árvore, quatro vezes por
		// segundo, para sempre.
		expect(fonte).toContain('ligarVidaAoVivo();');
		expect(fonte).toContain('desligarVidaAoVivo();');
		const fechar = fonte.slice(fonte.indexOf('GrupoIdle.fechar ='));
		expect(fechar.slice(0, 400)).toContain('desligarVidaAoVivo');
		const remover = fonte.slice(fonte.indexOf('GrupoIdle.onRemove ='));
		expect(remover.slice(0, 400)).toContain('desligarVidaAoVivo');
	});
});
