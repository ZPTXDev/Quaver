import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

type VersionInfo = {
    version: string;
    buildTime?: string;
    official: boolean;
    commit?: string | null;
    dirty?: boolean;
};

let version: VersionInfo = null;

function tryGit(cmd: string): string | null {
    try {
        return execSync(`git ${cmd}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

export async function loadVersion(): Promise<void> {
    const embedded = getAbsoluteFileURL(import.meta.url, [
        '..',
        '..',
        'version.mjs',
    ]);
    if (existsSync(embedded)) {
        const { version: v, buildTime } = await import(embedded.toString());
        version = { version: v, buildTime, official: true };
    }

    let pkgVersion = null;
    try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        pkgVersion = pkg.version;
    } catch {
        pkgVersion = '0.0.0';
    }

    if (version !== null) {
        version.official = version.version === pkgVersion;
        return;
    }

    const insideGit = tryGit('rev-parse --is-inside-work-tree') === 'true';
    if (insideGit) {
        const hash = tryGit('rev-parse --short HEAD');
        const dirty = tryGit('status --porcelain') !== '';

        let ver = `${pkgVersion} (${hash})`;
        if (dirty) ver = `${pkgVersion} (${hash}+dirty)`;

        version = {
            version: ver,
            official: false,
            commit: hash,
            dirty,
        };
        return;
    }

    version = {
        version: `${pkgVersion} (nogit)`,
        official: false,
    };
}

export { version };
