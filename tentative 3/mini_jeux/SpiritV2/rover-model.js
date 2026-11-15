import * as T from './three.module.min.js';

export async function loadSpiritModel(software) {
  const directory = new URL('./rover/', import.meta.url);
  async function fetchAsset(name) {
    const response = await fetch(new URL(name, directory));
    if (!response.ok) throw new Error('Spirit asset unavailable: ' + name);
    return response;
  }

  const [model, bytes] = await Promise.all([
    fetchAsset('model.json').then(response => response.json()),
    fetchAsset(software ? 'light.bin' : 'detail.bin').then(response => response.arrayBuffer()),
  ]);

  const loader = new T.TextureLoader();
  const textures = new Map();
  function texture(index, color = false) {
    if (index === null) return null;
    if (!textures.has(index)) {
      textures.set(index, loader.loadAsync(new URL(`texture-${index}.webp`, directory).href).then(map => {
        map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
        map.flipY = false;
        map.wrapS = map.wrapT = T.RepeatWrapping;
        map.anisotropy = 4;
        return map;
      }));
    }
    return textures.get(index);
  }

  const materials = software
    ? []
    : await Promise.all(model.materials.map(async data => {
      const [map, normalMap] = await Promise.all([texture(data.base, true), texture(data.normal)]);
      return new T.MeshStandardMaterial({
        color: new T.Color(...data.color),
        map,
        normalMap,
        normalScale: new T.Vector2(data.normalScale, data.normalScale),
        metalness: data.metalness,
        roughness: data.roughness,
      });
    }));
  const lightweight = software ? new T.MeshLambertMaterial({vertexColors: true}) : null;
  const body = new T.Group();
  // The supplied model faces +Z. In the game the rover moves toward its local -Z.
  body.rotation.y = Math.PI;
  body.scale.setScalar(1.38);
  body.position.y = .012;

  const rollingWheels = [];
  for (const part of model.parts) {
    const geometry = new T.BufferGeometry();
    const attr = ([offset, count], size) =>
      new T.BufferAttribute(new Float32Array(bytes, offset, count), size);
    const blocks = software ? part.light : part.full;
    geometry.setAttribute('position', attr(blocks[0], 3));
    const [indexOffset, indexCount] = blocks.at(-1);
    geometry.setIndex(new T.BufferAttribute(new Uint16Array(bytes, indexOffset, indexCount), 1));
    if (software) {
      geometry.setAttribute('color', attr(blocks[1], 3));
      geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      geometry.computeVertexNormals();
    } else {
      geometry.setAttribute('normal', attr(blocks[1], 3));
      geometry.setAttribute('uv', attr(blocks[2], 2));
    }

    const mesh = new T.Mesh(geometry, lightweight ?? materials[part.material]);
    mesh.position.set(...part.pivot);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.renderOrder = software ? 2 : 0;
    body.add(mesh);
    const [x, , z] = part.pivot;
    // The right front wheel stays fixed when Spirit drives or scrapes.
    if (part.wheel && !(x < 0 && z > .4)) rollingWheels.push(mesh);
  }

  return {body, rollingWheels};
}
