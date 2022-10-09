import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getBar, getGuildLocaleString, getLocaleString, msToTime, msToTimeString } from '#src/lib/util/util.js';
import { LoopType } from '@lavaclient/queue';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';
import type { Node, Player } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('playing')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.PLAYING.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const player = <Player<Node> & { bassboost: boolean, nightcore: boolean }> interaction.client.music.players.get(interaction.guildId);
		// workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error' });
			return;
		}
		const bar = getBar((player.position / player.queue.current.length) * 100);
		let elapsed = msToTime(player.position);
		if (isNaN(elapsed['s']) || elapsed['s'] < 0) elapsed = { d: 0, h: 0, m: 0, s: 0 };
		const elapsedString = msToTimeString(elapsed, true);
		const duration = msToTime(player.queue.current.length);
		const durationString = msToTimeString(duration, true);
		if (player.queue.current.isStream) {
			await interaction.replyHandler.reply(`**[${escapeMarkdown(player.queue.current.title)}](${player.queue.current.uri})**\n🔴 **${await getGuildLocaleString(interaction.guildId, 'MISC.LIVE')}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}\n\`[${await getGuildLocaleString(interaction.guildId, 'MISC.STREAMING')}]\` | ${await getGuildLocaleString(interaction.guildId, 'MISC.ADDED_BY', player.queue.current.requester)}`, { ephemeral: true });
			return;
		}
		await interaction.replyHandler.reply(`**[${escapeMarkdown(player.queue.current.title)}](${player.queue.current.uri})**\n${bar}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}${player.nightcore ? ' 🇳' : ''}\n\`[${elapsedString} / ${durationString}]\` | ${await getGuildLocaleString(interaction.guildId, 'MISC.ADDED_BY', player.queue.current.requester)}`, { ephemeral: true });
	},
};
