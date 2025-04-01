import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    MentionableSelectMenuInteraction,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
    ContextMenuCommandInteraction,
    UserContextMenuCommandInteraction,
    MessageContextMenuCommandInteraction,
    ModalMessageModalSubmitInteraction,
    Collection,
    OmitPartialGroupDMChannel,
    Message,
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    MentionableSelectMenuInteraction,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
    ContextMenuCommandBuilder,
    UserContextMenuCommandInteraction,
    MessageContextMenuCommandInteraction,
    PermissionsBitField,
    PermissionsString,
} from 'discord.js';
import type { AllInteractions } from './interactionTypes.js';
import type { Check } from './lib/util/constants.js';

export type SpecialInteractions = AutocompleteInteraction<'cached'>;

export type CommandInteractions =
    | ChatInputCommandInteraction<'cached'>
    | ContextMenuCommandInteraction<'cached'>
    | MessageContextMenuCommandInteraction<'cached'>
    | UserContextMenuCommandInteraction<'cached'>;

export type ComponentInteractions =
    | ButtonInteraction<'cached'>
    | ChannelSelectMenuInteraction<'cached'>
    | MentionableSelectMenuInteraction<'cached'>
    | MessageComponentInteraction<'cached'>
    | ModalMessageModalSubmitInteraction<'cached'>
    | ModalSubmitInteraction<'cached'>
    | RoleSelectMenuInteraction<'cached'>
    | StringSelectMenuInteraction<'cached'>
    | UserSelectMenuInteraction<'cached'>;

export type NonSpecialInteractions =
    | CommandInteractions
    | ComponentInteractions;

export type AllInteractions =
    | SpecialInteractions
    | CommandInteractions
    | ComponentInteractions;

export type InteractionHandlerExecute = (
    interaction: AllInteractions,
) => void | Promise<void>;

export interface BaseHandler<T> {
    checks?: Check[];
    execute: (data: T) => void | Promise<void>;
}

export interface BaseCommandHandler<T> extends BaseHandler<T> {
    permissions?: { user: PermissionsBitField[]; bot: PermissionsBitField[] };
}

export interface MessageCommandHandler
    extends BaseCommandHandler<OmitPartialGroupDMChannel<Message>> {
    name: string;
}

// AutocompleteInteraction (case-sensitive) has a commandName but is NEITHER a command nor a component-related interaction
export interface AutocompleteHandler
    extends BaseHandler<AutocompleteInteraction> {
    name: string;
}

export interface ButtonHandler extends BaseHandler<ButtonInteraction> {
    name: string;
}

export interface ChannelSelectMenuHandler
    extends BaseHandler<ChannelSelectMenuInteraction> {
    name: string;
}

export interface ChatInputCommandHandler
    extends BaseCommandHandler<ChatInputCommandInteraction> {
    data: SlashCommandBuilder;
}

export interface MentionableSelectMenuHandler
    extends BaseHandler<MentionableSelectMenuInteraction> {
    name: string;
}

export interface MessageContextMenuCommandHandler
    extends BaseCommandHandler<MessageContextMenuCommandInteraction> {
    data: ContextMenuCommandBuilder;
}

export interface ModalSubmitHandler
    extends BaseHandler<ModalSubmitInteraction> {
    name: string;
}

export interface RoleSelectMenuHandler
    extends BaseHandler<RoleSelectMenuInteraction> {
    name: string;
}

export interface StringSelectMenuHandler
    extends BaseHandler<StringSelectMenuInteraction> {
    name: string;
}

export interface UserContextMenuCommandHandler
    extends BaseCommandHandler<UserContextMenuCommandInteraction> {
    data: ContextMenuCommandBuilder;
}

export interface UserSelectMenuHandler
    extends BaseHandler<UserSelectMenuInteraction> {
    name: string;
}

export type AutocompleteTypeHandler = AutocompleteHandler;

export type CommandTypeHandler =
    | ChatInputCommandHandler
    | MessageContextMenuCommandHandler
    | UserContextMenuCommandHandler;

export type ComponentTypeHandler =
    | ButtonHandler
    | ChannelSelectMenuHandler
    | MentionableSelectMenuHandler
    | ModalSubmitHandler
    | RoleSelectMenuHandler
    | StringSelectMenuHandler
    | UserSelectMenuHandler;

export type InteractionHandler =
    | AutocompleteTypeHandler
    | CommandTypeHandler
    | ComponentTypeHandler;

export type AutocompleteHandlerMap = Collection<string, AutocompleteHandler>;

export type ChatInputCommandHandlerMap = Collection<
    string,
    ChatInputCommandHandler
>;
export type MessageContextMenuCommandHandlerMap = Collection<
    string,
    MessageContextMenuCommandHandler
>;
export type UserContextMenuCommandHandlerMap = Collection<
    string,
    UserContextMenuCommandHandler
>;

export type ButtonHandlerMap = Collection<string, ButtonHandler>;
export type ChannelSelectMenuHandlerMap = Collection<
    string,
    ChannelSelectMenuHandler
>;
export type MentionableSelectMenuHandlerMap = Collection<
    string,
    MentionableSelectMenuHandler
>;
export type ModalSubmitHandlerMap = Collection<string, ModalSubmitHandler>;
export type RoleSelectMenuHandlerMap = Collection<
    string,
    RoleSelectMenuHandler
>;
export type StringSelectMenuHandlerMap = Collection<
    string,
    StringSelectMenuHandler
>;
export type UserSelectMenuHandlerMap = Collection<
    string,
    UserSelectMenuHandler
>;

export type CommandHandlerMap =
    | ChatInputCommandHandlerMap
    | MessageContextMenuCommandHandlerMap
    | UserContextMenuCommandHandlerMap;

export type ComponentHandlerMap =
    | ButtonHandlerMap
    | ChannelSelectMenuHandlerMap
    | MentionableSelectMenuHandlerMap
    | ModalSubmitHandlerMap
    | RoleSelectMenuHandlerMap
    | StringSelectMenuHandlerMap
    | UserSelectMenuHandlerMap;

export type InteractionHandlerMap = CommandHandlerMap | ComponentHandlerMap;

export type AutocompleteMapKeys = 'autocompletes';

export type CommandMapKeys =
    | 'chatInputCommands'
    | 'messageContextMenuCommands'
    | 'userContextMenuCommands';

export type ComponentMapKeys =
    | 'buttons'
    | 'channelSelectMenus'
    | 'mentionableSelectMenus'
    | 'modalSubmits'
    | 'roleSelectMenus'
    | 'stringSelectMenus'
    | 'userSelectMenus';

export type InteractionHandlerMapKeys =
    | AutocompleteMapKeys
    | CommandMapKeys
    | ComponentMapKeys;

// Unused but may be used as reference as an organized overview of the types of interactions
export interface InteractionHandlerMapsNonFlat {
    autocompletes?: AutocompleteHandlerMap;
    commands?: {
        chatInputCommands?: ChatInputCommandHandlerMap;
        contextMenuCommands?: {
            messageContextMenuCommands?: MessageContextMenuCommandHandlerMap;
            userContextMenuCommands?: UserContextMenuCommandHandlerMap;
        };
    };
    components?: {
        buttons?: ButtonHandlerMap;
        modalSubmits?: ModalSubmitHandlerMap;
        selectMenus?: {
            channelSelectMenus?: ChannelSelectMenuHandlerMap;
            mentionableSelectMenus?: MentionableSelectMenuHandlerMap;
            roleSelectMenus?: RoleSelectMenuHandlerMap;
            stringSelectMenus?: StringSelectMenuHandlerMap;
            userSelectMenus?: UserSelectMenuHandlerMap;
        };
    };
}

export interface InteractionHandlerMapsFlat {
    autocompletes?: AutocompleteHandlerMap;
    buttons?: ButtonHandlerMap;
    channelSelectMenus?: ChannelSelectMenuHandlerMap;
    chatInputCommands?: ChatInputCommandHandlerMap;
    mentionableSelectMenus?: MentionableSelectMenuHandlerMap;
    messageContextMenuCommands?: MessageContextMenuCommandHandlerMap;
    modalSubmits?: ModalSubmitHandlerMap;
    roleSelectMenus?: RoleSelectMenuHandlerMap;
    stringSelectMenus?: StringSelectMenuHandlerMap;
    userContextMenuCommands?: UserContextMenuCommandHandlerMap;
    userSelectMenus?: UserSelectMenuHandlerMap;
}

export type CommandInteractionId = 'commandName';
export type ComponentInteractionId = 'customId';
export type InteractionIdType = CommandInteractionId | ComponentInteractionId;

export interface FailedPermissions {
    user: PermissionsString[];
    bot: PermissionsString[];
}

/** Message commands is UNSUPPORTED */
export type MessageCommandKeys = 'messageCommands';
export type MessageCommandHandlerMap = Collection<
    string,
    MessageCommandHandler
>;
export interface MessageHandlerMapsFlat {
    [key: string]: MessageCommandHandlerMap;
    messageCommands: MessageCommandHandlerMap;
}
