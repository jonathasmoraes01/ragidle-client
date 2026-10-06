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
const SONDA = 'src/Renderer/sondaDoSprite.js';

export const mutantes = {
	// a variante que compila e nao desenha fica valendo
	aceitaQuemNaoDesenha: [CASCATA, '\t\tif (desenhou !== false || confiada) {', '\t\tif (true) {'],
	// a sonda que nao sabe ("null") rebaixa a variante
	naoSabeRebaixa: [CASCATA, '\t\tif (desenhou !== false || confiada) {', '\t\tif (desenhou === true || confiada) {'],
	// a sonda que lanca vira "nao desenhou"
	sondaQueLancaRebaixa: [CASCATA, "\t\t\t\tsondas[v.nome] = { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };\n\t\t\t\tdesenhou = null;", "\t\t\t\tsondas[v.nome] = { desenhou: null, motivo: 'a sonda lancou: ' + (erro && erro.message) };\n\t\t\t\tdesenhou = false;"],
	// nenhuma desenhou: fica sem programa em vez da primeira que compilou
	semUltimoRecurso: [CASCATA, '\tif (reserva) {\n\t\treturn {', '\tif (false) {\n\t\treturn {'],
	// a falha de compilacao sobe (o `Uncaught Error` de antes)
	falhaSobe: [CASCATA, '\t\t\tfalhas.push(descreverFalha(v.nome, erro));\n\t\t\tcontinue;', '\t\t\tthrow erro;'],
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
	initSemCascata: [SPRITE, '\t\t\tSpriteRenderer.escolherPrograma(gl, lerBuscaDaUrl(), lerArmazenamento());', '\t\t\t_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);'],
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
	etapaSempreVertex: [WEBGL, "\t\tfalha.etapaDoShader = typeStr === 'Vertex' ? 'compilar-vertex' : 'compilar-fragment';", "\t\tfalha.etapaDoShader = 'compilar-vertex';"],
	// --- D-2054: a regra do PowerVR B-Series, a chave guardada e a sonda fiel ---
	// a regra do PowerVR nunca dispara
	regraDesligada: [CASCATA, '\tif (caiNaRegraDoPowerVR(c.renderizador)) {', '\tif (false) {'],
	// a regra so pega a BXM-8-256 (sai da familia B-Series)
	regraSoBxm: [CASCATA, 'export const GPU_DA_REGRA = /powervr\\s*b-series|\\bbx[ems]-\\d/i;', 'export const GPU_DA_REGRA = /bxm-8-256/i;'],
	// a regra pega todo PowerVR (o Rogue entra sem evidencia)
	regraPegaRogue: [CASCATA, 'export const GPU_DA_REGRA = /powervr\\s*b-series|\\bbx[ems]-\\d/i;', 'export const GPU_DA_REGRA = /powervr/i;'],
	// a chave da URL nao fica guardada
	chaveNaoGuardada: [CASCATA, '\t\t\t\ttentar(() => armazenamento && armazenamento.setItem(CHAVE_DE_ARMAZENAMENTO, String(daUrl)));\n', ''],
	// =0 nao limpa
	zeroNaoLimpa: [CASCATA, '\t\t\ttentar(() => armazenamento && armazenamento.removeItem(CHAVE_DE_ARMAZENAMENTO));\n', ''],
	// =9 (sem programa) fica guardado: o jogador perde os sprites de vez
	noveGuardado: [CASCATA, '\t\t\tif (daUrl !== CHAVE_SEM_PROGRAMA) {', '\t\t\tif (true) {'],
	// a chave guardada e ignorada
	guardadaIgnorada: [CASCATA, '\tif (guardada !== null && guardada !== CHAVE_SEM_PROGRAMA && chaveValida(guardada)) {', '\tif (false) {'],
	// a chave nao confia na variante dela (a sonda decide)
	chaveSemConfianca: [CASCATA, '\t\tconst confiada = i === 0 && opcoes.confiarNaPrimeira === true;', '\t\tconst confiada = false;'],
	// a chave confia em TODAS (a reserva dela nao passa pela sonda)
	chaveConfiaEmTodas: [CASCATA, '\t\tconst confiada = i === 0 && opcoes.confiarNaPrimeira === true;', '\t\tconst confiada = opcoes.confiarNaPrimeira === true;'],
	// a chave que nao compila nao cai na minima
	chaveSemMinima: [CASCATA, "\t\t\tordem: montar([daChave, 'minima', ...ORDEM_PADRAO]),", '\t\t\tordem: montar([daChave, ...ORDEM_PADRAO]),'],
	// o relato nao diz quem decidiu
	relatoSemOrigem: [CASCATA, "\t\t: '[sprite] valendo=' + valendo + ' origem=' + origem;", "\t\t: '[sprite] valendo=' + valendo;"],
	// a origem nao chega a escolha
	origemPerdida: [SPRITE, '\t\t\tescolha.origem = plano.origem;\n', ''],
	// a sonda do principal nao vai ao relato
	semSondaDoPrincipal: [SPRITE, '\t\t\t\tescolha.sondaDoPrincipal = SpriteRenderer.sondarFontes(gl, _vertexShader, _fragmentShader);\n', ''],
	// a sonda desenha com o programa do jogo, e nao com o candidato
	sondaComOProgramaErrado: [SPRITE, '\t\t_program = programa;\n\t\tzerarCaches();', '\t\t_program = anterior;\n\t\tzerarCaches();'],
	// a sonda deixa a textura dela no lugar da do jogo
	sondaNaoDevolve: [SPRITE, '\t\t\tthis.image.texture = salvo.texture;\n', ''],
	// a sonda volta a aprovar pixel aceso de qualquer cor
	sondaSoCobertura: [SONDA, '\treturn { cobertos, certos, passou: certos >= PIXELS_MINIMOS };', '\treturn { cobertos, certos, passou: cobertos >= PIXELS_MINIMOS };'],
	// a sonda nao olha o alfa
	sondaSemAlfa: [SONDA, '\t\t\tMath.abs(a - esperado[3]) <= tolerancia\n', '\t\t\ttrue\n']
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
