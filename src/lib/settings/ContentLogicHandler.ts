import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { type Initialized, QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import { getPremiumURL, settings } from '#src/lib/util';
import {
    ActionRowBuilder,
    type ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ContainerBuilder,
    type Guild,
} from 'discord.js';
import { SettingsCategory, SettingsRenderer } from '.';

export class ContentLogicHandler {
    public static async handleButtonPress(
        guild: QuaverGuild<Initialized> & Guild,
        interaction: QuaverInteraction<ButtonInteraction>,
        item: string,
    ): Promise<void> {
        switch (item) {
            case 'format': {
                const format =
                    (await guild.settings.get<string>('format')) ?? 'simple';
                await guild.settings.set(
                    'format',
                    format === 'simple' ? 'detailed' : 'simple',
                );
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Content,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
            case 'showartist': {
                const showArtist =
                    (await guild.settings.get<boolean>('showartist')) ?? true;
                await guild.settings.set('showartist', !showArtist);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Content,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
            case 'autolyrics': {
                const autoLyrics =
                    (await guild.settings.get<boolean>('autolyrics')) ?? false;
                if (!autoLyrics) {
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
                                                .buttonLocale(
                                                    'MISC.GET_PREMIUM',
                                                )
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
                await guild.settings.set('autolyrics', !autoLyrics);
                guild.sendWebUpdate('autoLyricsFeatureUpdate', {
                    enabled: !autoLyrics,
                });
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Content,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
            case 'controls': {
                const format =
                    (await guild.settings.get<string>('format')) ?? 'simple';
                if (format === 'simple') return;
                const controls =
                    (await guild.settings.get<boolean>('controls')) ?? true;
                await guild.settings.set('controls', !controls);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Content,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
            case 'showsourcelabels': {
                const showSourceLabels =
                    (await guild.settings.get<boolean>('showsourcelabels')) ?? false;
                await guild.settings.set('showsourcelabels', !showSourceLabels);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Content,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
        }
    }
}
