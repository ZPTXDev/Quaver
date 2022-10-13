import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { confirmationTimeout, searchState } from '#src/lib/util/common.js';
import type { ButtonInteraction } from 'discord.js';

export default {
	name: 'cancel',
	async execute(interaction: QuaverInteraction<ButtonInteraction>): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		clearTimeout(confirmationTimeout[interaction.message.id]);
		clearTimeout(searchState[interaction.message.id]?.timeout);
		delete confirmationTimeout[interaction.message.id];
		delete searchState[interaction.message.id];
		await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { vars: [interaction.message.interaction.user.id], components: [], force: 'update' });
	},
};
