import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString, msToTime, msToTimeString, paginate } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, SlashCommandBuilder } from 'discord.js';
import type { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.QUEUE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY', { type: 'error' });
			return;
		}
		const pages = paginate(player.queue.tracks, 5);
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(
					pages[0].map((track, index): string => {
						const duration = msToTime(track.length);
						const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${index + 1}.\` **[${escapeMarkdown(track.title)}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
					}).join('\n'),
				)
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', '1', pages.length.toString()) }),
			{
				components: [
					new ActionRowBuilder<ButtonBuilder>()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('queue_0')
								.setEmoji('⬅️')
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('queue_goto')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.GO_TO')),
							new ButtonBuilder()
								.setCustomId('queue_2')
								.setEmoji('➡️')
								.setDisabled(pages.length === 1)
								.setStyle(ButtonStyle.Primary),
						),
				],
				ephemeral: true,
			},
		);
	},
};
