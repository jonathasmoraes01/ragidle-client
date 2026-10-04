// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// "USAR COMO ATAQUE CONTRA MORTO-VIVO" (04/10/2026, D-1963). Cada mutante e um
// jeito de a janela mentir: oferecer o interruptor a quem nao o cumpre, ligar
// sozinho, ou gravar a marca errada. A costura no `IdleConfig.js` e portao de
// FONTE (`tests/ui/curaComoAtaque.test.js` le o arquivo), e a transformacao
// em memoria nao alcanca leitura de fonte — por isso ela nao entra aqui.
//
//   RAG_MUTANTE_ATAQUE_DA_CURA=<nome> npx vitest run --config tests/mutantes/cura-como-ataque.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/IdleConfig/curaComoAtaque.js';

const mutantes = {
	// o servidor velho tambem ganha o interruptor (a tela prometeria o que nao sai)
	semCapacidade: [ALVO, '\treturn !!(ctx && ctx.capacidades && ctx.capacidades.curaComoAtaque === true);', '\treturn true;'],
	// toda cura ganha o interruptor, mesmo a que nao fere morto-vivo
	todaCura: [ALVO, '\treturn curaComoAtaqueServida(ctx) && !!cura && cura.fereMortoVivo === true;', '\treturn curaComoAtaqueServida(ctx) && !!cura;'],
	// nasce ligado
	nasceLigado: [ALVO, '\treturn !!ajuste && ajuste.comoAtaque === true;', '\treturn !ajuste || ajuste.comoAtaque !== false;'],
	// desligar grava `false` em vez de apagar a marca
	desligarGravaFalso: [ALVO, '\t\tdelete novo.comoAtaque;', '\t\tnovo.comoAtaque = false;'],
	// com a cura desligada o interruptor continua mexivel
	semTrava: [ALVO, "${ativo ? 'checked' : ''} ${p.ligada ? '' : 'disabled'}", "${ativo ? 'checked' : ''}"]
};
const mutante = mutantes[process.env.RAG_MUTANTE_ATAQUE_DA_CURA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_ATAQUE_DA_CURA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'cura-como-ataque-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			const normalizado = codigo.replaceAll('\r\n', '\n');
			if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/curaComoAtaque.test.js'] }
};
