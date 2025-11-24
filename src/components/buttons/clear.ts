import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { confirmationTimeout } from '#src/lib/state';
import { Check } from '#src/lib/util';

export default new ButtonHandler()
    .setChecks([
        Check.InteractionStarter,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        clearTimeout(confirmationTimeout[interaction.message.id]);
        delete confirmationTimeout[interaction.message.id];
        const response = await player.clearQueue();
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY'),
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            case PlayerResponse.Success:
                player.queue.clear();
                guild.sendWebUpdate('queueUpdate', []);
                await interaction.replyHandler.reply(
                    guild.locale('CMD.CLEAR.RESPONSE.SUCCESS'),
                    {
                        type: MessageOptionsBuilderType.Success,
                        components: [],
                        force: ForceType.Update,
                    },
                );
        }
    });
