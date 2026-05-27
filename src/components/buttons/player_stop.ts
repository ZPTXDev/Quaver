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
        const response = await player.reset(interaction.user);
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    { type: MessageOptionsBuilderType.Error, ephemeral: true },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.STOP.RESPONSE.SUCCESS'),
                    {
                        force: ForceType.Update,
                        components: [],
                    },
                );
        }
    });
