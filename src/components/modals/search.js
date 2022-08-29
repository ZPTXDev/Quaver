import { ButtonBuilder, ButtonStyle, EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { msToTime, msToTimeString, getGuildLocale } from '#lib/util/util.js';
import { searchPage } from '#lib/util/common.js';

export default {
	name: 'search',
	/** @param {import('discord.js').ModalSubmitInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const page = parseInt(interaction.fields.getTextInputValue('search_goto_input'));
		const pages = searchPage[interaction.message.id];
		if (!pages) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { ephemeral: true });
		if (pages.timeout) {
			clearTimeout(pages.timeout);
			pages.timeout = setTimeout(async message => {
				message.components.map(actionRow => {
					for (const component of actionRow.components) {
						if ([1, 2, 3].includes(component.data.type)) {
							component.data.disabled = true;
						}
					}
				});
				clearTimeout(pages.timeout);
				delete searchPage[interaction.message.id];
				await interaction.replyHandler.reply(message.embeds, { components: message.components });
			}, 120000, interaction.message);
		}
		if (isNaN(page)) return interaction.replyHandler.locale('CMD.SEARCH.RESPONSE.OUT_OF_RANGE', { type: 'error' });
		if (page < 1 || page > pages.length) return interaction.replyHandler.locale('CMD.SEARCH.RESPONSE.OUT_OF_RANGE', { type: 'error' });
		const firstIndex = 10 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) return interaction.message.delete();
		original.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track, index) => {
				const duration = msToTime(track.info.length);
				const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${track.info.title}](${track.info.uri})** \`[${durationString}]\``;
			}).join('\n'))
			.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', page, pages.length) });
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components = [];
		original.components[0].components[0] = new SelectMenuBuilder()
			.setCustomId(`play_${interaction.user.id}`)
			.setPlaceholder(await getGuildLocale(interaction.guildId, 'CMD.SEARCH.MISC.PICK'))
			.addOptions(pages[page - 1].map((track, index) => {
				let label = `${firstIndex + index}. ${track.info.title}`;
				if (label.length >= 100) {
					label = `${label.substring(0, 97)}...`;
				}
				return { label: label, description: track.info.author, value: track.info.identifier };
			}))
			.setMinValues(1)
			.setMaxValues(Math.min(pages[page - 1].length, 10)),
		original.components[1] = ActionRowBuilder.from(original.components[1]);
		original.components[1].components = [];
		original.components[1].components[0] = new ButtonBuilder()
			.setCustomId(`search_${page - 1}`)
			.setEmoji('⬅️')
			.setDisabled(page - 1 < 1)
			.setStyle(ButtonStyle.Primary);
		original.components[1].components[1] = new ButtonBuilder()
			.setCustomId('search_goto')
			.setStyle(ButtonStyle.Secondary)
			.setLabel(await getGuildLocale(interaction.guildId, 'MISC.GO_TO')),
		original.components[1].components[2] = new ButtonBuilder()
			.setCustomId(`search_${page + 1}`)
			.setEmoji('➡️')
			.setDisabled(page + 1 > pages.length)
			.setStyle(ButtonStyle.Primary);
		return interaction.replyHandler.reply(original.embeds, { components: original.components, force: 'update' });
	},
};
