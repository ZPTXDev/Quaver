import type { Dirent } from 'node:fs';

export interface ProcessFolderPathOptions {
    isFileConcurrent?: boolean;
    isFolderConcurrent?: boolean;
}

export interface LoadInteractionHandlerMapOptions {
    isFileConcurrent?: boolean;
    isFolderConcurrent?: boolean;
}

export interface LoadEventHandlerOptions {
    isFileConcurrent?: boolean;
    isFolderConcurrent?: boolean;
    listenerPrependedArgs?: unknown[];
}

export type ProcessFileCallback = (
    file: Dirent,
    folderPath: string,
) => void | Promise<void>;

export type ProcessFileOverride = (
    file: Dirent,
    folderPath: string,
) => Promise<void>;
