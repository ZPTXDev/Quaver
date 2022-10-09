import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { defaultLocaleCode } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString, buildMessageOptions } from '#src/lib/util/util.js';
import { confirmationTimeout, logger } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.STOP.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error' });
			return;
		}
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.STOP.RESPONSE.CONFIRMATION'))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.ACTION_IRREVERSIBLE') }),
			{
				type: 'warning',
				components: [
					new ActionRowBuilder<ButtonBuilder>()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('stop')
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
