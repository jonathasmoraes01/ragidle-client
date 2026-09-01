/**
 * UI/Components/IdleSkills/arvoreDeSkills.js
 *
 * ===========================================================================
 * O DESENHO DA ÁRVORE — a parte que é geometria, e não janela
 * ===========================================================================
 *
 * A janela de habilidades virou árvore em 31/08/2026 (pedido do dono, com a
 * print do Ragnarok LATAM como referência). Duas coisas dentro dela são
 * **funções puras** — entra dado, sai dado, sem DOM, sem rede, sem estado de
 * módulo:
 *
 * 1. `montarPlano` — onde cada habilidade fica no plano, e que fio liga o quê.
 * 2. `avaliarSubir` / `avaliarDescer` — se a seta pode ser apertada, e o
 *    motivo quando não.
 *
 * Elas moram aqui, e não em `IdleSkills.js`, porque são as duas únicas peças
 * desta janela que dá para **provar sem subir o jogo inteiro**
 * (`tests/ui/arvoreDeSkills.test.js`). O resto do arquivo original é desenho e
 * pacote, que só a foto e a pilha ao vivo julgam.
 *
 * ---------------------------------------------------------------------------
 * A REGRA DE OURO DO `avaliarSubir`
 * ---------------------------------------------------------------------------
 *
 * Ele é a **segunda rota** de uma regra que já existe no servidor
 * (`avaliarAprendizado`, `game/progressao.ts`), e este projeto tem cicatriz de
 * sobra com segunda rota escrita à mão. Ela existe assim mesmo, e por um motivo
 * que o servidor não pode cobrir: o **rascunho**. Assim que o jogador põe o
 * primeiro ponto com a seta, o estado que decide o segundo ponto ainda não
 * existe em lugar nenhum — nem no servidor, nem no `serverData`. Alguém tem de
 * julgar o "e se", e é aqui.
 *
 * O que a segurança **não** depende disto: nada. O `Aplicar` manda o lote e o
 * servidor reavalia passo a passo com o mesmo `avaliarAprendizado` de sempre, e
 * recusa o lote INTEIRO se qualquer passo não passar. Um erro aqui vira uma
 * seta acesa que devolve recusa em vermelho — chato, nunca inseguro.
 *
 * **A ORDEM DAS RECUSAS É COPIADA DE PROPÓSITO**, e é a do emulador
 * (`pc_check_skilltree`, pc.cpp:2802 + `pc_skillup`, pc.cpp:9152), na ordem
 * documentada em `game/progressao.ts`: árvore → teto → nível base → nível de
 * classe → pré-requisitos → pontos → motor. Duas rotas que recusam pelo mesmo
 * motivo mas em ordem diferente dizem frases diferentes para o mesmo clique, e
 * o jogador conserta a coisa errada.
 */

/*
 * A GEOMETRIA DO NÓ (2ª rodada de design, 31/08/2026 — o dono olhou a
 * primeira e pediu melhor).
 *
 * O que mudou e por quê:
 * - O ladrilho subiu para 56px COM A ARTE EM 48 (24×24 do cliente ampliado
 *   por 2, INTEIRO — regra 4; 54px seria 2,25× e borraria o pixel).
 * - O nome ganhou DUAS linhas: com uma, metade da árvore do Cavaleiro
 *   terminava em reticências ("Rapidez com Duas …").
 * - O nível virou a PLAQUETA da referência LATAM (◀ n/m ▶ numa cápsula
 *   segmentada), e ela pede mais altura.
 *
 * Estes números casam com o CSS (`.is-no*` em IdleSkills.css) — mexer num
 * lado sem o outro desalinha os fios, que são calculados daqui.
 */
/** Largura do nó no plano, em px. */
export const NO_L = 92;
/** Altura do nó no plano, em px. */
export const NO_A = 108;
/** Passo horizontal entre colunas (nó + o vão onde os fios descem). */
export const COL_W = 142;
/** Passo vertical entre linhas. */
export const ROW_H = 122;
/** Respiro em volta do plano inteiro. */
export const PAD = 16;
/**
 * Altura do centro do ÍCONE dentro do nó, medida do topo do nó.
 *
 * É onde os fios encostam. Ela não é `NO_A / 2`: o nó tem ícone em cima, nome
 * e plaqueta embaixo, e um fio que chegasse no meio da caixa cruzaria o nome
 * da habilidade.
 */
export const ANCORA_Y = 28;

/**
 * O nível que a habilidade TEM contando o rascunho.
 *
 * @param {{aprendido:number}} skill
 * @param {Record<string, number>} rascunho  skillId -> níveis somados à mão
 * @returns {number}
 */
export function nivelEfetivo(skill, rascunho) {
	return skill.aprendido + (rascunho[skill.skillId] || 0);
}

/**
 * O nível efetivo de uma habilidade pelo ID, ou 0 quando ela não está na árvore.
 *
 * O `0` é a resposta certa para "não está na árvore": um pré-requisito que a
 * classe não tem é um pré-requisito não cumprido, que é exatamente o que o
 * `nivelAprendido` do servidor devolve para o mesmo caso.
 *
 * @param {Map<string, object>} porId
 * @param {Record<string, number>} rascunho
 * @param {string} skillId
 * @returns {number}
 */
export function nivelEfetivoDe(porId, rascunho, skillId) {
	const skill = porId.get(skillId);
	return skill ? nivelEfetivo(skill, rascunho) : 0;
}

/** Quantos pontos o rascunho já compromete. */
export function pontosNoRascunho(rascunho) {
	let total = 0;
	for (const id in rascunho) {
		total += rascunho[id] || 0;
	}
	return total;
}

/**
 * Pode somar mais um nível nesta habilidade? E, quando não, por quê?
 *
 * Ver a "REGRA DE OURO" no cabeçalho: a ordem das recusas é a do emulador, e
 * mexer nela é mexer na frase que o jogador lê.
 *
 * @param {object} skill        a habilidade do payload
 * @param {object} contexto     { porId, rascunho, pontos, nivelBase, nivelDeJob }
 * @returns {{ok: boolean, motivo: string|null}}
 */
export function avaliarSubir(skill, contexto) {
	const efetivo = nivelEfetivo(skill, contexto.rascunho);

	if (efetivo >= skill.nivelMaximo) {
		return { ok: false, motivo: 'já está no nível máximo (' + skill.nivelMaximo + ')' };
	}
	if (contexto.nivelBase < skill.nivelBaseMinimo) {
		return {
			ok: false,
			motivo:
				'exige nível base ' + skill.nivelBaseMinimo + ' — você está no ' + contexto.nivelBase
		};
	}
	if (contexto.nivelDeJob < skill.nivelClasseMinimo) {
		return {
			ok: false,
			motivo:
				'exige nível de classe ' +
				skill.nivelClasseMinimo +
				' — você está no ' +
				contexto.nivelDeJob
		};
	}
	for (const requisito of skill.preRequisitos) {
		const tem = nivelEfetivoDe(contexto.porId, contexto.rascunho, requisito.skillId);
		if (tem < requisito.nivel) {
			const alvo = contexto.porId.get(requisito.skillId);
			const rotulo = alvo ? alvo.nome : requisito.skillId;
			return {
				ok: false,
				motivo:
					'exige ' +
					rotulo +
					' no nível ' +
					requisito.nivel +
					(tem === 0 ? ', que você não aprendeu' : ', e ela está no ' + tem)
			};
		}
	}
	if (contexto.pontos - pontosNoRascunho(contexto.rascunho) < skill.custo) {
		return { ok: false, motivo: 'não há ponto de habilidade sobrando' };
	}
	/*
	 * A TRANCA DO MOTOR é a última da fila, e a posição é copiada do servidor
	 * (D-442): as recusas acima são regra do Ragnarok, e a divergência DESTE
	 * projeto vem depois delas, nunca na frente.
	 */
	if (!skill.aceitaPeloMotor) {
		return {
			ok: false,
			motivo:
				'o motor de combate ainda não aplica os efeitos desta habilidade — ' +
				'o ponto seria gasto sem mudar nada na luta'
		};
	}
	return { ok: true, motivo: null };
}

/**
 * Pode tirar um nível? E, quando não, por quê?
 *
 * Duas recusas, e as duas dizem coisas diferentes:
 *
 * 1. **Nível já aprendido não volta.** A seta ◀ desfaz RASCUNHO, e só. O
 *    Ragnarok não devolve ponto de habilidade, e uma seta que parecesse desfazer
 *    o que já foi comprado seria a janela prometendo o que o servidor recusa.
 * 2. **Não deixa filho órfão.** Tirar um ponto que outro nó do rascunho está
 *    usando como pré-requisito montaria um lote que o "Aplicar" recusaria
 *    inteiro — e a recusa chegaria falando do FILHO, longe do clique. Melhor
 *    recusar aqui, nomeando quem depende.
 *
 * @returns {{ok: boolean, motivo: string|null}}
 */
export function avaliarDescer(skill, contexto) {
	if ((contexto.rascunho[skill.skillId] || 0) === 0) {
		return {
			ok: false,
			motivo:
				skill.aprendido > 0
					? 'nível já aprendido não volta — o Ragnarok não devolve ponto de habilidade'
					: 'não há ponto no rascunho para tirar'
		};
	}

	const depois = nivelEfetivo(skill, contexto.rascunho) - 1;
	for (const outra of contexto.porId.values()) {
		if ((contexto.rascunho[outra.skillId] || 0) === 0) {
			continue;
		}
		for (const requisito of outra.preRequisitos) {
			if (requisito.skillId === skill.skillId && depois < requisito.nivel) {
				return {
					ok: false,
					motivo: 'tire primeiro os pontos de ' + outra.nome + ', que depende desta'
				};
			}
		}
	}
	return { ok: true, motivo: null };
}

/**
 * A ORDEM DO LOTE que vai no "Aplicar": pai antes de filho.
 *
 * O servidor aplica na ordem que receber e não reordena — reordenar seria ele
 * adivinhando a intenção (ver o comentário do lote em `servidor-mapa.ts`).
 * Então quem ordena é quem sabe: esta função, com uma varredura em profundidade
 * sobre os pré-requisitos que também estão no rascunho.
 *
 * A trava de ciclo existe porque este laço roda no cliente do jogador: o
 * `skill_tree.yml` não tem ciclo, mas um payload adulterado não pode travar a
 * aba do navegador.
 *
 * @returns {{skillId: string, niveis: number}[]}
 */
export function ordemDoLote(porId, rascunho) {
	const pendentes = Object.keys(rascunho).filter(id => (rascunho[id] || 0) > 0);
	const noRascunho = new Set(pendentes);
	const estado = new Map();
	const saida = [];

	function visitar(id) {
		if (estado.get(id) === 'pronto' || estado.get(id) === 'visitando') {
			return;
		}
		estado.set(id, 'visitando');
		const skill = porId.get(id);
		if (skill) {
			for (const requisito of skill.preRequisitos) {
				if (noRascunho.has(requisito.skillId)) {
					visitar(requisito.skillId);
				}
			}
		}
		estado.set(id, 'pronto');
		saida.push(id);
	}

	pendentes.forEach(visitar);
	return saida.map(id => ({ skillId: id, niveis: rascunho[id] }));
}

/**
 * ===========================================================================
 * O PLANO DA ÁRVORE
 * ===========================================================================
 *
 * Entra a lista de habilidades de UM degrau; sai onde cada uma fica e que fios
 * ligam quais.
 *
 * **Coluna = profundidade**, e a profundidade é o caminho MAIS LONGO até uma
 * raiz — não o mais curto. Com o mais curto, um nó que exige uma raiz e também
 * um neto ficaria na coluna 1, à ESQUERDA de um pré-requisito dele, e o fio
 * andaria para trás.
 *
 * **Linha = empacotamento guiado pelos pais.** Cada coluna é ordenada pela
 * média das linhas dos pais (as raízes ficam na ordem da própria árvore, que é
 * a ordem do `skill_tree.yml`), e aí as linhas são distribuídas sem buraco,
 * respeitando a média como piso. É o suficiente para um degrau de árvore de
 * Ragnarok — as maiores têm ~20 nós e 4 colunas — e evita o cruzamento de fios
 * que uma grade em ordem de leitura produziria.
 *
 * **Só liga o que está NO MESMO degrau.** Um pré-requisito de outra aba (o
 * Cavaleiro que exige `SM_BASH` do Espadachim) não vira fio: viraria um fio
 * saindo do vazio. Ele volta como `forasteiros`, que o nó mostra como selo e o
 * painel de detalhe lista por extenso.
 *
 * @param {object[]} skills   as habilidades do degrau, na ordem da árvore
 * @param {Map<string, object>} porId  TODAS as habilidades, para nomear forasteiros
 * @returns {{nos: object[], fios: object[], largura: number, altura: number}}
 */
export function montarPlano(skills, porId) {
	const noDegrau = new Map(skills.map(skill => [skill.skillId, skill]));

	/** Pais DENTRO do degrau. Os de fora saem por `forasteiros`. */
	const paisDe = new Map();
	const forasteirosDe = new Map();
	for (const skill of skills) {
		const dentro = [];
		const fora = [];
		for (const requisito of skill.preRequisitos) {
			(noDegrau.has(requisito.skillId) ? dentro : fora).push(requisito);
		}
		paisDe.set(skill.skillId, dentro);
		forasteirosDe.set(skill.skillId, fora);
	}

	// Profundidade = caminho mais longo. `visitando` corta ciclo (payload torto).
	const profundidade = new Map();
	const visitando = new Set();
	function profundidadeDe(id) {
		if (profundidade.has(id)) {
			return profundidade.get(id);
		}
		if (visitando.has(id)) {
			return 0;
		}
		visitando.add(id);
		let maior = 0;
		for (const requisito of paisDe.get(id) || []) {
			maior = Math.max(maior, profundidadeDe(requisito.skillId) + 1);
		}
		visitando.delete(id);
		profundidade.set(id, maior);
		return maior;
	}
	skills.forEach(skill => profundidadeDe(skill.skillId));

	// Colunas, na ordem da árvore dentro de cada uma.
	const colunas = [];
	skills.forEach((skill, ordem) => {
		const col = profundidade.get(skill.skillId);
		if (!colunas[col]) {
			colunas[col] = [];
		}
		colunas[col].push({ id: skill.skillId, ordem: ordem });
	});

	/*
	 * LINHAS: alinhar com os pais, mas SEM abrir buraco.
	 *
	 * Duas grandezas diferentes saem daqui, e a primeira versao as confundiu — o
	 * plano do Cavaleiro saia com **10 linhas para 10 nos**, quatro delas
	 * inteiramente vazias, e a aba abria mostrando um vazio de 400px antes da
	 * primeira habilidade:
	 *
	 * - `ordem` (o indice na arvore) serve para ORDENAR quem nao tem pai
	 *   colocado. Ela e um numero grande e esparso: as raizes da arvore do
	 *   Cavaleiro estao nos indices 0, 5, 6 e 8.
	 * - o PISO da linha so pode vir dos PAIS. Usar `ordem` como piso escrevia
	 *   aquele 8 direto na linha, e as linhas 1 a 4 nasciam mortas.
	 *
	 * Quem nao tem pai colocado tem piso ZERO e empacota de cima para baixo;
	 * quem tem, desce ate a media dos pais e nao mais que isso.
	 */
	const linhaDe = new Map();
	for (let col = 0; col < colunas.length; col++) {
		const naColuna = colunas[col] || [];
		const pisoDe = new Map();
		const chaveDe = new Map();
		for (const item of naColuna) {
			let soma = 0;
			let quantos = 0;
			for (const requisito of paisDe.get(item.id) || []) {
				if (linhaDe.has(requisito.skillId)) {
					soma += linhaDe.get(requisito.skillId);
					quantos++;
				}
			}
			const temPai = quantos > 0;
			pisoDe.set(item.id, temPai ? soma / quantos : 0);
			chaveDe.set(item.id, temPai ? soma / quantos : item.ordem);
		}
		naColuna.sort((a, b) => chaveDe.get(a.id) - chaveDe.get(b.id) || a.ordem - b.ordem);

		let proxima = 0;
		for (const item of naColuna) {
			const alvo = Math.max(proxima, Math.round(pisoDe.get(item.id)));
			linhaDe.set(item.id, alvo);
			proxima = alvo + 1;
		}
	}

	const nos = skills.map(skill => {
		const col = profundidade.get(skill.skillId);
		const linha = linhaDe.get(skill.skillId);
		return {
			skill: skill,
			coluna: col,
			linha: linha,
			x: PAD + col * COL_W,
			y: PAD + linha * ROW_H,
			forasteiros: (forasteirosDe.get(skill.skillId) || []).map(requisito => ({
				skillId: requisito.skillId,
				nivel: requisito.nivel,
				nome: porId.has(requisito.skillId) ? porId.get(requisito.skillId).nome : requisito.skillId
			}))
		};
	});

	const posicaoDe = new Map(nos.map(no => [no.skill.skillId, no]));
	const fios = [];
	for (const no of nos) {
		for (const requisito of paisDe.get(no.skill.skillId) || []) {
			const pai = posicaoDe.get(requisito.skillId);
			if (!pai) {
				continue;
			}
			fios.push({
				de: pai.skill.skillId,
				para: no.skill.skillId,
				nivel: requisito.nivel,
				x1: pai.x + NO_L,
				y1: pai.y + ANCORA_Y,
				x2: no.x,
				y2: no.y + ANCORA_Y,
				// `xm` sai do espalhamento logo abaixo — o vao entre duas colunas
				// e compartilhado por todos os fios que o atravessam.
				xm: 0
			});
		}
	}

	/*
	 * CADA FIO GANHA A SUA FAIXA NO VAO.
	 *
	 * O cotovelo desce no MEIO do vao entre as colunas. Com um `xm` unico, todo
	 * fio que entra na mesma coluna desce na MESMA vertical — e no print da
	 * arvore do Cavaleiro os fios `Pericia com Lanca -> Perfurar` e
	 * `Montaria -> Pericia em Montaria` viravam **um tronco verde so**,
	 * atravessando a altura inteira da aba. O desenho ficava plausivel e
	 * ilegivel: da para ver que ha ligacao, e nao da para ver de onde para onde.
	 *
	 * A separacao e por coluna de DESTINO, porque e ali que eles se cruzam, e as
	 * faixas sao distribuidas no vao (`COL_W - NO_L`) com folga nas pontas — um
	 * fio colado no icone do pai leria como parte da moldura dele.
	 */
	const vao = COL_W - NO_L;
	const porColunaDeDestino = new Map();
	for (const fio of fios) {
		const destino = posicaoDe.get(fio.para).coluna;
		if (!porColunaDeDestino.has(destino)) {
			porColunaDeDestino.set(destino, []);
		}
		porColunaDeDestino.get(destino).push(fio);
	}
	for (const doVao of porColunaDeDestino.values()) {
		doVao.forEach((fio, i) => {
			/*
			 * A faixa e medida a partir do DESTINO (`x2 - vao`), e nao da saida
			 * do pai. Para fio de coluna vizinha da no mesmo: `x2 - vao === x1`.
			 * A diferenca e o fio de MAIS DE UM VAO (a Barreira Magica do Mago
			 * exige requisito na coluna 0 E na 1): ancorado no pai, a vertical
			 * dele caia no PRIMEIRO vao — junto das faixas de outro grupo, que
			 * sao distribuidas sem saber dele — e o longo trecho horizontal
			 * corria na altura do FILHO, riscando a coluna do meio inteira.
			 * Ancorada no destino, a vertical divide o vao com os fios do
			 * proprio grupo e o trecho longo corre na altura do PAI, passando
			 * por tras dos ladrilhos (os nos pintam por cima do SVG).
			 */
			fio.xm = fio.x2 - vao + Math.round((vao * (i + 1)) / (doVao.length + 1));
		});
	}

	let maiorLinha = 0;
	let maiorColuna = 0;
	for (const no of nos) {
		maiorLinha = Math.max(maiorLinha, no.linha);
		maiorColuna = Math.max(maiorColuna, no.coluna);
	}

	return {
		nos: nos,
		fios: fios,
		largura: PAD * 2 + (maiorColuna + 1) * COL_W,
		altura: PAD * 2 + (maiorLinha + 1) * ROW_H
	};
}
