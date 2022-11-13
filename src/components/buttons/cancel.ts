import { ForceType } from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { confirmationTimeout, searchState } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import type { ButtonInteraction } from 'discord.js';

export default {
    name: 'cancel',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        clearTimeout(confirmationTimeout[interaction.message.id]);
        clearTimeout(searchState[interaction.message.id]?.timeout);
        delete confirmationTimeout[interaction.message.id];
        delete searchState[interaction.message.id];
        await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', {
            vars: [interaction.message.interaction.user.id],
            components: [],
            force: ForceType.Update,
        });
    },
};
