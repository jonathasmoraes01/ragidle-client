// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O AVISO DO MENU DO BOT ABERTO/FECHADO (D-2416, 15/10/2026): cada mutante e um jeito de o servidor ficar com a ideia
// errada do menu (fechado com a janela aberta = menu velho; aberto com ela fechada = os bytes de volta) ou de o aviso
// sair antes do estou-pronto (D-993) ou para um servidor que nao o conhece (que o responderia com erro).
// Alvos: `BotMenu.js` (a costura) e `estadoDoBot.js` (o verbo e o `mapa` ausente).
//
//   RAG_MUTANTE_AVISO=<nome> npx vitest run --config tests/mutantes/aviso-do-menu.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in semAvisarAoAbrir aceitaSemAnuncio naoZeraAnuncio mapaAusenteApaga semAvisarAoFechar semAvisarNaTroca \
//            semAvisarNoPacote avisaSempre naoZeraUltimoAviso naoZeraProntidao avisoEmVoo ignoraProntidao \
//            semAvisarNoProntoNovo; do
//     RAG_MUTANTE_AVISO=$m npx vitest run --config tests/mutantes/aviso-do-menu.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
//
// A CHAMADA em `Engine/MapEngine.js` (o aviso depois do `CZ_NOTIFY_ACTORINIT`) nao se mede aqui: o teste a le do
// DISCO. Foi medida com a mutacao no disco e restauro por copia (1 teste morre).
import base from '../../vite.config.js';

const BOT_MENU = 'src/UI/Components/BotMenu/BotMenu.js';
const ESTADO = 'src/UI/Components/BotMenu/estadoDoBot.js';

const mutantes = {
	// abrir nao avisa: o servidor segue achando a janela fechada e o menu aberto fica velho
	semAvisarAoAbrir: [BOT_MENU, '\t\t// D-2416: o aviso de aberta ANTES do `pedir` (o servidor volta a mandar o status inteiro).\n\t\tsincronizarAvisoDoMenu();\n', ''],
	// avisa sem o servidor anunciar (o de antes responderia "pedido-invalido")
	aceitaSemAnuncio: [BOT_MENU, '_avisoAceitoNestaConexao = dados.capacidades.avisoDoMenu === true;', '_avisoAceitoNestaConexao = true;'],
	// o anuncio da conexao anterior vale na nova (o servidor novo pode ser o de antes)
	naoZeraAnuncio: [BOT_MENU, '\t_prontoNestaConexao = false;\n\t_avisoAceitoNestaConexao = false;\n\t_menuAvisado = null;', '\t_prontoNestaConexao = false;\n\t_menuAvisado = null;'],
	// o status sem `mapa` apaga o mapa
	mapaAusenteApaga: [ESTADO, "\t\t\tif ('mapa' in d) {\n\t\t\t\ts.mapa = d.mapa;\n\t\t\t}", '\t\t\ts.mapa = d.mapa;'],
	// fechar (o toggle e o X) nao avisa: os bytes voltam
	semAvisarAoFechar: [BOT_MENU, "\t\twin.classList.remove('is-open');\n\t}\n\tsincronizarAvisoDoMenu();", "\t\twin.classList.remove('is-open');\n\t}"],
	// a troca de personagem fecha sem avisar
	semAvisarNaTroca: [BOT_MENU, "\tfecharEEsquecer(_root(), '.bm-window');\n\tsincronizarAvisoDoMenu();", "\tfecharEEsquecer(_root(), '.bm-window');"],
	// as capacidades chegam depois do estou-pronto e o aviso nunca sai
	semAvisarNoPacote: [BOT_MENU, '\t\t\tavisarCapacidade();\n\t\t}\n\t}\n\tsincronizarAvisoDoMenu();\n}', '\t\t\tavisarCapacidade();\n\t\t}\n\t}\n}'],
	// avisa o mesmo estado a cada pacote (um pacote de volta por pacote)
	avisaSempre: [BOT_MENU, '\tif (aberta === _menuAvisado) {\n\t\treturn;\n\t}', ''],
	// a conexao nova nao avisa de novo o mesmo estado (o servidor novo comeca mandando tudo)
	naoZeraUltimoAviso: [BOT_MENU, '\t_avisoAceitoNestaConexao = false;\n\t_menuAvisado = null;', '\t_avisoAceitoNestaConexao = false;'],
	// o estou-pronto da conexao anterior vale na nova (o aviso antes do CZ_NOTIFY_ACTORINIT, D-993)
	naoZeraProntidao: [BOT_MENU, '\t_estado.novaConexao();\n\t_prontoNestaConexao = false;', '\t_estado.novaConexao();'],
	// o aviso entra nos pedidos em voo (e nunca sai: o servidor nao responde)
	avisoEmVoo: [ESTADO, "\t\t\tenviar({ v: 1, requestId: proximoRequest++, verbo: 'menu', aberto: !!aberto });", "\t\t\treturn pedir('menu', { aberto: !!aberto });"],
	// avisa antes do estou-pronto
	ignoraProntidao: [BOT_MENU, '\tif (!_prontoNestaConexao || !_avisoAceitoNestaConexao) {', '\tif (!_avisoAceitoNestaConexao) {'],
	// o estou-pronto nao avisa (so o pacote seguinte avisaria)
	semAvisarNoProntoNovo: [BOT_MENU, '\t_prontoNestaConexao = true;\n\tsincronizarAvisoDoMenu();', '\t_prontoNestaConexao = true;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_AVISO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_AVISO: ${Object.keys(mutantes).join(', ')}.`);
const [ALVO, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'aviso-do-menu-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(de).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(de, para);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/botMenuAvisoDoMenu.test.js'] }
};
