/**
 * B7 — O ÍCONE INSTALADO DIZIA "roBrowser" (06/09/2026, reporte do playtest).
 *
 * O jogador mandou o print do ícone na tela inicial do celular: arte de gato
 * com a palavra **roBrowser**.
 *
 * ---------------------------------------------------------------------------
 * A CAUSA — UM arquivo, e ele alimenta TODOS os ícones
 * ---------------------------------------------------------------------------
 * `applications/tools/builder-web.mjs` gera os cinco ícones do PWA a partir de
 * `const origem = './applications/pwa/icon.png'` — e esse arquivo era a arte do
 * roBrowser, herdada do fork. `icon-192`, `icon-512`, os dois `maskable` e a
 * cópia `icon.png` saíam todos dele, e o `api.html` ainda o repetia num
 * `<link rel="apple-touch-icon">`.
 *
 * O manifesto em si sempre esteve certo (nome, short_name, theme_color,
 * categorias, screenshots): o defeito era **só a arte**, e por isso nenhuma
 * verificação de manifesto o pegaria.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE TESTE MEDE O ARQUIVO, E NÃO O TEXTO
 * ---------------------------------------------------------------------------
 * Não há string "roBrowser" dentro de um PNG para procurar. O que dá para
 * medir sem olhar o desenho é a PROCEDÊNCIA: o ícone do PWA tem de ser
 * byte-a-byte o mesmo que o site publica como ícone do jogo. Um dia em que
 * alguém trocar um dos dois e esquecer o outro, isto reprova — e é exatamente
 * a classe de defeito deste item.
 *
 * A regra 5 do projeto continua valendo: **alguém olhou o PNG**, antes e
 * depois. Este teste guarda o resultado; ele não substitui o olho.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ICONE_DO_PWA = 'applications/pwa/icon.png';

/**
 * O ícone do JOGO, publicado pelo site. Ele vive no repositório do site, que é
 * irmão deste — por isso o teste PULA quando ele não está na máquina, em vez
 * de reprovar: falha por árvore incompleta é a que ensina a ignorar o portão.
 */
const ICONE_DO_SITE = '../rag-idle-site/assets/icons/icone-512.png';

const sha = (caminho) => createHash('sha256').update(readFileSync(caminho)).digest('hex');

describe('B7 — o ícone do PWA é o do jogo', () => {
	it('o arquivo existe (é ele que alimenta os cinco ícones do build)', () => {
		expect(existsSync(ICONE_DO_PWA)).toBe(true);
	});

	it('tem pelo menos 512px de lado — o maior que o manifesto declara', () => {
		// Sem uma biblioteca de imagem: o cabeçalho PNG traz largura e altura
		// em big-endian nos bytes 16..24 do IHDR, que é sempre o primeiro chunk.
		const buf = readFileSync(ICONE_DO_PWA);
		expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
		expect(buf.readUInt32BE(16)).toBeGreaterThanOrEqual(512);
		expect(buf.readUInt32BE(20)).toBeGreaterThanOrEqual(512);
	});

	it('o manifesto declara o tamanho REAL do arquivo', () => {
		const buf = readFileSync(ICONE_DO_PWA);
		const lado = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
		const manifesto = JSON.parse(readFileSync('applications/pwa/manifest.webmanifest', 'utf8'));
		const entrada = manifesto.icons.find(i => i.src === './icon.png');
		expect(entrada).toBeDefined();
		// Ele dizia 450x450 enquanto o arquivo tinha outro tamanho: um número
		// que ninguém confere é um número que envelhece.
		expect(entrada.sizes).toBe(lado);
	});

	it.skipIf(!existsSync(ICONE_DO_SITE))(
		'é byte-a-byte o mesmo que o site publica como ícone do jogo',
		() => {
			expect(statSync(ICONE_DO_PWA).size).toBe(statSync(ICONE_DO_SITE).size);
			expect(sha(ICONE_DO_PWA)).toBe(sha(ICONE_DO_SITE));
		}
	);
});

describe('B7 — nenhuma marca de terceiro no que o jogador lê', () => {
	const paginas = ['applications/api/api.html', 'applications/pwa/index.html'];

	it.each(paginas)('%s não se apresenta como outro produto', pagina => {
		const html = readFileSync(pagina, 'utf8');
		// Só as META que o sistema operacional e o compartilhamento LEEM. O
		// crédito ao motor (GPL v3) continua no comentário e na tela Sobre, e
		// tirá-lo seria trocar um defeito por outro.
		for (const meta of [
			'apple-mobile-web-app-title',
			'application-name',
			'og:title',
			'og:site_name',
			'description',
			'author'
		]) {
			const achado = new RegExp(
				`(?:name|property)="${meta}"[^>]*content="([^"]*)"`,
				'i'
			).exec(html);
			if (achado) expect([meta, achado[1].toLowerCase()]).not.toContain('robrowser');
		}
	});

	it('o manifesto se chama Ragnarok Classic Idle', () => {
		const m = JSON.parse(readFileSync('applications/pwa/manifest.webmanifest', 'utf8'));
		expect(m.name).toBe('Ragnarok Classic Idle');
		expect(m.short_name).toBe('Rag Idle');
		expect(JSON.stringify(m).toLowerCase()).not.toContain('robrowser');
	});
});
