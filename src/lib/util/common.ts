import DataHandler from '#src/lib/DataHandler.js';
import { settings } from '#src/lib/util/settings.js';
import type { Snowflake } from 'discord.js';
import { Collection } from 'discord.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Logform, transport } from 'winston';
import { addColors, createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import type { SearchStateRecord } from './common.d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const data = {
    guild: new DataHandler({
        cache: settings.database
            ? `${settings.database.protocol}://${resolve(
                  __dirname,
                  '..',
                  '..',
                  settings.database.path,
              )}`
            : `sqlite://${resolve(__dirname, '..', '..', 'database.sqlite')}`,
        namespace: 'guild',
    }),
};
addColors({
    verbose: 'blackBG white bold',
    info: 'greenBG white bold',
    warn: 'yellowBG black bold',
    error: 'redBG white bold',
    verboseMsg: 'gray',
    infoMsg: 'green',
    warnMsg: 'yellow',
    errorMsg: 'red',
    meaningless: 'gray',
});
export const logger = createLogger({
    level: 'verbose',
    format: format.combine(
        format.errors({ stack: true }),
        format.timestamp(),
        format.printf(
            (info): string =>
                `${info.timestamp} [${
                    info.label
                }] ${info.level.toUpperCase()}: ${info.message}`,
        ),
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format((info): Logform.TransformableInfo => {
                    const colorizer = format.colorize();
                    info.timestamp = colorizer.colorize(
                        'meaningless',
                        info.timestamp,
                    );
                    info.label = colorizer.colorize('meaningless', info.label);
                    info.message = colorizer.colorize(
                        `${info.level}Msg`,
                        info.message,
                    );
                    info.level = ` ${info.level.toUpperCase()} `;
                    return info;
                })(),
                format.errors({ stack: true }),
                format.timestamp(),
                format.colorize(),
                format.printf(
                    (info): string =>
                        `${info.timestamp} ${info.level} ${info.label} ${info.message}`,
                ),
            ),
        }),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/log.log' }),
        ...(settings.grafanaLogging
            ? [
                  new LokiTransport({
                      host: settings.grafanaLogging.host,
                      labels: { app: settings.grafanaLogging.appName },
                      basicAuth: settings.grafanaLogging.basicAuth,
                      format: format.json(),
                      json: true,
                      replaceTimestamp: true,
                      onConnectionError: (error): void => console.error(error),
                  }) as transport,
              ]
            : []),
    ],
});
export let locales = new Collection();
export function setLocales(newLocales: Collection<string, unknown>): void {
    locales = newLocales;
}
export const confirmationTimeout: Record<
    Snowflake,
    ReturnType<typeof setTimeout>
> = {};
export const searchState: Record<Snowflake, SearchStateRecord> = {};
export enum MessageOptionsBuilderType {
    Success,
    Neutral,
    Warning,
    Error,
}
