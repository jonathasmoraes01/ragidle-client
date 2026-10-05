// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A CURA COMO ATAQUE TAMBEM NA ABA ATAQUE (05/10/2026, D-1990). Cada mutante e
// um jeito de a aba Ataque mentir: nao mostrar o cartao, mostrar a cura que
// nao fere, ter estado proprio (nao ler a config que a aba Suporte le), ou
// gravar diferente do que a aba Suporte grava. A costura no `IdleConfig.js` e
// portao de FONTE (`tests/ui/curaNaAbaAtaque.test.js` le o arquivo), e a
// transformacao em memoria nao alcanca leitura de fonte.
//
//   RAG_MUTANTE_CURA_NO_ATAQUE=<nome> npx vitest run --config tests/mutantes/cura-na-aba-ataque.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/IdleConfig/curaComoAtaque.js';

const mutantes = {
	// a aba Ataque nunca desenha o cartao
	semCartao: [ALVO, '\tif (!curas.length) {\n\t\treturn \'\';\n\t}\n\tconst habilidades', '\tif (true) {\n\t\treturn \'\';\n\t}\n\tconst habilidades'],
	// toda cura entra, mesmo a que nao fere morto-vivo
	todaCura: [ALVO, '(p.curas || []).filter(c => ofereceAtaqueDaCura(c, p.ctx))', '(p.curas || []).filter(c => !!c)'],
	// estado proprio: a aba Ataque nao le a marca da config
	naoLeAConfig: [ALVO, '\t\t\t\tajuste: habilidades[c.skillId] || {},', '\t\t\t\tajuste: {},'],
	// a trava some: a cura desligada nao apaga o interruptor
	semTrava: [ALVO, '\t\t\t\tligada: curaLigadaPara(p.cura, c.skillId),', '\t\t\t\tligada: true,'],
	// a cura desligada manda "ligar acima", onde nao ha cura nenhuma
	motivoDaOutraAba: [ALVO, "? p.motivoDesligada || 'Ligue a cura acima para usar o ataque.'", "? 'Ligue a cura acima para usar o ataque.'"],
	// sem a linha que explica a prioridade
	semNota: [ALVO, '\t\t\t<div class="ic-note">Com o HP acima do limite de cura, usa a Cura no monstro morto-vivo; abaixo, cura você primeiro.</div>\n', ''],
	// gravar sem herdar o ligado do geral (ligar o ataque religaria a cura)
	semHerancaDoLigado: [ALVO, '\t\tligada: curaLigadaPara(cura, skillId),', '\t\tligada: true,'],
	// gravar sem herdar o alvo do geral
	semHerancaDoAlvo: [ALVO, "\t\talvo: (cura && cura.alvo) || 'grupo'", "\t\talvo: 'grupo'"],
	// gravar mexendo no objeto recebido
	mudaOOriginal: [ALVO, '\treturn { ...cura, habilidades: { ...habilidades, [skillId]: comAtaqueDaCura(atual, ligado) } };', '\thabilidades[skillId] = comAtaqueDaCura(atual, ligado);\n\treturn cura;'],
	// gravar sem a marca (a aba muda e a config nao)
	naoGrava: [ALVO, '[skillId]: comAtaqueDaCura(atual, ligado) } };', '[skillId]: atual } };']
};
const mutante = mutantes[process.env.RAG_MUTANTE_CURA_NO_ATAQUE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_CURA_NO_ATAQUE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'cura-na-aba-ataque-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			const normalizado = codigo.replaceAll('\r\n', '\n');
			if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/curaNaAbaAtaque.test.js', 'tests/ui/curaComoAtaque.test.js'] }
};
