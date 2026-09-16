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
 * (`public/ragidle/mapa-de-midgard.webp`, 1456x1092).
 *
 * Medidos sobre uma grade de 100 px desenhada no PNG de origem e OLHADOS, com
 * precisao de ~10 px - a tabela e
 * `rag-idle-master/docs/referencia-tutorial/PONTOS-DO-MAPA-DE-MIDGARD.md`, e
 * a copia aqui e deliberada: o cliente nao le documento do repo do servidor.
 * Quem mudar um numero la muda aqui, e o teste de sanidade abaixo cobra que
 * todos caiam dentro de 0..100.
 */
export const PONTOS_DO_MAPA = [
	// A Rune-Midgard central
	{ lugar: 'Prontera', x: 50.7, y: 37.0 },
	{ lugar: 'Izlude', x: 50.6, y: 47.8 },
	{ lugar: 'Geffen', x: 31.5, y: 35.1 },
	{ lugar: 'Al De Baran', x: 50.8, y: 24.4 },
	{ lugar: 'Morroc', x: 28.7, y: 55.8 },
	{ lugar: 'Payon', x: 69.6, y: 49.2 },
	{ lugar: 'Alberta', x: 78.3, y: 36.1 },
	{ lugar: 'Comodo', x: 12.4, y: 51.9 },
	{ lugar: 'Glast Heim', x: 15.3, y: 37.5 },
	{ lugar: 'Niflheim', x: 13.5, y: 27.5 },
	{ lugar: 'Vulcao de Thor', x: 23.9, y: 45.4 },
	{ lugar: 'Caverna de Payon', x: 85.6, y: 45.4 },
	{ lugar: 'Caverna de Byalan', x: 91.8, y: 53.5 },
	// O norte: Schwartzvald e a cordilheira
	{ lugar: 'Juno', x: 63.5, y: 17.9 },
	{ lugar: 'Einbroch', x: 32.3, y: 17.9 },
	{ lugar: 'Einbech', x: 27.3, y: 10.5 },
	{ lugar: 'Floresta de Bifrost', x: 44.5, y: 6.8 },
	{ lugar: 'El Dicastes', x: 64.6, y: 8.5 },
	{ lugar: 'Veins', x: 78.5, y: 16.0 },
	{ lugar: 'Mora', x: 6.5, y: 38.1 },
	// As ilhas do nordeste, de nivel alto
	{ lugar: 'Torre de Thanatos', x: 85.5, y: 5.6 },
	{ lugar: 'Lago do Abismo', x: 90.0, y: 11.9 },
	{ lugar: 'Juperos', x: 91.3, y: 17.6 },
	{ lugar: 'Santuario de Odin', x: 91.3, y: 29.6 },
	// O oriente e o sul
	{ lugar: 'Ayothaya', x: 58.2, y: 62.2 },
	{ lugar: 'Kunlun', x: 74.9, y: 62.1 },
	{ lugar: 'Louyang', x: 69.6, y: 66.9 },
	{ lugar: 'Amatsu', x: 91.1, y: 84.6 },
	{ lugar: 'Dewata', x: 78.8, y: 79.7 },
	{ lugar: 'Ilha da Tartaruga', x: 91.5, y: 69.9 },
	{ lugar: 'Splendide', x: 7.8, y: 67.3 },
	{ lugar: 'Manuk', x: 48.8, y: 71.4 },
	{ lugar: 'Malangdo', x: 13.0, y: 81.0 },
	{ lugar: 'Brasilis', x: 31.0, y: 84.6 },
	{ lugar: 'Eclage', x: 65.1, y: 86.8 },
	{ lugar: 'Acampamento de Midgard', x: 49.2, y: 89.1 }
];

/**
 * ONDE CADA CAPITULO POUSA NO MAPA, dito a mao.
 *
 * O `pinosDosCapitulos` sabia achar o lugar pelo NOME do capitulo, e isso
 * cobria pouco: medido no mapa antigo, 3 capitulos de 22 ganhavam pino. As
 * falhas nao eram ambiguidade de verdade - eram grafia. "Aldebaran" nao casa
 * "Al De Baran"; "Hugel e o Lago Abismo" nao casa "Lago do Abismo";
 * "Schwartzvald" nao casa nada, porque no mapa quem aparece e a capital dela,
 * Juno.
 *
 * Declarar resolve sem afrouxar a regra do cabecalho: continua proibido
 * ADIVINHAR o lugar, so que agora quem decide e uma linha escrita, e nao uma
 * semelhanca de texto. Capitulo fora desta tabela cai na busca por nome, e
 * quem nao casar nem ali segue sem pino, vivendo na lista.
 *
 * O capitulo dos CHEFES fica fora de proposito: ele nao e um lugar, e o
 * conselho que acontece no fim da jornada inteira.
 */
export const LUGAR_DO_CAPITULO = {
	'cap-01-prontera': 'Prontera',
	'cap-02-geffen': 'Geffen',
	'cap-03-payon': 'Payon',
	// Mjolnir e a cordilheira ao norte de Prontera; o rotulo mais perto dela
	// no mapa novo e Al De Baran, e o capitulo 17 ja e o dono desse pino.
	// Sem lugar proprio, entao: fica na lista.
	'cap-05-morroc': 'Morroc',
	'cap-06-ayothaya': 'Ayothaya',
	'cap-07-comodo': 'Comodo',
	'cap-09-alberta': 'Alberta',
	'cap-11-louyang': 'Louyang',
	// A capital de Schwartzvald e Juno - e e ela que o mapa rotula.
	'cap-12-schwartzvald': 'Juno',
	'cap-13-dewata': 'Dewata',
	// Rachel nao esta no mapa; Veins e a vizinha dela na mesma regiao.
	'cap-15-rachel': 'Veins',
	'cap-16-kunlun': 'Kunlun',
	'cap-17-aldebaran': 'Al De Baran',
	'cap-18-hugel': 'Lago do Abismo',
	'cap-19-glastheim': 'Glast Heim',
	'cap-20-malangdo': 'Malangdo',
	'cap-21-amatsu': 'Amatsu'
};

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
	const porLugar = {};
	for (const p of pontos) {
		porLugar[p.chave] = p.ponto;
	}

	/** id -> ponto, ja resolvido o empate por especificidade. */
	const escolha = {};
	for (const cap of lista) {
		if (!cap || typeof cap.id !== 'string') {
			continue;
		}
		/*
		 * A AMARRACAO DECLARADA VEM PRIMEIRO, e ela existe porque a busca por
		 * NOME errava por um fio em capitulo que tem lugar obvio no mapa:
		 * "Aldebaran" contra o rotulo "Al De Baran", "Lago Abismo" contra
		 * "Lago do Abismo", "Schwartzvald" contra a capital dela, que e Juno.
		 * Medido antes de existir: 3 capitulos com pino, de 22.
		 *
		 * Ela NAO afrouxa a regra do cabecalho - continua sendo proibido
		 * adivinhar. O que muda e quem decide: aqui esta escrito a mao, uma
		 * linha por capitulo, em vez de inferido por semelhanca.
		 */
		const declarado = porLugar[normalizarNome(LUGAR_DO_CAPITULO[cap.id] || '')];
		if (declarado) {
			escolha[cap.id] = declarado;
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
