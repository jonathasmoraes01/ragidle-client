// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A JANELA "AMIGOS" (05/10/2026). Cada mutante e um jeito de a janela mentir:
// pintar offline como online, oferecer convite a quem nao pode convidar,
// engolir a recusa, remover sem perguntar, ou ler a fala de outro remetente.
// A costura (MapEngine, menu, Friends/Group/Main) e portao de FONTE no mesmo
// teste, e a transformacao em memoria nao alcanca leitura de fonte — por isso
// ela nao entra aqui.
//
//   RAG_MUTANTE_AMIGOS=<nome> npx vitest run --config tests/mutantes/amigos.config.mjs
//   (todos: for m in $(node -e "...") — ver o rodape)
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/AmigosIdle/controladorDosAmigos.js';

export const mutantes = {
	// sem estado (ou estado 1) tambem vira online
	todoMundoOnline: [ALVO, '\treturn !!amigo && amigo.State === 0;', '\treturn !!amigo;'],
	// o offline ganha Mensagem/Convidar
	botoesNoOffline: [ALVO, '\t\tconst acoesOnline = online\n', '\t\tconst acoesOnline = true\n'],
	// online fora de ordem
	semOrdem: [ALVO, '\t\tonline: todos.filter(estaOnline).sort(porNome),', '\t\tonline: todos.filter(estaOnline),'],
	// a contagem de online conta todo mundo
	contagemErrada: [ALVO, '\t\t\tcOn.textContent = String(online.length);', '\t\t\tcOn.textContent = String(_lista.length);'],
	// sem grupo, o convite sai calado (e o Group.js o descartaria)
	semGuardaDoGrupo: [ALVO, '\t\tif (!g.temGrupo) {', '\t\tif (false) {'],
	// quem nao e lider tambem "convida"
	semGuardaDoLider: [ALVO, '\t\tif (!g.souLider) {', '\t\tif (false) {'],
	// convida quem ja esta no grupo
	semGuardaDoMembro: [ALVO, '\t\tif (ctx.ehDoMeuGrupo(amigo.Name)) {', '\t\tif (false) {'],
	// a resposta de qualquer convite pinta o recado
	respostaDeOutro: [ALVO, '\t\t\tif (_conviteNoAr === null || nome !== _conviteNoAr) {', '\t\t\tif (_conviteNoAr === null) {'],
	// grupo cheio sai em verde
	cheioEmVerde: [ALVO, "\t3: { tom: 'erro'", "\t3: { tom: 'ok'"],
	// o clique velho num amigo que saiu ainda convida
	cliqueVelho: [ALVO, "\t\t\tcase 'convidar':\n\t\t\t\tif (!estaOnline(amigo)) {\n\t\t\t\t\treturn null;\n\t\t\t\t}\n", "\t\t\tcase 'convidar':\n"],
	// a mensagem a quem saiu
	mensagemAoOffline: [ALVO, "\t\t\tcase 'mensagem':\n\t\t\t\tif (!estaOnline(amigo)) {\n\t\t\t\t\treturn null;\n\t\t\t\t}\n", "\t\t\tcase 'mensagem':\n"],
	// remover sem perguntar
	removerSemConfirmar: [ALVO, "\t\t\tcase 'remover':\n\t\t\t\t_confirmando = amigo.GID;", "\t\t\tcase 'remover':\n\t\t\t\tctx.removerAmigo(amigo);\n\t\t\t\t_confirmando = amigo.GID;"],
	// pedir amizade a si mesmo sai (o servidor responderia com silencio)
	pedirASiMesmo: [ALVO, '\t\tif (ctx.meuNome && nome === ctx.meuNome()) {', '\t\tif (false) {'],
	// a fala de outro remetente vira recado da janela
	qualquerRemetente: [ALVO, '/^Amigos : (.+)$/', '/^\\S+ : (.+)$/'],
	// o nome do jogador sai traduzivel
	nomeTraduzivel: [ALVO, '`<span class="am-nome" translate="no">${nome}</span>` +\n\t\t\t\'<span class="am-acoes">', '`<span class="am-nome">${nome}</span>` +\n\t\t\t\'<span class="am-acoes">']
};

const nome = process.env.RAG_MUTANTE_AMIGOS;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_AMIGOS: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'amigos-somente-em-memoria',
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
	test: { ...base.test, include: ['tests/ui/amigosIdle.test.js'] }
};

// Rodar todos (bash):
//   for m in $(node -e "import('./tests/mutantes/amigos.config.mjs').then(x=>console.log(Object.keys(x.mutantes).join(' ')))"); do
//     RAG_MUTANTE_AMIGOS=$m npx vitest run --config tests/mutantes/amigos.config.mjs >/dev/null 2>&1 && echo "SOBREVIVEU $m" || echo "morto $m"; done
