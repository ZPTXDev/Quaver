import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import {
    ContentLogicHandler,
    GeneralLogicHandler,
    PlaybackLogicHandler,
    SettingsCategory,
    SettingsRenderer,
} from '#src/lib/settings';
import { Check } from '#src/lib/util';
import { PermissionsBitField } from 'discord.js';

export default new ButtonHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const params = interaction.customId.split(':');
        const category = params[1];
        const item = params[2];
        const missingPermissions = interaction.memberPermissions.missing(
            PermissionsBitField.Flags.ManageGuild,
        );
        if (missingPermissions.length > 0) {
            await interaction.replyHandler.reply(
                guild.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.USER',
                    missingPermissions
                        .map((perm): string => `\`${perm}\``)
                        .join(' '),
                ),
                {
                    type: MessageOptionsBuilderType.Error,
                    force: ForceType.Update,
                },
            );
            return;
        }
        if (!category) {
            await interaction.replyHandler.reply(
                SettingsRenderer.renderMainMenu(guild),
                { force: ForceType.Update },
            );
            return;
        }
        if (!item) {
            await interaction.replyHandler.reply(
                await SettingsRenderer.renderSubMenu(
                    guild,
                    category as SettingsCategory,
                ),
                { force: ForceType.Update },
            );
            return;
        }
        switch (category) {
            case SettingsCategory.General:
                await GeneralLogicHandler.handleButtonPress(
                    guild,
                    interaction,
                    item,
                );
                return;
            case SettingsCategory.Playback:
                await PlaybackLogicHandler.handleButtonPress(
                    guild,
                    interaction,
                    item,
                );
                return;
            case SettingsCategory.Content:
                await ContentLogicHandler.handleButtonPress(
                    guild,
                    interaction,
                    item,
                );
                return;
            default:
                await interaction.replyHandler.reply(
                    guild.locale('DISCORD.GENERIC_ERROR'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
        }
    });
