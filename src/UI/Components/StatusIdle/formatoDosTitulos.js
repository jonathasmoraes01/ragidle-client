/**
 * O FORMATO DO ZC_RAGIDLE_TITULOS_E_AURA (0x0fb6) - Recompensas do Alfa,
 * 23/09/2026. Contrato: `docs/CONTRATO-ALFA.md` secao 4.3, no repositorio do
 * servidor.
 *
 * Puro de proposito (sem rede, sem DOM, sem DB): a leitura defensiva do JSON
 * e o que decide o que a tela mostra, e ela e testada sozinha em
 * `tests/ui/formatoDosTitulos.test.js`.
 *
 * Regra do projeto: o cliente NAO decide posse. Esta leitura so NORMALIZA o
 * que o servidor mandou; um corpo quebrado vira `null` (a tela fica como
 * estava), nunca uma lista inventada.
 */

/** Estado vazio: sem titulos, sem aura. Tambem o estado da troca de personagem. */
export function estadoVazio() {
	return {
		definicoes: [],
		desbloqueados: [],
		equipado: 0,
		auras: [],
		aurasDesbloqueadas: [],
		auraAtiva: null,
		resultado: null
	};
}

function inteiroPositivo(v) {
	return Number.isInteger(v) && v > 0 ? v : null;
}

function texto(v) {
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * @param {string} json - o corpo do 0x0fb6
 * @returns {object|null} o estado normalizado, ou null se o corpo nao presta
 */
export function lerEstadoDeTitulos(json) {
	let d;
	try {
		d = JSON.parse(json);
	} catch {
		return null;
	}
	if (!d || typeof d !== 'object' || d.v !== 1) {
		return null;
	}

	const estado = estadoVazio();
	const t = d.titulos && typeof d.titulos === 'object' ? d.titulos : {};
	const a = d.auras && typeof d.auras === 'object' ? d.auras : {};

	for (const def of Array.isArray(t.definicoes) ? t.definicoes : []) {
		const id = inteiroPositivo(def && def.id);
		const nome = texto(def && def.nome);
		if (id !== null && nome !== null) {
			estado.definicoes.push({ id, codigo: texto(def.codigo) || '', nome });
		}
	}
	const idsDefinidos = new Set(estado.definicoes.map(x => x.id));

	// So entra na lista o que o servidor DEFINIU: um id desbloqueado sem texto
	// nao tem o que mostrar, e o servidor manda so os titulos ativos.
	for (const id of Array.isArray(t.desbloqueados) ? t.desbloqueados : []) {
		if (idsDefinidos.has(id) && !estado.desbloqueados.includes(id)) {
			estado.desbloqueados.push(id);
		}
	}
	estado.equipado = inteiroPositivo(t.equipado) || 0;

	for (const def of Array.isArray(a.definicoes) ? a.definicoes : []) {
		const codigo = texto(def && def.codigo);
		const nome = texto(def && def.nome);
		if (codigo !== null && nome !== null) {
			estado.auras.push({
				codigo,
				nome,
				efeitoDeChapeu: inteiroPositivo(def.efeitoDeChapeu)
			});
		}
	}
	const codigosDefinidos = new Set(estado.auras.map(x => x.codigo));
	for (const codigo of Array.isArray(a.desbloqueadas) ? a.desbloqueadas : []) {
		if (codigosDefinidos.has(codigo) && !estado.aurasDesbloqueadas.includes(codigo)) {
			estado.aurasDesbloqueadas.push(codigo);
		}
	}
	estado.auraAtiva = codigosDefinidos.has(a.ativa) ? a.ativa : null;

	if (d.resultado && typeof d.resultado === 'object' && typeof d.resultado.ok === 'boolean') {
		estado.resultado = {
			acao: texto(d.resultado.acao) || '?',
			ok: d.resultado.ok,
			motivo: texto(d.resultado.motivo)
		};
	}
	return estado;
}

const MOTIVOS = {
	'nao-possui': 'Sua conta não possui esta aura.',
	'aura-desconhecida': 'Aura desconhecida.',
	'pedido-invalido': 'Pedido inválido.'
};

/** A frase de uma recusa do servidor (resultado.ok === false). */
export function fraseDaRecusa(resultado) {
	if (!resultado || resultado.ok) {
		return '';
	}
	return MOTIVOS[resultado.motivo] || 'O servidor recusou o pedido.';
}
