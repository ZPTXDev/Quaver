import { Node } from 'lavaclient';
import { QuaverPlayerManager } from '.';
import type { QuaverClient } from './util/common.d.js';

export class QuaverNode extends Node {
    declare readonly client: QuaverClient;
    declare readonly players: QuaverPlayerManager<this>;

    constructor(
        options: ConstructorParameters<typeof Node>[0],
        client: QuaverClient,
    ) {
        super(options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).client = client;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).players = new QuaverPlayerManager(this);
    }
}
