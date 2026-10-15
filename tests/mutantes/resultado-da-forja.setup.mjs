// A porta do `readFileSync` dos mutantes do RESULTADO DA FORJA (D-2506): os
// portoes de costura leem o fonte do DISCO, e o `transform` do Vite nao os
// alcanca. Aqui o `readFileSync` do worker devolve o texto mutado para o
// arquivo alvo — o disco nao muda. Os exports nomeados de `node:fs` sao
// ressincronizados (`syncBuiltinESMExports`), senao o `import { readFileSync }`
// do teste continuaria com a funcao original.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { MUTANTES_DA_FORJA } from './resultado-da-forja.mutantes.mjs';

const mutante = MUTANTES_DA_FORJA[process.env.RAG_MUTANTE_FORJA];
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
