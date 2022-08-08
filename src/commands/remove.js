import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription(getLocale(defaultLocale, 'CMD.REMOVE.DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('position')
				.setDescription(getLocale(defaultLocale, 'CMD.REMOVE.OPTION.POSITION'))
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
		const position = interaction.options.getInteger('position');
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD.REMOVE.RESPONSE.QUEUE_EMPTY', {}, 'error');
			return;
		}
		if (position > player.queue.tracks.length) {
			await interaction.replyHandler.locale('CHECK.INVALID_INDEX', {}, 'error');
			return;
		}
		if (player.queue.tracks[position - 1].requester !== interaction.user.id) {
			await interaction.replyHandler.locale('CHECK.NOT_REQUESTER', {}, 'error');
			return;
		}
		const track = player.queue.remove(position - 1);
		await interaction.replyHandler.locale('CMD.REMOVE.RESPONSE.SUCCESS', {}, 'success', track.title, track.uri);
	},
};
