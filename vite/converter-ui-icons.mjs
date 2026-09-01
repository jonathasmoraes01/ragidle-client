/**
 * Converte os ícones de interface novos (PNG 1024x1024 com alfa, entregues pelo
 * dono) para o conjunto que o jogo carrega.
 *
 * O que ele faz, e POR QUE:
 *
 * 1. RECORTA cada glifo na própria caixa alfa. Os PNG de origem vêm todos em
 *    1024x1024, mas o desenho dentro deles ocupa de 331x336 (eventos) a 582x457
 *    (grupo) — medido, não estimado. Se a moldura transparente sobrevivesse, o
 *    mesmo `width` em CSS renderizaria uns grandes e outros minúsculos, e a
 *    correção viraria um número mágico por ícone espalhado pelo CSS. Recortado,
 *    o arquivo passa a declarar a própria geometria e o encaixe fica sendo uma
 *    decisão de layout, não do asset.
 *
 * 2. NÃO padroniza a proporção. As proporções vão de 0,60 (o cristal da RO_Shop,
 *    alto) a 1,61 (o códex, largo). Enfiar tudo em quadrado deformaria ou
 *    acrescentaria margem arbitrária; `object-fit: contain` dentro do disco
 *    resolve isso no componente, onde dá para ver o resultado.
 *
 * 3. Sai em WebP com alfa. O conjunto em PNG pesa 5,1 MB; nenhum ícone é
 *    desenhado acima de ~48px na tela, então 128px de lado maior já cobre 3x de
 *    densidade sobrando.
 *
 * Uso:  node vite/converter-ui-icons.mjs <pasta-de-origem> [--lado 128]
 */

import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DESTINO = join(RAIZ, 'public', 'ragidle', 'ui-icons');

/**
 * De-para entre o nome do arquivo entregue e o nome que o jogo usa.
 *
 * A chave é um trecho que identifica o arquivo de origem sem ambiguidade; o
 * valor é o nome final. Onde o projeto JÁ tinha um asset para a mesma função
 * (dock-icons/personagem.png, caca.png, correio.png, ...), o nome antigo foi
 * mantido de propósito: assim o de-para do documento `docs/ui/mapa-icones.md`
 * fica óbvio e nenhuma referência precisa ser reescrita duas vezes.
 */
const NOMES = new Map([
	['analysis_icon', 'analise-de-caca'],
	['character_portrait', 'personagem'],
	['codex_icon', 'codex'],
	['colorful_fantasy_chest', 'recompensas'],
	['events_icon', 'eventos'],
	['fantasy_character_icon', 'amigos'],
	['fantasy_skill_icon', 'skills'],
	['group_icon', 'grupo'],
	['guilda_icon', 'guilda'],
	['hunting_icon', 'caca'],
	['idle_icon', 'idle'],
	['mail_icon', 'correio'],
	['missions_icon', 'missoes'],
	['trade_icon', 'trade'],
	['auction_icon', 'leilao'],
	['fantasy_shop_icon', 'loja'],
	['ro_shop_icon', 'ro-shop'],
]);

function nomeFinal(arquivo) {
	const cru = basename(arquivo, extname(arquivo)).toLowerCase();
	for (const [chave, nome] of NOMES) {
		if (cru.includes(chave)) return nome;
	}
	return null;
}

/** Caixa envolvente dos pixels com alfa acima do limiar. */
async function caixaAlfa(imagem, limiar = 8) {
	const { data, info } = await imagem
		.clone()
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const { width, height, channels } = info;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * channels + 3] > limiar) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}

	if (maxX < 0) throw new Error('imagem totalmente transparente');
	return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
	const origem = process.argv[2];
	if (!origem) {
		console.error('uso: node vite/converter-ui-icons.mjs "<pasta-de-origem>" [--lado 128]');
		process.exit(1);
	}
	const i = process.argv.indexOf('--lado');
	const lado = i > -1 ? Number(process.argv[i + 1]) : 128;

	await mkdir(DESTINO, { recursive: true });

	const arquivos = (await readdir(origem)).filter((f) => extname(f).toLowerCase() === '.png').sort();

	const feitos = [];
	const semNome = [];

	for (const arquivo of arquivos) {
		const nome = nomeFinal(arquivo);
		if (!nome) {
			semNome.push(arquivo);
			continue;
		}

		const entrada = sharp(join(origem, arquivo));
		const meta = await entrada.metadata();
		const caixa = await caixaAlfa(entrada);

		// Escala pelo lado MAIOR: nada estoura, e a proporção fica intacta.
		const escala = lado / Math.max(caixa.width, caixa.height);
		const larguraFinal = Math.round(caixa.width * escala);
		const alturaFinal = Math.round(caixa.height * escala);

		const destino = join(DESTINO, `${nome}.webp`);
		const saida = await entrada
			.clone()
			.extract(caixa)
			.resize(larguraFinal, alturaFinal, { fit: 'fill', kernel: 'lanczos3' })
			.webp({ quality: 92, alphaQuality: 100, effort: 6 })
			.toFile(destino);

		feitos.push({
			arquivo,
			nome,
			origem: `${meta.width}x${meta.height}`,
			caixa: `${caixa.width}x${caixa.height}`,
			saidaTam: `${larguraFinal}x${alturaFinal}`,
			aspecto: Number((caixa.width / caixa.height).toFixed(2)),
			kb: Number((saida.size / 1024).toFixed(1)),
		});
	}

	// Manifesto: o componente lê daqui em vez de cada tela adivinhar a proporção.
	const manifesto = Object.fromEntries(
		feitos.map((f) => [f.nome, { largura: Number(f.saidaTam.split('x')[0]), altura: Number(f.saidaTam.split('x')[1]), aspecto: f.aspecto }])
	);
	await writeFile(join(DESTINO, 'manifesto.json'), JSON.stringify(manifesto, null, '\t') + '\n', 'utf8');

	console.table(feitos);
	const total = feitos.reduce((s, f) => s + f.kb, 0);
	console.log(`\n${feitos.length} ícones -> ${DESTINO}`);
	console.log(`peso total: ${total.toFixed(1)} KB`);
	if (semNome.length) {
		console.log(`\nSEM DE-PARA (nao convertidos): ${semNome.join(', ')}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
