/**
 * UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js
 *
 * O TRACKER DE MISSÕES (D-601) — o painel estilo Ragnarok Origin ancorado
 * ABAIXO das informações do personagem, pedido do dono em 25/08/2026:
 * "só clicar na missão e ele faz tudo automático".
 *
 * Três escolhas de desenho:
 *
 * 1. **Uma fonte de dados só.** `Network.hookPacket` SOBRESCREVE o handler do
 *    pacote (NetworkManager.js:200-210) — fisgar `ZC_RAGIDLE_MISSOES` aqui
 *    roubaria a janela MissoesIdle. Este painel LÊ `MissoesIdle.missoes` e
 *    `MissoesIdle.execucao` por polling de 250ms — o mesmo idioma do
 *    CorreioIdle com o Rodex nativo, e pela mesma razão.
 *
 * 2. **A âncora é MEDIDA, não fixa.** O BasicInfoIdle é arrastável e muda de
 *    altura ao compactar, sem emitir evento nenhum — então o syncPosition()
 *    lê o getBoundingClientRect() do host dele no mesmo polling e se
 *    posiciona logo abaixo, com a mesma largura. O painel anda junto quando
 *    o jogador arrasta o cartão do personagem.
 *
 * 3. **Um clique, nenhuma pergunta.** Clicar numa missão manda
 *    `CZ_RAGIDLE_MISSAO_ACAO {acao:'iniciar'}` e pronto — o servidor valida,
 *    recusa com motivo no feed se for o caso, e o executor assume. Sem
 *    confirmação: a recusa educada do servidor é mais barata que um "tem
 *    certeza?" para quem tem 5 anos.
 *
 * 4. **Até três missões ao mesmo tempo (01/10/2026, pedido do dono).** Não há
 *    mais "a ativa", fila nem pausa: cada missão ACEITA vira um bloco, na ordem
 *    de aceite, com o objetivo que falta, a barra, "Finalizar" (só quando o
 *    servidor diz `pronta`) ou "Ir caçar", e o "(i)" que abre o painel com tudo
 *    da missão (`MissoesIdle/infoDaMissao.js`). No celular em pé o corpo NÃO
 *    cresce por causa disso: ele continua no teto de D-1483 e rola por dentro
 *    (o `Common.css` posiciona a faixa de grupo contando com o cartão de 84 a
 *    238px).
 *
 * @author RagIdle
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import BasicInfoIdle from 'UI/Components/BasicInfoIdle/BasicInfoIdle.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import { podeIniciarMissao } from 'UI/Components/MissoesIdle/podeIniciarMissao.js'; // RAGIDLE: I16
// 01/10/2026: as aceitas (ate 3) e o painel "(i)" — regras puras e o painel
// moram ao lado da janela de Missoes, que e quem recebe o pacote.
import {
	destinoDeCaca,
	missoesAceitasEmOrdem,
	passoDaMissaoAceita,
	porcentagemDoObjetivo
} from 'UI/Components/MissoesIdle/missoesAceitas.js';
import {
	alternarInfoDaMissao,
	botaoDeInfoHtml,
	fecharInfoDaMissao
} from 'UI/Components/MissoesIdle/infoDaMissao.js';
import infoCss from 'UI/Components/MissoesIdle/infoDaMissao.css?raw';
import htmlText from './MissoesTrackerIdle.html?raw';
import cssText from './MissoesTrackerIdle.css?raw';
import { emUnidadesDaHud } from 'UI/escalaDaHud.js'; // D-934: geometria medida vira unidade da HUD
import LFGIdle from 'UI/Components/LFGIdle/LFGIdle.js'; // D-939: a aba "Grupo" do cartao vertical
import { ehCelularEmPe } from 'UI/hudVertical.js'; // D-939: na vertical a ancora e do CSS, nao deste polling
import CodexIdle from 'UI/Components/CodexIdle/CodexIdle.js'; // D-1839: o clique numa linha do rastreador
import { rastreadorDoCodexAtual, rastreadorDoCodexHtml } from '../rastreadorDoCodex.js'; // D-1839

/**
 * Quantas missões clicáveis o painel lista (as demais ficam na janela).
 *
 * 5 -> 3 EM 15/09/2026, pelo relato do dono de que o cartão ocupa *"praticamente
 * a metade da tela"* no celular. Cada linha custa ~30px mais o `gap`, então as
 * duas que saíram valem ~68px — e elas não somem do jogo: continuam na janela
 * de Missões, que é onde a lista completa sempre morou.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O CORTE VEIO DAQUI E DO `max-height`, E NÃO DOS BOTÕES
 * ---------------------------------------------------------------------------
 * O caminho óbvio para encolher um cartão é apertar padding e altura de linha.
 * **Aqui isso seria errado, e a medição diz por quê**: os alvos tocáveis deste
 * componente (`.mt-item`, `.mt-aba`, `.mt-ver-todas`, `.mt-btn-mini`) já estão
 * ABAIXO do piso de 44px que a regra do dono (D-935) exige, e nenhum deles
 * aparece no bloco `@media (pointer: coarse)` do `Common.css` que cuida disso
 * para os outros componentes. Só o `.mt-recolher-v` tem os 44px.
 *
 * Ou seja: eles precisam CRESCER, não encolher. Apertá-los para ganhar altura
 * pioraria uma violação que já existe e trocaria "cartão grande" por "cartão
 * em que o dedo erra o alvo" — que é o defeito mais caro dos dois.
 *
 * ---------------------------------------------------------------------------
 * A DÍVIDA DOS 44px FOI PAGA — 3 -> 2, e o cartão ENCOLHEU (D-1487, 15/09/2026)
 * ---------------------------------------------------------------------------
 * O dono mandou pagar. O parágrafo acima apresentava isso como uma troca — ou
 * cartão pequeno, ou alvo tocável — e **a troca não existia**: ela vinha de uma
 * conta errada, e refazê-la resolveu os dois lados.
 *
 * O que a conta anterior não viu: `.mt-corpo` é **content-box** (este projeto
 * não tem `box-sizing` global — o `Common.css` o declara só para `.ri-header`),
 * então os `8px` de `padding` ficavam FORA do `max-height: 22dvh`. O cartão era
 * ~16px mais alto do que o próprio comentário de D-1483 calculava. Esses 16px
 * pagaram quase toda a conta sozinhos.
 *
 * O balanço, num 402x714 — `2 + 48 + (157 + 16) + 36` = **~259px** antes:
 *
 * | | |
 * |---|---|
 * | `box-sizing: border-box` no `.mt-corpo` | **−16px** |
 * | `MAX_LINHAS` 3 -> 2, com a linha a 44px | **−3px** |
 * | `.mt-ver-todas` 36 -> 44px | **+8px** |
 * | | **~248px**, contra ~259px |
 *
 * Ou seja: **todo alvo alcançou o piso e o cartão ficou MENOR do que estava.**
 *
 * As duas linhas listadas cabem em `2 × 44 + 4 de gap + 16 de padding = 108px`,
 * contra os `3 × 29 + 8 + 16 = 111px` de antes — e a terceira missão não some
 * do jogo, pelo mesmo motivo que as duas de D-1483: a lista completa sempre
 * morou na janela de Missões.
 *
 * As regras táteis moram no bloco `@media (pointer: coarse)` do `Common.css`,
 * e não aqui — é lá que o portão `areaDeToqueAncoraNoBotao` procura, e regra
 * escrita na folha do componente não seria vigiada por ninguém.
 *
 * **O que sobrou na mesa, se o dono quiser mais 36px:** `.mt-ver-todas` pode
 * virar um ícone dentro da fileira de abas (que já tem 44px de altura e ~56px
 * livres), apagando a faixa própria dele. Não foi feito aqui porque troca um
 * botão com texto por um glifo, e isso é escolha de produto, não de layout.
 */
const MAX_LINHAS = 2;

// A folha do "(i)" e do painel vai junto: o painel mora DENTRO deste shadow
// (ver o cabecalho de `infoDaMissao.css`).
const MissoesTrackerIdle = new GUIComponent('MissoesTrackerIdle', cssText + '\n' + infoCss);

MissoesTrackerIdle.render = () => htmlText;
MissoesTrackerIdle.mouseMode = GUIComponent.MouseMode.CROSS;
MissoesTrackerIdle.needFocus = false;

let _timer = null;
let _recolhido = false;
let _assinatura = '';
/*
 * A ABA DO CARTAO NO CELULAR EM PE (D-1839): 'missoes' ou 'codex'.
 *
 * Fora da vertical ela nao existe (a secao do Codex aparece embaixo das
 * missoes). Na vertical o cartao nao tem altura para as duas - o corpo e
 * `max-height: 22dvh` por ordem do dono (D-1483) -, e a aba troca uma pela
 * outra. E preferencia de quem joga, como `_recolhido`: a troca de
 * personagem NAO a zera.
 */
let _abaVertical = 'missoes';

function _root() {
	return MissoesTrackerIdle._shadow || MissoesTrackerIdle._host;
}

function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

function mandarAcao(acao, id) {
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify(id ? { acao, id } : { acao });
	Network.sendPacket(pkt);
}

/** O "(i)" de uma missao na tela agora — a lista e redesenhada por innerHTML,
 * entao o botao de quando o painel abriu pode nem existir mais. */
function ancoraDoInfo(id) {
	const root = _root();
	if (!root) {
		return null;
	}
	return Array.from(root.querySelectorAll('.mt-corpo [data-info]')).find(b => b.getAttribute('data-info') === id) || null;
}

/** Onde o painel "(i)" mora: a raiz do cartao, fora do `.mt-painel` (que tem
 * `overflow: hidden`). */
function conteinerDoInfo() {
	const root = _root();
	return root ? root.querySelector('#MissoesTrackerIdle') : null;
}

/**
 * O GESTO DO "(i)" (01/10/2026): abre o painel da missao, e o mesmo "(i)" de
 * novo o fecha. O painel LE o estado da janela de Missoes (a fonte unica) e
 * manda as acoes pelo mesmo pacote dos botoes do cartao.
 */
function alternarInfo(id) {
	const conteiner = conteinerDoInfo();
	if (!conteiner || !id) {
		return;
	}
	alternarInfoDaMissao({
		id,
		conteiner,
		host: MissoesTrackerIdle._host,
		ancora: () => ancoraDoInfo(id),
		dados: () => ({ missoes: MissoesIdle.missoes || [], execucao: MissoesIdle.execucao || null }),
		agir: (acao, missaoId) => mandarAcao(acao, missaoId),
		verNaJanela: (missaoId, tipo) => MissoesIdle.abrirEmMissao(missaoId, tipo)
	});
}

/**
 * Vira o estado de recolhido e repinta os dois botoes.
 *
 * A PREFERENCIA ATRAVESSA o redesenho do painel e a troca de mapa sem
 * esforco: `_recolhido` e estado de MODULO e `render()` nunca toca na classe
 * do `.mt-painel` — ele reescreve so o conteudo de `.mt-aceitas` e `.mt-lista`.
 * Foi conferido antes de escrever isto, e nao suposto.
 */
function alternarRecolhido() {
	_recolhido = !_recolhido;
	pintarRecolhido();
}

/** Poe o estado na tela. Chamada no `init` tambem, para o primeiro quadro. */
function pintarRecolhido() {
	const root = _root();
	if (!root) {
		return;
	}
	const painel = root.querySelector('.mt-painel');
	if (painel) {
		painel.classList.toggle('is-recolhido', _recolhido);
	}
	const antigo = root.querySelector('.mt-recolher');
	if (antigo) {
		antigo.textContent = _recolhido ? '+' : '−';
	}
	const vertical = root.querySelector('.mt-recolher-v');
	if (vertical) {
		/* O glifo GIRA em vez de trocar de caractere: o chevron apontando
		   para baixo e "fecha", apontando para cima e "abre", e a rotacao
		   deixa claro que e o mesmo controle. */
		vertical.classList.toggle('is-recolhido', _recolhido);
		vertical.setAttribute('aria-expanded', String(!_recolhido));
		const rotulo = _recolhido ? 'Expandir missões' : 'Recolher missões';
		vertical.setAttribute('aria-label', rotulo);
		vertical.title = rotulo;
	}
}

MissoesTrackerIdle.init = function init() {
	const root = _root();
	// Guardas pelo motivo de ClassChangeNotice.js:68-88: este init roda dentro
	// de MapEngine.init e uma exceção aqui derruba o mundo 3D.
	/*
	 * OS DOIS INTERRUPTORES DA MESMA LUZ (08/09/2026).
	 *
	 * `.mt-recolher` e o botao de sempre, no `.mt-header` — que a HUD
	 * vertical esconde. `.mt-recolher-v` e o gemeo dele na fileira de abas,
	 * que so a vertical desenha. Os dois chamam `alternarRecolhido()`: um
	 * estado, dois lugares de tocar nele.
	 *
	 * Escrever a troca duas vezes seria a receita do "dois estados que
	 * dessincronizam" que este projeto ja registrou varias vezes.
	 */
	for (const botao of [root && root.querySelector('.mt-recolher'), root && root.querySelector('.mt-recolher-v')]) {
		if (!botao) {
			continue;
		}
		botao.addEventListener('click', e => {
			e.stopImmediatePropagation();
			alternarRecolhido();
		});
	}
	pintarRecolhido();
	/*
	 * D-1839: as abas "Missões" e "Codex" do cartao vertical trocam o que
	 * o corpo mostra. "Grupo" continua sendo uma PORTA (abre o LFG).
	 */
	for (const aba of ['missoes', 'codex']) {
		const botao = root && root.querySelector(`.mt-aba[data-aba="${aba}"]`);
		if (!botao) {
			continue;
		}
		botao.addEventListener('click', e => {
			e.stopImmediatePropagation();
			_abaVertical = aba;
			pintarAba();
		});
	}
	pintarAba();
	/*
	 * D-939: as pecas do cartao da HUD vertical. A aba "Grupo" e o rodape
	 * "Ver todas as missões" sao PORTAS (abrem as janelas que ja existem),
	 * nao telas novas — e fora da vertical nenhum dos dois aparece.
	 */
	const abaGrupo = root && root.querySelector('.mt-aba[data-aba="grupo"]');
	if (abaGrupo) {
		abaGrupo.addEventListener('click', e => {
			e.stopImmediatePropagation();
			LFGIdle.toggle();
		});
	}
	const verTodas = root && root.querySelector('.mt-ver-todas');
	if (verTodas) {
		verTodas.addEventListener('click', e => {
			e.stopImmediatePropagation();
			// Na aba do Codex o rodape abre o Codex (D-1839).
			if (_abaVertical === 'codex') {
				CodexIdle.abrirNaEntrada(null);
				return;
			}
			MissoesIdle.toggle();
		});
	}

	// Delegação: um listener no corpo resolve lista re-renderizada por
	// innerHTML (o padrão do CorreioIdle).
	const corpo = root && root.querySelector('.mt-corpo');
	if (corpo) {
		corpo.addEventListener('click', e => {
			/* O "(i)" vem PRIMEIRO e e IRMAO da linha, nunca filho dela: a linha
			   de "Iniciar" e ela mesma um `<button>`, e botao dentro de botao e
			   HTML invalido (o navegador o desmonta). */
			const info = e.target.closest('[data-info]');
			if (info) {
				e.stopImmediatePropagation();
				alternarInfo(info.getAttribute('data-info'));
				return;
			}
			const btn = e.target.closest('[data-acao]');
			if (!btn) {
				return;
			}
			e.stopImmediatePropagation();
			const acao = btn.dataset.acao;
			if (acao === 'iniciar' && btn.dataset.id) {
				mandarAcao('iniciar', btn.dataset.id);
			} else if ((acao === 'finalizar' || acao === 'teleporte' || acao === 'abandonar') && btn.dataset.id) {
				// 01/10/2026: toda acao leva o id. Com ate tres aceitas nao ha
				// "a ativa" para o servidor adivinhar: o "Ir caçar" leva ao
				// objetivo DESTA missao, e o "Finalizar" entrega ESTA.
				mandarAcao(acao, btn.dataset.id);
			} else if (acao === 'codex-abrir') {
				// D-1839: a linha do rastreador abre o Codex naquela entrada.
				CodexIdle.abrirNaEntrada(btn.dataset.entrada || null);
			} else if (acao === 'abrir-janela') {
				// A Troca de Classe não roda pelo executor: o clique abre a
				// janela de missões, onde a grade de classes mora (D-609).
				MissoesIdle.toggle();
			}
		});
	}
};

MissoesTrackerIdle.onAppend = function onAppend() {
	if (_timer) {
		clearInterval(_timer);
	}
	_timer = setInterval(() => {
		syncPosition();
		renderSeMudou();
	}, 250);
	syncPosition();
	renderSeMudou();
};

MissoesTrackerIdle.onRemove = function onRemove() {
	if (_timer) {
		clearInterval(_timer);
		_timer = null;
	}
	// O cartao sai da tela (troca de mapa, inclusive pelo "Ir caçar"): o painel
	// "(i)" que ele abriu sai junto, em vez de voltar aberto e fora do lugar.
	fecharInfoDaMissao(conteinerDoInfo());
};

/** Cola o painel logo abaixo do cartão do personagem, na mesma coluna. */
function syncPosition() {
	const host = MissoesTrackerIdle._host;
	const alvo = BasicInfoIdle && BasicInfoIdle._host;
	if (!host || !alvo) {
		return;
	}
	/*
	 * D-939: NO CELULAR EM PE A ANCORA E DO CSS (Common.css, `.ri-vertical
	 * #MissoesTrackerIdle`), e a conta de "cabe no vao" de D-930 nao
	 * descreve aquele arranjo — la o cluster e um TRILHO na borda direita, o
	 * `--hud-cluster-topo` publicado fica praticamente igual ao topo deste
	 * cartao, e a conta concluia "nao cabe" e ESCONDIA o cartao que o mockup
	 * manda mostrar. Este retorno tambem para de escrever `style.top/left`
	 * inline a cada 250ms — o CSS da vertical ja os vence com `!important`,
	 * mas estado inline que ninguem le e sujeira que confunde o proximo.
	 */
	if (ehCelularEmPe()) {
		host.style.display = '';
		host.style.maxHeight = '';
		return;
	}
	const rect = alvo.getBoundingClientRect();
	if (!rect || rect.width === 0) {
		return;
	}
	/* D-934: `rect` vem em pixel de viewport (o zoom ja aplicado) e `style.top`
	   e lido nas unidades do host (zoom por aplicar). Escrever de volta o numero
	   lido NAO devolve o painel ao mesmo lugar — foi assim que ele foi parar
	   58px por cima do painel de personagem em 800x500, medido. */
	host.style.top = Math.round(emUnidadesDaHud(rect.bottom + 8)) + 'px';
	host.style.left = Math.round(emUnidadesDaHud(rect.left)) + 'px';

	/*
	 * ELE CABE NO VAO, OU NAO APARECE (D-930, 05/09/2026).
	 *
	 * Em tela estreita o cluster de essenciais deixou de morar logo abaixo
	 * desta coluna e passou a se ancorar na pilha do rodape (TopMenuIdle) —
	 * ou seja, ele agora SOBE quando o rodape cresce, e o vao entre o painel
	 * de personagem e ele deixou de ser generoso. Medido em 360x640: o painel
	 * termina em 272, este rastreador comeca em 280 e o cluster comeca em
	 * 295. Sao 15px de vao para um cabecalho de 30.
	 *
	 * TENTEI RESOLVER SO NO CSS e nao da: `max-height` com um piso deixa o
	 * painel maior que o vao, e sem piso ele vira uma sobra de 2px de borda —
	 * um risco na tela que nao informa nada. A decisao e binaria (cabe ou nao
	 * cabe) e depende de dois numeros medidos em runtime, entao ela mora aqui,
	 * no mesmo tique de 250ms que ja posiciona o componente.
	 *
	 * A guarda `topoDoCluster > meuTopo` e o que mantem o desktop intocado: la
	 * o cluster mora no CANTO SUPERIOR direito, ACIMA deste painel, e a conta
	 * de vao nao se aplica. Sem ela, o desktop esconderia o rastreador — que
	 * e exatamente o defeito que este bloco existe para evitar.
	 *
	 * 34 = os 30px do cabecalho (`.mt-painel` recolhido) mais os 2+2 de borda.
	 * Abaixo disso nao ha o que mostrar, e a informacao continua a um toque do
	 * botao "Menu" e outro no item "Missoes" do leque (D-944, 06/09/2026: o
	 * Missoes trocou de casa com o Recompensas). Este rastreador e justamente o
	 * que torna essa gaveta aceitavel -- o acompanhamento de toda hora e ele.
	 */
	const topoDoCluster = parseFloat(
		getComputedStyle(host.ownerDocument.documentElement).getPropertyValue('--hud-cluster-topo')
	);
	const meuTopo = rect.bottom + 8;
	if (Number.isFinite(topoDoCluster) && topoDoCluster > meuTopo) {
		/* Os dois lados na MESMA unidade: `topoDoCluster` ja e publicado em
		   unidade da HUD, entao `meuTopo` tambem precisa ser convertido. */
		const vao = topoDoCluster - emUnidadesDaHud(meuTopo) - 8;
		const cabe = vao >= 34;
		host.style.display = cabe ? '' : 'none';
		host.style.maxHeight = cabe ? Math.round(vao) + 'px' : '';
	} else {
		host.style.display = '';
		host.style.maxHeight = '';
	}

	/*
	 * PUBLICA O FUNDO DA COLUNA ESQUERDA (I1, 31/08/2026).
	 *
	 * Em tela estreita o cluster do menu desce para debaixo desta coluna
	 * (`TopMenuIdle.css`), e "a coluna" e o painel de personagem MAIS este
	 * rastreador — que so as vezes existe, e cuja altura muda com o numero de
	 * missoes na lista.
	 *
	 * Descer so ate o fundo do PAINEL foi a primeira tentativa, e a tela
	 * mostrou o erro: os oito discos do menu cairam em cima do "Primeiros
	 * Passos". A prova aprovou assim mesmo, porque ela media os alvos dos
	 * quatro componentes que eu tinha listado e este nao estava entre eles —
	 * regra 5 na forma exata: contar elemento nao prova que da para ver.
	 *
	 * O proprio fundo, e nao um `max()` com o do painel: este componente ja se
	 * ancora ABAIXO do painel (a linha acima), entao o fundo dele e o fundo dos
	 * dois. Quando ele nao esta na tela ninguem escreve a propriedade, e o
	 * `TopMenuIdle` cai no `--hud-basic-fundo`, que o painel publica sempre.
	 */
	const meu = host.getBoundingClientRect();
	if (meu.height > 0) {
		host.ownerDocument.documentElement.style.setProperty(
			'--hud-coluna-fundo',
			`${Math.round(emUnidadesDaHud(meu.bottom))}px`
		);
	}
}

function renderSeMudou() {
	const missoes = MissoesIdle.missoes || [];
	const execucao = MissoesIdle.execucao || null;
	const codex = rastreadorDoCodexAtual();
	/* 01/10/2026: o PROGRESSO de cada objetivo, `aceita` e `pronta` entram na
	   assinatura. O parcial de progresso (`v: 3`) muda so esses campos, e sem
	   eles o cartao ficaria parado no "12/25" com o servidor contando mais. */
	const assinatura = JSON.stringify([execucao, missoes.map(m => [m.id, m.estado, m.cooldownS, m.aceita, m.pronta, (m.objetivos || []).map(o => o.progresso)]), codex]);
	if (assinatura === _assinatura) {
		return;
	}
	_assinatura = assinatura;
	render(missoes, execucao);
	renderCodex(codex);
}

/**
 * O RASTREADOR DO CODEX (D-1839): as entradas marcadas, com o contador. O
 * desenho mora em `rastreadorDoCodex.js` (testavel sem a janela); aqui so
 * a caixa: fora da vertical a secao some quando nada esta marcado, e o
 * numero da aba "Codex" do cartao vertical diz quantas estao marcadas.
 */
function renderCodex(codex) {
	const root = _root();
	const caixa = root && root.querySelector('.mt-codex');
	const lista = root && root.querySelector('.mt-codex-lista');
	if (!caixa || !lista) {
		return;
	}
	caixa.dataset.vazia = codex.length === 0 ? 'true' : 'false';
	lista.innerHTML = rastreadorDoCodexHtml(codex);
	const n = root.querySelector('.mt-aba[data-aba="codex"] .mt-aba-n');
	if (n) {
		n.textContent = codex.length > 0 ? String(codex.length) : '';
	}
}

/** Poe a aba do cartao vertical na tela (D-1839). */
function pintarAba() {
	const root = _root();
	const painel = root && root.querySelector('.mt-painel');
	if (!painel) {
		return;
	}
	painel.dataset.aba = _abaVertical;
	for (const aba of ['missoes', 'codex']) {
		const botao = root.querySelector(`.mt-aba[data-aba="${aba}"]`);
		if (botao) {
			botao.classList.toggle('is-ativa', aba === _abaVertical);
			botao.setAttribute('aria-selected', String(aba === _abaVertical));
		}
	}
	const verTodas = root.querySelector('.mt-ver-todas');
	if (verTodas) {
		verTodas.firstChild.textContent = _abaVertical === 'codex' ? 'Abrir o Codex ' : 'Ver todas as missões ';
	}
}

/**
 * O BLOCO de uma missao aceita (01/10/2026): titulo e "(i)", o objetivo que
 * falta com a barra e `progresso/alvo`, e UM botao — "Finalizar" quando o
 * servidor diz `pronta`, senao "Ir caçar" quando ha para onde ir. "Abandonar"
 * mora no painel "(i)" e na janela: no cartao, que divide a tela com o jogo,
 * um terceiro botao por missao seria o primeiro a ser tocado sem querer.
 *
 * A PRIMEIRA aceita leva tambem `.mt-ativa`: e para la que a etapa 10 do
 * tutorial aponta (`etapasDoTutorial.js`), e o contador que ela confere e o
 * desta mesma missao (`progressoDaPrimeiraAceita`).
 */
function blocoDaAceita(m, primeira) {
	const pronta = m.pronta === true;
	const passo = passoDaMissaoAceita(m);
	const temBarra = passo.progresso !== null && passo.alvo !== null;
	const pct = temBarra ? porcentagemDoObjetivo(passo.progresso, passo.alvo) : 0;
	const destino = destinoDeCaca(m);
	const id = escapeHtml(m.id);
	const botao = pronta
		? `<button type="button" class="ri-btn ri-btn--ouro mt-btn-mini" data-acao="finalizar" data-id="${id}" title="Entrega a missão e recebe a recompensa">Finalizar</button>`
		: destino
			? `<button type="button" class="ri-btn ri-btn--sec mt-btn-mini" data-acao="teleporte" data-id="${id}" title="Leva você a ${escapeHtml(destino.rotulo)}">Ir caçar</button>`
			: '';
	// O nome do mapa ao lado do "Ir caçar" diz para ONDE ele leva — no dedo nao
	// ha `title` para ler.
	const onde = !pronta && destino ? escapeHtml(destino.rotulo) : '';
	return `
		<li class="mt-bloco${primeira ? ' mt-ativa' : ''}${pronta ? ' is-pronta' : ''}" data-missao="${id}">
			<div class="mt-bloco-topo">
				<span class="mt-ativa-titulo">${escapeHtml(m.titulo || m.id)}</span>
				${botaoDeInfoHtml(m, 'mt-info')}
			</div>
			<div class="mt-ativa-passo">${escapeHtml(passo.texto)}${temBarra ? ` — ${passo.progresso}/${passo.alvo}` : ''}</div>
			${temBarra ? `<div class="mt-barra"><div class="mt-barra-fill" style="width:${pct}%"></div></div>` : ''}
			${botao ? `<div class="mt-ativa-acoes"><span class="mt-eta">${onde}</span>${botao}</div>` : ''}
		</li>`;
}

function render(missoes, execucao) {
	const root = _root();
	if (!root) {
		return;
	}
	const caixaDasAceitas = root.querySelector('.mt-aceitas');
	const lista = root.querySelector('.mt-lista');
	if (!caixaDasAceitas || !lista) {
		return;
	}

	/* AS ACEITAS no topo, na ordem de aceite — TODAS, inclusive as de um
	   personagem antigo com mais de tres (herdadas da fila de antes). No
	   celular o corpo rola por dentro; o cartao nao cresce. */
	const aceitas = missoesAceitasEmOrdem(missoes, execucao);
	caixaDasAceitas.dataset.vazia = aceitas.length ? 'false' : 'true';
	caixaDasAceitas.innerHTML = aceitas.map((m, i) => blocoDaAceita(m, i === 0)).join('');

	/*
	 * A TROCA DE CLASSE entra no TOPO quando abre (D-609, pedido do dono:
	 * "ao chegar no nível de classe 10 a missão deve aparecer na janela de
	 * quests"). Ela não roda pelo executor (executavel=false), então a linha
	 * dela não é um Iniciar: é a porta da janela, onde a grade de classes
	 * mora. `m.classes` só viaja na missão de troca — é a marca dela.
	 */
	const trocasAbertas = missoes.filter(m => m.classes && m.classes.length && m.estado === 'disponivel');
	const linhasDeTroca = trocasAbertas.map(
		m => `
			<li>
				<button type="button" class="mt-item mt-item--troca" data-acao="abrir-janela">
					<span class="mt-item-seta">⚔</span>
					<span class="mt-item-nome">${escapeHtml(m.titulo)}</span>
					<span class="mt-item-nivel">escolher!</span>
				</button>
			</li>`
	);
	/*
	 * A REGRA DE "PODE INICIAR" MORA NUM LUGAR SO (I16, 31/08/2026).
	 *
	 * O filtro aqui era `m.executavel && m.estado === 'disponivel'`, e a janela
	 * de missoes tinha o MESMO filtro escrito separado, com o MESMO erro: os
	 * dois esqueciam `em-andamento`.
	 *
	 * E `em-andamento` sem execucao ativa e exatamente o estado em que a MORTE
	 * deixa a missao — morrer cancela a ativa (D-609) mas o progresso de caca
	 * sobrevive (D-615), e progresso que andou vira `em-andamento`. A missao
	 * caia no vao entre os dois: fora dos clicaveis, e fora da execucao. O
	 * jogador lia "Nenhuma missao disponivel agora — suba de nivel!" com a
	 * missao dele parada no meio.
	 *
	 * O TETO DE TRES (01/10/2026) tambem mora na regra: com tres aceitas,
	 * `podeIniciarMissao` responde "nao" para todas, e as linhas de "Iniciar"
	 * somem do cartao — a janela de Missoes e quem explica o "3 de 3 em
	 * andamento". A fila de antes nao existe mais, e com ela a linha "na fila".
	 *
	 * A ORDEM poe primeiro a que ja tem progresso guardado (`em-andamento` sem
	 * aceite: o jogador a abandonou no meio) — retomar e o convite mais util.
	 */
	const clicaveis = missoes
		.filter(m => podeIniciarMissao(m, execucao))
		.sort((a, b) => (b.estado === 'em-andamento' ? 1 : 0) - (a.estado === 'em-andamento' ? 1 : 0));
	/* O "(i)" e IRMAO do botao da linha, dentro do `<li>`: a linha inteira ja e
	   um `<button>` (o "Iniciar"), e botao dentro de botao nao existe em HTML. */
	const linhas = clicaveis.slice(0, MAX_LINHAS).map(
		m => `
			<li class="mt-linha">
				<button type="button" class="mt-item" data-acao="iniciar" data-id="${escapeHtml(m.id)}">
					<span class="mt-item-seta">▶</span>
					<span class="mt-item-nome">${escapeHtml(m.titulo)}</span>
					<span class="mt-item-nivel">${escapeHtml(m.dificuldade || '')}</span>
				</button>
				${botaoDeInfoHtml(m, 'mt-info')}
			</li>`
	);
	lista.innerHTML =
		linhasDeTroca.join('') + linhas.join('') ||
		(aceitas.length ? '' : '<li class="mt-vazio">Nenhuma missão disponível agora — suba de nível!</li>');
}

/**
 * A TROCA DE PERSONAGEM ESQUECE O TRACKER DE MISSOES (28/08/2026).
 *
 * Voltar ao menu de personagem NAO recarrega a pagina: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload so
 * acontece no SAIR). Todo estado de MODULO atravessa a troca — e este arquivo
 * guarda a assinatura das missoes desenhadas.
 *
 * `_recolhido` NAO entra: recolher o tracker e preferencia de quem joga, e nao
 * dado de personagem — zera-la seria reabrir uma janela que a pessoa fechou.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portao `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
MissoesTrackerIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	_assinatura = '';
	// O painel "(i)" fala de uma missao do personagem anterior (01/10/2026).
	fecharInfoDaMissao(conteinerDoInfo());
};

export default UIManager.addComponent(MissoesTrackerIdle);
