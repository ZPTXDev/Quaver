import { settings } from '#src/lib/util/settings.js';
import { data, logger } from '#src/lib/util/common.js';
import { getGuildLocaleString, msToTime, msToTimeString, TimeObject } from '#src/lib/util/util.js';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import { Queue, Song } from '@lavaclient/queue';
import { Node, Player } from 'lavaclient';
import PlayerHandler from '#src/lib/PlayerHandler.js';

export default {
	name: 'trackStart',
	once: false,
	async execute(queue: Queue & { player: Player<Node> & { handler: PlayerHandler, skip: { required: number, users: string[] }, timeout: ReturnType<typeof setTimeout> } }, track: Song): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		delete queue.player.skip;
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		await queue.player.pause(false);
		if (settings.features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('pauseUpdate', queue.player.paused);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
			if (settings.features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('timeoutUpdate', !!queue.player.timeout);
		}
		const duration = <TimeObject> msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		if (settings.features.web.enabled) {
			io.to(`guild:${queue.player.guildId}`).emit('queueUpdate', queue.tracks.map((t: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		const format = await data.guild.get(queue.player.guildId, 'settings.format') ?? 'simple';
		format === 'simple'
			? await queue.player.handler.send(`${await getGuildLocaleString(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE', escapeMarkdown(track.title), track.uri, durationString)}\n${await getGuildLocaleString(queue.player.guildId, 'MISC.ADDED_BY', track.requester)}`)
			: await queue.player.handler.send(
				new EmbedBuilder()
					.setTitle(await getGuildLocaleString(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE'))
					.setDescription(`**[${escapeMarkdown(track.title)}](${track.uri})**`)
					.addFields([
						{ name: await getGuildLocaleString(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION'), value: `\`${durationString}\``, inline: true },
						{ name: await getGuildLocaleString(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER'), value: track.author, inline: true },
						{ name: await getGuildLocaleString(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY'), value: `<@${track.requester}>`, inline: true },
					])
					.setThumbnail(`https://i.ytimg.com/vi/${track.identifier}/hqdefault.jpg`),
			);
	},
};
