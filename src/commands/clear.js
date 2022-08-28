import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocale, getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription(getLocale(defaultLocale, 'CMD.CLEAR.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) return interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY', { type: 'error' });
		return interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocale(interaction.guildId, 'CMD.CLEAR.RESPONSE.CONFIRMATION'))
				.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.ACTION_IRREVERSIBLE') }),
			{
				type: 'warning',
				components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('clear')
								.setStyle(ButtonStyle.Danger)
								.setLabel(await getGuildLocale(interaction.guildId, 'MISC.CONFIRM')),
							new ButtonBuilder()
								.setCustomId('cancel')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocale(interaction.guildId, 'MISC.CANCEL')),
						),
				],
			},
		);
	},
};
