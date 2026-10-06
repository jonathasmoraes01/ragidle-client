// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O MENU DE NPC CRESCE ATE SETE LINHAS (D-2047, 06/10/2026). Cada mutante e um
// jeito de a regra pura (`posicaoDoMenu.js`) mentir: esconder opcao que cabia,
// passar de sete, cobrir a fala do NPC, sair da tela, ou largar o dedo fora do
// centro. A costura (NpcMenu.js/.css) e portao de FONTE no mesmo teste, e a
// transformacao em memoria nao alcanca leitura de fonte — por isso ela nao
// entra aqui; quem a prova e a sonda `diag-menu-de-npc-na-tela` do servidor.
//
//   RAG_MUTANTE_MENU_NPC=<nome> npx vitest run --config tests/mutantes/menu-de-npc.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/NpcMenu/posicaoDoMenu.js';

export const mutantes = {
	// o teto vira 4 linhas (a caixa velha)
	tetoQuatro: [ALVO, 'export const LINHAS_SEM_ROLAR = 7;', 'export const LINHAS_SEM_ROLAR = 4;'],
	// sem teto: passa de sete
	semTeto: [ALVO, 'Math.min(alturas.length, LINHAS_SEM_ROLAR)', 'alturas.length'],
	// o minimo cai para 1: a lista some para fugir da fala
	minimoUm: [ALVO, 'export const LINHAS_MINIMAS = 3;', 'export const LINHAS_MINIMAS = 1;'],
	// encolhe sem piso
	semPiso: [ALVO, 'while (linhas > piso && ', 'while (linhas > 1 && '],
	// nunca encolhe: com pouco espaco, cobre a fala
	nuncaEncolhe: [ALVO, 'topoMinimo + altura(linhas) > chao', 'false'],
	// ignora a fala: nasce em cima dela
	ignoraAFala: [ALVO, 'const topoMinimo = fala ? fala.bottom + FOLGA_DA_FALA : MARGEM;', 'const topoMinimo = MARGEM;'],
	// sem folga entre a fala e o menu
	semFolga: [ALVO, 'fala.bottom + FOLGA_DA_FALA', 'fala.bottom'],
	// o fundo sai da tela
	naoSobe: [ALVO, '\tif (top + altura(linhas) > chao) {\n\t\ttop = Math.max(MARGEM, chao - altura(linhas));\n\t}', ''],
	// ao subir, sai da tela por cima
	subirSemPiso: [ALVO, 'top = Math.max(MARGEM, chao - altura(linhas));', 'top = chao - altura(linhas);'],
	// sem margem no chao
	chaoSemMargem: [ALVO, 'const chao = tela.altura - MARGEM;', 'const chao = tela.altura;'],
	// o dedo nao centraliza
	dedoNaoCentraliza: [ALVO, 'let left = centralizar ? (tela.largura - largura) / 2 : preferida.left;', 'let left = preferida.left;'],
	// sai pela direita
	semClampDireito: [ALVO, 'Math.min(Math.max(left, MARGEM), tela.largura - MARGEM - largura)', 'Math.max(left, MARGEM)'],
	// sai pela esquerda
	semClampEsquerdo: [ALVO, 'Math.min(Math.max(left, MARGEM), tela.largura - MARGEM - largura)', 'Math.min(left, tela.largura - MARGEM - largura)'],
	// mais larga que a tela: borda esquerda fora
	largaSemPiso: [ALVO, 'left = Math.max(0, (tela.largura - largura) / 2);', 'left = (tela.largura - largura) / 2;'],
	// a preferida e ignorada (o menu gruda na fala)
	ignoraAPreferida: [ALVO, 'let top = Math.max(preferida.top, topoMinimo);', 'let top = topoMinimo;']
};

const nome = process.env.RAG_MUTANTE_MENU_NPC;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_MENU_NPC: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'menu-de-npc-somente-em-memoria',
						enforce: 'pre',
						transform(codigo, id) {
							if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
							const normalizado = codigo.replaceAll('\r\n', '\n');
							if (normalizado.split(mutante[1]).length !== 2) throw new Error(`Mutante ${nome} nao casa exatamente uma vez.`);
							return normalizado.replace(mutante[1], mutante[2]);
						}
					}
				]
			: [])
	],
	test: { ...base.test, include: ['tests/ui/posicaoDoMenuDeNpc.test.js'] }
};

// Rodar todos (bash):
//   for m in $(node -e "import('./tests/mutantes/menu-de-npc.config.mjs').then(x=>console.log(Object.keys(x.mutantes).join(' ')))"); do
//     RAG_MUTANTE_MENU_NPC=$m npx vitest run --config tests/mutantes/menu-de-npc.config.mjs >/dev/null 2>&1 && echo "SOBREVIVEU $m" || echo "morto $m"; done
