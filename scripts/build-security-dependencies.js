'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../security-dependencies');
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: true });

for (const item of JSON.parse(fs.readFileSync(path.join(root, 'packages.json')))) {
  const [packed] = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        `${item.upstream}@${item.upstreamVersion}`,
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        output,
      ],
      { encoding: 'utf8' }
    )
  );
  const tarball = path.join(output, packed.filename);
  const integrity = `sha512-${crypto
    .createHash('sha512')
    .update(fs.readFileSync(tarball))
    .digest('base64')}`;
  if (integrity !== item.integrity) throw new Error(`Integrity mismatch for ${item.upstream}`);

  const destination = path.join(output, item.upstream.replace('/', '-'));
  if (fs.existsSync(destination)) throw new Error('Use an empty output directory');
  fs.mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', destination]);
  const directory = path.join(destination, 'package');
  execFileSync('git', ['apply', path.join(root, item.patch)], { cwd: directory });
  const manifestPath = path.join(directory, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.name = item.name;
  manifest.version = item.version;
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest.overrides;
  if (item.upstream === 'aws-sdk') {
    manifest.dependencies.uuid = '^11.1.1';
    fs.rmSync(path.join(directory, 'dist'), { recursive: true, force: true });
  }
  if (item.upstream === 'sprintf-js') manifest.files = ['src', 'LICENSE', 'README.md'];
  if (item.upstream === '@serverless/utils') {
    delete manifest.dependencies.decompress;
    manifest.dependencies['@xhmikosr/decompress'] = '^11.1.4';
    manifest.dependencies['file-type'] = '^22.1.1';
    manifest.dependencies.uuid = '^11.1.1';
  }
  if (item.upstream === 'simple-git') {
    manifest.main = './security-entry.cjs';
    manifest.exports['.'].require = './security-entry.cjs';
    manifest.files.push('security-entry.cjs');
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${item.name}@${item.version}: ${directory}\n`);
}
