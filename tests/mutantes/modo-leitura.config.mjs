/**
 * BATERIA DE MUTACAO — a condicao do modo leitura (09/09/2026).
 *
 * Ela existe porque a extracao de `deveManterAcesa` para um arquivo proprio so
 * paga alguma coisa se o teste dela MEDIR: mover uma decisao para onde ela
 * pode ser executada, e nao conferir que os testes morrem quando ela muda,
 * troca um arquivo nao-testado por outro arquivo nao-testado.
 *
 * Como rodar (uma por vez, como a bateria da vida):
 *
 *   RAG_MUTANTE_MODO_LEITURA=<nome> npx vitest run --config tests/mutantes/modo-leitura.config.mjs
 *
 * O esperado e REPROVAR nos cinco. Mutante que passa e teste que nao mede.
 *
 * O primeiro deles, `sempre-apagada`, e o mais importante e nao mede nenhuma
 * regra: ele existe para cobrar o CONTROLE. Sem esse caso, uma funcao que
 * devolvesse `false` sempre passaria em todos os outros testes da suite — o
 * "criterio que passa com zero" que este projeto mais repete.
 */
import base from '../../vite.config.js';

const ALVO = 'src/UI/decisaoDoModoLeitura.js';

const mutantes = {
	// A funcao nunca acende. So o CONTROLE pega isto.
	'sempre-apagada': [ALVO, 'if (!estado || !estado.cacaAutomatica) {', 'if (true) {'],
	// O Auto deixa de contar: a tela ficaria acesa com o farm desligado.
	'ignora-o-auto': [ALVO, 'if (!estado || !estado.cacaAutomatica) {', 'if (!estado) {'],
	// A ressalva do contexto obsoleto some: a tela apaga no meio da viagem.
	'ignora-o-obsoleto': [ALVO, 'if (estado.contextoObsoleto) {', 'if (false) {'],
	// Com o contexto obsoleto ela ACENDE em vez de manter o que estava.
	'obsoleto-sempre-acende': [ALVO, 'return !!estado.estavaAcesa;', 'return true;'],
	// A cidade deixa de contar: bateria gasta parado em Prontera.
	'ignora-a-cidade': [ALVO, 'return !estado.ehCidade;', 'return true;'],
	// O FREIO DA RECUSA some: volta o pedido por segundo, para sempre.
	'sem-freio': [ALVO, 'if (!recusas || recusas < 1) {', 'if (true) {'],
	// O freio para de crescer: a 20a recusa espera o mesmo que a 1a.
	'freio-que-nao-cresce': [ALVO, 'Math.pow(2, recusas - 1)', 'Math.pow(1, recusas - 1)'],
	// O teto some: a 20a recusa pediria uma espera de dias.
	'freio-sem-teto': [ALVO, 'return Math.min(dobrando, ESPERA_MAXIMA_MS);', 'return dobrando;']
};

// O separador do Windows, montado por codigo: a barra invertida literal aqui
// ja custou uma corrida inteira de bateria que nao compilava — e bateria que
// nao compila reporta como bateria sem achados.
const BARRA = String.fromCharCode(92);

const mutante = mutantes[process.env.RAG_MUTANTE_MODO_LEITURA];
if (!mutante) {
	throw new Error('Escolha RAG_MUTANTE_MODO_LEITURA: ' + Object.keys(mutantes).join(', ') + '.');
}

export default {
	...base,
	plugins: [{
		name: 'modo-leitura-somente-em-memoria',
		enforce: 'pre',
		transform(codigo, id) {
			if (!id.split(BARRA).join('/').endsWith(mutante[0])) return null;
			// Recusar mutante que nao casa e o que impede a bateria de virar
			// decoracao quando o alvo for refatorado: sem isto, ela devolveria
			// "0 mortos" com cara de nada-a-reportar.
			if (codigo.split(mutante[1]).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
			return codigo.replace(mutante[1], mutante[2]);
		}
	}],
	test: { ...base.test, include: ['tests/ui/telaAcesaNoFarm.test.js'] }
};
