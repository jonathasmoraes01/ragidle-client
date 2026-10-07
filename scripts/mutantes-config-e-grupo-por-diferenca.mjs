/**
 * scripts/mutantes-config-e-grupo-por-diferenca.mjs - a BATERIA DE MUTACAO da
 * Config Idle e da janela de Grupo por diferenca (D-2077, 07/10/2026): o
 * receptor puro (`UI/janelaPorDiferenca.js`), a costura nas duas janelas e a
 * declaracao das bases na entrada no mapa.
 *
 *   node scripts/mutantes-config-e-grupo-por-diferenca.mjs [filtro-regex]
 *
 * O mesmo motor de `mutantes-janelas-por-diferenca.mjs`: cada mutante troca UM
 * trecho, roda os testes e devolve o arquivo no finally. Todo mutante tem de
 * MORRER; trecho que nao casa exatamente 1 vez NAO conta como morto.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = [
	resolve(RAIZ, 'node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../node_modules/vitest/vitest.mjs'),
	resolve(RAIZ, '../../../../ragidle-client/node_modules/vitest/vitest.mjs')
].find(p => existsSync(p));
const TESTES = ['tests/ui/janelaPorDiferenca.test.js', 'tests/ui/configEGrupoPorDiferenca.test.js', 'tests/ui/parcialDaLista.test.js'];

const P = 'src/UI/janelaPorDiferenca.js';
const C = 'src/UI/Components/IdleConfig/IdleConfig.js';
const G = 'src/UI/Components/GrupoIdle/GrupoIdle.js';
const D = 'src/Engine/declaracaoDasBases.js';
const E = 'src/Engine/MapEngine.js';

const MUTANTES = [
	['JP1 a versao do parcial e a do inteiro', P, 'export const VERSAO_DO_PARCIAL_DE_JANELA = 2;', 'export const VERSAO_DO_PARCIAL_DE_JANELA = 1;'],
	['JP2 qualquer `parcial` verdadeiro e parcial', P, 'return !!corpo && corpo.parcial === true && corpo.v === VERSAO_DO_PARCIAL_DE_JANELA;', 'return !!corpo && !!corpo.parcial;'],
	['JP3 o guardado leva os campos do envio', P, '\t\t\tif (camposDoEnvio.indexOf(k) === -1) {\n\t\t\t\testado[k] = corpo[k];\n\t\t\t}', '\t\t\testado[k] = corpo[k];'],
	['JP4 o guardado leva a rev', P, '\t\tdelete estado.rev;\n', ''],
	['JP5 o guardado e o mesmo objeto do inteiro', P, 'return { dados: corpo, guardado: { rev, estado: copia(estado) }, pedirInteiro: false };', 'return { dados: corpo, guardado: { rev, estado }, pedirInteiro: false };'],
	['JP6 a rev do servidor antigo vira numero', P, "const rev = corpo && typeof corpo.rev === 'number' ? corpo.rev : null;", 'const rev = corpo ? Number(corpo.rev) : null;'],
	['JP7 o `de` nao e conferido', P, ' || guardado.rev !== corpo.de ||', ' ||'],
	['JP8 o guardado sem revisao aceita o parcial', P, 'if (!guardado || guardado.rev === null || guardado.rev', 'if (!guardado || guardado.rev'],
	['JP9 trocas que nao sao lista passam', P, ' || !Array.isArray(corpo.trocas)) {', ') {'],
	['JP10 a troca que nao cai e aplicada assim mesmo', P, '\tif (!estado) {\n\t\treturn { dados: null, guardado, pedirInteiro: true };\n\t}\n', ''],
	['JP11 o envio nao vai aos dados', P, '\t\t\tdados[k] = corpo[k];', ''],
	['JP12 os dados sem a rev nova', P, '\tdados.rev = corpo.rev;\n', ''],
	['JP13 o guardado nao anda', P, 'return { dados, guardado: { rev: corpo.rev, estado }, pedirInteiro: false };', 'return { dados, guardado, pedirInteiro: false };'],
	['JP14 o inteiro e pedido a cada parcial que nao cai', P, '\t\t\t\tif (!esperandoInteiro) {\n\t\t\t\t\tesperandoInteiro = true;\n\t\t\t\t\tpedirInteiro();\n\t\t\t\t}', '\t\t\t\tesperandoInteiro = true;\n\t\t\t\tpedirInteiro();'],
	['JP15 o inteiro nao destrava a espera', P, '\t\t\tif (!ehParcialDeJanela(corpo)) {\n\t\t\t\tesperandoInteiro = false;\n\t\t\t}\n', ''],
	['JP16 esperando, a revisao ainda e declarada', P, 'return esperandoInteiro ? null : revisaoGuardada(guardado);', 'return revisaoGuardada(guardado);'],
	['JP17 esquecer deixa a espera', P, '\t\t\tguardado = null;\n\t\t\tesperandoInteiro = false;', '\t\t\tguardado = null;'],
	['JP18 esquecer deixa o guardado', P, '\t\t\tguardado = null;\n\t\t\tesperandoInteiro = false;', '\t\t\tesperandoInteiro = false;'],
	['JP19 a revisao guardada aceita texto', P, "return guardado && typeof guardado.rev === 'number' ? guardado.rev : null;", 'return guardado ? guardado.rev : null;'],
	['JC1 a config nao passa pelo receptor', C, '\tconst recebido = _receptorDaConfig.receber(data);\n\tif (recebido.ignorado) {\n\t\treturn;\n\t}\n\tdata = recebido.dados;\n', ''],
	['JC2 o inteiro da config nao declara null', C, "\tdeclararBaseNula('config', { Network, PACKET });\n", ''],
	['JC3 o inteiro da config nao repete o pedido', C, '\tNetwork.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_CONFIG());\n});', '});'],
	['JC4 a revisao da config nao e exposta', C, '\treturn _receptorDaConfig.revisao();', '\treturn null;'],
	['JC5 a troca de personagem lembra a config', C, '\t_receptorDaConfig.esquecer();\n', ''],
	['JC6 a config nao separa os campos do envio', C, 'criarReceptorDeJanela(CAMPOS_DO_ENVIO_DA_CONFIG, function', 'criarReceptorDeJanela([], function'],
	['JG1 o grupo nao passa pelo receptor', G, '\tconst recebido = _receptorDoPainel.receber(dados);\n\tif (recebido.ignorado) {\n\t\treturn;\n\t}\n\tdados = recebido.dados;\n', ''],
	['JG2 o inteiro do grupo nao declara null', G, "\tdeclararBaseNula('grupo', { Network, PACKET });\n", ''],
	['JG3 a revisao do painel nao e exposta', G, '\treturn _receptorDoPainel.revisao();', '\treturn null;'],
	['JG4 a troca de personagem lembra o painel', G, '\t_receptorDoPainel.esquecer();\n', ''],
	['JD1 a declaracao sem a config', D, '\t\tcorpo.config = revisaoDe(IdleConfig.revisaoDaConfig);\n', ''],
	['JD2 a declaracao sem o grupo', D, '\t\tcorpo.grupo = revisaoDe(GrupoIdle.revisaoDoPainel);\n', ''],
	['JD3 a revisao que nao e numero passa', D, "\treturn typeof rev === 'number' ? rev : null;", '\treturn rev;'],
	['JD4 o pedido do inteiro declara null para todas', D, "pkt.json = JSON.stringify({ acao: 'bases', [chave]: null });", "pkt.json = JSON.stringify({ acao: 'bases', config: null, grupo: null });"],
	['JD5 o pedido do inteiro nao sai', D, "\tpkt.json = JSON.stringify({ acao: 'bases', [chave]: null });\n\tNetwork.sendPacket(pkt);", "\tpkt.json = JSON.stringify({ acao: 'bases', [chave]: null });"],
	['JE1 o MapEngine nao passa as janelas', E, 'declararBasesDasJanelas({ MissoesIdle, IdleSkills, IdleConfig, GrupoIdle, Network, PACKET });', 'declararBasesDasJanelas({ MissoesIdle, IdleSkills, Network, PACKET });']
];

const resultados = [];
const SO = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (let [nome, arquivo, de, para] of MUTANTES) {
	if (SO && !SO.test(nome)) {
		continue;
	}
	const caminho = `${RAIZ}/${arquivo}`;
	const original = readFileSync(caminho, 'utf8');
	/* Os arquivos do cliente estao em CRLF na arvore de trabalho. */
	if (original.includes('\r\n')) {
		de = de.replace(/\n/g, '\r\n');
		para = para.replace(/\n/g, '\r\n');
	}
	const vezes = original.split(de).length - 1;
	if (vezes !== 1) {
		resultados.push([nome, `TRECHO ACHADO ${vezes}x - mutante nao aplicado`]);
		continue;
	}
	try {
		writeFileSync(caminho, original.replace(de, () => para));
		const r = spawnSync(process.execPath, [VITEST, 'run', ...TESTES], { cwd: RAIZ, encoding: 'utf8' });
		const saida = (r.stdout || '') + (r.stderr || '');
		const linha = (saida.match(/Tests\s+[^\n]*/) || ['?'])[0].trim();
		resultados.push([nome, r.status === 0 ? `SOBREVIVEU (${linha})` : `morto (${linha})`]);
	} finally {
		writeFileSync(caminho, original);
	}
}
for (const [n, r] of resultados) {
	console.log(`${r.startsWith('morto') ? 'ok ' : '!! '} ${n}: ${r}`);
}
const vivos = resultados.filter(([, r]) => !r.startsWith('morto')).length;
console.log(`\n${resultados.length - vivos}/${resultados.length} mutantes mortos`);
process.exitCode = vivos > 0 ? 1 : 0;
