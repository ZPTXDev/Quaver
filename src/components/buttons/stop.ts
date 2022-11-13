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
import { settings } from '#src/lib/util/settings.js';
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
        const { io } = await import('#src/main.js');
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        clearTimeout(confirmationTimeout[interaction.message.id]);
        delete confirmationTimeout[interaction.message.id];
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.locale(
                'MUSIC.PLAYER.PLAYING.NOTHING',
                {
                    type: MessageOptionsBuilderType.Error,
                    components: [],
                    force: ForceType.Update,
                },
            );
            return;
        }
        player.queue.clear();
        await player.queue.skip();
        await player.queue.start();
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit('queueUpdate', []);
        }
        await interaction.replyHandler.locale('CMD.STOP.RESPONSE.SUCCESS', {
            type: MessageOptionsBuilderType.Success,
            components: [],
            force: ForceType.Update,
        });
    },
};
