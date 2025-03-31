import ReplyHandler from '#src/lib/ReplyHandler.js';
import type { QuaverClient } from '#src/lib/util/common.d.js';
import { logger, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { getFailedChecks } from '#src/lib/util/util.js';
import type {
    AnySelectMenuInteraction,
    ChatInputCommandInteraction,
    Collection,
    CommandInteraction,
    GuildMember,
    Interaction,
} from 'discord.js';
import { PermissionsBitField } from 'discord.js';
import type { ChatInputCommand } from './interactionCreate.d.js';
import { isAsyncFunction } from 'node:util/types';

const INTERACTION_CUSTOM_ID_NAME = 0;
const INTERACTION_CUSTOM_ID_SEPARATOR = ':';

async function checkCommandHandlerPermissions(
    interaction: Interaction<'cached'>,
    mapKey: string,
    replyHandler: ReplyHandler,
    interactionHandler: ChatInputCommand,
    commandId: string,
    guildId: string | 'DirectMessage',
    userId: string,
): Promise<boolean | void> {
    const handlerPermissions = interactionHandler.permissions;
    const handlerUserPermissions = handlerPermissions.user;
    const handlerBotPermissions = handlerPermissions.bot;
    const failedPermissions: { user: string[]; bot: string[] } = {
        user: new PermissionsBitField(handlerUserPermissions).toArray(),
        bot: new PermissionsBitField(handlerBotPermissions).toArray(),
    };
    const interactionChannel = interaction.channel;
    if (interaction.guildId) {
        failedPermissions.user = interactionChannel
            .permissionsFor(interaction.member as GuildMember)
            .missing(handlerUserPermissions);
        failedPermissions.bot = interactionChannel
            .permissionsFor(interaction.client.user.id)
            .missing([
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                ...handlerBotPermissions,
            ]);
    }
    const failedUserPermissions = failedPermissions.user;
    const failedUserPermsCount = failedUserPermissions.length;
    if (failedUserPermsCount > 0) {
        logger.info({
            message: `[G ${guildId} | U ${userId}] ${mapKey} ${
                commandId
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
            message: `[G ${guildId} | U ${userId}] ${mapKey} ${
                commandId
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

function getFormattedCommandOptions(
    hasCommandName: boolean,
    interaction: Interaction<'cached'>,
): string {
    const optionsData =
        hasCommandName && (interaction as CommandInteraction).options.data;
    return hasCommandName && optionsData.length > 0
        ? ` ${optionsData
              .map((option): string => `${option.name}:${option.value}`)
              .join(' ')}`
        : '';
}

async function onInteractionCreate(
    interaction: Interaction<'cached'> & { replyHandler: ReplyHandler },
    discordClient: QuaverClient,
    mapKey: string,
    hasCommandName: boolean,
    isAutocomplete: boolean,
): Promise<void> {
    const guildId = interaction.guild?.id ?? 'DirectMessage';
    const userId = interaction.user.id;
    const idType = hasCommandName ? 'commandName' : 'customId';
    const id = hasCommandName
        ? (interaction as ChatInputCommandInteraction).commandName
        : (interaction as AnySelectMenuInteraction).customId.split(
              INTERACTION_CUSTOM_ID_SEPARATOR,
          )[INTERACTION_CUSTOM_ID_NAME];
    const formattedCommandOptions = getFormattedCommandOptions(
        hasCommandName,
        interaction,
    );
    logger.info({
        message: `[G ${guildId} | U ${userId}] Processing ${mapKey} ${idType}: ${id}${formattedCommandOptions}`,
        label: 'Quaver',
    });
    const handlerMap = discordClient[
        mapKey as 'chatInputCommands'
    ] as Collection<string, ChatInputCommand>;
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
    const replyHandler = interaction.replyHandler;
    if (!isAutocomplete) {
        interaction.replyHandler = new ReplyHandler(
            interaction as ChatInputCommandInteraction,
        );
        const failedChecks = await getFailedChecks(
            interactionHandler.checks,
            interaction.guildId,
            interaction.member as GuildMember,
            hasCommandName ? undefined : (interaction as never),
        );
        const failedChecksCount = failedChecks.length;
        if (failedChecksCount > 0) {
            logger.info({
                message: `[G ${guildId} | U ${userId}] ${mapKey} ${id} failed ${failedChecksCount} check(s)`,
                label: 'Quaver',
            });
            await replyHandler.locale(failedChecks[0], {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
    }
    if (!isAutocomplete && hasCommandName) {
        const hasRequiredPermissions = await checkCommandHandlerPermissions(
            interaction,
            mapKey,
            replyHandler,
            interactionHandler,
            id,
            guildId,
            userId,
        );
        if (!hasRequiredPermissions) {
            return;
        }
    }
    try {
        const executeMethod = interactionHandler.execute;
        logger.info({
            message: `[G ${guildId} | U ${userId}] Executing ${mapKey} ${idType}: ${id}${formattedCommandOptions}`,
            label: 'Quaver',
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        isAsyncFunction(executeMethod)
            ? await executeMethod(interaction as never)
            : executeMethod(interaction as never);
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
        if (isAutocomplete) {
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
        interaction: Interaction<'cached'> & { replyHandler: ReplyHandler },
    ): Promise<void> {
        const interactionHandlerMaps = interaction.client as QuaverClient;
        const isAnySelectMenu = interaction.isAnySelectMenu();
        const isAutocomplete = interaction.isAutocomplete();
        const isCommand = interaction.isCommand();
        const hasCommandName = isCommand || isAutocomplete;
        if (isAnySelectMenu && interaction.isChannelSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'channelSelectMenus',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isMentionableSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'mentionableSelectMenus',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isRoleSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'roleSelectMenus',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isStringSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'stringSelectMenus',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isAnySelectMenu && interaction.isUserSelectMenu()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'userSelectMenus',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isAutocomplete) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'autocompletes',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (interaction.isButton()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'buttons',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isCommand && interaction.isChatInputCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'chatInputCommands',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        const isContextMenuCommand =
            isCommand && interaction.isContextMenuCommand();
        if (isContextMenuCommand && interaction.isMessageContextMenuCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'messageContextMenuCommands',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (isContextMenuCommand && interaction.isUserContextMenuCommand()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'userContextMenuCommands',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        if (interaction.isModalSubmit()) {
            await onInteractionCreate(
                interaction,
                interactionHandlerMaps,
                'modalSubmits',
                hasCommandName,
                isAutocomplete,
            );
            return;
        }
        throw new Error('Encountered an unhandled interaction.');
    },
};
