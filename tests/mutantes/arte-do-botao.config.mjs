// Mutacao somente na memoria do Vitest: nunca altera o cliente servido pelo Vite.
//
// A ARTE DOS BOTOES "CACAR" E "RETORNAR" (D-2454, 14/10/2026, relato J20): cada mutante e um jeito de o botao voltar
// a ficar invisivel calado (a falha sem reserva, a reserva que nao sai, a reserva que nao nasce), de a arte nao voltar
// sem F5 (sem nova tentativa, a mesma URL que falhou, a troca que nao cancela), de a evidencia nao chegar (sem relato)
// ou chegar demais (relato a cada tentativa), e de a costura no `HuntButtonIdle` se perder (o idioma, o preparo, a
// troca de mapa que pede de novo). Mais a VIGIA DO CATALOGO CHEIO do `HuntMap.js` (a mesma D-2454: o filtro que nao acha
// nada porque o catalogo nao veio): sem vigia, prazo errado, vigia que nao desarma ou que desarma na primeira parte.
//
//   RAG_MUTANTE_ARTE=<nome> npx vitest run --config tests/mutantes/arte-do-botao.config.mjs
//
// Todos de uma vez (bash), contando o mutante que NAO casa como invalido:
//   for m in semReserva reservaNaoSai semNovaTentativa mesmaUrlNaTentativa esperaFixa relataSempre semRelato
//            mesmaArteRepede trocaNaoCancela tentativaNaoZera erroSemUrlAgenda naoNasceNaReserva semArteNoPreparo
//            semArteNaTroca idiomaFixo semVigia vigiaNaoDesarmaNoCatalogo vigiaNaoDesarmaNaTroca
//            vigiaDesarmaNaPrimeiraParte prazoErrado; do (numa linha so)
//     RAG_MUTANTE_ARTE=$m npx vitest run --config tests/mutantes/arte-do-botao.config.mjs > m.log 2>&1;
//     if grep -q "nao casa" m.log; then echo "$m INVALIDO"; elif grep -q "Tests .*failed" m.log; then echo "$m morto"; else echo "$m SOBREVIVEU"; fi; done
//
// O CSS e lido do DISCO pelo teste (sem leiaute no jsdom): os mutantes dele foram medidos no disco com restauro por
// copia (ver D-2454).
import base from '../../vite.config.js';

const ARTE = 'src/UI/Components/HuntButtonIdle/arteDoBotao.js';
const BOTAO = 'src/UI/Components/HuntButtonIdle/HuntButtonIdle.js';
const HTML = 'src/UI/Components/HuntButtonIdle/HuntButtonIdle.html';
const MAPA = 'src/UI/Components/HuntMap/HuntMap.js';

/** Tabulacao e quebra de linha do alvo (o alvo chega com LF: o transform tira o CR). */
const T = String.fromCharCode(9);
const N = String.fromCharCode(10);

const mutantes = {
	// a falha nao poe o botao na reserva: ele fica invisivel, como antes
	semReserva: [ARTE, `${T}${T}botao.classList.add(CLASSE_SEM_ARTE);${N}`, ''],
	// a arte que chega nao tira a reserva
	reservaNaoSai: [ARTE, `${T}${T}botao.classList.remove(CLASSE_SEM_ARTE);${N}`, ''],
	// a falha nao agenda a nova tentativa: so o F5 traz a arte
	semNovaTentativa: [ARTE, `${T}${T}relogio = agendar(pedir, espera);${N}`, ''],
	// a nova tentativa pede a MESMA URL que falhou
	mesmaUrlNaTentativa: [ARTE, 'img.src = tentativa === 0 ? url : `${url}?tentativa=${tentativa}`;', 'img.src = url;'],
	// a espera nao cresce
	esperaFixa: [ARTE, 'Math.min(tentativa, ESPERAS_DA_NOVA_TENTATIVA_MS.length - 1)', '0'],
	// relata a cada tentativa (o teto de 10 relatos da sessao se esgota com isto)
	relataSempre: [ARTE, `${T}${T}if (!relatou && relatar) {`, `${T}${T}if (relatar) {`],
	// a falha nao chega a ninguem
	semRelato: [ARTE, `${T}${T}${T}relatar(\`[hud] a arte do botao \${nome} nao carregou: \${url}\`);${N}`, ''],
	// a mesma arte pedida de novo a cada troca de mapa
	mesmaArteRepede: [ARTE, `${T}${T}${T}if (nova === url) {${N}${T}${T}${T}${T}return;${N}${T}${T}${T}}${N}`, ''],
	// trocar a arte (o idioma) deixa a tentativa da antiga pendurada
	trocaNaoCancela: [
		ARTE,
		`${T}${T}${T}tentativa = 0;${N}${T}${T}${T}cancelar();${N}${T}${T}${T}pedir();`,
		`${T}${T}${T}tentativa = 0;${N}${T}${T}${T}pedir();`
	],
	// a contagem de tentativas da arte antiga vale para a nova
	tentativaNaoZera: [ARTE, `${T}${T}${T}url = nova;${N}${T}${T}${T}tentativa = 0;${N}`, `${T}${T}${T}url = nova;${N}`],
	// um erro antes de haver arte agenda tentativa de `null`
	erroSemUrlAgenda: [ARTE, `${T}${T}if (url === null) {${N}${T}${T}${T}return;${N}${T}${T}}${N}`, ''],
	// o botao nao nasce na reserva: ate a arte chegar ele e invisivel
	naoNasceNaReserva: [HTML, 'hb-btn hb-cacar ri-btn hb-sem-arte', 'hb-btn hb-cacar ri-btn'],
	// o preparo nao pede a arte
	semArteNoPreparo: [BOTAO, `${T}${T}})${N}${T}};${N}${T}usarArteDosBotoes();${N}};`, `${T}${T}})${N}${T}};${N}};`],
	// a troca de mapa nao confere o idioma da arte
	semArteNaTroca: [
		BOTAO,
		`${T}raiz.classList.toggle('hb-en', emIngles());${N}${T}}${N}${T}usarArteDosBotoes();`,
		`${T}raiz.classList.toggle('hb-en', emIngles());${N}${T}}`
	],
	// o idioma nao escolhe a arte (o ingles fica com o texto em portugues pintado)
	idiomaFixo: [BOTAO, "const idioma = emIngles() ? 'en' : 'pt';", "const idioma = 'pt';"],
	// o pedido cheio nao arma a vigia: o catalogo que nao vem fica calado
	semVigia: [
		MAPA,
		`${T}desarmarVigiaDoCheio();${N}${T}_vigiaDoCheio = setTimeout(() => {`,
		`${T}desarmarVigiaDoCheio();${N}${T}if (false) setTimeout(() => {`
	],
	// o catalogo que chega nao desarma: relato falso
	vigiaNaoDesarmaNoCatalogo: [
		MAPA,
		`${T}// D-2454: chegou um catalogo inteiro; a vigia do cheio nao tem mais o que vigiar.${N}${T}desarmarVigiaDoCheio();${N}`,
		''
	],
	// a troca de personagem deixa a vigia do anterior armada
	vigiaNaoDesarmaNaTroca: [
		MAPA,
		`${T}${T}_prazoDoLeve = null;${N}${T}}${N}${T}desarmarVigiaDoCheio();${N}`,
		`${T}${T}_prazoDoLeve = null;${N}${T}}${N}`
	],
	// a primeira parte desarma: a lista que nunca fecha fica calada
	vigiaDesarmaNaPrimeiraParte: [
		MAPA,
		`${T}const viagemPendente = _pendingAutoTravel;${N}`,
		`${T}desarmarVigiaDoCheio();${N}${T}const viagemPendente = _pendingAutoTravel;${N}`
	],
	// o prazo nao e o declarado
	prazoErrado: [MAPA, 'const PRAZO_DO_CATALOGO_CHEIO_MS = 15000;', 'const PRAZO_DO_CATALOGO_CHEIO_MS = 30000;']
};
const mutante = mutantes[process.env.RAG_MUTANTE_ARTE];
if (!mutante) throw new Error(`Escolha RAG_MUTANTE_ARTE: ${Object.keys(mutantes).join(', ')}.`);
const [ALVO, de, para] = mutante;

export default {
	...base,
	plugins: [
		{
			name: 'arte-do-botao-somente-em-memoria',
			enforce: 'pre',
			transform(codigo, id) {
				if (!id.replaceAll(String.fromCharCode(92), '/').split('?')[0].endsWith(ALVO)) return null;
				const texto = codigo.replace(/\r\n/g, N);
				if (texto.split(de).length !== 2) throw new Error('Mutante nao casa exatamente uma vez.');
				return texto.replace(de, para);
			}
		}
	],
	test: { ...base.test, include: ['tests/ui/arteDoBotaoDaHud.test.js', 'tests/ui/catalogoLeveNoHuntMap.test.js'] }
};
