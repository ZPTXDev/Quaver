import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { version } from '#lib/util/version.js';
import { defaultLocale } from '#settings';
import { getLocale } from '#lib/util/util.js';

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
		return interaction.replyHandler.locale('CMD.INFO.RESPONSE.SUCCESS', { title: 'Quaver', thumbnail: interaction.client.user.avatarURL({ format: 'png' }) }, 'neutral', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version);
	},
};
