/**
 * UI/Components/IdleConfig/perfisDaConfig.js
 *
 * As regras SEM DOM dos PERFIS da config idle (Fase V2, 29/09/2026): salvar o
 * rascunho atual com um nome, carregar um perfil salvo por cima do rascunho,
 * excluir. Nenhum pacote novo — `perfis` é um campo aditivo dentro do MESMO
 * JSON de sempre (CZ_RAGIDLE_APLICAR_CONFIG / ZC_RAGIDLE_CONFIG), e o
 * servidor valida tudo de novo, transacionalmente, no Aplicar
 * (`servidor/idle/config-idle.ts`, `validarConfigIdle`). As regras aqui
 * existem só para a janela dar feedback ANTES do clique — o servidor é quem
 * decide de verdade, como em todo o resto do contrato.
 *
 * Perfil é MEMÓRIA, não comportamento: "Carregar" copia o `config` salvo por
 * cima do rascunho, mas o rascunho SÓ passa a valer quando o jogador aperta
 * Aplicar — a mesma disciplina transacional de qualquer outro campo desta
 * janela. Salvar/excluir também só valem no Aplicar.
 */

/** O MESMO teto do servidor (`servidor/idle/config-idle.ts`, `TETO_DE_PERFIS`). */
export const TETO_DE_PERFIS = 5;

/** O MESMO teto do servidor (`TAMANHO_MAXIMO_DO_NOME_DE_PERFIL`). */
export const TAMANHO_MAXIMO_DO_NOME_DE_PERFIL = 24;

/** A lista de perfis do rascunho — sempre um array, nunca undefined. */
export function perfisDe(config) {
	return config && Array.isArray(config.perfis) ? config.perfis : [];
}

/**
 * O motivo pelo qual "Salvar atual como" não pode salvar `nome` AGORA, ou
 * `null` quando pode. Espelha a validação do servidor (nome de 1 a
 * `TAMANHO_MAXIMO_DO_NOME_DE_PERFIL` caracteres, sem caractere de controle) —
 * mais o teto de `TETO_DE_PERFIS`, que só se aplica quando o nome é NOVO:
 * sobrescrever um perfil existente (mesmo nome, sem diferenciar maiúscula)
 * não gasta vaga nenhuma.
 */
export function motivoParaNaoSalvar(perfis, nome) {
	const limpo = typeof nome === 'string' ? nome.trim() : '';
	if (!limpo) {
		return 'dê um nome ao perfil';
	}
	if (limpo.length > TAMANHO_MAXIMO_DO_NOME_DE_PERFIL) {
		return `nome muito longo (máximo ${TAMANHO_MAXIMO_DO_NOME_DE_PERFIL} caracteres)`;
	}
	// eslint-disable-next-line no-control-regex
	if (/[\x00-\x1f\x7f]/.test(limpo)) {
		return 'nome não pode ter caractere de controle';
	}
	const lista = Array.isArray(perfis) ? perfis : [];
	const existe = lista.some(p => p && typeof p.nome === 'string' && p.nome.toLowerCase() === limpo.toLowerCase());
	if (!existe && lista.length >= TETO_DE_PERFIS) {
		return `máximo de ${TETO_DE_PERFIS} perfis — exclua um para salvar outro`;
	}
	return null;
}

/**
 * O rascunho com o perfil ATUAL salvo sob `nome` — substitui o perfil
 * existente de mesmo nome (sem diferenciar maiúscula/minúscula) ou acrescenta
 * um novo. Devolve `config` INALTERADO (mesma referência) quando
 * `motivoParaNaoSalvar` recusaria — quem chama não precisa checar duas vezes.
 *
 * O snapshot salvo é o `config` ATUAL sem o campo `perfis` (o contrato do
 * servidor exige isso: um perfil não guarda a lista de perfis dentro dele).
 */
export function salvarPerfilComo(config, nome) {
	const limpo = typeof nome === 'string' ? nome.trim() : '';
	const perfis = perfisDe(config);
	if (motivoParaNaoSalvar(perfis, limpo)) {
		return config;
	}
	const semPerfis = Object.assign({}, config);
	delete semPerfis.perfis;
	const chave = limpo.toLowerCase();
	const indice = perfis.findIndex(p => p && typeof p.nome === 'string' && p.nome.toLowerCase() === chave);
	const entrada = { nome: limpo, config: semPerfis };
	const novaLista =
		indice === -1 ? perfis.concat([entrada]) : perfis.map((p, i) => (i === indice ? entrada : p));
	return Object.assign({}, config, { perfis: novaLista });
}

/**
 * O rascunho com o `config` do perfil `nome` copiado por cima — os OUTROS
 * campos do rascunho, inclusive a lista `perfis`, sobrevivem: carregar um
 * perfil não apaga os perfis salvos, e o jogador ainda precisa apertar
 * Aplicar para valer. `null` quando o perfil não existe mais (por exemplo, se
 * sumiu por uma exclusão na mesma sessão antes do clique).
 */
export function carregarPerfil(config, nome) {
	const perfis = perfisDe(config);
	const achado = perfis.find(p => p && p.nome === nome);
	if (!achado || !achado.config || typeof achado.config !== 'object') {
		return null;
	}
	return Object.assign({}, config, achado.config, { perfis });
}

/** O rascunho sem o perfil `nome` (comparação exata — o nome vem da própria lista, nunca digitado). */
export function excluirPerfil(config, nome) {
	const perfis = perfisDe(config);
	return Object.assign({}, config, { perfis: perfis.filter(p => !p || p.nome !== nome) });
}
