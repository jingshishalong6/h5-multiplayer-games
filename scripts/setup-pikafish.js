const fs = require('fs');
const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');
const { path7za } = require('7zip-bin');

const RELEASE_URL = process.env.PIKAFISH_RELEASE_URL ||
  'https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z';
const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(ROOT, '.engine');
const ARCHIVE_PATH = path.join(ENGINE_DIR, 'pikafish.7z');
const EXTRACT_DIR = path.join(ENGINE_DIR, 'pikafish-release');
const PATH_FILE = path.join(ENGINE_DIR, 'pikafish-path.txt');

function download(url, target) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(target);
    https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        file.close();
        fs.rmSync(target, { force: true });
        download(response.headers.location, target).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`download failed: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (error) => {
      file.close();
      reject(error);
    });
  });
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(full);
    return [full];
  });
}

function scoreCandidate(file) {
  const normalized = file.replace(/\\/g, '/').toLowerCase();
  const name = path.basename(normalized);
  if (!name.includes('pikafish')) return -1;
  if (name.endsWith('.exe') || name.endsWith('.dll') || name.endsWith('.txt')) return -1;
  let score = 10;
  if (normalized.includes('linux')) score += 50;
  if (normalized.includes('x86-64') || normalized.includes('x86_64') || normalized.includes('amd64')) score += 20;
  if (normalized.includes('avx2')) score += 8;
  if (normalized.includes('bmi2')) score += 6;
  if (normalized.includes('modern')) score += 4;
  return score;
}

function findEngineBinary() {
  return walkFiles(EXTRACT_DIR)
    .map((file) => ({ file, score: scoreCandidate(file) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.file || '';
}

async function main() {
  if (process.env.SKIP_PIKAFISH_SETUP === '1') {
    console.log('Skipping Pikafish setup.');
    return;
  }
  fs.mkdirSync(ENGINE_DIR, { recursive: true });
  if (fs.existsSync(PATH_FILE) && fs.existsSync(fs.readFileSync(PATH_FILE, 'utf8').trim())) {
    console.log(`Pikafish already prepared: ${fs.readFileSync(PATH_FILE, 'utf8').trim()}`);
    return;
  }

  console.log(`Downloading Pikafish from ${RELEASE_URL}`);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await download(RELEASE_URL, ARCHIVE_PATH);
      break;
    } catch (error) {
      fs.rmSync(ARCHIVE_PATH, { force: true });
      if (attempt === 3) throw error;
      console.warn(`Download attempt ${attempt} failed: ${error.message}. Retrying...`);
    }
  }
  fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });

  const extract = spawnSync(path7za, ['x', ARCHIVE_PATH, `-o${EXTRACT_DIR}`, '-y'], { stdio: 'inherit' });
  if (extract.status !== 0) throw new Error('failed to extract Pikafish archive');

  const binary = findEngineBinary();
  if (!binary) throw new Error('could not find Pikafish Linux executable in archive');
  fs.chmodSync(binary, 0o755);
  fs.writeFileSync(PATH_FILE, binary);
  console.log(`Pikafish prepared: ${binary}`);
}

main().catch((error) => {
  console.warn(`Pikafish setup skipped: ${error.message}`);
});
