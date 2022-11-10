var _ = browser.i18n.getMessage;

var Menu = {
	getMessage: info => {
		return info.selectedMessages.messages[0];
	},
	getId: info => {
		return Menu.getMessage(info).id;
	},
	paste: async id => {
		let oldNote = getFromClipboard();
		createNoteForMessage(id).then(newNote => {
			newNote.set({
				left: oldNote.left,
				top: oldNote.top,
				width: oldNote.width,
				height: oldNote.height,
				text: oldNote.text,
				ts: Date.now()
			});
			newNote.save();
		});
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
		// Modify
		browser.menus.create({
			id: "modify",
			title: _("modify.note"),
			contexts: ["message_list", "page", "frame"],
			onclick(info) {
				QNotePopForMessage(id, POP_FOCUS);
			}
		});

		// Copy
		browser.menus.create({
			id: "copy",
			title: _("copy"),
			contexts: ["message_list", "page", "frame"],
			onclick() {
				loadNoteForMessage(id).then(note => {
					addToClipboard(note);
				});
			}
		});

		// Existing paste
		browser.menus.create({
			id: "paste",
			title: _("paste"),
			enabled: isClipboardSet(),
			contexts: ["message_list", "page", "frame"],
			async onclick() {
				Menu.paste(id);
			}
		});

		// Delete
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
			}
		});

		// Reset
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
			}
		});

		browser.menus.create(Menu.optionsMenu);
	},
	new: id => {
		// Create new
		browser.menus.create({
			id: "create",
			title: _("create.new.note"),
			contexts: ["message_list", "page", "frame"],
			async onclick() {
				QNotePopForMessage(id, POP_FOCUS);
			}
		});

		// New paste
		if(isClipboardSet()){
			browser.menus.create({
				id: "paste",
				title: _("paste"),
				contexts: ["message_list", "page", "frame"],
				async onclick() {
					Menu.paste(id);
				}
			});
		}
	},
	multi: () => {
		// Create multi
		browser.menus.create({
			id: "create_multi",
			title: _("create.or.update.selected.notes"),
			contexts: ["message_list"],
			async onclick(info) {
				createMultiNote(info.selectedMessages.messages, true);
			}
		});

		// Paste multi
		browser.menus.create({
			id: "paste_multi",
			title: _("paste.into.selected.messages"),
			contexts: ["message_list"],
			enabled: isClipboardSet(),
			async onclick(info) {
				for(const m of info.selectedMessages.messages){
					await Menu.paste(m.id);
				};
				mpUpdateForMultiMessage(info.selectedMessages.messages);
			}
		});

		// Delete multi
		browser.menus.create({
			id: "delete_multi",
			title: _("delete.selected.notes"),
			contexts: ["message_list"],
			async onclick(info) {
				if(await confirmDelete()) {
					for(const m of info.selectedMessages.messages){
						await ifNoteForMessageExists(m.id).then(() => {
							if(CurrentNote.messageId === m.id){
								CurrentNote.silentlyDeleteAndClose();
							} else {
								deleteNoteForMessage(m.id).then(updateNoteView).catch(e => browser.legacy.alert(_("error.deleting.note"), e.message));
							}
						}).catch(() => { });
					}
					mpUpdateForMultiMessage(info.selectedMessages.messages);
				}
			}
		});

		// Reset multi
		browser.menus.create({
			id: "reset_multi",
			title: _("reset.selected.notes.windows"),
			contexts: ["message_list"],
			async onclick(info) {
				for(const m of info.selectedMessages.messages){
					ifNoteForMessageExists(m.id).then(() => {
						if(CurrentNote.messageId === m.id){
							CurrentNote.reset().then(() => {
								CurrentNote.silentlyPersistAndClose().then(() => {
									QNotePopForMessage(m.id, CurrentNote.flags)
								});
							});
						} else {
							saveNoteForMessage(m.id, {
								left: undefined,
								top: undefined,
								width: Prefs.width,
								height: Prefs.height
							}).catch(e => browser.legacy.alert(_("error.saving.note"), e.message));
						}
					}).catch(() => { });
				}
			}
		});

		browser.menus.create(Menu.optionsMenu);
	}
}
