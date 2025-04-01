import { isAsyncFunction } from 'node:util/types';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { logger, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { getFailedChecks } from '#src/lib/util/util.js';
import { PermissionsBitField } from 'discord.js';
import type {
    AllInteractions,
    CommandInteractions,
    CommandTypeHandler,
    InteractionHandlerMapKeys,
    InteractionHandlerMapsFlat,
    InteractionIdType,
    FailedCommandPermissions,
    DirectMessage,
} from './interactionCreate.d.js';

const CHANNEL_SELECTMENUS_MAP_KEY = 'channelSelectMenus';
const MENTIONABLE_SELECTMENUS_MAP_KEY = 'mentionableSelectMenus';
const ROLE_SELECTMENUS_MAP_KEY = 'roleSelectMenus';
const STRING_SELECTMENUS_MAP_KEY = 'stringSelectMenus';
const USER_SELECTMENUS_MAP_KEY = 'userSelectMenus';
const AUTOCOMPLETES_MAP_KEY = 'autocompletes';
const BUTTONS_MAP_KEY = 'buttons';
const CHATINPUT_COMMANDS_MAP_KEY = 'chatInputCommands';
const MESSAGECONTEXTMENU_COMMANDS_MAP_KEY = 'messageContextMenuCommands';
const USERCONTEXTMENU_COMMANDS_MAP_KEY = 'userContextMenuCommands';
const MODALSUBMITS_MAP_KEY = 'modalSubmits';

const EMPTY_STRING = '';

const INTERACTION_CUSTOM_ID_NAME = 0;
const INTERACTION_CUSTOM_ID_SEPARATOR = ':';

const INTERACTION_COMMAND_ID_TYPE = 'commandName';
const INTERACTION_COMPONENT_ID_TYPE = 'customId';
const INTERACTION_DIRECT_MESSAGE = 'DirectMessage';

/**
 * Checks the required command permissions for the user and bot in a specific guild or direct message context
 * and returns the permissions that are missing for each.
 *
 * This function calculates the missing permissions for the user and bot, either from the interaction
 * channel in a guild or from a direct message context. If the interaction occurs in a guild, it checks
 * the permissions for the user and bot within the specific channel and returns the missing permissions.
 * In the case of a direct message, it simply returns the permissions that the handler expects the user
 * and bot to have.
 *
 * @param {string | DirectMessage} guildId - The guild ID or 'DirectMessage' for DMs.
 * @param {QuaverInteraction<CommandInteractions>} interaction - The interaction object, which contains
 * the channel and member information required to check permissions.
 * @param {CommandTypeHandler} interactionHandler - The handler that contains the permissions required
 * for both the user and the bot.
 *
 * @returns {FailedCommandPermissions} An object containing two arrays:
 * - `user`: The permissions that the user is missing in the current context.
 * - `bot`: The permissions that the bot is missing in the current context.
 */
function getFailedCommandPermissions(
    guildId: string | null,
    interaction: QuaverInteraction<CommandInteractions>,
    interactionHandler: CommandTypeHandler,
): FailedCommandPermissions {
    const handlerPermissions = interactionHandler.permissions;
    const handlerUserPermissions = handlerPermissions.user;
    const handlerBotPermissions = handlerPermissions.bot;
    if (guildId !== INTERACTION_DIRECT_MESSAGE) {
        const interactionChannel = interaction.channel;
        return {
            user: interactionChannel
                .permissionsFor(interaction.member)
                .missing(handlerUserPermissions),
            bot: interactionChannel
                .permissionsFor(interaction.client.user.id)
                .missing([
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    ...handlerBotPermissions,
                ]),
        };
    }
    return {
        user: new PermissionsBitField(handlerUserPermissions).toArray(),
        bot: new PermissionsBitField(handlerBotPermissions).toArray(),
    };
}

/**
 * Handles a command interaction, extracts user and bot permissions from the interaction handler and checks for necessary permissions.
 *
 * @param {QuaverInteraction<CommandInteractions>} interaction - The command interaction to check.
 * @param {CommandTypeHandler} interactionHandler - The handler containing permission requirements.
 * @param {string} mapKey - A key used to map commands for logging.
 * @param {string} id - The unique identifier of the command.
 * @param {string} idType - The type of identifer of the command.
 * @param {string | DirectMessage} guildId - The guild ID or 'DirectMessage' for DMs.
 * @param {string} userId - The user ID of the command executor.
 * @returns {Promise<boolean>} Resolves to `true` if the command is permitted to proceed, `false` if permissions fail.
 */
async function isCommandPermitted(
    interaction: QuaverInteraction<CommandInteractions>,
    interactionHandler: CommandTypeHandler,
    mapKey: string,
    id: string,
    idType: string,
    guildId: string | DirectMessage,
    userId: string,
): Promise<boolean> {
    const replyHandler = interaction.replyHandler;
    const failedPermissions = getFailedCommandPermissions(
        guildId,
        interaction,
        interactionHandler,
    );
    const failedUserPermissions = failedPermissions.user;
    const failedUserPermsCount = failedUserPermissions.length;
    if (failedUserPermsCount > 0) {
        logger.info({
            message: `[G ${guildId} | U ${userId}] ${mapKey} ${idType}: ${
                id
            } failed ${failedUserPermsCount} user permission check(s)`,
            label: 'Quaver',
        });
        await replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.USER', {
            vars: [
                failedPermissions.user
                    .map((perm): string => `\`${perm}\``)
                    .join(' '),
            ],
            type: MessageOptionsBuilderType.Error,
        });
        return false;
    }
    const failedBotPermissions = failedPermissions.bot;
    const failedBotPermsCount = failedBotPermissions.length;
    if (failedBotPermsCount > 0) {
        logger.info({
            message: `[G ${guildId} | U ${userId}] ${mapKey} ${idType}: ${
                id
            } failed ${failedBotPermsCount} bot permission check(s)`,
            label: 'Quaver',
        });
        if (
            failedBotPermissions.includes('ViewChannel') ||
            failedBotPermissions.includes('SendMessages')
        ) {
            await replyHandler.locale(
                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.VIEW',
                {
                    type: MessageOptionsBuilderType.Error,
                },
            );
            return false;
        }
        await replyHandler.locale(
            'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT',
            {
                vars: [
                    failedBotPermissions
                        .map((perm): string => `\`${perm}\``)
                        .join(' '),
                ],
                type: MessageOptionsBuilderType.Error,
            },
        );
        return false;
    }
    return true;
}

/**
 * Formats the command options from an interaction into a string.

 * @param {QuaverInteraction<AllInteractions>} interaction - The interaction to extract options from.
 * @returns {string} A formatted string of command options, or an empty string if the interaction is not a command or has no options.
 */
function getFormattedCommandOptions(
    interaction: QuaverInteraction<AllInteractions>,
): string {
    // To make TypeScript happy without having to extend lots of types or overloads, do not provide boolean parameters in this function
    // We do not reuse the booleans from the caller and instead invoke Discord.js' properly typed boolean methods to ensure that TypeScript excludes the correct types in this context
    const hasCommandName =
        interaction.isCommand() || interaction.isAutocomplete();
    if (!hasCommandName) {
        return EMPTY_STRING;
    }
    const optionsData = interaction.options.data;
    if (optionsData.length < 1) {
        return EMPTY_STRING;
    }
    return ` ${optionsData
        .map((option): string => `${option.name}: ${option.value}`)
        .join(' ')}`;
}

/**
 * Determines the interaction ID type based on whether it is a command.
 *
 * @param {boolean} hasCommandName - Indicates if the interaction has a command name.
 * @returns {InteractionIdType} The corresponding interaction ID type.
 */
function getInteractionIdType(hasCommandName: boolean): InteractionIdType {
    if (hasCommandName) {
        return INTERACTION_COMMAND_ID_TYPE;
    }
    return INTERACTION_COMPONENT_ID_TYPE;
}

/**
 * Retrieves the interaction ID based on the interaction type.
 *
 * @param {QuaverInteraction<AllInteractions>} interaction - The interaction to extract the ID from.
 * @returns {string} The command name if the interaction is a command, otherwise the parsed custom ID which is the name of the customId.
 */
function getInteractionId(
    interaction: QuaverInteraction<AllInteractions>,
): string {
    // To make TypeScript happy without having to extend lots of types or overloads, do not provide boolean parameters in this function
    // We do not reuse the booleans from the caller and instead invoke Discord.js' properly typed boolean methods to ensure that TypeScript excludes the correct types in this context
    const hasCommandName =
        interaction.isCommand() || interaction.isAutocomplete();
    if (hasCommandName) {
        return interaction.commandName;
    }
    return interaction.customId.split(INTERACTION_CUSTOM_ID_SEPARATOR)[
        INTERACTION_CUSTOM_ID_NAME
    ];
}

/**
 * Creates and assigns a `ReplyHandler` for the given interaction and prevents `ReplyHandler` from being instantiated for autocomplete interactions.
 *
 * @param {QuaverInteraction<AllInteractions>} interaction - The interaction to attach a reply handler to.
 * @returns {ReplyHandler | void} The created `ReplyHandler`, or `void` if the interaction is an autocomplete.
 */
function createReplyHandler(
    interaction: QuaverInteraction<AllInteractions>,
): ReplyHandler | void {
    // To make TypeScript happy without having to extend lots of types or overloads, do not provide boolean parameters in this function
    // We do not reuse the booleans from the caller and instead invoke Discord.js' properly typed boolean methods to ensure that TypeScript excludes the correct types in this context
    // To prevent ReplyHandler from handling autocomplete, do not instantiate ReplyHandler when it is an autocomplete
    if (interaction.isAutocomplete()) {
        return;
    }
    interaction.replyHandler = new ReplyHandler(interaction);
    return interaction.replyHandler;
}

/**
 * Handles the interaction creation and executes the corresponding interaction handler.
 *
 * @param {QuaverInteraction<AllInteractions>} interaction - The interaction created by the user.
 * @param {InteractionHandlerMapsFlat} interactionHandlerMapsFlat - An object that contains all possible maps of interaction handlers.
 * @param {InteractionHandlerMapKeys} mapKey - The possible key used to access the correct interaction handler map.
 * @returns {Promise<void>} Resolves once the interaction handler is executed or an error is handled.
 */
async function onInteractionCreate(
    interaction: QuaverInteraction<AllInteractions>,
    interactionHandlerMapsFlat: InteractionHandlerMapsFlat,
    mapKey: InteractionHandlerMapKeys,
): Promise<void> {
    // To make TypeScript happy without having to extend lots of types or overloads, do not provide boolean parameters in this function
    // We do not reuse the booleans from the caller and instead invoke Discord.js' properly typed boolean methods to ensure that TypeScript excludes the correct types in this context
    const isAutocomplete = interaction.isAutocomplete();
    const hasCommandName = interaction.isCommand() || isAutocomplete;
    const guildId = interaction.guild?.id ?? INTERACTION_DIRECT_MESSAGE;
    const userId = interaction.user.id;
    const idType = getInteractionIdType(hasCommandName);
    const id = getInteractionId(interaction);
    const formattedCommandOptions = getFormattedCommandOptions(interaction);
    logger.info({
        message: `[G ${guildId} | U ${userId}] Processing ${mapKey} ${idType}: ${id}${formattedCommandOptions}`,
        label: 'Quaver',
    });
    const handlerMap = interactionHandlerMapsFlat[mapKey];
    if (!handlerMap) {
        logger.warn({
            message: `[G ${guildId} | U ${userId}] No handler map found for mapKey: ${mapKey}`,
            label: 'Quaver',
        });
        return;
    }
    const interactionHandler = handlerMap.get(id);
    if (!interactionHandler) {
        logger.warn({
            message: `[G ${guildId} | U ${userId}] No ${mapKey} map element found for ${idType}: ${id}`,
            label: 'Quaver',
        });
        return;
    }
    const replyHandler = createReplyHandler(interaction);
    // Since we only do checks for Command and Component type interactions, do not do checks for autocompletes
    if (!isAutocomplete && replyHandler) {
        const componentInteraction = hasCommandName ? undefined : interaction;
        const failedChecks = await getFailedChecks(
            interactionHandler.checks,
            interaction.guildId,
            interaction.member,
            componentInteraction,
        );
        const failedChecksCount = failedChecks.length;
        if (failedChecksCount > 0) {
            logger.info({
                message: `[G ${guildId} | U ${userId}] ${mapKey} ${idType}: ${id} failed ${failedChecksCount} check(s)`,
                label: 'Quaver',
            });
            await replyHandler.locale(failedChecks[0], {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
    }
    // Since autocompletes and components don't need permission checks, only do permission checks for commands only
    if (
        !isAutocomplete &&
        hasCommandName &&
        !(await isCommandPermitted(
            interaction,
            interactionHandler as CommandTypeHandler,
            mapKey,
            id,
            idType,
            guildId,
            userId,
        ))
    ) {
        return;
    }
    const executeMethod = interactionHandler.execute;
    if (!executeMethod || typeof executeMethod !== 'function') {
        logger.warn({
            message: `[G ${guildId} | U ${userId}] No ${mapKey} execute method found for ${idType}: ${id}`,
            label: 'Quaver',
        });
        return;
    }
    try {
        logger.info({
            message: `[G ${guildId} | U ${userId}] Executing ${mapKey} ${idType}: ${id}${formattedCommandOptions}`,
            label: 'Quaver',
        });
        if (isAsyncFunction(executeMethod)) {
            await executeMethod(interaction as never);
            return;
        }
        executeMethod(interaction as never);
    } catch (error) {
        if (!(error instanceof Error)) {
            return;
        }
        logger.error({
            message: `[G ${guildId} | U ${userId}] Encountered error with executing ${mapKey} ${idType}: ${id}`,
            label: 'Quaver',
        });
        logger.error({
            message: `${error.message}\n${error.stack}`,
            label: 'Quaver',
        });
        // Since ReplyHandler is not available with autocomplete interaction, do not send the locale
        if (isAutocomplete || !replyHandler) {
            return;
        }
        await replyHandler.locale('DISCORD.GENERIC_ERROR', {
            type: MessageOptionsBuilderType.Error,
        });
    }
}

export default {
    name: 'interactionCreate',
    once: false,
    async execute(
        interaction: QuaverInteraction<AllInteractions>,
    ): Promise<void> {
        // Since Quaver from the beginning stores interaction handler maps as properties within the DiscordClient, we'll use DiscordClient as the main storage of the interaction handler maps
        // Alternatively, interactionHandler maps can be separated from the DiscordClient entirely if we want to but that would involve exporting and importing that to here
        const interactionHandlerMaps = interaction.client;
        const isAnySelectMenu = interaction.isAnySelectMenu();
        const isCommand = interaction.isCommand();
        // To determine the appropriate key to use for the handler stored from the handler map, we diligently check the type of interaction and hard code a string
        // that reflects that interaction to be used as the key for that handler map
        // With this, Quaver is basically ready to support every type of interaction that Discord.js provides, lessening the need to mess with interactionCreate's listener
        if (isAnySelectMenu && interaction.isChannelSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                CHANNEL_SELECTMENUS_MAP_KEY,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isMentionableSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                MENTIONABLE_SELECTMENUS_MAP_KEY,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isRoleSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                ROLE_SELECTMENUS_MAP_KEY,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isStringSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                STRING_SELECTMENUS_MAP_KEY,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isUserSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                USER_SELECTMENUS_MAP_KEY,
            );
            return;
        }
        if (interaction.isAutocomplete()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                AUTOCOMPLETES_MAP_KEY,
            );
            return;
        }
        if (interaction.isButton()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                BUTTONS_MAP_KEY,
            );
            return;
        }
        if (isCommand && interaction.isChatInputCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                CHATINPUT_COMMANDS_MAP_KEY,
            );
            return;
        }
        const isContextMenuCommand =
            isCommand && interaction.isContextMenuCommand();
        if (isContextMenuCommand && interaction.isMessageContextMenuCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                MESSAGECONTEXTMENU_COMMANDS_MAP_KEY,
            );
            return;
        }
        if (isContextMenuCommand && interaction.isUserContextMenuCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                USERCONTEXTMENU_COMMANDS_MAP_KEY,
            );
            return;
        }
        if (interaction.isModalSubmit()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                MODALSUBMITS_MAP_KEY,
            );
            return;
        }
        throw new Error('Encountered an unhandled interaction.');
    },
};
