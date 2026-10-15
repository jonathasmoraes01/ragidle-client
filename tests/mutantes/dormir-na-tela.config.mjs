// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O DORMIR NA TELA (J21, 14/10/2026, D-2477 e D-2478): os numeros do "Dormindo..." (ganho ate agora, ritmo, o que
// falta, o "rendendo"), a volta a selecao sem acordar, e quem dorme na selecao de personagem (o OPT1_SLEEP do
// `bodyState` e a pergunta antes de encerrar o sono). Alvos: `numerosDoSono.js`, `UIManager.js` (showDormindo e o
// casco da tela preta) e `sonoNaSelecao.js`. O que os testes leem do DISCO (o motor, a selecao, a Analise de Caca)
// nao se mede aqui.
//
//   RAG_MUTANTE_DORMIR=<nome> npx vitest run --config tests/mutantes/dormir-na-tela.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in rendendoComZero ateAgoraArredonda ritmoPorMinuto pelaFrenteComODormido avisoSempreGanhando \
//            relogioNaoAndaODormido voltarSemGuarda voltarNaoTrava semBotaoDeVoltar secundarioNunca \
//            pedraESono dorminhocoEncerraASi perguntaTrocaNomes; do
//     RAG_MUTANTE_DORMIR=$m npx vitest run --config tests/mutantes/dormir-na-tela.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
import base from '../../vite.config.js';

const NUMEROS = 'src/UI/numerosDoSono.js';
const UI = 'src/UI/UIManager.js';
const SELECAO = 'src/UI/Components/CharSelect/sonoNaSelecao.js';

const mutantes = {
	// a taxa zero passa a "render": o aviso some e a tela diz "ganhando" com zero
	rendendoComZero: [NUMEROS, '\t\trendendo: base > 0', '\t\trendendo: base >= 0'],
	// o ganho ate agora arredonda para cima (inventa EXP que o acerto nao paga)
	ateAgoraArredonda: [NUMEROS, 'ateAgora: { base: Math.floor(base * dormido)', 'ateAgora: { base: Math.round(base * dormido)'],
	// o ritmo sai por minuto, e nao por hora
	ritmoPorMinuto: [NUMEROS, 'const UMA_HORA_MS = 3600 * 1000;', 'const UMA_HORA_MS = 60 * 1000;'],
	// o que falta usa o tempo ja dormido
	pelaFrenteComODormido: [NUMEROS, 'pelaFrente: { base: Math.floor(base * restante)', 'pelaFrente: { base: Math.floor(base * dormido)'],
	// a tela diz "ganhando" mesmo com a taxa zero
	avisoSempreGanhando: [UI, '\t\tif (inicial.rendendo) {', '\t\tif (true) {'],
	// o relogio da tela desce o restante sem somar no dormido: o ganho ate agora congela
	relogioNaoAndaODormido: [UI, '\t\t\tdormido += Math.min(1000, restante);\n', ''],
	// o "Voltar" chama a volta a cada toque
	voltarSemGuarda: [UI, '\t\t\t\t\t\t\tif (pedindo) {\n\t\t\t\t\t\t\t\treturn;\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {', '\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {'],
	// o "Voltar" nao trava o "Acordar": um toque depois acorda o personagem que so ia a selecao
	voltarNaoTrava: [UI, '\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {', '\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tif (timer) {'],
	// a volta pedida por quem chama nao vira botao
	semBotaoDeVoltar: [UI, '\t\t\t...(onVoltarASelecao\n', '\t\t\t...(false\n'],
	// o casco nunca desenha o segundo botao
	secundarioNunca: [UI, '\tif (textoDoBotaoSecundario) {', '\tif (false) {'],
	// qualquer estado de corpo (a pedra, o congelamento) vira "dormindo" na selecao
	pedraESono: [SELECAO, 'personagem.bodyState === StatusConst.BodyState.SLEEP', 'personagem.bodyState > 0'],
	// entrar com o proprio dorminhoco pergunta se encerra o sono dele
	dorminhocoEncerraASi: [SELECAO, 'p && p.GID !== escolhido.GID && estaDormindoNaLista(p)', 'p && estaDormindoNaLista(p)'],
	// a pergunta troca quem dorme por quem entra
	perguntaTrocaNomes: [SELECAO, '`${nomes} está dormindo. Entrar com ${quemEntra.name}', '`${quemEntra.name} está dormindo. Entrar com ${nomes}']
};
const mutante = mutantes[process.env.RAG_MUTANTE_DORMIR];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_DORMIR: ${Object.keys(mutantes).join(', ')}.`);
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
	test: { ...base.test, include: ['tests/ui/dormirComGanhoVisivel.test.js'] }
};
