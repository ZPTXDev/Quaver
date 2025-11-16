import { ContainerComponent } from 'discord.js';
import { ForceType, QuaverGuild } from '#src/lib';
import { RoleSelectMenuHandler } from '#src/lib/builders';
import { confirmationTimeout, logger } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { buildMessageOptions, buildSettingsPage } from '#src/lib/util/util';

export default new RoleSelectMenuHandler()
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
        if (interaction.values.length > 0) {
            const option = interaction.values[0];
            await guild.settings.set('dj', option);
        } else {
            await guild.settings.unset('settings.dj');
        }
        const { containers } = await buildSettingsPage(interaction, 'dj');
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
