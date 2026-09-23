/**
 * Engine/retomadaAposAtualizacao.js
 *
 * A RETOMADA DEPOIS DA ATUALIZACAO (D-997, 23/09/2026, pedido do dono).
 *
 * Quando o jogo se atualiza sozinho (`UI/atualizacaoAutomatica.js`), a pagina
 * recarrega — e a sessao do jogador morava so na memoria dela. Sem esta peca,
 * toda atualizacao levaria o jogador de volta a tela de login, pedindo a
 * senha. O dono pediu as duas coisas juntas: atualizar sozinho E nao deslogar.
 *
 * ---------------------------------------------------------------------------
 * COMO: o MESMO passe, pelo MESMO caminho da selecao de personagem
 * ---------------------------------------------------------------------------
 * Logo antes de recarregar, o jogo guarda na aba o que o login-server tinha
 * entregado (conta, passe, sexo, nivel da conta, o char-server) e o personagem
 * que estava em jogo. A pagina nova le isso UMA vez, apaga, e entra no
 * char-server com o passe — o `CH_ENTER` que o login faria —, e a selecao de
 * personagem escolhe sozinha o mesmo personagem. Nada de caminho novo no
 * servidor: o passe vale enquanto o jogador joga e so vence depois de 15 min
 * parado (D-1303/D-1506), e uma recarga leva segundos.
 *
 * Entrar pelo char-server, e nao direto no mapa como a reconexao automatica
 * faz, e deliberado: a entidade do jogador (`Session.Entity`) nasce da lista
 * de personagens (`CharEngine.onConnectRequest`). Montar essa entidade a mao
 * seria uma segunda rota para o mesmo estado — o defeito mais repetido deste
 * projeto.
 *
 * ---------------------------------------------------------------------------
 * O PASSE E CREDENCIAL, entao ele vive o MINIMO no armazenamento
 * ---------------------------------------------------------------------------
 *   - `sessionStorage`, e nao `localStorage`: morre com a aba, nao vai para
 *     outra aba nem sobrevive a fechar o navegador;
 *   - gravado so no instante da recarga, e APAGADO na primeira leitura, valendo
 *     ou nao;
 *   - recusado se tiver mais de `PRAZO_DA_RETOMADA_MS`: uma retomada esquecida
 *     (a recarga falhou, a aba ficou parada) nao reabre a sessao depois.
 * Se o servidor recusar o passe (vencido, manutencao, `@kick`), o char-server
 * fecha a conexao e o jogador cai na tela de login de sempre.
 */

/** A chave na `sessionStorage` da aba. */
export const CHAVE_DA_RETOMADA = 'ragidle:retomada';

/**
 * Quanto a retomada vale depois de gravada. Uma recarga normal leva segundos;
 * 60 s cobre o celular lento sem deixar a credencial parada por muito tempo.
 */
export const PRAZO_DA_RETOMADA_MS = 60_000;

/** A `sessionStorage` da aba, ou `null` quando o navegador a nega. */
function armazenamentoPadrao() {
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

/**
 * Guarda a sessao para a pagina seguinte. Devolve `true` se gravou — sem conta
 * ou sem passe nao ha o que retomar, e a recarga segue para o login.
 *
 * @param {{AID:number, AuthCode:number, UserLevel:number, Sex:number, WebToken?:string, ServerName?:string}} sessao
 * @param {object|null} servidorDeChar o `CharEngine.servidorAtual`
 * @param {number|null} gid o personagem em jogo, ou `null` (estava na selecao)
 * @param {number} agora
 * @param {Storage|null} [armazenamento]
 */
export function guardarRetomada(sessao, servidorDeChar, gid, agora, armazenamento = armazenamentoPadrao()) {
	if (!armazenamento || !sessao || !sessao.AID || !sessao.AuthCode || !servidorDeChar) {
		return false;
	}
	const dados = {
		AID: sessao.AID,
		AuthCode: sessao.AuthCode,
		UserLevel: sessao.UserLevel || 0,
		Sex: sessao.Sex || 0,
		WebToken: sessao.WebToken || '',
		ServerName: sessao.ServerName || servidorDeChar.name || '',
		servidorDeChar,
		gid: typeof gid === 'number' && gid > 0 ? gid : null,
		guardadaEm: agora
	};
	try {
		armazenamento.setItem(CHAVE_DA_RETOMADA, JSON.stringify(dados));
		return true;
	} catch {
		return false;
	}
}

/**
 * Le a retomada UMA vez e a apaga, valendo ou nao. `null` para qualquer
 * duvida: ausente, torta, sem os campos, ou velha demais.
 *
 * @param {number} agora
 * @param {Storage|null} [armazenamento]
 */
export function consumirRetomada(agora, armazenamento = armazenamentoPadrao()) {
	if (!armazenamento) {
		return null;
	}
	let texto = null;
	try {
		texto = armazenamento.getItem(CHAVE_DA_RETOMADA);
		armazenamento.removeItem(CHAVE_DA_RETOMADA);
	} catch {
		return null;
	}
	if (!texto) {
		return null;
	}
	let dados;
	try {
		dados = JSON.parse(texto);
	} catch {
		return null;
	}
	if (
		!dados ||
		typeof dados.AID !== 'number' ||
		typeof dados.AuthCode !== 'number' ||
		!dados.AID ||
		!dados.AuthCode ||
		!dados.servidorDeChar ||
		typeof dados.servidorDeChar.port !== 'number' ||
		typeof dados.guardadaEm !== 'number'
	) {
		return null;
	}
	const idade = agora - dados.guardadaEm;
	if (idade < 0 || idade > PRAZO_DA_RETOMADA_MS) {
		return null;
	}
	return dados;
}

/* ═════════════════════════════════════════════════════════════════════
   A SELECAO AUTOMATICA — uma vez so
   ═════════════════════════════════════════════════════════════════════ */

/** O personagem que a selecao deve escolher sozinha, ou `null`. */
let _gidArmado = null;

/** Arma a selecao automatica do personagem `gid` (a retomada o chama). */
export function armarSelecao(gid) {
	_gidArmado = typeof gid === 'number' && gid > 0 ? gid : null;
}

/**
 * Chamada a cada lista de personagens que chega. Devolve o personagem a
 * selecionar e DESARMA — a lista chega mais de uma vez (D-1379), e so a
 * primeira pode entrar no jogo. Personagem que nao esta na lista (apagado
 * entre uma pagina e outra) desarma sem selecionar: o jogador fica na
 * selecao, que e o lugar certo para ele decidir.
 *
 * @param {Array<{GID:number}>|undefined} lista
 */
export function personagemParaSelecionar(lista) {
	if (_gidArmado === null || !Array.isArray(lista)) {
		return null;
	}
	const gid = _gidArmado;
	_gidArmado = null;
	return lista.find(p => p && p.GID === gid) || null;
}
