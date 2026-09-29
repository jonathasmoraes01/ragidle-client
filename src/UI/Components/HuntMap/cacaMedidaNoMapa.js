/**
 * UI/Components/HuntMap/cacaMedidaNoMapa.js
 *
 * A CACA MEDIDA DENTRO DO MAPA DE CACA (v2, 29/09/2026) — a metade PURA.
 *
 * Contrato: `docs/CONTRATO-CACA-MEDIDA.md` (repositorio do servidor), secoes
 * 7 a 10. Decisao do dono de 29/09/2026: a medicao da caca real vai para
 * DENTRO do Mapa de Caca, sem tirar nada da tela de hoje, e a janela separada
 * "Seus mapas" (§5) sai. O que era puro nela (`formatoDaCacaMedida.js`: o
 * numero em pt-BR, o texto de cada candidato do Explorar) mora aqui agora.
 *
 * Nada aqui toca DOM, rede ou relogio: e o que deixa o teste rodar as
 * decisoes de verdade.
 *
 * ## O que este arquivo NAO faz
 *
 * Ele nao calcula taxa nem risco. EXP/h, zeny/h, pocoes/h, mortes, os golpes
 * que o jogador aguenta e a LETRA do selo chegam PRONTOS do servidor, que e
 * quem mediu a caca e quem roda a formula de dano da luta. Refazer qualquer
 * conta aqui seria a segunda rota escrita a mao — o defeito mais repetido
 * deste projeto. Em particular, a regra "morreu naquele mapa, nunca e Seguro"
 * (§8) ja vem aplicada na letra: o cliente so a le.
 *
 * ## A regra do visual: AUSENTE = A TELA DE HOJE
 *
 * O bloco so chega para quem tem a funcionalidade ligada (hoje, o
 * administrador). Toda funcao de HTML daqui devolve `''` quando nao ha o que
 * mostrar, e o cartao de quem nao tem o bloco sai byte a byte igual ao de
 * antes (portao: `tests/ui/cacaMedidaNoMapa.test.js`, contra o HTML gravado
 * do codigo de 28/09).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** A versao do bloco `cacaMedida` que este cliente entende (secao 9). */
export const VERSAO_DO_BLOCO = 2;

/** "Medido" = pelo menos isto de caca viva no mapa (contrato, secao 1). */
export const MINUTOS_PARA_MEDIR = 10;

/** Os limites de golpes da secao v2, se o servidor nao mandar os dele. */
export const LIMITES_PADRAO = Object.freeze({ seguro: 7, cuidado: 4 });

/**
 * Enquanto o Explorar corre e a janela esta ABERTA, o cliente pede o estado a
 * cada 30 s: o servidor so empurra o `0x0fb5` quando o ESTADO muda (candidato
 * novo, medido, arriscado), e o "6 de 10 min" da faixa ficaria parado entre
 * uma mudanca e outra. Com a janela fechada, ou sem Explorar em curso, nada.
 */
export const INTERVALO_DO_PEDIDO_MS = 30000;

/** As duas ordens novas do seletor "Ordem" e o campo que cada uma le. */
export const ORDEM_DA_MEDIDA = Object.freeze({
	'exp-medida': 'expBasePorHora',
	'zeny-medida': 'zenyPorHora'
});

/** O rotulo de cada ordem nova, como aparece no `<select>`. */
export const ROTULO_DA_ORDEM = Object.freeze({
	'exp-medida': 'Sua EXP/h',
	'zeny-medida': 'Seu zeny/h'
});

const SELO_DA_LETRA = Object.freeze({
	s: { chave: 'seguro', rotulo: 'Seguro' },
	c: { chave: 'cuidado', rotulo: 'Cuidado' },
	a: { chave: 'arriscado', rotulo: 'Arriscado' }
});

const ESTADOS_DO_EXPLORAR = new Set(['parado', 'explorando', 'concluido']);
const ESTADOS_DO_CANDIDATO = new Set(['esperando', 'medindo', 'medido', 'arriscado']);

function escapeHtml(valor) {
	return String(valor == null ? '' : valor)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function numeroOuZero(valor) {
	const n = Number(valor);
	return Number.isFinite(n) ? n : 0;
}

function ehObjeto(valor) {
	return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}

/** Numero com ponto de milhar ("16.293"); ausente vira travessao. */
export function formatarNumero(valor) {
	if (valor === null || valor === undefined || valor === '') {
		return '—';
	}
	const n = Number(valor);
	if (!Number.isFinite(n)) {
		return '—';
	}
	/*
	 * A mao, e nao `toLocaleString('pt-BR')`: o resultado dele depende do ICU
	 * de cada navegador (o Node sem ICU completo devolve "16,293"), e o numero
	 * que o jogador le nao pode mudar de forma entre aparelhos.
	 */
	const sinal = n < 0 ? '-' : '';
	const inteiro = String(Math.round(Math.abs(n)));
	let saida = '';
	for (let i = 0; i < inteiro.length; i++) {
		if (i > 0 && (inteiro.length - i) % 3 === 0) {
			saida += '.';
		}
		saida += inteiro[i];
	}
	return sinal + saida;
}

/** O `explorar` legivel, ou o "parado" — que so faz o jogador poder pedir. */
function lerExplorar(bruto) {
	if (!ehObjeto(bruto) || !ESTADOS_DO_EXPLORAR.has(bruto.estado)) {
		return { estado: 'parado' };
	}
	const candidatos = Array.isArray(bruto.candidatos)
		? bruto.candidatos.filter(c => ehObjeto(c) && typeof c.mapa === 'string' && c.mapa)
		: [];
	return {
		estado: bruto.estado,
		candidatos,
		indice: Number.isInteger(bruto.indice) ? bruto.indice : -1,
		escolhido: typeof bruto.escolhido === 'string' && bruto.escolhido ? bruto.escolhido : null
	};
}

/** So as entradas de medida que tem mapa e numero; o resto some. */
function lerMedida(bruto) {
	const medida = {};
	if (!ehObjeto(bruto)) {
		return medida;
	}
	for (const [mapa, entrada] of Object.entries(bruto)) {
		if (ehObjeto(entrada)) {
			medida[mapa] = entrada;
		}
	}
	return medida;
}

/**
 * O `risco`: `null` quer dizer "a conta ainda nao terminou" (secao 9) e e
 * DIFERENTE de `{}` ("terminou e nao ha mapa com risco"). Entrada ilegivel
 * some da tabela — o cartao dela fica sem selo, como o de hoje.
 */
function lerRisco(bruto) {
	if (!ehObjeto(bruto)) {
		return null;
	}
	const risco = {};
	for (const [mapa, entrada] of Object.entries(bruto)) {
		if (Array.isArray(entrada) && Number.isFinite(Number(entrada[0])) && SELO_DA_LETRA[entrada[1]]) {
			risco[mapa] = entrada;
		}
	}
	return risco;
}

function lerLimites(bruto) {
	if (!ehObjeto(bruto)) {
		return LIMITES_PADRAO;
	}
	const seguro = Number(bruto.seguro);
	const cuidado = Number(bruto.cuidado);
	return {
		seguro: Number.isFinite(seguro) ? seguro : LIMITES_PADRAO.seguro,
		cuidado: Number.isFinite(cuidado) ? cuidado : LIMITES_PADRAO.cuidado
	};
}

/**
 * Le o bloco `cacaMedida` do CABECALHO do catalogo (`0x0ff1`, secao 9).
 *
 * TOLERANTE de proposito: ausente, de outra versao ou ilegivel devolve `null`,
 * e `null` e a tela de hoje — sem filtro novo, sem ordem nova, sem Explorar.
 * Um servidor que ainda nao manda o bloco nao pode quebrar a janela.
 *
 * @param {*} bruto  `catalogo.cacaMedida`
 * @returns {null|{limites, medida, risco, explorar}}
 */
export function lerBlocoDaCacaMedida(bruto) {
	if (!ehObjeto(bruto) || bruto.v !== VERSAO_DO_BLOCO) {
		return null;
	}
	return {
		limites: lerLimites(bruto.limites),
		medida: lerMedida(bruto.medida),
		risco: lerRisco(bruto.risco),
		explorar: lerExplorar(bruto.explorar)
	};
}

/**
 * Le o `0x0fb5` (o Explorar e o risco que ficou pronto, secoes 4 e 9).
 *
 * So entram no resultado os campos que o pacote TRAZ: um `0x0fb5` do Explorar
 * nao traz `risco`, e isso nao pode apagar o risco que o catalogo mandou. A
 * versao nao e conferida por igualdade — o pacote nasceu v1 (a janela antiga)
 * e a v2 o reaproveita; o que se confere e a FORMA de cada campo.
 *
 * `abrir` (o `@cacamedida`) vale para `true` e para `'mapa-de-caca'`: a frente
 * do servidor define o sinal exato, e os dois querem dizer "abra o Mapa de
 * Caca na aba Seus mapas".
 *
 * @param {string} json
 * @returns {null|object}
 */
export function lerPacoteDaCacaMedida(json) {
	let dados;
	try {
		dados = JSON.parse(json);
	} catch (_erro) {
		return null;
	}
	if (!ehObjeto(dados)) {
		return null;
	}
	const pacote = { abrir: dados.abrir === true || dados.abrir === 'mapa-de-caca' };
	if (dados.resultado && typeof dados.resultado === 'object' && typeof dados.resultado.texto === 'string') {
		pacote.resultado = { ok: dados.resultado.ok === true, texto: dados.resultado.texto };
	}
	/*
	 * O BLOCO v2 DENTRO DO PACOTE. O servidor manda o `0x0fb5` da v1 (mapas,
	 * explorar) com o MESMO bloco do cabecalho do catalogo aninhado em
	 * `cacaMedida` (`comBlocoNoPayload`, servidor). Quando ele vem, e ele que
	 * vale — inteiro, com o risco (pronto ou `null`), a medida e o Explorar. O
	 * `mapas` da v1 nao e lido: a medida do bloco e a mesma, na forma do
	 * catalogo.
	 */
	const bloco = lerBlocoDaCacaMedida(dados.cacaMedida);
	if (bloco) {
		pacote.explorar = bloco.explorar;
		pacote.risco = bloco.risco;
		pacote.medida = bloco.medida;
		pacote.limites = bloco.limites;
		return pacote;
	}
	if ('explorar' in dados) {
		pacote.explorar = lerExplorar(dados.explorar);
	}
	if ('risco' in dados) {
		pacote.risco = lerRisco(dados.risco);
	}
	if (ehObjeto(dados.medida)) {
		pacote.medida = lerMedida(dados.medida);
	}
	if (ehObjeto(dados.limites)) {
		pacote.limites = lerLimites(dados.limites);
	}
	return pacote;
}

/**
 * O bloco depois de um `0x0fb5`: o que o pacote trouxe substitui, o resto
 * fica. Sem bloco anterior (o catalogo ainda nao chegou) nasce um bloco so
 * com o que o pacote trouxe — o Explorar funciona antes do catalogo.
 */
export function fundirPacote(bloco, pacote) {
	const base = bloco || { limites: LIMITES_PADRAO, medida: {}, risco: null, explorar: { estado: 'parado' } };
	return {
		limites: pacote.limites || base.limites,
		medida: pacote.medida || base.medida,
		risco: 'risco' in pacote ? pacote.risco : base.risco,
		explorar: pacote.explorar || base.explorar
	};
}

/** A entrada de medida de um mapa, ou `null`. */
export function medidaDoMapa(bloco, mapa) {
	return (bloco && bloco.medida && bloco.medida[mapa]) || null;
}

/** "Seus mapas" = os mapas com a caca MEDIDA (pelo menos 10 minutos). */
export function ehMapaMedido(bloco, mapa) {
	const entrada = medidaDoMapa(bloco, mapa);
	return !!(entrada && entrada.medido === true);
}

/**
 * O selo de GOLPES de um mapa (secao 8): a letra que o servidor mandou e os
 * golpes. `null` sem risco daquele mapa.
 *
 * A marca "usa habilidade" SAIU em 29/09/2026 (decisao do dono, D-1730): ela
 * acendia em 185 de 189 mapas, e aviso que aparece em tudo o jogador para de
 * ler. Um servidor antigo ainda manda o terceiro valor da tupla; ele e ignorado.
 */
export function seloDoRisco(bloco, mapa) {
	const entrada = bloco && bloco.risco ? bloco.risco[mapa] : null;
	if (!entrada) {
		return null;
	}
	const selo = SELO_DA_LETRA[entrada[1]];
	if (!selo) {
		return null;
	}
	return {
		chave: selo.chave,
		rotulo: selo.rotulo,
		golpes: Math.max(0, Math.floor(numeroOuZero(entrada[0])))
	};
}

/** "Aguenta ~9 golpes", "Aguenta ~1 golpe". */
export function textoDosGolpes(golpes) {
	return `Aguenta ~${golpes} ${golpes === 1 ? 'golpe' : 'golpes'}`;
}

/**
 * A ORDEM "Sua EXP/h" / "Seu zeny/h": os mapas MEDIDOS primeiro, do maior
 * para o menor; os outros depois, na ordem em que chegaram (quem chama ja os
 * ordenou por nivel). `Array.prototype.sort` e estavel desde o ES2019, entao
 * o empate e os nao medidos nao trocam de lugar sozinhos.
 */
export function ordenarPorMedida(mapas, bloco, chave) {
	const campo = ORDEM_DA_MEDIDA[chave];
	if (!campo) {
		return mapas;
	}
	const valor = m => (ehMapaMedido(bloco, m.mapa) ? numeroOuZero(bloco.medida[m.mapa][campo]) : null);
	return mapas.slice().sort((a, b) => {
		const va = valor(a);
		const vb = valor(b);
		if (va === null || vb === null) {
			return (va === null ? 1 : 0) - (vb === null ? 1 : 0);
		}
		return vb - va;
	});
}

/** O estado de um mapa dentro do Explorar, ou `null` se ele nao e candidato. */
export function candidatoDoMapa(explorar, mapa) {
	if (!explorar || explorar.estado === 'parado' || !Array.isArray(explorar.candidatos)) {
		return null;
	}
	const i = explorar.candidatos.findIndex(c => c.mapa === mapa);
	if (i < 0) {
		return null;
	}
	const c = explorar.candidatos[i];
	const estado = ESTADOS_DO_CANDIDATO.has(c.estado) ? c.estado : 'esperando';
	const escolhido = explorar.estado === 'concluido' && explorar.escolhido === mapa;
	let texto;
	if (escolhido) {
		texto = 'Você ficou aqui';
	} else if (estado === 'medindo') {
		texto = 'caçando agora';
	} else if (estado === 'medido') {
		texto = `sem mortes: ${formatarNumero(c.expBasePorHora)} EXP/h`;
	} else if (estado === 'arriscado') {
		texto = 'morreu aqui';
	} else {
		texto = 'na fila';
	}
	return { estado, texto, escolhido, emCurso: explorar.estado === 'explorando' && i === explorar.indice };
}

/**
 * A LINHA A MAIS do cartao (item 2 do desenho aprovado): o selo do Explorar
 * (se o mapa e candidato), o "▸ Você: X EXP/h · Y z/h" (se o mapa e medido) e
 * o selo de golpes (se ha risco daquele mapa). Sem nada disso, `''` — e o
 * cartao sai igual ao de hoje.
 */
export function htmlDaLinhaDoCartao(bloco, mapa) {
	if (!bloco) {
		return '';
	}
	const partes = [];
	const candidato = candidatoDoMapa(bloco.explorar, mapa);
	if (candidato) {
		partes.push(
			`<span class="hm-exp-selo hm-exp-selo--${candidato.escolhido ? 'escolhido' : candidato.estado}">${escapeHtml(candidato.texto)}</span>`
		);
	}
	if (ehMapaMedido(bloco, mapa)) {
		const m = bloco.medida[mapa];
		const anterior = m.fichaAtual === false;
		partes.push(
			`<span class="hm-voce-caca"${anterior ? ' title="Medido com outro equipamento, atributos ou habilidades."' : ''}>▸ Você: ${formatarNumero(m.expBasePorHora)} EXP/h · ${formatarNumero(m.zenyPorHora)} z/h</span>`
		);
	}
	const selo = seloDoRisco(bloco, mapa);
	if (selo) {
		const titulo = `${textoDosGolpes(selo.golpes)} do pior monstro deste mapa.`;
		partes.push(
			`<span class="hm-risco hm-risco--${selo.chave}" title="${escapeHtml(titulo)}">` +
				`<b>${selo.rotulo}</b> · ${textoDosGolpes(selo.golpes)}</span>`
		);
	}
	return partes.length ? `<div class="hm-card-medida">${partes.join('')}</div>` : '';
}

/** As classes a mais do cartao candidato do Explorar ('' fora dele). */
export function classesDoCandidato(bloco, mapa) {
	const candidato = bloco ? candidatoDoMapa(bloco.explorar, mapa) : null;
	if (!candidato) {
		return '';
	}
	return ' is-candidato' + (candidato.emCurso ? ' is-cacando' : '') + (candidato.escolhido ? ' is-escolhido' : '');
}

/**
 * A linha do quadro "VOCÊ" do dossie (item 3): "Sua caça aqui (32 min):
 * 7.740 EXP/h · 120 poções/h · 0 mortes", ou "medindo 4 de 10 min". `null`
 * sem entrada daquele mapa — o quadro fica como hoje.
 */
export function textoDaCacaNoPainel(bloco, mapa) {
	const m = medidaDoMapa(bloco, mapa);
	if (!m) {
		return null;
	}
	const minutos = Math.max(0, Math.floor(numeroOuZero(m.minutos)));
	if (m.medido !== true) {
		return `Sua caça aqui: medindo ${Math.min(minutos, MINUTOS_PARA_MEDIR)} de ${MINUTOS_PARA_MEDIR} min`;
	}
	const mortes = Math.max(0, Math.round(numeroOuZero(m.mortes)));
	return (
		`Sua caça aqui (${minutos} min${m.fichaAtual === false ? ', ficha anterior' : ''}): ` +
		`${formatarNumero(m.expBasePorHora)} EXP/h · ${formatarNumero(m.pocoesPorHora)} poções/h · ` +
		`${mortes} ${mortes === 1 ? 'morte' : 'mortes'}`
	);
}

/**
 * A FAIXA DO EXPLORAR, acima da lista (item 4). `''` com o Explorar parado.
 *
 * @param {object} explorar
 * @param {function(string): string} rotuloDe  o rotulo do mapa no catalogo
 */
export function htmlDaFaixaDoExplorar(explorar, rotuloDe) {
	if (!explorar || explorar.estado === 'parado') {
		return '';
	}
	const candidatos = explorar.candidatos || [];
	const nome = mapa => {
		const c = candidatos.find(x => x.mapa === mapa);
		return (c && c.rotulo) || (rotuloDe && rotuloDe(mapa)) || mapa;
	};
	if (explorar.estado === 'explorando') {
		const atual = candidatos[explorar.indice];
		let texto = 'Explorando mapas para o seu nível';
		if (atual) {
			const minutos = Math.min(Math.max(0, Math.floor(numeroOuZero(atual.minutos))), MINUTOS_PARA_MEDIR);
			texto =
				`Explorando ${explorar.indice + 1} de ${candidatos.length} — <strong>${escapeHtml(nome(atual.mapa))}</strong>` +
				` · ${minutos} de ${MINUTOS_PARA_MEDIR} min`;
		}
		return (
			`<span class="hm-explorar-texto">${texto}</span>` +
			'<button type="button" class="hm-explorar-cancelar ri-btn ri-btn--sec" data-acao="cancelar">Cancelar</button>'
		);
	}
	const fim = explorar.escolhido
		? `Você ficou em <strong>${escapeHtml(nome(explorar.escolhido))}</strong>, o que deu mais EXP sem morrer.`
		: 'Nenhum mapa passou sem mortes. Você continua onde estava.';
	return (
		`<span class="hm-explorar-texto">${fim}</span>` +
		'<button type="button" class="hm-explorar-dispensar" data-acao="dispensar" aria-label="Fechar aviso" title="Fechar aviso">&times;</button>'
	);
}

/**
 * Os mapas cuja entrada de medida MUDOU de um bloco para o outro (entrou,
 * saiu ou mudou algum numero). E o que deixa o `0x0fb5` de cada 30 s
 * atualizar so os cartoes daqueles mapas, e nao a lista inteira.
 */
export function mapasQueMudaram(antes, depois) {
	const a = antes || {};
	const d = depois || {};
	const mudaram = new Set();
	for (const mapa of new Set(Object.keys(a).concat(Object.keys(d)))) {
		if (JSON.stringify(a[mapa]) !== JSON.stringify(d[mapa])) {
			mudaram.add(mapa);
		}
	}
	return mudaram;
}

/**
 * A mudanca de medida MEXE NA LISTA (quem aparece ou em que ordem)? So quando
 * a ordem e por medida e o numero da ordem mudou, ou quando o filtro e "Seus
 * mapas" e um mapa entrou ou saiu do conjunto medido. Fora disso, o minuto
 * que anda nao reordena nada: basta trocar a linha dos cartoes que mudaram.
 */
export function medidaMexeNaLista(antes, depois, mapas, ordem, soSeus) {
	const campo = ORDEM_DA_MEDIDA[ordem];
	for (const mapa of mapas) {
		const a = (antes && antes[mapa]) || null;
		const d = (depois && depois[mapa]) || null;
		const medidoA = !!(a && a.medido === true);
		const medidoD = !!(d && d.medido === true);
		if (soSeus && medidoA !== medidoD) {
			return true;
		}
		if (campo && (medidoA !== medidoD || (medidoD && a[campo] !== d[campo]))) {
			return true;
		}
	}
	return false;
}
