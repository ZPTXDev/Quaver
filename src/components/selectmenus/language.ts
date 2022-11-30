import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverInteraction,
} from '#src/lib/util/common.d.js';
import {
    confirmationTimeout,
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import type { Language } from '#src/lib/util/constants.js';
import { Check, settingsOptions } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    buildSettingsPage,
    checkLocaleCompletion,
    getGuildLocaleString,
    getLocaleString,
    roundTo,
} from '#src/lib/util/util.js';
import type {
    MessageActionRowComponentBuilder,
    SelectMenuComponentOptionData,
    StringSelectMenuComponent,
    StringSelectMenuInteraction,
} from 'discord.js';
import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

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
                            new EmbedBuilder().setDescription(
                                await getGuildLocaleString(
                                    message.guildId,
                                    'DISCORD.INTERACTION.EXPIRED',
                                ),
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
                new EmbedBuilder().setDescription(
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
                ),
                { type: MessageOptionsBuilderType.Warning, ephemeral: true },
            );
        }
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guildId,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        const { current, embeds, actionRow } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            'language',
        );
        const description = `${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.RESPONSE.HEADER',
            interaction.guild.name,
        )}\n\n**${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.LANGUAGE.NAME',
        )}** ─ ${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.LANGUAGE.DESCRIPTION',
        )}\n> ${getLocaleString(
            guildLocaleCode,
            'MISC.CURRENT',
        )}: \`${current}\``;
        const args: [
            MessageOptionsBuilderInputs,
            MessageOptionsBuilderOptions,
        ] = [
            [description, ...embeds],
            {
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        StringSelectMenuBuilder.from(
                            <StringSelectMenuComponent>(
                                interaction.message.components[0].components[0]
                            ),
                        ).setOptions(
                            settingsOptions.map(
                                (opt): SelectMenuComponentOptionData => ({
                                    label: getLocaleString(
                                        guildLocaleCode,
                                        `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`,
                                    ),
                                    description: getLocaleString(
                                        guildLocaleCode,
                                        `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`,
                                    ),
                                    value: opt,
                                    default: opt === 'language',
                                }),
                            ),
                        ),
                    ),
                    actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
                ],
            },
        ];
        localeCompletion.completion !== 100
            ? await interaction.message.edit(buildMessageOptions(...args))
            : await interaction.replyHandler.reply(args[0], {
                  ...args[1],
                  force: ForceType.Update,
              });
    },
};
