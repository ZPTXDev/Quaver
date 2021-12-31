const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nightcore')
		.setDescription(getLocale(defaultLocale, 'CMD_NIGHTCORE_DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD_NIGHTCORE_OPTION_ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let nightcore;
		if (enabled !== null) {
			nightcore = enabled;
		}
		else {
			nightcore = !player.nightcore;
		}
		player.filters.timescale = nightcore ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
		await player.setFilters();
		player.nightcore = nightcore;
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(defaultLocale, player.nightcore ? 'CMD_NIGHTCORE_ENABLED' : 'CMD_NIGHTCORE_DISABLED'))
					.setFooter({ text: getLocale(defaultLocale, 'MUSIC_FILTERS_NOTE') })
					.setColor(defaultColor),
			],
		});
	},
};