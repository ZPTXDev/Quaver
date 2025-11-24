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
        const response = await player.disconnect();
        switch (response) {
            case PlayerResponse.FeatureConflict:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED'),
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                        force: ForceType.Update,
                    },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.DISCONNECT.RESPONSE.SUCCESS'),
                    {
                        type: MessageOptionsBuilderType.Success,
                        components: [],
                        force: ForceType.Update,
                    },
                );
        }
    });
