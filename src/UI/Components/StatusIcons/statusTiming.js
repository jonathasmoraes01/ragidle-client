/**
 * Normaliza as duas familias de pacote de status usadas pelo cliente.
 * ZC_MSG_STATE_CHANGE traz `state`; ZC_EFST_SET_ENTER/ENTER2 omite o campo
 * porque o proprio pacote ja significa "ativo".
 */
export function isStatusActive(state) {
	return state == null ? true : Boolean(state);
}

/**
 * Buff ativo sem duracao e permanente. O valor 9999 e o sentinela legado
 * que o cliente oficial tambem trata como infinito.
 */
export function getStatusEnd(start, life) {
	const duration = Number(life);
	if (!Number.isFinite(duration) || duration <= 0 || duration === 9999) {
		return Infinity;
	}
	return start + duration;
}

/**
 * Calcula quantos icones cabem a partir da posicao REAL do host. Isso evita
 * reutilizar o top antigo do componente depois que a HUD muda de lugar.
 */
export function getStatusIconsPerColumn(viewportHeight, hostTop, bottomGap = 16) {
	const availableHeight = Math.max(36, viewportHeight - hostTop - bottomGap);
	return Math.max(1, Math.floor(availableHeight / 36));
}

/**
 * Nome legivel para um EFST sem descricao carregada do GRF.
 */
export function getStatusLabel(statusConstants, index) {
	const key = Object.keys(statusConstants).find(name => statusConstants[name] === Number(index));
	if (!key || key === 'MAX') {
		return `Status ${index}`;
	}
	return key
		.toLowerCase()
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
