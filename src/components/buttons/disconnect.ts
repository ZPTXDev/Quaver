import PlayerHandler from '#src/lib/PlayerHandler.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { confirmationTimeout } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import { ButtonInteraction, Client, GuildMember } from 'discord.js';
import { Node, Player } from 'lavaclient';

export default {
	name: 'disconnect',
	async execute(interaction: ButtonInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		const player: Player<Node> & { handler?: PlayerHandler } = interaction.client.music.players.get(interaction.guildId);
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
		await player.handler.disconnect();
		await interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.SUCCESS', { type: 'success', components: [], force: 'update' });
	},
};
