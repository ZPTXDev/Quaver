import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { logger, searchState } from '#src/lib/util/common.js';
import { buildMessageOptions, getGuildLocaleString } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/queue';
import type { APISelectMenuOption, ButtonComponent, Client, MessageActionRowComponentBuilder, SelectMenuComponent, SelectMenuComponentOptionData, SelectMenuInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SelectMenuBuilder } from 'discord.js';
import type { Node } from 'lavaclient';

export default {
	name: 'search',
	async execute(interaction: SelectMenuInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		const state = searchState[interaction.message.id];
		if (!state) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
			return;
		}
		clearTimeout(state.timeout);
		state.timeout = setTimeout(async (message): Promise<void> => {
			try {
				await message.edit(
					buildMessageOptions(
						new EmbedBuilder()
							.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
						{ components: [] },
					),
				);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			}
			delete searchState[message.id];
		}, 30 * 1000, interaction.message);
		state.selected = interaction.values;
		const pages = state.pages;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) {
			await interaction.message.delete();
			return;
		}
		const updated: { components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } = { components: [] };
		updated.components[0] = <ActionRowBuilder<SelectMenuBuilder>> ActionRowBuilder.from(original.components[0]);
		updated.components[1] = <ActionRowBuilder<ButtonBuilder>> ActionRowBuilder.from(original.components[1]);
		updated.components[0].components[0] = SelectMenuBuilder.from(<SelectMenuComponent> original.components[0].components[0])
			.setOptions(
				(<SelectMenuComponent> original.components[0].components[0]).options
					.map((data: APISelectMenuOption): SelectMenuComponentOptionData => {
						return { label: data.label, description: data.description, value: data.value, default: !!state.selected.find((identifier: string): boolean => identifier === data.value) };
					})
					.concat(
						state.selected
							.map((identifier: string): SelectMenuComponentOptionData => {
								const refPg = pages.indexOf(
									pages.find((pg: { info: Song }[]): { info: Song } =>
										pg.find((t: { info: Song }): boolean => t.info.identifier === identifier),
									),
								);
								const firstIdx = 10 * refPg + 1;
								const refTrack = pages[refPg].find((t: { info: Song }): boolean => t.info.identifier === identifier);
								let label = `${firstIdx + pages[refPg].indexOf(refTrack)}. ${refTrack.info.title}`;
								if (label.length >= 100) label = `${label.substring(0, 97)}...`;
								return { label: label, description: refTrack.info.author, value: identifier, default: true };
							})
							.filter((options): boolean => !(<SelectMenuComponent> original.components[0].components[0]).options.find((opt): boolean => opt.value === options.value)),
					)
					.sort((a, b): number => parseInt(a.label.split('.')[0]) - parseInt(b.label.split('.')[0])),
			);
		updated.components[1].components[2] = ButtonBuilder.from(<ButtonComponent> original.components[1].components[2])
			.setDisabled(state.selected.length === 0);
		await interaction.replyHandler.reply(original.embeds.map((embed): EmbedBuilder => EmbedBuilder.from(embed)), { components: updated.components, force: 'update' });
	},
};
