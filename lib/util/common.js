import { createLogger, format, transports } from 'winston';
import { database_uri } from '#settings';
import DataHandler from '#lib/DataHandler.js';

export const data = {
	guild: new DataHandler({ cache: database_uri ?? 'sqlite://database.sqlite', namespace: 'guild' }),
};
export const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.errors({ stack: true }),
		format.timestamp(),
		format.printf(info => `${info.timestamp} [${info.label}] ${info.level.toUpperCase()}: ${info.message}`),
	),
	transports: [
		new transports.Console({
			format: format.combine(
				format(info => {
					info.level = info.level.toUpperCase();
					return info;
				})(),
				format.errors({ stack: true }),
				format.timestamp(),
				format.colorize(),
				format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`),
			),
		}),
		new transports.File({ filename: 'logs/error.log', level: 'error' }),
		new transports.File({ filename: 'logs/log.log' }),
	],
});
