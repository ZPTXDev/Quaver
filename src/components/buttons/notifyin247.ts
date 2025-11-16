import { ContainerComponent } from 'discord.js';
import { ForceType, QuaverGuild } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { confirmationTimeout, logger } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { buildMessageOptions, buildSettingsPage } from '#src/lib/util/util';

export default new ButtonHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        if (!confirmationTimeout[interaction.message.id]) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        clearTimeout(confirmationTimeout[interaction.message.id]);
        confirmationTimeout[interaction.message.id] = setTimeout(
            async (g, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            g.locale('DISCORD.INTERACTION.EXPIRED'),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error({
                            message: `${error.message}\n${error.stack}`,
                            label: 'Quaver',
                        });
                    }
                }
                delete confirmationTimeout[message.id];
            },
            30_000,
            guild,
            interaction.message,
        );
        const option = interaction.customId.split(':')[1] === 'enable';
        await guild.settings.set('notifyin247', option);
        const { containers } = await buildSettingsPage(
            interaction,
            'notifyin247',
        );
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        await interaction.replyHandler.reply(containers, {
            force: ForceType.Update,
        });
    });
