import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChatInputCommandInteraction, OAuth2Scopes } from 'discord.js';
import { version } from '#src/lib/util/version.js';
import { defaultLocale } from '#src/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocaleString(defaultLocale, 'CMD.INFO.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler }): Promise<void> {
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setTitle('Quaver')
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.RESPONSE.SUCCESS', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] }), version))
				.setThumbnail(interaction.client.user.displayAvatarURL({ extension: 'png' })),
			{ ephemeral: true },
		);
	},
};
