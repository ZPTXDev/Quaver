import type { QuaverClient } from '#src/lib';
import { type ReplyHandler } from '#src/lib';
import type {
    AcceptedEventTypes,
    AutocompleteHandler,
    ButtonHandler,
    ChatInputCommandHandler,
    EventHandler,
    ModalSubmitHandler,
    RoleSelectMenuHandler,
    StringSelectMenuHandler,
} from '#src/lib/builders';
import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    Collection,
    ContextMenuCommandInteraction,
    MentionableSelectMenuInteraction,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    ModalMessageModalSubmitInteraction,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
    UserContextMenuCommandInteraction,
    UserSelectMenuInteraction,
} from 'discord.js';

export type QuaverInteraction<T> = T extends AutocompleteInteraction
    ? T & { client: QuaverClient }
    : T & { client: QuaverClient; replyHandler: ReplyHandler };

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

export type AutocompleteHandlerMap = Collection<string, AutocompleteHandler>;

export type ButtonHandlerMap = Collection<string, ButtonHandler>;

// unimplemented - unused
export type ChannelSelectMenuHandlerMap = null;

export type ChatInputCommandHandlerMap = Collection<
    string,
    ChatInputCommandHandler
>;

export type EventHandlerMap = Collection<
    string,
    EventHandler<AcceptedEventTypes>
>;

// unimplemented - unused
export type MentionableSelectMenuHandlerMap = null;

// unimplemented - unused
export type MessageContextMenuCommandHandlerMap = null;

export type ModalSubmitHandlerMap = Collection<string, ModalSubmitHandler>;

export type RoleSelectMenuHandlerMap = Collection<
    string,
    RoleSelectMenuHandler
>;

export type StringSelectMenuHandlerMap = Collection<
    string,
    StringSelectMenuHandler
>;

// unimplemented - unused
export type UserContextMenuCommandHandlerMap = null;

// unimplemented - unused
export type UserSelectMenuHandlerMap = null;

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
