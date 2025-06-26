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
import type { ButtonInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ContainerComponent,
    TextDisplayBuilder,
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
            30_000,
            interaction.message,
        );
        const option = interaction.customId.split(':')[1] === 'enable';
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guildId,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        if (option) {
            if (!settings.features.smartqueue.enabled) {
                await interaction.replyHandler.reply(
                    getLocaleString(
                        guildLocaleCode,
                        'FEATURE.DISABLED.DEFAULT',
                    ),
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
                    await interaction.replyHandler.reply(
                        new ContainerBuilder({
                            components: [
                                new TextDisplayBuilder()
                                    .setContent(
                                        getLocaleString(
                                            guildLocaleCode,
                                            'FEATURE.NO_PERMISSION.PREMIUM',
                                        ),
                                    )
                                    .toJSON(),
                                new ActionRowBuilder<ButtonBuilder>()
                                    .setComponents(
                                        new ButtonBuilder()
                                            .setLabel(
                                                await getGuildLocaleString(
                                                    interaction.guildId,
                                                    'MISC.GET_PREMIUM',
                                                ),
                                            )
                                            .setStyle(ButtonStyle.Link)
                                            .setURL(settings.premiumURL),
                                    )
                                    .toJSON(),
                            ],
                        }),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                await interaction.replyHandler.reply(
                    getLocaleString(
                        guildLocaleCode,
                        'FEATURE.NO_PERMISSION.DEFAULT',
                    ),
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
        const { containers } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            'smartqueue',
        );
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            return;
        }
        await interaction.replyHandler.reply(containers, {
            force: ForceType.Update,
        });
    },
};
