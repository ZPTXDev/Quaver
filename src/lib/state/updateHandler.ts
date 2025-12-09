import type { UpdateHandler } from '#src/lib';

export let updateHandler: UpdateHandler = null;

export function setUpdateHandler(handler: UpdateHandler): void {
    updateHandler = handler;
}
