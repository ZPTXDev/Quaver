import type { APIUser } from 'discord.js';

export type WebUser = APIUser & {
    manager?: boolean;
};
