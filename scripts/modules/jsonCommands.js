import * as nodePath from 'node:path';
import * as nodeUrl from 'node:url';
import * as nodeFsPromises from 'node:fs/promises';
import { getDirname } from './fileUtils.js';

const dirname = getDirname(import.meta.url);

const rootPath = nodePath.join(dirname, '..', '..');
const distRootPath = nodePath.join(rootPath, 'dist');
const commandsPath = nodePath.join(distRootPath, 'commands');

const chatInputCommandsPath = nodePath.join(commandsPath, 'chatInputCommands');

async function loadCommandsFromPath(directoryPath) {
    const jsonCommands = [];
    const commandFileNames = await nodeFsPromises.readdir(directoryPath);
    await Promise.all(
        commandFileNames.map(async (fileName) => {
            if (!fileName.endsWith('.js')) {
                return
            }
            const filePath = nodePath.join(directoryPath, fileName);
            const fileUrlHref = nodeUrl.pathToFileURL(filePath).href;
            try {
                const moduleExport = await import(fileUrlHref);
                const { data, command } = moduleExport.default;
                const commandData = data || command;
                jsonCommands.push(commandData.toJSON());
            } catch (error) {
                console.error(`Failed to load command: ${filePath}\n${error.message}\n${error.stack}`);
            }
        }),
    );
    console.log("LOAD DONE: jsonCommands")
    return jsonCommands;
}

const promises = [
    loadCommandsFromPath(
        chatInputCommandsPath,
    ),
];

export async function getJsonCommands() {
    const jsonCommands = await Promise.all(promises);
    return jsonCommands.flat();
}
