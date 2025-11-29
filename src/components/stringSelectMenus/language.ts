import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { StringSelectMenuHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { checkLocaleCompletion } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { confirmationTimeout } from '#src/lib/state';
import {
    buildMessageOptions,
    buildSettingsPage,
    Check,
    settings,
} from '#src/lib/util';
import { roundTo } from '@zptxdev/zptx-lib';
import { ContainerComponent } from 'discord.js';

export default new StringSelectMenuHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function (interaction): Promise<void> {
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
                        logger.error(`${error.message}\n${error.stack}`);
                    }
                }
                delete confirmationTimeout[message.id];
            },
            30_000,
            guild,
            interaction.message,
        );
        const option = interaction.values[0];
        const localeCompletion = checkLocaleCompletion(option);
        if (localeCompletion === 'LOCALE_MISSING') {
            await interaction.replyHandler.reply(
                'That language does not exist.',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await guild.settings.set('locale', option);
        if (localeCompletion.completion !== 100) {
            await interaction.replyHandler.reply(
                `This language is incomplete. Completion: \`${roundTo(
                    localeCompletion.completion,
                    2,
                )}%\`${
                    settings.managers.includes(interaction.user.id)
                        ? `\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join(
                              '\n',
                          )}\`\`\``
                        : ''
                }`,
                { type: MessageOptionsBuilderType.Warning, ephemeral: true },
            );
        }
        const { containers } = await buildSettingsPage(interaction, 'language');
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        if (localeCompletion.completion !== 100) {
            await interaction.message.edit(buildMessageOptions(containers));
            return;
        }
        await interaction.replyHandler.reply(containers, {
            force: ForceType.Update,
        });
    });
