const { SlashCommandBuilder } = require('@discordjs/builders');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription(getLocale(defaultLocale, 'CMD_REMOVE_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('position')
				.setDescription(getLocale(defaultLocale, 'CMD_REMOVE_OPTION_POSITION'))
				.setMinValue(1)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const position = interaction.options.getInteger('position');
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.localeError('CMD_REMOVE_EMPTY');
			return;
		}
		if (position > player.queue.tracks.length) {
			await interaction.replyHandler.localeError('CHECK_INVALID_INDEX');
			return;
		}
		if (player.queue.tracks[position - 1].requester !== interaction.user.id) {
			await interaction.replyHandler.localeError('CHECK_NOT_REQUESTER');
			return;
		}
		const track = player.queue.remove(position - 1);
		await interaction.replyHandler.locale('CMD_REMOVE_SUCCESS', {}, track.title, track.uri);
	},
};
