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

        const isMineOnly = interaction.customId === 'clear-mine';

        if (isMineOnly) {
            const userTracks = player.queue.tracks.filter(
                (track) => track.requesterId === interaction.user.id,
            );

            if (userTracks.length === 0) {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.CLEAR.RESPONSE.NO_USER_TRACKS'),
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            }

            player.queue.tracks = player.queue.tracks.filter(
                (track) => track.requesterId !== interaction.user.id,
            );
            player.logSessionEvent('QUEUE_CLEAR_MINE', interaction.user);

            if (player.memory.originalQueue) {
                player.memory.originalQueue = player.memory.originalQueue.filter(
                    (track) => track.requesterId !== interaction.user.id,
                );
            }

            guild.sendWebUpdate('queueUpdate', player.decorateQueue());
            await interaction.replyHandler.reply(
                guild.locale('CMD.CLEAR.RESPONSE.SUCCESS_MINE'),
                {
                    type: MessageOptionsBuilderType.Success,
                    components: [],
                    force: ForceType.Update,
                },
            );
        } else {
            const response = await player.clearQueue(interaction.user);
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
        }
    });
