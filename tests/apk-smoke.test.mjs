import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('APK game data and official map resources are present', () => {
  const stages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stages.json'), 'utf8'));
  assert.ok(stages.act1autochess_m01);
  assert.deepEqual(stages.act1autochess_m01.size, [19, 21]);
  assert.ok(stages.act1autochess_m01.rows.length >= 19);

  const required = [
    'public/assets/local/map/autochesssand/TX_AutochessSand_A.png',
    'public/assets/local/map/autochess/TX_autochessi_D.png',
    'public/assets/ui/battle/sprite_direction_ring.png',
    'public/assets/ui/battle/sprite_direction_arrow.png',
    'public/assets/ui/battleUi/attack_range_attack.png',
    'public/assets/ui/battleUi/skill_ready.png',
    'public/assets/spine/enemy'
  ];
  for (const relative of required) assert.ok(fs.existsSync(path.join(ROOT, relative)), relative);
});

test('APK server serves the exact client shell, data, and map assets', async (t) => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  t.after(() => srv.close());
  const html = await fetch(`${srv.url}/`).then(response => {
    assert.equal(response.status, 200);
    return response.text();
  });
  assert.match(html, /卫戍协议/);
  const stages = await fetch(`${srv.url}/data/stages.json`).then(response => {
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.ok(stages.act1autochess_m01);
  const map = await fetch(`${srv.url}/assets/local/map/autochesssand/TX_AutochessSand_A.png`);
  assert.equal(map.status, 200);
  assert.match(map.headers.get('content-type') || '', /image\/png/);
});
