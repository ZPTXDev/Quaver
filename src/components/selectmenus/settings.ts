import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    QuaverInteraction,
    SettingsPageOptions,
} from '#src/lib/util/common.d.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import type { Language } from '#src/lib/util/constants.js';
import { Check, settingsOptions } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    buildSettingsPage,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type {
    MessageActionRowComponentBuilder,
    SelectMenuComponentOptionData,
    StringSelectMenuInteraction,
} from 'discord.js';
import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

export default {
    name: 'settings',
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
        const option = interaction.values[0] as SettingsPageOptions;
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guild.id,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        const { current, embeds, actionRow } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            option,
        );
        const description = `${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.RESPONSE.HEADER',
            interaction.guild.name,
        )}\n\n**${getLocaleString(
            guildLocaleCode,
            `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`,
        )}** ─ ${getLocaleString(
            guildLocaleCode,
            `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`,
        )}${
            current
                ? `\n> ${getLocaleString(
                      guildLocaleCode,
                      'MISC.CURRENT',
                  )}: \`${current}\``
                : ''
        }`;
        await interaction.replyHandler.reply([description, ...embeds], {
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('settings')
                        .addOptions(
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
                                    default: opt === option,
                                }),
                            ),
                        ),
                ),
                actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
            ],
            force: ForceType.Update,
        });
    },
};
