/**
 * A DICA DO BUFF EM PORTUGUES (03/09/2026 — pedido do dono).
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM DICIONARIO, E NAO A TRADUCAO DENTRO DE `StatusInfo.js`
 * ---------------------------------------------------------------------------
 * `StatusInfo.js` e arquivo do roBrowser upstream, com 3.121 linhas e 326
 * status. Traduzir dentro dele:
 *
 *   - transformaria todo merge com o upstream num conflito de 300 hunks;
 *   - misturaria o que e DADO do cliente (o icone, o `haveTimeLimit`) com o que
 *     e texto nosso;
 *   - e obrigaria a traduzir os 326, sendo que o servidor manda **57**.
 *
 * Aqui a traducao e uma camada FINA por cima: `StatusIcons.js` passa cada linha
 * por `emPortugues()` ao montar a dica. **Frase que nao esta no dicionario sai
 * como veio** — nada quebra, e o que falta fica legivel em ingles em vez de
 * sumir.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO E MEDIDO, E ELE E O QUE O JOGADOR ALCANCA
 * ---------------------------------------------------------------------------
 * O servidor manda 57 status ao cliente (`EFST_POR_STATUS`,
 * `servidor/mapa/status-no-fio.ts`). Desses, **43 tem descricao** no
 * `StatusInfo` — os outros 14 nao tem texto nenhum para traduzir. As 104 frases
 * abaixo sao TODAS as linhas desses 43.
 *
 * Os 269 status restantes do arquivo upstream seguem em ingles de proposito: o
 * servidor nao os envia, e traduzi-los seria trabalho que ninguem le.
 */

/**
 * As frases, exatamente como aparecem em `StatusInfo.js`.
 *
 * A chave e o texto ORIGINAL porque e o que a dica tem em maos na hora de
 * montar — um mapa por id de status obrigaria a repetir a estrutura de linhas
 * do upstream aqui, e a duplicata divergiria no primeiro `git pull`.
 */
const PT_BR = {
	/* -------- o relogio da dica (ver `StatusIcons.js`) -------- */
	minute: 'minuto',
	second: 'segundo',

	/* -------- Acolito / Sacerdote -------- */
	Blessing: 'Benção',
	'Increases DEX, INT and STR': 'Aumenta DEX, INT e STR',
	'Recovers from a few status effects': 'Cura alguns efeitos de estado',
	'Increase agility': 'Aumentar Agilidade',
	'Increases Movement Speed': 'Aumenta a velocidade de movimento',
	'Increases Attack Speed': 'Aumenta a velocidade de ataque',
	'Decrease Agility': 'Diminuir Agilidade',
	'Reduces Movement Speed': 'Reduz a velocidade de movimento',
	'Reduces ASPD': 'Reduz a velocidade de ataque',
	Angelus: 'Angelus',
	'Increases VIT DEF': 'Aumenta a defesa de VIT',
	'Signum Crucis': 'Signum Crucis',
	'Reduces Undead and Demon monsters DEF': 'Reduz a defesa de mortos-vivos e demônios',
	'Slow Poison': 'Antídoto',
	'Temporarily stops Poison Damage': 'Interrompe o dano de veneno temporariamente',
	Gloria: 'Gloria',
	'Increases LUK': 'Aumenta LUK',
	'Lex Aeterna': 'Lex Aeterna',
	'Doubles damage of the next attack': 'Dobra o dano do próximo golpe',
	'Impositio Manus': 'Impositio Manus',
	'Increases Weapon damage': 'Aumenta o dano da arma',
	Magnificat: 'Magnificat',
	'Increases natural SP Recovery Speed': 'Acelera a recuperação natural de SP',
	Aspersio: 'Aspersio',
	'Enchants Weapon with Holy Property': 'Encanta a arma com propriedade Sagrada',
	Assumptio: 'Assumptio',
	'Increases Defense': 'Aumenta a defesa',
	'Kyrie Eleison': 'Kyrie Eleison',
	'A defensive barrier that blocks a certain number of attacks':
		'Barreira que bloqueia um número de golpes',

	/* -------- Espadachim / Cavaleiro -------- */
	Provoke: 'Provocar',
	'Reduces VIT DEF': 'Reduz a defesa de VIT',
	'Increases ATK': 'Aumenta o ATQ',
	Endure: 'Endurance',
	'Enables attacking and movement': 'Permite atacar e andar',
	'while receiving damage': 'enquanto recebe dano',
	'Two Hand Quicken': 'Agilidade de Duas Mãos',
	'When using two handed weapons,': 'Com armas de duas mãos,',
	'increases ASPD': 'aumenta a velocidade de ataque',
	'Defender (Defending Aura)': 'Defender (Aura Defensiva)',
	'Reduce Damage from Ranged Physical Attack': 'Reduz o dano físico à distância',
	'Reduces Movement Speed and Attack Speed':
		'Reduz a velocidade de movimento e de ataque',
	'Spear Quicken': 'Agilidade de Lança',
	'Increase ASPD when using Spear': 'Aumenta a velocidade de ataque com lança',
	'Increase Critical rate': 'Aumenta a taxa de crítico',
	'Increase Flee': 'Aumenta a esquiva',
	'Auto Guard': 'Defesa Automática',
	'Has a chance to block physical attacks': 'Tem chance de bloquear golpes físicos',
	Parrying: 'Parry',
	'Blocks physical attacks by chance': 'Bloqueia golpes físicos por chance',
	'Reflect Shield': 'Escudo Reflexivo',
	'When attacked with physical short range attacks': 'Ao levar golpe físico corpo a corpo,',
	'reflect a portion of the damage': 'reflete parte do dano',
	'Sword Reject': 'Rejeitar Espada',
	'Reflects damage back to attacking monsters': 'Reflete o dano de volta ao monstro',
	'(for all monster attacks)': '(para todo golpe de monstro)',
	'Damage received is reduced by 1/2': 'O dano recebido cai pela metade',
	'You receive the other 1/2 of damage': 'A outra metade você recebe',

	/* -------- Arqueiro / Cacador -------- */
	'Attention Concentration': 'Concentração',
	'Increases DEX, AGI': 'Aumenta DEX e AGI',
	'Reveals nearby hidden enemies': 'Revela inimigos escondidos por perto',
	'True Sight': 'Visão Verdadeira',
	'Increases all stats': 'Aumenta todos os atributos',
	'Increases ATK, HIT, CRIT': 'Aumenta ATQ, acerto e crítico',
	'Wind Walk': 'Caminho do Vento',
	'Increases Movement Speed/Evasion': 'Aumenta a velocidade de movimento e a esquiva',

	/* -------- Mercador / Ferreiro -------- */
	'Adrenaline Rush': 'Adrenalina',
	'Increases Attack Speed of': 'Aumenta a velocidade de ataque de',
	'Axes and Mace weapons': 'machados e maças',
	'Over Thrust': 'Impulso',
	'Increases weapon damage.': 'Aumenta o dano da arma.',
	'Increases the possibility of breaking the weapon.': 'Aumenta a chance de quebrar a arma.',
	'Maximum Over Thrust': 'Impulso Máximo',
	'Weapon Perfection': 'Perfuração',
	'Applies 100% damage to': 'Aplica 100% do dano em',
	'small, medium and large monsters': 'monstros pequenos, médios e grandes',
	'Maximize Power': 'Potência Máxima',
	'Increases damage to the maximum': 'Leva o dano ao máximo',
	'Drains SP over time': 'Consome SP com o tempo',
	'Chemical Protection (Weapon)': 'Proteção Química (Arma)',
	'Prevents weapon from being stripped/broken': 'Impede que a arma seja roubada ou quebrada',
	'Chemical Protection (Shield)': 'Proteção Química (Escudo)',
	'Prevents shield from being stripped/broken': 'Impede que o escudo seja roubado ou quebrado',
	'Chemical Protection (Armor)': 'Proteção Química (Armadura)',
	'Prevents body Armor from being stripped/broken':
		'Impede que a armadura seja roubada ou quebrada',
	'Chemical Protection Helm (Biochemical Helm)': 'Proteção Química (Elmo)',
	'Protect helm from being destroyed': 'Impede que o elmo seja destruído',

	/* -------- Ladrao / Assassino -------- */
	Cloaking: 'Camuflagem',
	Invisible: 'Invisível',
	'Enchant Deadly Poison': 'Veneno Mortal',
	'Applies a deadly poison to weapon': 'Aplica um veneno mortal à arma',
	'Damage increase does not apply to boss monsters': 'O aumento de dano não vale contra chefes',
	'Enchant Poison': 'Encantar Veneno',
	'Enchants Weapon with Poison Property': 'Encanta a arma com propriedade Venenosa',

	/* -------- Bruxo / desarme / chao -------- */
	Quagmire: 'Lamaçal',
	'Reduces AGI/DEX': 'Reduz AGI e DEX',
	'Ground skill effect': 'Efeito de habilidade de chão',
	'Weapon Off Status': 'Arma Removida',
	'Weapons cannot be worn': 'Não é possível usar arma',
	'Shield Off Status': 'Escudo Removido',
	'Shields cannot be worn': 'Não é possível usar escudo',
	'Armor Off Status': 'Armadura Removida',
	'Armor cannot be worn': 'Não é possível usar armadura',
	'Headgear Off Status': 'Elmo Removido',
	'Headgear cannot be worn': 'Não é possível usar elmo',

	/* -------- Bardo / Odalisca: as cancoes, as dancas e os conjuntos (10/09/2026) -------- */
	'Perfect Tablature': 'Assovio',
	"Increase party member's FLEE": 'Bônus de Esquiva',
	'Increase perfect dodge.': 'e Esquiva Perfeita',
	'Impressive Riff': 'Crepúsculo Sangrento',
	"Increase party member's ASPD.": 'Bônus de Vel.Atq',
	'(Reduce delay after attack.)': '(reduz o atraso depois do ataque)',
	'Magic Strings': 'Poema de Bragi',
	"Reduce party member's variable casting.": 'Reduz a conjuração variável',
	'Reduce delay after skill.': 'e o atraso depois da habilidade',
	'Song of Lutie': 'Maçãs de Idun',
	"Increase party member's maximum HP.": 'Bônus de HP máx.',
	'Increase healings received.': 'e Cura Recebida',
	'Focus Ballet': 'Sibilo',
	"Increase party member's HIT.": 'Bônus de Precisão',
	'Slow Grace': 'Não me Abandones',
	'Reduce movement speed and ASPD.': 'Movimento e Vel.Atq reduzidos.',
	'Removes all effects that increase ASPD and movement speed.':
		'Remove os efeitos que aumentam a Vel.Atq e o movimento.',
	'Lady Luck': 'Beijo da Sorte',
	"Increase party member's CRI.": 'Bônus de CRIT',
	'Increase critical damage.': 'e dano crítico',
	"Gypsy's Kiss": 'Dança Cigana',
	"Increase party member's maximum SP.": 'Bônus de SP máx.',
	'Reduce SP consumption.': 'Menor custo de SP',
	'Mental Sensing': 'Banquete de Njord',
	'When hunting monsters': 'Ao caçar monstros,',
	'Exp, JOB exp Increase': 'bônus de EXP de base e de classe',
	'Down Tempo': 'Ritmo Caótico',
	'Armor fixed to 0.': 'DEF zero.',
	'Battle Theme': 'Rufar dos Tambores',
	"Increase party members' ATK and DEF.": 'Bônus de ATQ e DEF',
	'Classical Pluck': 'Lamento de Loki',
	'Cannot use a skill.': 'Não pode usar habilidades.',
	'Chance to Confuse.': 'Chance de causar Confusão.',
	'Power Cord': 'Canção Preciosa',
	'Remove Gemstone consumption of a party member.': 'Anula o custo de gemas',
	'(There are few exceptions).': '(com poucas exceções)',
	'Acoustic Rhythm': 'Ode a Siegfried',
	'Tolerance to Water/Wind/Earth/Fire': 'Resistência a Água, Vento, Terra e Fogo',
	'for party members.': 'para o grupo.',
	'Tolerance to some status effect.': 'Resistência a alguns efeitos de estado.',
	Amp: 'Aquecimento',
	'Decrease SP consumption': 'Reduz o custo de SP',
	'for perfoming, dancing and duet skill.': 'das canções, danças e conjuntos.',

	/* -------- Sabio, Monge e Sacerdote: o que o StatusInfo ja tinha (10/09/2026) -------- */
	'Reduces cast time.': 'Reduz a conjuração variável',
	'Flame Launcher': 'Chama',
	'Enchants Weapon with Fire Property': 'Encanta a arma com propriedade Fogo',
	'Frost Weapon (Endow Tsunami)': 'Geada',
	'Enchants Weapon with Water Property': 'Encanta a arma com propriedade Água',
	'Lightning Loader': 'Ventania',
	'Enchants Weapon with Wind Property': 'Encanta a arma com propriedade Vento',
	'Seismic Weapon': 'Terremoto',
	'Enchants Weapon with Earth Property': 'Encanta a arma com propriedade Terra',
	'Steel Body': 'Corpo Fechado',
	'Sets DEF and MDEF to a fixed amount.': 'DEF e DEFM fixas num valor alto',
	'Reduces Movement Speed and ASPD': 'Reduz o movimento e a Vel.Atq',
	'Skills are disabled': 'Impede o uso de habilidades',
	'Asura Strike (Guillotine Fist)': 'Punho Supremo de Asura',
	'SP recovery is disabled': 'Impede a regeneração de SP',

	/* -------- Lorde e Arquimago: tres que ja chegavam sem arte (10/09/2026) -------- */
	'Aura Blade': 'Lâmina de Aura',
	'Increase in Physical damage': 'Bônus de ATQ',
	'Spear Dynamo': 'Dedicação',
	'ATK, Increase Accuracy': 'Bônus de ATQ e de Precisão',
	'Physical Defense reduced': 'Reduz a DEF',
	'Magic Amplification': 'Amplificação Mística',
	'MATK Amplified': 'Bônus de ATQM',
};

/**
 * A frase em portugues, ou ela mesma quando nao ha traducao.
 *
 * O retorno pelo original e deliberado: uma dica em ingles e pior que uma em
 * portugues, e MUITO melhor que uma dica vazia. Traduzir e melhoria continua;
 * quebrar a tela nao e opcao.
 */
export function emPortugues(frase) {
	return Object.prototype.hasOwnProperty.call(PT_BR, frase) ? PT_BR[frase] : frase;
}

export default PT_BR;
