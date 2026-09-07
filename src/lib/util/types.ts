import type { QuaverPlayer } from '#src/lib/music';
import type { Queue, Song } from '@lavaclient/plugin-queue';
import type {
    ActionRowBuilder,
    ContainerBuilder,
    MessageActionRowComponentBuilder,
    StageChannel,
    TextChannel,
    VoiceChannel,
} from 'discord.js';

type LavaLyricsLine = {
    timestamp: number;
    duration?: number;
    line: string;
    plugin: object;
};

export type LavaLyricsResponse = {
    sourceName: string;
    provider: string;
    lines: LavaLyricsLine[];
    text?: string;
    plugin: object;
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
    | 'autolyrics'
    | 'autoplay'
    | 'controls'
    | 'dj'
    | 'format'
    | 'language'
    | 'notifyin247'
    | 'pausealone247'
    | 'premium'
    | 'showsourcelabels'
    | 'smartqueue'
    | 'source';

export type SettingsPage = {
    current: string;
    containers: ContainerBuilder[];
    actionRow: ActionRowBuilder;
};

export type JSONResponse<T> = { message?: string } & T;

export type QuaverChannels = TextChannel | VoiceChannel | StageChannel;

export type QuaverSong = Song & {
    requesterTag?: string;
    requesterAvatar?: string;
    id?: string;
    isAd?: boolean;
};

export type QuaverQueue = Queue & {
    channel?: QuaverChannels;
    player: QuaverPlayer;
    current: QuaverSong;
    tracks: QuaverSong[];
};
