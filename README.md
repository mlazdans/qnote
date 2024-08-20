# Table of contents
1. [About](#about)
2. [Features](#features)
3. [Usage](#usage)
4. [Storage](#storage)
5. [Popup windows](#popup-windows)
6. [Screenshots](#screenshots)
7. [Known issues](#known-issues)
8. [Donations](#donations)

# About

This is source code repository for Thunderbird [QNote](https://addons.thunderbird.net/en-US/thunderbird/addon/qnote/) add-on. To install extension just zip whole folder and rename file's extension to .xpi and add it to Thunderbird.

<p><img src="https://img.shields.io/badge/QNote-v0.13.0-brightgreen">
<img src="https://img.shields.io/badge/Thunderbird-v68.2.0%20--%20128.x-brightgreen"></p>

# Features

- Add notes to e-mail messages
- Save note position, size, multiple default note positions
- Searchable notes via Thunderbird's QuickFilter or Edit / Find / Search Messages
- Various filter actions via Tools / Message Filters
- Clipboard Copy / Paste
- Mail pane column with note icon and / or note preview
- Actions on multi message selection: create, update, delete, reset, copy, paste
- Attach note to message body
- Attach note when printing
- Light / dark theme
- Multiple locales and localized date formats
- Auto tag message when adding note
- Fully <a href="https://addons.thunderbird.net/en-US/thunderbird/addon/xnotepp/">XNote++</a> (3.0.0) compatible
- Import / export between to XNote++ (\*.xnote) and QNote (\*.qnote) formats
- Supports older Thunderbird versions, starting 68.2.0
- Templating support for attaching to print and message

# Usage

- Alt+Q to toggle note
- ESC to close note without saving
- Right click context menu to delete note or reset note window
- Use QuickFilter or Message Search to search notes (only for folder storage)
- Use Filter Manager to create custom actions (only for folder storage)

# Storage

There are two options for storing notes:

- Inside extension
- Outside extension in folder

Currently storing notes outside extension is more versatile and preffered way. This enables seaching notes and sharing with different computers using sharing mechanism like Dropbox, NFS, Windows / Samba share, etc. You can also use XNote++ folder.

When modifying XNote++ notes (.xnote extension) these will be saved in more versatile JSON format (.qnote extension).

__If you are using internal storage then don't forget to export data before removing extension!__

# Popup windows

There are two options for note window:

- Floating panel
- Popup window

_Floating panel_ has nicer looks but does not display well on MacOS. Fall back to _Popup window_ if experience difficulties with _Floating panel_.

# Screenshots

<p><a href="thunderbird.net/screenshots/_combined.png">All screenshots (PNG)</a></p>

<p align="center" width="100%">
<img width="30%" src="thunderbird.net/screenshots/note.jpg" alt="Note popup">
<img width="30%" src="thunderbird.net/screenshots/utf8chars.jpg" alt="UTF-8 chars">
<img width="30%" src="thunderbird.net/screenshots/attach_message.jpg" alt="Attach to message">
</p>
<p align="center" width="100%">
<img width="30%" src="thunderbird.net/screenshots/attach_print.jpg" alt="Attach to print">
<img width="30%" src="thunderbird.net/screenshots/column.jpg" alt="Column header">
<img width="30%" src="thunderbird.net/screenshots/menu.jpg" alt="Right click menu">
</p>
<p align="center" width="100%">
<img width="30%" src="thunderbird.net/screenshots/quick_filter.jpg" alt="Searchable notes">
<img width="30%" src="thunderbird.net/screenshots/options1.jpg" alt="Options page 1">
<img width="30%" src="thunderbird.net/screenshots/options2.jpg" alt="Options page 2">
</p>
<p align="center" width="100%">
<img width="30%" src="thunderbird.net/screenshots/filters.jpg" alt="Message filters">
<img width="30%" src="thunderbird.net/screenshots/search.jpg" alt="Message search">
</p>

# Known issues
- Column handler text preview does not work with TB115 and newer
- QuickFilter does not work with TB115 and newer. You can still use message search.
- Search and filters working only when using _folder storage_ option.
- Does not work very well together with <a href="https://addons.thunderbird.net/en-US/thunderbird/addon/gmail-conversation-view/">Conversations</a> plugin.
- TB 91.x versions does not work well on Macs when using _Floating panel_ window option.

# Donations

I enjoy some [beer](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CCFL84AMQKV4S&source=url) now and then. Much appreciated! ;)
