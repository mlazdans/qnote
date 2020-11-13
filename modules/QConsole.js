var EXPORTED_SYMBOLS = ["QConsole"];

class QConsole {
	constructor(oldcon){
		this.oldcon = oldcon;
		for(let k of ["log", "debug", "error", "warn", "info"]){
			this[k + "Enabled"] = true;
			this[k] = (...args) => {
				if(this[k + "Enabled"]) {
					this.oldcon[k]("QNote:", ...args);
				}
			}
		}
	}

	group(label) {
		this.oldcon.group(label);
	}

	groupEnd() {
		this.oldcon.groupEnd();
	}
}
