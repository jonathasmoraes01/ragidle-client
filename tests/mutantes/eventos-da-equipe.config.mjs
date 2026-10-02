// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// Os eventos de drop e respawn no painel de admin (D-1880).
// Uso: RAG_MUTANTE_EQUIPE=<nome> npx vitest run --config tests/mutantes/eventos-da-equipe.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/AdminPanel/eventosDaEquipe.js';
const mutantes = {
	tipoFixo: ['return { v: 1, eventoDoAdmin: { tipo, iniciar:', "return { v: 1, eventoDoAdmin: { tipo: 'drop', iniciar:"],
	horasFixas: ['horas: rascunho.horas } } };', 'horas: 24 } } };'],
	encerrarSemTrue: ['eventoDoAdmin: { tipo, encerrar: true } };', 'eventoDoAdmin: { tipo, encerrar: 1 } };'],
	fimSemChegada: ['? agoraLocal + retratoDeUm.restanteMs : 0', '? retratoDeUm.restanteMs : 0'],
	fimSemAtivo: ['retratoDeUm && retratoDeUm.ativo ?', 'retratoDeUm ?'],
	semEscape: ['Iniciado por ${escapeHtml(evt.porQuem)}', 'Iniciado por ${evt.porQuem}'],
	encerrarSempre: ['${evt.ativo ? `<button type="button" class="ap-equipe-encerrar', '${true ? `<button type="button" class="ap-equipe-encerrar'],
	limiteDoOutroTipo: ['const [pMin, pMax] = limites.porcento[tipo];', 'const [pMin, pMax] = limites.porcento.drop;'],
	atalhoSemMarca: ["${h === meu.horas ? ' is-sel' : ''}", ''],
	secaoSemRetrato: ['if (!retrato) {', 'if (false) {'],
	foraDoDedo: ['class="ap-section ri-card ap-evento ap-eventos-da-equipe"', 'class="ap-section ri-card ap-eventos-da-equipe"'],
	seletorDoExp: ['data-horas-do-evento="${tipo}"', 'data-horas="${tipo}"']
};
const mutante = mutantes[process.env.RAG_MUTANTE_EQUIPE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_EQUIPE: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'eventos-da-equipe-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/eventosDaEquipe.test.js'] }
};
