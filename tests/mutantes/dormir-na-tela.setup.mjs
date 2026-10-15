// A porta do `readFileSync` dos mutantes do DORMIR NA TELA (rodada 2 da frente, 14/10/2026): o motor da selecao
// (`CharEngine.js`), o componente (`CharSelectCommon.js`) e o CSS da ficha sao LIDOS do disco pelos testes, e o
// `transform` do Vite nao os alcanca. Aqui o `readFileSync` do worker devolve o texto mutado para o arquivo alvo; o
// disco nao muda. Os exports nomeados de `node:fs` sao ressincronizados (`syncBuiltinESMExports`), senao o
// `import { readFileSync }` do teste continuaria com a funcao original. Molde: `devolucao-do-carrinho.setup.mjs`.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { MUTANTES_DO_DORMIR } from './dormir-na-tela.mutantes.mjs';

const mutante = MUTANTES_DO_DORMIR[process.env.RAG_MUTANTE_DORMIR];
if (mutante) {
	const [alvo, de, para] = mutante;
	const original = fs.readFileSync;
	fs.readFileSync = function readFileSyncMutado(caminho, ...resto) {
		const lido = original.call(this, caminho, ...resto);
		if (typeof lido !== 'string' || !String(caminho).replaceAll('\\', '/').endsWith(alvo)) {
			return lido;
		}
		const normalizado = lido.replaceAll('\r\n', '\n');
		if (normalizado.split(de).length !== 2) {
			throw new Error('Mutante nao casa exatamente uma vez.');
		}
		return normalizado.replace(de, para);
	};
	syncBuiltinESMExports();
}
