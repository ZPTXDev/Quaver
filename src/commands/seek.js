import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale, msToTime, msToTimeString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('seek')
		.setDescription(getLocale(defaultLocale, 'CMD.SEEK.DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('hours')
				.setDescription(getLocale(defaultLocale, 'CMD.SEEK.OPTION.HOURS'))
				.setMinValue(0)
				.setMaxValue(23))
		.addIntegerOption(option =>
			option
				.setName('minutes')
				.setDescription(getLocale(defaultLocale, 'CMD.SEEK.OPTION.MINUTES'))
				.setMinValue(0)
				.setMaxValue(59))
		.addIntegerOption(option =>
			option
				.setName('seconds')
				.setDescription(getLocale(defaultLocale, 'CMD.SEEK.OPTION.SECONDS'))
				.setMinValue(0)
				.setMaxValue(59)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) return interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error' });
		if (player.queue.current.isStream) return interaction.replyHandler.locale('CMD.SEEK.RESPONSE.STREAM_CANNOT_SEEK', { type: 'error' });
		const hours = interaction.options.getInteger('hours') ?? 0, minutes = interaction.options.getInteger('minutes') ?? 0, seconds = interaction.options.getInteger('seconds') ?? 0;
		const ms = hours * 3600000 + minutes * 60000 + seconds * 1000;
		if (interaction.options.getInteger('hours') === null && interaction.options.getInteger('minutes') === null && interaction.options.getInteger('seconds') === null) return interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_MISSING', { type: 'error' });
		const trackLength = player.queue.current.length;
		const duration = msToTime(trackLength);
		const durationString = msToTimeString(duration, true);
		if (ms > trackLength) return interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_INVALID', { args: [durationString], type: 'error' });
		const seek = msToTime(ms);
		const seekString = msToTimeString(seek, true);
		await player.seek(ms);
		return interaction.replyHandler.locale('CMD.SEEK.RESPONSE.SUCCESS', { args: [seekString, durationString] });
	},
};
