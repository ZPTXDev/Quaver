const { defaultLocale } = require('./settings.json');

/**
 * Converts milliseconds to a time object or a converted equivalent if a format is provided.
 * Reference: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
 * @param {number} milliseconds - The milliseconds to convert.
 * @param {string} [format] - The format to convert to. Accepts 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days.
 * @returns {(Object|number)} - Time object or the converted equivalent if a format is provided.
 */
function msToTime(milliseconds, format) {
	const total_seconds = parseInt(Math.floor(milliseconds / 1000));
	const total_minutes = parseInt(Math.floor(total_seconds / 60));
	const total_hours = parseInt(Math.floor(total_minutes / 60));
	const days = parseInt(Math.floor(total_hours / 24));

	const seconds = parseInt(total_seconds % 60);
	const minutes = parseInt(total_minutes % 60);
	const hours = parseInt(total_hours % 24);

	switch (format) {
		case 's':
			return total_seconds;
		case 'm':
			return total_minutes;
		case 'h':
			return total_hours;
		case 'd':
			return days;
		default:
			return { d: days, h: hours, m: minutes, s: seconds };
	}
}

/**
 * Converts time object from msToTime to a string.
 * @param {Object} msObject - The time object provided by msToTime.
 * @param {boolean} simple - Whether to return a simple string or a more detailed one.
 * @returns {string} - The converted string.
 */
function msToTimeString(msObject, simple) {
	if (simple) {
		if (msObject['d'] > 0) {
			return getLocale(defaultLocale, 'MORETHANADAY');
		}
		return `${msObject['h'] > 0 ? `${msObject['h']}:` : ''}${msObject['h'] > 0 ? msObject['m'].toString().padStart(2, '0') : msObject['m']}:${msObject['s'].toString().padStart(2, '0')}`;
	}
	return `${msObject['d'] > 0 ? `${msObject['d']} day${msObject['d'] === 1 ? '' : 's'}, ` : ''}${msObject['h'] > 0 ? `${msObject['h']} hr${msObject['h'] === 1 ? '' : 's'}, ` : ''}${msObject['m'] > 0 ? `${msObject['m']} min${msObject['m'] === 1 ? '' : 's'}, ` : ''}${msObject['s'] > 0 ? `${msObject['s']} sec${msObject['s'] === 1 ? '' : 's'}, ` : ''}`.slice(0, -2);
}

/**
 * Round a number to the number of decimal places provided.
 * Reference: https://stackoverflow.com/a/15762794
 * @param {number} n - The number to round.
 * @param {number} digits - The number of decimal places to round to.
 * @returns {number} - The rounded number.
 */
function roundTo(n, digits) {
	let negative = false;
	if (digits === undefined) {digits = 0;}
	if (n < 0) {
		negative = true;
		n = n * -1;
	}
	const multiplicator = Math.pow(10, digits);
	n = parseFloat((n * multiplicator).toFixed(11));
	n = (Math.round(n) / multiplicator).toFixed(digits);
	if (negative) {n = (n * -1).toFixed(digits);}
	if (digits === 0) {n = parseInt(n, 10);}
	return n;
}

/**
 * Get seconds from a human-readable string.
 * Reference: https://stackoverflow.com/a/54897508
 * @param {string} str - The human-readable string.
 * @returns {number} - Seconds extracted from the string.
 */
function getSeconds(str) {
	let seconds = 0;
	const days = str.match(/(\d+)\s*d/);
	const hours = str.match(/(\d+)\s*h/);
	const minutes = str.match(/(\d+)\s*m/);
	const secs = str.match(/(\d+)\s*s/);
	if (days) { seconds += parseInt(days[1]) * 86400; }
	if (hours) { seconds += parseInt(hours[1]) * 3600; }
	if (minutes) { seconds += parseInt(minutes[1]) * 60; }
	if (secs) { seconds += parseInt(secs[1]); }
	return seconds;
}

/**
 * Get a progress bar based on the percentage provided.
 * @param {number} progress - The percentage of the bar to be filled.
 * @returns {string} - The progress bar.
 */
function getBar(progress) {
	if (isNaN(progress) || progress < 10) {return '🔘▬▬▬▬▬▬▬▬▬';}
	else if (progress < 20) {return '▬🔘▬▬▬▬▬▬▬▬';}
	else if (progress < 30) {return '▬▬🔘▬▬▬▬▬▬▬';}
	else if (progress < 40) {return '▬▬▬🔘▬▬▬▬▬▬';}
	else if (progress < 50) {return '▬▬▬▬🔘▬▬▬▬▬';}
	else if (progress < 60) {return '▬▬▬▬▬🔘▬▬▬▬';}
	else if (progress < 70) {return '▬▬▬▬▬▬🔘▬▬▬';}
	else if (progress < 80) {return '▬▬▬▬▬▬▬🔘▬▬';}
	else if (progress < 90) {return '▬▬▬▬▬▬▬▬🔘▬';}
	else {return '▬▬▬▬▬▬▬▬▬🔘';}
}

/**
 * Paginate an array.
 * @param {Array} arr - The array to paginate.
 * @param {number} size - The size of each page.
 * @returns {Array} - The paginated array.
 */
function paginate(arr, size) {
	return arr.reduce((acc, val, i) => {
		const idx = Math.floor(i / size);
		const page = acc[idx] || (acc[idx] = []);
		page.push(val);
		return acc;
	}, []);
}

/**
 * Get the localized string.
 * Reference: https://stackoverflow.com/a/63376860
 * @param {string} language - The language to use.
 * @param {string} string - The string to get.
 * @param {...string} vars - The extra variables required in some localized strings.
 * @returns {string} - The localized string.
 */
function getLocale(language, string, ...vars) {
	let strings = require(`./locales/${language}.json`);
	if (!strings) return 'LOCALE_MISSING';
	let locale = strings[string];
	if (!locale) {
		// this uses en-US by default on purpose.
		// en-US is the only locale I can confirm is 100% complete.
		strings = require('./locales/en-US.json');
		locale = strings[string];
	}
	vars.forEach((v, i) => {
		locale = locale.replace(`%${i + 1}`, v);
	});
	return locale;
}

/**
 * Checks locale completion for a given locale.
 * @param {string} language - The locale code to check.
 * @returns {Object} - Completion percentage and missing strings.
 */
function checkLocaleCompletion(language) {
	const foreignStrings = require(`./locales/${language}.json`);
	const strings = require('./locales/en-US.json');
	const foreignStringsKeys = Object.keys(foreignStrings);
	const stringsKeys = Object.keys(strings);
	// missing strings
	if (stringsKeys.length > foreignStringsKeys.length) {
		return { completion: foreignStringsKeys.length / stringsKeys.length * 100, missing: stringsKeys.filter(x => !foreignStringsKeys.includes(x)) };
	}
	return { completion: 100, missing: [] };
}

module.exports = { msToTime, msToTimeString, roundTo, getSeconds, getBar, paginate, getLocale, checkLocaleCompletion };