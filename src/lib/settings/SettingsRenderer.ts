import {
    type Initialized,
    type QuaverGuild,
    WhitelistStatus,
} from '#src/lib/guild';
import { Language, type LocaleKey } from '#src/lib/locales';
import { acceptableSources, getPremiumURL, settings } from '#src/lib/util';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    type Guild,
    LabelBuilder,
    MentionableSelectMenuBuilder,
    ModalBuilder,
    RoleSelectMenuBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    UserSelectMenuBuilder,
} from 'discord.js';
import { SettingsCategory } from '.';

export class SettingsRenderer {
    public static renderMainMenu(
        guild: QuaverGuild<Initialized> & Guild,
    ): ContainerBuilder {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    'CMD.SETTINGS.MISC.MAIN_MENU.HEADER',
                    guild.name,
                ),
                guild.builders.textDisplayLocale(
                    'CMD.SETTINGS.MISC.MAIN_MENU.DESCRIPTION',
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
            );
        const categories = Object.values(SettingsCategory);
        categories.forEach((setting, i): void => {
            container.addSectionComponents(
                this.createItemSection(guild, setting),
            );
            if (i < categories.length - 1) {
                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(false),
                );
            }
        });
        return container;
    }

    public static async renderSubMenu(
        guild: QuaverGuild<Initialized> & Guild,
        category: SettingsCategory,
    ): Promise<ContainerBuilder> {
        const subMenuName = guild.locale(
            `CMD.SETTINGS.MISC.${category.toUpperCase()}.NAME` as LocaleKey,
        );
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ${guild.locale('CMD.SETTINGS.MISC.MAIN_MENU.TITLE')} > ${subMenuName}`,
                ),
                new TextDisplayBuilder().setContent(`## ${subMenuName}`),
                guild.builders.textDisplayLocale(
                    `CMD.SETTINGS.MISC.${category.toUpperCase()}.DESCRIPTION` as LocaleKey,
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
            );
        const sections = await this.renderSettings(category, guild);
        sections.forEach((section, i): void => {
            container.addSectionComponents(section);
            if (i < sections.length - 1) {
                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(false),
                );
            }
        });
        return container
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
            )
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('settings')
                        .setLabel(guild.locale('MISC.BACK'))
                        .setStyle(ButtonStyle.Secondary),
                ),
            );
    }

    private static createItemSection(
        guild: QuaverGuild<Initialized> & Guild,
        category: SettingsCategory,
        item?: string,
        label = '➔',
        style: ButtonStyle = ButtonStyle.Secondary,
        url?: string,
        disabled = false,
    ): SectionBuilder {
        const button = new ButtonBuilder().setLabel(label).setStyle(style);
        if (url) {
            button.setURL(url);
        } else {
            button.setCustomId(`settings:${category}${item ? `:${item}` : ''}`);
        }
        if (disabled) {
            button.setDisabled(true);
        }
        return new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${guild.locale(
                        `CMD.SETTINGS.MISC.${category.toUpperCase()}.${item ? `SETTINGS.${item.toUpperCase()}.` : ''}NAME` as LocaleKey,
                    )}`,
                ),
                new TextDisplayBuilder().setContent(
                    `-# ${guild.locale(
                        `CMD.SETTINGS.MISC.${category.toUpperCase()}.${item ? `SETTINGS.${item.toUpperCase()}.` : ''}DESCRIPTION` as LocaleKey,
                    )}`,
                ),
            )
            .setButtonAccessory(button);
    }

    private static async renderSettings(
        category: SettingsCategory,
        guild: QuaverGuild<Initialized> & Guild,
    ): Promise<SectionBuilder[]> {
        switch (category) {
            case SettingsCategory.General:
                return this.renderGeneralSettings(guild);
            case SettingsCategory.Playback:
                return this.renderPlaybackSettings(guild);
            case SettingsCategory.Content:
                return this.renderContentSettings(guild);
            default:
                return [];
        }
    }

    private static async renderGeneralSettings(
        guild: QuaverGuild<Initialized> & Guild,
    ): Promise<SectionBuilder[]> {
        const premiumEnabled =
            settings.premiumEnabled &&
            ['autolyrics', 'stay', 'smartqueue'].some(
                (feature: string): boolean => {
                    const f =
                        settings.features[
                            feature as 'autolyrics' | 'stay' | 'smartqueue'
                        ];
                    return f.enabled && f.whitelist && f.premium;
                },
            );
        const premiumURL = getPremiumURL(guild.id);
        const isPremium =
            premiumEnabled &&
            [WhitelistStatus.Permanent, WhitelistStatus.Temporary].includes(
                await guild.features.checkWhitelisted('premium'),
            );
        return [
            ...(premiumEnabled && (isPremium || premiumURL)
                ? [
                      this.createItemSection(
                          guild,
                          SettingsCategory.General,
                          'premium',
                          isPremium
                              ? guild.locale('MISC.ACTIVE')
                              : guild.locale('MISC.GET_PREMIUM'),
                          isPremium ? ButtonStyle.Success : ButtonStyle.Link,
                          isPremium ? '' : premiumURL!,
                      ),
                  ]
                : []),
            this.createItemSection(
                guild,
                SettingsCategory.General,
                'language',
                `${
                    Language[guild.localeCode as keyof typeof Language] ??
                    'Unknown'
                } (${guild.localeCode})`,
            ),
            this.createItemSection(
                guild,
                SettingsCategory.General,
                'dj',
                guild.locale('MISC.SET'),
            ),
        ];
    }

    private static async renderPlaybackSettings(
        guild: QuaverGuild<Initialized> & Guild,
    ): Promise<SectionBuilder[]> {
        const notify =
            (await guild.settings.get<boolean>('notifyin247')) ?? true;
        const pauseAlone =
            (await guild.settings.get<boolean>('pausealone247')) ?? false;
        const source =
            (await guild.settings.get<string>('source')) ??
            Object.keys(acceptableSources)[0];
        const smartQueue =
            (await guild.settings.get<boolean>('smartqueue')) ?? false;
        return [
            ...(settings.features.stay.enabled
                ? [
                      this.createItemSection(
                          guild,
                          SettingsCategory.Playback,
                          'notifyin247',
                          guild.locale(
                              notify ? 'MISC.ENABLED' : 'MISC.DISABLED',
                          ),
                          notify ? ButtonStyle.Success : ButtonStyle.Danger,
                      ),
                      this.createItemSection(
                          guild,
                          SettingsCategory.Playback,
                          'pausealone247',
                          guild.locale(
                              pauseAlone ? 'MISC.ENABLED' : 'MISC.DISABLED',
                          ),
                          pauseAlone ? ButtonStyle.Success : ButtonStyle.Danger,
                      ),
                  ]
                : []),
            this.createItemSection(
                guild,
                SettingsCategory.Playback,
                'source',
                guild.locale(
                    `MISC.SOURCES.${source.toUpperCase()}` as LocaleKey,
                ),
            ),
            ...(settings.features.smartqueue.enabled
                ? [
                      this.createItemSection(
                          guild,
                          SettingsCategory.Playback,
                          'smartqueue',
                          guild.locale(
                              smartQueue ? 'MISC.ENABLED' : 'MISC.DISABLED',
                          ),
                          smartQueue ? ButtonStyle.Success : ButtonStyle.Danger,
                      ),
                  ]
                : []),
        ];
    }

    private static async renderContentSettings(
        guild: QuaverGuild<Initialized> & Guild,
    ): Promise<SectionBuilder[]> {
        const format = (await guild.settings.get<string>('format')) ?? 'simple';
        const autoLyrics =
            (await guild.settings.get<boolean>('autolyrics')) ?? false;
        const controls =
            (await guild.settings.get<boolean>('controls')) ?? true;
        return [
            this.createItemSection(
                guild,
                SettingsCategory.Content,
                'format',
                format === 'simple'
                    ? guild.locale(
                          'CMD.SETTINGS.MISC.CONTENT.SETTINGS.FORMAT.OPTIONS.SIMPLE',
                      )
                    : guild.locale(
                          'CMD.SETTINGS.MISC.CONTENT.SETTINGS.FORMAT.OPTIONS.DETAILED',
                      ),
            ),
            ...(settings.features.autolyrics.enabled
                ? [
                      this.createItemSection(
                          guild,
                          SettingsCategory.Content,
                          'autolyrics',
                          guild.locale(
                              autoLyrics ? 'MISC.ENABLED' : 'MISC.DISABLED',
                          ),
                          autoLyrics ? ButtonStyle.Success : ButtonStyle.Danger,
                      ),
                  ]
                : []),
            this.createItemSection(
                guild,
                SettingsCategory.Content,
                'controls',
                guild.locale(
                    format === 'simple'
                        ? 'MISC.DISABLED'
                        : controls
                          ? 'MISC.ENABLED'
                          : 'MISC.DISABLED',
                ),
                format === 'simple'
                    ? ButtonStyle.Danger
                    : controls
                      ? ButtonStyle.Success
                      : ButtonStyle.Danger,
                undefined,
                format === 'simple',
            ),
        ];
    }

    public static renderPickerModal(
        guild: QuaverGuild<Initialized> & Guild,
        category: SettingsCategory,
        item: string,
        selectMenu:
            | RoleSelectMenuBuilder
            | StringSelectMenuBuilder
            | MentionableSelectMenuBuilder
            | UserSelectMenuBuilder,
    ): ModalBuilder {
        const label = new LabelBuilder()
            .setLabel(
                guild.locale(
                    `CMD.SETTINGS.MISC.${category.toUpperCase()}.SETTINGS.${item.toUpperCase()}.NAME` as LocaleKey,
                ),
            )
            .setDescription(
                guild.locale(
                    `CMD.SETTINGS.MISC.${category.toUpperCase()}.SETTINGS.${item.toUpperCase()}.DESCRIPTION` as LocaleKey,
                ),
            );
        // ugh - seriously?
        if (selectMenu instanceof StringSelectMenuBuilder) {
            label.setStringSelectMenuComponent(selectMenu);
        } else if (selectMenu instanceof RoleSelectMenuBuilder) {
            label.setRoleSelectMenuComponent(selectMenu);
        } else if (selectMenu instanceof MentionableSelectMenuBuilder) {
            label.setMentionableSelectMenuComponent(selectMenu);
        } else if (selectMenu instanceof UserSelectMenuBuilder) {
            label.setUserSelectMenuComponent(selectMenu);
        }
        return new ModalBuilder()
            .setCustomId(`settings:${category}:${item}`)
            .setTitle(guild.locale('CMD.SETTINGS.MISC.MAIN_MENU.TITLE'))
            .addLabelComponents(label);
    }
}
