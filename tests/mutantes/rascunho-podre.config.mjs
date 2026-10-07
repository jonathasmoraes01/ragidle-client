// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// O RASCUNHO PODRE DEPOIS DO RESET (07/10/2026, D-2085). Cada mutante e um jeito
// de o rascunho da Config Idle voltar a guardar o que o personagem nao tem mais
// (e o Aplicar ser recusado para sempre), ou de a poda jogar fora o que o
// jogador ainda tem. A costura no `IdleConfig.js` entra aqui: o teste importa o
// componente, entao a transformacao em memoria alcanca a chamada.
//
//   RAG_MUTANTE_RASCUNHO_PODRE=<nome> npx vitest run --config tests/mutantes/rascunho-podre.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const REGRA = 'src/UI/Components/IdleConfig/rascunhoContraOContexto.js';
const JANELA = 'src/UI/Components/IdleConfig/IdleConfig.js';

const mutantes = {
	// a janela nao poda o rascunho quando o contexto chega
	semCostura: [JANELA, '\tconst podado = podarRascunhoPeloContexto(IdleConfig.editConfig, data.contexto);', '\tconst podado = null;'],
	// podado ate ficar igual ao servidor, continua "sujo"
	semRecontarSujo: [JANELA, '\t\tIdleConfig.dirty = JSON.stringify(IdleConfig.editConfig) !== JSON.stringify(IdleConfig.serverConfig);\n\t}\n\n\trenderAll();', '\t}\n\n\trenderAll();'],
	// a rotacao de golpes nao e podada
	semPodaDaRotacao: [REGRA, '\t\tmudancas.rotacao = rotacao;', ''],
	// a rotacao de buffs nao e podada
	semPodaDosBuffs: [REGRA, '\t\tmudancas.rotacaoDeBuffs = buffs;', ''],
	// o buff que nao e mantivel fica na rotacao de buffs
	buffNaoMantivelFica: [REGRA, 'aprendidosDe(ctx.skillsDeBuff, b => b.mantivel !== false)', 'aprendidosDe(ctx.skillsDeBuff)'],
	// apenas-skills com a rotacao podada vazia (o servidor recusa)
	semVoltarAoBasico: [REGRA, "\t\tmudancas.modoDeAtaque = 'skills-e-basico';", ''],
	// volta ao basico mesmo com golpe sobrando na rotacao
	basicoSempre: [REGRA, "if (mudancas.rotacao && mudancas.rotacao.length === 0 && cfg.modoDeAtaque === 'apenas-skills')", "if (cfg.modoDeAtaque === 'apenas-skills')"],
	// a chave de cura nao aprendida fica
	curaPodreFica: [REGRA, '\t\t\tif (!curas.has(skillId)) {\n\t\t\t\tmudou = true;\n\t\t\t\tcontinue;\n\t\t\t}', ''],
	// o nivel acima do aprendido nao e aparado
	semAparar: [REGRA, '|| nivel <= aprendido)', '|| nivel <= aprendido + 99)'],
	// o nivel aparado da cura nao conta como mudanca
	aparoDaCuraNaoConta: [REGRA, '\t\t\tif (aparado !== ajuste) {\n\t\t\t\tmudou = true;', '\t\t\tif (false) {\n\t\t\t\tmudou = true;'],
	// aparar escreve no rascunho original
	mutaOOriginal: [REGRA, '\treturn { ...entrada, nivelDeUso: aprendido };', '\tentrada.nivelDeUso = aprendido;\n\treturn { ...entrada };'],
	// lista ausente no contexto apaga tudo (servidor velho)
	listaAusentePoda: [REGRA, '\tif (!Array.isArray(lista)) {\n\t\treturn null;', '\tif (!Array.isArray(lista)) {\n\t\treturn new Map();'],
	// a forma errada some em vez de ir para a validacao do servidor
	formaErradaSome: [REGRA, '.filter(r => !ehObjeto(r) || typeof r.skillId !== \'string\' || aprendidos.has(r.skillId))', '.filter(r => ehObjeto(r) && aprendidos.has(r.skillId))']
};
const mutante = mutantes[process.env.RAG_MUTANTE_RASCUNHO_PODRE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_RASCUNHO_PODRE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		...(base.plugins || []),
		{
			name: 'rascunho-podre-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').split('?')[0].endsWith(mutante[0])) return null;
				const normalizado = codigo.replaceAll('\r\n', '\n');
				if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return normalizado.replace(mutante[1], mutante[2]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/rascunhoPodreDepoisDoReset.test.js'] }
};
