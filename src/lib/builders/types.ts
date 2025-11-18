export type AcceptedEventTypes = keyof ClientEvents | string | symbol;

export type ChatInputCommandPermissions = {
    user: bigint[];
    bot: bigint[];
};