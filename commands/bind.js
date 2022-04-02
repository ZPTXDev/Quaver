const { SlashCommandBuilder } = require('@discordjs/builders');
const { Constants } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocale(defaultLocale, 'CMD_BIND_DESCRIPTION'))
		.addChannelOption(option =>
			option
				.setName('new_channel')
				.setDescription(getLocale(defaultLocale, 'CMD_BIND_OPTION_CHANNEL'))
				.addChannelType(Constants.ChannelTypes.GUILD_TEXT)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const channel = interaction.options.getChannel('new_channel');
		if (!channel.permissionsFor(interaction.client.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) {
			await interaction.replyHandler.localeError('CMD_BIND_NO_PERMISSIONS', {}, channel.id);
			return;
		}
		player.queue.channel = channel;
		if (guildData.get(`${interaction.guildId}.always.enabled`)) {
			guildData.set(`${interaction.guildId}.always.text`, channel.id);
		}
		await interaction.replyHandler.localeDefault('CMD_BIND_SUCCESS', {}, channel.id);
	},
};
