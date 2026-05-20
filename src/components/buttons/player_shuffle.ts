import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { buildNowPlayingMessage } from '#src/events/music/trackStart';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { Check } from '#src/lib/util';

export default new ButtonHandler()
    .setChecks([
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const shuffle = !player.memory.shuffle;
        const response = await player.setShuffle(shuffle);
        if (response !== PlayerResponse.Success) return;
        if (player.queue.current) {
            const { container, actionRows } = await buildNowPlayingMessage(guild, player.queue.current);
            await interaction.replyHandler.reply(
                container.addActionRowComponents(...actionRows),
                { force: ForceType.Update }
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
