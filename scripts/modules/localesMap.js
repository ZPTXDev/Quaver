import * as nodePath from 'node:path';
import * as nodeUrl from 'node:url';
import * as nodeFsPromises from 'node:fs/promises';
import { getDirname } from './fileUtils.js';
import { Collection } from 'discord.js';

const dirname = getDirname(import.meta.url);

const rootPath = nodePath.join(dirname, '..', '..');
const localesFolderPath = nodePath.join(rootPath, 'locales');

export async function getLocalesMap() {
    const localeFolderNames = await nodeFsPromises.readdir(localesFolderPath);
    const localesMap = new Collection();
    for (const folderName of localeFolderNames) {
        const folderPath = nodePath.join(localesFolderPath, folderName);
        const localeFileNames = await nodeFsPromises.readdir(folderPath);
        const localeProps = {};
        await Promise.all(
            localeFileNames.map(async (fileName) => {
                const filePath = nodePath.join(folderPath, fileName);
                const fileUrlHref = nodeUrl.pathToFileURL(filePath).href;
                try {
                    const categoryProps = await import(fileUrlHref);
                    const categoryName = fileName.split('.')[0].toUpperCase();
                    localeProps[categoryName] = categoryProps.default;
                } catch (error) {
                    console.error(
                        `Failed to load locale file: ${fileUrlHref}\n${error.message}\n${error.stack}`,
                    );
                }
            }),
        );
        console.log(`LOAD DONE: localesProps: ${folderName}`);
        localesMap.set(folderName, localeProps);
    }
    return localesMap;
}
