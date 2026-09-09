/**
 * UI/Components/CodexIdle/jornadaDeMidgard.js
 *
 * AS REGRAS DA JORNADA QUE NAO PRECISAM DE DOM.
 *
 * Ela existe pelo mesmo motivo de `atlasDeCaca.js` (o irmao do Mapa de Caca):
 * o que decide COISA - onde cai um pino, que rotulo um estado tem, por que a
 * viagem nao vai sair - fica aqui, onde um teste executa; a `CodexIdle.js`
 * fica com o innerHTML. Regra escondida dentro de uma string de HTML so e
 * conferida por olho humano, e olho humano nao roda no gate.
 *
 * ---------------------------------------------------------------------------
 * O PINO E CONSERVADOR DE PROPOSITO
 * ---------------------------------------------------------------------------
 * O mapa-mundi entregue pelo dono nomeia LUGARES, e o catalogo do servidor
 * agrupa capitulos por REGIAO. Os dois vocabularios se cruzam em parte
 * (Prontera, Geffen, Payon...) e em parte nao. Casar "Caverna de Gelo" com uma
 * regiao por semelhanca de nome seria inventar geografia, e um pino no lugar
 * errado ensina o jogador errado - pior que nenhum pino.
 *
 * Entao: **so ganha pino o capitulo cujo texto CONTEM, inteiro, o nome de um
 * lugar medido**. Empate de tamanho entre dois lugares diferentes: nenhum
 * pino. Dois capitulos disputando o mesmo lugar: fica o de menor `ordem`, e o
 * outro vive so na lista. Todo capitulo aparece na lista de qualquer jeito -
 * o pino e um extra, nunca a unica porta.
 *
 * ---------------------------------------------------------------------------
 * OS QUATRO ESTADOS TEM ROTULO E GLIFO, E NAO SO COR
 * ---------------------------------------------------------------------------
 * Daltonico e print em preto e branco tem de distinguir os quatro. Cada estado
 * carrega: uma PALAVRA escrita, um GLIFO do `ri-icones.js` e uma FORMA
 * (preenchido / vazado / tracejado), que e o eixo que sobrevive a foto sem
 * cor. Cor e o quarto sinal, nunca o primeiro.
 *
 * @author RagIdle
 */

/**
 * Os lugares do mapa-mundi, em PORCENTAGEM da imagem
 * (`public/ragidle/mapa-de-midgard.webp`, 1457x1080).
 *
 * Medidos sobre uma grade de 100 px desenhada no PNG de origem e OLHADOS, com
 * precisao de ~10 px - a tabela e
 * `rag-idle-master/docs/referencia-tutorial/PONTOS-DO-MAPA-DE-MIDGARD.md`, e
 * a copia aqui e deliberada: o cliente nao le documento do repo do servidor.
 * Quem mudar um numero la muda aqui, e o teste de sanidade abaixo cobra que
 * todos caiam dentro de 0..100.
 */
export const PONTOS_DO_MAPA = [
	{ lugar: 'Prontera', x: 47.8, y: 42.8 },
	{ lugar: 'Esgotos de Prontera', x: 59.8, y: 75.3 },
	{ lugar: 'Mina de Carvao', x: 39.1, y: 45.1 },
	{ lugar: 'Torre de Geffen', x: 26.9, y: 49.8 },
	{ lugar: 'Geffenia', x: 29.3, y: 58.9 },
	{ lugar: 'Piramide', x: 38.2, y: 65.0 },
	{ lugar: 'Esfinge', x: 41.2, y: 73.1 },
	{ lugar: 'Caverna de Payon', x: 90.7, y: 62.3 },
	{ lugar: 'Caverna de Byalan', x: 77.6, y: 62.7 },
	{ lugar: 'Calabocos de Glast Heim', x: 13.7, y: 53.1 },
	{ lugar: 'Niflheim', x: 9.4, y: 73.7 },
	{ lugar: 'Vulcao de Thor', x: 8.4, y: 40.6 },
	{ lugar: 'Caverna de Magma', x: 21.5, y: 4.7 },
	{ lugar: 'Tumba Selada', x: 7.9, y: 4.0 },
	{ lugar: 'Torre de Thanatos', x: 48.3, y: 2.7 },
	{ lugar: 'Novus', x: 55.3, y: 3.9 },
	{ lugar: 'Caverna de Gelo', x: 38.6, y: 6.3 },
	{ lugar: 'Lago do Abismo', x: 67.7, y: 4.0 },
	{ lugar: 'Juperos', x: 73.8, y: 6.5 },
	{ lugar: 'Academia de Kiel', x: 70.0, y: 17.6 },
	{ lugar: 'Santuario de Odin', x: 87.3, y: 22.2 },
	{ lugar: 'Torre de Relogio', x: 75.2, y: 35.4 },
	{ lugar: 'Laboratorio de Somatologia', x: 34.7, y: 37.5 },
	{ lugar: 'Formigueiro Infernal', x: 22.4, y: 95.4 },
	{ lugar: 'Ilha da Tartaruga', x: 94.2, y: 96.5 },
	{ lugar: 'Navio Fantasma', x: 93.6, y: 84.4 },
	{ lugar: 'Ilha Esquecida', x: 6.0, y: 62.9 }
];

/**
 * Os quatro estados que o retrato pode mandar, com as QUATRO marcas de cada um.
 *
 * `glifo` e a chave de `UI/ri-icones.js` - a janela resolve, este modulo nao
 * importa SVG nenhum para continuar rodavel fora do navegador.
 */
export const ESTADOS_DA_JORNADA = {
	concluido: { rotulo: 'Concluído', glifo: 'confere', classe: 'is-concluido', forma: 'cheia' },
	'em-andamento': { rotulo: 'Em andamento', glifo: 'espadas', classe: 'is-andamento', forma: 'meia' },
	disponivel: { rotulo: 'Disponível', glifo: 'alvo', classe: 'is-disponivel', forma: 'vazada' },
	bloqueado: { rotulo: 'Bloqueado', glifo: 'cadeado', classe: 'is-bloqueado', forma: 'tracejada' }
};

/**
 * O selo de um estado. Estado DESCONHECIDO nao some da tela: ele aparece com a
 * propria sigla, pelo mesmo motivo do eixo desconhecido em `CodexIdle.js` - um
 * estado novo do servidor tem de APARECER, mesmo feio, em vez de sumir calado.
 */
export function seloDoEstado(estado) {
	const chave = typeof estado === 'string' ? estado : '';
	if (Object.prototype.hasOwnProperty.call(ESTADOS_DA_JORNADA, chave)) {
		return ESTADOS_DA_JORNADA[chave];
	}
	return { rotulo: chave || 'Sem estado', glifo: 'alerta', classe: 'is-desconhecido', forma: 'vazada' };
}

/**
 * Sem acento, minusculo, espaco unico - para casar nome com nome.
 *
 * O `NFD` separa a letra do acento; o filtro seguinte joga fora tudo o que nao
 * for ASCII imprimivel, que e onde os acentos separados foram parar. Ele e
 * escrito com faixa ASCII de proposito: a alternativa (a classe dos sinais
 * combinantes) poe caracteres INVISIVEIS dentro do fonte, e este projeto ja
 * perdeu tempo com um byte NUL em fonte.
 */
export function normalizarNome(texto) {
	return String(texto == null ? '' : texto)
		.normalize('NFD')
		.replace(/[^\x20-\x7E]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * O contador ESCRITO, e nao `3/10`.
 *
 * O pedido do dono e literal ("3 de 10"). A barra pode ser lida como fracao
 * ou como data por quem passa o olho; "de" nao.
 */
export function contadorEscrito(feitos, meta) {
	const a = Number.isFinite(Number(feitos)) ? Math.max(0, Math.floor(Number(feitos))) : 0;
	const b = Number.isFinite(Number(meta)) ? Math.max(0, Math.floor(Number(meta))) : 0;
	return Math.min(a, b || a) + ' de ' + b;
}

/** Quanto da barra encher, sem passar de 100% (o teto e da LARGURA, nao do dado). */
export function porcentagem(feitos, meta) {
	const b = Number(meta) || 0;
	if (b <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((Math.max(0, Number(feitos) || 0) / b) * 100));
}

/**
 * Onde cai o pino de cada capitulo. Devolve um objeto `{ [idDoCapitulo]: ponto }`
 * so com os capitulos RECONHECIDOS - ver o cabecalho para o porque da recusa.
 *
 * @param {Array} capitulos as entradas de `jornada.capitulos` do retrato
 * @returns {object} id do capitulo -> { lugar, x, y }
 */
export function pinosDosCapitulos(capitulos) {
	const lista = Array.isArray(capitulos) ? capitulos : [];
	const pontos = PONTOS_DO_MAPA.map(p => ({ ponto: p, chave: normalizarNome(p.lugar) }));

	/** id -> ponto, ja resolvido o empate por especificidade. */
	const escolha = {};
	for (const cap of lista) {
		if (!cap || typeof cap.id !== 'string') {
			continue;
		}
		const texto = normalizarNome(String(cap.titulo || '') + ' ' + String(cap.id || ''));
		const casaram = pontos.filter(p => p.chave !== '' && texto.indexOf(p.chave) !== -1);
		if (casaram.length === 0) {
			continue;
		}
		// O MAIS ESPECIFICO GANHA: "esgotos de prontera" vence "prontera" no
		// capitulo dos esgotos, e so ele. Empate de tamanho entre dois lugares
		// diferentes e ambiguidade de verdade - nenhum pino.
		let maior = casaram[0];
		for (const c of casaram) {
			if (c.chave.length > maior.chave.length) {
				maior = c;
			}
		}
		const empatados = casaram.filter(c => c.chave.length === maior.chave.length);
		if (empatados.length > 1) {
			continue;
		}
		escolha[cap.id] = maior.ponto;
	}

	/*
	 * DOIS CAPITULOS NO MESMO LUGAR desenhariam dois pinos no mesmo pixel, e o
	 * de baixo ficaria inalcancavel. Fica o de menor `ordem` - o primeiro da
	 * jornada -, e o outro vive na lista, como qualquer capitulo sem pino.
	 */
	const porOrdem = lista
		.filter(c => c && typeof c.id === 'string' && escolha[c.id])
		.slice()
		.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

	const tomados = {};
	const saida = {};
	for (const cap of porOrdem) {
		const p = escolha[cap.id];
		if (tomados[p.lugar]) {
			continue;
		}
		tomados[p.lugar] = true;
		saida[cap.id] = p;
	}
	return saida;
}

/**
 * O CAPITULO QUE E O PROXIMO PASSO.
 *
 * `capituloAtual` vem do servidor e manda. Sem ele (retrato antigo, ou jornada
 * inteira concluida), o proximo passo e o primeiro capitulo nao concluido na
 * ordem - e `null` quando nao ha nenhum, que e o fim da jornada.
 */
export function proximoPasso(jornada) {
	const capitulos = (jornada && Array.isArray(jornada.capitulos) ? jornada.capitulos : []).slice();
	if (capitulos.length === 0) {
		return null;
	}
	capitulos.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
	const atual = jornada && jornada.capituloAtual;
	if (atual) {
		const achado = capitulos.find(c => c && c.id === atual);
		if (achado) {
			return achado;
		}
	}
	return capitulos.find(c => c && c.estado !== 'concluido') || null;
}

/**
 * O placar do premio: quantos capitulos ja fecharam, de quantos, e a frase do
 * que falta. O premio e anunciado DESDE A PRIMEIRA ABERTURA (pedido do dono),
 * entao esta conta tem de responder tambem com a jornada trancada.
 */
export function placarDoPremio(jornada) {
	const capitulos = jornada && Array.isArray(jornada.capitulos) ? jornada.capitulos : [];
	const total = capitulos.length;
	const concluidos = capitulos.filter(c => c && c.estado === 'concluido').length;
	const entregue = !!(jornada && jornada.premio && jornada.premio.entregue);

	let falta;
	if (entregue) {
		falta = 'Já está com você.';
	} else if (total === 0) {
		falta = 'Conclua a Jornada de Midgard inteira para receber.';
	} else if (concluidos >= total) {
		falta = 'Tudo concluído - o prêmio sai no próximo abate creditado.';
	} else {
		const restam = total - concluidos;
		// O singular tem frase propria: "Faltam 1 capitulo" e o tipo de erro que
		// o jogador le como descuido, e ele esta na tela mais premiada da aba.
		falta = restam === 1 ? 'Falta 1 capítulo para receber.' : 'Faltam ' + restam + ' capítulos para receber.';
	}

	return { concluidos: concluidos, total: total, entregue: entregue, falta: falta };
}

/**
 * POR QUE A VIAGEM NAO VAI SAIR - a pergunta que este modulo existe para
 * responder.
 *
 * `viajar()` do servidor tem recusas SILENCIOSAS: ele nao responde nada, o
 * personagem nao sai do lugar e o botao parece quebrado. Tres delas o jogador
 * provoca com um clique inocente, e as tres sao previsiveis daqui:
 *
 *  - **morto** (`servidor-mapa.ts`, o gesto de viagem recusa `estaMorto`);
 *  - **mapa acima do nivel** (`personagem.nivel < nivelQueAbre` do catalogo);
 *  - **o mapa em que voce JA esta** (a saida que existe para o menu nao
 *    reapresentar o mundo inteiro).
 *
 * `nivelQueAbre` chega `null`/`undefined` quando o catalogo do Mapa de Caca
 * ainda nao veio - e ai a resposta certa e DEIXAR CLICAR: recusar por falta de
 * dado seria a janela inventando uma tranca que o servidor talvez nao aplique.
 *
 * @returns {null|{codigo: string, frase: string}} `null` = pode viajar
 */
export function motivoDeNaoViajar(entrada) {
	const dados = entrada || {};
	if (dados.morto) {
		return { codigo: 'morto', frase: 'Você está morto - reviva antes de viajar.' };
	}
	const mapa = dados.mapa || '';
	if (mapa && dados.mapaAtual && normalizarNome(mapa) === normalizarNome(dados.mapaAtual)) {
		return { codigo: 'ja-esta-aqui', frase: 'Você já está neste mapa.' };
	}
	const abre = Number(dados.nivelQueAbre);
	const nivel = Number(dados.nivelDoJogador);
	if (Number.isFinite(abre) && abre > 0 && Number.isFinite(nivel) && nivel > 0 && nivel < abre) {
		return {
			codigo: 'nivel',
			frase: 'Este mapa abre no Nv. ' + abre + ' - você está no Nv. ' + nivel + '.'
		};
	}
	return null;
}

/**
 * As missoes de UMA especie, em todos os mapas onde ela aparece.
 *
 * A ponte que o pedido exige e nos DOIS sentidos, e este e o sentido caro: o
 * retrato manda missao por CAPITULO, entao a lista por especie so existe
 * depois que os capitulos chegaram. A janela acumula o que ja chegou e este
 * indice le desse acumulado - a resposta cresce conforme os capitulos entram,
 * em vez de esperar todos para mostrar alguma coisa.
 *
 * @param {object} missoesPorCapitulo  id do capitulo -> lista de missoes
 * @param {number} mobId
 */
export function missoesDaEspecie(missoesPorCapitulo, mobId) {
	const alvo = Number(mobId);
	if (!Number.isFinite(alvo)) {
		return [];
	}
	const saida = [];
	const mapa = missoesPorCapitulo || {};
	for (const id of Object.keys(mapa)) {
		for (const m of mapa[id] || []) {
			if (m && Number(m.mobId) === alvo) {
				saida.push(m);
			}
		}
	}
	saida.sort((a, b) => {
		const ca = String(a.capitulo || '');
		const cb = String(b.capitulo || '');
		if (ca !== cb) {
			return ca < cb ? -1 : 1;
		}
		return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
	});
	return saida;
}

/**
 * As recompensas de uma missao, em texto de jogador.
 *
 * Mesmo dicionario de `CodexIdle.js` para as entradas do Codex - tipo que a
 * janela nao conhece some da frase em vez de imprimir o nome cru do campo,
 * porque uma frase com "expJob: 400" no meio e pior que uma frase mais curta.
 */
export function recompensaEmTexto(recompensas) {
	if (!Array.isArray(recompensas)) {
		return '';
	}
	return recompensas
		.map(r => {
			if (!r) {
				return '';
			}
			if (r.tipo === 'zeny') {
				return r.quantidade + ' zeny';
			}
			if (r.tipo === 'expBase') {
				return r.quantidade + ' EXP de base';
			}
			if (r.tipo === 'expClasse') {
				return r.quantidade + ' EXP de classe';
			}
			if (r.tipo === 'item') {
				return (r.quantidade > 1 ? r.quantidade + 'x ' : '') + (r.nome || 'item');
			}
			return '';
		})
		.filter(Boolean)
		.join(' · ');
}
