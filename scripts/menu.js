var _ = browser.i18n.getMessage;

var Menu = {
	getId: (info) => {
		return info.selectedMessages.messages[0].id;
	},
	modify: () => {
		browser.menus.create({
			id: "modify",
			title: _("modify.note"),
			contexts: ["message_list"],
			onclick(info) {
				CurrentNote.pop(Menu.getId(info), false, true).then(()=>{
					CurrentNote.focus();
				});
			},
		});

		browser.menus.create({
			id: "delete",
			title: _("delete.note"),
			contexts: ["message_list"],
			onclick(info) {
				deleteNoteForMessage(Menu.getId(info));
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
				resetNoteForMessage(Menu.getId(info));
			},
		});
	},
	new: () => {
		browser.menus.create({
			id: "create",
			title: _("create.new.note"),
			contexts: ["message_list"],
			async onclick(info) {
				CurrentNote.pop(Menu.getId(info), true, true);
			},
		});
	}
}
