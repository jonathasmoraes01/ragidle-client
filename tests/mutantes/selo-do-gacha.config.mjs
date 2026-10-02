// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
// O selo do evento de gacha na loja da temporada (D-1901).
// Uso: RAG_MUTANTE_SELO=<nome> npx vitest run --config tests/mutantes/selo-do-gacha.config.mjs
import base from '../../vite.config.js';

const ALVO = 'src/UI/Components/TemporadaIdle/formatoDaTemporada.js';
const mutantes = {
	seloSemRotulo: [
		'<strong class="te-caixa-evento-rotulo">${escapeHtml(evento.rotulo)}</strong>',
		'<strong class="te-caixa-evento-rotulo"></strong>'
	],
	seloSemEscape: ['${escapeHtml(evento.rotulo)}</strong>', '${evento.rotulo}</strong>'],
	seloSempre: ['if (!evento || !evento.rotulo) {', 'if (false) {'],
	seloSemFim: ["(fim ? `<span class=\"te-caixa-evento-fim\">até ${escapeHtml(fim)}</span>` : '')", "''"],
	horaSemMinuto: ["${String(d.getMinutes()).padStart(2, '0')}", '00'],
	seloForaDoCard: ['\t\trenderSeloDoEventoHtml(caixa) +\n', ''],
	resumoSemEvento: ['\t\t\t\tevento +\n', ''],
	resumoSemRotulo: ['Evento: ${escapeHtml(c.evento.rotulo)}</span>', 'Evento</span>']
};
const mutante = mutantes[process.env.RAG_MUTANTE_SELO];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_SELO: ${Object.keys(mutantes).join(', ')}.`);

export default {
	...base,
	plugins: [
		{
			name: 'selo-do-gacha-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll('\\', '/').endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, '\n');
				if (texto.split(mutante[0]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(mutante[0], mutante[1]);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/formatoDaTemporada.test.js'] }
};
