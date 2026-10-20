#!/usr/bin/env node
// Merkle-tree repo index for MONSTER MASH: Slingshot Siege.
// Tracks repository state with a SHA-256 Merkle tree.
// Node 18+, no dependencies, ESM.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PURPOSES = {
  '.': 'MONSTER MASH: Slingshot Siege project root',
  'architecture': 'System design, module boundaries, data schemas, and agent workflow',
  'catalogue': 'Four Realms source items (weapons, gear, consumables) for porting',
  'docs': 'Project documentation, design briefs, status, and agent logs',
  'docs/handoff': 'Agent coordination: status board, append-only logs, and task briefs',
  'docs/monster_mash': 'Design briefs, math models, platform reports, and review history',
  'game': 'Phaser 3 + Vite game client (RUN project template)',
  'game/public': 'Static assets, data files, level JSONs, and CDN assets',
  'game/public/cdn-assets': 'Public CDN-hosted image and sprite assets',
  'game/public/data': 'Game balance data: config, content catalog, and authored levels',
  'game/public/data/levels': 'Authored and generated level JSON definitions',
  'game/rundot': 'RUN SDK configuration, textGen, and CLI hook manifests',
  'game/schemas': 'JSON schemas validating config, content, levels, and save files',
  'game/scripts': 'Build scripts, level generator, and data validation tools',
  'game/src': 'TypeScript source code for MONSTER MASH',
  'game/src/art': 'Pixel art generators, palette definitions, textures, and 5x7 font',
  'game/src/audio': 'Audio engine: beat clock synchronization and synthesized SFX',
  'game/src/battle': 'Slingshot physics, combat loop, rules, collision, and camera',
  'game/src/config': 'Game tuning constants and runtime settings merge',
  'game/src/content': 'Content registries: weapons, monsters, artifacts, consumables',
  'game/src/content/artifacts': 'Artifact item registry and active/passive implementations',
  'game/src/content/consumables': 'Consumable battle item registry and implementations',
  'game/src/content/monsters': 'Monster archetypes, behaviors, and stat definitions',
  'game/src/content/weapons': 'Weapon projectiles, stats, and special abilities',
  'game/src/core': 'Typed event bus, state flow, RNG, profile, and save migrations',
  'game/src/data': 'Data loading and typed lookup helpers for content and levels',
  'game/src/debug': 'Test harness, deterministic sweep solver, and dev hooks',
  'game/src/platform': 'Platform abstraction layer and RUN SDK / local mock adapters',
  'game/src/scenes': 'Phaser scenes: Boot, Title, Map, Battle, Loadout, Shop, Results',
  'game/src/ui': 'UI widgets, HUD overlays, coin animations, and buttons',
  'tools': 'Repository maintenance, indexing, and verification tools',
};

export function getRepoRoot() {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitRoot) return path.resolve(gitRoot);
  } catch {}
  return path.resolve(__dirname, '..');
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function readFileNormalized(fullPath) {
  const buf = fs.readFileSync(fullPath);
  // Detect binary: null byte in first 8000 bytes
  const isBinary = buf.subarray(0, 8000).includes(0);
  if (isBinary) {
    return buf;
  }
  // Normalise CRLF to LF for consistent hashes across Windows and Linux
  return Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

export function getTrackedAndUntrackedFiles(repoRoot) {
  const stdout = execSync('git -c core.quotepath=false ls-files -co --exclude-standard', {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const files = [];

  for (const line of lines) {
    const norm = line.replace(/\\/g, '/');
    if (norm === 'MERKLE.json' || norm === 'MERKLE.md') continue;
    const fullPath = path.join(repoRoot, norm);
    try {
      const st = fs.statSync(fullPath);
      if (st.isFile()) {
        files.push(norm);
      }
    } catch {
      // File deleted or missing
    }
  }

  return files.sort();
}

export function buildTree(repoRoot, filePaths) {
  const dirs = new Map();

  dirs.set('', {
    name: '',
    path: '',
    type: 'dir',
    children: [],
  });

  function ensureDir(dirPath) {
    if (dirs.has(dirPath)) return dirs.get(dirPath);
    const parts = dirPath.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureDir(parentPath);
    const dirNode = {
      name,
      path: dirPath,
      type: 'dir',
      children: [],
    };
    dirs.set(dirPath, dirNode);
    parent.children.push(dirNode);
    return dirNode;
  }

  for (const relPath of filePaths) {
    const fullPath = path.join(repoRoot, relPath);
    const normBytes = readFileNormalized(fullPath);
    const leafHash = sha256(normBytes);
    const parts = relPath.split('/');
    const fileName = parts[parts.length - 1];
    const parentDirPath = parts.slice(0, -1).join('/');
    const parent = ensureDir(parentDirPath);

    parent.children.push({
      name: fileName,
      path: relPath,
      type: 'file',
      hash: leafHash,
      size: normBytes.length,
    });
  }

  function hashNode(node) {
    for (const child of node.children) {
      if (child.type === 'dir') {
        hashNode(child);
      }
    }

    node.children.sort((a, b) => a.name.localeCompare(b.name));

    const lines = node.children.map(c => `${c.name}:${c.type}:${c.hash}`);
    lines.sort();
    const payload = lines.length > 0 ? lines.join('\n') + '\n' : '';
    node.hash = sha256(Buffer.from(payload, 'utf8'));
    return node;
  }

  const root = dirs.get('');
  hashNode(root);
  return root;
}

export function countFiles(node) {
  if (node.type === 'file') return 1;
  let count = 0;
  for (const child of node.children || []) {
    count += countFiles(child);
  }
  return count;
}

export function generateMarkdownIndex(rootNode) {
  const rows = [];

  function collectDirs(node) {
    const dirPath = node.path;
    const depth = dirPath === '' ? 0 : dirPath.split('/').length;
    if (depth <= 3) {
      rows.push({
        displayPath: dirPath === '' ? '.' : dirPath,
        rawPath: dirPath,
        hashShort: node.hash.slice(0, 8),
        fileCount: countFiles(node),
        purpose: PURPOSES[dirPath === '' ? '.' : dirPath] || PURPOSES[dirPath] || '-',
      });
    }

    for (const child of node.children || []) {
      if (child.type === 'dir') {
        collectDirs(child);
      }
    }
  }

  collectDirs(rootNode);

  rows.sort((a, b) => {
    if (a.displayPath === '.') return -1;
    if (b.displayPath === '.') return 1;
    return a.displayPath.localeCompare(b.displayPath);
  });

  const lines = [
    '# Merkle Index',
    '',
    `Root hash: \`${rootNode.hash}\``,
    '',
    '| Directory | Hash | Files | Purpose |',
    '|---|---|---|---|',
  ];

  for (const r of rows) {
    lines.push(`| \`${r.displayPath}\` | \`${r.hashShort}\` | ${r.fileCount} | ${r.purpose} |`);
  }

  lines.push('');
  return lines.join('\n');
}

export function flattenTree(node, fileMap = new Map(), dirMap = new Map()) {
  if (node.type === 'file') {
    fileMap.set(node.path, node);
  } else if (node.type === 'dir') {
    dirMap.set(node.path, node);
    for (const child of node.children || []) {
      flattenTree(child, fileMap, dirMap);
    }
  }
  return { fileMap, dirMap };
}

export function compareTrees(sealedRoot, currentRoot) {
  if (sealedRoot.hash === currentRoot.hash) {
    return {
      clean: true,
      changedDirs: [],
      files: [],
      grouped: {},
    };
  }

  const sealed = flattenTree(sealedRoot);
  const current = flattenTree(currentRoot);

  const changedFiles = [];

  // Check current files vs sealed
  for (const [p, curr] of current.fileMap.entries()) {
    const prev = sealed.fileMap.get(p);
    if (!prev) {
      changedFiles.push({ path: p, status: 'added' });
    } else if (prev.hash !== curr.hash) {
      changedFiles.push({ path: p, status: 'modified' });
    }
  }

  // Check removed files
  for (const [p] of sealed.fileMap.entries()) {
    if (!current.fileMap.has(p)) {
      changedFiles.push({ path: p, status: 'removed' });
    }
  }

  changedFiles.sort((a, b) => a.path.localeCompare(b.path));

  // Collect changed directories (excluding empty root string)
  const allDirPaths = new Set([...sealed.dirMap.keys(), ...current.dirMap.keys()]);
  const changedDirs = [];
  for (const d of allDirPaths) {
    if (d === '') continue; // Skip root node itself from subdirs list
    const prevHash = sealed.dirMap.get(d)?.hash;
    const currHash = current.dirMap.get(d)?.hash;
    if (prevHash !== currHash) {
      changedDirs.push(d);
    }
  }
  changedDirs.sort();

  // If only root-level files changed, include '.' so parent dir is clear
  if (changedDirs.length === 0 && changedFiles.length > 0) {
    changedDirs.push('.');
  }

  // Group files by highest changed directory (e.g. game, docs, architecture, or .)
  const grouped = {};
  for (const f of changedFiles) {
    const parts = f.path.split('/');
    const highestDir = parts.length > 1 ? parts[0] : '.';
    f.highestDir = highestDir;
    f.dir = parts.slice(0, -1).join('/') || '.';
    if (!grouped[highestDir]) grouped[highestDir] = [];
    grouped[highestDir].push(f);
  }

  return {
    clean: false,
    changedDirs,
    files: changedFiles,
    grouped,
  };
}

export function formatNodeForJson(node) {
  if (node.type === 'file') {
    return {
      name: node.name,
      path: node.path,
      type: node.type,
      hash: node.hash,
      size: node.size,
    };
  }
  return {
    name: node.name,
    path: node.path,
    type: node.type,
    hash: node.hash,
    children: node.children.map(formatNodeForJson),
  };
}

export function sealCommand(repoRoot) {
  const files = getTrackedAndUntrackedFiles(repoRoot);
  const tree = buildTree(repoRoot, files);

  const jsonPath = path.join(repoRoot, 'MERKLE.json');
  const mdPath = path.join(repoRoot, 'MERKLE.md');

  fs.writeFileSync(jsonPath, JSON.stringify(formatNodeForJson(tree), null, 2) + '\n', 'utf8');
  fs.writeFileSync(mdPath, generateMarkdownIndex(tree), 'utf8');

  console.log(`Sealed repo at ${tree.hash} (${countFiles(tree)} files)`);
  return tree;
}

export function changedCommand(repoRoot, isJson) {
  const jsonPath = path.join(repoRoot, 'MERKLE.json');
  if (!fs.existsSync(jsonPath)) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'MERKLE.json not found' }));
    } else {
      console.error('Error: MERKLE.json not found. Run "node tools/merkle.mjs seal" first.');
    }
    process.exit(1);
  }

  const sealedTree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const currentFiles = getTrackedAndUntrackedFiles(repoRoot);
  const currentTree = buildTree(repoRoot, currentFiles);

  const diff = compareTrees(sealedTree, currentTree);

  if (isJson) {
    console.log(JSON.stringify(diff, null, 2));
    process.exit(0);
  }

  if (diff.clean) {
    console.log('clean');
    process.exit(0);
  }

  console.log('Changed directories:');
  for (const d of diff.changedDirs) {
    console.log(`  ${d}`);
  }
  console.log('');

  console.log('Changed files:');
  for (const [group, files] of Object.entries(diff.grouped)) {
    console.log(`  ${group}:`);
    for (const f of files) {
      console.log(`    ${f.status.padEnd(8)} ${f.path}`);
    }
  }

  process.exit(0);
}

export function verifyCommand(repoRoot) {
  const jsonPath = path.join(repoRoot, 'MERKLE.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Error: MERKLE.json not found. Run "node tools/merkle.mjs seal" first.');
    process.exit(1);
  }

  const sealedTree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const currentFiles = getTrackedAndUntrackedFiles(repoRoot);
  const currentTree = buildTree(repoRoot, currentFiles);

  const diff = compareTrees(sealedTree, currentTree);

  if (diff.clean) {
    console.log('clean');
    process.exit(0);
  }

  console.error('Unsealed changes found:');
  for (const d of diff.changedDirs) {
    console.error(`  dir: ${d}`);
  }
  for (const f of diff.files) {
    console.error(`  file: ${f.status} ${f.path}`);
  }
  process.exit(1);
}

function printUsage() {
  console.log(`Usage:
  node tools/merkle.mjs seal            Write MERKLE.json and MERKLE.md
  node tools/merkle.mjs changed [--json] Compare working tree to sealed MERKLE.json
  node tools/merkle.mjs verify          Exit 1 if working tree differs from MERKLE.json`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const isJson = args.includes('--json');
  const repoRoot = getRepoRoot();

  if (cmd === 'seal') {
    sealCommand(repoRoot);
  } else if (cmd === 'changed') {
    changedCommand(repoRoot, isJson);
  } else if (cmd === 'verify') {
    verifyCommand(repoRoot);
  } else {
    printUsage();
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}
