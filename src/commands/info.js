import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { version } from '#package';
import { defaultLocale } from '#settings';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocale(defaultLocale, 'CMD_INFO_DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		await interaction.replyHandler.locale('CMD_INFO_DETAIL', { title: 'Quaver', thumbnail: interaction.client.user.avatarURL({ format: 'png' }) }, 'neutral', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version);
	},
};
