import type {
    QuaverInteraction,
    SettingsPageOptions,
} from '#src/lib/util/common.d.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import type { Language } from '#src/lib/util/constants.js';
import { Check, settingsOptions } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    buildSettingsPage,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    InteractionCallbackResponse,
    Message,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.SETTINGS.DESCRIPTION',
            ),
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    checks: [Check.GuildOnly],
    permissions: {
        user: [PermissionsBitField.Flags.ManageGuild],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const option = settingsOptions[0] as SettingsPageOptions;
        const guildLocaleCode =
            (await data.guild.get<keyof typeof Language>(
                interaction.guild.id,
                'settings.locale',
            )) ?? (settings.defaultLocaleCode as keyof typeof Language);
        const { containers } = await buildSettingsPage(
            interaction,
            guildLocaleCode,
            option,
        );
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
            async (glc, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            getLocaleString(glc, 'DISCORD.INTERACTION.EXPIRED'),
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
            guildLocaleCode,
            msg,
        );
    },
};
