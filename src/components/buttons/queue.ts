import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { getGuildLocaleString, msToTime, msToTimeString, paginate } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/queue';
import type { ButtonComponent, ButtonInteraction, Client, MessageActionRowComponentBuilder } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, escapeMarkdown, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import type { Node } from 'lavaclient';

export default {
	name: 'queue',
	async execute(interaction: ButtonInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId), pages = player ? paginate(player.queue.tracks, 5) : [];
		const target = interaction.customId.split('_')[1];
		if (player && target === 'goto' && pages.length !== 0) {
			return interaction.showModal(
				new ModalBuilder()
					.setTitle(await getGuildLocaleString(interaction.guildId, 'CMD.QUEUE.MISC.MODAL_TITLE'))
					.setCustomId('queue_goto')
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.addComponents(
								new TextInputBuilder()
									.setCustomId('queue_goto_input')
									.setLabel(await getGuildLocaleString(interaction.guildId, 'CMD.QUEUE.MISC.PAGE'))
									.setStyle(TextInputStyle.Short),
							),
					),
			);
		}
		const page = parseInt(target);
		if (!player || pages.length === 0 || page < 1 || page > pages.length) {
			await interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY', { type: 'error', components: [], force: 'update' });
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
				const duration = msToTime(track.length);
				const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${escapeMarkdown(track.title)}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
			}).join('\n'))
			.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', page.toString(), pages.length.toString()) });
		updated.components[0] = <ActionRowBuilder<ButtonBuilder>> ActionRowBuilder.from(original.components[0]);
		updated.components[0].components[0] = ButtonBuilder.from(<ButtonComponent> original.components[0].components[0])
			.setCustomId(`queue_${page - 1}`)
			.setDisabled(page - 1 < 1),
		updated.components[0].components[2] = ButtonBuilder.from(<ButtonComponent> original.components[0].components[2])
			.setCustomId(`queue_${page + 1}`)
			.setDisabled(page + 1 > pages.length);
		await interaction.replyHandler.reply(updated.embeds, { components: updated.components, force: 'update' });
	},
};
