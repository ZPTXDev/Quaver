const { SlashCommandBuilder } = require('@discordjs/builders');
const { Embed } = require('discord.js');
const { ChannelType } = require('discord-api-types/v10');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription(getLocale(defaultLocale, 'CMD_BIND_DESCRIPTION'))
		.addChannelOption(option =>
			option
				.setName('new_channel')
				.setDescription(getLocale(defaultLocale, 'CMD_BIND_OPTION_CHANNEL'))
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const channel = interaction.options.getChannel('new_channel');
		player.queue.channel = channel;
		if (guildData.get(`${interaction.guildId}.always.enabled`)) {
			guildData.set(`${interaction.guildId}.always.text`, channel.id);
		}
		await interaction.reply({
			embeds: [
				new Embed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_BIND_SUCCESS', channel.id))
					.setColor(defaultColor),
			],
		});
	},
};