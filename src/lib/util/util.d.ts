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
