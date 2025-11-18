import type { Queue, Song } from '@lavaclient/plugin-queue';
import type {
    ActionRowBuilder,
    AttachmentBuilder,
    AutocompleteInteraction,
    Client,
    ContainerBuilder,
    FileBuilder,
    MediaGalleryBuilder,
    MessageActionRowComponentBuilder,
    SectionBuilder,
    SeparatorBuilder,
    Snowflake,
    StageChannel,
    TextChannel,
    TextDisplayBuilder,
    VoiceChannel,
} from 'discord.js';
import type { Server } from 'socket.io';
import type { InteractionHandlerMapsFlat, ReplyHandler } from '#src/lib';
import type { QuaverNode, QuaverPlayer } from '#src/lib/music';
import type { MessageOptionsBuilderType } from '#src/lib/util/common';

export type SearchStateRecord = {
    pages: Song[][];
    timeout: ReturnType<typeof setTimeout>;
    selected: Snowflake[];
};

export type SettingsPageGenericOptions = {
    components: Array<MessageActionRowComponentBuilder>;
};

export type SettingsPagePremiumOptions = SettingsPageGenericOptions & {
    features: string[];
};

export type SettingsPageFormatOptions = SettingsPageGenericOptions & {
    containers: ContainerBuilder[];
};

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
    containers: ContainerBuilder[];
    actionRow: ActionRowBuilder;
};

type TopLevelComponentBuilders =
    | ActionRowBuilder<MessageActionRowComponentBuilder>
    | SectionBuilder
    | TextDisplayBuilder
    | MediaGalleryBuilder
    | FileBuilder
    | SeparatorBuilder
    | ContainerBuilder;

export type MessageOptionsBuilderInputs =
    | string
    | TopLevelComponentBuilders
    | Array<string | TopLevelComponentBuilders>;

export type MessageOptionsBuilderOptions = {
    type?: MessageOptionsBuilderType;
    components?: Array<TopLevelComponentBuilders>;
    files?: AttachmentBuilder[];
};

export type JSONResponse<T> = { message?: string } & T;

export type QuaverChannels = TextChannel | VoiceChannel | StageChannel;

export type QuaverClient = Client &
    InteractionHandlerMapsFlat & { music?: QuaverNode; io?: Server };

export type QuaverSong = Song & {
    requesterTag?: string;
    requesterAvatar?: string;
};

export type QuaverQueue = Queue & {
    channel?: QuaverChannels;
    player: QuaverPlayer;
    current: QuaverSong;
    tracks: QuaverSong[];
};

export type QuaverInteraction<T> = T extends AutocompleteInteraction
    ? T & { client: QuaverClient }
    : T & { client: QuaverClient; replyHandler: ReplyHandler };
