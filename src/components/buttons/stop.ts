import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { confirmationTimeout } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import type { ButtonInteraction, Client } from 'discord.js';
import { GuildMember } from 'discord.js';
import type { Node, Player } from 'lavaclient';

export default {
	name: 'stop',
	async execute(interaction: ButtonInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		const { io } = await import('#src/main.js');
		const player: Player<Node> = interaction.client.music.players.get(interaction.guildId);
		if (!player) {
			await interaction.replyHandler.locale(checks.ACTIVE_SESSION, { type: 'error' });
			return;
		}
		if (!(interaction.member instanceof GuildMember) || !interaction.member?.voice.channelId) {
			await interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
			return;
		}
		if (player && interaction.member?.voice.channelId !== player.channelId) {
			await interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
			return;
		}
		clearTimeout(confirmationTimeout[interaction.message.id]);
		delete confirmationTimeout[interaction.message.id];
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.locale('MUSIC.PLAYER.PLAYING.NOTHING', { type: 'error', components: [], force: 'update' });
			return;
		}
		player.queue.clear();
		await player.queue.skip();
		await player.queue.start();
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('queueUpdate', []);
		await interaction.replyHandler.locale('CMD.STOP.RESPONSE.SUCCESS', { type: 'success', components: [], force: 'update' });
	},
};
