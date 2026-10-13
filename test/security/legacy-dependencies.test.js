'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');

const root = process.env.SECURITY_DEPENDENCIES_BUILD;
const load = (name) => {
  if (root) return require(path.join(root, name.replace('/', '-'), 'package'));
  if (name === 'simple-git') {
    return require('node:module').createRequire(require.resolve('@serverless/dashboard-plugin'))(
      name
    );
  }
  return require(name);
};
const braces = load('braces');
const { sprintf } = load('sprintf-js');
const AWS = load('aws-sdk');

test('brace expansion preserves normal ranges and alternatives', () => {
  assert.deepEqual(braces.expand('src/{a,b}/{1..2}.js'), [
    'src/a/1.js',
    'src/a/2.js',
    'src/b/1.js',
    'src/b/2.js',
  ]);
});

test('deep braces and parentheses fail before recursive expansion', () => {
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
  ]) {
    assert.throws(() => braces(`${open.repeat(2000)}x${close.repeat(2000)}`), {
      name: 'SyntaxError',
      message: 'Brace nesting exceeds 128 levels',
    });
  }
});

test('sprintf preserves the formatting used by YAML and CLI consumers', () => {
  assert.equal(sprintf('%s: %04d %.2f', 'value', 12, 3.14159), 'value: 0012 3.14');
});

test('sprintf rejects oversized width and precision', () => {
  for (const format of ['%10001s', '%.10001f', '%999999999999999999s']) {
    assert.throws(() => sprintf(format, 1), RangeError);
  }
});

test('AWS SDK preserves normal regional and FIPS endpoints', () => {
  for (const region of ['ap-southeast-2', 'us-gov-west-1', 'cn-north-1', 'fips-us-east-1']) {
    const client = new AWS.S3({ region });
    assert.equal(client.endpoint.protocol, 'https:');
  }
});

test('AWS SDK rejects region values that can alter the endpoint host', () => {
  for (const region of ['us-east-1.evil.example', 'us-east-1/attacker', 'us-east-1\n']) {
    assert.throws(() => new AWS.S3({ region }), { code: 'InvalidRegion' });
  }
});

test('simple-git retains the callable CommonJS API and reads repository status', async () => {
  const git = load('simple-git');
  assert.equal(typeof git, 'function');
  const status = await git(path.resolve(__dirname, '../..')).status();
  assert.ok(Array.isArray(status.files));
});

test('simple-git still rejects unsafe Git configuration', async () => {
  const git = load('simple-git');
  await assert.rejects(git().raw(['-c', 'include.path=/tmp/unused-security-config', 'status']));
});

test('download detects ZIP data and extracts through the maintained decompressor', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const http = require('node:http');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addFile('src/handler.js', Buffer.from('exports.handler = async () => "ok";'));
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'qv-download-'));
  const server = http.createServer((_request, response) => response.end(zip.toBuffer()));
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const download = root
      ? require(path.join(root, '@serverless-utils/package/download.js'))
      : require('@serverless/utils/download');
    const url = `http://127.0.0.1:${server.address().port}/artifact`;
    await download(url, folder);
    assert.deepEqual(await fs.readFile(path.join(folder, 'artifact.zip')), zip.toBuffer());
    await download(url, folder, { extract: true });
    assert.equal(
      await fs.readFile(path.join(folder, 'src/handler.js'), 'utf8'),
      'exports.handler = async () => "ok";'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(folder, { recursive: true, force: true });
  }
});
