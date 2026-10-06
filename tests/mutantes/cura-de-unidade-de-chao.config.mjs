// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A CURA DE UMA UNIDADE DE CHAO (D-2036, 06/10/2026). O tique do Santuario chega
// como AL_HEAL com a unidade como origem; cada mutante e um jeito de o cliente
// voltar a por a unidade em pose ou de a guarda engolir a pose de quem conjura.
//
//   RAG_MUTANTE_CURA_DE_UNIDADE=<nome> npx vitest run --config tests/mutantes/cura-de-unidade-de-chao.config.mjs
//
// Um mutante MORTO faz a corrida reprovar.
import base from '../../vite.config.js';

const ALVO = 'src/Engine/MapEngine/Entity.js';
const NL = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const linhas = (...partes) => partes.join(NL);

const mutantes = {
	// a guarda some: a unidade volta a ganhar setAction a cada tique
	semGuardaDaPose: [
		ALVO,
		TAB + 'if (srcEntity && !origemEhUnidadeDeChao) {' + NL + TAB + TAB + 'if (srcEntity.action !== srcEntity.ACTION.DIE',
		TAB + 'if (srcEntity) {' + NL + TAB + TAB + 'if (srcEntity.action !== srcEntity.ACTION.DIE'
	],
	// a guarda vale para todo mundo: quem conjura a Cura perde a pose
	guardaParaTodos: [
		ALVO,
		linhas('como os da Cura.', TAB + ' */', TAB + 'const origemEhUnidadeDeChao =', TAB + TAB + '!!srcEntity &&'),
		linhas('como os da Cura.', TAB + ' */', TAB + 'const origemEhUnidadeDeChao =', TAB + TAB + '!!srcEntity ||')
	],
	// o efeito desenhado (TYPE_EFFECT, o Santuario) sai da guarda
	semEfeito: [
		ALVO,
		linhas(
			TAB + TAB + '(srcEntity.objecttype === Entity.TYPE_EFFECT ||',
			TAB + TAB + TAB + 'srcEntity.objecttype === Entity.TYPE_UNIT ||',
			TAB + TAB + TAB + 'srcEntity.objecttype === Entity.TYPE_TRAP);',
			'',
			TAB + '// Don'
		),
		linhas(
			TAB + TAB + '(srcEntity.objecttype === Entity.TYPE_UNIT ||',
			TAB + TAB + TAB + 'srcEntity.objecttype === Entity.TYPE_TRAP);',
			'',
			TAB + '// Don'
		)
	]
};
const mutante = mutantes[process.env.RAG_MUTANTE_CURA_DE_UNIDADE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_CURA_DE_UNIDADE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [{
		name: 'cura-de-unidade-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.split(String.fromCharCode(92)).join('/').endsWith(mutante[0])) return null;
			const normalizado = codigo.split(String.fromCharCode(13) + NL).join(NL);
			if (normalizado.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return normalizado.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/renderer/curaDeUnidadeDeChao.test.js'] }
};
