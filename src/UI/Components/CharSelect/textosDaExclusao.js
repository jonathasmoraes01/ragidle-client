/**
 * UI/Components/CharSelect/textosDaExclusao.js
 *
 * OS TEXTOS DA EXCLUSAO DE PERSONAGEM (D-1945, 03/10/2026), num lugar so: os
 * avisos que o `CharEngine` mostra antes de reservar e de confirmar, e as
 * respostas do servidor que o `CharSelectCommon` mostra. Eram as mensagens
 * 19, 1815, 1817-1822 e 3349 do GRF, que chegavam em ingles ou como "NO MSG".
 * Em portugues no codigo; o ingles sai do catalogo (`Core/Traducao.js`).
 *
 * @author RagIdle
 */

export const TEXTOS_DA_EXCLUSAO = Object.freeze({
	reserva:
		'Excluir este personagem? Ele ficará travado por 24 horas: nesse tempo não entra no jogo, e você pode cancelar. ' +
		'Depois das 24 horas, use "Confirmar exclusão".',
	confirmacao: 'Excluir este personagem agora? Ele sai da sua lista, com tudo o que carrega.',
	segundaConfirmacao: 'Tem certeza? Esta exclusão não pode ser desfeita por você.',
	guilda: 'Para excluir este personagem, saia da guilda primeiro.',
	grupo: 'Para excluir este personagem, saia do grupo primeiro.',
	falhou: 'Não foi possível excluir o personagem.',
	preso: 'Não foi possível excluir agora: o personagem não pode estar em grupo, em guilda nem conectado no jogo.',
	erro: 'Erro ao excluir o personagem. Tente de novo.',
	cedo: 'Ainda não passaram as 24 horas: espere o contador zerar para confirmar a exclusão.',
	codigo: 'A confirmação não confere. Feche e tente de novo.',
	/*
	 * So o ROTULO: o contador e "Exclusao em 23:59:58", e o tradutor acha o
	 * pedaco com letras entre os numeros (os SEGMENTOS de `traduzir`). Um modelo
	 * "Exclusao em %d:%d:%d" nunca bateria com o texto que vai a tela.
	 */
	contador: 'Exclusão em'
});

/** "Exclusao em HH:MM:SS" — nunca negativo (o prazo vencido mostra 00:00:00). */
export function textoDoContador(segundos) {
	const s = Math.max(0, Math.floor(segundos));
	const dois = n => String(n).padStart(2, '0');
	return `${TEXTOS_DA_EXCLUSAO.contador} ${dois(Math.floor(s / 3600))}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
}
