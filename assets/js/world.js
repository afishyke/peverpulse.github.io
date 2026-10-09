/** The entire scene is procedural. No model, HDR, image, or audio download required. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HOLDINGS } from "./config.js";

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
function seeded(seed = 4271) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const rng = seeded();

// Deterministic multi-octave value noise, baked once into real surface maps.
function noise(x, y) {
  const hash = (a, b) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  return mix(
    mix(hash(ix, iy), hash(ix + 1, iy), sx),
    mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx),
    sy,
  );
}
function surfaceMaps() {
  const size = 256,
    heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let h = 0,
        amplitude = 0.54;
      for (let octave = 0; octave < 5; octave++) {
        const scale = Math.pow(2, octave) / 26;
        h += noise(x * scale, y * scale) * amplitude;
        amplitude *= 0.5;
      }
      heights[y * size + x] = h;
    }
  const make = (kind) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d"),
      data = context.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x,
          j = i * 4,
          h = heights[i];
        if (kind === "normal") {
          const dx =
            heights[y * size + ((x + 1) % size)] -
            heights[y * size + ((x + size - 1) % size)];
          const dy =
            heights[((y + 1) % size) * size + x] -
            heights[((y + size - 1) % size) * size + x];
          const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize();
          data.data[j] = (n.x + 1) * 127.5;
          data.data[j + 1] = (n.y + 1) * 127.5;
          data.data[j + 2] = (n.z + 1) * 127.5;
        } else {
          const vein = Math.abs(h - 0.49) < 0.014 ? 235 : 0;
          const value =
            kind === "vein"
              ? vein
              : kind === "roughness"
                ? 130 + h * 110
                : 90 + h * 145;
          data.data[j] = data.data[j + 1] = data.data[j + 2] = value;
        }
        data.data[j + 3] = 255;
      }
    context.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace =
      kind === "color" || kind === "vein"
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;
    return texture;
  };
  return {
    color: make("color"),
    normal: make("normal"),
    roughness: make("roughness"),
    vein: make("vein"),
  };
}
function crystalGeometry() {
  const positions = [0, -0.6, 0],
    indices = [],
    sides = 6;
  for (const y of [-0.37, 0.27])
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      positions.push(Math.cos(angle), y, Math.sin(angle));
    }
  positions.push(0, 0.67, 0);
  for (let i = 0; i < sides; i++) {
    const a = 1 + i,
      b = 1 + ((i + 1) % sides),
      c = a + sides,
      d = b + sides;
    indices.push(0, a, b, a, c, b, b, c, d, c, 13, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  const result = geometry.toNonIndexed();
  result.computeVertexNormals();
  // Cylindrical UVs provide actual normal/roughness detail on the planar facets.
  const vertices = result.attributes.position,
    uv = [];
  for (let i = 0; i < vertices.count; i++)
    uv.push(
      Math.atan2(vertices.getZ(i), vertices.getX(i)) / (Math.PI * 2) + 0.5,
      vertices.getY(i) + 0.6,
    );
  result.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.dispose();
  return result;
}

export function createWorld({
  canvas,
  config,
  mobile,
  onInspect,
  onHover,
  onContextLoss,
}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: "high-performance",
    alpha: false,
  });
  let dpr = Math.min(
    devicePixelRatio || 1,
    mobile ? config.quality.mobileDPR : config.quality.desktopDPR,
  );
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(config.colors.dawn.fog, 0.01);
  const camera = new THREE.PerspectiveCamera(
    mobile ? 62 : 48,
    innerWidth / innerHeight,
    0.1,
    440,
  );
  const maps = surfaceMaps();
  const environment = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentTarget.texture;
  environment.dispose();
  pmrem.dispose();
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: config.colors.stone,
    map: maps.color,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: maps.roughness,
    roughness: 0.94,
    flatShading: true,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: config.colors.gold,
    metalness: 0.8,
    roughness: 0.42,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: config.colors.crystal,
    metalness: 0.12,
    roughness: 0.22,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.06, 0.06),
    transmission: mobile ? 0 : 0.22,
    thickness: 2,
    ior: 1.45,
    clearcoat: 1,
    envMapIntensity: 1.7,
    emissive: config.colors.vein,
    emissiveMap: maps.vein,
    emissiveIntensity: 0.13,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: config.colors.vein,
    toneMapped: false,
  });
  const goldGlow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(config.colors.gold).multiplyScalar(2),
    toneMapped: false,
  });
  const crystal = crystalGeometry();
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  const floating = [],
    pickables = [];

  // Sky uses the same day/dusk/night palette as fog and moving key light.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(config.colors.dawn.sky) },
      uHorizon: { value: new THREE.Color(config.colors.dawn.horizon) },
      uSun: { value: new THREE.Vector3(0.5, 0.18, -0.85).normalize() },
    },
    vertexShader:
      "varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 vDirection; uniform vec3 uTop,uHorizon,uSun;
      void main(){ vec3 d=normalize(vDirection); float h=pow(clamp(d.y*.9+.08,0.,1.),.6);
      vec3 c=mix(uHorizon,uTop,h); float sun=pow(max(dot(d,uSun),0.),160.); c+=vec3(1.,.8,.51)*sun*.45;
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 16),
    skyMaterial,
  );
  scene.add(sky);
  const ambient = new THREE.HemisphereLight("#cde6e4", "#253b43", 2);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(config.colors.dawn.light, 3.8);
  key.position.set(25, 38, 20);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -40,
    right: 40,
    top: 40,
    bottom: -40,
    near: 1,
    far: 180,
  });
  key.shadow.bias = -0.001;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#8cddd7", 3);
  rim.position.set(-25, 14, -50);
  scene.add(rim, rim.target);
  const gateLight = new THREE.PointLight("#f2d6aa", 100, 45, 2);
  gateLight.position.set(5, 9, 0);
  scene.add(gateLight);
  const archiveLight = new THREE.PointLight("#8ff5e4", 130, 40, 2);
  archiveLight.position.set(7, 12, -122);
  scene.add(archiveLight);

  // Far silhouettes, midground islands, foreground fragments: genuine 3D parallax.
  const mountains = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 5),
    rockMaterial,
    mobile ? 22 : 42,
  );
  for (let i = 0; i < mountains.count; i++) {
    dummy.position.set(
      (i % 2 ? -1 : 1) * (60 + rng() * 90),
      -18 + rng() * 4,
      15 - rng() * 280,
    );
    dummy.scale.set(17 + rng() * 25, 20 + rng() * 42, 20 + rng() * 35);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mountains);
  const islandPositions = [
    [8, -10, -8],
    [-15, -12, -57],
    [18, -11, -103],
    [-13, -15, -150],
    [38, -18, -47],
    [-42, -20, -110],
  ];
  const islandGeo = new THREE.ConeGeometry(11, 17, 8, 2);
  islandGeo.rotateX(Math.PI);
  const plateauGeo = new THREE.CylinderGeometry(10.9, 9.8, 1.2, 8);
  islandPositions.forEach((position, index) => {
    const island = new THREE.Group();
    island.position.set(...position);
    const base = new THREE.Mesh(islandGeo, rockMaterial);
    base.castShadow = !mobile;
    base.receiveShadow = true;
    island.add(base);
    const cap = new THREE.Mesh(plateauGeo, rockMaterial);
    cap.position.y = 8.5;
    cap.receiveShadow = true;
    island.add(cap);
    const count = mobile ? 10 : 23,
      city = new THREE.InstancedMesh(crystal, crystalMaterial, count);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399,
        radius = Math.sqrt((i + 1) / count) * 8,
        height = 2 + rng() * 7;
      dummy.position.set(
        Math.cos(angle) * radius,
        8.5 + height * 0.52,
        Math.sin(angle) * radius,
      );
      dummy.scale.set(0.5 + rng() * 0.65, height, 0.5 + rng() * 0.65);
      dummy.rotation.set((rng() - 0.5) * 0.15, rng() * 3, (rng() - 0.5) * 0.12);
      dummy.updateMatrix();
      city.setMatrixAt(i, dummy.matrix);
      city.setColorAt(
        i,
        color.set(i % 4 === 0 ? config.colors.gold : config.colors.crystal),
      );
    }
    city.castShadow = !mobile;
    island.add(city);
    scene.add(island);
    floating.push({
      object: island,
      base: position[1],
      phase: index * 2,
      amplitude: 0.24,
    });
  });
  const fragments = new THREE.InstancedMesh(
    rockGeo,
    rockMaterial,
    mobile ? 20 : 65,
  );
  for (let i = 0; i < fragments.count; i++) {
    dummy.position.set((rng() - 0.5) * 100, -4 - rng() * 25, 25 - rng() * 225);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    const scale = 0.3 + rng() * 1.8;
    dummy.scale.set(scale, scale * 1.7, scale);
    dummy.updateMatrix();
    fragments.setMatrixAt(i, dummy.matrix);
  }
  scene.add(fragments);

  // Arrival: a monumental stone ring, inset light, rotating engraved gold markers.
  const gate = new THREE.Group();
  gate.position.set(8, 10, -8);
  gate.rotation.set(0.05, -0.12, -0.12);
  scene.add(gate);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.56, 10, mobile ? 64 : 110),
    rockMaterial.clone(),
  );
  gate.add(ring);
  ring.material.emissive = new THREE.Color(config.colors.gold);
  ring.material.emissiveIntensity = 0;
  // A reflective inlay contrasts with the rough stone and luminous inner edge.
  gate.add(
    new THREE.Mesh(new THREE.TorusGeometry(9.18, 0.045, 6, 100), metalMaterial),
  );
  ring.userData = { kind: "gate" };
  pickables.push(ring);
  [8.44, 9.64].forEach((radius) =>
    gate.add(
      new THREE.Mesh(new THREE.TorusGeometry(radius, 0.028, 6, 100), goldGlow),
    ),
  );
  const markers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.04, 0.4, 0.08),
    goldGlow,
    48,
  );
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    dummy.position.set(Math.sin(angle) * 9, Math.cos(angle) * 9, 0.58);
    dummy.rotation.set(0, 0, -angle);
    dummy.scale.set(1, i % 4 === 0 ? 1.7 : 1, 1);
    dummy.updateMatrix();
    markers.setMatrixAt(i, dummy.matrix);
  }
  gate.add(markers);
  const gateFilm = new THREE.Mesh(
    new THREE.CircleGeometry(8.35, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec2 vUv; uniform float uTime; void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float ring=pow(r,9.)*.25;float mist=(sin(r*28.-uTime*.4+a*2.)*.5+.5)*.025;gl_FragColor=vec4(.68,.88,.78,(ring+mist)*(1.-smoothstep(.92,1.,r)));}`,
    }),
  );
  gate.add(gateFilm);
  floating.push({ object: gate, base: 10, phase: 0.4, amplitude: 0.18 });
  // Discovery: a glossy monolith with procedural luminous veins and thin edge light.
  const monolith = new THREE.Group();
  monolith.position.set(-12, 7, -75);
  scene.add(monolith);
  const coreMaterial = crystalMaterial.clone();
  coreMaterial.emissiveIntensity = 0.27;
  const core = new THREE.Mesh(crystal, coreMaterial);
  core.scale.set(2.6, 20, 2.6);
  core.rotation.z = -0.08;
  monolith.add(core);
  core.userData = { kind: "treasury" };
  pickables.push(core);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(crystal),
    new THREE.LineBasicMaterial({
      color: config.colors.vein,
      transparent: true,
      opacity: 0.33,
    }),
  );
  outline.scale.copy(core.scale);
  outline.rotation.copy(core.rotation);
  monolith.add(outline);
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.028, 6, 80),
    goldGlow,
  );
  orbit.rotation.x = 1.2;
  monolith.add(orbit);
  floating.push({ object: monolith, base: 7, phase: 2.1, amplitude: 0.35 });

  // Revelation: actual holdings, then actual returned OHLC candles. No random prices.
  const hologram = new THREE.Group();
  hologram.position.set(7, 1, -132);
  hologram.rotation.y = -0.2;
  scene.add(hologram);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 10, 1.3, 64),
    rockMaterial,
  );
  plinth.position.y = -1;
  plinth.receiveShadow = true;
  hologram.add(plinth);
  [10.5, 12].forEach((radius) => {
    const circle = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 6, 100),
      glowMaterial,
    );
    circle.rotation.x = Math.PI / 2;
    circle.position.y = -0.25;
    hologram.add(circle);
  });
  const barMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    metalness: 0.45,
    roughness: 0.24,
    emissive: "#75dcca",
    emissiveIntensity: 0.35,
  });
  const bars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      barMaterial,
      64,
    ),
    wicks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      glowMaterial,
      64,
    );
  hologram.add(bars, wicks);
  bars.userData = { kind: "archive" };
  pickables.push(bars);
  let activeRows = [],
    activeMeta = null;
  function setData(rows, meta) {
    activeRows = rows.slice(-48);
    activeMeta = meta;
    const n = activeRows.length;
    if (!n) return;
    bars.count = wicks.count = n;
    const minimum = Math.min(...activeRows.map((row) => row.l)),
      maximum = Math.max(...activeRows.map((row) => row.h));
    const range = Math.max(maximum - minimum, Math.abs(maximum) * 0.01, 1);
    const s = 10 / range;
    activeRows.forEach((row, i) => {
      const x = (i - (n - 1) / 2) * (18 / Math.max(n, 7)),
        bottom = (Math.min(row.o, row.c) - minimum) * s + 0.7,
        height = Math.max(0.08, Math.abs(row.c - row.o) * s);
      dummy.position.set(x, bottom + height / 2, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(Math.min(0.8, 12 / n), height, 0.7);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
      bars.setColorAt(i, color.set(row.c >= row.o ? "#bce8dd" : "#ec9ca9"));
      dummy.position.set(x, ((row.h + row.l) / 2 - minimum) * s + 0.7, 0);
      dummy.scale.set(0.025, Math.max(0.08, (row.h - row.l) * s), 0.025);
      dummy.updateMatrix();
      wicks.setMatrixAt(i, dummy.matrix);
    });
    bars.instanceMatrix.needsUpdate = true;
    bars.instanceColor.needsUpdate = true;
    wicks.instanceMatrix.needsUpdate = true;
    bars.computeBoundingSphere();
    wicks.computeBoundingSphere();
  }
  setData(
    HOLDINGS.map((h, i) => ({
      t: i,
      o: 0,
      l: 0,
      c: h.value,
      h: h.value,
      v: 0,
    })),
    { symbol: "Original holdings", snapshot: true },
  );
  floating.push({ object: hologram, base: 1, phase: 4, amplitude: 0.14 });

  // Light shafts: inexpensive, additive, noise-modulated cone volumes (not raytracing).
  const shafts = new THREE.Group();
  scene.add(shafts);
  const shaftMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(config.colors.gold) },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform vec3 uColor;void main(){float side=pow(sin(vUv.x*3.14159),2.);float end=sin(vUv.y*3.14159);float dust=.65+.35*sin(vUv.y*60.+sin(vUv.x*22.)-uTime*.12);gl_FragColor=vec4(uColor,side*end*dust*.023);}`,
  });
  const shaftGeo = new THREE.ConeGeometry(8, 65, 16, 1, true);
  for (let i = 0; i < (mobile ? 2 : 5); i++) {
    const shaft = new THREE.Mesh(shaftGeo, shaftMaterial);
    shaft.position.set(15 + i * 9, 21, -15 - i * 34);
    shaft.rotation.z = -0.3;
    shafts.add(shaft);
  }
  const pointCount = mobile
      ? config.quality.mobileParticles
      : config.quality.desktopParticles,
    positions = new Float32Array(pointCount * 3),
    particleColors = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    positions[i * 3] = (rng() - 0.5) * 140;
    positions[i * 3 + 1] = rng() * 65 - 10;
    positions[i * 3 + 2] = 35 - rng() * 260;
    color.set(i % 3 === 0 ? config.colors.gold : config.colors.vein);
    particleColors.set([color.r, color.g, color.b], i * 3);
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  particleGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(particleColors, 3),
  );
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDPR: { value: dpr } },
    vertexShader: `uniform float uTime,uDPR;varying vec3 vColor;void main(){vColor=color;vec3 p=position;p.x+=sin(uTime*.08+position.y)*.5;p.y+=sin(uTime*.13+position.x)*.6;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(90./max(1.,-mv.z),1.,3.)*uDPR;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:
      "varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vColor,(1.-d)*.55);}",
  });
  scene.add(new THREE.Points(particleGeometry, particleMaterial));

  let composer = null,
    bloom = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      config.quality.bloom,
      0.6,
      0.78,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  // TWEAK CAMERA: Catmull-Rom control points, all in one continuous world.
  const path = new THREE.CatmullRomCurve3(
    [
      [-8, 8, 40],
      [-4, 8, 19],
      [3, 9, -8],
      [-2, 11, -34],
      [-5, 9, -58],
      [6, 10, -91],
      [1, 9, -117],
      [-5, 11, -145],
      [0, 15, -171],
    ].map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.35,
  );
  const lookPath = new THREE.CatmullRomCurve3(
    [
      [8, 10, -8],
      [8, 10, -8],
      [-8, 7, -46],
      [-12, 8, -75],
      [-12, 8, -75],
      [7, 6, -132],
      [7, 6, -132],
      [2, 11, -175],
      [0, 17, -210],
    ].map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.35,
  );
  const point = new THREE.Vector3(),
    look = new THREE.Vector3(),
    raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const palettes = ["dawn", "dusk", "night"].map((name) =>
    Object.fromEntries(
      Object.entries(config.colors[name]).map(([key, value]) => [
        key,
        new THREE.Color(value),
      ]),
    ),
  );
  let hovered = null,
    disposed = false,
    lowFrames = 0,
    frameCount = 0,
    frameTotal = 0,
    lastPick = 0,
    frozenProgress = 0,
    frozenTime = 0;
  function update({ progress, time, mouse: cursor, motion, dt }) {
    if (disposed) return;
    // Reduced-motion keeps a fixed, fully lit vista; no scroll flight or drift.
    if (motion) {
      frozenProgress = clamp(progress, 0, 1);
      frozenTime = time;
    }
    const p = frozenProgress;
    path.getPointAt(p, point);
    lookPath.getPointAt(p, look);
    if (mobile) point.x -= 2;
    if (motion) {
      point.x += cursor.x * config.motion.mouseTilt;
      point.y += cursor.y * config.motion.mouseTilt * 0.45;
      look.x += cursor.x * 0.6;
    }
    camera.position.copy(point);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    sky.position.copy(point);
    const skyProgress = clamp(p * 2, 0, 1.999),
      stage = Math.min(1, Math.floor(skyProgress)),
      fraction = skyProgress - stage;
    skyMaterial.uniforms.uTop.value
      .copy(palettes[stage].sky)
      .lerp(palettes[stage + 1].sky, fraction);
    skyMaterial.uniforms.uHorizon.value
      .copy(palettes[stage].horizon)
      .lerp(palettes[stage + 1].horizon, fraction);
    scene.fog.color
      .copy(palettes[stage].fog)
      .lerp(palettes[stage + 1].fog, fraction);
    key.color
      .copy(palettes[stage].light)
      .lerp(palettes[stage + 1].light, fraction);
    const t = frozenTime * config.motion.driftSpeed;
    key.position.set(
      camera.position.x + 25 + (motion ? cursor.x * 5 : 0),
      35 + (motion ? Math.sin(t) * 4 : 0),
      camera.position.z - 15,
    );
    key.target.position.set(camera.position.x, 0, camera.position.z - 40);
    rim.position.set(-30, 18, camera.position.z - 40);
    rim.target.position.copy(look);
    for (const item of floating)
      item.object.position.y =
        item.base + Math.sin(t + item.phase) * item.amplitude;
    markers.rotation.z = t * 0.05;
    orbit.rotation.z = t * 0.16;
    core.rotation.y = t * 0.08;
    const reveal = clamp((p - 0.52) / 0.12, 0.01, 1);
    hologram.scale.y = reveal;
    gateFilm.material.uniforms.uTime.value = t;
    shaftMaterial.uniforms.uTime.value = t;
    particleMaterial.uniforms.uTime.value = frozenTime;
    if (hovered && motion && hovered.object === core) core.rotation.y += 0.15;
    // Real picking, throttled to 15Hz. The UI decides when a panel blocks picking.
    if (cursor.active && !mobile && motion && time - lastPick > 0.066) {
      lastPick = time;
      mouse.set(cursor.x, cursor.y);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      const hit = hits[0];
      hovered = hit && hit.distance < 110 ? hit : null;
      onHover(hovered ? describe(hovered).title : null);
    }
    if (!cursor.active || !motion) {
      hovered = null;
      onHover(null);
    }
    // Isolate material reactions so one highlighted object does not light the city.
    ring.material.emissiveIntensity = hovered?.object === ring ? 0.3 : 0;
    coreMaterial.emissiveIntensity = mix(
      coreMaterial.emissiveIntensity,
      hovered?.object === core ? 0.8 : 0.27,
      0.12,
    );
    if (composer) composer.render();
    else renderer.render(scene, camera);
    if (motion && dt > 0 && dt < 0.2) {
      frameTotal += dt;
      frameCount++;
      if (frameCount === 180) {
        if (frameTotal / frameCount > 1 / 43) lowFrames++;
        else lowFrames = 0;
        frameCount = 0;
        frameTotal = 0;
        if (lowFrames >= 2 && dpr > 1) {
          dpr = 1;
          renderer.setPixelRatio(1);
          composer?.setPixelRatio(1);
          particleMaterial.uniforms.uDPR.value = 1;
          if (bloom) bloom.enabled = false;
          shafts.visible = false;
          lowFrames = 0;
        }
      }
    }
  }
  function describe(hit) {
    const kind = hit.object.userData.kind;
    if (kind === "gate") return { kind, title: "The gate of possibility" };
    if (kind === "treasury") return { kind, title: "The crystal treasury" };
    const i = hit.instanceId ?? 0,
      row = activeRows[i];
    return activeMeta?.snapshot
      ? {
          kind: "holding",
          holding: HOLDINGS[i],
          title: HOLDINGS[i]?.name || "Original holdings",
        }
      : {
          kind: "candle",
          row,
          meta: activeMeta,
          title: `${activeMeta?.symbol || "Price"} · candle ${i + 1}`,
        };
  }
  function click(cursor) {
    mouse.set(cursor.x, cursor.y);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit && hit.distance < 110) onInspect(describe(hit));
  }
  function resize() {
    if (disposed) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight);
  }
  const contextLoss = (event) => {
    event.preventDefault();
    onContextLoss();
  };
  canvas.addEventListener("webglcontextlost", contextLoss);
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("webglcontextlost", contextLoss);
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set(Object.values(maps));
    scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material)
        (Array.isArray(node.material)
          ? node.material
          : [node.material]
        ).forEach((m) => materials.add(m));
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    environmentTarget.dispose();
    composer?.passes.forEach((pass) => pass.dispose?.());
    composer?.dispose();
    renderer.dispose();
  }
  return { update, resize, click, setData, dispose };
}
