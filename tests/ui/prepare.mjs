import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
// Read-only comparison against the user's specified starting revision.
const source=execFileSync('git',['show','8084d35a59f7503bcb51d3faa90489a92e3212e4:src/WorkProgress.tsx'],{encoding:'utf8'});
mkdirSync('../../work',{recursive:true});writeFileSync('../../work/WorkProgress.before.tsx',source);
