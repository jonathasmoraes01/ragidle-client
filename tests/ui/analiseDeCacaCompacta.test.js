/**
 * O MODO COMPACTO DA ANÁLISE DE CAÇA — pedido do alfa (08/09/2026).
 *
 * *"Adicione um botão na barra de título para alternar entre o painel
 * completo e uma janela reduzida... XP por hora e drops por hora, atualizadas
 * em tempo real... Alternar entre os modos deve preservar o tempo da sessão,
 * as estatísticas e a coleta contínua dos dados."*
 *
 * A preservação é POR CONSTRUÇÃO, e é isso que este arquivo cobra no fonte:
 * o estado da caçada mora em `registroDaCaca.js` (fora da janela), o tique
 * continua no mesmo intervalo, e compactar é uma classe de CSS escondendo o
 * resto — não existe segunda rota de dados para o modo compacto divergir.
 * Levantar a janela de verdade puxa WebGL e sessão logada; o contrato entre
 * HTML, JS e CSS se confere no texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'src/UI/Components/HuntAnalyzer/HuntAnalyzer.html'), 'utf8');
const js = readFileSync(join(process.cwd(), 'src/UI/Components/HuntAnalyzer/HuntAnalyzer.js'), 'utf8');
const css = readFileSync(join(process.cwd(), 'src/UI/Components/HuntAnalyzer/HuntAnalyzer.css'), 'utf8');

describe('o botão na barra de título', () => {
	it('existe, mora no cabeçalho e diz o que faz', () => {
		const header = html.slice(html.indexOf('ha-header'), html.indexOf('ha-abas'));
		expect(header).toContain('ha-compactar');
		expect(header).toContain('title="Modo compacto"');
	});

	it('alterna a classe e o VERBO acompanha — restaurar é o mesmo botão', () => {
		const trecho = js.slice(js.indexOf('function aplicarCompacto'), js.indexOf('function iniciarPolling'));
		expect(trecho).toContain("classList.toggle('is-compacta', ligado)");
		expect(trecho).toContain('Restaurar painel completo');
		expect(trecho).toContain('Modo compacto');
	});

	it('o modo lembrado sobrevive ao F5, como a aba e a posição', () => {
		expect(js).toContain('compacta: false');
		expect(js).toContain('_preferences.compacta = ligado');
		expect(js).toContain('aplicarCompacto(root, _preferences.compacta === true)');
	});
});

describe('o que o compacto mostra — e o que ele NÃO toca', () => {
	it('as métricas pedidas ficam: EXP/h, Classe/h e Drops/h, com unidade no rótulo', () => {
		/*
		 * A distinção base/classe é exigência do pedido ("se houver XP base e
		 * de classe separadas, mantenha essa distinção") e os rótulos são a
		 * unidade. O CSS só esconde o tile de Monstros/h — esconder um dos
		 * três pedidos reprovaria aqui.
		 */
		expect(html).toContain('ha-ritmo--exp');
		expect(html).toContain('ha-ritmo--classe');
		expect(html).toContain('ha-ritmo--drop');
		expect(html).toMatch(/EXP\/h/);
		expect(html).toMatch(/Classe\/h/);
		expect(html).toMatch(/Drops\/h/);
		const compacto = css.slice(css.indexOf('.ha-window.is-compacta'));
		expect(compacto).toContain('.ha-ritmo--monstro');
		expect(compacto).not.toContain('.ha-ritmo--exp');
		expect(compacto).not.toContain('.ha-ritmo--classe');
		expect(compacto).not.toContain('.ha-ritmo--drop');
	});

	it('a cabine (Duração + estado) NÃO é escondida — o tempo da sessão continua na tela', () => {
		const compacto = css.slice(css.indexOf('.ha-window.is-compacta'));
		expect(compacto).not.toContain('.ha-cabine,');
		expect(compacto).not.toContain('.ha-cronometro');
	});

	it('alternar NÃO mexe em dado nem no relógio de coleta', () => {
		/*
		 * O clique chama SÓ `aplicarCompacto`; zerar caçada ou parar o polling
		 * ali quebraria exatamente o que o pedido exige preservar. E
		 * `aplicarCompacto` não conhece o registro — ele toca classe, botão e
		 * preferência, nada mais.
		 */
		const listener = js.slice(js.indexOf("querySelector('.ha-compactar')"), js.indexOf('// O modo lembrado'));
		expect(listener).toContain('aplicarCompacto(root');
		expect(listener).not.toContain('zerar');
		expect(listener).not.toContain('Polling');
		const fn = js.slice(js.indexOf('function aplicarCompacto'), js.indexOf('function iniciarPolling'));
		expect(fn).not.toContain('zerarCacadaAtual');
		expect(fn).not.toContain('pararPolling');
		expect(fn).not.toContain('registroDaCaca');
	});

	it('em tempo real: o tique desenha os MESMOS elementos nos dois modos', () => {
		// `desenharRetrato` escreve nas classes `.ha-*` que o compacto mantém
		// visíveis — não há renderizador próprio do modo compacto.
		expect(js).not.toContain('desenharCompacto');
		expect(js).toContain('ha-exp-base-hora');
		expect(js).toContain('ha-itens-hora');
	});
});
