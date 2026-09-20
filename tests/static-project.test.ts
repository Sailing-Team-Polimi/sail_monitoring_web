import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
const root = resolve(import.meta.dirname, '..');
function files(folder: string): string[] {
  return readdirSync(folder, {withFileTypes: true}).flatMap(item => item.isDirectory() ? files(join(folder, item.name)) : [join(folder, item.name)]);
}
function caseCorrect(file: string): boolean {
  const parent = dirname(file);
  return readdirSync(parent).includes(relative(parent, file));
}
test('relative TypeScript imports and Angular templates resolve on case-sensitive GitHub runners', () => {
  for (const file of files(join(root, 'src')).filter(file => file.endsWith('.ts'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const dependency = resolve(dirname(file), match[1] + '.ts');
      assert.ok(existsSync(dependency), `${relative(root,file)} imports missing ${match[1]}`);
      assert.ok(caseCorrect(dependency), `${relative(root,file)}: filename case mismatch for ${match[1]}`);
    }
    for (const match of source.matchAll(/['"](\.\/[^'"]+\.(?:html|scss))['"]/g)) {
      assert.ok(existsSync(resolve(dirname(file), match[1])), `${file}: missing template/style ${match[1]}`);
    }
  }
});
test('the standalone app contains no old login API, JWT or backend WebSocket connections', () => {
  for (const file of files(join(root, 'src')).filter(file => /\.(ts|html)$/.test(file))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /pst_auth_token|\/api\/login|new WebSocket\(|localStorage\.|sessionStorage\.|guest2026/, relative(root,file));
  }
});
test('local image assets and the favicon are present in the Angular build inputs', () => {
  assert.doesNotMatch(readFileSync(join(root, 'src/styles.scss'), 'utf8'), /url\(['"]?\/assets\//);
  const config = JSON.parse(readFileSync(join(root, 'angular.json'),'utf8'));
  for (const item of config.projects.FE.architect.build.options.assets) assert.ok(existsSync(join(root,item)), item);
  for (const file of files(join(root, 'src')).filter(file => /\.(ts|html|scss)$/.test(file))) {
    for (const match of readFileSync(file,'utf8').matchAll(/['"](assets\/[^'"\s]+)['"]/g)) {
      assert.ok(existsSync(join(root, 'src', match[1])), `${relative(root,file)} references ${match[1]}`);
    }
  }
});
