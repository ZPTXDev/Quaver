import { PlayerResponse } from '#src/lib/PlayerHandler.js';
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
    name: 'stop',
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
        const response = await player.handler.stop();
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.locale(
                    'MUSIC.PLAYER.PLAYING.NOTHING',
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.locale(
                    'CMD.STOP.RESPONSE.SUCCESS',
                    {
                        type: MessageOptionsBuilderType.Success,
                        components: [],
                        force: ForceType.Update,
                    },
                );
        }
    },
};
