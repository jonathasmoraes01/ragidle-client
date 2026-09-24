// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Uso: RAG_MUTANTE_LETREIRO=<nome> npx vitest run --config tests/mutantes/letreiro-do-monstro.config.mjs
// Cada mutante tem de REPROVAR tests/ui/letreiroDoMonstro.test.js. Os fios
// (NomesDosJogadores, EntityControl) sao lidos do DISCO pelo teste, entao a
// bateria em memoria cobre so a regra pura.
import base from '../../vite.config.js';

const alvo = 'src/Engine/MapEngine/letreiroFixo.js';
const mutantes = {
	// o monstro volta ao hover (o defeito do print)
	'mob-por-hover': [alvo, 'return objecttype === tipos.TYPE_MOB;', 'return false;'],
	// todo tipo ganha letreiro (NPC viraria mural)
	'todo-mundo': [alvo, 'return objecttype === tipos.TYPE_MOB;', 'return true;'],
	// o jogador ignora a opcao de video
	'jogador-sem-opcao': [alvo, 'return preferencias.showPlayerNames !== false;', 'return true;'],
	// preferencia antiga (sem o campo) desliga
	'padrao-desligado': [alvo, 'return preferencias.showPlayerNames !== false;', 'return preferencias.showPlayerNames === true;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_LETREIRO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_LETREIRO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [
		{
			name: 'letreiro-do-monstro-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
				if (codigo.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return codigo.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/letreiroDoMonstro.test.js'] }
};
