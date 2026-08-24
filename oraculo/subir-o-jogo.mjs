/**
 * `npm run dev` DAQUI delega para o `npm run dev` do repositorio do JOGO.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 * ---------------------------------------------------------------------------
 *
 * O jogo precisa de QUATRO pecas: duas moram neste repositorio (a ponte
 * WebSocket->TCP e o vite) e duas no repositorio do jogo (o servidor de mapa e
 * o de assets). O comando que sobe as quatro mora la, e nao aqui.
 *
 * Este arquivo existe porque o dono rodou `npm run dev` NESTA pasta — o que e
 * a coisa razoavel de fazer quando se acabou de dar `git pull` aqui — e o
 * `dev` deste repositorio abria a pagina de DEMO do roBrowser. O vite subia
 * sozinho, sem servidor, sem ponte e sem assets, e o cliente respondia
 * *"Failed to Connect to Server"*: uma tela de erro que nao diz que faltam
 * tres processos.
 *
 * **Nada se perdeu ao repontar o `dev`**: ele era alias IDENTICO do `live`
 * (`vite --open applications/browser-examples/demo.html`), que continua ali.
 *
 * ---------------------------------------------------------------------------
 * COMO ELE ACHA O REPOSITORIO DO JOGO
 * ---------------------------------------------------------------------------
 *
 * Por ASSINATURA e nao por nome: a pasta irma que tiver `scripts/dev.ts` e
 * `servidor/index.ts`. O nome e de quem clonou — na maquina do dono ela se
 * chama `rag-idle-master`, na de quem escreveu isto, `Rag Idle 2.0`.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIZINHANCA = resolve(AQUI, '..');

/** As duas juntas: cada uma sozinha casaria com outra coisa. */
function ehORepositorioDoJogo(pasta) {
	return (
		existsSync(join(pasta, 'scripts', 'dev.ts')) &&
		existsSync(join(pasta, 'servidor', 'index.ts'))
	);
}

function acharOJogo() {
	let entradas;
	try {
		entradas = readdirSync(VIZINHANCA, { withFileTypes: true });
	} catch {
		return null;
	}
	for (const e of entradas) {
		if (!e.isDirectory()) continue;
		const candidato = join(VIZINHANCA, e.name);
		if (ehORepositorioDoJogo(candidato)) return candidato;
	}
	return null;
}

const jogo = acharOJogo();

if (jogo === null) {
	process.stderr.write(
		'\n' +
			'Este repositorio e o CLIENTE. O comando que sobe o jogo inteiro mora no\n' +
			'repositorio do JOGO, e ele nao foi encontrado ao lado deste.\n\n' +
			`  procurei em: ${VIZINHANCA}\n` +
			'  por uma pasta com `scripts/dev.ts` e `servidor/index.ts`\n\n' +
			'Se o repositorio do jogo estiver noutro lugar, entre nele e rode:\n\n' +
			'  npm run dev\n\n' +
			'E se voce queria mesmo a pagina de DEMO deste cliente, ela continua em:\n\n' +
			'  npm run live\n\n',
	);
	process.exit(1);
}

process.stdout.write(
	`\n[cliente] o jogo inteiro sobe pelo repositorio do JOGO — delegando para:\n` +
		`          ${jogo}\n\n`,
);

// `shell: true` no Windows porque `npm` e `.cmd`. `stdio: 'inherit'` para o
// dono ver o log das quatro pecas e para o Ctrl+C chegar la — sem isso ele
// mataria so este processo e deixaria as quatro orfas.
const filho = spawn('npm', ['run', 'dev', '--', ...process.argv.slice(2)], {
	cwd: jogo,
	stdio: 'inherit',
	shell: process.platform === 'win32',
});
filho.on('exit', (codigo) => process.exit(codigo ?? 0));
