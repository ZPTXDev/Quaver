const { defaultLocale } = require('./settings.json');

// thanks: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
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
function msToTimeString(msObject, simple) {
	if (simple) {
		if (msObject['d'] > 0) {
			return getLocale(defaultLocale, 'MORETHANADAY');
		}
		return `${msObject['h'] > 0 ? `${msObject['h']}:` : ''}${msObject['h'] > 0 ? msObject['m'].toString().padStart(2, '0') : msObject['m']}:${msObject['s'].toString().padStart(2, '0')}`;
	}
	return `${msObject['d'] > 0 ? `${msObject['d']} day${msObject['d'] === 1 ? '' : 's'}, ` : ''}${msObject['h'] > 0 ? `${msObject['h']} hr${msObject['h'] === 1 ? '' : 's'}, ` : ''}${msObject['m'] > 0 ? `${msObject['m']} min${msObject['m'] === 1 ? '' : 's'}, ` : ''}${msObject['s'] > 0 ? `${msObject['s']} sec${msObject['s'] === 1 ? '' : 's'}, ` : ''}`.slice(0, -2);
}
// thanks: https://stackoverflow.com/a/15762794
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
// thanks: https://stackoverflow.com/a/54897508
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
function paginate(arr, size) {
	return arr.reduce((acc, val, i) => {
		const idx = Math.floor(i / size);
		const page = acc[idx] || (acc[idx] = []);
		page.push(val);
		return acc;
	}, []);
}
// thanks: https://stackoverflow.com/a/63376860
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