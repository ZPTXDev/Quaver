import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ContainerComponent,
} from 'discord.js';
import { ForceType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import {
    confirmationTimeout,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { buildMessageOptions, buildSettingsPage } from '#src/lib/util/util';

export default new ButtonHandler()
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
        if (option) {
            if (!settings.features.autolyrics.enabled) {
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.DISABLED.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            const whitelisted =
                await guild.features.checkWhitelisted('autolyrics');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                if (
                    settings.features.autolyrics.premium &&
                    settings.premiumURL
                ) {
                    await interaction.replyHandler.reply(
                        new ContainerBuilder()
                            .addTextDisplayComponents(
                                guild.builders.textDisplayLocale(
                                    'FEATURE.NO_PERMISSION.PREMIUM',
                                ),
                            )
                            .addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().setComponents(
                                    guild.builders
                                        .buttonLocale('MISC.GET_PREMIUM')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(settings.premiumURL),
                                ),
                            ),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.NO_PERMISSION.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        }
        await guild.settings.set('autolyrics', option);
        guild.sendWebUpdate('autoLyricsFeatureUpdate', { enabled: option });
        const { containers } = await buildSettingsPage(
            interaction,
            'autolyrics',
        );
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            return;
        }
        await interaction.replyHandler.reply(containers, {
            force: ForceType.Update,
        });
    });
