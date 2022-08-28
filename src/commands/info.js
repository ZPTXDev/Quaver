import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import { version } from '#lib/util/version.js';
import { defaultLocale } from '#settings';
import { getGuildLocale, getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocale(defaultLocale, 'CMD.INFO.DESCRIPTION')),
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
				.setDescription(await getGuildLocale(interaction.guildId, 'CMD.INFO.RESPONSE.SUCCESS', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version))
				.setThumbnail(interaction.client.user.displayAvatarURL({ format: 'png' })),
			{ ephemeral: true },
		);
	},
};
