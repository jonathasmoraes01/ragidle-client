/**
 * Um catalogo PEQUENO do Mapa de Caca (`ZC_RAGIDLE_CATALOGO`, contrato 3),
 * recortado do catalogo real: seis mapas que cobrem o que o cartao desenha de
 * diferente — o mapa atual, o bloqueado, o de MVP, o covil, o favorito e o
 * comum. E o que `tests/ui/cacaMedidaNoMapa.test.js` desenha, com e sem o
 * bloco `cacaMedida` (secao 9 de `docs/CONTRATO-CACA-MEDIDA.md`).
 *
 * Cada funcao devolve um objeto NOVO: o teste pode muta-lo sem contaminar o
 * vizinho.
 */

export function catalogoPequeno(extra = {}) {
	return {
		v: 3,
		cidade: { mapa: 'prontera', rotulo: 'Prontera' },
		regioes: ['Prontera', 'Payon', 'Covil dos Chefes'],
		taxaDeExpPorDiferenca: {
			de: -31,
			taxas: [
				10, 35, 35, 35, 35, 35, 60, 60, 60, 60, 60, 85, 85, 85, 85, 85, 90, 90, 90, 90, 90, 95, 95, 95, 95, 95, 100, 100,
				100, 100, 100, 100, 100, 100, 102, 105, 107, 110, 112, 115, 117, 120, 100, 100, 100, 100, 100, 40
			]
		},
		mapaAtual: 'pay_fild01',
		nivel: 20,
		favoritos: ['prt_fild02'],
		voltarPara: null,
		mapas: [
			{
				mapa: 'prt_fild08',
				rotulo: 'Campo de Prontera',
				regiao: 'Prontera',
				nivelMinimo: 1,
				nivelMedio: 2.3,
				nivelMaximo: 3,
				nivelQueAbre: 1,
				monstros: [
					{ mobId: 1063, nome: 'Lunático', drops: [705, 949, 2262, 512] },
					{ mobId: 1002, nome: 'Poring', drops: [909, 1202, 938] }
				],
				mvp: null
			},
			{
				mapa: 'pay_fild01',
				rotulo: 'Floresta de Payon',
				regiao: 'Payon',
				nivelMinimo: 12,
				nivelMedio: 17,
				nivelMaximo: 23,
				nivelQueAbre: 17,
				monstros: [
					{ mobId: 1031, nome: 'Poporing', drops: [938, 909] },
					{ mobId: 1049, nome: 'Picky', drops: [916] }
				],
				mvp: null
			},
			{
				mapa: 'prt_fild02',
				rotulo: 'Campo de Prontera (2)',
				regiao: 'Prontera',
				nivelMinimo: 15,
				nivelMedio: 19,
				nivelMaximo: 24,
				nivelQueAbre: 19,
				monstros: [{ mobId: 1011, nome: 'Chonchon', drops: [701, 1002] }],
				mvp: null
			},
			{
				mapa: 'prt_sewb4',
				rotulo: 'Esgoto de Prontera (F4)',
				regiao: 'Prontera',
				nivelMinimo: 4,
				nivelMedio: 5.7,
				nivelMaximo: 7,
				nivelQueAbre: 7,
				monstros: [{ mobId: 1051, nome: 'Besouro-Ladrão', drops: [955, 2304] }],
				mvp: { mobId: 1086, nome: 'Besouro-Ladrão Dourado', drops: [969, 1524] }
			},
			{
				mapa: 'pay_d03_i',
				rotulo: 'Covil dos Chefes I',
				regiao: 'Covil dos Chefes',
				nivelMinimo: 2,
				nivelMedio: 19.9,
				nivelMaximo: 34,
				nivelQueAbre: 30,
				monstros: [
					{ mobId: 1090, nome: 'Mastering', drops: [2257, 619] },
					{ mobId: 1093, nome: 'Eclipse', drops: [2250, 507] }
				],
				mvp: null
			},
			{
				mapa: 'gef_fild10',
				rotulo: 'Campo de Geffen',
				regiao: 'Payon',
				nivelMinimo: 45,
				nivelMedio: 50,
				nivelMaximo: 55,
				nivelQueAbre: 50,
				monstros: [{ mobId: 1152, nome: 'Orc Skeleton', drops: [932, 1041] }],
				mvp: null
			}
		],
		...extra
	};
}

/**
 * O bloco `cacaMedida` na forma LEGIVEL (a do cliente depois de ler): dois
 * mapas medidos, risco de quase todos. O que desce no FIO e a forma enxuta v3
 * (secao 11) — `blocoNoFio` a monta daqui, como o servidor.
 */
export function blocoDaCacaMedida(extra = {}) {
	return {
		v: 3,
		limites: { seguro: 7, cuidado: 4 },
		medida: {
			pay_fild01: {
				minutos: 32,
				medido: true,
				fichaAtual: true,
				expBasePorHora: 7740,
				expClassePorHora: 5100,
				zenyPorHora: 21500,
				pocoesPorHora: 120,
				mortes: 0,
				mortesPorHora: 0,
				abatesPorHora: 181
			},
			prt_fild02: {
				minutos: 14,
				medido: true,
				fichaAtual: false,
				expBasePorHora: 9100,
				expClassePorHora: 6000,
				zenyPorHora: 4000,
				pocoesPorHora: 300,
				mortes: 2,
				mortesPorHora: 8,
				abatesPorHora: 150
			}
		},
		risco: {
			prt_fild08: [40, 's', 0],
			pay_fild01: [9, 's', 0],
			prt_fild02: [5, 'c', 1],
			prt_sewb4: [2, 'a', 0],
			gef_fild10: [1, 'a', 1]
		},
		explorar: { estado: 'parado' },
		...extra
	};
}

/** O `explorar` no meio: o segundo candidato em curso. */
export function explorarEmCurso() {
	return {
		estado: 'explorando',
		indice: 1,
		candidatos: [
			{ mapa: 'prt_fild02', rotulo: 'Campo de Prontera (2)', estado: 'arriscado', minutos: 3, expBasePorHora: null, mortes: 1 },
			{ mapa: 'pay_fild01', rotulo: 'Floresta de Payon', estado: 'medindo', minutos: 6, expBasePorHora: null, mortes: 0 },
			{ mapa: 'prt_sewb4', rotulo: 'Esgoto de Prontera (F4)', estado: 'esperando', minutos: 0, expBasePorHora: null, mortes: 0 }
		]
	};
}

/** O `explorar` no fim; `escolhido` pode ser `null` (nenhum passou). */
export function explorarConcluido(escolhido = 'pay_fild01') {
	return {
		estado: 'concluido',
		escolhido,
		candidatos: [
			{ mapa: 'prt_fild02', rotulo: 'Campo de Prontera (2)', estado: 'arriscado', minutos: 3, expBasePorHora: null, mortes: 1 },
			{ mapa: 'pay_fild01', rotulo: 'Floresta de Payon', estado: 'medido', minutos: 10, expBasePorHora: 7740, mortes: 0 },
			{ mapa: 'prt_sewb4', rotulo: 'Esgoto de Prontera (F4)', estado: 'medido', minutos: 10, expBasePorHora: 3100, mortes: 0 }
		]
	};
}

/** A ordem dos valores da tupla de `medida` no fio (secao 11). */
const CAMPOS_NO_FIO = [
	'minutos',
	'fichaAtual',
	'expBasePorHora',
	'expClassePorHora',
	'zenyPorHora',
	'pocoesPorHora',
	'mortes',
	'mortesPorHora',
	'abatesPorHora'
];

/**
 * O bloco LEGIVEL na forma do FIO (v3, D-1842 no servidor), como
 * `blocoDaCacaMedidaComoJson` o monta: so os mapas MEDIDOS, cada um numa tupla
 * de inteiros (`fichaAtual` 1/0), e o risco ALINHADO a ordem dos `mapas` do
 * catalogo (`{ n, g, l }`, `0` e `-` no mapa sem risco). O que nao e objeto
 * passa como veio (o teste do "ilegivel").
 *
 * @param {*} bloco  a forma legivel
 * @param {Array<{mapa: string}>} mapas  a ordem do catalogo (padrao: a do `catalogoPequeno`)
 */
export function blocoNoFio(bloco, mapas = catalogoPequeno().mapas) {
	if (!bloco || typeof bloco !== 'object') {
		return bloco;
	}
	const medida = {};
	for (const [mapa, c] of Object.entries(bloco.medida || {})) {
		if (Array.isArray(c)) {
			medida[mapa] = c; // ja esta na forma do fio
			continue;
		}
		if (!c || c.medido !== true) {
			continue;
		}
		medida[mapa] = CAMPOS_NO_FIO.map(k => (k === 'fichaAtual' ? (c.fichaAtual === false ? 0 : 1) : Number(c[k] || 0)));
	}
	let risco = bloco.risco;
	if (risco && typeof risco === 'object' && !('n' in risco)) {
		const legivel = risco;
		risco = {
			n: mapas.length,
			g: mapas.map(m => (legivel[m.mapa] ? legivel[m.mapa][0] : 0)),
			l: mapas.map(m => (legivel[m.mapa] ? legivel[m.mapa][1] : '-')).join('')
		};
	}
	return { ...bloco, medida, risco };
}

/** O `0x0fb5` (ou o catalogo) com o `cacaMedida` na forma do fio. */
export function comBlocoNoFio(dados, mapas) {
	return dados && dados.cacaMedida ? { ...dados, cacaMedida: blocoNoFio(dados.cacaMedida, mapas) } : dados;
}
