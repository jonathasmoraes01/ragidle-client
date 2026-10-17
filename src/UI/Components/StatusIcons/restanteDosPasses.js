/**
 * O QUE FALTA DO VIP E DAS FLECHAS INFINITAS, EM DIAS DE VERDADE (17/10/2026).
 *
 * O relogio do `ZC_MSG_STATE_CHANGE3` (0x0983) e o `RemainMS`, um u32 em
 * milissegundos: para em ~49 dias 17 horas. O servidor o APARA nesse teto
 * (`TETO_DO_RELOGIO_NO_FIO`, servidor/mapa/icone-dos-passes.ts), e quem tinha
 * 60 ou 90 dias de VIP via "49 dias 16 horas" na barra e achava que os dias nao
 * tinham entrado — um desenvolvedor comprou 90 e leu exatamente isso.
 *
 * Desde esta data o servidor manda TAMBEM o que falta EM SEGUNDOS no `val[0]`
 * desses dois icones (o `val1` do clif, que ia zerado), e este e o unico lugar
 * do cliente que o le: para o EFST do VIP (1902) e o das Flechas Infinitas
 * (1903), `val[0] > 0` vale `val[0] * 1000` ms, e o resto segue no `RemainMS`.
 * O relogio da celula, a dica e o fim do icone saem todos desse numero
 * (`StatusIcons.update`), e nenhuma conta deles passa por 32 bits em
 * milissegundos: `formatarRelogioDoBuff` e `tempoDaDica` dividem por 1000 antes
 * do `| 0`, e o fim e `Renderer.tick + restante` em numero de JS.
 *
 * Servidor antigo (o `val` zerado) e qualquer outro EFST: o `RemainMS` cru, como
 * sempre. O `val[0]` de outros EFSTs tem outro sentido (a forma do monstro, o
 * cla, o carrinho), e por isso a troca e so destes dois.
 */
import { EFST_DAS_FLECHAS_INFINITAS, EFST_DO_VIP } from 'DB/Status/StatusInfo.js';

/** Os icones cujo `val[0]` e o que falta em SEGUNDOS. */
export const EFSTS_COM_SEGUNDOS_NO_VAL = new Set([EFST_DO_VIP, EFST_DAS_FLECHAS_INFINITAS]);

/** O que falta, em ms, que o icone deste pacote deve contar. */
export function restanteDoPacote(pkt) {
	if (EFSTS_COM_SEGUNDOS_NO_VAL.has(Number(pkt.index)) && Array.isArray(pkt.val)) {
		const segundos = Number(pkt.val[0]);
		if (Number.isFinite(segundos) && segundos > 0) {
			return segundos * 1000;
		}
	}
	return pkt.RemainMS;
}
