import ReplyHandler from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { logger } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import type { Interaction } from 'discord.js';
import { GuildMember, PermissionsBitField } from 'discord.js';
import type {
    Autocomplete,
    Button,
    ChatInputCommand,
    ModalSubmit,
    SelectMenu,
} from './interactionCreate.d.js';

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction: QuaverInteraction<Interaction>): Promise<void> {
        if (!interaction.isAutocomplete()) {
            interaction.replyHandler = new ReplyHandler(interaction);
        }
        if (interaction.isChatInputCommand()) {
            const command: ChatInputCommand = interaction.client.commands.get(
                interaction.commandName,
            );
            if (!command) return;
            logger.info({
                message: `[${
                    interaction.guildId ? `G ${interaction.guildId} | ` : ''
                }U ${interaction.user.id}] Processing command ${
                    interaction.commandName
                }${
                    interaction.options.data.length > 0
                        ? ` ${interaction.options.data
                              .map(
                                  (option): string =>
                                      `${option.name}:${option.value}`,
                              )
                              .join(' ')}`
                        : ''
                }`,
                label: 'Quaver',
            });
            const failedChecks = [];
            for (const check of command.checks) {
                switch (check) {
                    // Only allowed in guild
                    case checks.GUILD_ONLY:
                        if (!interaction.guildId) failedChecks.push(check);
                        break;
                    // Must have an active session
                    case checks.ACTIVE_SESSION: {
                        const player = interaction.client.music.players.get(
                            interaction.guildId,
                        );
                        if (!player) failedChecks.push(check);
                        break;
                    }
                    // Must be in a voice channel
                    case checks.IN_VOICE:
                        if (
                            !(interaction.member instanceof GuildMember) ||
                            !interaction.member?.voice.channelId
                        ) {
                            failedChecks.push(check);
                        }
                        break;
                    // Must be in the same voice channel (will not fail if the bot is not in a voice channel)
                    case checks.IN_SESSION_VOICE: {
                        const player = interaction.client.music.players.get(
                            interaction.guildId,
                        );
                        if (
                            player &&
                            interaction.member instanceof GuildMember &&
                            interaction.member?.voice.channelId !==
                                player.channelId
                        ) {
                            failedChecks.push(check);
                        }
                        break;
                    }
                }
            }
            if (failedChecks.length > 0) {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Command ${
                        interaction.commandName
                    } failed ${failedChecks.length} check(s)`,
                    label: 'Quaver',
                });
                await interaction.replyHandler.locale(failedChecks[0], {
                    type: 'error',
                });
                return;
            }
            const failedPermissions: { user: string[]; bot: string[] } = {
                user: [],
                bot: [],
            };
            if (interaction.guildId) {
                failedPermissions.user = interaction.channel
                    .permissionsFor(interaction.member as GuildMember)
                    .missing(command.permissions.user);
                failedPermissions.bot = interaction.channel
                    .permissionsFor(interaction.client.user.id)
                    .missing([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        ...command.permissions.bot,
                    ]);
            } else {
                failedPermissions.user = new PermissionsBitField(
                    command.permissions.user,
                ).toArray();
                failedPermissions.bot = new PermissionsBitField(
                    command.permissions.bot,
                ).toArray();
            }
            if (failedPermissions.user.length > 0) {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Command ${
                        interaction.commandName
                    } failed ${
                        failedPermissions.user.length
                    } user permission check(s)`,
                    label: 'Quaver',
                });
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.USER',
                    {
                        vars: [
                            failedPermissions.user
                                .map((perm): string => `\`${perm}\``)
                                .join(' '),
                        ],
                        type: 'error',
                    },
                );
                return;
            }
            if (failedPermissions.bot.length > 0) {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Command ${
                        interaction.commandName
                    } failed ${
                        failedPermissions.bot.length
                    } bot permission check(s)`,
                    label: 'Quaver',
                });
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT',
                    {
                        vars: [
                            failedPermissions.bot
                                .map((perm): string => `\`${perm}\``)
                                .join(' '),
                        ],
                        type: 'error',
                    },
                );
                return;
            }
            try {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Executing command ${
                        interaction.commandName
                    }${
                        interaction.options.data.length > 0
                            ? ` ${interaction.options.data
                                  .map(
                                      (option): string =>
                                          `${option.name}:${option.value}`,
                                  )
                                  .join(' ')}`
                            : ''
                    }`,
                    label: 'Quaver',
                });
                return command.execute(interaction);
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `[${
                            interaction.guildId
                                ? `G ${interaction.guildId} | `
                                : ''
                        }U ${
                            interaction.user.id
                        }] Encountered error with command ${
                            interaction.commandName
                        }`,
                        label: 'Quaver',
                    });
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                    await interaction.replyHandler.locale(
                        'DISCORD.GENERIC_ERROR',
                        { type: 'error' },
                    );
                }
                return;
            }
        }
        if (interaction.isAutocomplete()) {
            const autocomplete = interaction.client.autocomplete.get(
                interaction.commandName,
            ) as Autocomplete;
            if (!autocomplete) return;
            return autocomplete.execute(interaction);
        }
        if (interaction.isButton()) {
            const button = interaction.client.buttons.get(
                interaction.customId.split('_')[0],
            ) as Button;
            if (!button) return;
            logger.info({
                message: `[${
                    interaction.guildId ? `G ${interaction.guildId} | ` : ''
                }U ${interaction.user.id}] Processing button ${
                    interaction.customId
                }`,
                label: 'Quaver',
            });
            try {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Executing button ${
                        interaction.customId
                    }`,
                    label: 'Quaver',
                });
                return button.execute(interaction);
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `[${
                            interaction.guildId
                                ? `G ${interaction.guildId} | `
                                : ''
                        }U ${
                            interaction.user.id
                        }] Encountered error with button ${
                            interaction.customId
                        }`,
                        label: 'Quaver',
                    });
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                    await interaction.replyHandler.locale(
                        'DISCORD.GENERIC_ERROR',
                        { type: 'error' },
                    );
                }
                return;
            }
        }
        if (interaction.isSelectMenu()) {
            const selectmenu = interaction.client.selectmenus.get(
                interaction.customId.split('_')[0],
            ) as SelectMenu;
            if (!selectmenu) return;
            logger.info({
                message: `[${
                    interaction.guildId ? `G ${interaction.guildId} | ` : ''
                }U ${interaction.user.id}] Processing select menu ${
                    interaction.customId
                }`,
                label: 'Quaver',
            });
            try {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Executing select menu ${
                        interaction.customId
                    }`,
                    label: 'Quaver',
                });
                return selectmenu.execute(interaction);
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `[${
                            interaction.guildId
                                ? `G ${interaction.guildId} | `
                                : ''
                        }U ${
                            interaction.user.id
                        }] Encountered error with select menu ${
                            interaction.customId
                        }`,
                        label: 'Quaver',
                    });
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                    await interaction.replyHandler.locale(
                        'DISCORD.GENERIC_ERROR',
                        { type: 'error' },
                    );
                }
                return;
            }
        }
        if (interaction.isModalSubmit()) {
            const modal = interaction.client.modals.get(
                interaction.customId.split('_')[0],
            ) as ModalSubmit;
            if (!modal) return;
            logger.info({
                message: `[${
                    interaction.guildId ? `G ${interaction.guildId} | ` : ''
                }U ${interaction.user.id}] Processing modal ${
                    interaction.customId
                }`,
                label: 'Quaver',
            });
            try {
                logger.info({
                    message: `[${
                        interaction.guildId ? `G ${interaction.guildId} | ` : ''
                    }U ${interaction.user.id}] Executing modal ${
                        interaction.customId
                    }`,
                    label: 'Quaver',
                });
                return modal.execute(interaction);
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `[${
                            interaction.guildId
                                ? `G ${interaction.guildId} | `
                                : ''
                        }U ${
                            interaction.user.id
                        }] Encountered error with modal ${
                            interaction.customId
                        }`,
                        label: 'Quaver',
                    });
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                    await interaction.replyHandler.locale(
                        'DISCORD.GENERIC_ERROR',
                        { type: 'error' },
                    );
                }
                return;
            }
        }
    },
};
