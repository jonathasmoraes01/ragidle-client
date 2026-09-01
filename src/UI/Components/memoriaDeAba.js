/**
 * A ABA EM QUE O JOGADOR ESTAVA — memoria de aba das janelas RAGIDLE.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTA PECA EXISTE PARA MATAR (D-797, 31/08/2026)
 * ===========================================================================
 *
 * Toda janela nossa com abas guardava a aba ativa numa variavel de MODULO
 * (`IdleConfig.activeTab`, `LFGIdle.abaAtiva`, `_abaAtiva` da Mochila...).
 * Variavel de modulo sobrevive a fechar e reabrir a janela — e so isso. Ela
 * morre em DUAS situacoes que acontecem o tempo todo neste jogo:
 *
 * 1. **F5.** O cliente e uma pagina. Recarregar zera todo modulo, e o jogador
 *    que vive na aba "Alvos" da Configuracao idle voltava para "Geral" em toda
 *    recarga.
 * 2. **A troca de personagem.** `limparEstadoDoPersonagem` (ver
 *    `limpezaDeJanelaIdle.js`) devolvia a aba ao padrao de fabrica junto com o
 *    dado do personagem. Aba nao e dado de personagem: "eu gosto de abrir na
 *    aba Opcionais" e uma preferencia da PESSOA, e vale para os personagens
 *    dela todos.
 *
 * O caso mais feio era a Mochila, onde o mesmo esquecimento nao voltava ao
 * padrao — voltava para `null`, e `syncGrade()` filtrava a lista por uma aba
 * que nao existe. Depois de trocar de personagem, a mochila abria com a grade
 * VAZIA e nenhuma aba acesa, ate o jogador clicar numa delas.
 *
 * ===========================================================================
 * ONDE A ABA MORA
 * ===========================================================================
 *
 * Na MESMA entrada de `Core/Preferences.js` que ja guarda a posicao da janela
 * (`x`/`y`) — uma chave de `localStorage` por janela, como sempre foi. A aba e
 * preferencia de janela pelo mesmo motivo que a posicao e: o jogador a escolheu
 * com a mao, e ninguem espera reencontrar a janela no meio da tela so porque
 * apertou F5.
 *
 * Somar a chave `aba` aos padroes NAO precisa (e nao pode) subir a `version` do
 * `Preferences.get`: quando a versao bate, `Preferences` copia sobre os padroes
 * apenas as chaves que estao gravadas, entao um `localStorage` antigo — sem
 * `aba` — simplesmente fica com o padrao. Subir a versao apagaria a POSICAO que
 * o jogador ja tinha ajustado, para ganhar um campo que ja funciona sem isso.
 *
 * ===========================================================================
 * POR QUE UMA PECA SO, E NAO DEZ COPIAS
 * ===========================================================================
 *
 * Sao DEZ os chamadores: as sete janelas nossas com abas, mais as tres nativas
 * do roBrowser que ainda esqueciam (Guilda, e as Configuracoes de Video e de
 * Atalho). As outras nativas com aba ja lembravam sozinhas — a Inventory e a
 * Storage guardam `_preferences.tab`, a ChatBox guarda `canalAtivo` e a
 * PartyFriends guarda `friend`; o padrao upstream ja era este, e eram as NOSSAS
 * janelas que tinham nascido esquecidas.
 *
 * Mesma razao registrada em `limpezaDeJanelaIdle.js`: a janela ONZE vai nascer
 * copiando uma das dez, e o que ela copiar e o que vai valer. Com uma funcao,
 * o portao (`tests/ui/memoriaDeAba.test.js`) consegue cobrar que toda janela
 * com abas passe por aqui, em vez de a proxima nascer esquecida e virar queixa
 * daqui a duas semanas.
 */

/**
 * A aba que o jogador deixou aberta da ultima vez, ou o padrao.
 *
 * Sempre devolve string: quem guarda aba por numero (a Mochila usa os `TAB.*`
 * da Inventory) converte na volta. Guardar tudo como texto e o que deixa o
 * `localStorage` legivel e o valido conferivel por uma lista so.
 *
 * @param {object|null} preferencias  o objeto de `Preferences.get(...)` da janela
 * @param {string} padrao             a aba de fabrica, usada quando nao ha nada
 *                                    gravado OU o gravado nao vale mais
 * @param {string[]} [abasValidas]    as abas que existem hoje. Sem ela, qualquer
 *                                    texto passa — e o caso do Mapa de Caca, cujas
 *                                    abas sao as REGIOES que o servidor manda e
 *                                    portanto nao cabem numa lista escrita aqui.
 * @returns {string}
 */
export function abaLembrada(preferencias, padrao, abasValidas) {
	const salva = preferencias && preferencias.aba;

	if (typeof salva !== 'string' || salva === '') {
		return padrao;
	}

	/*
	 * A LISTA VALE MAIS QUE O GRAVADO, e de proposito. Uma aba pode SUMIR entre
	 * duas versoes do jogo (a "Fantasia" da Mochila ja foi aba e virou fileira
	 * fixa), e o `localStorage` do jogador continua com o nome dela. Sem esta
	 * conferencia a janela abriria com nenhuma aba acesa e o corpo vazio — que e
	 * exatamente o defeito da Mochila descrito no cabecalho, so que por outra
	 * porta.
	 */
	if (Array.isArray(abasValidas) && abasValidas.indexOf(salva) === -1) {
		return padrao;
	}

	return salva;
}

/**
 * Grava a aba em que o jogador acabou de entrar.
 *
 * Chamada no CLIQUE, e nao no fechar da janela: fechar nao e o unico jeito de
 * sair daqui. O jogador fecha a aba do navegador, cai a conexao, o jogo trava —
 * e em nenhum desses caminhos passa um `closeWindow()`. Gravar no clique custa
 * uma escrita de `localStorage` por troca de aba, que e ruido perto de qualquer
 * coisa que esta janela ja faz (pedir pacote, redesenhar corpo inteiro).
 *
 * @param {object|null} preferencias  o objeto de `Preferences.get(...)` da janela
 * @param {string|number|null} aba    a aba recem-escolhida
 */
export function lembrarAba(preferencias, aba) {
	if (!preferencias || aba == null || aba === '') {
		return;
	}

	const texto = String(aba);

	// Nada mudou, nada a gravar — o clique na aba que ja estava aberta e o
	// caminho mais comum de todos.
	if (preferencias.aba === texto) {
		return;
	}

	preferencias.aba = texto;
	preferencias.save();
}
