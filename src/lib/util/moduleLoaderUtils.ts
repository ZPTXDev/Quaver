import * as nodeUrl from 'node:url';
import * as nodePath from 'node:path';
import * as nodeUtilTypes from 'node:util/types';
import * as nodeFsPromises from 'node:fs/promises';
import type EventEmitter from 'node:events';
import type {
    ProcessFolderPathOptions,
    LoadInteractionHandlerMapOptions,
    LoadEventHandlerOptions,
    ProcessFileCallback,
    ProcessFileOverride,
} from './moduleLoaderUtils.d.js';
import type { Dirent } from 'node:fs';

const DEFAULT_MODULE_EXPORT_NAME = 'default';

const ARRAY_FIRST_INDEX = 0;

const IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS = ['.js', '.mjs'];

const DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS = {
    isFileConcurrent: true,
    isFolderConcurrent: true,
};

const DEFAULT_LOAD_EVENT_OPTIONS = {
    isFileConcurrent: true,
    isFolderConcurrent: true,
    listenerPrependedArgs: [] as unknown[],
};

const DEFAULT_LOAD_HANDLER_MAPS_OPTIONS = {
    isFileConcurrent: true,
    isFolderConcurrent: true,
};

/**
 * Dynamically imports a module from the given absolute file URL and retrieves a specified export.
 *
 * @param {string} fileUrlHref - The absolute file URL or file path of the module to import.
 * @param {string} [exportName=DEFAULT_MODULE_EXPORT_NAME] - The name of the export to retrieve (default: module's default export).
 * @returns {Promise<any> | undefined} - Resolves to the specified export or `undefined` if it does not exist.
 */
async function getModuleExport(
    fileUrlHref: string,
    exportName: string = DEFAULT_MODULE_EXPORT_NAME,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> | undefined {
    /**
     * There is no need to check if moduleNamespace
     * is undefined or null because it'll always return an empty object
     * if there's nothing to export.
     */
    const moduleNamespace = await import(fileUrlHref);
    return moduleNamespace[exportName];
}

/**
 * Merges user-provided options with default options.
 *
 * This function ensures that any missing properties in `userOptions`
 * are filled in with values from `defaultOptions`. If `userOptions`
 * is undefined, `defaultOptions` is returned as-is.
 *
 * @template T - The type of the options object.
 * @param {Partial<T> | undefined} userOptions - The user-provided options, possibly partial.
 * @param {T} defaultOptions - The default options containing all required properties.
 * @returns {T} - The merged options object.
 */
function getMergedOptions<T>(
    userOptions: Partial<T> | undefined,
    defaultOptions: T,
): T {
    return { ...defaultOptions, ...(userOptions || {}) };
}

/**
 * Merges arguments for an event listener, ensuring prepended arguments
 * appear before emitted arguments.
 *
 * This function is useful when an event listener needs predefined
 * arguments before the event-provided arguments. If no prepended
 * arguments exist, it simply returns the emitted arguments as-is.
 *
 * @param {unknown[]} prependedArgs - Arguments to be prepended.
 * @param {unknown[]} emittedArgs - Arguments emitted by the event.
 * @returns {unknown[]} - The combined array of arguments.
 */
function getMergedListenerArgs(
    prependedArgs: unknown[],
    emittedArgs: unknown[],
): unknown[] {
    if (prependedArgs.length > 0) {
        return [...prependedArgs, ...emittedArgs];
    }
    return emittedArgs;
}

/**
 * Creates an event listener that correctly handles both synchronous
 * and asynchronous execution methods.
 *
 * This function ensures that if `executeMethod` is an async function,
 * the returned listener will also be async. Otherwise, it remains synchronous.
 *
 * It also prepends predefined arguments (`listenerPrependedArgs`) to the
 * arguments emitted when the event is triggered.
 *
 * @param {(...args: unknown[]) => unknown | Promise<unknown>} executeMethod - The method to be executed.
 * @param {unknown[]} listenerPrependedArgs - Arguments to be prepended to emitted event arguments.
 * @returns {(...args: unknown[]) => unknown | Promise<unknown>} - The event listener function.
 */
function getAsyncAwareListener(
    executeMethod: (...args: unknown[]) => unknown | Promise<unknown>,
    listenerPrependedArgs: unknown[],
): (...args: unknown[]) => unknown | Promise<unknown> {
    if (nodeUtilTypes.isAsyncFunction(executeMethod)) {
        async function asyncListener(
            ...listenerEmittedArgs: unknown[]
        ): Promise<unknown> {
            const listenerArgs = getMergedListenerArgs(
                listenerPrependedArgs,
                listenerEmittedArgs,
            );
            return executeMethod(...listenerArgs);
        }
        return asyncListener;
    }
    function syncListener(...listenerEmittedArgs: unknown[]): unknown {
        const listenerArgs = getMergedListenerArgs(
            listenerPrependedArgs,
            listenerEmittedArgs,
        );
        return executeMethod(...listenerArgs);
    }
    return syncListener;
}

/**
 * Executes the provided file processing callback function, handling both synchronous and asynchronous execution.
 *
 * This function ensures that if `processFileCallback` is asynchronous, it is awaited properly.
 * Otherwise, it is executed normally without awaiting to prevent unnecessary promise handling overhead.
 *
 * @param {ProcessFileCallback} processFileCallback - The callback function to process the file.
 * @param {Dirent} file - The file entry to be processed.
 * @param {string} folderPath - The path of the folder containing the file.
 * @param {boolean} isProcessFileCallbackAsync - Indicates whether `processFileCallback` is asynchronous.
 *
 * @returns {Promise<void>} Resolves when the callback has finished execution.
 */
async function executeProcessFileCallback(
    processFileCallback: ProcessFileCallback,
    file: Dirent,
    folderPath: string,
    isProcessFileCallbackAsync: boolean,
): Promise<void> {
    if (isProcessFileCallbackAsync) {
        await processFileCallback(file, folderPath);
        return;
    }
    processFileCallback(file, folderPath);
}

/**
 * Processes files within the given folder paths by executing a callback function on each file.
 *
 * @param {string | string[]} folderPaths - A single folder path or an array of folder paths to process.
 * If an empty array is provided, the function returns immediately.
 *
 * @param {ProcessFileCallback} processFileCallback - A callback function that is invoked for each file found.
 * The function is checked to determine if it is asynchronous
 *
 * @param {ProcessFolderPathOptions} [options] - Optional configuration object to control processing behavior.
 * If not provided, default options are used.
 *
 * @returns {Promise<void>} A promise that resolves when all files within the provided folder paths have been processed.
 *
 * The function supports concurrent processing of files and folders based on the provided options:
 * - `isFileConcurrent`: If `true` and `processFileCallback` is asynchronous, files within a folder are processed concurrently.
 * - `isFolderConcurrent`: If `true`, multiple folders are processed concurrently.
 *
 * Execution flow:
 * 1. Merges user-provided options with defaults.
 * 2. Determines the concurrency settings for files and folders.
 * 3. Iterates through the folder paths, processing each file accordingly.
 * 4. Uses `Promise.all` when concurrency is enabled, otherwise processes sequentially.
 */
export async function processFolderPaths(
    folderPaths: string | string[],
    processFileCallback: ProcessFileCallback,
    options?: ProcessFolderPathOptions,
): Promise<void> {
    const folderPathsCount = folderPaths.length;
    if (folderPathsCount === 0) {
        return;
    }
    const userOptions = getMergedOptions(
        options,
        DEFAULT_PROCESS_FOLDER_PATHS_OPTIONS,
    );
    const isProcessFileCallbackAsync =
        nodeUtilTypes.isAsyncFunction(processFileCallback);
    async function processFolderPath(folderPath: string): Promise<void> {
        const files = await nodeFsPromises.readdir(folderPath, {
            withFileTypes: true,
        });
        const filesCount = files.length;
        if (filesCount === 0) {
            return;
        }
        if (filesCount === 1) {
            const file = files[ARRAY_FIRST_INDEX];
            if (!file) {
                return;
            }
            await executeProcessFileCallback(
                processFileCallback,
                file,
                folderPath,
                isProcessFileCallbackAsync,
            );
            return;
        }
        if (userOptions.isFileConcurrent && isProcessFileCallbackAsync) {
            await Promise.all(
                files.map(async (file): Promise<void> => {
                    return processFileCallback(file, folderPath);
                }),
            );
            return;
        }
        for (const file of files) {
            await executeProcessFileCallback(
                processFileCallback,
                file,
                folderPath,
                isProcessFileCallbackAsync,
            );
        }
    }
    if (folderPathsCount === 1) {
        const folderPath = folderPaths[ARRAY_FIRST_INDEX];
        if (!folderPath) {
            return;
        }
        await processFolderPath(folderPath);
        return;
    }
    if (typeof folderPaths === 'string') {
        await processFolderPath(folderPaths);
        return;
    }
    if (userOptions.isFolderConcurrent) {
        await Promise.all(folderPaths.map(processFolderPath));
        return;
    }
    for (const folderPath of folderPaths) {
        await processFolderPath(folderPath);
    }
}

/**
 * Loads interaction handler maps by processing files within the given folder paths.
 *
 * @param {string | string[]} folderPaths - A single folder path or an array of folder paths to process.
 * The function iterates through each folder to locate JavaScript module files.
 *
 * @param {Record<string, Map<string, unknown>>} handlerMaps - An object mapping folder names to handler maps.
 * Each folder's name is used as a key to store handlers within the corresponding map.
 *
 * @param {LoadInteractionHandlerMapOptions} [options] - Optional configuration to control concurrency settings.
 * If not provided, default options are used.
 *
 * @param {ProcessFileOverride} [processFileOverride] - Optional function to override the default file processing logic.
 * If provided, this function is called instead of the default `processFile` implementation.
 *
 * @returns {Promise<void>} A promise that resolves when all relevant handler files have been processed and loaded.
 *
 * Execution flow:
 * 1. Merges user-provided options with defaults.
 * 2. Iterates through each folder and processes only importable JavaScript module files.
 * 3. Loads each module, extracts and looks for `data`, `command`, or `name` properties. (DEFAULT BEHAVIOR)
 * 4. Stores the extracted handler in the appropriate `handlerMaps` entry.
 * 5. Uses `processFileOverride` if provided; otherwise, the default processing function is used.
 */
export async function loadInteractionHandlerMaps(
    folderPaths: string | string[],
    handlerMaps: Record<string, Map<string, unknown>>,
    options?: LoadInteractionHandlerMapOptions,
    processFileOverride?: ProcessFileOverride,
): Promise<void> {
    const userOptions = getMergedOptions(
        options,
        DEFAULT_LOAD_HANDLER_MAPS_OPTIONS,
    );
    async function processFile(
        file: Dirent,
        folderPath: string,
    ): Promise<void> {
        const folderName = nodePath.basename(folderPath);
        const handlerMap = handlerMaps[folderName];
        if (!handlerMap) {
            return;
        }
        const fileName = file.name;
        if (
            !file.isFile() ||
            !IMPORTABLE_JAVASCRIPT_MODULE_FILE_EXTENSIONS.some(
                (fileExtension): boolean => fileName.endsWith(fileExtension),
            )
        ) {
            return;
        }
        const filePath = nodePath.join(folderPath, fileName);
        const fileUrlHref = nodeUrl.pathToFileURL(filePath).href;
        const moduleExport = await getModuleExport(fileUrlHref);
        if (!moduleExport) {
            return;
        }
        // data is most widely used. For an alternative reference, "command" is a placeholder to "data" as a property name
        const { data, command, name: handlerName } = moduleExport;
        const handlerData = data || command;
        // Absent handler data implies that the handler may be an autocomplete or a component
        // and that only "name" and "execute" properties are present
        const isAutoCompleteOrComponent = handlerName && !handlerData;
        if (isAutoCompleteOrComponent) {
            handlerMap.set(handlerName, moduleExport);
            return;
        }
        handlerMap.set(handlerData.name, moduleExport);
    }
    const processFileCallback = processFileOverride || processFile;
    await processFolderPaths(folderPaths, processFileCallback, {
        isFileConcurrent: userOptions.isFileConcurrent,
        isFolderConcurrent: userOptions.isFolderConcurrent,
    });
}

/**
 * Loads event handlers from JavaScript files within the specified folder paths and attaches them to an event emitter.
 *
 * @param {string | string[]} folderPaths - A single folder path or an array of folder paths to process.
 * The function iterates through each folder to locate JavaScript event handler modules.
 *
 * @param {EventEmitter} eventEmitterLikeInstance - An eventEmitter or instance with event emitter methods where event handlers will be registered.
 *
 * @param {LoadEventHandlerOptions} [options] - Optional configuration to control concurrency settings.
 * If not provided, default options are used.
 *
 * @param {ProcessFileOverride} [processFileOverride] - Optional function to override the default file processing logic.
 * If provided, this function is used instead of the default `processFile` implementation.
 *
 * @returns {Promise<void>} A promise that resolves when all event handlers have been processed and registered.
 *
 * Execution flow:
 * 1. Merges user-provided options with defaults.
 * 2. Iterates through each folder and processes only `.js` files.
 * 3. Loads each module and extracts the `name`, `execute`, `isOnce`, and `isPrepend` properties. (DEFAULT BEHAVIOR)
 * 4. Registers the extracted event handlers to the event emitter using the appropriate method (`on`, `once`, etc.).
 * 5. Uses `processFileOverride` if provided; otherwise, the default processing function is used.
 */
export async function loadEventHandlers(
    folderPaths: string | string[],
    eventEmitterLikeInstance: EventEmitter,
    options?: LoadEventHandlerOptions,
    processFileOverride?: ProcessFileOverride,
): Promise<void> {
    const userOptions = getMergedOptions(options, DEFAULT_LOAD_EVENT_OPTIONS);
    async function processFile(
        file: Dirent,
        folderPath: string,
    ): Promise<void> {
        const fileName = file.name;
        if (!file.isFile() || !fileName.endsWith('.js')) {
            return;
        }
        const filePath = nodePath.join(folderPath, fileName);
        const fileUrlHref = nodeUrl.pathToFileURL(filePath).href;
        const moduleExport = await getModuleExport(fileUrlHref);
        if (!moduleExport) {
            return;
        }
        const { name, execute, isOnce, isPrepend } = moduleExport;
        const listener = getAsyncAwareListener(
            execute,
            userOptions.listenerPrependedArgs,
        );
        if (isOnce && isPrepend) {
            eventEmitterLikeInstance.prependOnceListener(name, listener);
            return;
        }
        if (isOnce) {
            eventEmitterLikeInstance.once(name, listener);
            return;
        }
        if (isPrepend) {
            eventEmitterLikeInstance.prependListener(name, listener);
            return;
        }
        eventEmitterLikeInstance.on(name, listener);
    }
    const processFileCallback = processFileOverride || processFile;
    await processFolderPaths(folderPaths, processFileCallback, {
        isFileConcurrent: userOptions.isFileConcurrent,
        isFolderConcurrent: userOptions.isFolderConcurrent,
    });
}
