import { ForceType } from '#src/lib';
import { StringSelectMenuHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { confirmationTimeout, logger } from '#src/lib/util/common';
import type { SettingsPageOptions } from '#src/lib/util/common.d';
import { Check } from '#src/lib/util/constants';
import { buildMessageOptions, buildSettingsPage } from '#src/lib/util/util';

export default new StringSelectMenuHandler()
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
        const option = interaction.values[0] as SettingsPageOptions;
        const { containers } = await buildSettingsPage(interaction, option);
        await interaction.replyHandler.reply(containers, {
            force: ForceType.Update,
        });
    });
