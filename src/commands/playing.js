const { SlashCommandBuilder } = require('discord.js');
const { LoopType } = require('@lavaclient/queue');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getBar, getLocale, msToTime, msToTimeString } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('playing')
		.setDescription(getLocale(defaultLocale, 'CMD_PLAYING_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		// workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC_QUEUE_NOT_PLAYING', {}, 'error');
			return;
		}
		const bar = getBar((player.position / player.queue.current.length) * 100);
		let elapsed = msToTime(player.position);
		if (isNaN(elapsed['s']) || elapsed['s'] < 0) {
			elapsed = { d: 0, h: 0, m: 0, s: 0 };
		}
		const elapsedString = msToTimeString(elapsed, true);
		const duration = msToTime(player.queue.current.length);
		const durationString = msToTimeString(duration, true);
		if (player.queue.current.isStream) {
			await interaction.replyHandler.reply(`**[${player.queue.current.title}](${player.queue.current.uri})**\n🔴 **${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_LIVE')}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}\n\`[${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_STREAMING')}]\` | ${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ADDED_BY', player.queue.current.requester)}`);
			return;
		}
		await interaction.replyHandler.reply(`**[${player.queue.current.title}](${player.queue.current.uri})**\n${bar}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}${player.nightcore ? ' 🇳' : ''}\n\`[${elapsedString} / ${durationString}]\` | ${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ADDED_BY', player.queue.current.requester)}`);
	},
};
