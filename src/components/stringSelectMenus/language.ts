import { ForceType } from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import {
    confirmationTimeout,
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import type { Language } from '#src/lib/util/constants.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    buildSettingsPage,
    checkLocaleCompletion,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import { roundTo } from '@zptxdev/zptx-lib';
import type { StringSelectMenuInteraction } from 'discord.js';
import { ContainerComponent } from 'discord.js';

export default {
    name: 'language',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<StringSelectMenuInteraction>,
    ): Promise<void> {
        if (!confirmationTimeout[interaction.message.id]) {
            await interaction.replyHandler.locale(
                'DISCORD.INTERACTION.EXPIRED',
                { components: [], force: ForceType.Update },
            );
            return;
        }
        clearTimeout(confirmationTimeout[interaction.message.id]);
        confirmationTimeout[interaction.message.id] = setTimeout(
            async (message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            await getGuildLocaleString(
                                message.guildId,
                                'DISCORD.INTERACTION.EXPIRED',
                            ),
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
            30 * 1000,
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
        await data.guild.set(interaction.guildId, 'settings.locale', option);
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
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guildId,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        const { containers } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            'language',
        );
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            await interaction.replyHandler.reply(
                getLocaleString(guildLocaleCode, 'DISCORD.INTERACTION.EXPIRED'),
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
    },
};
