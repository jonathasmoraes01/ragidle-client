/**
 * UI/Components/TutorialIdle/etapasDoTutorial.js
 *
 * A REGRA PURA DO TUTORIAL GUIADO: a tabela das onze etapas e a geometria da
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
export const TOTAL_DE_ETAPAS = 11;

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
 * AS ONZE ETAPAS (secao 7 do CONTRATO-JORNADA.md, mais o Correio e as
 * poções - achados faltando/fora de ordem em 15/09/2026).
 *
 * Campos de cada uma:
 *   numero      1..11, o que o servidor guarda em `etapa`.
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
	Object.freeze({
		numero: 2,
		rotulo: 'Missões',
		frase: '{acao} {rotulo}. Separei a sua primeira tarefa.',
		alvo: Object.freeze({ host: 'TopMenuIdle', seletor: '.tm-item[data-action="missoes"]' }),
		/* O leque fechado nao tem caixa (armadilha 3 do contrato): os itens
		   somem com `display:none`, entao o alvo mede 0x0. Em vez de apontar
		   para o vazio, o tutorial volta a apontar a porta. */
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-fab',
			frase: 'Abra o "Menu" de novo. As "Missões" moram lá dentro.'
		}),
		avancaPor: 'janela-de-missoes-aberta'
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
		avancaPor: 'pocoes-configuradas'
	}),
	Object.freeze({
		numero: 7,
		rotulo: 'Iniciar',
		frase: '{acao} {rotulo} na primeira missão. Eu anoto o resto.',
		alvo: Object.freeze({ host: 'MissoesIdle', seletor: '.mi-executar[data-executar="iniciar"]' }),
		/*
		 * O QUANDOSUMIR APONTA PARA O ICONE DO LEQUE, NAO PARA O `.tm-fab`
		 * (achado ao JOGAR o reordenamento, 15/09/2026) - a mesma familia de
		 * defeito das etapas do Correio/Arma/Mapa, um nivel mais fundo. O
		 * `.tm-fab` tem caixa valida SEMPRE, leque aberto ou fechado; um
		 * furo preso nele NUNCA some, entao o alvo primario nunca ganha a
		 * chance de assumir e o segundo clique (o icone "Missões" DENTRO do
		 * leque aberto) fica do lado de fora do furo - exatamente como
		 * `.tm-fab` sozinho bloqueava o clique dentro da janela que ele
		 * abre, nas outras etapas. Apontando para o PROPRIO icone (0x0 com
		 * o leque fechado, valido com o leque aberto) o comportamento vira
		 * o mesmo da etapa 4: leque fechado cai no `semMascara` (nada
		 * bloqueado, o jogador abre o leque livre), leque aberto acerta o
		 * icone de "Missões" direto.
		 */
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-item[data-action="missoes"]',
			frase: 'A janela de "Missões" fechou. Abra o "Menu" e volte em "Missões".'
		}),
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
	Object.freeze({
		numero: 11,
		rotulo: 'Codex',
		frase: '{acao} {rotulo}. A Jornada de Midgard te espera lá dentro.',
		alvo: Object.freeze({ host: 'TopMenuIdle', seletor: '.tm-item[data-action="codex"]' }),
		quandoSumir: Object.freeze({
			host: 'TopMenuIdle',
			seletor: '.tm-fab',
			frase: 'Abra o "Menu". O "Codex" é o último passo.'
		}),
		avancaPor: 'janela-do-codex-aberta'
	})
]);

/** A etapa de numero `n`, ou `null`. Fora de 1..11 devolve `null` de proposito:
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
