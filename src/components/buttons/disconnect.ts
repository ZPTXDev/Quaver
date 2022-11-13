import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import {
    confirmationTimeout,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import type { ButtonInteraction } from 'discord.js';

export default {
    name: 'disconnect',
    checks: [
        Check.InteractionStarter,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        clearTimeout(confirmationTimeout[interaction.message.id]);
        delete confirmationTimeout[interaction.message.id];
        await player.handler.disconnect();
        await interaction.replyHandler.locale(
            'CMD.DISCONNECT.RESPONSE.SUCCESS',
            {
                type: MessageOptionsBuilderType.Success,
                components: [],
                force: ForceType.Update,
            },
        );
    },
};
