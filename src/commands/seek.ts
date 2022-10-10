import type { QuaverInteraction } from '#src/lib/util/common.types.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString, msToTime, msToTimeString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, SlashCommandIntegerOption } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('seek')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEEK.DESCRIPTION'))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('hours')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEEK.OPTION.HOURS'))
				.setMinValue(0)
				.setMaxValue(23))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('minutes')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEEK.OPTION.MINUTES'))
				.setMinValue(0)
				.setMaxValue(59))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('seconds')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEEK.OPTION.SECONDS'))
				.setMinValue(0)
				.setMaxValue(59)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error' });
			return;
		}
		if (player.queue.current.isStream) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.STREAM_CANNOT_SEEK', { type: 'error' });
			return;
		}
		const hours = interaction.options.getInteger('hours') ?? 0, minutes = interaction.options.getInteger('minutes') ?? 0, seconds = interaction.options.getInteger('seconds') ?? 0;
		const ms = hours * 3600000 + minutes * 60000 + seconds * 1000;
		if (interaction.options.getInteger('hours') === null && interaction.options.getInteger('minutes') === null && interaction.options.getInteger('seconds') === null) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_MISSING', { type: 'error' });
			return;
		}
		const trackLength = player.queue.current.length;
		const duration = msToTime(trackLength);
		const durationString = msToTimeString(duration, true);
		if (ms > trackLength) {
			await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.TIMESTAMP_INVALID', { vars: [durationString], type: 'error' });
			return;
		}
		const seek = msToTime(ms);
		const seekString = msToTimeString(seek, true);
		await player.seek(ms);
		await interaction.replyHandler.locale('CMD.SEEK.RESPONSE.SUCCESS', { vars: [seekString, durationString] });
	},
};
