import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

function getAbsoluteFileURL(baseURL: string, path: string[]): URL {
	const __dirname = dirname(fileURLToPath(baseURL));
	return pathToFileURL(resolve(__dirname, ...path));
}

interface Settings {
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
}

const settingsPath = getAbsoluteFileURL(import.meta.url, ['..', '..', '..', 'settings.js']);
if (!existsSync(settingsPath)) {
	console.log(`Could not find ${settingsPath}.\nMake a copy of settings.example.js, edit the fields as necessary and rename it to settings.js`);
	process.exit(1);
}
export const settings: Settings = await import(settingsPath.toString());
