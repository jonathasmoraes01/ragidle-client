/**
 * UI/Components/Escape/instalarNoSistema.js — "INSTALAR O JOGO" NAS
 * CONFIGURACOES (16/10/2026).
 *
 * O relato de producao: *"PWA nao esta funcionando, nao tem mais a opcao para
 * instalar o aplicativo"*. O pedido original do dono (D-933) foi *"botao
 * Instalar proprio dentro de Configuracoes"*, e a linha morava na aba de Config
 * da janela Idle (`.ic-instalar`). O Bot novo (df1636c9, 07/10/2026) retirou a
 * janela Idle inteira e a linha foi junto, sem substituta: no computador nao
 * sobrou NENHUM lugar dentro do jogo que oferecesse a instalacao, e no celular
 * so a linha do pe do leque (que nao e onde o jogador procura).
 *
 * A porta volta para as Configuracoes de hoje, a janela `Escape` (a mesma que
 * o ESC, o item "Configuracoes" do menu e o "Config." do trilho da HUD premium
 * abrem). Uma porta so para o computador, o celular e a premium.
 *
 * A DECISAO NAO MORA AQUI: e toda de `UI/ofertaDeInstalacao.js` (as tres
 * saidas prompt / instrucao / nada). Este arquivo so desenha, do mesmo jeito
 * que a tela de entrada e a linha do menu ja fazem. Ele vive fora do
 * `Escape.js` porque aquele importa o Renderer e as janelas de opcao, e o
 * teste precisa montar o botao sem WebGL.
 */
import { escutarACasca, ofertaAtual, pontePWA, textoDoResultado } from 'UI/ofertaDeInstalacao.js';

/** A raiz viva da janela, para a escuta da casca saber quem redesenhar. */
let _raizViva = null;
let _desligarEscuta = null;

/**
 * Liga o botao e a escuta da casca. Idempotente por raiz: o `init` do
 * componente pode rodar de novo depois de um `remove`.
 *
 * @param {Element} root A raiz do componente (`.ui-component-root`).
 */
export function ligarInstalarNoSistema(root) {
	_raizViva = root;
	const botao = root && root.querySelector('.instalar');
	if (!botao) {
		return;
	}
	if (!botao.__instalarLigado) {
		botao.__instalarLigado = true;
		botao.addEventListener('click', function (evento) {
			evento.stopPropagation();
			aoClicar(root);
		});
	}
	/* A oferta do navegador chega DEPOIS de a janela existir (ela depende de
	   heuristica de engajamento), e o jogador pode instalar com a janela
	   aberta. Sem escutar, o botao ficaria com a resposta da montagem. */
	if (!_desligarEscuta) {
		_desligarEscuta = escutarACasca(function () {
			sincronizarInstalarNoSistema(_raizViva);
		});
	}
	sincronizarInstalarNoSistema(root);
}

/**
 * Poe o botao no estado que `decidirOferta()` manda, ou o esconde.
 *
 * @param {Element} root
 */
export function sincronizarInstalarNoSistema(root) {
	const botao = root && root.querySelector('.instalar');
	if (!botao) {
		return;
	}
	const dica = root.querySelector('.instalar-dica');
	const oferta = ofertaAtual();
	botao.hidden = !oferta.mostrar;
	if (!oferta.mostrar) {
		if (dica) dica.hidden = true;
		return;
	}
	botao.textContent = oferta.modo === 'prompt' ? 'Instalar o jogo' : 'Como instalar o jogo';
	botao.classList.toggle('is-instrucao', oferta.modo === 'instrucao');
	if (dica) {
		dica.textContent = oferta.dica;
	}
}

/** O clique: dispara a instalacao real, ou abre e fecha o passo a passo. */
function aoClicar(root) {
	const oferta = ofertaAtual();
	const dica = root.querySelector('.instalar-dica');

	if (oferta.modo !== 'prompt') {
		/* Sem evento do navegador nao ha o que disparar, e o botao nao fica
		   morto: ele mostra como instalar neste aparelho. */
		if (dica) {
			dica.textContent = oferta.dica;
			dica.hidden = !dica.hidden;
		}
		return;
	}

	const ponte = pontePWA();
	if (!ponte) {
		return;
	}
	Promise.resolve(ponte.instalar()).then(function (resultado) {
		/* Sincroniza ANTES de escrever a resposta: a ordem inversa apagaria o
		   texto que acabou de ser posto (a cicatriz da tela de entrada, D-945). */
		sincronizarInstalarNoSistema(root);
		if (dica) {
			dica.hidden = false;
			dica.textContent = textoDoResultado(resultado);
		}
	});
}
