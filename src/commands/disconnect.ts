import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { defaultLocaleCode } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString, buildMessageOptions } from '#src/lib/util/util.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node, Player } from 'lavaclient';
import PlayerHandler from '#src/lib/PlayerHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.DISCONNECT.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) {
			await interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED', { type: 'error' });
			return;
		}
		const player = <Player<Node> & { handler: PlayerHandler }> interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await player.handler.disconnect();
			await interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.SUCCESS', { type: 'success' });
			return;
		}
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.DISCONNECT.RESPONSE.CONFIRMATION'))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.ACTION_IRREVERSIBLE') }),
			{
				type: 'warning',
				components: [
					new ActionRowBuilder<ButtonBuilder>()
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
