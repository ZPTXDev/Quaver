import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, getPremiumURL, settings } from '#src/lib/util';
import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('autoplay')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.AUTOPLAY.DESCRIPTION',
                ),
            )
            .addBooleanOption(
                (option): SlashCommandBooleanOption =>
                    option
                        .setName('enabled')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.AUTOPLAY.OPTION.ENABLED',
                            ),
                        ),
            ),
    )
    .setChecks([Check.GuildOnly])
    .setExecute(async function (interaction): Promise<void> {
        const enabled = interaction.options.getBoolean('enabled');
        const guild = await QuaverGuild.wrap(interaction.guild);
        // Get current autoplay status
        const currentAutoplay =
            (await guild.settings.get<boolean>('autoplay')) ?? false;
        // Determine desired state: use provided value or toggle current
        const desiredAutoplay =
            enabled !== null ? enabled : !currentAutoplay;

        // If trying to enable, check permissions
        if (desiredAutoplay && !currentAutoplay) {
            if (!settings.features.autoplay.enabled) {
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.DISABLED.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            const whitelisted =
                await guild.features.checkWhitelisted('autoplay');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                if (
                    settings.features.autoplay.premium &&
                    settings.premiumEnabled
                ) {
                    const premiumURL = getPremiumURL(guild.id);
                    if (premiumURL) {
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
                                            .setURL(premiumURL),
                                    ),
                                ),
                            { type: MessageOptionsBuilderType.Error },
                        );
                        return;
                    }
                }
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.NO_PERMISSION.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        }

        // Update the setting
        await guild.settings.set('autoplay', desiredAutoplay);

        // Send response
        await interaction.replyHandler.reply(
            guild.locale(
                desiredAutoplay
                    ? 'CMD.AUTOPLAY.RESPONSE.ENABLED'
                    : 'CMD.AUTOPLAY.RESPONSE.DISABLED',
            ),
        );
    });
