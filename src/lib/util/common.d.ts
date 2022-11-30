import type {
    Autocomplete,
    Button,
    ChatInputCommand,
    ModalSubmit,
    SelectMenu,
} from '#src/events/interactionCreate.d.js';
import type PlayerHandler from '#src/lib/PlayerHandler.js';
import type ReplyHandler from '#src/lib/ReplyHandler.js';
import type { Queue, Song } from '@lavaclient/queue';
import type {
    ActionRowBuilder,
    AttachmentBuilder,
    AutocompleteInteraction,
    Client,
    Collection,
    EmbedBuilder,
    MessageActionRowComponentBuilder,
    Snowflake,
    TextChannel,
    VoiceChannel,
} from 'discord.js';
import type { Node, Player } from 'lavaclient';

export type SearchStateRecord = {
    pages: { info: Song }[][];
    timeout: ReturnType<typeof setTimeout>;
    selected: Snowflake[];
};

export type SettingsPageOptions = 'language' | 'format';

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

export type QuaverChannels = TextChannel | VoiceChannel;

export type QuaverClient = Client<boolean> & {
    music?: Node;
    commands?: Collection<string, ChatInputCommand>;
    buttons?: Collection<string, Button>;
    selectmenus?: Collection<string, SelectMenu>;
    autocomplete?: Collection<string, Autocomplete>;
    modals?: Collection<string, ModalSubmit>;
};

export type QuaverSong = Song & {
    requesterTag?: string;
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
