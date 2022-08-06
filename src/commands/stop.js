const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription(getLocale(defaultLocale, 'CMD_STOP_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC_QUEUE_NOT_PLAYING', {}, 'error');
			return;
		}
		player.queue.clear();
		await player.queue.skip();
		await player.queue.start();
		await interaction.replyHandler.locale('CMD_STOP_SUCCESS', {}, 'success');
	},
};
