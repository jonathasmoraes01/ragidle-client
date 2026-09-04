/** A vida do servidor fica intacta; so a barra espera o impacto visual. */
export default class VidaNoImpacto {
	constructor(agora, agendar, cancelar, redesenhar) {
		this.agora = agora;
		this.agendar = agendar;
		this.cancelar = cancelar;
		this.redesenhar = redesenhar;
		this.hpRecebido = null;
		this.hpVisual = 0;
		this.impactos = [];
		this.eventos = new Set();
		this.ultimoImpacto = 0;
		this.mortePendente = false;
	}

	registrar(instantes) {
		this.impactos = this.impactos.filter(grupo => grupo.some(p => p.instante > this.agora()));
		this.impactos.push(instantes.map(p => (typeof p === 'number' ? { instante: p, peso: 1 } : p)));
	}

	depois(instante, acao) {
		const evento = this.agendar(
			() => {
				this.eventos.delete(evento);
				acao();
			},
			Math.max(0, instante - this.agora())
		);
		this.eventos.add(evento);
	}

	receber(hp, maximo) {
		if (this.hpRecebido === null || this.hpRecebido < 0 || hp < 0) {
			this.hpRecebido = hp;
			this.hpVisual = hp;
			return hp;
		}
		const delta = hp - this.hpRecebido;
		this.hpRecebido = hp;
		const impactos = delta < 0 ? this.impactos.shift() : null;
		if (impactos?.length) {
			let aplicado = 0;
			let pesoAcumulado = 0;
			const pesoTotal = impactos.reduce((soma, p) => soma + p.peso, 0);
			for (let i = 0; i < impactos.length; i++) {
				// Partilha o DELTA real, nao o dano bruto (que pode ser overkill).
				pesoAcumulado += impactos[i].peso;
				const acumulado = Math.round((delta * pesoAcumulado) / pesoTotal);
				const parcela = acumulado - aplicado;
				aplicado = acumulado;
				const instante = impactos[i].instante;
				this.ultimoImpacto = Math.max(this.ultimoImpacto, instante);
				if (instante <= this.agora()) {
					this.hpVisual += parcela;
				} else {
					this.depois(instante, () => {
						this.hpVisual += parcela;
						this.redesenhar();
					});
				}
			}
		} else {
			// Cura, dano sem animacao e retratos de entrada continuam verdadeiros.
			this.hpVisual += delta;
		}
		// Grampear so a exibicao preserva a soma se uma cura chegar antes do hit.
		return Math.max(0, Math.min(maximo, this.hpVisual));
	}

	adiarMorte(remover) {
		if (this.mortePendente) return true;
		if (this.ultimoImpacto <= this.agora()) return false;
		this.mortePendente = true;
		this.depois(this.ultimoImpacto, () => {
			this.mortePendente = false;
			remover();
		});
		return true;
	}

	limpar() {
		for (const evento of this.eventos) this.cancelar(evento);
		this.eventos.clear();
		this.impactos.length = 0;
		this.hpRecebido = null;
		this.ultimoImpacto = 0;
		this.mortePendente = false;
	}
}
