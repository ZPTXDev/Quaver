import type { ForceType } from './ReplyHandler.js';

export type AdditionalBuilderOptions = {
    ephemeral?: boolean;
    fetchReply?: boolean;
    force?: ForceType;
};
