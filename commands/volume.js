const { SlashCommandBuilder } = require('discord.js');
const { checks } = require('../enums.js');
const { managers, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { data } = require('../shared.js');

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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const volume = interaction.options.getInteger('new_volume');
		if (volume > 200 && !managers.includes(interaction.user.id)) {
			await interaction.replyHandler.locale('CMD_VOLUME_NOT_IN_RANGE', {}, 'error');
			return;
		}
		await player.setVolume(volume);
		await interaction.replyHandler.locale('CMD_VOLUME_SUCCESS', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_FILTERS_NOTE') }, 'neutral', volume);
	},
};
