import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, OAuth2Scopes, PermissionsBitField, SlashCommandBuilder } from 'discord.js';

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
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.RESPONSE.SUCCESS', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] }), version))
				.setThumbnail(interaction.client.user.displayAvatarURL({ extension: 'png' })),
			{ ephemeral: true },
		);
	},
};
