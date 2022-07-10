const _ = require('lodash');
const { logger, data } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { bot } = require('../../main.js');
const { defaultLocale } = require('../../settings.json');
const PlayerHandler = require('../../classes/PlayerHandler.js');

module.exports = {
	name: 'connect',
	once: false,
	async execute() {
		logger.info({ message: 'Connected.', label: 'Lavalink' });
		for await (const [guildId, guildData] of data.guild.iterator()) {
			if (_.get(guildData, 'settings.stay.enabled')) {
				const guild = bot.guilds.cache.get(guildId);
				const player = bot.music.createPlayer(guildId);
				player.handler = new PlayerHandler(bot, player);
				player.queue.channel = guild.channels.cache.get(_.get(guildData, 'settings.stay.text'));
				const voice = guild.channels.cache.get(_.get(guildData, 'settings.stay.channel'));
				if (voice.type === 'GUILD_STAGE_VOICE' && !voice.stageInstance?.topic) {
					try {
						await voice.createStageInstance({ topic: getLocale(_.get(guildData, 'settings.locale') ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
				}
				await player.connect(_.get(guildData, 'settings.stay.channel'), { deafened: true });
			}
		}
	},
};
