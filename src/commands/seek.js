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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', {}, 'error');
			return;
		}
		if (player.queue.current.isStream) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.STREAM_CANNOT_SEEK', {}, 'error');
			return;
		}
		const hours = interaction.options.getInteger('hours') ?? 0, minutes = interaction.options.getInteger('minutes') ?? 0, seconds = interaction.options.getInteger('seconds') ?? 0;
		const ms = hours * 3600000 + minutes * 60000 + seconds * 1000;
		if (interaction.options.getInteger('hours') === null && interaction.options.getInteger('minutes') === null && interaction.options.getInteger('seconds') === null) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_MISSING', {}, 'error');
			return;
		}
		const trackLength = player.queue.current.length;
		const duration = msToTime(trackLength);
		const durationString = await msToTimeString(duration, true);
		if (ms > trackLength) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_INVALID', {}, 'error', durationString);
			return;
		}
		const seek = msToTime(ms);
		const seekString = await msToTimeString(seek, true);
		await player.seek(ms);
		await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.SUCCESS', {}, 'neutral', seekString, durationString);
	},
};
