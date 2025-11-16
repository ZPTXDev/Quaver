import {
    type MessageCreateOptions,
    MessageFlags,
    PermissionsBitField,
} from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { EventHandler } from '#src/lib/builders';
import { buildMessageOptions } from '#src/lib/util/util';

export default new EventHandler()
    .setEvent('messageCreate')
    .setExecute(async function(message): Promise<void> {
        if (
            message.mentions.has(message.client.user.id, {
                ignoreRoles: true,
                ignoreRepliedUser: true,
                ignoreEveryone: true,
            })
        ) {
            if (
                message.inGuild() &&
                message.channel
                    .permissionsFor(message.client.user.id)
                    .missing(PermissionsBitField.Flags.SendMessages).length > 0
            ) {
                return;
            }
            const applicationCommands = message.client.application?.commands;
            if (applicationCommands.cache.size === 0) {
                await applicationCommands.fetch();
            }
            const guild = await QuaverGuild.wrap(message.guild);
            const opts: MessageCreateOptions = buildMessageOptions(
                guild.locale(
                    'CMD.INFO.RESPONSE.MENTION',
                    applicationCommands.cache.find(
                        (command): boolean => command.name === 'info',
                    )?.id ?? '1',
                    applicationCommands.cache.find(
                        (command): boolean => command.name === 'play',
                    )?.id ?? '1',
                    applicationCommands.cache.find(
                        (command): boolean => command.name === 'search',
                    )?.id ?? '1',
                    applicationCommands.cache.find(
                        (command): boolean => command.name === 'settings',
                    )?.id ?? '1',
                ),
            );
            opts.flags = [MessageFlags.IsComponentsV2];
            await message.reply(opts);
        }
    });
