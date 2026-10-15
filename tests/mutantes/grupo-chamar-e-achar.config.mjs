// A bateria do "Chamar o grupo" e do grupo FECHADO / "Entrar rapido" no
// Localizador (R125, D-2463, D-2464, D-2465, 15/10/2026). Mutacao somente na
// memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
//   RAG_MUTANTE_GRUPO=<id> npx vitest run --config tests/mutantes/grupo-chamar-e-achar.config.mjs
//
// Cada mutante tem de MATAR pelo menos um caso de
// `tests/ui/grupoChamarEAcharRapido.test.js`.
import base from '../../vite.config.js';

const CHAMAR = 'src/UI/Components/GrupoIdle/chamarOGrupo.js';
const VIS = 'src/UI/Components/LFGIdle/visibilidadeDoGrupo.js';
const mutantes = {
	// o membro comum ganha o botao
	chamarSemLider: [CHAMAR, 'return souLider && membros.length > 1;', 'return membros.length > 1;'],
	// o lider sozinho ganha o botao
	chamarSozinho: [CHAMAR, 'return souLider && membros.length > 1;', 'return souLider && membros.length > 0;'],
	// o servidor antigo (sem o campo) vira "fechado"
	fechadoSemCampo: [VIS, 'return !!g && g.anunciado === false;', 'return !!g && g.anunciado !== true;'],
	// o selo do grupo fechado volta a mentir "Publico"/"Privado"
	seloSemFechado: [VIS, "if (grupoFechado(g)) {\n\t\treturn 'Fechado';", "if (false) {\n\t\treturn 'Fechado';"],
	// o grupo fechado acende tambem o botao da privacidade antiga
	seletorDuplo: [VIS, "if (grupoFechado(g)) {\n\t\treturn valor === 'fechado';", "if (false) {\n\t\treturn valor === 'fechado';"],
	// o botao "Fechado" acende num grupo aberto
	fechadoAcesoNoAberto: [VIS, "if (valor === 'fechado') {\n\t\treturn false;", "if (valor === 'fechado') {\n\t\treturn true;"],
	// a contagem volta a contar o meu grupo fechado
	contaOFechado: [VIS, 'return !grupoFechado(g);', 'return true;'],
	// o Entrar rapido aparece para quem ja tem grupo
	rapidoParaTodos: [VIS, 'return !meu;', 'return true;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_GRUPO];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_GRUPO: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [{
		name: 'grupo-chamar-e-achar-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			const normal = codigo.replace(/\r\n/g, '\n');
			if (normal.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normal.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/grupoChamarEAcharRapido.test.js'] }
};
