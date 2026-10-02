/**
 * QUEM VE O INTERRUPTOR DA FLECHA (30/09/2026, ordem do dono): "Quero que
 * apenas arqueiros (classes que utilizam arco) tenham essa opcao visivel no
 * menu de Configuracao Idle" - o interruptor da troca inteligente de flecha
 * (D-1866) -, e logo depois: "arruaceiro, desordeiro tambem entram (porque eles
 * podem usar arco e flecha)".
 *
 * Entram a linha do Arqueiro (Arqueiro, Cacador, Bardo e Odalisca) e a do
 * Arruaceiro (Arruaceiro e Desordeiro), com as formas delas que o cliente
 * conhece (transcendida, bebe, terceira classe, montada), lidas das constantes
 * do proprio cliente (`JobConst.js`) pelo prefixo da familia. O Gatuno tambem
 * veste arco no RO, mas ficou de fora: o dono nomeou so os dois. O servidor nao
 * muda: a troca so age em quem veste flecha, e o campo ausente vale como ligado.
 */
import JobId from 'DB/Jobs/JobConst.js';

/** Os prefixos das familias em `JobConst.js`: a linha do Arqueiro e a do Arruaceiro. */
const FAMILIAS = [
	'ARCHER', 'HUNTER', 'BARD', 'DANCER', 'RANGER', 'MINSTREL', 'WANDERER', 'OSTRICH_',
	'ROGUE', 'SHADOW_CHASER', 'DOG_ROGUE', 'DOG_STALKER', 'DOG_CHASER',
];

/** Todo id de classe que ve o interruptor, entre os que o cliente conhece. */
export const JOBS_DA_LINHA_DO_ARQUEIRO = new Set(
	Object.entries(JobId)
		.filter(([nome]) => FAMILIAS.some(f => nome.startsWith(f)))
		.map(([, id]) => id)
);

/** Esta classe ve o interruptor da flecha? `job` e o `_job` da entidade do jogador. */
export function ehDaLinhaDoArqueiro(job) {
	return JOBS_DA_LINHA_DO_ARQUEIRO.has(Number(job));
}
