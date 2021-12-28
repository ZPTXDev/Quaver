const { defaultLocale } = require('./settings.json');
const { getLocale } = require('./functions.js');

const checks = {
	GUILD_ONLY: getLocale(defaultLocale, 'CHECK_GUILD_ONLY'),
	ACTIVE_SESSION: getLocale(defaultLocale, 'CHECK_ACTIVE_SESSION'),
	IN_VOICE: getLocale(defaultLocale, 'CHECK_IN_VOICE'),
	IN_SESSION_VOICE: getLocale(defaultLocale, 'CHECK_IN_SESSION_VOICE'),
};

module.exports = { checks };