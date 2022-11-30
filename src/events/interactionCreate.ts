import ReplyHandler from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { logger, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import type { Check } from '#src/lib/util/constants.js';
import { getFailedChecks } from '#src/lib/util/util.js';
import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';
import { PermissionsBitField } from 'discord.js';
import type {
    Autocomplete,
    Button,
    ChatInputCommand,
    ModalSubmit,
    SelectMenu,
} from './interactionCreate.d.js';

async function handleFailedChecks(
    failedChecks: Check[],
    interaction: QuaverInteraction<
        | ChatInputCommandInteraction
        | ButtonInteraction
        | StringSelectMenuInteraction
        | RoleSelectMenuInteraction
        | ModalSubmitInteraction
    >,
): Promise<void> {
    logger.info({
        message: `[${
            interaction.guildId ? `G ${interaction.guildId} | ` : ''
        }U ${interaction.user.id}] ${
            interaction.isChatInputCommand()
                ? 'Command'
                : interaction.isButton()
                ? 'Button'
                : interaction.isStringSelectMenu() ||
                  interaction.isRoleSelectMenu()
                ? 'Select menu'
                : 'Modal'
        } ${
            interaction.isChatInputCommand()
                ? interaction.commandName
                : interaction.customId
        } failed ${failedChecks.length} check(s)`,
        label: 'Quaver',
    });
    await interaction.replyHandler.locale(failedChecks[0], {
        type: MessageOptionsBuilderType.Error,
    });
}

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
            const failedChecks = getFailedChecks(
                command.checks,
                interaction.guildId,
                interaction.member as GuildMember,
            );
            if (failedChecks.length > 0) {
                return handleFailedChecks(failedChecks, interaction);
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
                        type: MessageOptionsBuilderType.Error,
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
                if (
                    failedPermissions.bot.includes('ViewChannel') ||
                    failedPermissions.bot.includes('SendMessages')
                ) {
                    await interaction.replyHandler.locale(
                        'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.VIEW',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT',
                    {
                        vars: [
                            failedPermissions.bot
                                .map((perm): string => `\`${perm}\``)
                                .join(' '),
                        ],
                        type: MessageOptionsBuilderType.Error,
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
                        { type: MessageOptionsBuilderType.Error },
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
            try {
                return autocomplete.execute(interaction);
            } catch (error) {
                return;
            }
        }
        if (interaction.isButton()) {
            const button = interaction.client.buttons.get(
                interaction.customId.split(':')[0],
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
            const failedChecks = getFailedChecks(
                button.checks,
                interaction.guildId,
                interaction.member as GuildMember,
                interaction,
            );
            if (failedChecks.length > 0) {
                return handleFailedChecks(failedChecks, interaction);
            }
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
                        { type: MessageOptionsBuilderType.Error },
                    );
                }
                return;
            }
        }
        if (
            interaction.isStringSelectMenu() ||
            interaction.isRoleSelectMenu()
        ) {
            const selectmenu = interaction.client.selectmenus.get(
                interaction.customId.split(':')[0],
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
            const failedChecks = getFailedChecks(
                selectmenu.checks,
                interaction.guildId,
                interaction.member as GuildMember,
                interaction,
            );
            if (failedChecks.length > 0) {
                return handleFailedChecks(failedChecks, interaction);
            }
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
                        { type: MessageOptionsBuilderType.Error },
                    );
                }
                return;
            }
        }
        if (interaction.isModalSubmit()) {
            const modal = interaction.client.modals.get(
                interaction.customId.split(':')[0],
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
            const failedChecks = getFailedChecks(
                modal.checks,
                interaction.guildId,
                interaction.member as GuildMember,
                interaction,
            );
            if (failedChecks.length > 0) {
                return handleFailedChecks(failedChecks, interaction);
            }
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
                        { type: MessageOptionsBuilderType.Error },
                    );
                }
                return;
            }
        }
    },
};
