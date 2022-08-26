import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription(getLocale(defaultLocale, 'CMD.MOVE.DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('old_position')
				.setDescription(getLocale(defaultLocale, 'CMD.MOVE.OPTION.OLD_POSITION'))
				.setMinValue(1)
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('new_position')
				.setDescription(getLocale(defaultLocale, 'CMD.MOVE.OPTION.NEW_POSITION'))
				.setMinValue(1)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { bot, io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const oldPosition = interaction.options.getInteger('old_position');
		const newPosition = interaction.options.getInteger('new_position');
		if (player.queue.tracks.length <= 1) return interaction.replyHandler.locale('CMD.MOVE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS', {}, 'error');
		if (oldPosition > player.queue.tracks.length || newPosition > player.queue.tracks.length) return interaction.replyHandler.locale('CMD.MOVE.RESPONSE.OUT_OF_RANGE', {}, 'error');
		if (oldPosition === newPosition) return interaction.replyHandler.locale('CMD.MOVE.RESPONSE.MOVING_IN_PLACE', {}, 'error');
		player.queue.tracks.splice(newPosition - 1, 0, player.queue.tracks.splice(oldPosition - 1, 1)[0]);
		const track = player.queue.tracks[newPosition - 1];
		if (features.web.enabled) {
			io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map(t => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		return interaction.replyHandler.locale('CMD.MOVE.RESPONSE.SUCCESS', {}, 'success', track.title, track.uri, oldPosition, newPosition);
	},
};
