import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription(getLocale(defaultLocale, 'CMD.SKIP.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) return interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', {}, 'error');
		if (player.queue.current.requester === interaction.user.id) {
			const track = await player.queue.skip();
			await player.queue.start();
			return interaction.replyHandler.locale('CMD.SKIP.RESPONSE.SUCCESS.DEFAULT', {}, 'success', track.title, track.uri);
		}
		const skip = player.skip ?? { required: Math.ceil(interaction.member.voice.channel.members.filter(m => !m.user.bot).size / 2), users: [] };
		if (skip.users.includes(interaction.user.id)) return interaction.replyHandler.locale('CMD.SKIP.RESPONSE.VOTED.STATE_UNCHANGED', {}, 'error');
		skip.users.push(interaction.user.id);
		if (skip.users.length >= skip.required) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.replyHandler.reply(`${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.SKIP.RESPONSE.SUCCESS.VOTED', track.title, track.uri)}\n${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.ADDED_BY', track.requester)}`);
			return player.queue.next();
		}
		player.skip = skip;
		return interaction.replyHandler.locale('CMD.SKIP.RESPONSE.VOTED.SUCCESS', {}, 'success', player.queue.current.title, player.queue.current.uri, skip.users.length, skip.required);
	},
};
