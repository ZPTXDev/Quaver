import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

function getAbsoluteFileURL(baseURL: string, path: string[]): URL {
	const __dirname = dirname(fileURLToPath(baseURL));
	return pathToFileURL(resolve(__dirname, ...path));
}

export let settings: {
	token?: string,
	applicationId?: string,
	clientSecret?: string,
	colors?: {
		success?: string,
		neutral?: string,
		warning?: string,
		error?: string,
	},
	defaultLocaleCode?: string,
	managers?: string[],
	database?: {
		protocol?: string,
		path?: string,
	},
	lavalink?: {
		host?: string,
		port?: number,
		password?: string,
		secure?: boolean,
		reconnect?: {
			delay?: number,
			tries?: number,
		}
	},
	features?: {
		stay?: {
			enabled?: boolean,
			whitelist?: boolean,
		},
		spotify?: {
			enabled?: boolean,
			client_id?: string,
			client_secret?: string,
		},
		web?: {
			enabled?: boolean,
			port?: number,
			allowedOrigins?: string[],
			encryptionKey?: string,
			https?: {
				key?: string,
				cert?: string,
			},
		},
	},
} = {};
const path = getAbsoluteFileURL(import.meta.url, ['..', '..', '..', 'settings.json']);
if (!existsSync(path)) {
	process.exit(1);
}
settings = JSON.parse(readFileSync(path).toString());
