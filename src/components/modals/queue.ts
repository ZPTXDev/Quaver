import { ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, Client, ModalSubmitInteraction, ActionRowBuilder, MessageActionRowComponentBuilder } from 'discord.js';
import { paginate, msToTime, msToTimeString, getGuildLocaleString, TimeObject } from '#src/lib/util/util.js';
import { Node } from 'lavaclient';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Song } from '@lavaclient/queue';

export default {
	name: 'queue',
	async execute(interaction: ModalSubmitInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId), page = parseInt(interaction.fields.getTextInputValue('queue_goto_input'));
		let pages;
		if (isNaN(page)) {
			await interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE', { type: 'error' });
			return;
		}
		if (player) pages = paginate(player.queue.tracks, 5);
		if (!player || pages) {
			await interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY', { type: 'error', components: [], force: 'update' });
			return;
		}
		if (page < 1 || page > pages.length) {
			await interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE', { type: 'error' });
			return;
		}
		const firstIndex = 5 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) {
			await interaction.message.delete();
			return;
		}
		const updated: { embeds: EmbedBuilder[], components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } = { embeds: [], components: [] };
		updated.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track: Song, index: number): string => {
				const duration = <TimeObject> msToTime(track.length);
				const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${escapeMarkdown(track.title)}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
			}).join('\n'))
			.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', page.toString(), pages.length.toString()) });
		updated.components[0] = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId(`queue_${page - 1}`)
					.setEmoji('⬅️')
					.setDisabled(page - 1 < 1)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('queue_goto')
					.setStyle(ButtonStyle.Secondary)
					.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.GO_TO')),
				new ButtonBuilder()
					.setCustomId(`queue_${page + 1}`)
					.setEmoji('➡️')
					.setDisabled(page + 1 > pages.length)
					.setStyle(ButtonStyle.Primary),
			);
		await interaction.replyHandler.reply(updated.embeds, { components: updated.components, force: 'update' });
		return;
	},
};
