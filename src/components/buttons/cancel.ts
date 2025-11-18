import { ForceType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { confirmationTimeout, searchState } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';

export default new ButtonHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        clearTimeout(confirmationTimeout[interaction.message.id]);
        clearTimeout(searchState[interaction.message.id]?.timeout);
        delete confirmationTimeout[interaction.message.id];
        delete searchState[interaction.message.id];
        await interaction.replyHandler.reply(
            guild.locale(
                'DISCORD.INTERACTION.CANCELED',
                interaction.message.interactionMetadata.user.id,
            ),
            {
                components: [],
                force: ForceType.Update,
            },
        );
    });
