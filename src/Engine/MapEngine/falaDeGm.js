/**
 * Engine/MapEngine/falaDeGm.js
 *
 * RAGIDLE: a linha do chat leva a tag [GM]? (24/09/2026, relato do dono).
 *
 * *"O Urso e administrador e a fala dele sai como '[Global] Urso', enquanto a
 * minha sai '[GM] Guizao' em amarelo."*
 *
 * O CRITERIO NAO ERA O DEFEITO. Quem e administrador e o servidor que diz
 * (`ZC_RAGIDLE_ADMINS` -> `Session.AdminList`), com a MESMA regra de
 * `ehAdministrador` (`grupoDaConta >= 99` ou a conta dona). O defeito era a
 * PERGUNTA: `onEntityTalk` so marcava a fala se a ENTIDADE de quem falou
 * estivesse na tela (`EntityManager.get(pkt.GID)`), e o chat e GLOBAL desde
 * 30/08/2026 (`difundirNoMundoExceto`) - quem fala de outro mapa nao tem
 * entidade aqui, entao todo administrador longe de quem le saia como jogador
 * comum. O dono se via com a tag porque o eco da propria fala ja perguntava
 * pela `Session.Entity` (Main.js).
 *
 * Agora a lista responde sozinha pelo GID (o `ZC_NOTIFY_CHAT` leva o
 * `contaId`, que e o que a lista traz). A entidade continua respondendo
 * quando existe: ela e reaplicada pela mesma lista (`onAdminList`), entao as
 * duas respostas coincidem - a lista so e perguntada por quem nao esta na
 * tela.
 *
 * Isto e COSMETICO (a mesma ressalva de `DB/Items/idParaAdmin.js`): o que um
 * administrador pode FAZER e decidido no servidor, nunca aqui.
 *
 * Puro de proposito: sem `Session`, sem `EntityManager`, para o teste medir a
 * regra sem o cliente de pe.
 *
 * @param {number} gid - o GID da fala (`pkt.GID`, a conta de quem falou)
 * @param {{isAdmin?: boolean}|null|undefined} entidade - a entidade na tela, se houver
 * @param {ReadonlyArray<number>|null|undefined} listaDeAdmins - `Session.AdminList`
 * @returns {boolean}
 */
export function falaDeGm(gid, entidade, listaDeAdmins) {
	// Com a entidade na tela, ela responde: o `isAdmin` dela ja saiu da MESMA
	// lista (`Entity.set` e `onAdminList`), e ela sabe o TIPO - um GID de mob
	// ou NPC nunca vira GM por coincidir com o numero de uma conta.
	if (entidade) {
		return Boolean(entidade.isAdmin);
	}
	return Array.isArray(listaDeAdmins) && listaDeAdmins.indexOf(gid) > -1;
}
