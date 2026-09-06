import { buildNowPlayingMessage } from '#src/events/music/trackStart';
import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { Check } from '#src/lib/util';

export default new ButtonHandler()
    .setChecks([Check.ActiveSession, Check.InVoice, Check.InSessionVoice])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        // Check if this is an old player control message
        if (player.memory.currentNowPlayingMessageId &&
            interaction.message.id !== player.memory.currentNowPlayingMessageId) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }
        const shuffle = !player.memory.shuffle;
        const response = await player.setShuffle(shuffle, interaction.user);
        if (response === PlayerResponse.RestartInProgress) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }
        if (response !== PlayerResponse.Success) return;
        if (player.queue.current) {
            const { container, actionRows } = await buildNowPlayingMessage(
                guild,
                player.queue.current,
            );
            await interaction.replyHandler.reply(
                container.addActionRowComponents(...actionRows),
                { force: ForceType.Update },
            );
        } else {
            await interaction.replyHandler.reply(
                guild.locale(
                    shuffle
                        ? 'CMD.SHUFFLE.RESPONSE.ENABLED'
                        : 'CMD.SHUFFLE.RESPONSE.DISABLED',
                ),
                { type: MessageOptionsBuilderType.Success, ephemeral: true },
            );
        }
    });
