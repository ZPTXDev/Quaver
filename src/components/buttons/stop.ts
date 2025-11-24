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
        const response = await player.reset();
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.STOP.RESPONSE.SUCCESS'),
                    {
                        type: MessageOptionsBuilderType.Success,
                        components: [],
                        force: ForceType.Update,
                    },
                );
        }
    });
