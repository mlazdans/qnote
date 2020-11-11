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
				QNoteMessagePop(Menu.getMessage(info));
			},
		});

		browser.menus.create({
			id: "delete",
			title: _("delete.note"),
			contexts: ["message_list"],
			onclick(info) {
				let messageId = Menu.getId(info);
				if(CurrentNote.messageId === messageId){
					// Ensure note close and additional handling there
					CurrentNote.deleteNote();
				} else {
					deleteNoteForMessage(Menu.getId(info)).then(updateNoteView);
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
			title: _("reset.note.window"),
			contexts: ["message_list"],
			onclick(info) {
				let messageId = Menu.getId(info);
				let data = {
					x: undefined,
					y: undefined,
					width: Prefs.width,
					height: Prefs.height
				};

				if(CurrentNote.messageId === messageId){
					CurrentNote.note.set(data);
					CurrentNote.updateWindow({
						left: data.x,
						top: data.y,
						width: data.width,
						height: data.height,
						focused: true
					});
				} else {
					saveNoteForMessage(messageId, data);
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
				QNoteMessagePop(Menu.getMessage(info));
			},
		});
	}
}
