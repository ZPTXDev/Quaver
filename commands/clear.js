const { SlashCommandBuilder } = require('@discordjs/builders');
const { Embed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription(getLocale(defaultLocale, 'CMD_CLEAR_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.reply({
				embeds: [
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_CLEAR_EMPTY'))
						.setColor('DarkRed'),
				],
				ephemeral: true,
			});
			return;
		}
		player.queue.clear();
		await interaction.reply({
			embeds: [
				new Embed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_CLEAR_SUCCESS'))
					.setColor(defaultColor),
			],
		});
	},
};