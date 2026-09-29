/**
 * Payloads de exemplo do `0x0fb5` (ZC_RAGIDLE_CACA_MEDIDA), no formato da
 * secao 4 de `docs/CONTRATO-CACA-MEDIDA.md` (repositorio do servidor).
 *
 * Cada funcao devolve um objeto NOVO: o teste pode muta-lo sem contaminar o
 * vizinho.
 */

/** Um mapa medido, com todos os campos do contrato. */
export function mapaMedido(sobrescrever = {}) {
	return {
		mapa: 'orcsdun02',
		rotulo: 'Masmorra dos Orcs',
		minutos: 32,
		medido: true,
		fichaAtual: true,
		expBasePorHora: 16293,
		expClassePorHora: 9100,
		zenyPorHora: 9800,
		pocoesPorHora: 1448,
		mortes: 17,
		mortesPorHora: 32,
		abatesPorHora: 181,
		...sobrescrever
	};
}

/** O estado sem mapa nenhum, com a sugestao da escada. */
export function estadoVazio() {
	return {
		v: 1,
		mapaAtual: null,
		sugestaoDaEscada: { mapa: 'prt_fild08', rotulo: 'Campos de Prontera' },
		mapas: [],
		explorar: { estado: 'parado' }
	};
}

/** Tres mapas: dois medidos (um mais EXP, outro mais zeny) e um medindo. */
export function estadoComMapas() {
	return {
		v: 1,
		mapaAtual: 'cmd_fild06',
		sugestaoDaEscada: { mapa: 'orcsdun02', rotulo: 'Masmorra dos Orcs' },
		mapas: [
			mapaMedido({ mapa: 'orcsdun02', rotulo: 'Masmorra dos Orcs', expBasePorHora: 16293, zenyPorHora: 9800, mortes: 17, mortesPorHora: 32 }),
			mapaMedido({ mapa: 'cmd_fild06', rotulo: 'Campos de Comodo', expBasePorHora: 12000, zenyPorHora: 21000, mortes: 0, mortesPorHora: 0 }),
			mapaMedido({ mapa: 'pay_dun00', rotulo: 'Caverna de Payon', minutos: 4, medido: false, expBasePorHora: 99999, zenyPorHora: 99999, mortes: 1, mortesPorHora: 1 })
		],
		explorar: { estado: 'parado' }
	};
}

/** No meio da exploracao: o segundo candidato em curso. */
export function estadoExplorando() {
	return {
		v: 1,
		mapaAtual: 'mjo_dun02',
		sugestaoDaEscada: { mapa: 'mjo_dun02', rotulo: 'Mina de Mjolnir' },
		mapas: [],
		explorar: {
			estado: 'explorando',
			indice: 1,
			candidatos: [
				{ mapa: 'ama_dun02', rotulo: 'Amatsu F2', estado: 'arriscado', minutos: 3, expBasePorHora: null, mortes: 1 },
				{ mapa: 'mjo_dun02', rotulo: 'Mina de Mjolnir', estado: 'medindo', minutos: 6, expBasePorHora: null, mortes: 0 },
				{ mapa: 'cmd_fild06', rotulo: 'Campos de Comodo', estado: 'esperando', minutos: 0, expBasePorHora: null, mortes: 0 }
			]
		}
	};
}

/** A exploracao terminou; `escolhido` pode ser `null` (nenhum passou). */
export function estadoConcluido(escolhido = 'cmd_fild06') {
	return {
		v: 1,
		mapaAtual: escolhido,
		sugestaoDaEscada: null,
		mapas: [],
		explorar: {
			estado: 'concluido',
			escolhido,
			candidatos: [
				{ mapa: 'ama_dun02', rotulo: 'Amatsu F2', estado: 'arriscado', minutos: 3, expBasePorHora: null, mortes: 1 },
				{ mapa: 'cmd_fild06', rotulo: 'Campos de Comodo', estado: 'medido', minutos: 10, expBasePorHora: 14500, mortes: 0 }
			]
		}
	};
}

/**
 * N mapas medidos, com numeros variados: o tamanho do payload que a secao 6
 * usa como meta ("30 mapas medidos").
 */
export function estadoComNMapas(n) {
	const mapas = [];
	for (let i = 0; i < n; i++) {
		mapas.push(
			mapaMedido({
				mapa: `mapa_${String(i).padStart(2, '0')}`,
				rotulo: `Mapa de caça número ${i + 1}`,
				minutos: 10 + ((i * 7) % 50),
				medido: i % 5 !== 4,
				fichaAtual: i % 7 !== 3,
				expBasePorHora: 4000 + ((i * 3733) % 40000),
				expClassePorHora: 2000 + ((i * 2111) % 20000),
				zenyPorHora: 1000 + ((i * 4441) % 60000),
				pocoesPorHora: (i * 37) % 900,
				mortes: i % 3 === 0 ? 0 : i % 4,
				mortesPorHora: i % 3 === 0 ? 0 : (i % 4) * 2
			})
		);
	}
	return { v: 1, mapaAtual: 'mapa_03', sugestaoDaEscada: { mapa: 'mapa_03', rotulo: 'Mapa de caça número 4' }, mapas, explorar: { estado: 'parado' } };
}
