const { SlashCommandBuilder } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale, msToTime, msToTimeString } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('seek')
		.setDescription(getLocale(defaultLocale, 'CMD_SEEK_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('hours')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_HOURS'))
				.setMinValue(0)
				.setMaxValue(23))
		.addIntegerOption(option =>
			option
				.setName('minutes')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_MINUTES'))
				.setMinValue(0)
				.setMaxValue(59))
		.addIntegerOption(option =>
			option
				.setName('seconds')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_SECONDS'))
				.setMinValue(0)
				.setMaxValue(59)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC_QUEUE_NOT_PLAYING', {}, 'error');
			return;
		}
		if (player.queue.current.isStream) {
			await interaction.replyHandler.locale('CMD_SEEK_IS_STREAM', {}, 'error');
			return;
		}
		const hours = interaction.options.getInteger('hours') ?? 0, minutes = interaction.options.getInteger('minutes') ?? 0, seconds = interaction.options.getInteger('seconds') ?? 0;
		const ms = hours * 3600000 + minutes * 60000 + seconds * 1000;
		if (interaction.options.getInteger('hours') === null && interaction.options.getInteger('minutes') === null && interaction.options.getInteger('seconds') === null) {
			await interaction.replyHandler.locale('CMD_SEEK_UNSPECIFIED_TIMESTAMP', {}, 'error');
			return;
		}
		const trackLength = player.queue.current.length;
		const duration = msToTime(trackLength);
		const durationString = msToTimeString(duration, true);
		if (ms > trackLength) {
			await interaction.replyHandler.locale('CMD_SEEK_INVALID_TIMESTAMP', {}, 'error', durationString);
			return;
		}
		const seek = msToTime(ms);
		const seekString = msToTimeString(seek, true);
		await player.seek(ms);
		await interaction.replyHandler.locale('CMD_SEEK_SUCCESS', {}, 'neutral', seekString, durationString);
	},
};
