/**
 * O RODAPE DO DOSSIE DO MAPA DE CACA: os DOIS botoes, sempre (D-1673,
 * 21/09/2026 — ordem do dono).
 *
 * Palavras dele: *"Mantenha dois botoes separados e fixos na interface:
 * 'Cacar' e, abaixo dele, 'Retornar para Prontera'. O botao 'Cacar' nao deve
 * mais ser substituido pelo de retorno conforme o estado do jogador. Ambos
 * devem permanecer visiveis; habilite cada acao conforme sua aplicabilidade,
 * explicando estados indisponiveis."*
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MODULO EXISTE, SEPARADO DA JANELA
 * ---------------------------------------------------------------------------
 * O par da HUD (`HuntButtonIdle`) ja eram dois botoes desde 31/08/2026. O
 * ULTIMO lugar em que um ainda era substituido pelo outro era o rodape desta
 * janela: quando o mapa escolhido era o mapa atual, o botao "Viajar para X"
 * SUMIA e no lugar dele nascia uma nota "Voce ja esta neste mapa" — o proprio
 * defeito que o pedido nomeia.
 *
 * A decisao vive aqui, pura, e nao no meio do `renderFooter`: dentro do HTML
 * ela so podia ser lida por foto, e foto e cara. Aqui ela e um valor, e o
 * portao que a cobra roda em milissegundos.
 *
 * ---------------------------------------------------------------------------
 * A REGRA, EM UMA FRASE
 * ---------------------------------------------------------------------------
 * Os dois botoes SEMPRE existem. Cada um traz `habilitado` e, quando
 * `habilitado` e falso, um `motivo` que o jogador LE. Nunca um botao no lugar
 * do outro, e nunca um botao apagado sem dizer por que.
 */

/** O rotulo do mapa, com o nome tecnico como ultimo recurso. */
function rotuloDe(mapa) {
	if (!mapa) {
		return '';
	}
	return mapa.rotulo || mapa.mapa || '';
}

/**
 * O estado dos dois botoes do rodape.
 *
 * @param {object} par
 * @param {object|null} par.mapa      o mapa selecionado no dossie (ou `null`)
 * @param {object|null} par.encaixe   o veredito de encaixe do mapa (`cls`)
 * @param {string} par.mapaAtual      onde o personagem esta agora
 * @param {object} par.cidade         o ponto salvo (`{ mapa, rotulo }`)
 */
export function estadoDoRodape({ mapa, encaixe, mapaAtual, cidade }) {
	const nomeDaCidade = rotuloDe(cidade) || 'a cidade';
	const naCidade = Boolean(cidade) && mapaAtual === cidade.mapa;

	/*
	 * VIAJAR. Tres razoes para ele nao se aplicar, nesta ordem — e a ordem
	 * importa para a MENSAGEM: quem nao escolheu mapa nenhum precisa ouvir
	 * "escolha um mapa", e nao "voce ja esta neste mapa", mesmo quando as
	 * duas frases seriam verdadeiras.
	 */
	const viajar = {
		rotulo: mapa ? `Viajar para ${rotuloDe(mapa)}` : 'Viajar',
		mapa: mapa ? mapa.mapa : null,
		habilitado: false,
		motivo: null,
	};

	if (!mapa) {
		viajar.motivo = 'Escolha um mapa na lista ao lado.';
	} else if (encaixe && encaixe.cls === 'locked') {
		/*
		 * O NIVEL VAI NO ROTULO, e nao so no motivo: e a informacao que o
		 * jogador usa para decidir, e o atlas ja a mostra assim no cartao.
		 */
		const nivel = mapa.nivelQueAbre;
		viajar.rotulo = `Abre no Nv. ${String(nivel)}`;
		viajar.motivo = `${rotuloDe(mapa)} abre no nível ${String(nivel)}.`;
	} else if (mapaAtual === mapa.mapa) {
		viajar.motivo = `Você já está neste mapa.`;
	} else {
		viajar.habilitado = true;
	}

	/*
	 * RETORNAR. Ele nao depende do mapa selecionado — depende so de onde o
	 * personagem esta. Amarrar os dois foi o que fez um sumir pelo outro.
	 */
	const retornar = {
		rotulo: 'Retornar ao ponto salvo',
		mapa: cidade ? cidade.mapa : null,
		habilitado: !naCidade,
		motivo: naCidade ? `Você já está em ${nomeDaCidade}.` : null,
	};

	return { viajar, retornar };
}
