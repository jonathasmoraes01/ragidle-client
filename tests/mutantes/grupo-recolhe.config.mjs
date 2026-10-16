// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A LISTA DO GRUPO RECOLHE (15/10/2026, relato de jogador no celular em pe). Cada mutante e um jeito
// de o botao de recolher deixar de funcionar ou de custar: nao recolher, nao guardar, o toque virar
// arrasto, o ticker seguir com a lista escondida, o compacto do grupo grande sumir ou o rotulo perder
// a contagem.
//
//   RAG_MUTANTE_GRUPO=<nome> npx vitest run --config tests/mutantes/grupo-recolhe.config.mjs
//   (sem nome, roda o teste puro; o laco de todos: `for m in $(node -e "import('./tests/mutantes/grupo-recolhe.config.mjs').then(c=>console.log(Object.keys(c.mutantes).join(' ')))"); do ...`)
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/PartyHud/PartyHud.js';

export const mutantes = {
	naoRecolhe: [ALVO, "hud.classList.toggle('is-recolhido', recolhido);", "hud.classList.toggle('is-recolhido', false);"],
	naoGuarda: [ALVO, '_preferences.recolhido = !_preferences.recolhido;\n\t_preferences.save();', '_preferences.recolhido = !_preferences.recolhido;'],
	toqueViraArrasto: [ALVO, "recolher.addEventListener('pointerdown', (event) => event.stopPropagation());", ''],
	tickerSegue: [ALVO, '\tif (_preferences.recolhido) {\n\t\t// Recolhida, ninguem ve as barras: sem ticker.\n\t\t_assidoDesligado();\n\t\treturn;\n\t}', ''],
	semCompacto: [ALVO, "hud.classList.toggle('is-muitos', membros.length > MEMBROS_ANTES_DO_COMPACTO);", ''],
	compactoSempre: [ALVO, 'membros.length > MEMBROS_ANTES_DO_COMPACTO', 'membros.length > 0'],
	compactoNoCinco: [ALVO, 'MEMBROS_ANTES_DO_COMPACTO = 4', 'MEMBROS_ANTES_DO_COMPACTO = 5'],
	rotuloSemContagem: [ALVO, 'escreverTexto(rotulo, `Grupo (${membros.length})`);', ''],
	botaoNaoMuda: [ALVO, "botao.title = recolhido ? 'Mostrar' : 'Recolher';", "botao.title = 'Recolher';"],
	nasceRecolhida: [ALVO, 'recolhido: false\n\t},', 'recolhido: true\n\t},']
};

const nome = process.env.RAG_MUTANTE_GRUPO;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_GRUPO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'grupo-recolhe-somente-em-memoria',
						enforce: 'pre',
						transform(codigo, id) {
							if (!id.replaceAll(String.fromCharCode(92), '/').endsWith(mutante[0])) return null;
							const normalizado = codigo.replaceAll('\r\n', '\n');
							if (normalizado.split(mutante[1]).length !== 2) throw new Error(`Mutante ${nome} nao casa exatamente uma vez.`);
							return normalizado.replace(mutante[1], mutante[2]);
						}
					}
				]
			: [])
	],
	test: {
		...base.test,
		include: ['tests/ui/partyHudRecolhe.test.js']
	}
};
