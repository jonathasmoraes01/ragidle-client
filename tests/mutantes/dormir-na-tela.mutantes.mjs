// A tabela de mutantes do DORMIR NA TELA (J21, 14/10/2026, D-2477 e D-2478), lida pelo config (a porta do
// `transform`) e pelo setup (a porta do `readFileSync`). Cada entrada: [arquivo, texto original (casa UMA vez),
// texto mutado].
//
// Rodada 2 da frente (o critico reprovou a 1): o corpo da lista que ia ao mundo (B1, `semOSonoDaLista` e as tres
// costuras), o verde ilegivel da ficha (B2) e o sono completo que a tela chamava de "ganhando" (N1). Rodada 3: a
// linha do resumo que deixava "classe" sozinha no celular em pe (N4, `semQuebraDentroDasMetades`).

const NUMEROS = 'src/UI/numerosDoSono.js';
const UI = 'src/UI/UIManager.js';
const SELECAO = 'src/UI/Components/CharSelect/sonoNaSelecao.js';
// Lidos do DISCO pelos testes (o Vite nao os carrega): a porta e o `setupFiles`.
const MOTOR_DA_SELECAO = 'src/Engine/CharEngine.js';
const COMPONENTE = 'src/UI/Components/CharSelect/CharSelectCommon.js';
const CSS_DA_SELECAO = 'src/UI/Components/CharSelect/CharSelectV4/CharSelectV4.css';

export const MUTANTES_DO_DORMIR = {
	// a taxa zero passa a "render": o aviso some e a tela diz "ganhando" com zero
	rendendoComZero: [NUMEROS, '\t\trendendo: base > 0', '\t\trendendo: base >= 0'],
	// o ganho ate agora arredonda para cima (inventa EXP que o acerto nao paga)
	ateAgoraArredonda: [NUMEROS, 'ateAgora: { base: Math.floor(base * dormido)', 'ateAgora: { base: Math.round(base * dormido)'],
	// o ritmo sai por minuto, e nao por hora
	ritmoPorMinuto: [NUMEROS, 'const UMA_HORA_MS = 3600 * 1000;', 'const UMA_HORA_MS = 60 * 1000;'],
	// o que falta usa o tempo ja dormido
	pelaFrenteComODormido: [NUMEROS, 'pelaFrente: { base: Math.floor(base * restante)', 'pelaFrente: { base: Math.floor(base * dormido)'],
	// a tela diz "ganhando" mesmo com a taxa zero
	avisoSempreGanhando: [UI, '\t\tif (inicial.rendendo) {', '\t\tif (true) {'],
	// o relogio da tela desce o restante sem somar no dormido: o ganho ate agora congela
	relogioNaoAndaODormido: [UI, '\t\t\tdormido += Math.min(1000, restante);\n', ''],
	// o "Voltar" chama a volta a cada toque
	voltarSemGuarda: [UI, '\t\t\t\t\t\t\tif (pedindo) {\n\t\t\t\t\t\t\t\treturn;\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {', '\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {'],
	// o "Voltar" nao trava o "Acordar": um toque depois acorda o personagem que so ia a selecao
	voltarNaoTrava: [UI, '\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpedindo = true;\n\t\t\t\t\t\t\tif (timer) {', '\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tif (timer) {'],
	// a volta pedida por quem chama nao vira botao
	semBotaoDeVoltar: [UI, '\t\t\t...(onVoltarASelecao\n', '\t\t\t...(false\n'],
	// o casco nunca desenha o segundo botao
	secundarioNunca: [UI, '\tif (textoDoBotaoSecundario) {', '\tif (false) {'],
	// qualquer estado de corpo (a pedra, o congelamento) vira "dormindo" na selecao
	pedraESono: [SELECAO, 'personagem.bodyState === StatusConst.BodyState.SLEEP', 'personagem.bodyState > 0'],
	// entrar com o proprio dorminhoco pergunta se encerra o sono dele
	dorminhocoEncerraASi: [SELECAO, 'p && p.GID !== escolhido.GID && estaDormindoNaLista(p)', 'p && estaDormindoNaLista(p)'],
	// a pergunta troca quem dorme por quem entra
	perguntaTrocaNomes: [SELECAO, '`${nomes} está dormindo. Entrar com ${quemEntra.name}', '`${quemEntra.name} está dormindo. Entrar com ${nomes}'],

	// B1: o corpo vai ao mundo com o sinal da lista (o "zZz" no jogador)
	corpoComOSono: [SELECAO, '\treturn { ...personagem, bodyState: 0 };', '\treturn { ...personagem };'],
	// B1: o corte devolve o PROPRIO objeto da lista (a entidade e a lista passam a ser um so)
	corpoEALista: [SELECAO, '\treturn { ...personagem, bodyState: 0 };', '\treturn personagem;'],
	// B1: o corte zera a LISTA (o jogador nasce acordado, mas o icone e a pergunta somem)
	corpoApagaALista: [SELECAO, '\treturn { ...personagem, bodyState: 0 };', '\tpersonagem.bodyState = 0;\n\treturn personagem;'],
	// B1: o `Player` da entrada volta a nascer do objeto cru da lista
	playerCru: [MOTOR_DA_SELECAO, 'Session.Entity = new Player(semOSonoDaLista(entity));', 'Session.Entity = new Player(entity);'],
	// B1: o boneco da grade (V4) nasce do objeto cru
	gradeCrua: [COMPONENTE, '\n\t\t\t_entitySlots[character.CharNum].set(semOSonoDaLista(character));', '\n\t\t\t_entitySlots[character.CharNum].set(character);'],
	// B1: o boneco da lista antiga (fora da grade) nasce do objeto cru
	listaCrua: [COMPONENTE, '\n\t\t_entitySlots[character.CharNum].set(semOSonoDaLista(character));', '\n\t\t_entitySlots[character.CharNum].set(character);'],
	// B2: a linha da ficha volta ao verde da tela preta (1,53:1 no cartao claro)
	verdeDaTelaPreta: [CSS_DA_SELECAO, '\tcolor: var(--ri-verde);', '\tcolor: #8fe388;'],
	// N1: o sono nunca fica completo (a faixa diz "ganhando" com o relogio em zero)
	completoNunca: [NUMEROS, '\t\tcompleto: restante <= 0', '\t\tcompleto: false'],
	// N1: o sono fica completo um segundo antes do teto
	completoAntes: [NUMEROS, '\t\tcompleto: restante <= 0', '\t\tcompleto: restante <= 1000'],
	// N1: a faixa do sono completo continua dizendo "ganhando"
	completoSemFaixa: [UI, "\t\t\t\ttela.aviso.textContent = 'Sono completo: acorde para receber a EXP';\n", ''],
	// N1: o sono completo mantem o ritmo de um sono parado
	completoComRitmo: [UI, '\t\t\t\tlinhaRitmo.remove();\n', ''],
	// N1: o sono completo mantem o "pela frente"
	completoComPelaFrente: [UI, '\t\t\t\tlinhaPelaFrente.remove();\n', ''],
	// N1: o sono a taxa zero que acaba vira "Sono completo" com ganho zero
	completoATaxaZero: [UI, '\t\t\tif (n.completo && n.rendendo) {', '\t\t\tif (n.completo) {'],

	// N4 (rodada 3): o espaco de dentro da metade volta a quebrar ("classe" sozinha embaixo no celular em pe)
	metadeQuebra: [NUMEROS, '.replace(METADE, metade => metade.replace(/ /g, SEM_QUEBRA))', '.replace(METADE, metade => metade)'],
	// N4: o "·" fica solto e pode abrir a segunda linha
	pontoSolto: [NUMEROS, '\t\t.replace(/ ·/g, `${SEM_QUEBRA}·`);', "\t\t.replace(/ ·/g, ' ·');"],
	// N4: o espaco "sem quebra" e o espaco comum
	espacoQueQuebra: [NUMEROS, "const SEM_QUEBRA = '\\u00a0';", "const SEM_QUEBRA = ' ';"],
	// N4: o "pela frente" se solta da metade
	pelaFrenteSolta: [NUMEROS, '(?: pela frente)?/g;', '/g;'],
	// N4: o numero com separador de milhar nao entra na metade
	numeroCortado: [NUMEROS, '/~[^ ·]+ EXP', '/~\\d+ EXP'],
	// N4: a tela escreve cada linha crua (as quatro costuras)
	ateAgoraCru: [UI, 'linhaAteAgora.textContent = semQuebraDentroDasMetades(`Ganho até agora:', 'linhaAteAgora.textContent = (`Ganho até agora:'],
	ritmoCru: [UI, 'linhaRitmo.textContent = semQuebraDentroDasMetades(', 'linhaRitmo.textContent = ('],
	pelaFrenteCru: [UI, 'linhaPelaFrente.textContent = semQuebraDentroDasMetades(', 'linhaPelaFrente.textContent = ('],
	sonoCompletoCru: [UI, 'linhaAteAgora.textContent = semQuebraDentroDasMetades(`Ganho do sono:', 'linhaAteAgora.textContent = (`Ganho do sono:']
};
