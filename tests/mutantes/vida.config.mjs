// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
import base from '../../vite.config.js';

const mutantes = {
	entrada: ['src/Renderer/Entity/Entity.js', 'this.life.hp = unit.hp;', 'this.life.hp = -1;'],
	antecipacao: ['src/Renderer/Entity/VidaNoImpacto.js', 'if (impactos?.length) {', 'if (false) {'],
	ataque: ['src/Engine/MapEngine/Entity.js', 'dstEntity.life.registrarImpactos(impactos);', 'dstEntity.life.registrarImpactos([]);'],
	morte: ['src/Renderer/Entity/VidaNoImpacto.js', 'if (this.ultimoImpacto <= this.agora()) return false;', 'return false;'],
	// aba escondida (04/10/2026): a morte volta a esperar o impacto que ninguem ve
	'oculta-adia-morte': ['src/Renderer/Entity/VidaNoImpacto.js', 'if (this.ninguemVe()) return false;', ''],
	// aba escondida: o dano volta a ser agendado
	'oculta-agenda-dano': ['src/Renderer/Entity/VidaNoImpacto.js', 'if (impactos?.length && this.ninguemVe()) {', 'if (false) {']
};
const mutante = mutantes[process.env.RAG_MUTANTE_VIDA];
if (!mutante) throw new Error('Escolha RAG_MUTANTE_VIDA: ' + Object.keys(mutantes).join(', ') + '.');

export default {
	...base,
	plugins: [{
		name: 'regressao-da-vida-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.replaceAll('\\', '/').endsWith(mutante[0])) return null;
			if (codigo.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return codigo.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/renderer/vidaNoImpacto.test.js', 'tests/renderer/vidaNosPacotes.test.js'] }
};
