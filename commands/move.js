const { SlashCommandBuilder } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription(getLocale(defaultLocale, 'CMD_MOVE_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('old_position')
				.setDescription(getLocale(defaultLocale, 'CMD_MOVE_OPTION_OLDPOSITION'))
				.setMinValue(1)
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('new_position')
				.setDescription(getLocale(defaultLocale, 'CMD_MOVE_OPTION_NEWPOSITION'))
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
		const oldPosition = interaction.options.getInteger('old_position');
		const newPosition = interaction.options.getInteger('new_position');
		if (player.queue.tracks.length <= 1) {
			await interaction.replyHandler.localeError('CMD_MOVE_INSUFFICIENT');
			return;
		}
		if (oldPosition > player.queue.tracks.length || newPosition > player.queue.tracks.length) {
			await interaction.replyHandler.localeError('CMD_MOVE_NOT_IN_RANGE');
			return;
		}
		if (oldPosition === newPosition) {
			await interaction.replyHandler.localeError('CMD_MOVE_EQUAL');
			return;
		}
		player.queue.tracks.splice(newPosition - 1, 0, player.queue.tracks.splice(oldPosition - 1, 1)[0]);
		const track = player.queue.tracks[newPosition - 1];
		await interaction.replyHandler.locale('CMD_MOVE_SUCCESS', {}, track.title, track.uri, oldPosition, newPosition);
	},
};
