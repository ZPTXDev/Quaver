import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import { version } from '#lib/util/version.js';
import { defaultLocaleCode } from '#settings';
import { getGuildLocaleString, getLocaleString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.INFO.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		return interaction.replyHandler.reply(
			new EmbedBuilder()
				.setTitle('Quaver')
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.INFO.RESPONSE.SUCCESS', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version))
				.setThumbnail(interaction.client.user.displayAvatarURL({ format: 'png' })),
			{ ephemeral: true },
		);
	},
};
