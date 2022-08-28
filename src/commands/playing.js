import { SlashCommandBuilder } from 'discord.js';
import { LoopType } from '@lavaclient/queue';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getBar, getGuildLocale, getLocale, msToTime, msToTimeString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('playing')
		.setDescription(getLocale(defaultLocale, 'CMD.PLAYING.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		// workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
		if (!player.queue.current || !player.playing && !player.paused) return interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error' });
		const bar = getBar((player.position / player.queue.current.length) * 100);
		let elapsed = msToTime(player.position);
		if (isNaN(elapsed['s']) || elapsed['s'] < 0) elapsed = { d: 0, h: 0, m: 0, s: 0 };
		const elapsedString = msToTimeString(elapsed, true);
		const duration = msToTime(player.queue.current.length);
		const durationString = msToTimeString(duration, true);
		if (player.queue.current.isStream) return interaction.replyHandler.reply(`**[${player.queue.current.title}](${player.queue.current.uri})**\n🔴 **${await getGuildLocale(interaction.guildId, 'MISC.LIVE')}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}\n\`[${await getGuildLocale(interaction.guildId, 'MISC.STREAMING')}]\` | ${await getGuildLocale(interaction.guildId, 'MISC.ADDED_BY', player.queue.current.requester)}`);
		return interaction.replyHandler.reply(`**[${player.queue.current.title}](${player.queue.current.uri})**\n${bar}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}${player.nightcore ? ' 🇳' : ''}\n\`[${elapsedString} / ${durationString}]\` | ${await getGuildLocale(interaction.guildId, 'MISC.ADDED_BY', player.queue.current.requester)}`);
	},
};
