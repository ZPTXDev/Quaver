const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription(getLocale(defaultLocale, 'CMD_SHUFFLE_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD_SHUFFLE_INSUFFICIENT', {}, 'error');
			return;
		}
		let currentIndex = player.queue.tracks.length, randomIndex;
		while (currentIndex !== 0) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
			[player.queue.tracks[currentIndex], player.queue.tracks[randomIndex]] = [player.queue.tracks[randomIndex], player.queue.tracks[currentIndex]];
		}
		await interaction.replyHandler.locale('CMD_SHUFFLE_SUCCESS', {}, 'success');
	},
};
