import {
    buildMessageOptions,
    getGuildLocaleString,
} from '#src/lib/util/util.js';
import type {
    Message,
    MessageCreateOptions } from 'discord.js';
import {
    MessageFlags,
    PermissionsBitField,
} from 'discord.js';

export default {
    name: 'messageCreate',
    once: false,
    async execute(message: Message): Promise<void> {
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
            const opts: MessageCreateOptions = buildMessageOptions(
                await getGuildLocaleString(
                    message.guildId,
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
    },
};
