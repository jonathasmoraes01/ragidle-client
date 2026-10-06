// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// OS TRES DEFEITOS ANTIGOS DO NPC (D-2049, 06/10/2026). O teste monta os
// componentes DE VERDADE no jsdom (Escape, NpcMenu, NpcBox, e os ganchos de
// NPC.js, Skill.js e RagidleConfirmar.js), entao a transformacao em memoria
// alcanca a costura inteira, e nao so a regra pura. Cada mutante e um jeito de
// um defeito voltar: o ESC abrir as Configuracoes por cima da conversa, o
// titulo do Portal vazar para o menu seguinte, a fala sair do centro no dedo.
//
//   RAG_MUTANTE_CONVERSA_NPC=<nome> npx vitest run --config tests/mutantes/conversa-com-npc.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const REGISTRO = 'src/UI/conversaNaTela.js';
const ESCAPE = 'src/UI/Components/Escape/Escape.js';
const MENU = 'src/UI/Components/NpcMenu/NpcMenu.js';
const FALA = 'src/UI/Components/NpcBox/NpcBox.js';
const CONFIRMAR = 'src/Engine/MapEngine/RagidleConfirmar.js';
const SKILL = 'src/Engine/MapEngine/Skill.js';
const POSICAO = 'src/UI/Components/NpcMenu/posicaoDoMenu.js';

export const mutantes = {
	// 1. O ESC
	// as Configuracoes nao perguntam pela conversa (o defeito de volta)
	escSemGuarda: [ESCAPE, '\t\tif (conversaNaTela() !== null) {\n\t\t\treturn;\n\t\t}\n', ''],
	// a pergunta invertida: so abre COM conversa
	escGuardaInvertida: [ESCAPE, 'if (conversaNaTela() !== null) {', 'if (conversaNaTela() === null) {'],
	// o menu nao se registra
	menuSemRegistro: [MENU, "registrarConversa('menu', () => componenteNaTela(NpcMenu));", ''],
	// a fala nao se registra
	falaSemRegistro: [FALA, "registrarConversa('fala', () => componenteNaTela(NpcBox));", ''],
	// a confirmacao nao se registra
	confirmacaoSemRegistro: [CONFIRMAR, "registrarConversa('confirmacao', () => componenteNaTela(_janela));", ''],
	// "na tela" ignora o remove() (o host fica no DOM na saida animada)
	naTelaSemActive: [REGISTRO, 'componente && componente.__active && componente._host', 'componente && componente._host'],
	// "na tela" ignora o display none
	naTelaSemDisplay: [REGISTRO, "componente._host.style.display !== 'none'", 'true'],
	// qualquer valor verdadeiro tranca o ESC
	quaseVerdadeiro: [REGISTRO, 'naTela = estaNaTela() === true;', 'naTela = !!estaNaTela();'],
	// uma leitura quebrada tranca o ESC do jogo inteiro
	lancaTranca: [REGISTRO, '} catch (_erro) {\n\t\t\tnaTela = false;', '} catch (_erro) {\n\t\t\tnaTela = true;'],
	// nome vazio entra no registro
	registroSemNome: [REGISTRO, "if (!nome || typeof estaNaTela !== 'function') {", "if (typeof estaNaTela !== 'function') {"],
	// so a primeira parte e olhada
	soAPrimeira: [REGISTRO, '\t\tif (naTela) {\n\t\t\treturn nome;\n\t\t}\n\t}\n\treturn null;', '\t\treturn naTela ? nome : null;\n\t}\n\treturn null;'],

	// 2. O PORTAL
	// o titulo sobrevive ao menu
	tituloFica: [MENU, "\t\ttitle.textContent = '';", ''],
	// o gancho de abertura volta a ficar gravado (o defeito antigo, so o titulo)
	ganchoVolta: [
		SKILL,
		'\tNpcMenu.append();\n\n\tconst mapNames = [];',
		'\tNpcMenu.onAppend = () => NpcMenu.ui.find(\'.title\').text(DB.getMessage(213));\n\tNpcMenu.append();\n\n\tconst mapNames = [];'
	],

	// 3. A FALA NO CELULAR
	// no dedo, nao centraliza
	falaNaoCentraliza: [FALA, '\t\tcentralizar: true\n\t});', '\t\tcentralizar: false\n\t});'],
	// centraliza tambem no mouse (o desktop muda)
	falaIgnoraODedo: [FALA, 'if (!ehDedo() || !this._host) {', 'if (!this._host) {'],
	// esquece o zoom do host
	falaSemZoom: [FALA, '`${Math.round(left) / zoom}px`', '`${Math.round(left)}px`'],
	// o menu deixa de usar a regra comum
	menuSemRegraComum: [POSICAO, 'const left = posicaoHorizontal({ telaLargura: tela.largura, largura, preferida: preferida.left, centralizar });', 'const left = preferida.left;']
};

const nome = process.env.RAG_MUTANTE_CONVERSA_NPC;
const mutante = mutantes[nome];
if (nome && !mutante) throw new Error(`Escolha RAG_MUTANTE_CONVERSA_NPC: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(mutante
			? [
					{
						name: 'conversa-com-npc-somente-em-memoria',
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
	test: { ...base.test, include: ['tests/ui/conversaComNpc.test.js', 'tests/ui/posicaoDoMenuDeNpc.test.js'] }
};

// Rodar todos (bash):
//   for m in $(node -e "import('./tests/mutantes/conversa-com-npc.config.mjs').then(x=>console.log(Object.keys(x.mutantes).join(' ')))"); do
//     RAG_MUTANTE_CONVERSA_NPC=$m npx vitest run --config tests/mutantes/conversa-com-npc.config.mjs >/dev/null 2>&1 && echo "SOBREVIVEU $m" || echo "morto $m"; done
