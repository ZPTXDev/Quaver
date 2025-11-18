import {
    InteractionCallbackResponse,
    Message,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { confirmationTimeout, logger } from '#src/lib/util/common';
import type { SettingsPageOptions } from '#src/lib/util/common.d';
import { Check, settingsOptions } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import {
    buildMessageOptions,
    buildSettingsPage,
    getLocaleString,
} from '#src/lib/util/util';

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
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const option = settingsOptions[0] as SettingsPageOptions;
        const { containers } = await buildSettingsPage(interaction, option);
        const response = await interaction.replyHandler.reply(containers, {
            withResponse: true,
        });
        if (
            !(
                response instanceof InteractionCallbackResponse ||
                response instanceof Message
            )
        ) {
            return;
        }
        const msg =
            response instanceof InteractionCallbackResponse
                ? response.resource.message
                : response;
        confirmationTimeout[msg.id] = setTimeout(
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
            msg,
        );
    });
