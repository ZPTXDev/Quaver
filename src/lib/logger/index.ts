import { settings } from '#src/lib/util';
import { addColors, createLogger, format, type Logform, type transport, transports, } from 'winston';
import LokiTransport from 'winston-loki';

addColors({
    verbose: 'blackBG dim bold',
    info: 'greenBG white bold',
    warn: 'yellowBG black bold',
    error: 'redBG white bold',
    verboseMsg: 'dim',
    infoMsg: 'green',
    warnMsg: 'yellow',
    errorMsg: 'red',
    meaningless: 'gray',
});
export const logger = createLogger({
    level: 'verbose',
    format: format.combine(
        format.label({ label: 'Quaver' }),
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
                        info.timestamp as string,
                    );
                    info.label = colorizer.colorize(
                        'meaningless',
                        info.label as string,
                    );
                    info.message = colorizer.colorize(
                        `${info.level}Msg`,
                        info.message as string,
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
                  }) as unknown as transport,
              ]
            : []),
    ],
});
