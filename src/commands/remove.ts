import ReplyHandler from '#src/lib/ReplyHandler.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import { Song } from '@lavaclient/queue';
import { ChatInputCommandInteraction, Client, escapeMarkdown, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.REMOVE.DESCRIPTION'))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('position')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.REMOVE.OPTION.POSITION'))
				.setMinValue(1)
				.setRequired(true)
				.setAutocomplete(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const position = interaction.options.getInteger('position');
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD.REMOVE.RESPONSE.QUEUE_EMPTY', { type: 'error' });
			return;
		}
		if (position > player.queue.tracks.length) {
			await interaction.replyHandler.locale('CHECK.INVALID_INDEX', { type: 'error' });
			return;
		}
		if (player.queue.tracks[position - 1].requester !== interaction.user.id) {
			await interaction.replyHandler.locale('CHECK.NOT_REQUESTER', { type: 'error' });
			return;
		}
		const track = player.queue.remove(position - 1);
		if (settings.features.web.enabled) {
			io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map((t: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		await interaction.replyHandler.locale('CMD.REMOVE.RESPONSE.SUCCESS', { vars: [escapeMarkdown(track.title), track.uri], type: 'success' });
	},
};
