import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocaleString, getLocaleString, messageDataBuilder } from '#lib/util/util.js';
import { confirmationTimeout, data, logger } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocaleString(defaultLocale, 'CMD.DISCONNECT.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) return interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED', { type: 'error' });
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await player.handler.disconnect();
			return interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.SUCCESS', { type: 'success' });
		}
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.DISCONNECT.RESPONSE.CONFIRMATION'))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.ACTION_IRREVERSIBLE') }),
			{
				type: 'warning',
				components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('disconnect')
								.setStyle(ButtonStyle.Danger)
								.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.CONFIRM')),
							new ButtonBuilder()
								.setCustomId('cancel')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.CANCEL')),
						),
				],
				fetchReply: true,
			},
		);
		confirmationTimeout[msg.id] = setTimeout(async message => {
			try {
				await message.edit(
					messageDataBuilder(
						new EmbedBuilder()
							.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
						{ components: [] },
					),
				);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			}
			delete confirmationTimeout[message.id];
		}, 5 * 1000, msg);
	},
};
