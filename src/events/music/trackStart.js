import { features } from '#settings';
import { data, logger } from '#lib/util/common.js';
import { getGuildLocale, msToTime, msToTimeString } from '#lib/util/util.js';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';

export default {
	name: 'trackStart',
	once: false,
	/**
	 * @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('#lib/PlayerHandler.js').default}}} queue
	 * @param {import('@lavaclient/queue').Song} track
	 */
	async execute(queue, track) {
		const { bot, io } = await import('#src/main.js');
		delete queue.player.skip;
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		await queue.player.pause(false);
		if (features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('pauseUpdate', queue.player.paused);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
			if (features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('timeoutUpdate', !!queue.player.timeout);
		}
		const duration = msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		if (features.web.enabled) {
			io.to(`guild:${queue.player.guildId}`).emit('queueUpdate', queue.tracks.map(t => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		const format = await data.guild.get(queue.player.guildId, 'settings.format') ?? 'simple';
		return format === 'simple'
			? queue.player.handler.send(`${await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE', escapeMarkdown(track.title), track.uri, durationString)}\n${await getGuildLocale(queue.player.guildId, 'MISC.ADDED_BY', track.requester)}`)
			: queue.player.handler.send(
				new EmbedBuilder()
					.setTitle(await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE'))
					.setDescription(`**[${escapeMarkdown(track.title)}](${track.uri})**`)
					.addFields([
						{ name: await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION'), value: `\`${durationString}\``, inline: true },
						{ name: await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER'), value: track.author, inline: true },
						{ name: await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY'), value: `<@${track.requester}>`, inline: true },
					])
					.setThumbnail(`https://i.ytimg.com/vi/${track.identifier}/hqdefault.jpg`),
			);
	},
};
