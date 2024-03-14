import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import {
    MessageOptionsBuilderType,
    confirmationTimeout,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import type { ButtonInteraction } from 'discord.js';

export default {
    name: 'clear',
    checks: [
        Check.InteractionStarter,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const { io } = await import('#src/main.js');
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        clearTimeout(confirmationTimeout[interaction.message.id]);
        delete confirmationTimeout[interaction.message.id];
        const response = await player.handler.clear();
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.locale(
                    'CMD.CLEAR.RESPONSE.QUEUE_EMPTY',
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            case PlayerResponse.Success:
                player.queue.clear();
                if (settings.features.web.enabled) {
                    io.to(`guild:${interaction.guildId}`).emit(
                        'queueUpdate',
                        [],
                    );
                }
                await interaction.replyHandler.locale(
                    'CMD.CLEAR.RESPONSE.SUCCESS',
                    {
                        type: MessageOptionsBuilderType.Success,
                        components: [],
                        force: ForceType.Update,
                    },
                );
        }
    },
};
