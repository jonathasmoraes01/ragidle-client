/**
 * The PROSE of a skill's `descricao` — the text that says what it does (D-476).
 *
 * ## The two meanings of one field
 *
 * The server sends `descricao` as the WHOLE description box of the official
 * client, one array element per rendered line — the producer says so by hand in
 * `tools/skill-name/index.ts`: *"o corpo de cada bloco e uma lista de strings,
 * uma por linha da caixa de descricao do cliente"*.
 *
 * `IdleSkills.js` used to read `descricao[0]` and nothing else. Measured across
 * the 20 playable trees: **239 of 239** entries lost lines — **2.194** lines in
 * total — and in **237** of them line 0 is the skill's own PT name, which the
 * title right above already shows. The paragraph under "Bênção" read "Bênção
 * (Blessing)", and the sentence saying what Blessing DOES never reached the
 * screen. The skill point is irreversible, and this window is where it is spent.
 *
 * ## The shape, measured and not guessed
 *
 * ```
 * [0] "Bênção (Blessing)"                 <- the name, already in the title
 * [1] "Nível máximo: 10"                  <- metadata, shown elsewhere
 * [2] "Pré-requisitos: Proteção Divina 5"
 * [3] "Tipo: Suporte"
 * [4] "Descrição:"                        <- the MARKER
 * [5] "Aumenta a DES, INT, FOR, Precisão e retira"
 * [6] "os efeitos de [Maldição] e [Petrificação]."
 * [7] "Em Demônios e Mortos-Vivos, reduz DES,"
 * [8] "INT e FOR em 50%."
 * [9] "Nível l DES, INT, FOR l Precisão l Duração"   <- table header
 * [10..] "[Nv 1]: ..."                    <- buildMecanicaRows reads these
 * ```
 *
 * Counted over the 239, on 21/08/2026:
 *
 * | fact | count |
 * |---|---|
 * | with a `Descrição:` marker line of its own | 238 |
 * | with marker AND text on the same line (MO_DODGE) | 1 |
 * | with a `[Nv]` block | 201 |
 * | of those, a ` l ` table header right before it | 200 |
 * | with NO `[Nv]` block at all | 38 |
 *
 * The one exception to the header rule is NV_BASIC, whose line before the block
 * is real prose — which is why the header is dropped by CONTENT (` l `, the
 * column separator the lua uses) and not by position.
 *
 * The source breaks lines mid-sentence and the client does not reflow, so the
 * lines are joined with a space to put the sentence back together.
 *
 * ## Why it lives in its own file
 *
 * `IdleSkills.js` imports the renderer, the network layer and the GUI base
 * class; a test of this rule would have to boot all of it. Here the rule is a
 * pure string transform with no imports, so `tests/ui/resumoDaDescricao.test.js`
 * can call it directly — which is what makes a mutant in it able to kill a test.
 */

/**
 * @param {{descricao?: string[]}} skill
 * @returns {string|null} the prose, or `null` when there is nothing to show
 */
export default function buildResumo(skill) {
	const descricao = (skill && skill.descricao) || [];
	if (!descricao.length) {
		return null;
	}

	const linhas = descricao.map(l => String(l || '').trim());
	const prosa = [];

	// The marker, with the text that may already be on the same line.
	const iMarcador = linhas.findIndex(l => /^descri[çc][ãa]o\s*:/i.test(l));
	if (iMarcador >= 0) {
		const naMesmaLinha = linhas[iMarcador].replace(/^descri[çc][ãa]o\s*:\s*/i, '');
		if (naMesmaLinha) {
			prosa.push(naMesmaLinha);
		}
		for (let i = iMarcador + 1; i < linhas.length; i++) {
			if (/^\[Nv/i.test(linhas[i])) {
				break;
			}
			if (linhas[i]) {
				prosa.push(linhas[i]);
			}
		}
	}

	// The per-level table header is not prose. It is recognised by the ` l `
	// column separator, and only stripped when it is the LAST line — a middle
	// line with ` l ` would be a sentence, not a header.
	if (prosa.length > 1 && / l /.test(prosa[prosa.length - 1])) {
		prosa.pop();
	}

	if (prosa.length) {
		return prosa.join(' ');
	}

	// No marker: fall back to the old behaviour rather than showing nothing.
	// Unreached by all 239 playable-tree entries as of 21/08/2026 — it exists
	// for description shapes this measurement has not seen.
	const first = linhas[0];
	if (/^\[Nv/i.test(first)) {
		return null;
	}
	return first;
}
