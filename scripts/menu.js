var Menu = {
	getId: (info) => {
		return info.selectedMessages.messages[0].id;
	},
	modify: () => {
		browser.menus.create({
			id: "modify",
			title: "Modify note",
			contexts: ["message_list"],
			onclick(info) {
				CurrentNote.pop(Menu.getId(info), false, true);
			},
		});

		browser.menus.create({
			id: "delete",
			title: "Delete note",
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
			title: "Reset note window",
			contexts: ["message_list"],
			onclick(info) {
				resetNoteForMessage(Menu.getId(info));
			},
		});
	},
	new: () => {
		browser.menus.create({
			id: "create",
			title: "Create new note",
			contexts: ["message_list"],
			async onclick(info) {
				CurrentNote.pop(Menu.getId(info), true, true);
			},
		});
	}
}
