/**
 * UI/Components/GrupoIdle/vidaDoMembro.js
 *
 * A CONTA da barra de vida de um companheiro, sem DOM (07/09/2026).
 *
 * Mesma razão de existir de `atlasDeCaca.js` e `secoesDaConfig.js`: regra com
 * conta precisa de teste que RODE, e não de teste que leia o fonte. Levantar a
 * `GrupoIdle` de verdade puxa `GUIComponent`, `Renderer` e o GRF junto.
 *
 * ── O QUE ELA RESOLVE ─────────────────────────────────────────────────────
 * Relato do alfa: *"a vida dos aliados não aparece"*. Eram duas metades:
 *
 * 1. **o servidor** mandava, no empurrão da janela, o HP do REGISTRO — que só
 *    recebe o valor da luta quando o encontro acaba. Num idle o jogador está
 *    sempre em combate, então a barra mostrava o HP de quando ele entrou no
 *    mapa (corrigido em `hpDaCenaOuDoRegistro`, servidor-mapa.ts);
 * 2. **o cliente** só redesenhava a janela quando o GRUPO mudava (entrar, sair,
 *    trocar posto) — nunca a cada golpe. Esta função é a metade de cá: ela
 *    combina o que o empurrão trouxe com o que o `ZC_NOTIFY_HP_TO_GROUPM_R2`
 *    (0x080e) já depositou em `EntityManager.storeLife`.
 *
 * ── AS TRÊS RESPOSTAS ─────────────────────────────────────────────────────
 * `null` significa **"não mexa na linha"**, e não "zero de vida". A diferença
 * importa na troca de mapa: `MapRenderer` ESVAZIA o cache de vida, e entre a
 * viagem e o primeiro lote de combate o único dado honesto é o do empurrão.
 */

/**
 * A barra de UM companheiro, ou `null` quando não há o que atualizar.
 *
 * @param {{hp: number, hp_max: number}|null} guardada - `EntityManager.getLife(AID)`
 * @returns {{fracao: number, texto: string, vivo: boolean}|null}
 */
export function vidaDoMembro(guardada) {
	if (!guardada || typeof guardada.hp !== 'number' || !guardada.hp_max) {
		return null;
	}
	// O `hp_max` zero cai no `!guardada.hp_max` acima — dividir por ele daria
	// `Infinity` e uma barra de largura `NaN%`, que o navegador ignora em
	// silêncio (a barra ficaria congelada, que é o defeito de origem).
	const fracao = Math.max(0, Math.min(1, guardada.hp / guardada.hp_max));
	return {
		fracao,
		texto: guardada.hp + ' / ' + guardada.hp_max,
		// A MORTE entra por aqui: o `ZC_GROUP_ISALIVE` (0x0ab2) fala com o motor
		// nativo e não com esta janela, e HP zero é o mesmo fato dito pelo
		// pacote que ela já lê.
		vivo: guardada.hp > 0
	};
}
