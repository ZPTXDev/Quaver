import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { getGuildLocale, messageDataBuilder } from '#lib/util/util.js';
import { logger, searchState } from '#lib/util/common.js';

export default {
	name: 'search',
	/** @param {import('discord.js').SelectMenuInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		const state = searchState[interaction.message.id];
		if (!state) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
		clearTimeout(state.timeout);
		state.timeout = setTimeout(async message => {
			try {
				await message.edit(
					messageDataBuilder(
						new EmbedBuilder()
							.setDescription(await getGuildLocale(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
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
		if (original.embeds.length === 0) return interaction.message.delete();
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components[0] = SelectMenuBuilder.from(original.components[0].components[0]);
		original.components[0].components[0].setOptions(
			original.components[0].components[0].options
				.map(data => {
					data = data.data;
					return { label: data.label, description: data.description, value: data.value, default: !!state.selected.find(identifier => identifier === data.value) };
				})
				.concat(
					state.selected
						.map(identifier => {
							const refPg = pages.indexOf(pages.find(pg => pg.find(t => t.info.identifier === identifier)));
							const firstIdx = 10 * refPg + 1;
							const refTrack = pages[refPg].find(t => t.info.identifier === identifier);
							let label = `${firstIdx + pages[refPg].indexOf(refTrack)}. ${refTrack.info.title}`;
							if (label.length >= 100) label = `${label.substring(0, 97)}...`;
							return { label: label, description: refTrack.info.author, value: identifier, default: true };
						})
						.filter(options => !original.components[0].components[0].options.find(opt => opt.data.value === options.value)),
				)
				.sort((a, b) => parseInt(a.label.split('.')[0]) - parseInt(b.label.split('.')[0])),
		);
		original.components[1].components[2] = ButtonBuilder.from(original.components[1].components[2])
			.setDisabled(state.selected.length === 0);
		return interaction.replyHandler.reply(original.embeds, { components: original.components, force: 'update' });
	},
};
