const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { managers, defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription(getLocale(defaultLocale, 'CMD_VOLUME_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('new_volume')
				.setDescription(getLocale(defaultLocale, 'CMD_VOLUME_OPTION_NEWVOLUME'))
				.setMinValue(0)
				.setMaxValue(1000)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const volume = interaction.options.getInteger('new_volume');
		if (volume > 200 && !managers.includes(interaction.user.id)) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_VOLUME_NOT_IN_RANGE'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		await player.setVolume(volume);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_VOLUME_SUCCESS', volume))
					.setFooter({ text: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_FILTERS_NOTE') })
					.setColor(defaultColor),
			],
		});
	},
};
