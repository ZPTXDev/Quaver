import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, escapeMarkdown, SelectMenuBuilder } from 'discord.js';
import { getGuildLocale, messageDataBuilder, msToTime, msToTimeString } from '#lib/util/util.js';
import { searchState } from '#lib/util/common.js';

export default {
	name: 'search',
	/** @param {import('discord.js').ButtonInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		const state = searchState[interaction.message.id];
		if (!state) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
		const page = parseInt(interaction.customId.split('_')[1]);
		clearTimeout(state.timeout);
		state.timeout = setTimeout(async message => {
			await message.edit(
				messageDataBuilder(
					new EmbedBuilder()
						.setDescription(await getGuildLocale(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
					{ components: [] },
				),
			);
			delete searchState[message.id];
		}, 30 * 1000, interaction.message);
		const pages = state.pages;
		const firstIndex = 10 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) return interaction.message.delete();
		original.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track, index) => {
				const duration = msToTime(track.info.length);
				const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${escapeMarkdown(track.info.title)}](${track.info.uri})** \`[${durationString}]\``;
			}).join('\n'))
			.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', page, pages.length) });
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components[0] = SelectMenuBuilder.from(original.components[0].components[0])
			.setOptions(pages[page - 1].map((track, index) => {
				let label = `${firstIndex + index}. ${track.info.title}`;
				if (label.length >= 100) {
					label = `${label.substring(0, 97)}...`;
				}
				return { label: label, description: track.info.author, value: track.info.identifier };
			}))
			.setMaxValues(Math.min(pages[page - 1].length, 10)),
		original.components[1] = ActionRowBuilder.from(original.components[1]);
		original.components[1].components[0] = ButtonBuilder.from(original.components[1].components[0])
			.setCustomId(`search_${page - 1}`)
			.setDisabled(page - 1 < 1);
		original.components[1].components[1] = ButtonBuilder.from(original.components[1].components[1])
			.setCustomId(`search_${page + 1}`)
			.setDisabled(page + 1 > pages.length);
		return interaction.replyHandler.reply(original.embeds, { components: original.components, force: 'update' });
	},
};
