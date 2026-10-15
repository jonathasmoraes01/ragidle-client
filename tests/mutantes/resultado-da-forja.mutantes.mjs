// A tabela de mutantes do RESULTADO DA FORJA (D-2506), lida pelo config (a
// porta do `transform`) e pelo setup (a porta do `readFileSync`).
// Cada entrada: [arquivo, texto original (casa UMA vez), texto mutado].

const REGRA = 'src/Engine/MapEngine/resultadoDaProducao.js';
const ITEM = 'src/Engine/MapEngine/Item.js';
const SKILL = 'src/Engine/MapEngine/Skill.js';

export const MUTANTES_DA_FORJA = {
	// o sucesso da forja vira falha no texto
	textoTrocado: [REGRA, "return `A forja deu certo: ${nome}.`;", "return `A forja falhou: ${nome} não saiu.`;"],
	// a falha da forja some do chat
	falhaMuda: [REGRA, "\t\tcase RESULTADO_DA_PRODUCAO.FORJA_FALHOU:\n\t\t\treturn `A forja falhou: ${nome} não saiu.`;\n", ''],
	// a farmacia fala como forja
	farmaciaComoForja: [REGRA, "return `A preparação deu certo: ${nome}.`;", "return `A forja deu certo: ${nome}.`;"],
	// a falha da farmacia some
	farmaciaFalhaMuda: [REGRA, "\t\tcase RESULTADO_DA_PRODUCAO.FARMACIA_FALHOU:\n\t\t\treturn `A preparação falhou: ${nome} não saiu.`;\n", ''],
	// todo codigo desconhecido vira linha
	desconhecidoEscreve: [REGRA, '\t\tdefault:\n\t\t\treturn null;', "\t\tdefault:\n\t\t\treturn 'A forja deu certo.';"],
	// a farmacia que sai pinta de erro
	saiuSoNaForja: [REGRA, 'return resultado === RESULTADO_DA_PRODUCAO.FORJA_SAIU || resultado === RESULTADO_DA_PRODUCAO.FARMACIA_SAIU;', 'return resultado === RESULTADO_DA_PRODUCAO.FORJA_SAIU;'],
	// sem nome o texto fica com buraco
	semReservaDoNome: [REGRA, ": 'o item';", ": '';"],
	// o nome quebrado derruba a linha
	nomeSemGuarda: [REGRA, "\t\ttry {\n\t\t\tnome = portas.nomeDoItem(pkt.ITID) || '';\n\t\t} catch {\n\t\t\tnome = '';\n\t\t}", "\t\tnome = portas.nomeDoItem(pkt.ITID) || '';"],
	// o chat quebrado lanca para o laco de pacotes
	semGuarda: [REGRA, "\t} catch (erro) {\n\t\tconsole.warn('[producao] a linha do resultado falhou', erro);\n\t\treturn false;\n\t}", "\t} finally {\n\t}"],
	// o nome sai do item errado
	itemErrado: [REGRA, 'portas.nomeDoItem(pkt.ITID)', 'portas.nomeDoItem(pkt.result)'],
	// ninguem ouve o 0x018f
	semGancho: [ITEM, '\tNetwork.hookPacket(PACKET.ZC.ACK_REQMAKINGITEM, onMakeitemResult);\n', ''],
	// a falha pinta de azul
	corErrada: [ITEM, 'saiu ? ChatBox.TYPE.BLUE : ChatBox.TYPE.ERROR', 'ChatBox.TYPE.BLUE'],
	// o spam do efeito volta a lancar no laco
	efeitoSemGuarda: [SKILL, "\t\ttry {\n\t\t\tEffectManager.spam(EF_Init_Par);\n\t\t} catch (erro) {\n\t\t\tconsole.warn('[efeito] o ZC_NOTIFY_EFFECT ' + pkt.effectID + ' falhou', erro);\n\t\t}", '\t\tEffectManager.spam(EF_Init_Par);'],
	// o 3 toca a arte da falha
	efeitoTrocado: [SKILL, '\t\tEffectConst.EF_REFINEFAIL,\n\t\tEffectConst.EF_REFINEOK,', '\t\tEffectConst.EF_REFINEOK,\n\t\tEffectConst.EF_REFINEFAIL,']
};
