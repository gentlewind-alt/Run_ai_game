#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg']);

function isExcluded(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  const base = path.basename(norm);
  const ext = path.extname(norm).toLowerCase();

  // Exclude MERKLE.*
  if (base.startsWith('MERKLE.')) return true;

  // Exclude images
  if (IMAGE_EXTENSIONS.has(ext)) return true;

  // Exclude lock files
  if (base === 'package-lock.json' || base === 'yarn.lock' || base === 'pnpm-lock.yaml') return true;

  // Exclude docs/handoff/shots
  if (norm.startsWith('docs/handoff/shots/') || norm === 'docs/handoff/shots') return true;

  return false;
}

export function calculateAgyShare(sinceSha = null) {
  const gitCmd = sinceSha
    ? `git log ${sinceSha}..HEAD --no-merges --numstat --format="COMMIT\t%h\t%s"`
    : `git log --no-merges --numstat --format="COMMIT\t%h\t%s"`;

  const raw = execSync(gitCmd, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  const lines = raw.split(/\r?\n/);
  const commits = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('COMMIT\t')) {
      if (current) commits.push(current);
      const [, hash, ...subjParts] = line.split('\t');
      const subject = subjParts.join('\t');
      const isAgy = subject.includes('via agy') ||
                    subject.startsWith('tools:') ||
                    subject.startsWith('agy:');
      current = { hash, subject, isAgy, added: 0, filesCount: 0 };
    } else if (current && line.trim()) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const [addedStr, , filePath] = parts;
        if (!isExcluded(filePath)) {
          const added = addedStr === '-' ? 0 : (parseInt(addedStr, 10) || 0);
          current.added += added;
          current.filesCount++;
        }
      }
    }
  }
  if (current) commits.push(current);

  let agyAdded = 0;
  let otherAdded = 0;
  for (const c of commits) {
    if (c.isAgy) agyAdded += c.added;
    else otherAdded += c.added;
  }
  const totalAdded = agyAdded + otherAdded;
  const agyPercent = totalAdded > 0 ? ((agyAdded / totalAdded) * 100).toFixed(1) : '0.0';

  return { commits, agyAdded, otherAdded, totalAdded, agyPercent };
}

function formatReport(title, report) {
  const { commits, agyAdded, otherAdded, totalAdded, agyPercent } = report;

  console.log(`=== ${title} ===\n`);
  console.log(`Total added lines (filtered): ${totalAdded}`);
  console.log(`  Agy added lines:            ${agyAdded} (${agyPercent}%)`);
  console.log(`  Other added lines:          ${otherAdded} (${(100 - parseFloat(agyPercent)).toFixed(1)}%)\n`);

  console.log('Per-commit breakdown:');
  console.log('----------------------------------------------------------------------------------------------------');
  console.log('Hash     Type   Added  Subject');
  console.log('----------------------------------------------------------------------------------------------------');
  for (const c of commits) {
    const type = c.isAgy ? 'agy  ' : 'other';
    const added = String(c.added).padStart(6, ' ');
    const subj = c.subject.length > 70 ? c.subject.slice(0, 67) + '...' : c.subject;
    console.log(`${c.hash.padEnd(7)}  ${type}  ${added}  ${subj}`);
  }
  console.log('----------------------------------------------------------------------------------------------------\n');
  console.log(`Target: 70-80% agy share going forward. Current: ${agyPercent}%\n`);
}

function run() {
  const args = process.argv.slice(2);
  let sinceSha = null;
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    sinceSha = args[sinceIdx + 1];
  }

  if (sinceSha) {
    const report = calculateAgyShare(sinceSha);
    formatReport(`AGY SHARE REPORT (SINCE ${sinceSha})`, report);
  } else {
    const overall = calculateAgyShare();
    formatReport('AGY SHARE REPORT (OVERALL)', overall);
    const sinceGoal = calculateAgyShare('3ce282c');
    formatReport('AGY SHARE REPORT (SINCE GOAL START: 3ce282c)', sinceGoal);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  run();
} else {
  run();
}
