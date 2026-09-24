/**
 * UI/Components/TutorialIdle/etapasDoTutorial.js
 *
 * A REGRA PURA DO TUTORIAL GUIADO: a tabela das doze etapas e a geometria da
 * camada (recorte, mascara, mao, balao). Zero DOM, zero import.
 *
 * Ele mora fora do componente pelo mesmo motivo que `secoesDaConfig.js` mora
 * fora do IdleConfig e `podeIniciarMissao.js` fora do MissoesIdle: e a parte
 * que da para medir sem navegador. O componente le o `getBoundingClientRect`
 * e passa numeros para ca; aqui nao se sabe o que e uma janela.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE QUATRO RETANGULOS, E NAO `clip-path`
 * ═══════════════════════════════════════════════════════════════════════
 * A mascara tem DUAS tarefas: escurecer o que nao interessa e DESLIGAR o
 * caminho errado (a regra 6 da gravacao do AFK Arena, `docs/referencia-
 * tutorial/REFERENCIA.md`: *"o tutorial nao pede licenca: ele fecha as
 * outras portas"*).
 *
 *   1. `clip-path` recorta a PINTURA, nao o TESTE DE PONTEIRO. Um elemento
 *      de tela cheia com um furo desenhado continua recebendo o clique em
 *      cima do alvo. Para o clique passar seria preciso `pointer-events:
 *      none` na mascara inteira, e ai ela para de fechar as outras portas
 *      tambem: as duas tarefas se anulam.
 *   2. Com quatro retangulos o furo e ESPACO VAZIO. Nao ha nada meu sobre o
 *      alvo, entao o clique de verdade chega nele sem nenhum malabarismo de
 *      `pointer-events`. Essa e a diferenca que a sonda de tela do alfa
 *      cobrou caro: `el.click()` funciona com o botao COBERTO, e o dedo do
 *      jogador nao.
 *   3. `polygon()` nao expoe `fill-rule` de forma confiavel entre motores,
 *      entao um furo de verdade sairia como uma fenda ate a borda, com
 *      costura visivel.
 *   4. Quatro retangulos se atualizam com `top/left/width/height` nos MESMOS
 *      numeros que o `getBoundingClientRect` devolveu. Nao ha nada a
 *      converter quando o alvo se mexe.
 *
 * O canto arredondado que o `clip-path` daria de graca vem do anel de realce,
 * que e desenhado exatamente sobre a boca do furo com `border-radius`.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O VERBO MUDA COM O PONTEIRO
 * ═══════════════════════════════════════════════════════════════════════
 * A gravacao diz *Tap "Begin"*. "Toque" esta errado num computador e
 * "Clique" esta errado num celular, e este jogo roda nos dois. Entao a frase
 * guarda o marcador `{acao}` e quem desenha troca por "Toque em" ou "Clique
 * em". O rotulo do controle continua entre aspas, que e a regra 4 da
 * gravacao.
 */

/** Quantas etapas o tutorial tem. O servidor manda `total` no retrato; este
 *  numero e o que o cliente desenha quando o retrato ainda nao chegou. */
export const TOTAL_DE_ETAPAS = 12;

/**
 * Quem guia. E a Kafra da praca de Prontera, com o nome que o jogador ja le
 * em cima da cabeca dela no jogo (`servidor/index.ts:720`,
 * `nomeExibidoDeNpcEmPortugues('Kafra Employee#praca')`). Um guia inventado
 * seria um personagem a mais para o jogador conhecer; esta ele ja cumprimentou
 * ao nascer, porque e ela quem assina o kit inicial
 * (`servidor/kit-inicial.ts:157`).
 */
export const QUEM_GUIA = 'Funcionária Kafra';

/**
 * AS DOZE ETAPAS (secao 7 do CONTRATO-JORNADA.md, mais o Correio e as
 * poções - achados faltando/fora de ordem em 15/09/2026 - e a economia de
 * energia, somada ao fim em 24/09/2026).
 *
 * Campos de cada uma:
 *   numero      1..12, o que o servidor guarda em `etapa`.
 *   rotulo      o texto do controle, EXATAMENTE como ele aparece na tela.
 *               E o que vai entre aspas na frase.
 *   frase       imperativo, uma acao so, com `{acao}` onde entra o verbo do
 *               ponteiro e `{rotulo}` onde entra o nome do controle.
 *   alvo        { host, seletor } do controle a destacar, ou `null` quando a
 *               etapa nao tem controle nenhum (a etapa 9 e de OLHAR).
 *   quandoSumir { host, seletor, frase } o caminho de volta, quando o alvo
 *               nao tem caixa (janela fechada, leque recolhido). E o que a
 *               secao 6 do contrato manda: explicar como voltar, em vez de
 *               apontar para o vazio.
 *   avancaPor   nome da condicao REAL que fecha a etapa. Quem a mede e o
 *               componente; aqui fica so o nome, para o relatorio e para o
 *               teste conseguirem falar dela.
 *
 * Nao existe campo de "botao Proximo", e isso e deliberado: a regra 6 da
 * gravacao proibe um botao que substitua a acao.
 *
 * A ORDEM MUDOU em 15/09/2026 (pedido do dono, jogando ao vivo): equipar o
 * kit e configurar as poções agora acontecem TODOS antes de "Iniciar a
 * missão", e nao depois - quem aceita a missao e viaja com a mochila cheia
 * de pocao mas nenhuma ligada para beber sozinho fica preso abrindo a
 * mochila na mao a cada combate. O personagem se prepara POR INTEIRO
 * (Correio, arma, pocoes) e so entao aceita a primeira tarefa.
 */
export const ETAPAS = Object.freeze([
	Object.freeze({
		numero: 1,
		rotulo: 'Menu',
		frase: '{acao} {rotulo}. É daqui que sai toda aventura.',
		alvo: Object.freeze({ host: 'TopMenuIdle', seletor: '.tm-fab' }),
		quandoSumir: null,
		avancaPor: 'leque-aberto'
	}),
	/*
	 * RENUMERADO (16/09/2026, pedido do dono): a janela `MissoesIdle`
	 * independente saiu do leque — o único caminho até as missões agora é a
	 * aba "Missões Gerais" dentro de "Codex & Missões" (ver o cabeçalho de
	 * `missoesGeraisHtml.js`).
	 *
	 * TRES ALCANCES, NAO DOIS (achado ao JOGAR, 16/09/2026, em duas
	 * rodadas). Primeiro apontei so para a aba (com volta no `.tm-item`
	 * do leque) e a etapa ficou SEM MAO, porque `TopMenuIdle.js` fecha o
	 * leque assim que um item dele e clicado ("abriu, escolheu, fechou")
	 * - e a etapa 1 termina bem ali, com o leque JA fechado. Troquei a
	 * volta para o `.tm-fab` (sempre com caixa) e a etapa passou a
	 * ignorar o leque ABERTO: com o `.tm-fab` sozinho como volta, a mao
	 * fica presa nele mesmo depois do jogador reabrir o leque, porque o
	 * `.tm-fab` continua tendo caixa valida e nunca cede a vez ao icone
	 * de dentro. As DUAS versões erravam por olhar so um dos dois estados
	 * do leque. `alvos` cobre os TRES de verdade, na ordem:
	 * a aba (Codex aberto), o icone do leque (leque aberto, Codex
	 * fechado), o `.tm-fab` (leque fechado).
	 */
	Object.freeze({
		numero: 2,
		rotulo: 'Missões Gerais',
		frase: '{acao} a aba "{rotulo}". Separei a sua primeira tarefa lá.',
		alvos: Object.freeze([
			Object.freeze({ host: 'CodexIdle', seletor: '.cx-tab[data-aba="missoes"]' }),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-item[data-action="codex"]',
				frase: '{acao} "Codex & Missões". Separei a sua primeira tarefa lá.'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-fab',
				frase: 'Abra o "Menu" e toque em "Codex & Missões". Separei a sua primeira tarefa lá.'
			})
		]),
		avancaPor: 'aba-de-missoes-gerais-ativa'
	}),
	/*
	 * AS DUAS ETAPAS DO CORREIO (15/09/2026), achadas faltando na auditoria: um
	 * personagem novo nasce com a MOCHILA VAZIA - a arma, as pocoes e o zeny
	 * do kit inicial chegam pela carta de boas-vindas (D-534,
	 * `servidor/index.ts`), nao equipados de fabrica. Sem uma etapa de
	 * Correio, o tutorial mandava o novato vestir uma arma que ele ainda nao
	 * tinha: o slot `.mo-slot[data-location="2"]` da etapa seguinte existe,
	 * mas esta vazio, e nao ha o que clicar.
	 *
	 * **SAO DUAS, E NAO UMA** - achado ao JOGAR a versao com uma so: abrir o
	 * Correio e retirar o kit de dentro dela sao dois gestos em dois lugares
	 * da tela (o botao do menu, depois a janela que abre longe dele), e a
	 * mascara (ver o cabecalho deste arquivo, "POR QUE QUATRO RETANGULOS")
	 * so ilumina UM alvo por etapa - o mesmo motivo por que "abrir Missoes"
	 * e "Iniciar a missao" ja eram etapas separadas. Uma etapa so com alvo
	 * no botao do menu bloquearia o clique DENTRO da janela do Correio que
	 * esse botao abre: a mascara escurece e desliga tudo fora do furo, por
	 * desenho.
	 */
	Object.freeze({
		numero: 3,
		rotulo: 'Correio',
		frase: '{acao} {rotulo}. O seu kit inicial chegou lá dentro.',
		alvo: Object.freeze({ host: 'TopMenuIdle', seletor: '.tm-item[data-action="correio"]' }),
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-fab',
			frase: 'Abra o "Menu" de novo. O "Correio" mora lá dentro.'
		}),
		avancaPor: 'correio-aberto'
	}),
	Object.freeze({
		numero: 4,
		rotulo: null,
		/* A janela inteira fica livre (sem furo estreito): o jogador precisa
		   selecionar a carta na LISTA (esquerda) e depois clicar em "retirar"
		   no PAINEL de detalhe (direita) - dois lugares dentro da mesma
		   janela, que um furo em volta de um botao so nao cobriria. */
		frase: 'Abra a carta e retire TUDO dela: o zeny e os itens. Ele é seu, pode usar sem dó.',
		alvo: Object.freeze({ host: 'CorreioIdle', seletor: '.co-window' }),
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-item[data-action="correio"]',
			frase: 'A janela do "Correio" fechou. Abra-a de novo para retirar o kit.'
		}),
		/*
		 * A MAO segue o GESTO, e nao mais so o canto do furo (16/09/2026,
		 * relato do dono: "o dedinho deve ficar apontando para abrir a
		 * mensagem antes de clicar para coletar"). O FURO continua a janela
		 * inteira - os dois gestos precisam do clique livre em dois lugares
		 * dela - mas a mao agora mira o candidato certo NA ORDEM do gesto:
		 * primeiro a carta ainda fechada na lista, depois (ela some da lista
		 * ao abrir - `.is-selecionada` tira o seletor do ar) o botao que
		 * coleta tudo dela. Se nenhum candidato tiver caixa (a janela ainda
		 * nao montou a lista), a mao volta ao canto do furo inteiro - o
		 * comportamento de sempre, nunca um estado sem mao (ver o uso em
		 * TutorialIdle.js).
		 */
		maoEm: Object.freeze([
			Object.freeze({ host: 'CorreioIdle', seletor: '.co-item:not(.is-selecionada)' }),
			Object.freeze({ host: 'CorreioIdle', seletor: '.co-coletar-todos' })
		]),
		avancaPor: 'kit-retirado'
	}),
	Object.freeze({
		numero: 5,
		rotulo: 'Arma',
		frase: 'Ponha a sua arma no slot {rotulo}. Ninguém sai de Midgard de mãos vazias.',
		/*
		 * O ALVO E A JANELA INTEIRA (`.mo-window`), NAO SO O SLOT (achado ao
		 * JOGAR esta etapa, 15/09/2026) - o mesmo defeito de fundo da dupla do
		 * Correio, um passo adiante. A faca chega no kit dentro da aba
		 * "Equipar", e a mochila abre na aba "Consumíveis" (as poções do
		 * mesmo kit). Um furo so em volta do slot `.mo-slot[data-location="2"]`
		 * bloquearia o clique na PROPRIA aba "Equipar" - o jogador nao
		 * conseguiria nem trocar de aba para achar a arma, muito menos
		 * arrasta-la ate o slot. `data-location="2"` e `EquipLocation.WEAPON`
		 * (`1 << 1`, `src/DB/Items/EquipmentLocation.js:13`), o mesmo bitmask
		 * que MochilaIdle carimba em cada ladrilho (MochilaIdle.js:775) - fica
		 * so na frase agora, ja que o furo nao aponta mais so pra ele.
		 */
		alvo: Object.freeze({ host: 'MochilaIdle', seletor: '.mo-window' }),
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-item[data-action="inventory"]',
			frase: 'Abra a "Mochila" para eu te mostrar onde a arma se veste.'
		}),
		avancaPor: 'arma-vestida-confirmada'
	}),
	/*
	 * A ETAPA DAS POCOES (15/09/2026) - pedido do dono, jogando ao vivo:
	 * ensinar a configurar o auto-uso de pocao no menu Idle, ANTES de aceitar
	 * a missao. Quem parte para a caca com a mochila cheia de pocao mas
	 * nenhuma ligada fica dependendo de abrir a mochila na mao a cada golpe.
	 * O alvo e a JANELA INTEIRA (`.ic-window`), pela mesma familia de defeito
	 * das etapas do Correio e da arma: o jogador precisa trocar para a aba
	 * "Sobrevivência" e so entao mexer nos dois cartoes de poção, dois gestos
	 * em lugares diferentes da mesma janela.
	 */
	Object.freeze({
		numero: 6,
		rotulo: null,
		frase: 'Na aba "Sobrevivência", ligue as duas poções e arraste a barra até 50%.',
		alvo: Object.freeze({ host: 'IdleConfig', seletor: '.ic-window' }),
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-item[data-action="config"]',
			frase: 'Abra o "Menu" e toque em "Configurações" para ligar as poções.'
		}),
		/*
		 * A MAO segue os TRES gestos em ordem (16/09/2026, relato do dono:
		 * "a mãozinha deve ficar em cima do botão de ativar e depois em cima
		 * da barrinha") - mesma receita da etapa 4. O FURO continua a janela
		 * inteira (o jogador ainda precisa trocar para a aba "Sobrevivência"
		 * primeiro, fora do alcance de qualquer sub-alvo aqui), mas a mao
		 * mira o interruptor de HP, depois o de SP, e so entao a barra de
		 * HP - a frase fala de "a barra" no singular, e as duas so avancam
		 * a etapa pelos INTERRUPTORES (`avancaPor`), nunca pelo numero da
		 * barra (ver `servidor/tutorial.ts`: so `ligado` e cobrado). Os
		 * `input[type=checkbox]` do interruptor ficam com `opacity:0` sobre
		 * a trilha visivel (`#IdleConfig .ic-switch input`,
		 * IdleConfig.css) - a caixa que `getBoundingClientRect` mede e a da
		 * trilha, nao um elemento invisivel de verdade. `data-bool`/
		 * `data-range` (e nao `.ic-slider--hp`, que tambem nomeia as
		 * barras do Descanso) sao os UNICOS seletores desta janela para
		 * cada campo - `renderPocao` os escreve uma vez cada.
		 */
		maoEm: Object.freeze([
			Object.freeze({ host: 'IdleConfig', seletor: 'input[data-bool="pocaoDeHp.ligado"]:not(:checked)' }),
			Object.freeze({ host: 'IdleConfig', seletor: 'input[data-bool="pocaoDeSp.ligado"]:not(:checked)' }),
			Object.freeze({ host: 'IdleConfig', seletor: 'input[data-range="pocaoDeHp.usarCom"]' })
		]),
		avancaPor: 'pocoes-configuradas'
	}),
	/*
	 * RENUMERADO (16/09/2026, pedido do dono): o botão "Iniciar" agora mora
	 * na TELA DE DETALHE da aba "Missões Gerais" (`missoesGeraisHtml.js`,
	 * `telaDaMissaoHtml`) — o jogador PRECISA abrir "Primeiros Passos" na
	 * lista antes de ver o botão, o mesmo par de gestos que a dupla do
	 * Correio já ensina (abrir, depois agir DENTRO).
	 *
	 * DUAS TELAS, NUNCA AO MESMO TEMPO (achado ao JOGAR, 16/09/2026: "a
	 * etapa 7 ficou sem mão"). `missoesGeraisHtml()` desenha OU a lista OU
	 * o detalhe — nunca os dois — então o candidato de topo é um seletor
	 * COM VÍRGULA: o botão "Iniciar" quando o detalhe está na tela, a
	 * LINHA da missão quando é a lista. `querySelector` só acha o que
	 * existe agora, então nunca há ambiguidade.
	 *
	 * TRES ALCANCES, NAO DOIS (mesmo achado da etapa 2, ver o cabeçalho
	 * dela): a janela do Codex pode estar ABERTA (candidato de topo), o
	 * LEQUE pode estar aberto com o Codex fechado (o ícone "Codex &
	 * Missões" dentro dele), ou o leque pode estar fechado (`.tm-fab`,
	 * sempre com caixa). Um `quandoSumir` só cobria DOIS desses tres.
	 */
	Object.freeze({
		numero: 7,
		rotulo: 'Iniciar',
		frase: '{acao} {rotulo} para começar "Primeiros Passos". Eu anoto o resto.',
		alvos: Object.freeze([
			Object.freeze({
				host: 'CodexIdle',
				seletor: '.cx-mg-rodape [data-mg-executar="iniciar"], [data-mg-missao="primeiros-passos"]'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-item[data-action="codex"]',
				frase: '{acao} "Codex & Missões" de novo. "Primeiros Passos" te espera na aba "Missões Gerais".'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-fab',
				frase: 'Abra o "Menu" e toque em "Codex & Missões". "Primeiros Passos" te espera na aba "Missões Gerais".'
			})
		]),
		avancaPor: 'missao-ativa-no-servidor'
	}),
	Object.freeze({
		numero: 8,
		rotulo: null,
		frase: 'Escolha um mapa e viaje. Qualquer um serve para começar.',
		/*
		 * O ALVO E A JANELA DO MAPA (`.hm-window`), NAO O BOTAO `.hb-cacar`
		 * (achado ao JOGAR esta etapa, 15/09/2026) - a mesma familia de
		 * defeito da dupla do Correio e da etapa da arma, um passo adiante.
		 * `.hb-cacar` so viaja DIRETO quando ja existe um mapa lembrado; para
		 * quem nunca cacou (todo mundo que ve este tutorial, por definicao)
		 * ele abre o SELETOR de mapa (`HuntMap`) em vez de viajar - e "Viajar
		 * para Campo de Prontera" mora DENTRO dessa janela, fora do furo
		 * antigo. `quandoSumir` cobre o instante ANTES de abrir: a janela
		 * ainda nao existe, entao o furo volta para o botao que a abre.
		 */
		alvo: Object.freeze({ host: 'HuntMap', seletor: '.hm-window' }),
		quandoSumir: Object.freeze({
			host: 'HuntButtonIdle',
			seletor: '.hb-cacar',
			frase: 'Clique em "Caçar". Eu te levo até o campo.'
		}),
		avancaPor: 'mapa-mudou'
	}),
	Object.freeze({
		numero: 9,
		rotulo: null,
		frase: 'Pronto: agora você luta sozinho. Olhe a vida do monstro descer.',
		/*
		 * A UNICA ETAPA SEM RECORTE, e a razao e honesta: a barra de vida do
		 * monstro e DESENHADA NO CANVAS (`Renderer/Entity/EntityLife.js`), nao
		 * e um elemento com caixa. Furar a mascara em cima dela exigiria
		 * seguir a entidade quadro a quadro, e um furo no lugar errado e pior
		 * do que nenhum furo. Aqui a mascara sai inteira: a etapa e de OLHAR,
		 * nao ha caminho errado a fechar, e escurecer a luta seria esconder
		 * exatamente o que a frase manda ver.
		 */
		alvo: null,
		quandoSumir: null,
		avancaPor: 'primeiro-abate'
	}),
	Object.freeze({
		numero: 10,
		rotulo: 'Objetivo',
		frase: 'Olhe aqui: este é o seu {rotulo}, e ele anda a cada monstro.',
		alvo: Object.freeze({ host: 'MissoesTrackerIdle', seletor: '.mt-ativa' }),
		quandoSumir: null,
		avancaPor: 'contador-andou'
	}),
	/*
	 * RENUMERADO (16/09/2026, pedido do dono): esta etapa NAO pode mais
	 * olhar so "a janela do Codex esta aberta" - a etapa 2 ja abriu essa
	 * janela ha nove passos, e ela nunca fecha sozinha (o mesmo motivo que
	 * fez a dupla do Correio existir). Com o alvo antigo, o alcance desta
	 * etapa seria IMEDIATO e mudo assim que ela comecasse - a janela ja
	 * esta aberta desde a 2, so que na aba "Missões Gerais".
	 *
	 * TRES ALCANCES, NAO DOIS (mesmo achado da etapa 2, ver o cabeçalho
	 * dela): a aba "Missões do Códex" quando o Codex esta aberto, o
	 * icone "Codex & Missões" quando so o leque esta aberto, e o
	 * `.tm-fab` quando os dois estao fechados. Um `quandoSumir` so
	 * cobria dois desses tres estados.
	 */
	Object.freeze({
		numero: 11,
		rotulo: 'Jornada de Midgard',
		frase: '{acao} a aba "Missões do Códex". A {rotulo} te espera lá dentro.',
		alvos: Object.freeze([
			Object.freeze({ host: 'CodexIdle', seletor: '.cx-tab[data-aba="jornada"]' }),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-item[data-action="codex"]',
				frase: '{acao} "Codex & Missões" de novo. A aba "Missões do Códex" é o último passo.'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-fab',
				frase: 'Abra o "Menu" e toque em "Codex & Missões". A aba "Missões do Códex" é o último passo.'
			})
		]),
		avancaPor: 'aba-da-jornada-ativa'
	}),
	/*
	 * A ECONOMIA DE ENERGIA (24/09/2026, pedido do dono: "quero que ensine
	 * dentro do nosso tutorial a como desativa-lo tambem").
	 *
	 * Ela liga SOZINHA quando a aba fica 14 s em segundo plano
	 * (`MapEngine.js`, `onVisibilidadeMudouParaEconomia`), e a unica porta
	 * para desliga-la e a caixa "Economia de energia" das Configuracoes de
	 * Video (`GraphicsOption.html`, `.economia-automatica`). O caminho ate la
	 * e Menu -> "Configurações" (a janela de sistema, `Escape`) ->
	 * "Configurações de Vídeo" -> a caixa - quatro gestos, e por isso a cadeia
	 * de alcances abaixo tem cinco degraus.
	 *
	 * O TUTORIAL ENSINA, NAO OBRIGA. A etapa fecha quando o jogador MEXE na
	 * caixa ou FECHA a janela de Video depois de ve-la (`passoDaEconomia`,
	 * abaixo). Deixar marcada e resposta valida (poupa bateria), e a frase
	 * diz as duas saidas. Avancar so por "a caixa apareceu" foi descartado:
	 * a camada sumiria no mesmo tique (250 ms) em que a janela abre, e a frase
	 * que explica o que a caixa faz nunca chegaria a ser lida.
	 *
	 * O FURO E A JANELA DE VIDEO INTEIRA, e nao so a caixa - o mesmo arranjo
	 * das etapas 4, 5 e 6: o "X" que fecha a janela (uma das duas saidas) e a
	 * aba "Basic" (onde a caixa mora, se o jogador deixou a janela lembrando
	 * a "Advanced") ficam fora de um furo estreito. A MAO segue `maoEm`: a
	 * caixa quando ela esta na tela, a aba "Basic" quando nao esta.
	 *
	 * O CODEX PODE ESTAR ABERTO NA CHEGADA, e isso e desejado: a etapa 11 fecha
	 * no instante em que a aba da Jornada acende, e fechar a janela ali
	 * tiraria a Jornada da frente de quem acabou de chegar nela. Entao o
	 * terceiro degrau e a propria janela do Codex, inteira (o jogador explora
	 * a Jornada a vontade), pedindo para fecha-la quando terminar - sem isso o
	 * furo iria para o botao "Menu" com o Codex por cima dele no celular.
	 */
	Object.freeze({
		numero: 12,
		rotulo: 'Economia de energia',
		frase: 'Desmarque {rotulo} para caçar em segundo plano, ou feche e poupe bateria.',
		alvos: Object.freeze([
			Object.freeze({ host: 'GraphicsOption', seletor: '.ri-window' }),
			Object.freeze({
				host: 'Escape',
				seletor: '.graphics',
				frase: '{acao} "Configurações de Vídeo". Tem um ajuste de bateria lá.'
			}),
			Object.freeze({
				host: 'CodexIdle',
				seletor: '.cx-window.is-open',
				frase: 'Veja a Jornada à vontade e feche esta janela. Falta um último ajuste.'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-item[data-action="sistema"]',
				frase: '{acao} "Configurações". Falta um último ajuste.'
			}),
			Object.freeze({
				host: 'TopMenuIdle',
				seletor: '.tm-fab',
				frase: 'Abra o "Menu" e toque em "Configurações". Falta um último ajuste.'
			})
		]),
		maoEm: Object.freeze([
			Object.freeze({ host: 'GraphicsOption', seletor: '.economia-automatica' }),
			Object.freeze({ host: 'GraphicsOption', seletor: '.tab-button[data-tab="basic"]' }),
			/* O "X" do Codex, quando o furo e o Codex (o terceiro alcance):
			   sem ele a mao ficava no canto de baixo da janela, apontando o
			   nada (visto na foto da sonda, 24/09/2026). */
			Object.freeze({ host: 'CodexIdle', seletor: '.cx-close' })
		]),
		avancaPor: 'economia-de-energia-vista'
	})
]);

/**
 * A ETAPA 12 FECHOU? A regra da economia de energia, sem DOM.
 *
 * Ela precisa de MEMORIA, e por isso nao cabe num `return` de uma linha como
 * as outras: "o jogador mexeu na caixa" so tem sentido contra o valor que ela
 * tinha quando ele a VIU, e "fechou a janela" so conta depois de ele te-la
 * visto aberta (senao a etapa fecharia sozinha no primeiro tique, com a janela
 * de Video ainda por abrir). Quem chama guarda `visto` entre um tique e outro
 * e devolve o que esta funcao entregar.
 *
 * @param {boolean|null} visto   o valor da caixa na primeira vez que ela
 *        apareceu na tela, ou `null` se ela ainda nao apareceu.
 * @param {{caixaNaTela:boolean, marcada:(boolean|null), janelaAberta:boolean}} leitura
 *        `marcada` e `null` quando a caixa nem existe (janela fechada).
 * @returns {{visto:(boolean|null), cumprida:boolean}}
 */
export function passoDaEconomia(visto, leitura) {
	if (visto === null) {
		/* Ainda nao viu: a primeira aparicao so ANOTA, e nunca fecha. */
		if (leitura.caixaNaTela && typeof leitura.marcada === 'boolean') {
			return { visto: leitura.marcada, cumprida: false };
		}
		return { visto: null, cumprida: false };
	}
	/* Mexeu: vale mesmo com a caixa fora da tela (trocou para "Advanced"
	   logo depois de clicar), porque o que conta e o valor, nao a caixa. */
	if (typeof leitura.marcada === 'boolean' && leitura.marcada !== visto) {
		return { visto, cumprida: true };
	}
	/* Viu e fechou a janela sem mexer: deixou marcada de proposito. */
	return { visto, cumprida: !leitura.janelaAberta };
}

/** A etapa de numero `n`, ou `null`. Fora de 1..12 devolve `null` de proposito:
 *  um retrato de servidor mais novo (mais etapas) nao pode desenhar lixo. */
export function etapaDe(numero) {
	return ETAPAS.find(e => e.numero === numero) || null;
}

/**
 * A frase pronta para a tela.
 *
 * @param {object} etapa      uma entrada de ETAPAS
 * @param {boolean} temDedo   o ponteiro e grosso (celular/tablet)?
 * @param {string} [frase]    troca a frase da etapa (o caminho de volta)
 */
export function fraseDaEtapa(etapa, temDedo, frase) {
	const texto = frase || (etapa && etapa.frase) || '';
	const acao = temDedo ? 'Toque em' : 'Clique em';
	const rotulo = etapa && etapa.rotulo ? `"${etapa.rotulo}"` : '';
	return texto.replace('{acao}', acao).replace('{rotulo}', rotulo).replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* A GEOMETRIA                                                         */
/* ------------------------------------------------------------------ */

/**
 * O SUB-ALVO DA MAO ESTA DENTRO DO FURO? (24/09/2026)
 *
 * `maoEm` era lido como "o primeiro candidato com caixa", e isso bastava
 * enquanto todos moravam na mesma janela do furo (etapas 4 e 6). A etapa 12
 * tem candidatos em DUAS janelas (a de Video e o Codex), e as duas podem estar
 * abertas ao mesmo tempo: sem esta conta a mao apontaria um controle que a
 * mascara escurece e desliga. Vale o CENTRO do sub-alvo, a mesma leitura que
 * o jogador faz: o que ele toca e o meio do controle.
 */
export function dentroDoFuro(sub, furo) {
	if (!sub || !furo) {
		return false;
	}
	const cx = sub.x + sub.w / 2;
	const cy = sub.y + sub.h / 2;
	return cx >= furo.x && cx <= furo.x + furo.w && cy >= furo.y && cy <= furo.y + furo.h;
}
/*
 * TUDO AQUI ESTA EM PIXEL DE VIEWPORT, e essa e a escolha da armadilha 1 do
 * contrato (o `zoom` de `escalaDaHud.js:172-176`).
 *
 * `getBoundingClientRect()` ja devolve a caixa COM o zoom aplicado, entao
 * LER da o numero que os olhos veem. O problema e ESCREVER: `style.top` num
 * host zoado e interpretado nas unidades DELE. Este componente resolve isso
 * na origem, fixando `zoom: 1 !important` no proprio `:host` (regra de folha
 * com `!important` vence estilo inline, a mesma trava que o
 * `z-index: 2000000 !important` do DeathWindow usa). Com o host em zoom 1,
 * ler e escrever passam a ser a MESMA unidade, e nao ha conversao nenhuma no
 * caminho: nao ha como esquecer de chamar `emUnidadesDaHud`, porque nao ha
 * chamada.
 */

/** A folga entre a borda do alvo e a boca do furo, em pixel de viewport. */
export const FOLGA_DO_RECORTE = 6;

function limitar(v, min, max) {
	return v < min ? min : v > max ? max : v;
}

/**
 * O furo: a caixa do alvo com folga, cortada na tela.
 *
 * @param {{left:number, top:number, width:number, height:number}} caixa
 * @param {{largura:number, altura:number}} tela
 * @param {number} [folga]
 * @returns {{x:number,y:number,w:number,h:number}|null} `null` quando o alvo
 *   nao tem caixa (leque fechado: `display:none` mede 0x0) ou esta inteiro
 *   fora da tela. Quem chama trata isso como "o alvo sumiu".
 */
export function recorteDoAlvo(caixa, tela, folga = FOLGA_DO_RECORTE) {
	if (!caixa || !tela || caixa.width <= 0 || caixa.height <= 0) {
		return null;
	}
	const x1 = limitar(caixa.left - folga, 0, tela.largura);
	const y1 = limitar(caixa.top - folga, 0, tela.altura);
	const x2 = limitar(caixa.left + caixa.width + folga, 0, tela.largura);
	const y2 = limitar(caixa.top + caixa.height + folga, 0, tela.altura);
	if (x2 - x1 <= 0 || y2 - y1 <= 0) {
		return null;
	}
	return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Os quatro retangulos da mascara, na ordem topo, baixo, esquerda, direita.
 *
 * Recorte `null` devolve UM retangulo cobrindo a tela inteira: e a etapa sem
 * alvo, e a camada continua existindo (o balao mora nela). Quem nao quiser
 * escurecer nada nessa etapa esconde a mascara; a decisao e do componente.
 */
export function retangulosDaMascara(recorte, tela) {
	if (!recorte) {
		return [{ x: 0, y: 0, w: tela.largura, h: tela.altura }];
	}
	const { x, y, w, h } = recorte;
	return [
		{ x: 0, y: 0, w: tela.largura, h: y },
		{ x: 0, y: y + h, w: tela.largura, h: Math.max(0, tela.altura - (y + h)) },
		{ x: 0, y, w: x, h },
		{ x: x + w, y, w: Math.max(0, tela.largura - (x + w)), h }
	];
}

/**
 * ONDE A MAO ENCOSTA.
 *
 * A mao e o quadro 0 da acao CLICK do `cursors.spr` do proprio jogo, e nela o
 * dedo aponta para CIMA E PARA A ESQUERDA. Entao a posicao natural e ABAIXO E
 * A DIREITA do alvo, com a ponta do dedo encostada na borda dele.
 *
 * Quando nao ha espaco (o `.tm-fab` mora no canto inferior direito da tela, e
 * "abaixo e a direita" dele e fora do mundo), a imagem e ESPELHADA no eixo que
 * faltou. Espelhar nao e desenhar: o proprio formato `.act` do Ragnarok tem um
 * campo `mirror` por camada (`tools/spr-act/act.ts:63`) e o cliente ja
 * renderiza camadas espelhadas. E o vocabulario do jogo, nao um desenho novo.
 *
 * @param {{x:number,y:number,w:number,h:number}} recorte
 * @param {{largura:number, altura:number}} tela
 * @param {{largura:number, altura:number, pontaX:number, pontaY:number}} mao
 *        `pontaX/pontaY` e onde fica a ponta do dedo DENTRO da imagem nao
 *        espelhada. O componente mede isso varrendo o alfa do PNG uma vez.
 * @returns {{x:number,y:number,espelharX:boolean,espelharY:boolean}}
 */
export function posicaoDaMao(recorte, tela, mao) {
	/* Sobra a direita/abaixo do alvo se a mao inteira couber depois da ponta. */
	const sobraDireita = tela.largura - (recorte.x + recorte.w) >= mao.largura - mao.pontaX;
	const sobraAbaixo = tela.altura - (recorte.y + recorte.h) >= mao.altura - mao.pontaY;
	const espelharX = !sobraDireita;
	const espelharY = !sobraAbaixo;

	/* A ponta encosta na borda do alvo, 4px para dentro: a mesma sobreposicao
	   leve que a gravacao mostra (`passo-1-begin.png`). */
	const dentro = 4;
	const alvoX = espelharX ? recorte.x + recorte.w * 0.25 : recorte.x + recorte.w * 0.75;
	const alvoY = espelharY ? recorte.y + dentro : recorte.y + recorte.h - dentro;

	/* Espelhar move a ponta para o lado oposto da imagem. */
	const pontaX = espelharX ? mao.largura - mao.pontaX : mao.pontaX;
	const pontaY = espelharY ? mao.altura - mao.pontaY : mao.pontaY;

	return {
		x: limitar(alvoX - pontaX, 0, Math.max(0, tela.largura - mao.largura)),
		y: limitar(alvoY - pontaY, 0, Math.max(0, tela.altura - mao.altura)),
		espelharX,
		espelharY
	};
}

/**
 * A CASA DO BALAO.
 *
 * A regra 3 da gravacao pede que o balao more sempre no mesmo lugar. Aqui ele
 * tem DUAS casas declaradas, e nao uma, porque o Rag Idle nao e o AFK Arena: la
 * todo controle guiado vive na barra de baixo e o balao senta em cima dela;
 * aqui o "Menu" mora no canto INFERIOR direito e o rastreador de missao no
 * canto SUPERIOR esquerdo. Uma casa fixa so cobriria o alvo em metade das
 * etapas, e cobrir o alvo e o defeito que a camada existe para nao ter.
 *
 * Duas casas conhecidas ainda e previsivel; um balao que persegue o alvo nao
 * seria.
 *
 * @returns {'baixo'|'cima'}
 */
export function casaDoBalao(recorte, tela, balao) {
	if (!recorte) {
		return 'baixo';
	}
	const faixaBaixo = {
		topo: tela.altura - balao.margem - balao.altura,
		fundo: tela.altura - balao.margem
	};
	const faixaCima = { topo: balao.margem, fundo: balao.margem + balao.altura };
	const cruza = faixa =>
		Math.max(0, Math.min(recorte.y + recorte.h, faixa.fundo) - Math.max(recorte.y, faixa.topo));
	/* Empate fica em "baixo": e a casa da gravacao, e a que o polegar alcanca. */
	return cruza(faixaCima) < cruza(faixaBaixo) ? 'cima' : 'baixo';
}
