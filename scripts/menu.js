var Menu = {
	getId: (info) => {
		return info.selectedMessages.messages[0].id;
	},
	modify: () => {
		browser.menus.create({
			id: "modify",
			title: "Modify note",
			contexts: ["message_list"],
			async onclick(info) {
				popCurrentNote(Menu.getId(info), false, true);
			},
		});

		browser.menus.create({
			id: "delete",
			title: "Delete note",
			contexts: ["message_list", "browser_action"],
			async onclick(info) {
				let messageId = Menu.getId(info);
				// Close only if deleting CurrentNote
				if(CurrentNote && (CurrentNote.messageId == messageId)){
					await closeCurrentNote();
				}
				let note = await createNote(messageId);
				let data = await note.load();
				if(data){
					await note.delete();
					// Remove tag only if deleting CurrentNote
					if(CurrentNote && (CurrentNote.messageId == messageId)){
						tagCurrentNote(false);
					}
					updateMessageIcon(false);
				}
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
			async onclick() {
				await resetCurrentNote();
			},
		});
	},
	new: () => {
		browser.menus.create({
			id: "create",
			title: "Create new note",
			contexts: ["message_list"],
			async onclick(info) {
				popCurrentNote(Menu.getId(info), true, true);
			},
		});
	}
}
