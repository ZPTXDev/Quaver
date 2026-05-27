import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { SettingsRenderer } from '#src/lib/settings';
import { Check, settings } from '#src/lib/util';
import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('settings')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SETTINGS.DESCRIPTION',
                ),
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    )
    .setChecks([Check.GuildOnly])
    .setPermissions({
        user: [PermissionsBitField.Flags.ManageGuild],
        bot: [],
    })
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        await interaction.replyHandler.reply(
            SettingsRenderer.renderMainMenu(guild),
            { ephemeral: true },
        );
    });
