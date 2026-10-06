// A tabela de mutantes da DEVOLUCAO DO CARRINHO (R110), lida pelo config (a
// porta do `transform`) e pelo setup (a porta do `readFileSync`).
// Cada entrada: [arquivo, texto original (casa UMA vez), texto mutado].

const REGRA = 'src/Engine/MapEngine/rotulosDaConfirmacao.js';
const JANELA = 'src/Engine/MapEngine/RagidleConfirmar.js';
const CARRINHO = 'src/UI/Components/CartItems/CartItems.js';
const ITEM = 'src/Engine/MapEngine/Item.js';
const CSS = 'src/UI/Components/CartItems/CartItems.css';

export const MUTANTES_DA_DEVOLUCAO = {
	// o rotulo do servidor e ignorado (o "sim" vira OK)
	semRotuloDoSim: [REGRA, 'sim: rotuloValido(d.sim) ? d.sim.trim() : ROTULO_SIM_PADRAO,', 'sim: ROTULO_SIM_PADRAO,'],
	// o rotulo do "nao" e ignorado
	semRotuloDoNao: [REGRA, 'nao: rotuloValido(d.nao) ? d.nao.trim() : ROTULO_NAO_PADRAO', 'nao: ROTULO_NAO_PADRAO'],
	// rotulo vazio vira botao vazio
	aceitaVazio: [REGRA, "return typeof valor === 'string' && valor.trim() !== '' && valor.length <= 40;", "return typeof valor === 'string' && valor.length <= 40;"],
	// rotulo comprido demais estoura a caixa
	semTetoDoRotulo: [REGRA, "return typeof valor === 'string' && valor.trim() !== '' && valor.length <= 40;", "return typeof valor === 'string' && valor.trim() !== '';"],
	// a caixa nao cresce (o texto dos itens fica numa fresta)
	caixaFixa: [REGRA, 'return Math.max(ALTURA_MINIMA_DA_PERGUNTA, Math.min(desejada, teto));', 'return ALTURA_MINIMA_DA_PERGUNTA;'],
	// a caixa passa da tela
	semTetoDaTela: [REGRA, 'return Math.max(ALTURA_MINIMA_DA_PERGUNTA, Math.min(desejada, teto));', 'return Math.max(ALTURA_MINIMA_DA_PERGUNTA, desejada);'],
	// o rodape some da conta (os botoes cobrem o texto)
	semRodape: [REGRA, 'const desejada = Math.ceil(texto) + alturaDoRodape + 8;', 'const desejada = Math.ceil(texto) + 8;'],
	// a janela ignora os rotulos e escreve OK
	janelaSemRotulos: [JANELA, "btn.textContent = nome === 'ok' ? rotulos.sim : rotulos.nao;", "btn.textContent = nome === 'ok' ? 'OK' : 'Cancelar';"],
	// o dedo perde os 44px
	dedoSem44: [JANELA, "b.style.minHeight = '44px';", "b.style.minHeight = '';"],
	// o botao "Devolver" nao pede nada
	botaoMudo: [CARRINHO, '\t\t\t\tCartItems.pedirDevolucao();\n', ''],
	// o ZC_CARTOFF nao esvazia a grade
	naoEsvazia: [CARRINHO, '\tthis.list.length = 0;\n\tthis.info = null;', '\tthis.info = null;'],
	// o ZC_CARTOFF nao fecha a janela
	naoFecha: [CARRINHO, '\tthis.info = null;\n\tthis.fechar();', '\tthis.info = null;'],
	// o pedido vai no pacote errado
	pacoteErrado: [ITEM, 'Network.sendPacket(new PACKET.CZ.REQ_CARTOFF());', 'Network.sendPacket(new PACKET.CZ.REQ_CHANGECART());'],
	// ninguem ouve o ZC_CARTOFF
	semGancho: [ITEM, '\tNetwork.hookPacket(PACKET.ZC.CARTOFF, onCartOff);\n', ''],
	// a recusa sem carrinho (57) volta a ser muda no chat
	recusaMuda: ['src/Engine/MapEngine/Skill.js', '\t\t\tcase 57:\n\t\t\t\terror = 1519;\n\t\t\t\tbreak;\n', ''],
	// no celular o "Devolver" encolhe abaixo do alvo de dedo
	celularSem44: [
		CSS,
		'\t\tmin-height: 44px;\n\t\tmargin-left: auto;\n\t\tpadding: 0 18px;\n\t\tfont-size: 14px;\n\t\tline-height: normal;\n\t}\n\t#cartitems .footer .devolver + .ir-mochila',
		'\t\tmin-height: 24px;\n\t\tmargin-left: auto;\n\t\tpadding: 0 18px;\n\t\tfont-size: 14px;\n\t\tline-height: normal;\n\t}\n\t#cartitems .footer .devolver + .ir-mochila'
	]
};
