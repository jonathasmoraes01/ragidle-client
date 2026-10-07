/**
 * O BOTAO DE DESMONTAR DA MOCHILA (D-2052, 06/10/2026).
 *
 * Na fonte o Peco Peco sai pelo botao "off" da janela de equipamento
 * (`EquipmentCommon.js`, `.removeOption`), que manda o `CZ_REQ_CARTOFF`
 * (0x012a); o servidor tira a montaria antes do carrinho
 * (`clif_parse_RemoveOption`, clif.cpp:12619-12633). Neste fork a janela de
 * equipamento nativa fica ESCONDIDA pela Mochila (`hideNativeHosts`, a cada
 * 250 ms) — e com ela o "off": o Cavaleiro montava no Breeder e nao tinha como
 * descer (achado pela sonda `diag-montaria-na-tela`, o PNG da Mochila montada).
 *
 * O botao mora ao lado do boneco, onde o RO o poe, e aparece SO com o Peco:
 * o mesmo pacote, para quem nao esta montado, e a DEVOLUCAO do carrinho do
 * Mercador (R110), e o falcao do Cacador nao tem estado proprio aqui (D-908).
 */
import StatusConst from 'DB/Status/StatusState.js';

/**
 * O personagem esta montado no Peco? O bit `OPTION_RIDING` do `effectState`
 * (o mesmo que o desenho le para trocar o corpo pelo do Peco, EntityState.js).
 *
 * @param {{effectState?: number}|null|undefined} entidade
 * @returns {boolean}
 */
export function montadoNoPeco(entidade) {
	return !!entidade && ((entidade.effectState | 0) & StatusConst.EffectState.RIDING) !== 0;
}
