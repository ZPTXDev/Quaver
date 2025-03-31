import type {
    Autocomplete,
    Button,
    ChatInputCommand,
    ModalSubmit,
    SelectMenu,
} from '#src/events/interactionCreate.d.js';
import type PlayerHandler from '#src/lib/PlayerHandler.js';
import type ReplyHandler from '#src/lib/ReplyHandler.js';
import type { Queue, Song } from '@lavaclient/plugin-queue';
import type {
    ActionRowBuilder,
    AttachmentBuilder,
    AutocompleteInteraction,
    Client,
    Collection,
    EmbedBuilder,
    MessageActionRowComponentBuilder,
    Snowflake,
    StageChannel,
    TextChannel,
    VoiceChannel,
} from 'discord.js';
import type { Node, Player } from 'lavaclient';

export type SearchStateRecord = {
    pages: Song[][];
    timeout: ReturnType<typeof setTimeout>;
    selected: Snowflake[];
};

export type WhitelistedFeatures = 'stay' | 'autolyrics' | 'smartqueue';

export type SettingsPageOptions =
    | 'premium'
    | 'language'
    | 'notifyin247'
    | 'format'
    | 'dj'
    | 'source'
    | 'autolyrics'
    | 'smartqueue';

export type SettingsPage = {
    current: string;
    embeds: EmbedBuilder[];
    actionRow: ActionRowBuilder;
};

export type MessageOptionsBuilderInputs =
    | string
    | EmbedBuilder
    | (string | EmbedBuilder)[];

export type MessageOptionsBuilderOptions = {
    type?: MessageOptionsBuilderType;
    components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
    files?: AttachmentBuilder[];
};

export type JSONResponse<T> = { message?: string } & T;

export type QuaverChannels = TextChannel | VoiceChannel | StageChannel;

export type QuaverClient = Client<boolean> & {
    music?: Node;
    chatInputCommands?: Collection<string, ChatInputCommand>;
    buttons?: Collection<string, Button>;
    selectMenus?: Collection<string, SelectMenu>;
    autocompletes?: Collection<string, Autocomplete>;
    modalSubmits?: Collection<string, ModalSubmit>;
};

export type QuaverSong = Song & {
    requesterTag?: string;
    requesterAvatar?: string;
};

export type QuaverPlayer = Player<Node> & {
    timeout?: ReturnType<typeof setTimeout>;
    pauseTimeout?: ReturnType<typeof setTimeout>;
    timeoutEnd?: number;
    queue?: QuaverQueue;
    bassboost?: boolean;
    nightcore?: boolean;
    handler?: PlayerHandler;
    skip?: QuaverPlayerSkipObject;
    failed?: number;
};

export type QuaverQueue = Queue & {
    channel?: QuaverChannels;
    player: QuaverPlayer;
    current: QuaverSong;
};

export type QuaverPlayerSkipObject = {
    required: number;
    users: Snowflake[];
};

export type QuaverInteraction<T> = T extends AutocompleteInteraction
    ? AutocompleteInteraction & {
          client: QuaverClient;
      }
    : T & {
          client: QuaverClient;
          replyHandler: ReplyHandler;
      };
