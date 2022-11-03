var _ = browser.i18n.getMessage;

var Menu = {
	getMessage: info => {
		return info.selectedMessages.messages[0];
	},
	getId: info => {
		return Menu.getMessage(info).id;
	},
	optionsMenu: {
		id: "options",
		title: _("options"),
		contexts: ["message_list", "page", "frame"],
		onclick() {
			browser.runtime.openOptionsPage();
		}
	},
	modify: id => {
		browser.menus.create({
			id: "modify",
			title: _("modify.note"),
			contexts: ["message_list", "page", "frame"],
			onclick(info) {
				QNotePopForMessage(id, POP_FOCUS);
			},
		});

		browser.menus.create({
			id: "delete",
			title: _("delete.note"),
			contexts: ["message_list", "page", "frame"],
			async onclick() {
				if(CurrentNote.messageId === id){
					await CurrentNote.silentlyDeleteAndClose();
				} else {
					if(await confirmDelete()) {
						deleteNoteForMessage(id).then(updateNoteView).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
					}
				}
			},
		});

		browser.menus.create({
			id: "reset",
			title: _("reset.note.window"),
			contexts: ["message_list", "page", "frame"],
			onclick() {
				if(CurrentNote.messageId === id){
					CurrentNote.reset().then(() => {
						CurrentNote.silentlyPersistAndClose().then(() => {
							QNotePopForMessage(id, CurrentNote.flags)
						});
					});
				} else {
					saveNoteForMessage(id, {
						left: undefined,
						top: undefined,
						width: Prefs.width,
						height: Prefs.height
					}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
				}
			},
		});

		browser.menus.create(Menu.optionsMenu);
	},
	new: (id) => {
		browser.menus.create({
			id: "create",
			title: _("create.new.note"),
			contexts: ["message_list", "page", "frame"],
			async onclick(info) {
				QNotePopForMessage(id, POP_FOCUS);
			},
		});
		// browser.menus.create(Menu.optionsMenu);
	}
}
