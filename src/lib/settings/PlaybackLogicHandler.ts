import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { type Initialized, QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import type { LocaleKey } from '#src/lib/locales';
import { acceptableSources, settings } from '#src/lib/util';
import {
    ActionRowBuilder,
    type APISelectMenuOption,
    type ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ContainerBuilder,
    type Guild,
    type ModalSubmitInteraction,
    StringSelectMenuBuilder,
} from 'discord.js';
import { SettingsCategory, SettingsRenderer } from '.';

export class PlaybackLogicHandler {
    public static async handleButtonPress(
        guild: QuaverGuild<Initialized> & Guild,
        interaction: QuaverInteraction<ButtonInteraction>,
        item: string,
    ): Promise<void> {
        switch (item) {
            case 'notifyin247': {
                const notify =
                    (await guild.settings.get<boolean>('notifyin247')) ?? true;
                await guild.settings.set('notifyin247', !notify);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        // re-wrap guild to get new settings
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Playback,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
            case 'source': {
                const source =
                    (await guild.settings.get<string>('source')) ??
                    Object.keys(acceptableSources)[0];
                await interaction.showModal(
                    SettingsRenderer.renderPickerModal(
                        guild,
                        SettingsCategory.Playback,
                        item,
                        new StringSelectMenuBuilder()
                            .setCustomId('source')
                            .addOptions(
                                Object.keys(acceptableSources).map(
                                    (src: string): APISelectMenuOption => ({
                                        label: guild.locale(
                                            `MISC.SOURCES.${src.toUpperCase()}` as LocaleKey,
                                        ),
                                        value: src,
                                        default: source === src,
                                    }),
                                ),
                            ),
                    ),
                );
                return;
            }
            case 'smartqueue': {
                const smartQueue =
                    (await guild.settings.get<boolean>('smartqueue')) ?? false;
                if (!smartQueue) {
                    if (!settings.features.smartqueue.enabled) {
                        await interaction.replyHandler.reply(
                            guild.locale('FEATURE.DISABLED.DEFAULT'),
                            { type: MessageOptionsBuilderType.Error },
                        );
                        return;
                    }
                    const whitelisted =
                        await guild.features.checkWhitelisted('smartqueue');
                    if (
                        whitelisted === WhitelistStatus.NotWhitelisted ||
                        whitelisted === WhitelistStatus.Expired
                    ) {
                        if (
                            settings.features.smartqueue.premium &&
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
                                                .buttonLocale(
                                                    'MISC.GET_PREMIUM',
                                                )
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
                await guild.settings.set('smartqueue', !smartQueue);
                guild.sendWebUpdate('smartQueueFeatureUpdate', {
                    enabled: !smartQueue,
                });
                const player = await guild.getPlayer();
                if (player && player.memory.alternate === smartQueue) {
                    await player.setAlternate(!smartQueue);
                    guild.sendWebUpdate('queueUpdate', player.decorateQueue());
                }
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Playback,
                    ),
                    { force: ForceType.Update },
                );
                return;
            }
        }
    }

    public static async handleModalSubmit(
        guild: QuaverGuild<Initialized> & Guild,
        interaction: QuaverInteraction<ModalSubmitInteraction>,
        item: string,
    ): Promise<void> {
        switch (item) {
            case 'source': {
                const value = interaction.fields.getStringSelectValues(item)[0];
                await guild.settings.set('source', value);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.Playback,
                    ),
                    { force: ForceType.Update },
                );
            }
        }
    }
}
