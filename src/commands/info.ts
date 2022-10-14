import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, OAuth2Scopes, PermissionsBitField, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.INFO.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setTitle('Quaver')
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.RESPONSE.SUCCESS', version))
				.setThumbnail(interaction.client.user.displayAvatarURL({ extension: 'png' })),
			{
				components: [
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents(
							new ButtonBuilder()
								.setLabel(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.MISC.SOURCE_CODE'))
								.setStyle(ButtonStyle.Link)
								.setURL('https://go.zptx.dev/Quaver'),
							new ButtonBuilder()
								.setLabel(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.MISC.INVITE'))
								.setStyle(ButtonStyle.Link)
								.setURL(interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] })),
							...!settings.disableAd ? [
								new ButtonBuilder()
									.setLabel(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.MISC.SPONSOR_US'))
									.setStyle(ButtonStyle.Link)
									.setURL('https://github.com/sponsors/ZPTXDev'),
							] : [],
						),
				],
				ephemeral: true,
			},
		);
	},
};
