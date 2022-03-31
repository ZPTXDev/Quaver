const { logger, guildData } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { bot } = require('../../main.js');
const { defaultLocale } = require('../../settings.json');

module.exports = {
	name: 'connect',
	once: false,
	execute() {
		logger.info({ message: 'Connected.', label: 'Lavalink' });
		Object.keys(guildData.data).forEach(async guildId => {
			if (guildData.get(`${guildId}.always.enabled`)) {
				const guild = bot.guilds.cache.get(guildId);
				const player = bot.music.createPlayer(guildId);
				player.queue.channel = guild.channels.cache.get(guildData.get(`${guildId}.always.text`));
				const voice = guild.channels.cache.get(guildData.get(`${guildId}.always.channel`));
				if (voice.type === 'GUILD_STAGE_VOICE' && !voice.stageInstance?.topic) {
					try {
						await voice.createStageInstance({ topic: getLocale(guildData.get(`${guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
				}
				await player.connect(guildData.get(`${guildId}.always.channel`), { deafened: true });
			}
		});
	},
};
