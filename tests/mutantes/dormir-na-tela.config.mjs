// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O DORMIR NA TELA (J21, 14/10/2026, D-2477 e D-2478): os numeros do "Dormindo..." (ganho ate agora, ritmo, o que
// falta, o "rendendo", o sono completo), a volta a selecao sem acordar, quem dorme na selecao de personagem (o
// OPT1_SLEEP do `bodyState` e a pergunta antes de encerrar o sono), e o corpo da lista que NAO vai ao mundo (rodada 2).
//
// DUAS PORTAS, o mesmo mutante (molde de `devolucao-do-carrinho.config.mjs`): o que o teste IMPORTA
// (`numerosDoSono.js`, `UIManager.js`, `sonoNaSelecao.js`) passa pelo `transform` do Vite; o que o teste LE do disco
// (`CharEngine.js`, `CharSelectCommon.js`, o CSS da ficha) passa pelo `setupFiles`, que embrulha o `readFileSync`.
// Nos dois casos o arquivo em disco fica intacto. A tabela mora em `dormir-na-tela.mutantes.mjs`.
//
//   RAG_MUTANTE_DORMIR=<nome> npx vitest run --config tests/mutantes/dormir-na-tela.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in $(node -e "import('./tests/mutantes/dormir-na-tela.mutantes.mjs').then(m=>console.log(Object.keys(m.MUTANTES_DO_DORMIR).join(' ')))"); do
//     RAG_MUTANTE_DORMIR=$m npx vitest run --config tests/mutantes/dormir-na-tela.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
import base from '../../vite.config.js';
import { MUTANTES_DO_DORMIR } from './dormir-na-tela.mutantes.mjs';

const mutante = MUTANTES_DO_DORMIR[process.env.RAG_MUTANTE_DORMIR];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_DORMIR: ${Object.keys(MUTANTES_DO_DORMIR).join(', ')}.`);
const [ALVO, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'dormir-na-tela-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(de).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(de, para);
			}
		}
	],
	test: {
		...base.test,
		include: ['tests/ui/dormirComGanhoVisivel.test.js', 'tests/renderer/sonoDaListaNaoVaiAoMundo.test.js'],
		setupFiles: ['tests/mutantes/dormir-na-tela.setup.mjs']
	}
};

export const NOMES = Object.keys(MUTANTES_DO_DORMIR);
