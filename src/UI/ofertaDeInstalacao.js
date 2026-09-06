/**
 * UI/ofertaDeInstalacao.js — QUEM OFERECE A INSTALAÇÃO, E O QUE ELA DIZ QUANDO
 * NÃO DÁ PARA INSTALAR SOZINHA (D-945, 06/09/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O DEFEITO QUE ESTE ARQUIVO CONSERTA
 * ═══════════════════════════════════════════════════════════════════════
 * D-933 pôs o PWA de pé e o botão "Instalar" dentro das **Configurações** —
 * pedido do dono, palavra por palavra, contra banner intrusivo no meio do
 * jogo. E a casca (`applications/pwa/registrar-sw.js`) dá `preventDefault()`
 * no `beforeinstallprompt`, que é o que **cala a oferta do próprio Chrome**.
 *
 * Some as duas coisas e sobra o buraco que o dono relatou — *"não oferece
 * instalar"*: o navegador foi calado por nós, e o único lugar que substituía
 * a oferta ficava **depois do login**, atrás de um menu. Quem chega no
 * celular, olha a tela de entrada e vai embora nunca soube que dava para
 * instalar.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * E O SEGUNDO BURACO, QUE É PIOR: O SILÊNCIO
 * ═══════════════════════════════════════════════════════════════════════
 * A linha das Configurações escondia-se quando **não havia evento** e não era
 * iPhone. Isso é honesto contra botão morto, e cego contra o caso mais comum
 * de celular: o navegador **de dentro de um app** (Instagram, Facebook,
 * WhatsApp, TikTok). Lá `beforeinstallprompt` nunca dispara, não é iOS
 * Safari — e o jogador não recebia nem o botão nem a explicação. Ficava só
 * o silêncio, que ele lê como "esse jogo não instala".
 *
 * Por isso a decisão daqui tem TRÊS saídas, e não duas:
 *
 *   1. **prompt** — o navegador ofereceu; o clique dispara a instalação real;
 *   2. **instrução** — não dá para disparar, mas dá para instalar À MÃO, e
 *      dizer como é mais útil do que sumir;
 *   3. **nada** — já está instalado, ou é um computador que nunca ofereceu
 *      (aí um botão seria o banner permanente que o pedido recusou).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUE A DECISÃO É UMA FUNÇÃO PURA
 * ═══════════════════════════════════════════════════════════════════════
 * Porque ela é a única parte que nenhum arnês alcança de verdade: não dá para
 * fabricar um `beforeinstallprompt` num Safari de iPhone, nem uma webview do
 * Instagram, dentro de um navegador de teste. `decidirOferta()` recebe um
 * retrato do ambiente e devolve o que mostrar — e o retrato é fácil de
 * fabricar em teste, um por aparelho de verdade que existe lá fora.
 */

/* ═════════════════════════════════════════════════════════════════════
   A PONTE ATÉ A CASCA
   ═════════════════════════════════════════════════════════════════════
   `window.RagIdlePWA` nasce em `applications/pwa/registrar-sw.js`, que roda
   na janela de TOPO. Este componente nem sempre roda nela: em desenvolvimento
   o jogo vive num `<iframe>` (`ROBrowser.TYPE.FRAME`) e em produção é
   embutido no mesmo documento. Procurar só em `window` daria um botão que
   funciona em produção e fica mudo em desenvolvimento — o pior jeito de
   descobrir um defeito. */

/** @returns {object|null} A ponte da casca, ou `null` se ela não existe. */
export function pontePWA() {
	try {
		if (window.RagIdlePWA) return window.RagIdlePWA;
		if (window.parent && window.parent !== window && window.parent.RagIdlePWA) {
			return window.parent.RagIdlePWA;
		}
	} catch (_erro) {
		/* `parent` de outra origem lança ao ser lido. Não acontece aqui (casca e
		   jogo são do mesmo domínio), mas ler `parent` sem `try` é a forma
		   clássica de derrubar um componente inteiro num caso de borda. */
	}
	return null;
}

/** A janela onde a casca dispara os eventos `ragidle:*`. */
export function janelaDaCasca() {
	try {
		return window.parent && window.parent !== window ? window.parent : window;
	} catch (_erro) {
		return window;
	}
}

/**
 * Liga um ouvinte nos dois eventos da casca. A oferta do navegador chega
 * DEPOIS de a tela abrir (o evento depende de heurística de engajamento), e
 * uma tela que só olhasse o estado na hora de montar mostraria "não dá" para
 * um jogador que dois segundos depois poderia instalar.
 *
 * @param {() => void} aoMudar
 * @returns {() => void} desliga
 */
export function escutarACasca(aoMudar) {
	const alvo = janelaDaCasca();
	alvo.addEventListener('ragidle:pode-instalar', aoMudar);
	alvo.addEventListener('ragidle:instalado', aoMudar);
	return function desligar() {
		alvo.removeEventListener('ragidle:pode-instalar', aoMudar);
		alvo.removeEventListener('ragidle:instalado', aoMudar);
	};
}

/* ═════════════════════════════════════════════════════════════════════
   O RETRATO DO AMBIENTE
   ═════════════════════════════════════════════════════════════════════ */

/**
 * As webviews que apps embutem. Nenhuma delas instala PWA, e é de dentro
 * delas que chega boa parte do tráfego de um jogo divulgado em rede social —
 * o link do Instagram abre no navegador do Instagram, não no Chrome.
 *
 * `FBAN`/`FBAV` são o Facebook e o Messenger; `Instagram` fala por si;
 * `MicroMessenger` é o WeChat; `Line`, `TikTok` e `Twitter` idem. O WhatsApp
 * no Android não se anuncia — ele abre no navegador padrão, e aí a detecção
 * não precisa dele.
 */
const WEBVIEWS_DE_APP = /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Line\/|TikTok|Twitter|Snapchat|Pinterest/i;

/**
 * Fotografa o ambiente. Tudo que a decisão precisa saber, num objeto simples
 * — para o teste poder fabricar aparelhos que não existem na máquina.
 *
 * @param {object} [ponte] A ponte da casca (padrão: a de verdade).
 * @returns {{jaInstalado: boolean, temPrompt: boolean, ehApple: boolean,
 *   ehSafari: boolean, ehWebviewDeApp: boolean, ehToque: boolean}}
 */
export function retratarAmbiente(ponte = pontePWA()) {
	const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
	const ehApple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
	/* Todo navegador de iPhone é o WebKit do sistema por baixo, então a
	   instalação é sempre pelo Compartilhar — muda só o desenho do menu. O que
	   separa Safari dos outros aqui é só o texto da instrução. */
	const ehSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

	let ehToque = false;
	try {
		ehToque = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
	} catch (_erro) {
		ehToque = (navigator.maxTouchPoints || 0) > 0;
	}

	return {
		jaInstalado: !!(ponte && ponte.estaInstalado && ponte.estaInstalado()),
		temPrompt: !!(ponte && ponte.promptDeInstalacao),
		ehApple,
		ehSafari,
		ehWebviewDeApp: WEBVIEWS_DE_APP.test(ua),
		ehToque
	};
}

/* ═════════════════════════════════════════════════════════════════════
   A DECISÃO
   ═════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {object} Oferta
 * @property {boolean} mostrar Se a linha aparece.
 * @property {'prompt'|'instrucao'|'nenhum'} modo O que o clique faz.
 * @property {string} rotulo O texto do botão.
 * @property {string} dica O que se explica quando não dá para disparar.
 * @property {string} motivo Por que está escondida (para diagnóstico).
 */

/**
 * A regra, na ordem em que ela decide. A ordem importa: uma webview de app
 * pode ser um iPhone, e nesse caso a instrução do Compartilhar seria mentira
 * — dentro do Instagram não existe "Adicionar à Tela de Início" que resolva.
 *
 * @param {ReturnType<typeof retratarAmbiente>} amb
 * @returns {Oferta}
 */
export function decidirOferta(amb) {
	const nada = motivo => ({ mostrar: false, modo: 'nenhum', rotulo: '', dica: '', motivo });

	/* 1. Quem já instalou nunca vê nada. Um botão que não faz nada é a versão
	      permanente do banner intrusivo que o pedido do dono recusou. */
	if (amb.jaInstalado) {
		return nada('ja-instalado');
	}

	/* 2. O navegador ofereceu: o clique instala de verdade. */
	if (amb.temPrompt) {
		return {
			mostrar: true,
			modo: 'prompt',
			rotulo: 'Instalar o app',
			dica: 'Fica na tela inicial e abre sem a barra do navegador.',
			motivo: 'prompt'
		};
	}

	/* 3. Navegador de dentro de um app: nenhum deles instala, e o caminho é
	      sair dele. Vem ANTES do iPhone porque o Instagram de iPhone também
	      cai aqui, e lá o Compartilhar não resolve. */
	if (amb.ehWebviewDeApp) {
		return {
			mostrar: true,
			modo: 'instrucao',
			rotulo: 'Como instalar',
			dica: 'Você está no navegador de dentro de um app, e ele não instala. Toque nos três pontinhos e escolha "Abrir no Chrome" (ou no Safari) — de lá o jogo instala.',
			motivo: 'webview-de-app'
		};
	}

	/* 4. iPhone e iPad: não existe evento nenhum no WebKit, e a única coisa
	      honesta é dar o caminho do menu. */
	if (amb.ehApple) {
		return {
			mostrar: true,
			modo: 'instrucao',
			rotulo: 'Como instalar',
			dica: amb.ehSafari
				? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
				: 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início". Se não achar, abra o jogo no Safari.',
			motivo: 'apple'
		};
	}

	/* 5. Aparelho de dedo sem oferta: Android onde o evento ainda não chegou
	      (ou não vai chegar). O menu do navegador instala do mesmo jeito. */
	if (amb.ehToque) {
		return {
			mostrar: true,
			modo: 'instrucao',
			rotulo: 'Como instalar',
			dica: 'Toque no menu do navegador (os três pontinhos) e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".',
			motivo: 'toque-sem-prompt'
		};
	}

	/* 6. Computador sem oferta. Aqui o botão seria decoração: quem joga no
	      computador não precisa do ícone, e a instalação continua no menu do
	      navegador para quem quiser. */
	return nada('sem-oferta');
}

/** O atalho: fotografa e decide. */
export function ofertaAtual(ponte = pontePWA()) {
	return decidirOferta(retratarAmbiente(ponte));
}

/**
 * O que dizer depois de o jogador clicar num botão de modo `prompt`.
 * Recusar a instalação é escolha legítima, e o jogo não insiste.
 *
 * @param {'instalado'|'recusado'|'ja-instalado'|'ios'|'indisponivel'} resultado
 */
export function textoDoResultado(resultado) {
	switch (resultado) {
		case 'instalado':
			return 'Instalado. O ícone está na sua tela inicial.';
		case 'recusado':
			return 'Tudo bem — dá para instalar depois, por aqui mesmo.';
		case 'ja-instalado':
			return 'O jogo já está instalado neste aparelho.';
		case 'ios':
			return 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
		default:
			return 'A instalação não está disponível neste navegador.';
	}
}

export default {
	pontePWA,
	janelaDaCasca,
	escutarACasca,
	retratarAmbiente,
	decidirOferta,
	ofertaAtual,
	textoDoResultado
};
