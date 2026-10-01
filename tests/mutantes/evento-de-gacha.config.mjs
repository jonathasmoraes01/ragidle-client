// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O evento de gacha no painel de admin (D-1900).
// Uso: RAG_MUTANTE_GACHA=<nome> npx vitest run --config tests/mutantes/evento-de-gacha.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/AdminPanel/eventoDeGacha.js';
const mutantes = {
	tipoErrado: ["tipo: 'gacha',\n\t\t\tiniciar:", "tipo: 'drop',\n\t\t\tiniciar:"],
	raroFixo: ['raro: rascunho.raro, horas', 'raro: 1, horas'],
	encerrarSemTrue: ["return { v: 1, eventoDoAdmin: { tipo: 'gacha', encerrar: true } };", "return { v: 1, eventoDoAdmin: { tipo: 'gacha', encerrar: 1 } };"],
	rascunhoSempreNovo: ['if (atual && caixas.some(c => c.pool === atual.pool)) {', 'if (false) {'],
	rascunhoSemConferir: ['if (atual && caixas.some(c => c.pool === atual.pool)) {', 'if (atual) {'],
	caixaSemMarca: ["${c.pool === rascunho.pool ? ' is-sel' : ''}", ''],
	horasSemMarca: ["${h === rascunho.horas ? ' is-sel' : ''}", ''],
	semEscape: ['Iniciado por ${escapeHtml(retrato.porQuem)}', 'Iniciado por ${retrato.porQuem}'],
	encerrarSempre: [
		'${retrato.ativo ? \'<button type="button" class="ap-gacha-encerrar',
		'${true ? \'<button type="button" class="ap-gacha-encerrar'
	],
	secaoSemRetrato: ['if (!retrato) {', 'if (false) {'],
	foraDoDedo: ['class="ap-section ri-card ap-evento ap-evento-de-gacha"', 'class="ap-section ri-card ap-evento-de-gacha"'],
	passoInteiro: ['step="0.1"', 'step="1"'],
	limiteFixo: ['max="${mMax}" value="${rascunho[campo]}"', 'max="5" value="${rascunho[campo]}"'],
	seletorDoExp: ['data-gacha-horas="${h}"', 'data-horas="${h}"'],
	semMultiplicador: ['${escapeHtml(retrato.caixa)}: ${escapeHtml(retrato.rotulo)}', '${escapeHtml(retrato.caixa)}']
};
const mutante = mutantes[process.env.RAG_MUTANTE_GACHA];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_GACHA: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'evento-de-gacha-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/eventoDeGacha.test.js'] }
};
