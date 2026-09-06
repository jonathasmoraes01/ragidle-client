/**
 * "LINKAR NO CHAT" — o botão da ficha do item (D-946, 06/09/2026, pedido do
 * dono).
 *
 * O encanamento do link já existia inteiro: `DB.createItemLink` monta a
 * etiqueta `<ITEML>`, o servidor de mapa ecoa os BYTES da fala sem tocar neles
 * e `ChatBox.addText` devolve a etiqueta como `.item-link` clicável, que reabre
 * a ficha. O que faltava era a PORTA — o único gesto que produzia um link era
 * SHIFT+clique na mochila, e **no celular não há SHIFT**.
 *
 * O que estes casos guardam não é "o botão existe": é o que quase fez o botão
 * nascer quebrado. Escrever no `.input-chatbox` não basta, porque esse campo
 * está invisível em três situações que são a REGRA, e não a exceção:
 *
 *   1. a barra de digitação nasce escondida (`ChatBox.onAppend` põe `.input`
 *      em `display:none` e mostra o modo batalha no lugar);
 *   2. no celular o painel inteiro nasce recolhido (D-930), e recolhido a
 *      `.input` sai do fluxo por CSS;
 *   3. três dos quatro canais não digitam — `logs` é só leitura, `trade` troca
 *      o campo pela frase de canal inexistente e `farm` esconde a barra.
 *
 * O SHIFT+clique da mochila ignorava as três desde sempre, e é por isso que ele
 * passou a chamar a mesma porta (o último bloco de casos).
 */

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	CANAIS_QUE_NAO_DIGITAM,
	CANAL_DE_FALA,
	cabeNoLimite,
	markupDoLink,
	preparoParaLinkar
} from 'UI/Components/ChatBox/linkDeItemNoChat.js';

/** O estado bom: chat aberto, no Global, com a barra de digitação à mostra. */
const PRONTO = { recolhido: false, canal: 'global', barraVisivel: true };

describe('preparoParaLinkar', () => {
	it('com o chat pronto, não mexe em nada', () => {
		expect(preparoParaLinkar(PRONTO)).toEqual({
			trocarPara: null,
			expandir: false,
			abrirBarra: false
		});
	});

	it('abre a barra que nasce escondida', () => {
		// `ChatBox.onAppend` põe `.input` em display:none — numa sessão recém
		// aberta o link entraria num campo que ninguém vê.
		expect(preparoParaLinkar({ ...PRONTO, barraVisivel: false }).abrirBarra).toBe(true);
	});

	it('expande o painel recolhido (o padrão do celular, D-930)', () => {
		expect(preparoParaLinkar({ ...PRONTO, recolhido: true }).expandir).toBe(true);
	});

	it.each(CANAIS_QUE_NAO_DIGITAM)('sai do canal "%s", que não digita', canal => {
		expect(preparoParaLinkar({ ...PRONTO, canal }).trocarPara).toBe(CANAL_DE_FALA);
	});

	it('no Global não troca de canal', () => {
		expect(preparoParaLinkar({ ...PRONTO, canal: 'global' }).trocarPara).toBeNull();
	});

	it('os três canais mudos são LOGS, TRADE e FARM — e cada um por um motivo', () => {
		// O quarto canal (`global`) é o único onde a fala do jogador sai. Se
		// alguém tirar um destes da lista, o link volta a entrar num campo que
		// o CSS escondeu.
		expect([...CANAIS_QUE_NAO_DIGITAM].sort()).toEqual(['farm', 'logs', 'trade']);
		expect(CANAIS_QUE_NAO_DIGITAM).not.toContain(CANAL_DE_FALA);
	});

	it('as três preparações são independentes: acumulam no pior caso', () => {
		// O celular, no canal Farm, com a barra fechada — o caso mais comum de
		// todos, e o único em que as três precisam acontecer juntas.
		expect(preparoParaLinkar({ recolhido: true, canal: 'farm', barraVisivel: false })).toEqual({
			trocarPara: 'global',
			expandir: true,
			abrirBarra: true
		});
	});

	it('sem estado nenhum, assume o pior (barra fechada) e não troca de canal', () => {
		expect(preparoParaLinkar()).toEqual({ trocarPara: null, expandir: false, abrirBarra: true });
	});
});

describe('cabeNoLimite', () => {
	/** Uma etiqueta do tamanho real de um Cajado +0 [3] com duas runas. */
	const LINK = '<ITEML>000005i%00&00)0h+02,01-0c</ITEML>';

	it('cabe no campo vazio', () => {
		expect(cabeNoLimite('', LINK, 100)).toBe(true);
	});

	it('conta o texto CRU, e não o nome visível', () => {
		// O que viaja no pacote (e o que `extractChatMessage` devolve) é a
		// etiqueta inteira, e não "<Cajado +0 [3]>" — medir pelo nome deixaria
		// passar mais do que cabe.
		expect(LINK.length).toBeGreaterThan('<Cajado +0 [3]>'.length);
	});

	it('a fronteira é o limite exato, com o espaço que vai depois', () => {
		const folga = 100 - LINK.length - 1;
		expect(cabeNoLimite('x'.repeat(folga), LINK, 100)).toBe(true);
		expect(cabeNoLimite('x'.repeat(folga + 1), LINK, 100)).toBe(false);
	});

	it('recusa quando o campo já está cheio', () => {
		expect(cabeNoLimite('x'.repeat(100), LINK, 100)).toBe(false);
	});
});

describe('markupDoLink', () => {
	const LINK = '<ITEML>000005i%00</ITEML>';

	it('guarda a etiqueta CRUA no data-item', () => {
		// É o `data-item` — e não o texto visível — que `extractChatMessage`
		// devolve no lugar do <span> na hora de enviar.
		const div = document.createElement('div');
		div.innerHTML = markupDoLink(LINK, 'Cajado');
		expect(div.firstChild.dataset.item).toBe(LINK);
	});

	it('leva a classe que o chat procura', () => {
		// `ChatBox._setupItemLinkHandler` e `extractChatMessage` acham o link
		// por `.item-link`. Sem a classe, o span vira texto morto.
		const div = document.createElement('div');
		div.innerHTML = markupDoLink(LINK, 'Cajado');
		expect(div.firstChild.classList.contains('item-link')).toBe(true);
	});

	it('mostra o nome entre < e >, sem virar tag', () => {
		const div = document.createElement('div');
		div.innerHTML = markupDoLink(LINK, 'Cajado +0 [3]');
		expect(div.firstChild.textContent).toBe('<Cajado +0 [3]>');
	});

	it('escapa o nome do item — eles têm aspas e sinais de verdade', () => {
		const div = document.createElement('div');
		div.innerHTML = markupDoLink(LINK, 'Elmo "do" Sol <b>');
		// O nome sai inteiro no texto e NÃO cria elemento nenhum.
		expect(div.firstChild.textContent).toBe('<Elmo "do" Sol <b>>');
		expect(div.firstChild.querySelector('b')).toBeNull();
	});
});

/* ─────────────────────────────────────────────────────────────────────────
   A LIGAÇÃO. Os casos acima medem a decisão; estes medem que ela está ligada
   nos três arquivos — que é o que faltava, não a decisão.
   ───────────────────────────────────────────────────────────────────────── */

const itemInfoHtml = fs.readFileSync('src/UI/Components/ItemInfo/ItemInfo.html', 'utf8');
const itemInfoCss = fs.readFileSync('src/UI/Components/ItemInfo/ItemInfo.css', 'utf8');
const itemInfoJs = fs.readFileSync('src/UI/Components/ItemInfo/ItemInfo.js', 'utf8');
const chatBoxJs = fs.readFileSync('src/UI/Components/ChatBox/ChatBox.js', 'utf8');
const inventoryJs = fs.readFileSync('src/UI/Components/Inventory/InventoryCommon.js', 'utf8');

describe('o botão na ficha do item', () => {
	it('existe no template, com o texto do dono', () => {
		expect(itemInfoHtml).toMatch(/class="link-chat"/);
		expect(itemInfoHtml).toContain('Linkar no chat');
	});

	it('fica DEPOIS da lista de cartas, fora do container', () => {
		// `resize()` calcula `description.height = containerHeight - 45`. Um
		// botão dentro do `.container` entraria nessa conta e sumiria — o
		// contrato dos 45px está declarado no topo do ItemInfo.css.
		expect(itemInfoHtml.indexOf('class="link-chat"')).toBeGreaterThan(itemInfoHtml.indexOf('class="cardlist"'));
		expect(itemInfoHtml.indexOf('class="link-chat"')).toBeGreaterThan(itemInfoHtml.indexOf('class="extend"'));
	});

	it('é opaco: a mochila não pode aparecer por dentro dele', () => {
		// `.ItemInfo` é transparente e só os filhos têm fundo — a mesma
		// armadilha que o `.option-container` documenta (a prova de foto pegou
		// a mochila vazando por dentro da cápsula de runas).
		expect(itemInfoCss).toMatch(/\.ItemInfo \.link-chat \{[^}]*--surface-titlebar/);
		expect(itemInfoCss).not.toMatch(/\.ItemInfo \.link-chat \{[^}]*--surface-card[,)]/);
	});

	it('cresce no dedo até o piso tátil de 44px', () => {
		// O botão existe POR CAUSA do celular; nascer com ~31px de altura seria
		// errar justamente o aparelho que ele veio atender.
		expect(itemInfoCss).toMatch(
			/@media \(pointer: coarse\) \{\s*\.ItemInfo \.link-chat \{\s*min-height: var\(--hit-touch/
		);
	});

	it('leva o EXEMPLAR, e não a ficha genérica do banco', () => {
		// `this.item` é o `DB.getItemInfo(ITID)`: sem refino, sem carta e sem
		// runa. Linkar dele mandaria "Cajado" onde o jogador tem um "Cajado +7
		// [3]" com duas runas.
		expect(itemInfoJs).toContain('this.itemDoLink = item;');
		expect(itemInfoJs).toMatch(/itemParaLink\(this\.itemDoLink\)/);
	});

	it('resolve o `location`, que muda de nome conforme a origem da ficha', () => {
		// `DB.createItemLink` lê só `item.location`; a peça vestida traz
		// `WearState` e a vitrine, `WearLocation`.
		expect(itemInfoJs).toMatch(/function itemParaLink[\s\S]*getPreviewLocation\(item\)/);
	});

	it('chama o chat por UIManager, e não por import — os dois se chamam', () => {
		// O ChatBox já abre esta janela por `UIManager.getComponent('ItemInfo')`
		// pelo mesmo motivo: um par de imports estáticos fecharia o ciclo.
		expect(itemInfoJs).toMatch(/getComponent\('ChatBox'\)/);
		expect(itemInfoJs).not.toContain("import ChatBox from 'UI/Components/ChatBox/ChatBox.js'");
	});
});

describe('a porta no ChatBox', () => {
	it('é pública e é uma só', () => {
		expect(chatBoxJs).toContain('ChatBox.inserirLinkDeItem = function inserirLinkDeItem(item)');
	});

	it('aplica as três preparações antes de escrever', () => {
		const corpo = chatBoxJs.slice(
			chatBoxJs.indexOf('ChatBox.inserirLinkDeItem'),
			chatBoxJs.indexOf('ChatBox.insertText')
		);
		expect(corpo).toContain('preparoParaLinkar');
		expect(corpo).toMatch(/preparo\.trocarPara[\s\S]*switchTab/);
		expect(corpo).toMatch(/preparo\.expandir[\s\S]*definirRecolhido\(false, false\)/);
		expect(corpo).toMatch(/preparo\.abrirBarra/);
	});

	it('expandir para linkar NÃO conta como o jogador escolher o tamanho do chat', () => {
		// D-930: `escolhido` congela o padrão "no celular o chat nasce
		// recolhido". Marcá-lo aqui faria um clique que nunca foi sobre o
		// tamanho do chat decidir o tamanho do chat para sempre.
		//
		// D-948 mudou onde a decisão MORA, e não qual ela é: o chat ganhou três
		// estados, o chevron cicla por `definirEstado`, e `definirRecolhido`
		// virou o atalho de duas posições por cima dele. A bandeira desceu
		// junto, e é isso que as três linhas abaixo cobram — a terceira é NOVA e
		// existe porque a corrente ganhou um elo: `definirRecolhido` pode
		// esquecer de repassar o `false`, e aí o defeito volta inteiro com as
		// duas primeiras ainda verdes.
		expect(chatBoxJs).toContain('function definirEstado(estado, porEscolhaDoJogador = true)');
		expect(chatBoxJs).toMatch(/if \(porEscolhaDoJogador\) \{\s*_recolhido\.escolhido = true;/);
		expect(chatBoxJs).toMatch(
			/function definirRecolhido\(fechar, porEscolhaDoJogador = true\) \{\s*definirEstado\([^)]*porEscolhaDoJogador\)/
		);
	});

	it('os tres seletores que ela usa existem mesmo no template do chat', () => {
		// `.input-chatbox`, `.input` e `.battlemode` sao procurados por NOME. Um
		// erro de digitacao aqui nao quebra nada: as guardas devolvem false e o
		// botao vira um clique que nao faz nada, em silencio.
		const chat = document.createElement('div');
		chat.innerHTML = fs.readFileSync('src/UI/Components/ChatBox/ChatBox.html', 'utf8');
		expect(chat.querySelector('.input-chatbox')).not.toBeNull();
		expect(chat.querySelector('.input')).not.toBeNull();
		expect(chat.querySelector('.battlemode')).not.toBeNull();
	});

	it('cobra o teto de 100 caracteres, que ninguém mais cobra na escrita por código', () => {
		expect(chatBoxJs).toMatch(/cabeNoLimite\(extractChatMessage\(campo\), link, MAX_LENGTH\)/);
	});
});

describe('o SHIFT+clique da mochila', () => {
	it('usa a MESMA porta', () => {
		expect(inventoryJs).toContain('ChatBox.inserirLinkDeItem(item)');
	});

	it('não escreve mais direto no campo de digitação', () => {
		// Era isto que fazia o gesto "não funcionar" numa sessão recém aberta:
		// escrevia num campo invisível e ia embora.
		expect(inventoryJs).not.toMatch(/msgBox\.innerHTML \+=/);
		expect(inventoryJs).not.toMatch(/querySelector\('\.input-chatbox'\)/);
	});
});
