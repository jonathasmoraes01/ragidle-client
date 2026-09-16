/**
 * A RESPOSTA DO COMANDO NA ABA DE QUEM DIGITOU (D-1364) — a proposta 1 da
 * tarefa 20 do dono: "a resposta do comando aparece na aba em que ele digitou".
 *
 * A fala do sistema vai ao canal Logs (D-782), e ate aqui a resposta de comando
 * ia junto: quem digitava `@where` no Global tinha de trocar de aba para ler o
 * que o servidor respondeu. O servidor passou a mandar a resposta por um opcode
 * PROPRIO (`0x0fc6`) — o roteamento do ChatBox e estrutural e nunca le o texto —,
 * e esta regra escolhe a aba: a do ultimo comando digitado, se ela existe e
 * aceita digitacao; senao, o Logs de sempre. O aviso ao ALVO de um `#comando`
 * nao passa por aqui: ele nao digitou nada, e continua no Logs.
 *
 * @param {string|null} canalDoComando - a aba em que o ultimo comando foi digitado
 * @param {readonly string[]} canais - os canais que existem
 * @param {readonly string[]} canaisSemDigitacao - os que nao aceitam digitacao
 * @returns {string} o canal em que a resposta aparece
 */
export function canalDaRespostaDeComando(canalDoComando, canais, canaisSemDigitacao) {
	if (typeof canalDoComando !== 'string') return 'logs';
	if (!canais.includes(canalDoComando)) return 'logs';
	if (canaisSemDigitacao.includes(canalDoComando)) return 'logs';
	return canalDoComando;
}
