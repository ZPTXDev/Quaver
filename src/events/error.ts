import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/util/common';

export default new EventHandler()
    .setEvent('error')
    .setExecute(function (err): void {
        logger.error({
            message: `${err.message}\n${err.stack}`,
            label: 'Quaver',
        });
    });
