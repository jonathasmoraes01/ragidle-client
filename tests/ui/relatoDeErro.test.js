/**
 * O relato de erro do cliente (09/09/2026): as quatro regras que ele obedece,
 * medidas no fonte. Ele nao importa em Node (usa `window`), entao o portao le o
 * arquivo — o mesmo formato dos vizinhos desta pasta.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JS = readFileSync(join(AQUI, '..', '..', 'src', 'UI', 'relatoDeErro.js'), 'utf8');
const MOTOR = readFileSync(join(AQUI, '..', '..', 'src', 'Engine', 'GameEngine.js'), 'utf8');

describe('o relato de erro', () => {
  it('NUNCA atrapalha o jogo: tudo em try, e o envio engole a falha', () => {
    expect(JS).toContain('catch (e) {');
    expect(JS).toContain('.catch(function () {})');
  });

  it('nao repete a MESMA mensagem — erro em laco de render mandaria 60 por segundo', () => {
    expect(JS).toContain('if (jaVistos[chave]) return;');
  });

  it('tem teto por sessao, para o erro NOVO a cada quadro tambem parar', () => {
    expect(JS).toContain('if (enviados >= TETO_POR_SESSAO) return;');
    expect(JS).toContain('var TETO_POR_SESSAO = 10;');
  });

  it('nao manda dado de jogador — so mensagem, pilha, tela e versao', () => {
    const corpo = JS.slice(JS.indexOf('JSON.stringify({'), JS.indexOf('keepalive'));
    expect(corpo).toContain('mensagem');
    expect(corpo).toContain('pilha');
    expect(corpo).toContain('tela');
    expect(corpo).toContain('versao');
    for (const proibido of ['nome', 'conta', 'personagem', 'senha']) {
      expect(corpo, proibido).not.toContain(proibido);
    }
  });

  it('escuta os DOIS ganchos: `error` e a promessa rejeitada', () => {
    expect(JS).toContain("addEventListener('error'");
    expect(JS).toContain("addEventListener('unhandledrejection'");
  });

  it('liga ANTES do login — a tela preta de 08/09 aconteceu antes dele', () => {
    const i = MOTOR.indexOf('ligarRelatoDeErro()');
    expect(i).toBeGreaterThan(0);
    expect(MOTOR.indexOf('function loadFiles')).toBeLessThan(i);
    expect(MOTOR).toContain("from 'UI/relatoDeErro.js'");
  });
});
