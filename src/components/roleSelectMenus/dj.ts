import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverInteraction,
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
    RoleSelectMenuInteraction,
    SelectMenuComponentOptionData,
    StringSelectMenuComponent } from 'discord.js';
import {
    ActionRow,
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

export default {
    name: 'dj',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<RoleSelectMenuInteraction>,
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
        if (interaction.values.length > 0) {
            const option = interaction.values[0];
            await data.guild.set(interaction.guildId, 'settings.dj', option);
        } else {
            await data.guild.unset(interaction.guildId, 'settings.dj');
        }
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guildId,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        const { current, embeds, actionRow } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            'dj',
        );
        const description = `${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.RESPONSE.HEADER',
            interaction.guild.name,
        )}\n\n**${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.DJ.NAME',
        )}** ─ ${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.DJ.DESCRIPTION',
        )}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: ${current}`;
        if (!(interaction.message.components[0] instanceof ActionRow)) return;
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
                                    default: opt === 'dj',
                                }),
                            ),
                        ),
                    ),
                    actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
                ],
            },
        ];
        await interaction.replyHandler.reply(args[0], {
            ...args[1],
            force: ForceType.Update,
        });
    },
};
