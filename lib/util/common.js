import { createLogger, format, transports } from 'winston';
import { Collection } from 'discord.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { database } from '#settings';
import DataHandler from '#lib/DataHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const data = {
	guild: new DataHandler({ cache: database ? `${database.protocol}://${resolve(__dirname, '..', '..', database.path)}` : `sqlite://${resolve(__dirname, '..', '..', 'database.sqlite')}`, namespace: 'guild' }),
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
export let locales = new Collection();
export function setLocales(newLocales) {
	locales = newLocales;
}
export const confirmationTimeout = {};
export const searchState = {};
