/**
 * UI/Components/PainelComandoIdle/PainelComandoIdle.js
 *
 * RAGIDLE: O PAINEL DE COMANDO (17/09/2026, D-1563/D-1564) — a resposta longa
 * de comando numa janela, em vez de seis linhas de chat por vez.
 *
 * Pedido do dono, com o `@mvptimeall` na tela: *"Que tal abrirmos uma janela e
 * mostrarmos essas informações de forma dinâmica e atrativa, principalmente
 * para esses comandos que retornam longas mensagens?"*
 *
 * ## Ela é GENÉRICA, e isso é a decisão
 *
 * O servidor manda COLUNAS DECLARADAS e uma linha por registro
 * (`ZC_RAGIDLE_PAINEL`, 0x0fbc), e não texto pronto. Então esta janela serve a
 * qualquer comando que um dia declare um painel — o `@mvptimeall` é o primeiro.
 * Uma janela por comando seria uma janela nova por pedido do dono, e cada uma
 * com o próprio jeito de ordenar.
 *
 * ## O que ela faz que o chat não faz
 *
 * 1. **Ordena** por qualquer coluna, clicando no cabeçalho (no celular, pelos
 *    botões, que o chat também não teria como oferecer).
 * 2. **Conta o relógio sozinha**: a coluna `relogio` chega como `faltaMs` — a
 *    DISTÂNCIA medida no servidor — e é decrementada aqui a cada segundo. O
 *    número do chat envelhece no instante em que chega; este não.
 * 3. **Colore pelo dado**, e não pelo texto: a ênfase (`destaque`/`apagado`)
 *    vem do servidor.
 *
 * ## O que ela NÃO faz
 *
 * Não filtra, não recalcula e não reordena "de um jeito melhor" o que o
 * servidor mandou: a ordem inicial é a que ele pediu (`ordemInicial`), e é a
 * mesma do feed. Refazer a decisão aqui seria a segunda rota escrita à mão que
 * este projeto já pagou treze vezes.
 *
 * O feed continua recebendo as linhas — quem fecha a janela não perde nada.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import arrastarPorPonteiro, { prenderNaTela } from 'UI/arrastarPorPonteiro.js';
import { faltaAgora, filtrarLinhas, formatarFalta, ordenarLinhas } from './tabelaDoPainel.js';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import htmlText from './PainelComandoIdle.html?raw';
import cssText from './PainelComandoIdle.css?raw';

/** De quanto em quanto tempo o relógio da tela anda. */
const PASSO_DO_RELOGIO_MS = 1000;

const PainelComandoIdle = new GUIComponent('PainelComandoIdle', cssText);

PainelComandoIdle.render = () => htmlText;

PainelComandoIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O último painel que chegou, já com o instante da chegada. */
PainelComandoIdle.estado = null;

const _preferences = Preferences.get(
	'PainelComandoIdle',
	{
		x: null,
		y: null,
		compacto: false
	},
	1.0
);

/** A coluna pela qual o jogador ordenou NESTA sessão (`null` = a do servidor). */
let _ordem = null;
/** O termo da pesquisa (25/09/2026). Fica enquanto o MESMO painel e atualizado. */
let _busca = '';

/** As linhas que a tela mostra: pesquisadas e na ordem escolhida. */
function linhasVisiveis(painel, ordem) {
	return filtrarLinhas(ordenarLinhas(painel, ordem), _busca);
}

let _tique = null;

function _root() {
	return PainelComandoIdle._shadow || PainelComandoIdle._host;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function ordemVigente() {
	const painel = PainelComandoIdle.estado;
	return _ordem || (painel && painel.ordemInicial) || null;
}

function celula(coluna, linha, chegouEm, agora) {
	const valor = linha.valores[coluna.chave];
	if (coluna.tipo === 'relogio') {
		const falta = faltaAgora(valor, chegouEm, agora);
		return {
			classe: 'pc-relogio',
			html: falta === null ? '—' : escapeHtml(formatarFalta(falta))
		};
	}
	if (coluna.tipo === 'avatar') {
		/*
		 * O avatar do monstro é `public/ragidle/mobs/<mobId>.png` — o MESMO
		 * arquivo do Mapa de Caça, do Codex e do Hunt Analyzer. O `onerror`
		 * esconde a imagem quando a espécie não tem avatar publicado, em vez de
		 * deixar o retângulo vazio que o `<img>` quebrado desenha.
		 */
		const id = Number(valor);
		return {
			classe: 'pc-avatar-celula',
			html:
				Number.isFinite(id) && id > 0
					? `<img class="pc-avatar" src="/ragidle/mobs/${String(id)}.png" alt="" onerror="this.style.display='none'" />`
					: ''
		};
	}
	if (coluna.tipo === 'selo') {
		return { classe: 'pc-selo-celula', html: `<span class="pc-selo">${escapeHtml(valor ?? '')}</span>` };
	}
	if (coluna.tipo === 'numero') {
		return { classe: 'pc-numero', html: escapeHtml(valor ?? '') };
	}
	return { classe: 'pc-texto', html: escapeHtml(valor ?? '') };
}

function render() {
	const root = _root();
	const painel = PainelComandoIdle.estado;
	if (!root || !painel) {
		return;
	}
	const agora = Date.now();
	const ordem = ordemVigente();

	root.querySelector('.pc-title').textContent = painel.titulo || 'Painel';
	/*
	 * O RESUMO VIRA PASTILHAS (D-1567).
	 *
	 * O servidor manda uma frase ("3 morto(s) · 1 vivo(s)"), e ela espremida
	 * entre o título e os dois botões foi o segundo defeito que o dono apontou
	 * no design. O cliente parte no separador e desenha uma pastilha por parte;
	 * a que fala de VIVO ganha a cor, porque é a acionável — dá para ir agora.
	 *
	 * Partir texto aqui é leitura de APRESENTAÇÃO, e não regra de jogo: o
	 * conteúdo continua sendo o que o servidor decidiu.
	 */
	root.querySelector('.pc-resumo').innerHTML = (painel.resumo || '')
		.split('·')
		.map((parte) => parte.trim())
		.filter(Boolean)
		.map((parte) => {
			const viva = /vivo/i.test(parte);
			return `<span class="pc-pastilha${viva ? ' is-vivo' : ''}">${escapeHtml(parte)}</span>`;
		})
		.join('');
	root.querySelector('.pc-origem').textContent = `@${painel.comando}`;

	const cabecalho = root.querySelector('.pc-cabecalho');
	cabecalho.innerHTML = painel.colunas
		.map((c) => {
			const marca = ordem && ordem.chave === c.chave ? ` data-ordenada="${ordem.direcao}"` : '';
			return `<th data-chave="${escapeHtml(c.chave)}"${marca}>${escapeHtml(c.rotulo)}</th>`;
		})
		.join('');
	cabecalho.querySelectorAll('th').forEach((th) => th.addEventListener('click', onClickColuna));

	// No celular o cabeçalho some (CSS): a escolha vira botões tocáveis.
	const fileira = root.querySelector('.pc-ordem-vertical');
	fileira.innerHTML = painel.colunas
		.filter((c) => c.rotulo)
		.map((c) => {
			const ativa = ordem && ordem.chave === c.chave ? ' data-ativa="1"' : '';
			return `<button type="button" data-chave="${escapeHtml(c.chave)}"${ativa}>${escapeHtml(c.rotulo)}</button>`;
		})
		.join('');
	fileira.querySelectorAll('button').forEach((b) => b.addEventListener('click', onClickColuna));

	const linhas = linhasVisiveis(painel, ordem);
	const corpo = root.querySelector('.pc-linhas');
	corpo.innerHTML = linhas
		.map((linha) => {
			const classe = linha.enfase ? ` class="pc-${escapeHtml(linha.enfase)}"` : '';
			const tds = painel.colunas
				.map((c) => {
					const { classe: cc, html } = celula(c, linha, painel.chegouEm, agora);
					return `<td class="${cc}" data-rotulo="${escapeHtml(c.rotulo)}">${html}</td>`;
				})
				.join('');
			return `<tr${classe}>${tds}</tr>`;
		})
		.join('');

	root.querySelector('.pc-vazio').hidden = linhas.length > 0;
}

/**
 * Só os relógios, sem refazer a tabela.
 *
 * Reconstruir o HTML a cada segundo mataria a rolagem e o realce do que o
 * jogador está lendo — e a tabela tem 27 linhas.
 */
function tiquearRelogios() {
	const root = _root();
	const painel = PainelComandoIdle.estado;
	if (!root || !painel) {
		return;
	}
	const agora = Date.now();
	const indices = painel.colunas
		.map((c, i) => (c.tipo === 'relogio' ? { chave: c.chave, i } : null))
		.filter(Boolean);
	if (indices.length === 0) {
		return;
	}
	const linhas = linhasVisiveis(painel, ordemVigente());
	root.querySelectorAll('.pc-linhas tr').forEach((tr, l) => {
		const dados = linhas[l];
		if (!dados) {
			return;
		}
		for (const { chave, i } of indices) {
			const td = tr.children[i];
			if (!td) {
				continue;
			}
			const falta = faltaAgora(dados.valores[chave], painel.chegouEm, agora);
			td.textContent = falta === null ? '—' : formatarFalta(falta);
		}
	});
}

function onClickColuna(event) {
	event.stopPropagation();
	const chave = event.currentTarget.dataset.chave;
	if (!chave) {
		return;
	}
	const atual = ordemVigente();
	// Clicar de novo na mesma coluna INVERTE — é o que toda tabela faz, e
	// quem clica duas vezes está pedindo o outro extremo da lista.
	_ordem =
		atual && atual.chave === chave
			? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
			: { chave, direcao: 'asc' };
	render();
}

function aplicarCompacto() {
	const root = _root();
	if (!root) {
		return;
	}
	const janela = root.querySelector('.pc-window');
	const botao = root.querySelector('.pc-minimizar');
	if (janela) {
		janela.classList.toggle('is-compact', !!_preferences.compacto);
	}
	// A classe vai no HOST também: o CSS de fora da sombra (`Common.css`) só
	// alcança o host — é a cicatriz do HuntAnalyzer, e o teste dele a cobra.
	if (PainelComandoIdle._host) {
		PainelComandoIdle._host.classList.toggle('is-compact', !!_preferences.compacto);
	}
	if (botao) {
		botao.title = _preferences.compacto ? 'Expandir' : 'Recolher';
		botao.setAttribute('aria-label', _preferences.compacto ? 'Expandir a janela' : 'Recolher para o modo enxuto');
		botao.innerHTML = _preferences.compacto ? '&plus;' : '&minus;';
	}
}

PainelComandoIdle.alternarCompacto = function alternarCompacto() {
	_preferences.compacto = !_preferences.compacto;
	_preferences.save();
	aplicarCompacto();
};

/** O servidor mandou um painel: guarda, desenha e mostra. */
PainelComandoIdle.receber = function receber(dados) {
	if (!dados || dados.v !== 1 || !Array.isArray(dados.colunas) || !Array.isArray(dados.linhas)) {
		return;
	}
	// A pesquisa fica quando o MESMO comando e atualizado; outro painel limpa.
	if (!PainelComandoIdle.estado || PainelComandoIdle.estado.comando !== dados.comando) {
		_busca = '';
		const campo = _root() && _root().querySelector('.pc-busca');
		if (campo) {
			campo.value = '';
		}
	}
	PainelComandoIdle.estado = { ...dados, chegouEm: Date.now() };
	// A ordem do jogador é por PAINEL: manter a coluna escolhida no
	// `@mvptimeall` ao abrir outro comando ordenaria por uma coluna que o
	// painel novo talvez nem tenha.
	_ordem = null;
	// `__active` e o campo que o GUIComponent escreve; `__appended` nao existia
	// e a guarda nunca valia (F11, auditoria de 22/09/2026).
	if (!PainelComandoIdle.__active) {
		PainelComandoIdle.append();
	}
	render();
	abrir();
};

/**
 * ABRE de verdade — e "de verdade" é a classe `is-open`.
 *
 * **Sem ela a janela existe, tem tamanho, tem as 27 linhas e NÃO PINTA.** O
 * padrão do fork é `.ri-anima { opacity: 0 }` com `.ri-anima.is-open` abrindo
 * (Common.css): a marcação `ri-window ri-anima` que eu copiei das outras
 * janelas traz o estado FECHADO junto, e quem abre é o JS de cada uma.
 *
 * Isto foi para produção invisível, e o que me enganou foi medir `width > 0`
 * na sonda — que é a regra 5 do projeto, "contar elemento não prova que dá
 * para ver", na forma mais literal.
 */
function abrir() {
	const janela = _root() && _root().querySelector('.pc-window');
	if (janela) {
		janela.classList.add('is-open');
	}
}

/** Fecha sem arrancar do DOM — a pilha de janelas lê `is-open`. */
function fechar() {
	const janela = _root() && _root().querySelector('.pc-window');
	if (janela) {
		janela.classList.remove('is-open');
	}
}

PainelComandoIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	/*
	 * A PEÇA COMPARTILHADA, e não uma limpeza própria: trocar de personagem não
	 * recarrega a página, e o shadow DOM sobrevive — a janela voltaria com
	 * `is-open` e com as linhas do personagem ANTERIOR escritas por `innerHTML`.
	 * O portão `janela-idle-esquece-o-desenho` cobra que toda janela Idle use
	 * esta função (e não uma cópia local que esquece metade).
	 */
	fecharEEsquecer(_root(), '.pc-window', { corpo: '.pc-linhas', texto: '' });
	PainelComandoIdle.estado = null;
	_ordem = null;
	_busca = '';
	if (PainelComandoIdle.__active) {
		PainelComandoIdle.remove();
	}
};

PainelComandoIdle.init = function init() {
	const root = _root();
	if (root) {
		root.querySelector('.pc-close').addEventListener('click', () => {
			fechar();
			PainelComandoIdle.remove();
		});
		root.querySelector('.pc-minimizar').addEventListener('click', (event) => {
			// Sem isto o clique no botão sobe para a barra e vira um arrasto de
			// zero pixel — e a janela "pisca" sem sair do lugar.
			event.stopPropagation();
			PainelComandoIdle.alternarCompacto();
		});
		const campo = root.querySelector('.pc-busca');
		campo.addEventListener('input', () => {
			_busca = campo.value;
			render();
		});
		// Digitar aqui nao pode virar atalho do jogo (o ESC continua fechando).
		campo.addEventListener('keydown', (event) => {
			if (event.which !== 27) {
				event.stopPropagation();
			}
		});
		arrastarPorPonteiro({
			alca: root.querySelector('.pc-titlebar'),
			painel: PainelComandoIdle._host,
			aoSoltar: ({ left, top }) => {
				_preferences.x = left;
				_preferences.y = top;
				_preferences.save();
			}
		});
	}
	this._host.style.top = Math.max(8, (Renderer.height - 400) / 2) + 'px';
	this._host.style.left = Math.max(8, (Renderer.width - 460) / 2) + 'px';
	aplicarCompacto();
};

PainelComandoIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.left = _preferences.x + 'px';
		this._host.style.top = _preferences.y + 'px';
	}
	// A tela de hoje pode ser menor que a de ontem (girou o aparelho, mudou de
	// máquina): a posição guardada é PRENDIDA antes de valer.
	prenderNaTela(this._host);
	aplicarCompacto();
	if (_tique === null) {
		_tique = setInterval(tiquearRelogios, PASSO_DO_RELOGIO_MS);
	}
};

PainelComandoIdle.onRemove = function onRemove() {
	if (_tique !== null) {
		clearInterval(_tique);
		_tique = null;
	}
	PainelComandoIdle.__aberta = false;
};

/** O ESC e o VOLTAR do Android fecham, como em toda janela da pilha. */
PainelComandoIdle.onKeyDown = function onKeyDown(event) {
	if (event.which === 27) {
		fechar();
		PainelComandoIdle.remove();
		event.stopImmediatePropagation();
		return false;
	}
	return true;
};

function onPainelRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[PainelComandoIdle] payload nao e JSON valido', err);
		return;
	}
	PainelComandoIdle.receber(dados);
}

Network.hookPacket(PACKET.ZC.RAGIDLE_PAINEL, onPainelRecebido);

export default UIManager.addComponent(PainelComandoIdle);
