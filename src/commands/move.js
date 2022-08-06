const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');

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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const oldPosition = interaction.options.getInteger('old_position');
		const newPosition = interaction.options.getInteger('new_position');
		if (player.queue.tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD_MOVE_INSUFFICIENT', {}, 'error');
			return;
		}
		if (oldPosition > player.queue.tracks.length || newPosition > player.queue.tracks.length) {
			await interaction.replyHandler.locale('CMD_MOVE_NOT_IN_RANGE', {}, 'error');
			return;
		}
		if (oldPosition === newPosition) {
			await interaction.replyHandler.locale('CMD_MOVE_EQUAL', {}, 'error');
			return;
		}
		player.queue.tracks.splice(newPosition - 1, 0, player.queue.tracks.splice(oldPosition - 1, 1)[0]);
		const track = player.queue.tracks[newPosition - 1];
		await interaction.replyHandler.locale('CMD_MOVE_SUCCESS', {}, 'success', track.title, track.uri, oldPosition, newPosition);
	},
};
