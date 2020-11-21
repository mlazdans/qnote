var EXPORTED_SYMBOLS = ["dateFormat", "dateFormatPredefined"];

// Day
// ========================================================================================================================
// (d)	Day of the month, 2 digits with leading zeros	01 to 31
// (D)	A textual representation of a day, three letters	Mon through Sun
// (j)	Day of the month without leading zeros	1 to 31
// (l)	A full textual representation of the day of the week	Sunday through Saturday
// (N)	ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0)	1 (for Monday) through 7 (for Sunday)
// S	English ordinal suffix for the day of the month, 2 characters	st, nd, rd or th. Works well with j
// (w)	Numeric representation of the day of the week	0 (for Sunday) through 6 (for Saturday)
// (z)	The day of the year (starting from 0)	0 through 365

// Week
// (W)	ISO-8601 week number of year, weeks starting on Monday	Example: 42 (the 42nd week in the year)

// Month
// ========================================================================================================================
// (F)	A full textual representation of a month, such as January or March	January through December
// (m)	Numeric representation of a month, with leading zeros	01 through 12
// (M)	A short textual representation of a month, three letters	Jan through Dec
// (n)	Numeric representation of a month, without leading zeros	1 through 12
// (t)	Number of days in the given month	28 through 31

// Year
// ========================================================================================================================
// (L)	Whether it's a leap year	1 if it is a leap year, 0 otherwise.
// o	ISO-8601 week-numbering year. This has the same value as Y, except that if the ISO week number (W) belongs to the previous or next year, that year is used instead. (added in PHP 5.1.0)	Examples: 1999 or 2003
// (Y)	A full numeric representation of a year, 4 digits	Examples: 1999 or 2003
// (y)	A two digit representation of a year	Examples: 99 or 03

// Time
// ========================================================================================================================
// a	Lowercase Ante meridiem and Post meridiem	am or pm
// A	Uppercase Ante meridiem and Post meridiem	AM or PM
// B	Swatch Internet time	000 through 999
// g	12-hour format of an hour without leading zeros	1 through 12
// (G)	24-hour format of an hour without leading zeros	0 through 23
// h	12-hour format of an hour with leading zeros	01 through 12
// (H)	24-hour format of an hour with leading zeros	00 through 23
// (i)	Minutes with leading zeros	00 to 59
// (s)	Seconds with leading zeros	00 through 59
// u	Microseconds (added in PHP 5.2.2). Note that date() will always generate 000000 since it takes an int parameter, whereas DateTime::format() does support microseconds if DateTime was created with microseconds.	Example: 654321
// (v)	Milliseconds (added in PHP 7.0.0). Same note applies as for u.	Example: 654

function ts2jsdate(ts){
	return (ts === undefined ? new Date() // Not provided
		: (ts instanceof Date) ? new Date(ts) // JS Date()
			: new Date(ts) // ts
	);
}

function dateFormat(locale, format, ts) {
	// const obj = Object.fromEntries(entries);
	if(!format){
	}

	let dt = luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(locale);

	function pad(o, l, c){
		return o.toString().padStart(l, c);
	}

	let Con = {
		d: pad(dt.day, 2, "0"),
		D: dt.weekdayShort,
		j: dt.day,
		l: dt.weekdayLong,
		N: dt.weekday,
		w: dt.weekday - 1,
		z: dt.ordinal - 1,
		W: dt.weekNumber,
		F: dt.monthLong,
		m: pad(dt.month, 2, "0"),
		M: dt.monthShort,
		n: dt.month,
		t: dt.daysInMonth,
		L: dt.isInLeapYear ? 1 : 0,
		Y: dt.year,
		y: dt.year.toString().substr(-2),
		G: dt.hour,
		H: pad(dt.hour, 2, "0"),
		i: pad(dt.minute, 2, "0"),
		s: pad(dt.second, 2, "0"),
		v: dt.millisecond,
	};

	let conStr = '';
	format.replace(/\\?(.?)/gi, (c, s) => {
		let con = c;
		if(Con[c] !== undefined){
			if(typeof Con[c] === "function"){
				con = Con[c]();
			} else {
				con = Con[c];
			}
		}
		conStr += con;
	});

	return conStr;
}

function dateFormatPredefined(locale, format, ts) {
	let dt = luxon.DateTime.fromJSDate(ts2jsdate(ts)).setLocale(locale);

	return dt.toLocaleString(luxon.DateTime[format]);
}
