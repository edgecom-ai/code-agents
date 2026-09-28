import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

// Git's pre-push hook feeds "<local ref> <local sha> <remote ref> <remote sha>"
// per ref, with an all-zero sha for a side that has no such ref yet (or anymore).
const MISSING_REF_SHA = '0'.repeat(40);

function git(arguments_) {
  return execFileSync('git', arguments_, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function parsePushLines(stdin) {
  return stdin
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [, localSha, remoteRef, remoteSha] = line.split(' ');
      return { localSha, remoteRef, remoteSha };
    });
}

function listMergeCommits(range) {
  const output = git(['log', '--merges', '--format=%h %s', ...range]);
  return output ? output.split('\n') : [];
}

function outgoingMergeCommits({ localSha, remoteSha }, remoteName) {
  if (remoteSha !== MISSING_REF_SHA) {
    try {
      return listMergeCommits([`${remoteSha}..${localSha}`]);
    } catch {
      // The remote tip is not fetched locally; fall through to the wide net.
    }
  }

  return listMergeCommits([localSha, '--not', `--remotes=${remoteName}`]);
}

function main() {
  const remoteName = process.argv[2] ?? 'origin';
  const pushes = parsePushLines(readFileSync(0, 'utf8')).filter(
    push => push.localSha !== MISSING_REF_SHA,
  );

  const offenders = pushes.flatMap(push =>
    outgoingMergeCommits(push, remoteName).map(
      commit => `${push.remoteRef}: ${commit}`,
    ),
  );

  if (offenders.length === 0) {
    return;
  }

  console.error('❌ Refusing to push merge commits (rebase-only workflow):');
  for (const offender of offenders) {
    console.error(`   ${offender}`);
  }

  console.error(
    '   Rebase the branch instead:  git rebase origin/main   (see README → Blocked by a rule?)',
  );
  process.exitCode = 1;
}

main();
