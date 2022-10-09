import { ChatInputCommandInteraction, Client, escapeMarkdown, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { settings } from '#src/lib/util/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';
import { Song } from '@lavaclient/queue';

export default {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.MOVE.DESCRIPTION'))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('old_position')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.MOVE.OPTION.OLD_POSITION'))
				.setMinValue(1)
				.setRequired(true)
				.setAutocomplete(true))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('new_position')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.MOVE.OPTION.NEW_POSITION'))
				.setMinValue(1)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const oldPosition = interaction.options.getInteger('old_position');
		const newPosition = interaction.options.getInteger('new_position');
		if (player.queue.tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD.MOVE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS', { type: 'error' });
			return;
		}
		if (oldPosition > player.queue.tracks.length || newPosition > player.queue.tracks.length) {
			await interaction.replyHandler.locale('CMD.MOVE.RESPONSE.OUT_OF_RANGE', { type: 'error' });
			return;
		}
		if (oldPosition === newPosition) {
			await interaction.replyHandler.locale('CMD.MOVE.RESPONSE.MOVING_IN_PLACE', { type: 'error' });
			return;
		}
		player.queue.tracks.splice(newPosition - 1, 0, player.queue.tracks.splice(oldPosition - 1, 1)[0]);
		const track = player.queue.tracks[newPosition - 1];
		if (settings.features.web.enabled) {
			io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map((t: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		await interaction.replyHandler.locale('CMD.MOVE.RESPONSE.SUCCESS', { vars: [escapeMarkdown(track.title), track.uri, oldPosition.toString(), newPosition.toString()], type: 'success' });
	},
};
