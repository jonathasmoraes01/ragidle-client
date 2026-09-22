/**
 * UI/Components/PasseIdle/PasseIdle.js
 *
 * A JANELA DO PASSE (D-813): duas abas — Semanal e VIP —, cada uma com a
 * vitrine do produto, o que ele entrega e o botão de comprar/renovar.
 *
 * Quatro escolhas de desenho, nenhuma estética:
 *
 * 1. **Quem decide TUDO é o servidor.** Preço, dias, vencimento, o que cada
 *    dia entrega e até o NOME dos itens chegam prontos em `ZC_RAGIDLE_PASSE`
 *    (0x0fe5). Recalcular aqui daria a segunda cópia da regra — e ela diria o
 *    preço velho no dia em que o dono mudasse o catálogo. É a mesma escolha de
 *    MissoesIdle.js:10-15.
 *
 * 2. **O pacote traz o estado inteiro numa viagem.** Nada muda enquanto a
 *    janela está aberta, então uma requisição por aba seria latência por nada.
 *    Trocar de aba é só redesenhar o que já está na memória.
 *
 * 3. **A resposta da compra volta no MESMO pacote de estado**, no campo
 *    `comprou` — como o `aplicado` da config. Um pacote de resposta, e não
 *    dois: o estado depois da compra e o aviso do que houve chegam juntos, e
 *    a tela nunca fica meio atualizada.
 *
 * 4. **O botão não some quando falta cash.** Ele apaga e explica. Sumir faria
 *    o jogador procurar o que fazer; apagado ele diz "existe, e falta saldo".
 *
 * ---------------------------------------------------------------------------
 * ESTA JANELA NAO TEM MAIS BOTAO NO MENU (21/09/2026, ordem do dono: "a
 * janela de recompensas nao compensa mais a gente ter ela")
 * ---------------------------------------------------------------------------
 * O conteudo dela - o Passe Semanal e a compra do VIP - mora na janela da
 * Temporada (`TemporadaIdle`, abas "Passe Semanal" e "VIP"), e o botao
 * "Recompensas" do cluster virou o botao "Temporada". O MODULO fica, e nao e
 * por preguica: ele continua sendo o DONO do pacote `ZC_RAGIDLE_PASSE`
 * (0x0fe5) - `Network.hookPacket` substitui, nao soma, entao so pode haver
 * UM gancho por opcode no cliente inteiro (portao no servidor:
 * `servidor/protocolo/um-dono-por-pacote.test.ts`). Quem precisa do estado
 * do Passe assina `PasseIdle.aoReceberEstado`, como a Temporada faz. As
 * funcoes de desenho abaixo continuam vivas para `toggle()` (a pilha de
 * janelas o embrulha) e para a prova que abre a janela por comando; a copia
 * delas que o jogador ve esta em `formatoDaTemporada.js`.
 *
 * O que segue e a HISTORIA da entrada na HUD, preservada porque o argumento
 * dela e o que levou a Temporada para o cluster: o botão "Recompensas" do
 * CLUSTER de essenciais (TopMenuIdle) chamava PasseIdle.toggle(). Ele morou
 * no leque até 06/09/2026, quando o dono o trocou de casa com o "Missões"
 * (D-944): o único produto pago do menu deixou de depender de o jogador
 * abrir a gaveta.
 *
 * **O NOME DE TELA E "Recompensas" e o do CODIGO e "Passe", de propósito.**
 * O dono renomeou o botão em 29/08/2026 e o "Recompensas" que existia em breve
 * saiu — a janela daqui é o que ele prometia. O identificador continua
 * nomeando o DOMÍNIO (o que a janela vende são passes: o semanal e o VIP), e
 * os pacotes já nascem `CZ/ZC_RAGIDLE_*_PASSE`. Renomear a cadeia inteira
 * seria churn nos dois repositórios para trocar uma palavra de tela.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './PasseIdle.html?raw';
import cssText from './PasseIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';
import { formatarRoCash, minorDePrimeiro } from 'Utils/roCash.js';

/** Manter em sincronia com o ":host"/".pi-window" do CSS (mesmo papel do
 * WINDOW_WIDTH/HEIGHT de MissoesIdle.js:41-42). */
const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 560;

/** Quanto tempo o aviso de compra fica na tela. */
const AVISO_MS = 3200;

const PasseIdle = new GUIComponent('PasseIdle', cssText);

PasseIdle.render = () => htmlText;

/** Janela fechada não pode engolir clique de cena — par do
 * ":host{pointer-events:none}" do CSS. */
PasseIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O último estado que o servidor mandou ({v:1, cash, passes, semanal, vip}). */
PasseIdle.estado = null;

/** As abas que existem, na ordem do HTML — a lista que valida o que veio do
 * `localStorage` (ver memoriaDeAba.js). */
const ABAS = ['semanal', 'vip'];

/** A aba de fabrica, para quem nunca escolheu. */
const ABA_PADRAO = 'semanal';

/** Aba ativa: 'semanal' | 'vip'. Nasce no padrao e vira a LEMBRADA no init(),
 * que e onde `_preferences` ja existe. */
PasseIdle.activeTab = ABA_PADRAO;

let _avisoTimer = null;

/** Posicao da janela e a aba em que o jogador estava. Versao continua 1.0: ver
 * a conta no cabecalho de memoriaDeAba.js. */
const _preferences = Preferences.get(
	'PasseIdle',
	{
		x: null,
		y: null,
		aba: null
	},
	1.0
);

function _root() {
	return PasseIdle._shadow || PasseIdle._host;
}

/** Mesmo helper privado de MissoesIdle.js / IdleConfig.js / HuntMap.js. */
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

/**
 * `20260927` -> `27/09`.
 *
 * O ano fica de fora de propósito: um passe dura no máximo 30 dias, então o
 * ano nunca desambigua nada e só rouba espaço da linha.
 */
function dataCurta(yyyymmdd) {
	const n = Number(yyyymmdd) || 0;
	if (n <= 0) {
		return '—';
	}
	const dia = String(n % 100).padStart(2, '0');
	const mes = String(Math.trunc(n / 100) % 100).padStart(2, '0');
	return dia + '/' + mes;
}

/**
 * ESQUECE O PERSONAGEM ANTERIOR — ver a nota gêmea em MissoesIdle.js.
 * `cleanGameUI()` não limpa componentes RAGIDLE, e a troca de personagem não
 * recarrega a página: sem isto, o passe de um personagem apareceria na janela
 * do outro até o primeiro pedido voltar.
 */
PasseIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	PasseIdle.estado = null;
	/*
	 * A ABA VOLTA PARA A LEMBRADA, e nao para 'semanal' (31/08/2026) — mesma
	 * razao registrada na gemea de MissoesIdle.js: a aba e escolha da PESSOA,
	 * nao dado do personagem, e um nome de aba nao carrega nada do anterior.
	 */
	PasseIdle.activeTab = abaLembrada(_preferences, ABA_PADRAO, ABAS);
	/*
	 * ZERAR O DADO NAO BASTA: `GUIComponent.remove()` so DESANEXA o host,
	 * entao o shadow DOM (com `is-open` e o HTML do personagem anterior)
	 * atravessa a troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.pi-window');
};

PasseIdle.init = function init() {
	const root = _root();
	// A aba em que o jogador estava, antes do primeiro desenho.
	PasseIdle.activeTab = abaLembrada(_preferences, ABA_PADRAO, ABAS);
	// Guardas nos querySelector, pelo motivo registrado em
	// ClassChangeNotice.js:68-88: este init roda dentro de MapEngine.init, e
	// uma exceção aqui derruba o motor de mapa inteiro. A janela é cosmética;
	// o que ela não pode é custar o mundo 3D.
	const fechar = root && root.querySelector('.pi-close');
	if (fechar) {
		fechar.addEventListener('click', onClickClose);
	}
	if (root) {
		root.querySelectorAll('.pi-tab').forEach(btn => btn.addEventListener('click', onClickTab));
		const titulo = root.querySelector('.pi-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		// O botão de compra é redesenhado a cada render, então o listener mora
		// no CORPO e olha o alvo — um listener por render vazaria um a cada
		// troca de aba.
		const corpo = root.querySelector('.pi-body');
		if (corpo) {
			corpo.addEventListener('click', onClickCorpo);
		}
	}

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	render();
};

PasseIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

PasseIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(PasseIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(PasseIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/** Abre/fecha; ao abrir, pede o estado ao servidor. */
PasseIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.pi-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		PasseIdle.focus();
		Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_PASSE());
	}
};

/*
 * `abrirNaAba(aba)` morou aqui de 21/09/2026 (manha) a 21/09/2026 (noite): a
 * Temporada a chamava para abrir ESTA janela na aba VIP em vez de repetir a
 * vitrine. Quando a compra do VIP passou a morar na propria Temporada, a
 * porta ficou sem chamador e saiu - porta sem chamador e a forma de codigo
 * morto que este projeto mais catalogou (ver `modulo-puro-sem-chamador`).
 */

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.pi-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	const tab = e.currentTarget.dataset.tab;
	if (!tab || tab === PasseIdle.activeTab) {
		return;
	}
	PasseIdle.activeTab = tab;
	lembrarAba(_preferences, PasseIdle.activeTab);
	render();
}

/** Delegação: o único clique que o corpo trata é o de comprar. */
function onClickCorpo(e) {
	const botao = e.target && e.target.closest && e.target.closest('.pi-comprar');
	if (!botao || botao.disabled) {
		return;
	}
	e.stopImmediatePropagation();
	const tipo = botao.dataset.tipo;
	if (tipo !== 'vip' && tipo !== 'semanal') {
		return;
	}
	/*
	 * O botão trava até a resposta chegar. Sem isso, dois cliques rápidos
	 * mandariam duas compras — o servidor cobraria as duas, e as duas seriam
	 * válidas (a segunda renova). O jogador teria pago o dobro sem querer.
	 */
	botao.disabled = true;
	Network.sendPacket(new PACKET.CZ.RAGIDLE_COMPRAR_PASSE(tipo));
}

function mostrarAviso(texto, ehErro) {
	const root = _root();
	const aviso = root && root.querySelector('.pi-aviso');
	if (!aviso) {
		return;
	}
	aviso.textContent = texto;
	aviso.classList.toggle('is-erro', !!ehErro);
	aviso.classList.add('is-visivel');
	if (_avisoTimer) {
		clearTimeout(_avisoTimer);
	}
	_avisoTimer = setTimeout(() => {
		aviso.classList.remove('is-visivel');
		_avisoTimer = null;
	}, AVISO_MS);
}

/* ------------------------------------------------------------------ */
/* O desenho                                                           */
/* ------------------------------------------------------------------ */

function passePorTipo(tipo) {
	const lista = (PasseIdle.estado && PasseIdle.estado.passes) || [];
	return lista.find(p => p && p.tipo === tipo) || null;
}

/*
 * O DINHEIRO EM MINOR (RO Shop, 22/09/2026 - CONTRATO.md secao 5). O pacote
 * sobe para `v: 2` e troca o NOME dos campos: `passes[].cash` -> `precoMinor`,
 * `cash` -> `saldoMinor`, `semanal.cashbackTotal` -> `cashbackTotalMinor`,
 * `semanal.dias[].cash` -> `cashMinor`. As duas leituras abaixo aceitam as duas
 * formas (o inteiro antigo e x100, a conta da migracao) e todo numero sai por
 * `formatarRoCash`, o mesmo formato do RO Shop, da HUD e da Temporada.
 */
function precoMinorDoPasse(passe) {
	return minorDePrimeiro(passe, ['preco', 'cash']);
}

function saldoMinorDoEstado(estado) {
	return minorDePrimeiro(estado, ['saldo', 'cash']) || 0;
}

/** A vitrine: nome, resumo e, conforme o estado, preco ou vigencia. */
function vitrineHtml(passe, nome, resumo) {
	const precoMinor = precoMinorDoPasse(passe);
	const preco = passe
		? '<div class="pi-preco"><span class="pi-preco-valor">' +
			escapeHtml(precoMinor === null ? '…' : formatarRoCash(precoMinor)) +
			'</span><span class="pi-preco-unidade">RO Cash</span></div>'
		: '';

	const vigencia = passe && passe.ativo
		? '<div class="pi-vigencia">' +
			'<span class="ri-badge ri-badge--verde">Ativo</span>' +
			'<span class="pi-vigencia-texto">até ' +
			escapeHtml(dataCurta(passe.expiraEm)) +
			' · ' +
			escapeHtml(passe.diasRestantes) +
			(passe.diasRestantes === 1 ? ' dia restante' : ' dias restantes') +
			'</span></div>'
		: '';

	return (
		'<div class="pi-vitrine">' +
		'<div class="pi-vitrine-topo">' +
		'<div><div class="pi-nome">' +
		escapeHtml(nome) +
		'</div><div class="pi-resumo">' +
		escapeHtml(resumo) +
		'</div></div>' +
		preco +
		'</div>' +
		vigencia +
		'</div>'
	);
}

/**
 * QUANDO A RENOVAÇÃO ABRE, em data e hora que o jogador lê (D-1720).
 *
 * ---------------------------------------------------------------------------
 * POR QUE DATA, E NÃO CONTAGEM REGRESSIVA
 * ---------------------------------------------------------------------------
 * O servidor manda um INSTANTE absoluto (`renovaEmMs`, epoch em ms). Uma
 * contagem regressiva ("faltam 5h20") precisaria de `Date.now()` do navegador,
 * e o relógio torto da máquina do jogador deslocaria o texto inteiro — sem
 * nada na tela dizendo que está errado.
 *
 * Desenhar o instante como data e hora LOCAIS não tem esse problema: ele só
 * depende do FUSO do navegador, não de o relógio dele estar certo. O jogador
 * lê "abre dia 22 às 03:00" e compara com o relógio do próprio celular, que é
 * o mesmo que ele já usa para tudo.
 *
 * `null` quando o servidor não mandou o campo (registro velho, ou o botão já
 * está aberto) — nesse caso a nota cai no texto genérico, como antes.
 */
function quandoAbre(renovaEmMs) {
	if (typeof renovaEmMs !== 'number' || !Number.isFinite(renovaEmMs) || renovaEmMs <= 0) {
		return null;
	}
	const d = new Date(renovaEmMs);
	const dois = n => String(n).padStart(2, '0');
	return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + ' às ' + dois(d.getHours()) + ':' + dois(d.getMinutes());
}

/**
 * O botão de compra, com o texto e o estado certos.
 *
 * Três estados, e cada um diz uma coisa diferente: sem passe = "Comprar", com
 * passe = "Renovar" (e a renovação SOMA os dias, o que a nota abaixo explica),
 * sem cash = apagado, dizendo quanto falta.
 */
function acaoHtml(passe, saldoMinor) {
	if (!passe) {
		return '';
	}
	const precoMinor = precoMinorDoPasse(passe) || 0;
	/*
	 * O VEREDITO DO BOTÃO VEM DO SERVIDOR (30/08/2026), e a janela só o desenha.
	 *
	 * Aqui havia `podePagar = cash >= passe.cash` — uma SEGUNDA conta da mesma
	 * regra que o servidor já fazia. Ela acertava enquanto as duas
	 * concordassem, e o dia em que discordassem o jogador veria a errada:
	 * a janela é sempre a que perde, porque o servidor recusa depois do clique.
	 *
	 * O campo `recusa` chega no payload como `null` (pode comprar) ou o motivo.
	 * É o mesmo desenho do Codex (D-851), e ele ganhou um segundo motivo com o
	 * pedido do dono: `ainda-nao-vence`. A regra dele MUDOU em D-1640: era "só
	 * no último dia de calendário" (que abria até quase 48h antes, porque o
	 * passe vence no FIM do dia) e hoje são as últimas 24 HORAS, medidas no
	 * relógio do servidor.
	 */
	const recusa = passe.recusa || null;
	const podeComprar = recusa === null;
	const rotulo = passe.ativo ? 'Renovar' : 'Comprar';
	/*
	 * D-1720: a nota passou a DIZER QUANDO. Antes ela nomeava a regra ("abre
	 * no último dia") e o jogador tinha de voltar amanhã para descobrir se já
	 * era. A regra mudou junto (D-1640: são as últimas 24 HORAS, e não o
	 * último dia de calendário), então o texto velho também estava errado.
	 */
	const abreEm = quandoAbre(passe.renovaEmMs);
	const nota =
		recusa === 'ainda-nao-vence'
			? abreEm
				? 'Seu passe ainda vale. A renovação abre nas últimas 24 horas — dia ' +
					escapeHtml(abreEm) +
					'. Assim o cash não fica preso num benefício que você já tem.'
				: 'Seu passe ainda vale. A renovação abre nas últimas 24 horas — assim o cash não fica preso num benefício que você já tem.'
			: recusa === 'saldo-insuficiente'
				? 'Faltam ' + escapeHtml(formatarRoCash(Math.max(0, precoMinor - saldoMinor))) + ' RO Cash.'
				: passe.ativo
					? 'Renovar SOMA ' + escapeHtml(passe.dias) + ' dias ao que falta — você não perde o que já pagou.'
					: 'O valor sai do seu saldo de cash na hora.';

	return (
		'<div class="pi-acao">' +
		'<button type="button" class="pi-comprar ri-btn ri-btn--ouro" data-tipo="' +
		escapeHtml(passe.tipo) +
		'"' +
		(podeComprar ? '' : ' disabled') +
		'>' +
		escapeHtml(rotulo) +
		' · ' +
		escapeHtml(formatarRoCash(precoMinor)) +
		' RO Cash</button>' +
		'<div class="pi-nota">' +
		nota +
		'</div>' +
		'</div>'
	);
}

/** A aba Semanal: vitrine, trilha de sete dias e o botão. */
function semanalHtml() {
	const estado = PasseIdle.estado;
	const passe = passePorTipo('semanal');
	const semanal = (estado && estado.semanal) || { dias: [], cashbackTotal: 0 };
	const cash = saldoMinorDoEstado(estado);

	/*
	 * A PORCENTAGEM E DERIVADA, e nao escrita a mao.
	 *
	 * O dono ja disse que o preco pode mudar ("100 cash, podendo ser modificado
	 * no futuro"). Um "20%" cravado aqui viraria mentira no dia em que o preco
	 * ou a tabela mudassem — e mentira em vitrine de produto pago e a pior
	 * classe de numero envelhecido que este projeto persegue.
	 *
	 * O servidor manda `cashbackTotal` (a soma da tabela) e o preco; a conta
	 * sai dos dois, entao ela acompanha sozinha.
	 */
	const precoDoSemanal = precoMinorDoPasse(passe) || 0;
	const pct = passe && precoDoSemanal > 0
		? Math.round(((minorDePrimeiro(semanal, ['cashbackTotal']) || 0) / precoDoSemanal) * 100)
		: 0;
	const resumo = passe
		? passe.dias + ' dias · ' + pct + '% de cashback no final'
		: '';

	const dias = (semanal.dias || [])
		.map(d => {
			const entregue = passe && passe.ativo && d.dia <= passe.entregues;
			const hoje = passe && passe.ativo && d.dia === passe.diaDoCiclo && !entregue;
			const premio = d.dia === (semanal.dias || []).length;
			const classes = [
				'pi-dia',
				entregue ? 'is-entregue' : '',
				hoje ? 'is-hoje' : '',
				premio ? 'is-premio' : ''
			]
				.filter(Boolean)
				.join(' ');
			const itens = (d.itens || [])
				.map(i => escapeHtml(i.quantidade) + '× ' + escapeHtml(i.nome))
				.join('<br>');
			return (
				'<div class="' +
				classes +
				'"><span class="pi-dia-num">Dia ' +
				escapeHtml(d.dia) +
				'</span>' +
				'<span class="pi-dia-cash">+' +
				escapeHtml(formatarRoCash(minorDePrimeiro(d, ['cash']) || 0)) +
				' RO Cash</span>' +
				'<span class="pi-dia-item">' +
				itens +
				'</span>' +
				(entregue ? '<span class="pi-dia-check">✓</span>' : '') +
				'</div>'
			);
		})
		.join('');

	return (
		vitrineHtml(passe, 'Passe Semanal', resumo) +
		'<div class="pi-secao"><div class="pi-secao-titulo">O que chega, dia a dia</div>' +
		'<div class="pi-trilha">' +
		dias +
		'</div></div>' +
		'<div class="ri-divisor"></div>' +
		acaoHtml(passe, cash)
	);
}

/** A aba VIP: vitrine e os bônus, um por linha. */
function vipHtml() {
	const estado = PasseIdle.estado;
	const passe = passePorTipo('vip');
	const vip = (estado && estado.vip) || {};
	const cash = saldoMinorDoEstado(estado);

	/*
	 * D-season1 (Luz & Trevas): o VIP mudou de conta — +15% em todo item que
	 * NÃO é carta (antes só "equipamento") e +10% RELATIVO em toda carta
	 * (antes "carta de MVP", e a conta era outra). O servidor manda as chaves
	 * NOVAS (`dropComum`/`dropCarta`); o `??` mantém compatibilidade com um
	 * payload antigo em cache (reconexão no meio de um deploy), que ainda
	 * mandaria `dropEquipamento`/`dropCartaMvp`.
	 */
	const linhas = [
		[vip.expBase, 'de experiência de base'],
		[vip.expJob, 'de experiência de classe'],
		[vip.dropComum ?? vip.dropEquipamento, 'de drop de itens comuns'],
		[vip.dropCarta ?? vip.dropCartaMvp, 'relativo na chance de cartas']
	]
		.filter(l => typeof l[0] === 'number')
		.map(
			l =>
				'<div class="pi-bonus-linha"><span class="pi-bonus-valor">+' +
				escapeHtml(l[0]) +
				'%</span><span class="pi-bonus-texto">' +
				escapeHtml(l[1]) +
				'</span></div>'
		);

	if (typeof vip.comandos === 'number' && vip.comandos > 0) {
		linhas.push(
			'<div class="pi-bonus-linha"><span class="pi-bonus-valor">' +
				escapeHtml(vip.comandos) +
				'</span><span class="pi-bonus-texto">comandos exclusivos no chat</span></div>'
		);
	}

	const resumo = passe ? passe.dias + ' dias de vantagem em tudo o que você caça.' : '';

	return (
		vitrineHtml(passe, 'VIP', resumo) +
		'<div class="pi-secao"><div class="pi-secao-titulo">O que o VIP dá</div>' +
		'<div class="pi-bonus">' +
		linhas.join('') +
		'</div></div>' +
		'<div class="ri-divisor"></div>' +
		acaoHtml(passe, cash)
	);
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}

	const carteira = root.querySelector('.pi-carteira-valor');
	if (carteira) {
		carteira.textContent = formatarRoCash(saldoMinorDoEstado(PasseIdle.estado));
	}

	root.querySelectorAll('.pi-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.tab === PasseIdle.activeTab);
	});

	const corpo = root.querySelector('.pi-body');
	if (!corpo) {
		return;
	}
	if (!PasseIdle.estado) {
		corpo.innerHTML = '<div class="pi-carregando">Carregando…</div>';
		return;
	}
	corpo.innerHTML = PasseIdle.activeTab === 'vip' ? vipHtml() : semanalHtml();
}

/* ------------------------------------------------------------------ */
/* O pacote                                                            */
/* ------------------------------------------------------------------ */

function onPasseRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[PasseIdle] payload nao e JSON valido', err);
		return;
	}
	/* `v: 2` desde o RO Shop (22/09/2026): o dinheiro em MINOR com nome novo
	   (CONTRATO.md do RO Shop, secao 5). Esta janela e a DONA do 0x0fe5 e
	   repassa o estado para a Temporada logo abaixo - recusar a v2 aqui deixaria
	   a aba VIP da Temporada em "Carregando..." para sempre. */
	if (!dados || (dados.v !== 1 && dados.v !== 2)) {
		return;
	}
	PasseIdle.estado = dados;
	render();

	/*
	 * O aviso vem DEPOIS do render: ele fala sobre o estado novo, e mostrá-lo
	 * antes deixaria a tela dizendo uma coisa e o texto outra por um quadro.
	 */
	const comprou = dados.comprou;
	if (comprou && comprou.ok) {
		const passe = passePorTipo(comprou.tipo);
		const nome = comprou.tipo === 'vip' ? 'VIP' : 'Passe Semanal';
		mostrarAviso(
			nome + ' ativo até ' + dataCurta(passe && passe.expiraEm) + '.',
			false
		);
	} else if (comprou && !comprou.ok) {
		mostrarAviso(comprou.motivo || 'nao foi possivel comprar', true);
	}

	/*
	 * QUEM MAIS SE INTERESSA PELO PASSE E AVISADO AQUI, e nunca por um
	 * segundo `hookPacket` no mesmo opcode. `Network.hookPacket` faz
	 * `Packets.list[id].callback = callback` (NetworkManager.js): ele
	 * SUBSTITUI, nao soma. Um segundo gancho no 0x0fe5 rouba o pacote desta
	 * janela e ela fica em "Carregando..." para sempre - foi o que a
	 * TemporadaIdle fez, e foi para producao em 21/09/2026.
	 *
	 * O ouvinte vai em try/catch porque ele e de OUTRA janela: uma excecao
	 * dele nao pode derrubar esta, e no laco de rede do cliente uma excecao
	 * num handler descarta o resto do quadro.
	 */
	if (typeof PasseIdle.aoReceberEstado === 'function') {
		try {
			PasseIdle.aoReceberEstado(dados);
		} catch (err) {
			console.error('[PasseIdle] ouvinte de estado lancou', err);
		}
	}
}

/* ESTA JANELA E A DONA DO 0x0fe5 - ver o bloco acima antes de somar outro
 * `hookPacket` neste opcode em qualquer arquivo do cliente. */
Network.hookPacket(PACKET.ZC.RAGIDLE_PASSE, onPasseRecebido);

export default UIManager.addComponent(PasseIdle);
