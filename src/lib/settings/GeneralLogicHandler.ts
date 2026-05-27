import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { type Initialized, QuaverGuild } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import { checkLocaleCompletion, Language } from '#src/lib/locales';
import { settings } from '#src/lib/util';
import { getAbsoluteFileURL, roundTo } from '@zptxdev/zptx-lib';
import {
    type APISelectMenuOption,
    type ButtonInteraction,
    ComponentType,
    type Guild,
    type ModalSubmitInteraction,
    RoleSelectMenuBuilder,
    type Snowflake,
    StringSelectMenuBuilder,
} from 'discord.js';
import { readdirSync } from 'node:fs';
import { SettingsCategory, SettingsRenderer } from '.';

export class GeneralLogicHandler {
    public static async handleButtonPress(
        guild: QuaverGuild<Initialized> & Guild,
        interaction: QuaverInteraction<ButtonInteraction>,
        item: string,
    ): Promise<void> {
        switch (item) {
            case 'premium': {
                const duration = await guild.features.get<number>('premium');
                await interaction.replyHandler.reply(
                    duration === -1
                        ? guild.locale(
                              'CMD.SETTINGS.MISC.GENERAL.SETTINGS.PREMIUM.STATE.ACTIVE_LIFETIME_MESSAGE',
                          )
                        : guild.locale(
                              'CMD.SETTINGS.MISC.GENERAL.SETTINGS.PREMIUM.STATE.ACTIVE_MESSAGE',
                              Math.floor(duration / 1000).toString(),
                          ),
                    { ephemeral: true },
                );
                return;
            }
            case 'language':
                await interaction.showModal(
                    SettingsRenderer.renderPickerModal(
                        guild,
                        SettingsCategory.General,
                        item,
                        new StringSelectMenuBuilder()
                            .setCustomId('language')
                            .addOptions(
                                readdirSync(
                                    getAbsoluteFileURL(import.meta.url, [
                                        '..',
                                        '..',
                                        '..',
                                        'locales',
                                    ]),
                                ).map(
                                    (
                                        file: keyof typeof Language,
                                    ): APISelectMenuOption => ({
                                        label: `${Language[file] ?? 'Unknown'} (${file})`,
                                        value: file,
                                        default:
                                            file ===
                                            (guild.localeCode as keyof typeof Language),
                                    }),
                                ),
                            ),
                    ),
                );
                return;
            case 'dj': {
                const dj = await guild.settings.get<Snowflake>('dj');
                await interaction.showModal(
                    SettingsRenderer.renderPickerModal(
                        guild,
                        SettingsCategory.General,
                        item,
                        new RoleSelectMenuBuilder()
                            .setCustomId('dj')
                            .setMinValues(0)
                            .setDefaultRoles(dj ? [dj] : [])
                            .setRequired(false),
                    ),
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
            case 'language': {
                const value = interaction.fields.getStringSelectValues(item)[0];
                const localeCompletion = checkLocaleCompletion(value);
                if (localeCompletion === 'LOCALE_MISSING') {
                    await interaction.replyHandler.reply(
                        'That language does not exist.',
                        {
                            type: MessageOptionsBuilderType.Error,
                            ephemeral: true,
                        },
                    );
                    return;
                }
                await guild.settings.set('locale', value);
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        await QuaverGuild.wrap(interaction.guild),
                        SettingsCategory.General,
                    ),
                    { force: ForceType.Update },
                );
                if (localeCompletion.completion !== 100) {
                    await interaction.replyHandler.reply(
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
                        {
                            force: ForceType.FollowUp,
                            type: MessageOptionsBuilderType.Warning,
                            ephemeral: true,
                        },
                    );
                }
                return;
            }
            case 'dj': {
                const value: {
                    values?: string[];
                } = interaction.fields.getField(item, ComponentType.RoleSelect);
                if (value.values?.length > 0) {
                    await guild.settings.set('dj', value.values[0]);
                } else {
                    await guild.settings.unset('dj');
                }
                await interaction.replyHandler.reply(
                    await SettingsRenderer.renderSubMenu(
                        guild,
                        SettingsCategory.General,
                    ),
                    { force: ForceType.Update },
                );
            }
        }
    }
}
