import { isClipboardSet } from "./common-background.mjs";

var _ = browser.i18n.getMessage;

export var Menu = {
	optionsMenu: {
		id: "options",
		title: _("options"),
		contexts: ["message_list", "page", "frame"],
	},
	modify: async () => {
		// Modify
		browser.menus.create({
			id: "modify",
			title: _("modify.note"),
			contexts: ["message_list", "page", "frame"],
		});

		// Copy
		browser.menus.create({
			id: "copy",
			title: _("copy"),
			contexts: ["message_list", "page", "frame"],
		});

		// Existing paste
		browser.menus.create({
			id: "paste",
			title: _("paste"),
			enabled: isClipboardSet(await browser.qnote.getFromClipboard()),
			contexts: ["message_list", "page", "frame"],
		});

		// Delete
		browser.menus.create({
			id: "delete",
			title: _("delete.note"),
			contexts: ["message_list", "page", "frame"],
		});

		// Reset
		browser.menus.create({
			id: "reset",
			title: _("reset.note.window"),
			contexts: ["message_list", "page", "frame"],
		});

		browser.menus.create(Menu.optionsMenu as browser.menus._CreateCreateProperties);
	},
	new: async () => {
		browser.menus.create({
			id: "create",
			title: _("create.new.note"),
			contexts: ["message_list", "page", "frame"],
		});

		if(isClipboardSet(await browser.qnote.getFromClipboard())){
			browser.menus.create({
				id: "paste",
				title: _("paste"),
				contexts: ["message_list", "page", "frame"],
			});
			browser.menus.create(Menu.optionsMenu as browser.menus._CreateCreateProperties);
		}
	},
	multi: async () => {
		// Create multi
		browser.menus.create({
			id: "create_multi",
			title: _("create.or.update.selected.notes"),
			contexts: ["message_list"],
		});

		// Paste multi
		browser.menus.create({
			id: "paste_multi",
			title: _("paste.into.selected.messages"),
			contexts: ["message_list"],
			enabled: isClipboardSet(await browser.qnote.getFromClipboard()),
		});

		// Delete multi
		browser.menus.create({
			id: "delete_multi",
			title: _("delete.selected.notes"),
			contexts: ["message_list"],
		});

		// Reset multi
		browser.menus.create({
			id: "reset_multi",
			title: _("reset.selected.notes.windows"),
			contexts: ["message_list"],
		});

		browser.menus.create(Menu.optionsMenu as browser.menus._CreateCreateProperties);
	}
}
