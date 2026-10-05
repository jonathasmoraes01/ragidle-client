/**
 * A JANELA "AMIGOS" (05/10/2026, sugestao de jogador que o dono pediu).
 *
 * Tres partes:
 *  1. o CONTROLADOR no jsdom, com o HTML de verdade: Online/Offline com a
 *     contagem, os botoes so nos online, a mensagem e o convite, as recusas
 *     visiveis (sem grupo, sem ser lider, ja no grupo, grupo cheio, noutro
 *     grupo), o adicionar por nome e o remover com confirmacao;
 *  2. as frases das respostas do servidor (convite, amizade, fala do Logs);
 *  3. a COSTURA, lendo o fonte (o MapEngine nao carrega no jsdom): o botao do
 *     menu nos DOIS switches, a pilha, a limpeza da troca de personagem, e
 *     nenhum `hookPacket` novo (os pacotes tem um dono so).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	criarControladorDosAmigos,
	falaDosAmigos,
	MAX_AMIGOS,
	separarAmigos,
	textoDaRespostaDoConvite,
	textoDoResultadoDeAmizade
} from 'UI/Components/AmigosIdle/controladorDosAmigos.js';

const ler = rel => readFileSync(join(process.cwd(), rel), 'utf8');
const HTML = ler('src/UI/Components/AmigosIdle/AmigosIdle.html');

const ANA = { AID: 2000001, GID: 150001, Name: 'Ana', State: 0 };
const BETO = { AID: 2000002, GID: 150002, Name: 'beto', State: 1 };
const CARLA = { AID: 2000003, GID: 150003, Name: 'Carla' }; // sem estado = offline
const DUDA = { AID: 2000004, GID: 150004, Name: 'Duda', State: 0 };

function montar({ grupo = { temGrupo: true, souLider: true }, membros = [], eu = 'Eu' } = {}) {
	const raiz = document.createElement('div');
	raiz.innerHTML = HTML;
	document.body.appendChild(raiz);
	const chamadas = [];
	const c = criarControladorDosAmigos({
		raiz,
		pedirAmizade: nome => chamadas.push(['amizade', nome]),
		removerAmigo: amigo => chamadas.push(['remover', amigo.GID]),
		sussurrar: nome => chamadas.push(['mensagem', nome]),
		convidar: nome => chamadas.push(['convidar', nome]),
		grupo: () => grupo,
		ehDoMeuGrupo: nome => membros.includes(nome),
		meuNome: () => eu
	});
	const $ = sel => raiz.querySelector(sel);
	const $$ = sel => [...raiz.querySelectorAll(sel)];
	const nomes = lista => $$(`.am-lista-${lista} .am-linha .am-nome`).map(e => e.textContent);
	const botao = (gid, acao) => $(`[data-acao="${acao}"][data-gid="${gid}"]`);
	const recado = () => $('.am-recado').textContent;
	const tom = () => $('.am-recado').className;
	const digitar = v => {
		$('.am-campo').value = v;
	};
	return { c, chamadas, raiz, $, $$, nomes, botao, recado, tom, digitar };
}

/* ================================================================== */
/* 1. O controlador                                                    */
/* ================================================================== */

describe('a janela "Amigos": a lista', () => {
	it('separa Online e Offline, em ordem alfabetica, com a contagem de cada uma e o total', () => {
		const t = montar();
		t.c.receberLista([BETO, DUDA, CARLA, ANA]);
		expect(t.nomes('online')).toEqual(['Ana', 'Duda']);
		expect(t.nomes('offline')).toEqual(['beto', 'Carla']);
		expect(t.$('.am-contagem-online').textContent).toBe('2');
		expect(t.$('.am-contagem-offline').textContent).toBe('2');
		expect(t.$('.am-total').textContent).toBe(`4/${MAX_AMIGOS}`);
	});

	it('Mensagem e Convidar so existem no amigo ONLINE; o offline so tem o remover', () => {
		const t = montar();
		t.c.receberLista([ANA, BETO]);
		expect(t.botao(ANA.GID, 'mensagem')).not.toBeNull();
		expect(t.botao(ANA.GID, 'convidar')).not.toBeNull();
		expect(t.botao(BETO.GID, 'mensagem')).toBeNull();
		expect(t.botao(BETO.GID, 'convidar')).toBeNull();
		expect(t.botao(BETO.GID, 'remover')).not.toBeNull();
	});

	it('ao vivo: o amigo que entra sobe para Online, o que sai desce para Offline', () => {
		const t = montar();
		t.c.receberLista([ANA, BETO]);
		t.c.receberLista([{ ...ANA, State: 1 }, { ...BETO, State: 0 }]);
		expect(t.nomes('online')).toEqual(['beto']);
		expect(t.nomes('offline')).toEqual(['Ana']);
	});

	it('lista vazia diz como adicionar; sem ninguem online diz isso, e nao uma lista em branco', () => {
		const t = montar();
		t.c.receberLista([]);
		expect(t.$('.am-lista-online').textContent).toContain('Adicione pelo nome');
		t.c.receberLista([BETO]);
		expect(t.$('.am-lista-online').textContent).toBe('Nenhum amigo online agora.');
	});

	it('o nome do jogador nao e traduzido nem vira HTML', () => {
		const t = montar();
		t.c.receberLista([{ ...ANA, Name: '<b>x</b>' }]);
		const nome = t.$('.am-lista-online .am-nome');
		expect(nome.textContent).toBe('<b>x</b>');
		expect(nome.getAttribute('translate')).toBe('no');
	});
});

describe('a janela "Amigos": mensagem e convite', () => {
	it('Mensagem abre o sussurro com o nome do amigo', () => {
		const t = montar();
		t.c.receberLista([ANA]);
		expect(t.c.clicar(t.botao(ANA.GID, 'mensagem'))).toBe('mensagem');
		expect(t.chamadas).toEqual([['mensagem', 'Ana']]);
	});

	it('Convidar (lider de grupo) manda o convite e avisa que espera a resposta', () => {
		const t = montar();
		t.c.receberLista([ANA]);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.chamadas).toEqual([['convidar', 'Ana']]);
		expect(t.recado()).toBe('Convite para o grupo enviado a Ana. Aguarde a resposta.');
	});

	it('sem grupo: a recusa aparece NA janela e nada sai', () => {
		const t = montar({ grupo: { temGrupo: false, souLider: false } });
		t.c.receberLista([ANA]);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.chamadas).toEqual([]);
		expect(t.recado()).toContain('não está num grupo');
		expect(t.tom()).toContain('is-erro');
	});

	it('em grupo mas sem ser o lider: recusa visivel, nada sai', () => {
		const t = montar({ grupo: { temGrupo: true, souLider: false } });
		t.c.receberLista([ANA]);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.chamadas).toEqual([]);
		expect(t.recado()).toBe('Só o líder do grupo pode convidar.');
	});

	it('o amigo ja esta no MEU grupo: recusa visivel, nada sai', () => {
		const t = montar({ membros: ['Ana'] });
		t.c.receberLista([ANA]);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.chamadas).toEqual([]);
		expect(t.recado()).toBe('Ana já está no seu grupo.');
	});

	it('a resposta do servidor: grupo cheio (3) e noutro grupo (0) aparecem em vermelho; entrou (2) em verde', () => {
		const t = montar();
		t.c.receberLista([ANA, DUDA]);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.c.receberRespostaDoConvite(3, 'Ana')).toBe(true);
		expect(t.recado()).toBe('O seu grupo está cheio.');
		expect(t.tom()).toContain('is-erro');

		t.c.clicar(t.botao(DUDA.GID, 'convidar'));
		t.c.receberRespostaDoConvite(0, 'Duda');
		expect(t.recado()).toContain('Duda já está em outro grupo');
		expect(t.tom()).toContain('is-erro');

		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		t.c.receberRespostaDoConvite(2, 'Ana');
		expect(t.recado()).toBe('Ana entrou no seu grupo.');
		expect(t.tom()).toContain('is-ok');
	});

	it('a resposta de um convite que NAO saiu desta janela nao mexe no recado', () => {
		const t = montar();
		t.c.receberLista([ANA]);
		expect(t.c.receberRespostaDoConvite(3, 'Ana')).toBe(false);
		t.c.clicar(t.botao(ANA.GID, 'convidar'));
		expect(t.c.receberRespostaDoConvite(1, 'Outro')).toBe(false);
		expect(t.recado()).toBe('Convite para o grupo enviado a Ana. Aguarde a resposta.');
	});

	it('o botao de um amigo que ficou offline nao manda nada (clique velho)', () => {
		const t = montar();
		t.c.receberLista([ANA]);
		const velho = t.botao(ANA.GID, 'convidar');
		t.c.receberLista([{ ...ANA, State: 1 }]);
		expect(t.c.clicar(velho)).toBe(null);
		expect(t.chamadas).toEqual([]);
	});

	it('mesmo com um botao de acao DENTRO da janela, amigo offline nao recebe mensagem nem convite', () => {
		// O redesenho tira o botao velho da arvore; esta guarda e a segunda
		// linha, para um botao que sobre (outra extensao do HTML, um redesenho
		// que atrasou) nunca mandar convite a quem saiu.
		const t = montar();
		t.c.receberLista([BETO]);
		for (const acao of ['convidar', 'mensagem']) {
			const b = document.createElement('button');
			b.dataset.acao = acao;
			b.dataset.gid = String(BETO.GID);
			t.$('.am-lista-offline').appendChild(b);
			expect(t.c.clicar(b)).toBe(null);
		}
		expect(t.chamadas).toEqual([]);
	});
});

describe('a janela "Amigos": adicionar e remover', () => {
	it('adicionar pelo nome aparado manda o pedido e limpa o campo', () => {
		const t = montar();
		t.c.receberLista([]);
		t.digitar('  Ana  ');
		expect(t.c.adicionar()).toBe(true);
		expect(t.chamadas).toEqual([['amizade', 'Ana']]);
		expect(t.$('.am-campo').value).toBe('');
		expect(t.recado()).toBe('Pedido de amizade enviado a Ana. Aguarde a resposta.');
	});

	it('nome vazio, o proprio nome ou quem ja e amigo: recusa visivel e nada sai', () => {
		const t = montar({ eu: 'Eu' });
		t.c.receberLista([ANA]);
		t.digitar('   ');
		expect(t.c.adicionar()).toBe(false);
		expect(t.recado()).toBe('Digite o nome do personagem.');
		t.digitar('Eu');
		expect(t.c.adicionar()).toBe(false);
		expect(t.recado()).toBe('Esse é você.');
		t.digitar('Ana');
		expect(t.c.adicionar()).toBe(false);
		expect(t.recado()).toBe('Ana já é seu amigo.');
		expect(t.chamadas).toEqual([]);
	});

	it('as respostas do servidor ao pedido aparecem na janela', () => {
		const t = montar();
		t.c.receberLista([]);
		t.digitar('Ana');
		t.c.adicionar();
		expect(t.c.receberFala('Amigos : Personagem nao encontrado.')).toBe(true);
		expect(t.recado()).toContain('Ninguém online com esse nome');
		expect(t.tom()).toContain('is-erro');
		t.c.receberResultadoDeAmizade(0, 'Ana');
		expect(t.recado()).toBe('Ana agora é seu amigo.');
		expect(t.tom()).toContain('is-ok');
		t.c.receberResultadoDeAmizade(1, 'Beto');
		expect(t.recado()).toBe('Beto recusou o pedido de amizade.');
	});

	it('remover pede confirmacao na propria linha; Cancelar desfaz; Remover manda o par (AID, GID)', () => {
		const t = montar();
		t.c.receberLista([ANA, BETO]);
		t.c.clicar(t.botao(BETO.GID, 'remover'));
		expect(t.chamadas).toEqual([]);
		expect(t.$(`.am-linha.is-confirmando[data-gid="${BETO.GID}"]`)).not.toBeNull();
		t.c.clicar(t.botao(BETO.GID, 'cancelar-remocao'));
		expect(t.$('.am-linha.is-confirmando')).toBeNull();
		t.c.clicar(t.botao(BETO.GID, 'remover'));
		t.c.clicar(t.botao(BETO.GID, 'confirmar-remocao'));
		expect(t.chamadas).toEqual([['remover', BETO.GID]]);
	});

	it('abrir de novo comeca limpo: sem recado e sem confirmacao pendente', () => {
		const t = montar();
		t.c.receberLista([ANA]);
		t.c.clicar(t.botao(ANA.GID, 'remover'));
		t.digitar('');
		t.c.adicionar();
		t.c.aoAbrir();
		expect(t.recado()).toBe('');
		expect(t.$('.am-linha.is-confirmando')).toBeNull();
	});
});

/* ================================================================== */
/* 2. As frases                                                        */
/* ================================================================== */

describe('as frases das respostas', () => {
	it('separarAmigos: estado 0 e online; 1 e sem estado sao offline', () => {
		const { online, offline } = separarAmigos([ANA, BETO, CARLA]);
		expect(online.map(a => a.Name)).toEqual(['Ana']);
		expect(offline.map(a => a.Name)).toEqual(['beto', 'Carla']);
	});

	it('o convite: os codigos de e_party_invite_reply', () => {
		expect(textoDaRespostaDoConvite(5, 'Ana').texto).toBe('Ana desligou os convites de grupo.');
		expect(textoDaRespostaDoConvite(7, 'Ana').texto).toBe('Ana não está online.');
		expect(textoDaRespostaDoConvite(99, 'Ana')).toBeNull();
	});

	it('a amizade: os quatro tipos do 0x0209', () => {
		expect(textoDoResultadoDeAmizade(2, 'Ana').texto).toBe(`Sua lista de amigos está cheia (${MAX_AMIGOS}).`);
		expect(textoDoResultadoDeAmizade(3, 'Ana').texto).toBe('A lista de amigos de Ana está cheia.');
		expect(textoDoResultadoDeAmizade(9, 'Ana')).toBeNull();
	});

	it('a fala do Logs: so a do remetente "Amigos"', () => {
		expect(falaDosAmigos('Amigos : Voces ja sao amigos.\0')).toEqual({ tom: 'erro', texto: 'Vocês já são amigos.' });
		expect(falaDosAmigos('Amigos : Amigo removido.').tom).toBe('ok');
		expect(falaDosAmigos('Sistema : Nao deu para equipar: x')).toBeNull();
		expect(falaDosAmigos(null)).toBeNull();
	});
});

/* ================================================================== */
/* 3. A costura                                                        */
/* ================================================================== */

describe('a costura da janela "Amigos"', () => {
	const MENU_HTML = ler('src/UI/Components/TopMenuIdle/TopMenuIdle.html');
	const MENU_JS = ler('src/UI/Components/TopMenuIdle/TopMenuIdle.js').replace(/\r\n/g, '\n');
	const MAP_ENGINE = ler('src/Engine/MapEngine.js');
	const JANELA = ler('src/UI/Components/AmigosIdle/AmigosIdle.js');

	it('o botao "Amigos" esta no menu, funcional (sem "em breve")', () => {
		const botao = MENU_HTML.match(/<button[^>]*data-action="amigos"[^>]*>/);
		expect(botao, 'o botao de Amigos sumiu do menu').not.toBeNull();
		expect(botao[0]).not.toContain('data-em-breve');
	});

	it('o clique abre a janela, e o aro acende com ela aberta (os DOIS switches)', () => {
		expect(MENU_JS).toMatch(/case 'amigos':\s*AmigosIdle\.toggle\(\);/);
		expect(MENU_JS).toContain("case 'amigos':\n\t\t\treturn isRagIdleWindowOpen(AmigosIdle, '.am-window');");
	});

	it('a janela entra na pilha (ESC, voltar do Android, painel do celular) e na limpeza da troca de personagem', () => {
		expect(MAP_ENGINE).toContain("['amigos', AmigosIdle, '.am-window']");
		expect(MAP_ENGINE).toContain('AmigosIdle.prepare();');
		expect(MAP_ENGINE).toContain('AmigosIdle.append();');
		expect(MAP_ENGINE).toMatch(/PainelComandoIdle,\s*AmigosIdle,\s*PartyHud,/);
	});

	it('nenhum hookPacket na janela: ela ouve os donos dos pacotes', () => {
		expect(JANELA).not.toMatch(/Network\.hookPacket\(/);
		expect(JANELA).toContain('aoMudarAmigos(');
		expect(JANELA).toContain('aoResultadoDeAmizade(');
		expect(JANELA).toContain('aoResponderConvite(');
		expect(JANELA).toContain('ouvirFalaDoSistema(');
		const friends = ler('src/Engine/MapEngine/Friends.js');
		// as cinco mudancas da lista avisam (lista, estado, entrou, saiu, free)
		expect(friends.match(/avisarOuvintesDaLista\(\);/g)).toHaveLength(5);
		expect(friends).toContain('avisarOuvintesDoResultado(pkt.Result, pkt.Name);');
		expect(ler('src/Engine/MapEngine/Group.js')).toContain('funcao(pkt.answer, pkt.characterName);');
		expect(ler('src/Engine/MapEngine/Main.js')).toContain('repassarFalaDoSistema(pkt.msg);');
	});

	it('trocar de personagem esquece a lista do anterior (o 0x0201 so vem quando ha amigo)', () => {
		const corpo = JANELA.slice(JANELA.indexOf('AmigosIdle.limparEstadoDoPersonagem'));
		expect(corpo.slice(0, corpo.indexOf('};'))).toContain('FriendEngine.free();');
	});

	it('no celular a Mensagem fecha a janela antes de abrir o chat (o painel cobre o chat)', () => {
		const corpo = JANELA.slice(JANELA.indexOf('function sussurrar('));
		const fim = corpo.indexOf('\n}');
		expect(corpo.slice(0, fim)).toMatch(/if \(ehCelularEmPe\(\)\) \{\s*closeWindow\(\);\s*\}\s*ChatBox\.sussurrarPara\(nome\);/);
	});
});
