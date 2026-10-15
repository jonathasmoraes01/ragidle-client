/**
 * UI/Components/CharSelect/sonoNaSelecao.js
 *
 * QUEM DORME NA SELECAO DE PERSONAGEM (J21 do jogador "lucas seabra", 14/10/2026, D-2478, R128 no servidor).
 *
 * O pedido: "um icone na selecao de personagem, ao lado do icone de classe, mostrando que aquele personagem esta com
 * o dormir ligado". O char-server poe `OPT1_SLEEP` (4) no `bodystate` do bloco de quem dorme (o campo que o rAthena
 * manda zerado, `char.cpp:1788`), e `PacketVerManager.parseCharList` ja o lia como `bodyState`. O mesmo numero e o
 * `BodyState.SLEEP` do cliente (`DB/Status/StatusState.js`). O sinal e o icone ao lado do da classe e a linha da
 * ficha. O valor e SO da selecao: quem monta uma entidade a partir da lista passa por `semOSonoDaLista` (abaixo).
 *
 * E A PERGUNTA ANTES DE ENCERRAR O SONO: entrar com OUTRO personagem da conta encerra o sono em curso (regra do dono,
 * 12/10/2026, `sono-encerrado-pela-entrada.ts` no servidor). Em producao, 17 de 25 sonos encerrados assim tinham 0 a
 * 2 minutos: o jogador punha um para dormir e entrava com outro, e voltava achando que o sono "nao rendeu nada".
 *
 * Puro: le so os objetos que `parseCharList` monta; o componente (`CharSelectCommon.js`) desenha e pergunta.
 */

import StatusConst from 'DB/Status/StatusState.js';

/**
 * A ARTE DO ICONE: o da Cancao de Ninar Profunda (`WM_LULLABY_DEEPSLEEP`), um "Z z z" no quadro de habilidade,
 * do GRF (`DB.INTERFACE_PATH` + `item/wm_lullaby_deepsleep.bmp`, 24x24). Carregado pelo MESMO caminho do icone
 * da classe ao lado (`Client.loadFile` + `DB.INTERFACE_PATH`), em escala inteira. Escolhido entre os do GRF que
 * dizem "sono" (a ovelha dorminhoca `sleep_sheep`, o "Z" do `status-sleep`): e o unico legivel em 24 px.
 */
export const ICONE_DO_SONO = 'wm_lullaby_deepsleep';

/** O personagem da lista esta dormindo? (`bodyState` do bloco, `OPT1_SLEEP`.) */
export function estaDormindoNaLista(personagem) {
	return !!personagem && personagem.bodyState === StatusConst.BodyState.SLEEP;
}

/**
 * O CORPO QUE SAI DA LISTA PARA UMA ENTIDADE (rodada 2 da frente, B1 do critico, 14/10/2026). O `bodyState` da lista
 * e um SINAL DA SELECAO, e nao o estado do corpo: `Entity.set` copia toda chave que o prototipo conhece
 * (`Entity.prototype._bodyState`), e o setter poe o anexo `status-sleep` na cabeca (`EntityState.js`,
 * `updateBodyState`). Nada no mundo o tira: `Entity.clean` nao zera o estado, e o mapa so manda o 0x0119 do proprio
 * jogador quando o `effectState` nao e zero. Medido na pilha da frente: o jogador que dormiu entrava no mundo com
 * `bodyState=4 anexos=[status-sleep]`.
 *
 * Quem monta uma entidade a partir da lista (o `Player` da entrada em `CharEngine.js`, os bonecos da grade em
 * `CharSelectCommon.js`) recebe uma COPIA com o corpo zerado, o mesmo zero que o rAthena manda (`char.cpp:1788`). O
 * objeto da lista fica intacto, com o 4, para o icone e a pergunta.
 */
export function semOSonoDaLista(personagem) {
	return { ...personagem, bodyState: 0 };
}

/**
 * Quem desta conta esta dormindo e teria o sono encerrado se `escolhido` entrar: os OUTROS personagens da lista com
 * o `OPT1_SLEEP`. Entrar com o proprio dorminhoco nao encerra nada (ele volta a tela "Dormindo...").
 *
 * @param {Array<object|undefined>} slots os personagens por vaga (`_slots` do componente; vagas vazias = undefined)
 * @param {object} escolhido o personagem que vai entrar
 * @returns {object[]} os que dormem, na ordem das vagas
 */
export function sonosQueAEntradaEncerra(slots, escolhido) {
	if (!escolhido) {
		return [];
	}
	return (slots || []).filter(p => p && p.GID !== escolhido.GID && estaDormindoNaLista(p));
}

/** A pergunta antes de entrar com outro personagem enquanto um da conta dorme. */
export function perguntaAntesDeEncerrarOSono(quemDorme, quemEntra) {
	const nomes = quemDorme.map(p => p.name).join(', ');
	return (
		`${nomes} está dormindo. Entrar com ${quemEntra.name} encerra o sono agora: ` +
		'ele recebe só a EXP do tempo já dormido. Entrar mesmo assim?'
	);
}
