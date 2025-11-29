import {
    MessageOptionsBuilderType,
    type QuaverClient,
    ReplyHandler,
} from '#src/lib';
import {
    type AutocompleteHandler,
    type ButtonHandler,
    type ChatInputCommandHandler,
    EventHandler,
    type ModalSubmitHandler,
    type RoleSelectMenuHandler,
    type StringSelectMenuHandler,
} from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import { getLocaleString } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { settings } from '#src/lib/util';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { Collection } from 'discord.js';
import { readdirSync } from 'node:fs';
import { isAsyncFunction } from 'node:util/types';
import type { AllInteractions, InteractionHandlerMapsFlat } from '.';

enum InteractionType {
    ChannelSelectMenus = 'channelSelectMenus',
    MentionableSelectMenus = 'mentionableSelectMenus',
    RoleSelectMenus = 'roleSelectMenus',
    StringSelectMenus = 'stringSelectMenus',
    UserSelectMenus = 'userSelectMenus',
    Autocompletes = 'autocompletes',
    Buttons = 'buttons',
    ChatInputCommands = 'chatInputCommands',
    MessageContextMenuCommands = 'messageContextMenuCommands',
    UserContextMenuCommands = 'userContextMenuCommands',
    ModalSubmits = 'modalSubmits',
}

export class InteractionHandler {
    readonly client: QuaverClient;
    private readonly handlers: InteractionHandlerMapsFlat;

    constructor(client: QuaverClient) {
        this.client = client;
        this.handlers = {
            autocompletes: new Collection<string, AutocompleteHandler>(),
            buttons: new Collection<string, ButtonHandler>(),
            channelSelectMenus: null,
            chatInputCommands: new Collection<
                string,
                ChatInputCommandHandler
            >(),
            mentionableSelectMenus: null,
            messageContextMenuCommands: null,
            modalSubmits: new Collection<string, ModalSubmitHandler>(),
            roleSelectMenus: new Collection<string, RoleSelectMenuHandler>(),
            stringSelectMenus: new Collection<
                string,
                StringSelectMenuHandler
            >(),
            userContextMenuCommands: null,
            userSelectMenus: null,
        };
    }

    async loadHandlers(
        url: string,
        path: string[],
        type: keyof InteractionHandlerMapsFlat,
    ): Promise<void> {
        const files = readdirSync(getAbsoluteFileURL(url, path)).filter(
            (file): boolean => file.endsWith('.mjs'),
        );
        for await (const file of files) {
            const { default: Handler } = await import(
                getAbsoluteFileURL(url, [...path, file]).toString()
            );
            this.handlers[type].set(file.slice(0, -4), Handler);
        }
    }

    private getInteractionType(
        interaction: QuaverInteraction<AllInteractions>,
    ): InteractionType {
        const isAnySelectMenu = interaction.isAnySelectMenu();
        const isCommand = interaction.isCommand();
        if (isAnySelectMenu && interaction.isChannelSelectMenu()) {
            return InteractionType.ChannelSelectMenus;
        }
        if (isAnySelectMenu && interaction.isMentionableSelectMenu()) {
            return InteractionType.MentionableSelectMenus;
        }
        if (isAnySelectMenu && interaction.isRoleSelectMenu()) {
            return InteractionType.RoleSelectMenus;
        }
        if (isAnySelectMenu && interaction.isStringSelectMenu()) {
            return InteractionType.StringSelectMenus;
        }
        if (isAnySelectMenu && interaction.isUserSelectMenu()) {
            return InteractionType.UserSelectMenus;
        }
        if (interaction.isAutocomplete()) {
            return InteractionType.Autocompletes;
        }
        if (interaction.isButton()) {
            return InteractionType.Buttons;
        }
        if (isCommand && interaction.isChatInputCommand()) {
            return InteractionType.ChatInputCommands;
        }
        const isContextMenuCommand =
            isCommand && interaction.isContextMenuCommand();
        if (isContextMenuCommand && interaction.isMessageContextMenuCommand()) {
            return InteractionType.MessageContextMenuCommands;
        }
        if (isContextMenuCommand && interaction.isUserContextMenuCommand()) {
            return InteractionType.UserContextMenuCommands;
        }
        if (interaction.isModalSubmit()) {
            return InteractionType.ModalSubmits;
        }
        throw new Error('Encountered an unknown interaction type.');
    }

    private log(
        interaction: QuaverInteraction<AllInteractions>,
        message: string,
        level = 'info',
    ): void {
        const type = this.getInteractionType(interaction);
        const friendlyType = `${type.charAt(0).toUpperCase()}${type.slice(1, -1)}`;
        let prefix = '';
        if (interaction.isCommand() || interaction.isAutocomplete()) {
            prefix = `/${interaction.commandName}${
                interaction.options.data.length > 0
                    ? ` ${interaction.options.data
                          .map(
                              (option): string =>
                                  `${option.name}:${option.value}`,
                          )
                          .join(' ')}`
                    : ''
            }`;
        } else {
            prefix = `customId:${interaction.customId.split(':')[0]}`;
        }
        const loggerMethod =
            level === 'info'
                ? logger.info
                : level === 'warn'
                  ? logger.warn
                  : logger.error;
        loggerMethod(
            `[G ${interaction.guild?.id ?? 'DirectMessage'} | U ${interaction.user.id}] ${friendlyType} ${prefix}: ${message}`,
        );
    }

    async handle(
        interaction: QuaverInteraction<AllInteractions>,
    ): Promise<void> {
        const type = this.getInteractionType(interaction);
        // To make TypeScript happy without having to extend lots of types or overloads, do not provide boolean parameters in this function
        // We do not reuse the booleans from the caller and instead invoke Discord.js' properly typed boolean methods to ensure that TypeScript excludes the correct types in this context
        const guild = interaction.guild?.id
            ? await QuaverGuild.wrap(interaction.guild)
            : null;
        this.log(interaction, 'Processing interaction');
        const handlerMap = this.handlers[type];
        if (!handlerMap) {
            this.log(interaction, 'No handler map found', 'warn');
            return;
        }
        const handler = handlerMap.get(
            interaction.isCommand() || interaction.isAutocomplete()
                ? interaction.commandName
                : interaction.customId.split(':')[0],
        );
        if (!handler) {
            this.log(interaction, 'No handler found', 'warn');
            return;
        }
        // Since we only do checks for Command and Component type interactions, do not do checks for autocompletes
        if (!interaction.isAutocomplete()) {
            interaction.replyHandler = new ReplyHandler(interaction);
            const failedChecks = await handler.getFailedChecks(interaction);
            if (failedChecks.length > 0) {
                this.log(
                    interaction,
                    `Failed ${failedChecks.length} check(s)`,
                    'info',
                );
                await interaction.replyHandler.reply(
                    guild
                        ? guild.locale(failedChecks[0])
                        : getLocaleString(
                              settings.defaultLocaleCode,
                              failedChecks[0],
                          ),
                    {
                        type: MessageOptionsBuilderType.Error,
                    },
                );
                return;
            }
            // Since autocompletes and components don't need permission checks, only do permission checks for commands only
            if (
                interaction.isChatInputCommand() &&
                handler.isChatInputCommandHandler()
            ) {
                const check = await handler.handlePermissionsCheck(interaction);
                if (check.type !== 'success') {
                    this.log(
                        interaction,
                        `Failed ${check.count} ${check.type} permission check(s)`,
                        'info',
                    );
                    return;
                }
            }
        }
        try {
            this.log(interaction, 'Executing handler');
            if (isAsyncFunction(handler.execute)) {
                await handler.execute.call(handler, interaction);
                return;
            }
            handler.execute.call(handler, interaction);
        } catch (error) {
            if (!(error instanceof Error)) {
                return;
            }
            this.log(
                interaction,
                'Encountered error while executing handler',
                'error',
            );
            logger.error(`${error.message}\n${error.stack}`);
            // Since ReplyHandler is not available with autocomplete interaction, do not send the locale
            if (interaction.isAutocomplete()) {
                return;
            }
            await interaction.replyHandler.reply(
                guild
                    ? guild.locale('DISCORD.GENERIC_ERROR')
                    : getLocaleString(
                          settings.defaultLocaleCode,
                          'DISCORD.GENERIC_ERROR',
                      ),
                {
                    type: MessageOptionsBuilderType.Error,
                },
            );
        }
    }

    getEventHandler(): EventHandler<'interactionCreate'> {
        return new EventHandler()
            .setEvent('interactionCreate')
            .setExecute(async (interaction): Promise<void> => {
                await this.handle(
                    interaction as QuaverInteraction<AllInteractions>,
                );
            });
    }
}
