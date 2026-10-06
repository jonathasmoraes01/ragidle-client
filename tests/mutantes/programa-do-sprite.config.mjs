// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O PROGRAMA DO SPRITE TEM RESERVA (06/10/2026, D-2048). Cada mutante e um
// jeito de a cascata mentir: aceitar a variante que nao desenha, rebaixar por
// sonda que nao sabe, deixar a falha subir e derrubar a entrada no mapa,
// perder o log cru, repetir o relato, calar o PowerVR, ou desenhar sem
// programa. Os fontes dos shaders e a costura do MapRenderer sao portao de
// FONTE no mesmo teste (lidos com `readFileSync`), e a transformacao em
// memoria nao os alcanca — por isso eles nao entram aqui.
//
//   RAG_MUTANTE_SPRITE=<nome> npx vitest run --config tests/mutantes/programa-do-sprite.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const CASCATA = 'src/Renderer/programaDoSprite.js';
const SPRITE = 'src/Renderer/SpriteRenderer.js';
const WEBGL = 'src/Utils/WebGL.js';

export const mutantes = {
	// a variante que compila e nao desenha fica valendo
	aceitaQuemNaoDesenha: [CASCATA, '\t\tif (desenhou !== false) {', '\t\tif (true) {'],
	// a sonda que nao sabe ("null") rebaixa a variante
	naoSabeRebaixa: [CASCATA, '\t\tif (desenhou !== false) {', '\t\tif (desenhou === true) {'],
	// a sonda que lanca vira "nao desenhou"
	sondaQueLancaRebaixa: [CASCATA, "\t\t\t\tsondas[v.nome] = { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };\n\t\t\t\tdesenhou = null;", "\t\t\t\tsondas[v.nome] = { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };\n\t\t\t\tdesenhou = false;"],
	// nenhuma desenhou: fica sem programa em vez da primeira que compilou
	semUltimoRecurso: [CASCATA, '\tif (reserva) {\n\t\treturn {', '\tif (false) {\n\t\treturn {'],
	// a falha de compilacao sobe (o `Uncaught Error` de antes)
	falhaSobe: [CASCATA, '\t\t\tfalhas.push(descreverFalha(v.nome, erro));\n\t\t\tcontinue;', '\t\t\tthrow erro;'],
	// a chave da URL nao pula nada
	chaveIgnorada: [CASCATA, '\t\tif (i < pular) {', '\t\tif (false) {'],
	// a chave pula uma a mais
	chavePulaDemais: [CASCATA, '\t\tif (i < pular) {', '\t\tif (i <= pular) {'],
	// o numero da chave vira sempre 1
	chaveSempreUm: [CASCATA, '\t\tif (Number.isFinite(numero)) return Math.max(0, Math.min(numero, 9));', '\t\tif (Number.isFinite(numero)) return 1;'],
	// o log null do driver vira a mensagem (perde o "null" cru)
	logPerdido: [CASCATA, "\t\t\terro && 'logDoShader' in erro\n", '\t\t\tfalse\n'],
	// a variante descartada fica viva na GPU
	naoApagaDescartada: [CASCATA, '\t\t} else {\n\t\t\tapagar(opcoes, gl, programa);\n\t\t}', '\t\t}'],
	// o relato sai a cada mapa
	relatoRepete: [CASCATA, '\t\tif (_relatado || !_escolha) return false;', '\t\tif (!_escolha) return false;'],
	// o PowerVR com o principal ok fica em silencio (sem saber se o conserto pegou)
	powervrCalado: [CASCATA, "\treturn GPU_DO_DEFEITO.test((gpu && gpu.renderizador) || '');", '\treturn false;'],
	// a falha da sonda no principal nao relata
	falhaSemRelato: [CASCATA, '\tif (escolha.falhas && escolha.falhas.length > 0) return true;', ''],
	// o init volta ao programa unico
	initSemCascata: [SPRITE, '\t\t\tSpriteRenderer.escolherPrograma(gl, lerBuscaDaUrl());', '\t\t\t_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);'],
	// a cascata repete a cada mapa
	cascataRepete: [SPRITE, '\t\tif (!_program && !_programaEscolhido) {', '\t\tif (!_program) {'],
	// sem programa, o bind le `_program.attribute` e lanca
	bindSemGuarda: [SPRITE, '\tstatic bind3DContext(gl, modelView, projection, fog) {\n\t\tif (!_program) {', '\tstatic bind3DContext(gl, modelView, projection, fog) {\n\t\tif (false) {'],
	// sem programa, o unbind lanca
	unbindSemGuarda: [SPRITE, '\tstatic unbind(gl) {\n\t\tif (!_program) {', '\tstatic unbind(gl) {\n\t\tif (false) {'],
	// o compileShader perde o log cru
	compileLogEmTexto: [WEBGL, "\t\tfalha.logDoShader = error;\n\t\tfalha.contextoPerdido = contextoPerdido(gl);\n\t\tthrow falha;", "\t\tfalha.logDoShader = String(error);\n\t\tfalha.contextoPerdido = contextoPerdido(gl);\n\t\tthrow falha;"],
	// o compileShader nao diz que o contexto caiu
	compileSemContexto: [WEBGL, "\t\tfalha.logDoShader = error;\n\t\tfalha.contextoPerdido = contextoPerdido(gl);\n\t\tthrow falha;", "\t\tfalha.logDoShader = error;\n\t\tfalha.contextoPerdido = false;\n\t\tthrow falha;"],
	// todo shader vira "vertex"
	etapaSempreVertex: [WEBGL, "\t\tfalha.etapaDoShader = typeStr === 'Vertex' ? 'compilar-vertex' : 'compilar-fragment';", "\t\tfalha.etapaDoShader = 'compilar-vertex';"]
};

const nome = process.env.RAG_MUTANTE_SPRITE;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_SPRITE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'programa-do-sprite-somente-em-memoria',
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
	test: { ...base.test, include: ['tests/renderer/programaDoSprite.test.js'] }
};

// Rodar todos (bash):
//   for m in $(node -e "import('./tests/mutantes/programa-do-sprite.config.mjs').then(x=>console.log(Object.keys(x.mutantes).join(' ')))"); do
//     RAG_MUTANTE_SPRITE=$m npx vitest run --config tests/mutantes/programa-do-sprite.config.mjs >/dev/null 2>&1 && echo "SOBREVIVEU $m" || echo "morto $m"; done
