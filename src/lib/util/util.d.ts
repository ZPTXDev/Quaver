type ColorTypes = 'success' | 'neutral' | 'warning' | 'error';

export type TimeFormats = 's' | 'm' | 'h' | 'd';

export type TimeObject = {
    d: number;
    h: number;
    m: number;
    s: number;
};

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
