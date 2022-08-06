import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription(getLocale(defaultLocale, 'CMD_CLEAR_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD_CLEAR_EMPTY', {}, 'error');
			return;
		}
		player.queue.clear();
		await interaction.replyHandler.locale('CMD_CLEAR_SUCCESS', {}, 'success');
	},
};
