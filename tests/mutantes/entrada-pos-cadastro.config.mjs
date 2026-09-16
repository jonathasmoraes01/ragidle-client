// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A ENTRADA POS-CADASTRO (D-1379). Cada mutante e um jeito de a entrada errar
// calada, e o que mais importa e o `recorrente`: ele abre a criacao e dispara a
// conversao para quem so digitou a senha, que e o que o pedido do dono proibe.
//
//   RAG_MUTANTE_ENTRADA=<nome> npx vitest run --config tests/mutantes/entrada-pos-cadastro.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/Engine/entradaPosCadastro.js';

const mutantes = {
	// qualquer login com uma entrada capturada arma o estado, mesmo com outra senha
	armarSemConferir: [ALVO, '_pendente = _entrada !== null && usuario === _entrada.usuario && senha === _entrada.passe;', '_pendente = _entrada !== null;'],
	// a criacao abre (e a conversao sai) para toda conta sem personagem, sem passe nenhum
	recorrente: [ALVO, 'const abrir = _aceita && quantosPersonagens === 0;', 'const abrir = quantosPersonagens === 0;'],
	// a decisao nao se apaga: voltar da criacao para a selecao reabre a criacao
	decideSempre: [ALVO, '\t_aceita = false;\n\treturn abrir;', '\treturn abrir;'],
	// o Pixel que lanca derruba o laco de rede do cliente
	fbqSemCerca: [ALVO, '\t} catch (e) {\n\t\treturn false;\n\t}\n}\n\n/** So para os testes', '\t} catch (e) {\n\t\tthrow e;\n\t}\n}\n\n/** So para os testes'],
	// a forma deixa de ser conferida: lixo no fragmento vira tentativa de login
	semForma: [ALVO, 'const FORMA_DA_ENTRADA = /^([A-Za-z0-9_]{4,23})\\.([A-Za-z0-9_-]{22})$/;', 'const FORMA_DA_ENTRADA = /^(.+)\\.(.+)$/;'],
	// na reserva, o passe fica na barra de endereco (e no PageView do Pixel)
	hashFica: [ALVO, "janela.history.replaceState(null, '', janela.location.pathname + janela.location.search);", 'void 0;'],
	// a variavel do api.html nao e apagada: a entrada seria capturada de novo
	variavelFica: [ALVO, 'janela.RAGIDLE_ENTRADA = undefined;', 'void 0;'],
	// a recusa do passe cai na mensagem generica de senha errada
	recusaMuda: [ALVO, 'const usuario = _pendente && _entrada !== null ? _entrada.usuario : null;', 'const usuario = null;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_ENTRADA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_ENTRADA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'entrada-pos-cadastro-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			const normalizado = codigo.replaceAll('\r\n', '\n');
			if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/entradaPosCadastro.test.js'] }
};
