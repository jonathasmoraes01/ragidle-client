/**
 * Network/vigiaDeSilencio.js
 *
 * A CONEXAO QUE MORRE CALADA (lacuna 1 da auditoria da reconexao, 24/09/2026).
 *
 * Ate aqui a UNICA porta para a reconexao automatica era o `onClose` do socket
 * (NetworkManager.js). Mas ha quedas que nunca fecham o socket do lado de ca:
 * trocar de wifi para 4G, o notebook que dorme e acorda, o NAT do roteador que
 * esquece a conexao. O TCP fica "aberto" para o navegador por minutos (as vezes
 * para sempre), o jogador ve o mundo congelado, e nenhum aviso aparece — porque
 * do ponto de vista do cliente nada caiu.
 *
 * O servidor responde TODO keepalive (`CZ_REQUEST_TIME2`, a cada ~10 s) com o
 * `ZC_NOTIFY_TIME`, e numa caca chegam dezenas de pacotes por segundo. Entao
 * SILENCIO longo no socket do mapa e evidencia de conexao morta: se nada chega
 * por `LIMITE_DE_SILENCIO_MS`, a vigia manda derrubar o socket, e a queda entra
 * no ciclo de sempre (`Network.onDisconnect` -> `reconexao.js`).
 *
 * POR QUE 35 s: tres keepalives e meio sem resposta nenhuma. Um so perdido
 * (servidor ocupado, pacote atrasado) nunca derruba; uma conexao viva nunca
 * fica 35 s sem mandar nada ao cliente que esta mandando keepalive.
 *
 * O CUIDADO QUE ESTE MODULO TEM E O CONGELAMENTO. Quando a pagina inteira fica
 * congelada (celular com a aba no fundo, notebook dormindo, a thread principal
 * travada carregando um mapa), o relogio de parede anda e NADA roda — nem a
 * vigia, nem a recepcao de pacotes. Na volta, "nada chegou ha 20 minutos" nao
 * prova que a conexao morreu: prova que a pagina estava parada. Se o socket
 * sobreviveu, os pacotes represados chegam logo depois da primeira conferencia,
 * e derrubar ali seria matar uma conexao viva.
 *
 * Por isso a vigia sabe quando ELA MESMA ficou sem rodar: um intervalo entre
 * conferencias maior que `INTERVALO_DE_CONGELAMENTO_MS` quer dizer que a pagina
 * acordou agora. Dali em diante o silencio conta a partir do DESPERTAR, com um
 * prazo curto (`LIMITE_APOS_DESPERTAR_MS`): o keepalive que sai na volta da aba
 * tem de ser respondido em poucos segundos se a conexao estiver viva. Com isso o
 * notebook que acorda sem rede reconecta em ~20 s, e nao em 35 s nem nunca.
 */

/** Silencio que prova conexao morta com a pagina ACORDADA o tempo todo. */
export const LIMITE_DE_SILENCIO_MS = 35000;

/**
 * Intervalo entre conferencias que so acontece se a pagina esteve congelada.
 * As conferencias saem do keepalive (10 s, visivel ou pelo Worker do
 * BackgroundTicker com a aba no fundo), entao 20 s e o dobro do normal.
 *
 * Sem Worker (ambiente sem suporte) e com a aba no fundo, o `setInterval` do
 * navegador cai para ~1 por minuto e TODA conferencia parece um despertar: a
 * vigia fica cega enquanto a aba estiver escondida e volta a enxergar na volta.
 * E o preco certo — errar para o lado de nao derrubar conexao viva.
 */
export const INTERVALO_DE_CONGELAMENTO_MS = 20000;

/** Prazo para o primeiro pacote chegar depois de a pagina acordar. */
export const LIMITE_APOS_DESPERTAR_MS = 12000;

/**
 * A DECISAO, pura: o socket esta calado ha tempo demais?
 *
 * `ultimoRecebidoEm` nulo (nada chegou ainda nesta conexao) nao derruba: quem
 * cuida da entrada que nunca responde e o watchdog da tentativa em
 * `reconexao.js`, e o NetworkManager marca a hora do `connect` como o primeiro
 * "recebido".
 *
 * @param {number|null} ultimoRecebidoEm - Date.now() do ultimo pacote recebido
 * @param {number} agora
 * @param {number} limiteMs
 * @return {boolean}
 */
export function conexaoMorreuEmSilencio(ultimoRecebidoEm, agora, limiteMs) {
	if (typeof ultimoRecebidoEm !== 'number' || !Number.isFinite(ultimoRecebidoEm)) {
		return false;
	}
	return agora - ultimoRecebidoEm >= limiteMs;
}

/**
 * A vigia de UMA conexao de mapa. Guarda so o que a decisao pura nao pode
 * saber: quando ela mesma rodou pela ultima vez, e se a pagina acabou de
 * acordar. Uma vigia nova por conexao (o MapEngine cria uma a cada socket de
 * mapa), para o estado de uma conexao morta nao vazar para a seguinte.
 *
 * @param {object} [opcoes]
 * @return {{ conferir: function(number|null, number): boolean }}
 */
export function criarVigiaDeSilencio(opcoes = {}) {
	const limiteMs = opcoes.limiteMs ?? LIMITE_DE_SILENCIO_MS;
	const congelamentoMs = opcoes.intervaloDeCongelamentoMs ?? INTERVALO_DE_CONGELAMENTO_MS;
	const limiteAposDespertarMs = opcoes.limiteAposDespertarMs ?? LIMITE_APOS_DESPERTAR_MS;

	let ultimaConferenciaEm = null;
	let acordouEm = null;

	/**
	 * @param {number|null} ultimoRecebidoEm
	 * @param {number} agora
	 * @return {boolean} true quando a conexao deve ser derrubada
	 */
	function conferir(ultimoRecebidoEm, agora) {
		if (ultimaConferenciaEm !== null && agora - ultimaConferenciaEm > congelamentoMs) {
			acordouEm = agora;
		}
		ultimaConferenciaEm = agora;

		if (acordouEm !== null) {
			// Chegou pacote depois do despertar: a conexao provou que vive, e o
			// silencio volta a ser medido pela regra normal.
			if (typeof ultimoRecebidoEm === 'number' && ultimoRecebidoEm >= acordouEm) {
				acordouEm = null;
			} else {
				return conexaoMorreuEmSilencio(acordouEm, agora, limiteAposDespertarMs);
			}
		}

		return conexaoMorreuEmSilencio(ultimoRecebidoEm, agora, limiteMs);
	}

	return { conferir };
}
