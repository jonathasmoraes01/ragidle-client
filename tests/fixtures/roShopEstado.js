/**
 * UM ESTADO DE EXEMPLO do RO Shop, FIEL ao contrato v1 CONFIRMADO pelo Agente 1
 * (`docs/ro-shop/CONTRATO.md` do servidor, commit bddee780, secoes 4 e 7; e o
 * aditivo da rodada 2, commit 06e5e71c: `limites`, `personagem`, `conta.slots`
 * e `conta.carga`, os quatro SKUs ativados) - usado
 * pelos testes da janela e pelo arnes de foto (`scripts/foto-ro-shop.mjs`).
 *
 * SKUs, precos, categorias-casa, `ordemNoDestaque`, itemIds de icone, `ativo` e
 * os motivos de `indisponivel` sao os da secao 7 do contrato. Os ids 9.000.100
 * a 9.000.110 sao custom do servidor e AINDA NAO TEM arte publicada no cliente
 * - exatamente o caso que a reserva da janela precisa cobrir.
 *
 * Tres coisas aqui sao ESTADOS DE EXEMPLO para a prova de tela, e o contrato
 * diz que hoje nao acontecem: os `selo` (hoje sempre null), os textos de
 * `indisponivel` (a frase real e do servidor) e o credito de Reset de Skills.
 */

const P = (sku, nome, categoria, precoMinor, extra = {}) => ({
	sku,
	nome,
	descricao: '',
	categoria,
	destaque: false,
	ordemNoDestaque: null,
	ordem: 0,
	precoMinor,
	ativo: true,
	imagem: null,
	tipoDeEntrega: 'item',
	conteudo: [],
	resumo: '',
	selo: null,
	quantidadeMaxima: 10,
	indisponivel: null,
	...extra
});

const AZUL = { itemId: 505, nome: 'Poção Azul', quantidade: 1000 };
const BRANCA = { itemId: 504, nome: 'Poção Branca', quantidade: 500 };
const EXP = { itemId: 9000100, nome: 'Manual de EXP', quantidade: 1 };
const JOB = { itemId: 9000101, nome: 'Manual de Job', quantidade: 1 };
const FORTUNA = { itemId: 9000102, nome: 'Bênção da Fortuna', quantidade: 1 };

export function estadoDeExemplo(sobrescrever = {}) {
	return {
		versao: 1,
		tipo: 'estado',
		moeda: { nome: 'RO Cash', saldoMinor: 862000 },
		categorias: [
			{ id: 'destaques', nome: 'Destaques', ordem: 0 },
			{ id: 'farm-up', nome: 'Farm & Up', ordem: 1 },
			{ id: 'pocoes', nome: 'Poções', ordem: 2 },
			{ id: 'boosts', nome: 'Boosts', ordem: 3 },
			{ id: 'utilidades', nome: 'Utilidades', ordem: 4 },
			{ id: 'conta', nome: 'Conta', ordem: 5 }
		],
		produtos: [
			P('POTION_BLUE_1000', 'Pack Poção Azul', 'pocoes', 200, {
				destaque: true,
				ordemNoDestaque: 3,
				ordem: 1,
				imagem: { itemId: 9000103 },
				conteudo: [AZUL],
				resumo: '1000x Poção Azul',
				descricao: 'Um pack que, ao ser usado, entrega 1000 Poções Azuis.'
			}),
			P('POTION_WHITE_500', 'Pack Poção Branca', 'pocoes', 200, {
				destaque: true,
				ordemNoDestaque: 4,
				ordem: 2,
				imagem: { itemId: 9000104 },
				conteudo: [BRANCA],
				resumo: '500x Poção Branca'
			}),
			P('POTION_SURVIVAL_PACK', 'Pack Sobrevivência', 'pocoes', 350, {
				destaque: true,
				ordemNoDestaque: 1,
				ordem: 3,
				imagem: { itemId: 9000105 },
				conteudo: [AZUL, BRANCA],
				resumo: '1000x Poção Azul, 500x Poção Branca',
				selo: 'popular'
			}),
			P('BOOST_EXP_1H', 'Manual de EXP', 'boosts', 150, {
				ordem: 1,
				imagem: { itemId: 9000100 },
				conteudo: [EXP],
				resumo: '+25% Base EXP por 1 hora'
			}),
			P('BOOST_JOB_1H', 'Manual de Job', 'boosts', 150, {
				ordem: 2,
				imagem: { itemId: 9000101 },
				conteudo: [JOB],
				resumo: '+25% Job EXP por 1 hora'
			}),
			P('BOOST_DROP_1H', 'Bênção da Fortuna', 'boosts', 150, {
				ordem: 3,
				imagem: { itemId: 9000102 },
				conteudo: [FORTUNA],
				resumo: '+20% drop de itens comuns por 1 hora',
				descricao: 'Não afeta cartas, MVP, miniboss, quest, evento ou itens especiais.'
			}),
			P('BOOST_TRAINING_PACK', 'Pack de Treino', 'boosts', 400, {
				ordem: 4,
				imagem: { itemId: 9000110 },
				conteudo: [EXP, JOB, FORTUNA],
				resumo: 'Manual de EXP, Manual de Job e Bênção da Fortuna',
				selo: 'novo'
			}),
			P('SERVICE_SKILL_RESET', 'Reset de Skills', 'utilidades', 200, {
				ordem: 1,
				tipoDeEntrega: 'servico',
				resumo: 'Devolve todos os pontos de habilidade',
				quantidadeMaxima: 5
			}),
			P('SERVICE_STAT_RESET', 'Reset de Status', 'utilidades', 200, {
				ordem: 2,
				tipoDeEntrega: 'servico',
				resumo: 'Devolve todos os pontos de atributo',
				quantidadeMaxima: 5
			}),
			/* Rodada 2 (CONTRATO.md 06e5e71c): os quatro que estavam fora de venda
			   ATIVARAM. O armazem de exemplo esta no TETO (10 de 10) para a tela ter
			   um "esgotado" de verdade. */
			P('SERVICE_RENAME', 'Troca de Nome', 'conta', 500, {
				ordem: 1,
				tipoDeEntrega: 'servico',
				resumo: 'Um novo nome para o personagem',
				quantidadeMaxima: 1
			}),
			P('SERVICE_APPEARANCE_CHANGE', 'Alteração Visual/Sexo', 'conta', 300, {
				ordem: 2,
				tipoDeEntrega: 'servico',
				resumo: 'Troca visual ou de sexo do personagem',
				quantidadeMaxima: 1
			}),
			P('ACCOUNT_CHARACTER_SLOT', '+1 Slot de Personagem', 'conta', 500, {
				ordem: 3,
				tipoDeEntrega: 'conta',
				resumo: 'Mais um personagem na conta',
				quantidadeMaxima: 1
			}),
			P('ACCOUNT_INVENTORY_10', 'Expansão de Carga +5.000', 'conta', 200, {
				ordem: 4,
				tipoDeEntrega: 'conta',
				resumo: '+5.000 de capacidade de carga',
				quantidadeMaxima: 1
			}),
			P('ACCOUNT_STORAGE_100', 'Expansão de Armazém +100', 'conta', 300, {
				ordem: 5,
				tipoDeEntrega: 'conta',
				resumo: '+100 espaços no armazém',
				quantidadeMaxima: 1,
				ativo: false,
				indisponivel: { motivo: 'teto-atingido', texto: 'Seu armazém já está no tamanho máximo.' }
			}),
			P('TRAVEL_PACK', 'Pack Viagem', 'farm-up', 200, {
				destaque: true,
				ordemNoDestaque: 6,
				ordem: 1,
				imagem: { itemId: 9000106 },
				conteudo: [
					{ itemId: 601, nome: 'Asa de Mosca', quantidade: 500 },
					{ itemId: 602, nome: 'Asa de Borboleta', quantidade: 100 }
				],
				resumo: '500x Asa de Mosca, 100x Asa de Borboleta'
			}),
			P('FARM_PACK', 'Pack Farm', 'farm-up', 500, {
				ordem: 2,
				imagem: { itemId: 9000107 },
				conteudo: [BRANCA, AZUL, FORTUNA],
				resumo: 'Poções e 1x Bênção da Fortuna'
			}),
			P('LEVELING_PACK', 'Pack Up', 'farm-up', 600, {
				destaque: true,
				ordemNoDestaque: 5,
				ordem: 3,
				imagem: { itemId: 9000108 },
				conteudo: [BRANCA, AZUL, EXP, JOB],
				resumo: 'Poções, Manual de EXP e Manual de Job'
			}),
			P('COMPLETE_FARM_PACK', 'Pack Completo de Farm', 'farm-up', 700, {
				destaque: true,
				ordemNoDestaque: 2,
				ordem: 4,
				imagem: { itemId: 9000109 },
				conteudo: [BRANCA, AZUL, EXP, JOB, FORTUNA],
				resumo: 'Poções, os dois Manuais e a Bênção da Fortuna',
				selo: 'oferta'
			})
		],
		/* `usavel` = o servico tem efeito E ha credito (rodada 2); `limites` e o
		   bloco da secao 4 do contrato, com as faixas documentadas. */
		servicos: [
			{
				servico: 'reset-de-skills',
				sku: 'SERVICE_SKILL_RESET',
				nome: 'Reset de Skills',
				creditos: 1,
				usavel: true,
				limites: null
			},
			{
				servico: 'reset-de-status',
				sku: 'SERVICE_STAT_RESET',
				nome: 'Reset de Status',
				creditos: 0,
				usavel: false,
				limites: null
			},
			{
				servico: 'troca-de-nome',
				sku: 'SERVICE_RENAME',
				nome: 'Troca de Nome',
				creditos: 1,
				usavel: true,
				limites: { novoNome: { min: 4, max: 23 } }
			},
			{
				servico: 'troca-de-aparencia',
				sku: 'SERVICE_APPEARANCE_CHANGE',
				nome: 'Alteração Visual/Sexo',
				creditos: 1,
				usavel: true,
				limites: {
					sexo: { valores: [0, 1], fixo: false },
					cabelo: { min: 0, max: 27 },
					corDoCabelo: { min: 0, max: 8 }
				}
			}
		],
		personagem: { id: 150001, nome: 'Jhow', classe: 4, sexo: 1, cabelo: 5, corDoCabelo: 2 },
		conta: {
			armazem: { expansoes: 10, teto: 10, vagasPorExpansao: 100 },
			slots: { total: 12, gratis: 9, teto: 15 },
			carga: { expansoes: 1, teto: 5, porExpansao: 5000 }
		},
		temporada: { nome: 'Season 1 - Luz & Trevas', fase: 'aberta' },
		recarga: {
			disponivel: false,
			texto: 'A recarga de RO Cash ainda não está disponível. Fique de olho nos avisos do jogo.'
		},
		...sobrescrever
	};
}
