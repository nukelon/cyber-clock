import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CASE_PROFILES,
  caseShell,
  ViewTransition,
  viewPose,
  EXPLOSION_SPACING,
} from '../app/presentation.ts';
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const controls = {
  target: new THREE.Vector3(),
  enableDamping: true,
  update() {},
};
const transition = new ViewTransition(camera, controls);
camera.position.set(0, 0, 13);
transition.start(new THREE.Vector3(0, 0, -13));
for (let i = 0; i < 60; i++) {
  transition.update(1 / 60);
  assert.ok(
    camera.position.distanceTo(controls.target) > 12.99,
    'Front/back travel must stay outside the watch',
  );
}
assert.ok(!transition.active);
assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 0, -13)) < 1e-6);
transition.start(new THREE.Vector3(25, 2, 6), new THREE.Vector3(0, 0, 1.4));
transition.update(0.2);
transition.cancel();
camera.position.set(9, 6, 14);
const manual = camera.position.clone();
for (let i = 0; i < 120; i++) transition.update(1 / 60);
assert.ok(
  camera.position.equals(manual),
  'A manual gesture must permanently cancel the pending camera transition',
);
assert.equal(controls.enableDamping, true);
controls.target.set(2, 1, -1);
camera.position.set(6, 3, 11);
const originalDirection = camera.position
  .clone()
  .sub(controls.target)
  .normalize();
const originalTarget = controls.target.clone();
const originalDistance = camera.position.distanceTo(controls.target);
transition.reframe(1.7);
assert.ok(
  controls.target.equals(originalTarget),
  'Menu resizing must retain the pan target',
);
assert.ok(
  camera.position
    .clone()
    .sub(controls.target)
    .normalize()
    .distanceTo(originalDirection) < 1e-8,
  'Menu resizing must retain the viewing direction',
);
transition.reframe(1 / 1.7);
assert.ok(
  Math.abs(camera.position.distanceTo(controls.target) - originalDistance) <
    1e-8,
  'Hiding and restoring menus must not accumulate zoom drift',
);
const shellMeshes = Object.values(CASE_PROFILES).map(
  (profile) =>
    new THREE.Mesh(caseShell(profile), new THREE.MeshBasicMaterial()),
);
shellMeshes.forEach((m) => m.updateMatrixWorld());
const raycaster = new THREE.Raycaster();
for (let z = -0.575; z < 0.775; z += 0.025) {
  raycaster.set(new THREE.Vector3(3, 0, z), new THREE.Vector3(-1, 0, 0));
  const hits = raycaster.intersectObjects(shellMeshes, false);
  assert.ok(hits.length > 0, `Case must remain closed across z=${z}`);
  assert.ok(
    hits[0].distance < 0.77,
    `Case side must have a continuous outer wall at z=${z}`,
  );
}
shellMeshes.forEach((m) => {
  m.geometry.dispose();
  m.material.dispose();
});
const p = viewPose(1, true),
  direction = p.position.clone().sub(p.target).normalize();
assert.ok(
  Math.abs(direction.x) > Math.abs(direction.z),
  'Exploded preset should present separated layers from the side',
);
assert.ok(
  EXPLOSION_SPACING >= 0.57 * 4,
  'Full separation must exceed the original by at least 4x',
);
for (const aspect of [0.4, 1, 1.8]) {
  const normal = viewPose(aspect),
    expanded = viewPose(aspect, true);
  assert.ok(
    expanded.position.distanceTo(expanded.target) > normal.position.length(),
    'All exploded layers must be framed',
  );
}
console.log(
  'PASS camera handoff, outside-orbit travel, sealed case ray tests, exploded framing',
);
