var EXPORTED_SYMBOLS = ["XUtils"];

var XUtils = {
	getDefaultPrefs() {
		return {
			usetag: false,
			dateformat: "yyyy-mm-dd - HH:MM",
			width: 250,
			height: 200,
			show_on_select: true,
			show_first_x_chars_in_col: 0,
			storage_path: '',
			version: '2.3.1'
		};
	},
	// TODO: Seems that "yyyy-mm-dd - HH:MM" format has been hardcoded? Not sure yet.
	noteDateToDate(dateString) {
		var retDate = new Date();
		let [date, time] = dateString.split(" - ");
		if(date){
			let dateParts = date.split("-");
			retDate.setFullYear(dateParts[0]);
			retDate.setMonth(dateParts[1] - 1);
			retDate.setDate(dateParts[2]);
		}

		if(time){
			let timeParts = time.split(":");
			retDate.setHours(timeParts[0]);
			retDate.setMinutes(timeParts[1]);
		}

		return retDate;
	},
	dateToNoteDate(d, mask) {
		// If preferred, zeroise() can be moved out of the format() method for performance and reuse purposes
		var zeroize = function (value, length) {
			if (!length) length = 2;
			value = String(value);
			for (var i = 0, zeros = ''; i < (length - value.length); i++) {
				zeros += '0';
			}
			return zeros + value;
		};

		return mask.replace(/"[^"]*"|'[^']*'|\b(?:d{1,4}|m{1,4}|yy(?:yy)?|([hHMs])\1?|TT|tt|[lL])\b/g, function($0) {
			switch($0) {
				case 'd':	return d.getDate();
				case 'dd':	return zeroize(d.getDate());
				case 'ddd':	return ['Sun','Mon','Tue','Wed','Thr','Fri','Sat'][d.getDay()];
				case 'dddd':	return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
				case 'm':	return d.getMonth() + 1;
				case 'mm':	return zeroize(d.getMonth() + 1);
				case 'mmm':	return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
				case 'mmmm':	return ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()];
				case 'yy':	return String(d.getFullYear()).substr(2);
				case 'yyyy':	return d.getFullYear();
				case 'h':	return d.getHours() % 12 || 12;
				case 'hh':	return zeroize(d.getHours() % 12 || 12);
				case 'H':	return d.getHours();
				case 'HH':	return zeroize(d.getHours());
				case 'M':	return d.getMinutes();
				case 'MM':	return zeroize(d.getMinutes());
				case 's':	return d.getSeconds();
				case 'ss':	return zeroize(d.getSeconds());
				case 'l':	return zeroize(d.getMilliseconds(), 3);
				case 'L':	var m = d.getMilliseconds();
						if (m > 99) m = Math.round(m / 10);
						return zeroize(m);
				case 'tt':	return d.getHours() < 12 ? 'am' : 'pm';
				case 'TT':	return d.getHours() < 12 ? 'AM' : 'PM';
				// Return quoted strings with the surrounding quotes removed
				default:	return $0.substr(1, $0.length - 2);
			}
		});
	},
	encodeFileName(str){
		return escape(str);
	},
	decodeFileName(str){
		return unescape(str);
	}
};
