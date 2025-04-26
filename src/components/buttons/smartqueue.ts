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
    getGuildFeatureWhitelisted,
    getGuildLocaleString,
    getLocaleString,
    WhitelistStatus,
} from '#src/lib/util/util.js';
import type {
    ButtonInteraction,
    MessageActionRowComponentBuilder,
    StringSelectMenuComponent } from 'discord.js';
import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

export default {
    name: 'smartqueue',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const { io } = await import('#src/main.js');
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
        const option = interaction.customId.split(':')[1] === 'enable';
        if (option) {
            if (!settings.features.smartqueue.enabled) {
                await interaction.replyHandler.locale(
                    'FEATURE.DISABLED.DEFAULT',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            const whitelisted = await getGuildFeatureWhitelisted(
                interaction.guildId,
                'smartqueue',
            );
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                if (
                    settings.features.smartqueue.premium &&
                    settings.premiumURL
                ) {
                    await interaction.replyHandler.locale(
                        'FEATURE.NO_PERMISSION.PREMIUM',
                        {
                            type: MessageOptionsBuilderType.Error,
                            components: [
                                new ActionRowBuilder<ButtonBuilder>().setComponents(
                                    new ButtonBuilder()
                                        .setLabel(
                                            await getGuildLocaleString(
                                                interaction.guildId,
                                                'MISC.GET_PREMIUM',
                                            ),
                                        )
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(settings.premiumURL),
                                ),
                            ],
                        },
                    );
                    return;
                }
                await interaction.replyHandler.locale(
                    'FEATURE.NO_PERMISSION.DEFAULT',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        }
        await data.guild.set(
            interaction.guildId,
            'settings.smartqueue',
            option,
        );
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit(
                'smartQueueFeatureUpdate',
                {
                    enabled: option,
                },
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
            'smartqueue',
        );
        const description = `${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.RESPONSE.HEADER',
            interaction.guild.name,
        )}\n\n**${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.SMARTQUEUE.NAME',
        )}** ─ ${getLocaleString(
            guildLocaleCode,
            'CMD.SETTINGS.MISC.SMARTQUEUE.DESCRIPTION',
        )}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: ${current}`;
        if (!(interaction.message.components[0] instanceof ActionRow)) return;
        await interaction.replyHandler.reply([description, ...embeds], {
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    StringSelectMenuBuilder.from(
                        interaction.message.components[0]
                            .components[0] as StringSelectMenuComponent,
                    ),
                ),
                actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
            ],
            force: ForceType.Update,
        });
    },
};
