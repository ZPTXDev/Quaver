import type { ForceType } from './ReplyHandler.js';

export type AdditionalBuilderOptions = {
    ephemeral?: boolean;
    force?: ForceType;
    withResponse?: boolean;
};
