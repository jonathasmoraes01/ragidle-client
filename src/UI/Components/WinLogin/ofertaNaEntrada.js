/**
 * UI/Components/WinLogin/ofertaNaEntrada.js — A OFERTA DE INSTALAÇÃO NA TELA
 * DE ENTRADA (D-945, 06/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE AQUI, E NÃO SÓ NAS CONFIGURAÇÕES
 * ═══════════════════════════════════════════════════════════════════════
 * O pedido original do dono (D-933) foi *"botão Instalar próprio dentro de
 * Configurações, sem banner intrusivo no meio do jogo"* — e continua valendo
 * palavra por palavra. **A tela de login não é o meio do jogo.** É a única
 * tela que todo mundo vê, inclusive quem abre o link no celular, olha e vai
 * embora sem nunca criar personagem. Era exatamente esse jogador que não
 * tinha como saber que o jogo instala.
 *
 * A regra do "sem banner" é respeitada do jeito que importa: a linha nasce
 * **escondida**, não cobre nada, não tem contagem regressiva, não volta
 * depois de recusada e some para sempre para quem já instalou.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE NO FABRICANTE, E NÃO NO HTML DA V2
 * ═══════════════════════════════════════════════════════════════════════
 * São três telas de login (`WinLogin`, `V2`, `V3`) escolhidas pelo
 * `UIVersionManager` a partir do `packetver`. Produção hoje cai na **V2**
 * (packetver 20211103), mas trocar o número da config mudaria a tela — e uma
 * oferta escrita só no HTML da V2 sumiria em silêncio nessa troca. O
 * fabricante (`WinLoginCommon.js`) é o ponto por onde as três passam.
 *
 * Como o DOM nasce aqui e o CSS de cada versão está no arquivo dela, o estilo
 * vai num `<style>` próprio, injetado no mesmo shadow — que já recebe o
 * `Common.css` do `GUIComponent` (linha 246). Por isso os tokens do design
 * system valem aqui sem nada mais.
 */

import { escutarACasca, ofertaAtual, pontePWA, textoDoResultado } from 'UI/ofertaDeInstalacao.js';

const MARCA = 'data-ri-oferta-instalar';

/* A tela de login viva. O `UIVersionManager` escolhe UMA das três versões por
   sessão, mas guardar o componente (em vez de fechar sobre o primeiro que
   montar) evita que o ouvinte da casca fique sincronizando um root morto se
   algum dia duas versões coexistirem. */
let _telaViva = null;
let _desligarEscuta = null;

/* O glifo: uma seta entrando numa bandeja. Vai como SVG embutido de propósito
   — o sistema de ícones do jogo (`<!--RI_ICONE:x-->`) é substituído no HTML
   em tempo de build, e este nó nasce em tempo de execução. */
const GLIFO =
	'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ' +
	'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<path d="M8 2v7"/><path d="M5 6.5 8 9.5l3-3"/><path d="M2.5 11v1.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V11"/>' +
	'</svg>';

const CSS = `
.wl-instalar {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-3);
	margin-top: var(--sp-5);
	padding-top: var(--sp-5);
	border-top: 1px solid var(--border-window);
}
.wl-instalar[hidden] { display: none; }
.wl-instalar-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--sp-3);
	/* O piso tátil vale para este botão como para qualquer outro: ele nasce
	   num celular tanto quanto num computador (D-935). */
	min-height: var(--hit-touch);
	padding: 0 var(--sp-6);
	border-radius: var(--radius-window);
	border: 1px solid var(--border-window);
	background: rgba(255, 255, 255, 0.88);
	color: var(--text-link);
	font: var(--type-label);
	cursor: pointer;
	transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.wl-instalar-btn:hover { color: var(--text-link-hover); }
/* Instalado: sobra a confirmação, sai o botão. */
.wl-instalar.is-feito .wl-instalar-btn { display: none; }
.wl-instalar-dica {
	margin: 0;
	max-width: 34ch;
	text-align: center;
	font: var(--type-info);
	color: var(--text-muted);
}
.wl-instalar-dica[hidden] { display: none; }
`;

/**
 * Monta a oferta dentro da janela de login. Idempotente: chamar duas vezes
 * não cria duas linhas (o `onAppend` do componente roda a cada aparição).
 *
 * @param {{getRoot: () => Element, _shadow: ShadowRoot|null}} Component
 */
export function montarOfertaNaEntrada(Component) {
	_telaViva = Component;
	const root = Component.getRoot();
	if (!root || root.querySelector('.wl-instalar')) {
		sincronizar(root);
		return;
	}

	/* A âncora é o PAI do botão de entrar — o único elemento que as três
	   versões da tela têm com o mesmo nome. Procurar por uma classe de leiaute
	   (`.wl-body`) acertaria só na V2. */
	const entrar = root.querySelector('.connect');
	const caixa = entrar && entrar.parentNode;
	if (!caixa) {
		return;
	}

	const alvoDoEstilo = Component._shadow || root;
	if (!alvoDoEstilo.querySelector(`style[${MARCA}]`)) {
		const estilo = document.createElement('style');
		estilo.setAttribute(MARCA, '');
		estilo.textContent = CSS;
		alvoDoEstilo.appendChild(estilo);
	}

	const linha = document.createElement('div');
	linha.className = 'wl-instalar';
	linha.hidden = true;

	const botao = document.createElement('button');
	botao.type = 'button';
	botao.className = 'wl-instalar-btn';
	botao.innerHTML = GLIFO + '<span class="wl-instalar-rotulo"></span>';
	botao.setAttribute('aria-expanded', 'false');

	const dica = document.createElement('p');
	dica.className = 'wl-instalar-dica';
	dica.hidden = true;
	/* `status` e não `alert`: a explicação é resposta a um toque do jogador,
	   não um alarme que interrompe o que ele estava fazendo. */
	dica.setAttribute('role', 'status');

	linha.appendChild(botao);
	linha.appendChild(dica);
	caixa.appendChild(linha);

	botao.addEventListener('click', evento => {
		evento.stopImmediatePropagation();
		aoClicar(root);
	});

	/* A oferta do navegador chega DEPOIS de a tela abrir — ela depende de
	   heurística de engajamento. Sem escutar, o jogador que ficou dez segundos
	   digitando o usuário veria a instrução manual em vez do botão que
	   instala de verdade. */
	if (!_desligarEscuta) {
		_desligarEscuta = escutarACasca(() => sincronizar(_telaViva && _telaViva.getRoot()));
	}

	sincronizar(root);
}

/**
 * Põe a linha no estado que o ambiente manda. Separada do monte porque roda
 * de novo a cada `onAppend` e a cada evento da casca.
 *
 * @param {Element|null} root
 */
export function sincronizar(root) {
	const linha = root && root.querySelector('.wl-instalar');
	if (!linha) return;

	/* TRAVA DE FIM DE LINHA: instalou, a linha não volta a oferecer nada.
	   Ela não pode sair de `estaInstalado()` — esse teste lê o `display-mode`,
	   que só muda quando o jogo abre pela janela do app, e não no instante em
	   que o jogador aceita. Sem a trava, o `appinstalled` da casca dispara
	   `ragidle:instalado`, a sincronização roda, não acha prompt nenhum e
	   escreve por cima do "Instalado." a instrução de COMO instalar — para
	   quem acabou de instalar.

	   A marca mora no DOM (`is-feito`), e não numa variável do módulo, porque
	   é da LINHA que ela fala: linha nova (outra tela de login, outro
	   documento) é história nova. */
	const dicaDoFim = linha.querySelector('.wl-instalar-dica');
	if (linha.classList.contains('is-feito')) {
		linha.hidden = false;
		if (dicaDoFim) {
			dicaDoFim.textContent = textoDoResultado('instalado');
			dicaDoFim.hidden = false;
		}
		return;
	}

	const oferta = ofertaAtual();
	linha.hidden = !oferta.mostrar;
	if (!oferta.mostrar) {
		return;
	}

	const rotulo = linha.querySelector('.wl-instalar-rotulo');
	if (rotulo) rotulo.textContent = oferta.rotulo;

	/* Os dois modos mostram o texto em momentos diferentes, e a razão é o
	   espaço vertical do celular:
	   - `prompt`: uma linha curta responde a pergunta que todo mundo faz antes
	     de instalar qualquer coisa (o que isso muda), e ela cabe;
	   - `instrucao`: o texto é um parágrafo de passo a passo. Despejá-lo na
	     tela de entrada de quem só quer digitar a senha seria o banner que o
	     pedido do dono recusou — então ele abre no toque, e o botão deixa de
	     ser decoração para virar o que revela a explicação. */
	const dica = linha.querySelector('.wl-instalar-dica');
	if (!dica) return;
	dica.textContent = oferta.dica;
	dica.hidden = oferta.modo !== 'prompt';

	linha.classList.toggle('is-instrucao', oferta.modo === 'instrucao');
	const botao = linha.querySelector('.wl-instalar-btn');
	if (botao) {
		botao.setAttribute('aria-expanded', String(oferta.modo === 'prompt'));
	}
}

/** O clique: dispara a instalação real, ou reforça a instrução. */
function aoClicar(root) {
	const oferta = ofertaAtual();
	const dica = root && root.querySelector('.wl-instalar-dica');

	if (oferta.modo !== 'prompt') {
		/* Sem evento não há o que disparar, e o botão não fica morto: ele ABRE
		   o passo a passo (e fecha de novo). É a única forma que sobra de o
		   jogador descobrir o caminho no aparelho dele. */
		const botao = root && root.querySelector('.wl-instalar-btn');
		if (dica) {
			dica.textContent = oferta.dica;
			dica.hidden = !dica.hidden;
			if (botao) botao.setAttribute('aria-expanded', String(!dica.hidden));
		}
		return;
	}

	const ponte = pontePWA();
	if (!ponte) return;

	Promise.resolve(ponte.instalar()).then(resultado => {
		const linha = root && root.querySelector('.wl-instalar');
		if (resultado === 'instalado' && linha) {
			linha.classList.add('is-feito');
		}
		/* A ORDEM IMPORTA, e foi a prova que cobrou: sincronizar DEPOIS de
		   escrever apagaria a resposta ("Instalado.", "Tudo bem — dá para
		   instalar depois") e poria no lugar o texto genérico da oferta. O
		   jogador clicaria, algo aconteceria, e a tela diria a mesma coisa de
		   antes. */
		sincronizar(root);
		if (dica) {
			dica.textContent = textoDoResultado(resultado);
			dica.hidden = false;
		}
	});
}

export default { montarOfertaNaEntrada, sincronizar };
