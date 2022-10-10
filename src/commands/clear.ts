import { confirmationTimeout, logger } from '#src/lib/util/common.js';
import type { QuaverInteraction } from '#src/lib/util/common.types.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.CLEAR.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY', { type: 'error' });
			return;
		}
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.CLEAR.RESPONSE.CONFIRMATION'))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.ACTION_IRREVERSIBLE') }),
			{
				type: 'warning',
				components: [
					new ActionRowBuilder<ButtonBuilder>()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('clear')
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
		if (!(msg instanceof Message)) return;
		confirmationTimeout[msg.id] = setTimeout(async (message): Promise<void> => {
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
			delete confirmationTimeout[message.id];
		}, 5 * 1000, msg);
	},
};
