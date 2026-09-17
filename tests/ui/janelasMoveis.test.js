/**
 * AS DUAS FAIXAS QUE PASSARAM A SE MOVER (D-1565) — o placar do MVP e a lista
 * de grupo.
 *
 * Pedido do dono (17/09/2026): *"quero que seja possível movimentar/minimizar a
 * janela do ranking de dano no MVP... e que também seja possível movimentar a
 * janela de party (aquela que fica ativa quando você está em party, no canto
 * superior esquerdo)"*.
 *
 * As duas são FAIXAS, e não janelas: elas não engolem clique, e é isso que
 * permite jogar com elas na tela. O que este arquivo prende é justamente o que
 * pode se perder ao torná-las móveis — o corpo continuar transparente ao
 * clique, a alça receber o dedo, e a regra do celular ceder ao arrasto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const placar = join(process.cwd(), 'src/UI/Components/PlacarMvpIdle');
const party = join(process.cwd(), 'src/UI/Components/PartyHud');
const placarHtml = readFileSync(join(placar, 'PlacarMvpIdle.html'), 'utf8');
const placarCss = readFileSync(join(placar, 'PlacarMvpIdle.css'), 'utf8');
const placarJs = readFileSync(join(placar, 'PlacarMvpIdle.js'), 'utf8');
const partyHtml = readFileSync(join(party, 'PartyHud.html'), 'utf8');
const partyCss = readFileSync(join(party, 'PartyHud.css'), 'utf8');
const partyJs = readFileSync(join(party, 'PartyHud.js'), 'utf8');
const commonCss = readFileSync(join(process.cwd(), 'src/UI/Common.css'), 'utf8');

/**
 * O bloco `:host { ... }` inteiro.
 *
 * Ele e recortado ate a chave de FECHAMENTO na coluna zero, e nao por
 * `[^}]*`: um comentario dentro do bloco pode ter chave — e teve. A medida que
 * este arquivo fazia quebrou no dia em que a nota do lugar novo citou
 * `{y:12, h:314}`, que e a cicatriz "ancora lida com filtro nao existe" na
 * forma mais literal.
 */
function blocoDoHost(css) {
	const i = css.indexOf(':host {');
	const fim = css.indexOf('\n}', i);
	return i < 0 || fim < 0 ? '' : css.slice(i, fim);
}

describe('o placar do MVP se move e se recolhe', () => {
	it('a alca existe, e o arrasto dela e por PONTEIRO', () => {
		expect(placarHtml).toContain('class="pm-alca"');
		expect(placarJs).toContain('arrastarPorPonteiro({');
		expect(placarJs).toMatch(/const alca = root\.querySelector\('\.pm-alca'\);/);
		expect(placarJs).toMatch(/arrastarPorPonteiro\(\{\r?\n\t\talca,/);
	});

	it('SO a alca recebe toque — o corpo continua deixando o clique passar', () => {
		/*
		 * Esta e a propriedade que faz a faixa ser jogavel: o jogador clica na
		 * CENA atraves dela. A sonda `diag-placar-mvp-na-tela.ts` (repositorio
		 * do servidor) mede isso no centro do placar, e um `pointer-events:
		 * auto` no corpo a derrubaria — e derrubaria o jogo junto.
		 */
		expect(blocoDoHost(placarCss)).toMatch(/pointer-events:\s*none/);
		expect(placarCss).toMatch(/\.pm-alca \{[^}]*pointer-events:\s*auto/);
		expect(placarCss).not.toMatch(/\.pm-corpo \{[^}]*pointer-events:\s*auto/);
	});

	it('o primeiro gesto troca a centralizacao por pixel — a faixa nao pula', () => {
		// `transform: translateX(-50%)` e `left` em pixel se somam: sem esta
		// troca o placar salta meia largura no primeiro arrasto.
		expect(placarCss).toContain('transform: translateX(-50%);');
		expect(placarJs).toContain('function fixarPosicaoEmPixel()');
		expect(placarJs).toContain("host.style.transform = 'none';");
		expect(placarJs).toMatch(/alca\.addEventListener\('pointerdown', fixarPosicaoEmPixel\);/);
	});

	it('o minimizar existe, tem nome acessivel e NAO vira arrasto', () => {
		expect(placarHtml).toContain('class="pm-minimizar"');
		expect(placarHtml).toMatch(/aria-label="Recolher o placar do MVP"/);
		expect(placarJs).toContain('event.stopPropagation();');
		expect(placarJs).toContain('PlacarMvpIdle.alternarCompacto();');
		expect(placarCss).toContain('.pm-placar.is-compact .pm-corpo { display: none; }');
	});

	it('recolhido, sobra um ROTULO legivel — e nao uma barra muda (D-1567)', () => {
		// Queixa do dono: o "−" "nao esta funcionando, deveria minimizar para
		// aparecer um icone (ou apenas um titulo: Top Dano - MVP)". O titulo do
		// placar mora no CORPO, que o recolhido esconde — sem este rotulo a
		// faixa virava uma barrinha sem nome.
		expect(placarHtml).toContain('class="pm-rotulo"');
		expect(placarHtml).toContain('Top Dano');
		expect(placarCss).toContain('.pm-placar.is-compact .pm-rotulo { display: block; }');
		expect(placarCss).toMatch(/\.pm-rotulo \{[^}]*display:\s*none/);
	});

	it('o recolhido e a posicao sao LEMBRADOS entre sessoes', () => {
		expect(placarJs).toContain("Preferences.get(\n\t'PlacarMvpIdle'");
		expect(placarJs).toContain('_preferences.save();');
		expect(placarJs).toContain('PlacarMvpIdle.onAppend = function onAppend()');
		expect(placarJs).toContain('prenderNaTela(host);');
	});

	it('o botao tem alvo TATIL, sem engordar a faixa', () => {
		expect(placarCss).toMatch(/\.pm-minimizar::before \{[^}]*inset:\s*-14px/);
	});
});

describe('a lista de grupo se move', () => {
	it('a alca existe e arrasta por ponteiro, com a lista ainda transparente', () => {
		expect(partyHtml).toContain('class="ph-alca"');
		expect(partyJs).toContain('arrastarPorPonteiro({');
		expect(blocoDoHost(partyCss)).toMatch(/pointer-events:\s*none/);
		expect(partyCss).toMatch(/\.ph-alca \{[^}]*pointer-events:\s*auto/);
	});

	it('a posicao e guardada, e prendida na tela ao voltar', () => {
		expect(partyJs).toMatch(/Preferences\.get\(\r?\n\t'PartyHud'/);
		expect(partyJs).toContain('PartyHud.onAppend = function onAppend()');
		expect(partyJs).toContain('prenderNaTela(host);');
	});

	it('a alca tem alvo tatil de sobra, sem crescer na tela', () => {
		expect(partyCss).toMatch(/\.ph-alca::before \{[^}]*inset:\s*-10px -4px/);
	});
});

describe('o celular em pe (a regra do dono de 08/09/2026)', () => {
	it('a lista de grupo DEIXOU de ser escondida no retrato', () => {
		// Ate 17/09 ela era `display: none !important` — e faixa escondida nao
		// se move, que era o pedido.
		expect(partyCss).not.toContain('display: none !important;');
		expect(partyCss).toMatch(/:host-context\(html\.ri-vertical\) \.ph-hud \{[^}]*width:\s*132px/);
		expect(commonCss).toContain('html.ri-vertical #PartyHud:not([data-movido])');
	});

	it('a regra do celular CEDE quando o jogador arrasta', () => {
		/*
		 * As regras do retrato sao `!important` e venceriam a posicao inline do
		 * arrasto: no celular a faixa voltaria sozinha para o canto, e o gesto
		 * pareceria quebrado. O carimbo `data-movido` desarma a regra.
		 */
		expect(commonCss).toContain('html.ri-vertical #PlacarMvpIdle:not([data-movido])');
		expect(placarJs).toContain("host.dataset.movido = '1';");
		expect(partyJs).toContain("host.dataset.movido = '1';");
	});

	it('as duas ancoram abaixo do topo — nao cruzam com o cartao de missoes', () => {
		expect(commonCss).toMatch(/#PartyHud:not\(\[data-movido\]\) \{[^}]*--vr-abaixo-do-topo/);
		expect(commonCss).toMatch(/#PlacarMvpIdle:not\(\[data-movido\]\) \{[^}]*--vr-abaixo-do-topo/);
	});
});
