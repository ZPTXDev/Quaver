import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ModalSubmitHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import {
    GeneralLogicHandler,
    PlaybackLogicHandler,
    SettingsCategory,
} from '#src/lib/settings';
import { PermissionsBitField } from 'discord.js';

export default new ModalSubmitHandler().setExecute(
    async function (interaction): Promise<void> {
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
        switch (category) {
            case SettingsCategory.General:
                await GeneralLogicHandler.handleModalSubmit(
                    guild,
                    interaction,
                    item,
                );
                return;
            case SettingsCategory.Playback:
                await PlaybackLogicHandler.handleModalSubmit(
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
    },
);
