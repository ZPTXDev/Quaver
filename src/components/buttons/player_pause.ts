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
        const pause = !player.paused;
        const response = await player.setPause(pause);
        switch (response) {
            case PlayerResponse.RestartInProgress:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                    { type: MessageOptionsBuilderType.Error, ephemeral: true },
                );
                return;
            case PlayerResponse.PlayerStateUnchanged:
                await interaction.replyHandler.reply(
                    guild.locale(
                        pause
                            ? 'CMD.PAUSE.RESPONSE.STATE_UNCHANGED'
                            : 'CMD.RESUME.RESPONSE.STATE_UNCHANGED',
                    ),
                    { type: MessageOptionsBuilderType.Error, ephemeral: true },
                );
                return;
            case PlayerResponse.Success: {
                if (player.queue.current) {
                    const { container, actionRows } = await buildNowPlayingMessage(guild, player.queue.current);
                    await interaction.replyHandler.reply(
                        container.addActionRowComponents(...actionRows),
                        { force: ForceType.Update }
                    );
                } else {
                    await interaction.replyHandler.reply(
                        guild.locale(
                            pause
                                ? 'CMD.PAUSE.RESPONSE.SUCCESS'
                                : 'CMD.RESUME.RESPONSE.SUCCESS',
                        ),
                        { type: MessageOptionsBuilderType.Success, ephemeral: true },
                    );
                }
            }
        }
    });
