var _ = browser.i18n.getMessage;

var Menu = {
	getMessage: info => {
		return info.selectedMessages.messages[0];
	},
	getId: info => {
		return Menu.getMessage(info).id;
	},
	modify: () => {
		browser.menus.create({
			id: "modify",
			title: _("modify.note"),
			contexts: ["message_list"],
			onclick(info) {
				QNotePopForMessage(Menu.getId(info), POP_FOCUS);
			},
		});

		browser.menus.create({
			id: "delete",
			title: _("delete.note"),
			contexts: ["message_list"],
			async onclick(info) {
				let messageId = Menu.getId(info);
				if(CurrentNote.messageId === messageId){
					CurrentNote.deleteAndClose().catch(e => {
						if(e instanceof DirtyStateError){
							browser.legacy.alert(_("close.current.note"));
						} else {
							throw e;
						}
					});
				} else {
					if(await confirmDelete()) {
						deleteNoteForMessage(Menu.getId(info)).then(updateNoteView).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
					}
				}
			},
		});

		browser.menus.create({
			id: "options",
			title: _("options"),
			contexts: ["message_list"],
			onclick(info) {
				browser.runtime.openOptionsPage();
			},
		});

		browser.menus.create({
			id: "separator-1",
			type: "separator",
			contexts: ["message_list"]
		});

		browser.menus.create({
			id: "reset",
			title: _("reset.note.window"),
			contexts: ["message_list"],
			onclick(info) {
				let messageId = Menu.getId(info);

				if(CurrentNote.messageId === messageId){
					CurrentNote.reset().then(() => {
						CurrentNote.silentlyPersistAndClose().then(() => {
							QNotePopForMessage(messageId, CurrentNote.flags)
						});
					});
				} else {
					saveNoteForMessage(messageId, {
						left: undefined,
						top: undefined,
						width: Prefs.width,
						height: Prefs.height
					}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
				}
			},
		});
	},
	new: () => {
		browser.menus.create({
			id: "create",
			title: _("create.new.note"),
			contexts: ["message_list"],
			async onclick(info) {
				QNotePopForMessage(Menu.getId(info), POP_FOCUS);
			},
		});
	}
}
