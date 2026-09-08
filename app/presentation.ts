import * as THREE from 'three';

export const EXPLOSION_SPACING = 2.4;

/** One closed cross-section per case component, avoiding stacked floating rings. */
export function caseShell(profile: readonly (readonly [number, number])[]) {
  const points = profile.map(([r, z]) => new THREE.Vector2(r, z));
  points.push(points[0].clone());
  return new THREE.LatheGeometry(points, 192).rotateX(Math.PI / 2);
}

export const CASE_PROFILES = {
  middle: [
    [2.235, -0.48],
    [2.43, -0.48],
    [2.51, -0.3],
    [2.52, 0.2],
    [2.46, 0.43],
    [2.235, 0.43],
  ],
  bezel: [
    [2.235, 0.415],
    [2.455, 0.415],
    [2.39, 0.78],
    [2.3, 0.81],
    [2.245, 0.79],
    [2.245, 0.7],
  ],
  back: [
    [2.19, -0.6],
    [2.4, -0.6],
    [2.46, -0.55],
    [2.455, -0.455],
    [2.235, -0.455],
    [2.19, -0.5],
  ],
} as const;

/** Spherical travel never cuts through the movement or fights OrbitControls. */
export class ViewTransition {
  private motion: {
    from: THREE.Spherical;
    to: THREE.Spherical;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    progress: number;
  } | null = null;
  private camera: THREE.PerspectiveCamera;
  private controls: {
    target: THREE.Vector3;
    enableDamping: boolean;
    update: () => unknown;
  };
  constructor(
    camera: THREE.PerspectiveCamera,
    controls: {
      target: THREE.Vector3;
      enableDamping: boolean;
      update: () => unknown;
    },
  ) {
    this.camera = camera;
    this.controls = controls;
  }
  get active() {
    return this.motion !== null;
  }
  reframe(scale: number) {
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(scale)
      .add(this.controls.target);
    if (this.motion) {
      this.motion.from.radius *= scale;
      this.motion.to.radius *= scale;
    }
  }
  start(position: THREE.Vector3, target = new THREE.Vector3()) {
    this.cancel();
    this.controls.enableDamping = false;
    this.controls.update();
    const from = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    const to = new THREE.Spherical().setFromVector3(
      position.clone().sub(target),
    );
    to.theta =
      from.theta +
      Math.atan2(
        Math.sin(to.theta - from.theta),
        Math.cos(to.theta - from.theta),
      );
    this.motion = {
      from,
      to,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      progress: 0,
    };
  }
  cancel() {
    this.motion = null;
    this.controls.enableDamping = true;
  }
  update(dt: number) {
    const m = this.motion;
    if (!m) return;
    m.progress = Math.min(1, m.progress + Math.max(0, dt) / 0.85);
    const u = m.progress * m.progress * (3 - 2 * m.progress);
    const sphere = new THREE.Spherical(
      THREE.MathUtils.lerp(m.from.radius, m.to.radius, u),
      THREE.MathUtils.lerp(m.from.phi, m.to.phi, u),
      THREE.MathUtils.lerp(m.from.theta, m.to.theta, u),
    );
    this.controls.target.lerpVectors(m.fromTarget, m.toTarget, u);
    this.camera.position.setFromSpherical(sphere).add(this.controls.target);
    if (m.progress === 1) this.cancel();
  }
}

export function viewPose(aspect: number, exploded = false, back = false) {
  const tangent = Math.tan(THREE.MathUtils.degToRad(35 / 2));
  const target = new THREE.Vector3(0, 0, exploded ? 1.4 : 0);
  const direction = exploded
    ? new THREE.Vector3(1, 0.27, 0.8)
    : new THREE.Vector3(
        back ? -0.4 : 0.4,
        back ? -1.3 : -2.1,
        back ? -12.7 : 12.7,
      );
  const distance = exploded
    ? Math.max(25, 7.6 / (tangent * Math.max(0.35, aspect)) + 4)
    : Math.max(12.9, 3.25 / (tangent * Math.max(0.35, aspect)) + 1);
  return {
    target,
    position: direction.normalize().multiplyScalar(distance).add(target),
  };
}

/** Render target pixels are linear HDR; use neutral attenuation, never SDR overlay. */
export const reflectionShader = {
  name: 'NocturneSoftReflection',
  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    opacity: { value: 0.23 },
    texel: { value: new THREE.Vector2(1 / 768, 1 / 768) },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vProjected;
    varying vec2 vFloor;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){
      vProjected=textureMatrix*vec4(position,1.0);
      vFloor=position.xy;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 color;
    uniform float opacity;
    uniform vec2 texel;
    varying vec4 vProjected;
    varying vec2 vFloor;
    #include <logdepthbuf_pars_fragment>
    void main(){
      #include <logdepthbuf_fragment>
      vec2 uv=vProjected.xy/vProjected.w;
      vec4 reflected=texture2D(tDiffuse,uv)*.4;
      reflected+=texture2D(tDiffuse,uv+vec2(texel.x,0.0))*.15;
      reflected+=texture2D(tDiffuse,uv-vec2(texel.x,0.0))*.15;
      reflected+=texture2D(tDiffuse,uv+vec2(0.0,texel.y))*.15;
      reflected+=texture2D(tDiffuse,uv-vec2(0.0,texel.y))*.15;
      float fade=1.0-smoothstep(3.0,9.0,length(vFloor));
      float alpha=clamp(reflected.a,0.0,1.0)*opacity*fade;
      if(alpha<.001) discard;
      vec3 radiance=max(reflected.rgb,vec3(0.0))/max(reflected.a,.001);
      gl_FragColor=vec4(radiance*color*.65,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
