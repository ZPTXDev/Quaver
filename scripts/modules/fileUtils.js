import * as nodeUrl from "node:url";
import * as nodePath from "node:path";

function getDirname(moduleAbsoluteFileUrl) {
    const fileName = nodeUrl.fileURLToPath(moduleAbsoluteFileUrl);
    return nodePath.dirname(fileName);
}

export { getDirname };
