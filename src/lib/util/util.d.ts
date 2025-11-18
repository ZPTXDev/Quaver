type ColorTypes = 'success' | 'neutral' | 'warning' | 'error';

export type LocaleCompletionState = {
    completion: number;
    missing: string[];
};

export type LyricsResponse = {
    type: 'text' | 'timed';
    text?: string;
    lines?: { line: string; range: { start: number; end: number } }[];
    track: {
        title?: string;
        author?: string;
        album?: string;
        albumArt?: { url: string; height: number; width: number }[];
        override?: string;
    };
    source?: string;
};

export type LavaLyricsLine = {
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
