/**
 * UI/aberturaNaPilha.js
 *
 * O AVISO DE ABERTURA PARA A PILHA DE JANELAS (a tarefa 25 do dono, D-1361).
 *
 * As janelas que ENTRAM E SAEM do DOM — a loja de cash, a loja de NPC — nao
 * usam `toggle()`, e o embrulho que a pilha poe no `toggle()` nao as ve abrir.
 * Quem avisa e o `onAppend` delas, embrulhado aqui.
 *
 * UMA VEZ por componente: o registro da pilha roda a cada mapa carregado
 * (`MapRenderer.onLoad`, no `MapEngine`), e o embrulho que estava escrito la
 * se aninhava — cada troca de mapa somava uma chamada de `aoAbrir`, e cada uma
 * empilha uma entrada no historico do voltar do Android.
 */

/**
 * Embrulha o `onAppend` de `componente` para chamar `aoAbrir` depois dele.
 * Devolve se embrulhou (false: ja estava embrulhado, ou nao ha componente).
 */
export function avisarAoAbrir(componente, aoAbrir) {
	if (!componente || componente.__avisaAPilhaAoAbrir) {
		return false;
	}
	const original = componente.onAppend;
	componente.onAppend = function onAppendComAviso(...args) {
		const r = original ? original.apply(this, args) : undefined;
		aoAbrir();
		return r;
	};
	componente.__avisaAPilhaAoAbrir = true;
	return true;
}
