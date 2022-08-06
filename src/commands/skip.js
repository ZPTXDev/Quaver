const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription(getLocale(defaultLocale, 'CMD_SKIP_DESCRIPTION')),
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
		if (player.queue.current.requester === interaction.user.id) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.replyHandler.locale('CMD_SKIP_SUCCESS', {}, 'success', track.title, track.uri);
			return;
		}
		const skip = player.skip ?? { required: Math.ceil(interaction.member.voice.channel.members.size / 2), users: [] };
		if (skip.users.includes(interaction.user.id)) {
			await interaction.replyHandler.locale('CMD_SKIP_VOTED', {}, 'error');
			return;
		}
		skip.users.push(interaction.user.id);
		if (skip.users.length >= skip.required) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.replyHandler.reply(`${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_SKIP_SUCCESS_VOTED', track.title, track.uri)}\n${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ADDED_BY', track.requester)}`);
			await player.queue.next();
			return;
		}
		player.skip = skip;
		await interaction.replyHandler.locale('CMD_SKIP_VOTED_SUCCESS', {}, 'success', player.queue.current.title, player.queue.current.uri, skip.users.length, skip.required);
	},
};
