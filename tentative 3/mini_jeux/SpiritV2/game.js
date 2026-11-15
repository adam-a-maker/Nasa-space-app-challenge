import * as T from './three.module.min.js';
import { SVGRenderer } from './SVGRenderer.js';

const el = id => document.getElementById(id);
let canvas = el('world');
let software = false;
let renderer;
try {
  renderer = new T.WebGLRenderer({canvas, antialias:true});
} catch {
  renderer = new SVGRenderer();
  software = true;
  renderer.setQuality('low');
  renderer.domElement.id = 'world';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Paysage martien en 3D');
  canvas.replaceWith(renderer.domElement);
  canvas = renderer.domElement;
}
if (renderer) start();

function start() {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(59, 1, .1, 520);
  renderer.setPixelRatio?.(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  if (!software) {
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
  }

  const sky = new T.Color();
  scene.background = sky;
  scene.fog = new T.FogExp2(sky, .012);
  const ambient = new T.HemisphereLight(0xffebdb, 0x66473f, 1.24);
  const sunlight = new T.DirectionalLight(0xffdfc3, 1.75);
  sunlight.position.set(-24, 35, 15);
  scene.add(ambient, sunlight);
  if (!software) {
    sunlight.castShadow=true;
    sunlight.shadow.mapSize.set(2048,2048);
    Object.assign(sunlight.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:95});
    sunlight.shadow.normalBias=.04;
    sunlight.shadow.camera.updateProjectionMatrix();
    scene.add(sunlight.target);
  }
  if (software) scene.add(new T.AmbientLight(0x625955));

  const palettes = {
    present:{ sky:0xba9b86, ground:0x95745e, slope:0xa08770, rock:0x675a51, light:0xffdfc3 },
    past:{ sky:0x94a2a0, ground:0x766758, slope:0x84786a, rock:0x4b4b46, light:0xe1e9e9 }
  };
  const worlds = {present: new T.Group(), past: new T.Group()};
  scene.add(worlds.present, worlds.past);
  const materials = new Map();
  const cube = new T.BoxGeometry(1, 1, 1);
  const stone = new T.IcosahedronGeometry(1, 0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function material(color) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({color, flatShading:true}));
    return materials.get(color);
  }
  function shape(group, geometry, color, x, y, z, sx=1, sy=1, sz=1) {
    const mesh = new T.Mesh(geometry, material(color));
    mesh.position.set(x,y,z);
    mesh.scale.set(sx,sy,sz);
    group.add(mesh);
    return mesh;
  }
  function box(group,color,x,y,z,sx,sy,sz) {
    return shape(group,cube,color,x,y,z,sx,sy,sz);
  }
  let randomSeed = 34;
  function random() {
    randomSeed = (Math.imul(1664525, randomSeed) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }
  const mesa = new T.Vector3(16, 0, -42);
  const vent = new T.Vector3(16, 0, -23);
  const rocks = {present: [], past: []};
  const slabs = {present:[],past:[]};
  const sandPatches=[
    {x:-12,z:-8,rx:7,rz:5},{x:31,z:-15,rx:6,rz:9},
    {x:-42,z:-34,rx:4,rz:7},{x:23,z:-63,rx:7,rz:4},
    {x:-10,z:114,rx:10,rz:6},{x:18,z:80,rx:9,rz:7}
  ];
  const craters=[{x:38,z:-39,r:7},{x:-39,z:0,r:6}];
  const lake = {x:-22,z:-26,rx:20,rz:13};
  const stations = [
    {name:'Plaine de départ',action:'Observer les dépôts érodés',era:'present',x:-24,z:94},
    {name:'Ancienne rive du sud',action:'Observer les berges',era:'past',x:23,z:48},
    {name:'Lit asséché', action:'Relever les sédiments', era:'present', x:-23,z:-26},
    {name:'Berge ancienne', action:'Relever le niveau de l’eau', era:'past', x:-36,z:-48},
    {name:'Éboulis du plateau', action:'Relever les strates', era:'present', x:7,z:-58}
  ];
  const gully={x:-3,z:-51};
  function gullyDepth(x,z) {
    const bend=gully.x+Math.sin((z-gully.z)*.18)*3;
    return (1-T.MathUtils.smoothstep(Math.abs(x-bend),1.2,4.8)) *
      (1-T.MathUtils.smoothstep(Math.abs(z-gully.z),11,19));
  }
  function basinDistance(x,z) {
    return Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz);
  }
  function elevation(x,z,period) {
    const dx=x-mesa.x, dz=z-mesa.z;
    const radius=Math.hypot(dx,dz);
    const slopeZone=T.MathUtils.smoothstep(radius,9.5,12)*
      (1-T.MathUtils.smoothstep(radius,14.2,17));
    const erosion=(.23*Math.sin(dx*.62+dz*.27)+.14*Math.cos(dz*1.1-dx*.41))*slopeZone;
    let h=6.8 * (1 - T.MathUtils.smoothstep(radius+erosion,11,16));
    if (period==='past' && dz>9) {
      const ramp = (1-T.MathUtils.smoothstep(Math.abs(dx+8),3,7))
        * (1-T.MathUtils.smoothstep(dz,10,31));
      h=Math.max(h,6.8*ramp);
    }
    const basin=1-T.MathUtils.smoothstep(basinDistance(x,z),.69,1.12);
    const wave=.42*Math.sin(x*.115+z*.06)+.24*Math.cos(z*.16-x*.074);
    const rim=5*T.MathUtils.smoothstep(Math.hypot(x,z-30),135,157);
    const south=T.MathUtils.smoothstep(z,16,33);
    const southernHills=south*(1.25*Math.sin(x*.065+z*.042)+.65*Math.cos(z*.105));
    const crossing=south*Math.exp(-(((z-68)/6)**2))*(period==='past'?.35:-1.25);
    const relief=.20*Math.sin(x*.39+z*.21)*Math.cos(z*.27);
    const ravine=gullyDepth(x,z)*(period==='present'?2.55:.26);
    let craterRelief=0;
    for(const crater of craters) {
      const d=Math.hypot(x-crater.x,z-crater.z)/crater.r;
      const depth=period==='present'?2.6:1.35;
      craterRelief-=depth*(1-T.MathUtils.smoothstep(d,.25,.88));
      craterRelief+=.65*Math.exp(-(((d-.96)/.13)**2));
    }
    return h-1.46*basin+wave+rim+relief-ravine+craterRelief+southernHills+crossing;
  }
  function softSoil(x,z,period) {
    return period==='present' && (sandPatches.some(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1) ||
      basinDistance(x,z)<.75 || (gullyDepth(x,z)>.55 && z<-49));
  }

  function cellHash(x,z) {
    let value=Math.imul(x,374761393)+Math.imul(z,668265263);
    value=Math.imul(value^(value>>>13),1274126177);
    return ((value^(value>>>16))>>>0)/4294967295;
  }

  function noise(x,z,period=0) {
    const i=Math.floor(x), j=Math.floor(z);
    let u=x-i, v=z-j;
    u*=u*(3-2*u);
    v*=v*(3-2*v);
    const wrap=n=>period?((n%period)+period)%period:n;
    const a=cellHash(wrap(i),wrap(j)), b=cellHash(wrap(i+1),wrap(j));
    const c=cellHash(wrap(i),wrap(j+1)), d=cellHash(wrap(i+1),wrap(j+1));
    return T.MathUtils.lerp(T.MathUtils.lerp(a,b,u),T.MathUtils.lerp(c,d,u),v);
  }

  // Tileable relief for sand, dust and compacted soil.
  const grainSide=256;
  const grainPixels=new Uint8Array(grainSide*grainSide*4);
  for(let z=0;z<grainSide;z++) for(let x=0;x<grainSide;x++) {
    const broad=noise(x/32,z/32,8);
    const waviness=noise(x/64,z/64,4);
    const band=Math.sin(z*Math.PI/16+waviness*8)*(.25+broad*.75);
    const grit=cellHash(x,z);
    const shade=213+broad*14+band*7+noise(x/4,z/4,64)*9+(grit-.5)*38;
    grainPixels.set([shade,shade,shade,255],(z*grainSide+x)*4);
  }
  const groundMap=new T.DataTexture(grainPixels,grainSide,grainSide);
  groundMap.wrapS=groundMap.wrapT=T.RepeatWrapping;
  groundMap.repeat.set(94,94);
  groundMap.magFilter=T.LinearFilter;
  groundMap.minFilter=T.LinearMipmapLinearFilter;
  groundMap.generateMipmaps=true;
  groundMap.needsUpdate=true;

  const soilColors=Object.fromEntries(Object.entries(palettes).map(([period,palette])=>[period,{
    ground:new T.Color(palette.ground),
    rock:new T.Color(palette.rock),
    sediment:new T.Color(period==='past'?0x504942:0xb49575),
    band:new T.Color(period==='past'?0xaaa08d:0xbda28a),
  }]));

  function groundColor(x,y,z,period,target) {
    const soil=noise(x*.135,z*.135);
    const grain=noise(x*.53+17,z*.53);
    const exposed=1-T.MathUtils.smoothstep(basinDistance(x,z),.55,1.18);
    const rise=Math.hypot(elevation(x+.3,z,period)-elevation(x-.3,z,period),
      elevation(x,z+.3,period)-elevation(x,z-.3,period))/.6;
    const ledge=T.MathUtils.smoothstep(rise,.25,.92);
    const layerHeight=y+x*.012+(noise(x*.12,z*.12)-.5)*.32;
    const layer=.5+.5*Math.sin(layerHeight*12.7+noise(x*.3,z*.3)*2.2);
    const colors=soilColors[period];
    target.copy(colors.ground).lerp(colors.rock,.32*soil);
    target.lerp(colors.sediment,Math.max(exposed*.7,gullyDepth(x,z)*.49));
    target.lerp(colors.band,ledge*(.15+.64*T.MathUtils.smoothstep(layer,.36,.82)));
    return target.multiplyScalar(.84+soil*.15+grain*.16);
  }

  function terrain(period) {
    const segments=software ? 120 : 420;
    const geometry = new T.PlaneGeometry(328,328,segments,segments);
    geometry.rotateX(-Math.PI/2);
    const points=geometry.attributes.position;
    const colors=new Float32Array(points.count*3);
    const color=new T.Color();
    for (let i=0;i<points.count;i++) {
      const x=points.getX(i), z=points.getZ(i)+30;
      const y=elevation(x,z,period);
      points.setY(i,y);
      groundColor(x,y,z,period,color).toArray(colors,i*3);
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:groundMap,bumpMap:groundMap,bumpScale:.13}));
    mesh.position.z=30;
    mesh.receiveShadow=true;
    if (software) mesh.renderOrder=-3;
    return mesh;
  }

  function strata(period,group) {
    const angles=144;
    const geometry=new T.BufferGeometry();
    const positions=[],colors=[],indices=[];
    const shades=[0x836957,0xa4866a,0x8d705d,0xa98d74,0x896f5c,0xa48a72];
    const color=new T.Color();
    for(let band=0;band<shades.length;band++) {
      for(let i=0;i<=angles;i++) {
        const angle=i*Math.PI*2/angles;
        const cx=Math.cos(angle),cz=Math.sin(angle);
        // Thin exposed beds follow the uneven rim, with gaps at the ancient ramp.
        const r=11.58+band*.67+(noise(cx*3.2+14,cz*3.2)-.5)*.52;
        const width=.06+.105*noise(cx*10+band,cz*10);
        const fade=noise(cx*7+band+2,cz*7);
        for(const edge of [-1,1]) {
          const x=mesa.x+cx*(r+edge*width),z=mesa.z+cz*(r+edge*width);
          const y=elevation(x,z,period);
          positions.push(x,y+(software?.28:.085),z);
          color.setHex(shades[band]).multiplyScalar(.92+fade*.18).toArray(colors,colors.length);
        }
        if(i && fade>.24 && !(period==='past' && cz>.58 && cx<-.12 && cx>-.88)) {
          const n=band*(angles+1)*2+i*2;
          indices.push(n-2,n,n-1,n,n+1,n-1);
        }
      }
    }
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
    mesh.receiveShadow=true;
    mesh.renderOrder=software?-2:0;
    group.add(mesh);
  }

  function rockGeometry(seed, facets) {
    const geometry=new T.IcosahedronGeometry(1,facets);
    const points=geometry.attributes.position;
    const colors=new Float32Array(points.count*3);
    for(let i=0;i<points.count;i++) {
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
      const chips=noise(x*3.4+seed,y*2.6+z*1.4);
      const shape= .82+chips*.26+Math.sin(x*9+y*7-z*4+seed)*.12;
      points.setXYZ(i,x*shape,Math.max(-.55,Math.min(.84,y*shape)),z*shape);
      const seam=.5+.5*Math.sin(y*23+z*3+seed);
      const tone=.68+chips*.28+seam*.16;
      colors.set([tone,tone*.99,tone*.97],i*3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const normals=geometry.attributes.normal;
    const normal=new T.Vector3(),radial=new T.Vector3();
    for(let i=0;i<normals.count;i++) {
      normal.fromBufferAttribute(normals,i);
      radial.fromBufferAttribute(points,i).normalize();
      normal.lerp(radial,.42).normalize();
      normals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    return geometry;
  }

  const rockMap=groundMap.clone();
  rockMap.repeat.set(3,3);
  rockMap.needsUpdate=true;
  const outcrops=Array.from({length:8},(_,i)=>rockGeometry(i*7,software?1:3));
  const rockMaterials=new Map();
  function rockMaterial(color) {
    if (!rockMaterials.has(color)) {
      rockMaterials.set(color,new T.MeshStandardMaterial({color,vertexColors:true,roughness:1,flatShading:false,map:rockMap,bumpMap:rockMap,bumpScale:.055}));
    }
    return rockMaterials.get(color);
  }

  function farRelief(group,period,palette) {
    // Outside the driving area, several ridges form one continuous crater rim.
    const angles=144, rings=software?8:17;
    const geometry=new T.BufferGeometry();
    const positions=[],colors=[],indices=[];
    const color=new T.Color();
    const haze=new T.Color(palette.sky);
    for(let row=0;row<=rings;row++) {
      const t=row/rings;
      for(let i=0;i<=angles;i++) {
        const angle=i*Math.PI*2/angles;
        const r=161+t*148;
        const x=Math.cos(angle)*r,z=Math.sin(angle)*r+30;
        const edge=elevation(x,z,period);
        const folds=noise(x*.067,z*.067)*.35+noise(x*.023+5,z*.023)*.65;
        const ridges=7*Math.exp(-((t-.26)**2)/.012)+17*Math.exp(-((t-.68)**2)/.042);
        const y=3+(edge-3)*Math.max(0,1-t*8)+T.MathUtils.smoothstep(t,0,.13)*ridges*(.36+folds);
        positions.push(x,y,z);
        groundColor(x,y,z,period,color).lerp(haze,.15+t*.55).toArray(colors,colors.length);
        if(i && row) {
          const b=row*(angles+1)+i,a=b-angles-1;
          indices.push(a-1,a,b-1,a,b,b-1);
        }
      }
    }
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
    mesh.renderOrder=-4;
    group.add(mesh);
  }

  function gravel(group,period,palette) {
    let seed=period==='past'?157:315;
    const scatter=()=>{
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;
      return seed/4294967296;
    };
    const count=software?620:11000;
    const gravelShape=rockGeometry(23,0);
    const colors=[palette.rock,palette.slope,period==='past'?0x686257:0x88735d];
    const batches=software?null:colors.map(color=>new T.InstancedMesh(gravelShape,rockMaterial(color),count));
    const indices=[0,0,0];
    const piece=new T.Object3D();
    for(let i=0;i<count;i++) {
      const x=(scatter()-.5)*220,z=145-scatter()*235;
      if(noise(x*.136,z*.136)<.42 && scatter()>.16) continue;
      const y=elevation(x,z,period);
      if (period==='past' && flooded(x,z,y)) continue;
      const size=.045+scatter()**3*(software?.52:.38);
      const color=i%colors.length;
      piece.position.set(x,y+size*.10,z);
      piece.rotation.set(.22*scatter(),scatter()*6.28,.24*scatter());
      piece.scale.set(size,size*(.32+scatter()*.36),size*(.67+scatter()*.66));
      if (batches) {
        piece.updateMatrix();
        batches[color].setMatrixAt(indices[color]++,piece.matrix);
      } else {
        const mesh=new T.Mesh(gravelShape,rockMaterial(colors[color]));
        mesh.position.copy(piece.position);
        mesh.rotation.copy(piece.rotation);
        mesh.scale.copy(piece.scale);
        group.add(mesh);
      }
    }
    if (batches) batches.forEach((mesh,i)=>{
      mesh.count=indices[i];
      mesh.receiveShadow=true;
      group.add(mesh);
    });
  }

  const water=[];
  function pool(group,x,z,rx,rz,y) {
    const geometry=new T.CircleGeometry(1,software?42:76);
    const surface=new T.Mesh(geometry,new T.MeshStandardMaterial({
      color:0x526f72,roughness:.24,metalness:.06,bumpMap:groundMap,bumpScale:.08,side:T.DoubleSide
    }));
    surface.rotation.x=-Math.PI/2;
    surface.position.set(x,y,z);
    surface.scale.set(rx,rz,1);
    group.add(surface);
    for(let i=0;i<18;i++) {
      const a=random()*Math.PI*2, distance=Math.sqrt(random())*.85;
      const ripple=box(group,0x91b5b7,x+Math.cos(a)*rx*distance,y+.024,z+Math.sin(a)*rz*distance,1+random()*2,.012,.036+random()*.027);
      ripple.userData={x:ripple.position.x,z:ripple.position.z,phase:random()*6};
      water.push(ripple);
    }
  }

  function boulder(period,x,z,r,h) {
    const y=elevation(x,z,period);
    const p=palettes[period];
    const color=random()<.62?p.rock:p.slope;
    const geometry=outcrops[Math.floor(cellHash(Math.round(x*10),Math.round(z*10))*outcrops.length)%outcrops.length];
    const rock=new T.Mesh(geometry,rockMaterial(color));
    rock.position.set(x,y+h*.09,z);
    rock.scale.set(r,h*1.2,r*.81);
    worlds[period].add(rock);
    rock.rotation.set(.16*Math.sin(x),random()*6,.14*Math.cos(z));
    rock.castShadow=r>1.05;
    rock.receiveShadow=true;
    if (r>1.05) rocks[period].push({x,z,y,r:r*.76,h:h*1.02});
  }

  for (const [period,group] of Object.entries(worlds)) {
    const p=palettes[period];
    randomSeed=787;
    group.add(terrain(period));
    strata(period,group);
    randomSeed=1789;
    farRelief(group,period,p);
    gravel(group,period,p);
    // Retain the seeded layout of the driveable boulders.
    for (let i=0;i<32*5;i++) random();
    for (let i=0;i<161;i++) {
      const x=(random()-.5)*108,z=27-random()*102;
      if (stations.some(p=>Math.hypot(x-p.x,z-p.z)<4.5)) continue;
      const dx=x-mesa.x,dz=z-mesa.z;
      if (((Math.abs(x)<20 && z>7 && z<17) || Math.hypot(x,z-12)<6) || Math.hypot(x-vent.x,z-vent.z)<5 ||
          Math.hypot(dx,dz)<16 || (dx>-13&&dx<4&&z<17&&dz>0) ||
          (period==='past'&&basinDistance(x,z)<1)) continue;
      boulder(period,x,z,.22+random()**2*2.7,.16+random()**2*1.7);
    }
    if(period==='present') {
      for(const [x,z,r,h] of [[7,-27,2.9,2.2],[10,-30,3,2.5],[5,-30,2.1,1.8],[8,-34,2.2,2.1]]) boulder(period,x,z,r,h);
    }
  }
  // Erosion and collapses create different obstacles even far from the summit.
  for (const [period,x,z,r,h] of [
    ['present',-35,-43,3.6,1.9],['present',-39,-47,3.3,2.1],
    ['present',3,-60,3.3,2.2],['past',-9,-39,3.1,1.7],
    ['past',4,-51,2.6,1.7],['present',-8,-53,2.3,1.55],
    ['present',-14,-60,2.5,1.65],['past',-33,-52,2.1,1.45]
  ]) boulder(period,x,z,r,h);
  // Additional rock gardens leave several routes around each group.
  randomSeed=462;
  for(const period of ['present','past']) {
    for(const [cx,cz] of [[-16,2],[27,1],[-45,-20],[29,-48],[-19,-59],[43,-24]]) {
      for(let i=0;i<7;i++) {
        const a=i*2.4, distance=2.5+random()*4.4;
        const x=cx+Math.cos(a)*distance,z=cz+Math.sin(a)*distance;
        if(stations.some(station=>Math.hypot(x-station.x,z-station.z)<5)) continue;
        boulder(period,x,z,1.15+random()*1.05,.55+random()*1.45);
      }
    }
  }

  randomSeed=991;
  for(const period of ['present','past']) {
    for(let i=0;i<110;i++) {
      const x=(random()-.5)*150,z=25+random()*118;
      if(Math.hypot(x,z-133)<8 || stations.some(station=>Math.hypot(x-station.x,z-station.z)<6)) continue;
      if(Math.abs(x-6*Math.sin(z*.08))<4.5) continue;
      boulder(period,x,z,1.15+random()*2.2,.5+random()*2);
    }
  }

  // Raised, fractured bedrock is a low but impassable step for the rover.
  const slabSites=[
    ['present',-12,70,4,1.3,.5],['present',7,104,4,1.2,-.3],
    ['past',-11,111,3.5,1.3,.4],['past',15,34,3,1.4,.6],
    ['present',-8,-18,3.4,1.1,.3],['present',-31,-10,3,1.4,-.5],
    ['present',26,-27,3.7,1.2,.6],['present',-20,-47,3.3,1.1,.2],
    ['past',-18,-1,3.6,1.4,-.4],['past',29,-35,4,1.3,.5],
    ['past',-42,-57,2.7,1.1,-.7],['past',-8,-64,3,1.3,.3]
  ];
  for(const [period,x,z,rx,rz,angle] of slabSites) {
    const y=elevation(x,z,period),h=.72;
    const mesh=new T.Mesh(outcrops[3],rockMaterial(period==='present'?0xa58b71:0x79776c));
    mesh.position.set(x,y+.32,z);
    mesh.scale.set(rx,h,rz);
    mesh.rotation.y=angle;
    mesh.castShadow=mesh.receiveShadow=true;
    worlds[period].add(mesh);
    slabs[period].push({x,z,y,rx:rx*.86,rz:rz*.86,angle,h:.95});
    for(let i=0;i<3;i++) boulder(period,x+(i-1)*1.6,z+rz+1.2,.45,.24);
  }

  // Low wind ripples mark the soft sand and follow the collision surface.
  for(const patch of sandPatches) {
    const geometry=new T.PlaneGeometry(patch.rx*2,patch.rz*2,20,18);
    geometry.rotateX(-Math.PI/2);
    const points=geometry.attributes.position,colors=[];
    const color=new T.Color();
    const indices=[];
    for(let i=0;i<points.count;i++) {
      const dx=points.getX(i),dz=points.getZ(i);
      const x=patch.x+dx,z=patch.z+dz;
      points.setXYZ(i,x,elevation(x,z,'present')+.045,z);
      const ripple=.5+.5*Math.sin(dz*7+Math.sin(dx*.6)*1.2);
      color.setHex(0xbda17b).multiplyScalar(.76+ripple*.26).toArray(colors,i*3);
    }
    const old=geometry.index.array;
    for(let i=0;i<old.length;i+=3) {
      const inside=[old[i],old[i+1],old[i+2]].every(v=>
        Math.hypot((points.getX(v)-patch.x)/patch.rx,(points.getZ(v)-patch.z)/patch.rz)<1);
      if(inside) indices.push(old[i],old[i+1],old[i+2]);
    }
    geometry.setIndex(indices);
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:groundMap}));
    mesh.receiveShadow=true;
    mesh.renderOrder=software?-2:0;
    worlds.present.add(mesh);
  }
  pool(worlds.past,lake.x,lake.z,lake.rx*.89,lake.rz*.88,-.59);
  pool(worlds.past,mesa.x,mesa.z,9.1,9.1,7.19);
  vent.y=elevation(vent.x,vent.z,'past');
  for (const [name,group] of Object.entries(worlds)) {
    const ventRing = new T.Mesh(new T.TorusGeometry(1.5,.22,8,20),material(name==='past'?0xb9a98a:0x6f3e32));
    ventRing.rotation.x = -Math.PI/2;
    ventRing.position.copy(vent);
    ventRing.position.y=elevation(vent.x,vent.z,name)+.14;
    group.add(ventRing);
  }
  const jet = new T.Group();
  const sprayMat = new T.MeshBasicMaterial({color:0xd1f8fc,transparent:true,opacity:.73});
  const sprayShape = new T.SphereGeometry(.20,7,6);
  const particles=[];
  for (let i=0;i<30;i++) {
    const drop=new T.Mesh(sprayShape,sprayMat);
    drop.position.set((random()-.5)*1.5,random()*6.5,(random()-.5)*1.5);
    drop.userData.height=drop.position.y;
    particles.push(drop);
    jet.add(drop);
  }
  jet.position.copy(vent);
  worlds.past.add(jet);

  const deposit = new T.Vector3(mesa.x,elevation(mesa.x,mesa.z,'present'),mesa.z);
  const surveyMarkers=stations.map(station=>{
    const group=worlds[station.era];
    const y=elevation(station.x,station.z,station.era);
    const marker=new T.Mesh(new T.TorusGeometry(1.2,.10,7,28),new T.MeshBasicMaterial({color:0xe5bd8e}));
    marker.rotation.x=-Math.PI/2;
    marker.position.set(station.x,y+.12,station.z);
    group.add(marker);
    return marker;
  });
  const exposed = new T.Group();
  exposed.position.copy(deposit);
  worlds.present.add(exposed);
  for (let i=0;i<100;i++) {
    const angle=random()*Math.PI*2,radius=Math.sqrt(random());
    const dx=Math.cos(angle)*radius*2.1,dz=Math.sin(angle)*radius*2.4;
    if(noise(dx*2.6+4,dz*2.6)<.29) continue;
    const y=elevation(deposit.x+dx,deposit.z+dz,'present')-deposit.y;
    const rock=shape(exposed,stone,i%3?0xeee5d4:0xbfb09c,dx,y+.018,dz,
      .08+random()*.29,.027+random()*.085,.09+random()*.23);
    rock.rotation.y=random()*6;
  }

  const rover = new T.Group();
  scene.add(rover);
  const placeholder = new T.Group();
  rover.add(placeholder);
  box(placeholder,0xe4c99d,0,.78,0,1.85,.43,2.03);
  box(placeholder,0x967659,0,.50,0,1.54,.24,1.8);
  box(placeholder,0x3a3d50,0,1.03,.27,2.45,.10,1.65);
  for (let i=-2;i<=2;i++) box(placeholder,0x73879a,i*.42,1.088,.27,.018,.01,1.59);
  for (let i=-1;i<=1;i++) box(placeholder,0x73879a,0,1.09,.27+i*.43,2.4,.01,.018);
  box(placeholder,0xb89d76,.55,1.49,-.60,.13,1.10,.13);
  box(placeholder,0xe0c79a,.55,2.04,-.64,.57,.30,.25);
  for (const x of [.41,.69]) box(placeholder,0x171f24,x,2.05,-.775,.135,.103,.03);
  const antenna = shape(placeholder,new T.CylinderGeometry(.24,.24,.05,12),0xc3c4ae,-.62,1.31,-.52);
  antenna.rotation.x=.55;
  const wheel = new T.CylinderGeometry(.38,.38,.27,software?12:24);
  const wheels=[];
  for(const x of [-1.03,1.03]) {
    box(placeholder,0x88806c,x,.46,0,.16,.13,1.8);
    for(const z of [-.84,0,.84]) {
      const pivot = new T.Group();
      pivot.position.set(x,.38,z);
      placeholder.add(pivot);
      const tire = shape(pivot,wheel,0x292621,0,0,0);
      tire.rotation.z=Math.PI/2;
      const hub=shape(pivot,new T.CylinderGeometry(.175,.175,.292,8),0x8a7f66,0,0,0);
      hub.rotation.z=Math.PI/2;
      for(let i=0;i<(software?0:9);i++) {
        const a=i*Math.PI*2/9;
        const tread=box(pivot,0x534a3d,0,Math.sin(a)*.374,Math.cos(a)*.374,.29,.045,.10);
        tread.rotation.x=-a+Math.PI/2;
      }
      wheels.push({pivot,locked:x>0&&z<0});
    }
  }
  box(placeholder,0xaa9d82,-.42,.57,-1.11,.48,.22,.2);
  box(placeholder,0x686768,-.43,.41,-1.26,.10,.19,.42).rotation.x=.29;
  box(placeholder,0x4d4c44,-.43,.28,-1.5,.20,.17,.14);
  const antennaRod=shape(placeholder,new T.CylinderGeometry(.019,.035,.94,8),0xa29e90,-.84,1.56,.76);
  antennaRod.rotation.z=.1;
  placeholder.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
  let modelWheels = [];
  if (typeof window.fetch === 'function') {
    import('./rover-model.js?v=spirit').then(({loadSpiritModel}) => loadSpiritModel(software))
      .then(({body, rollingWheels}) => {
        rover.remove(placeholder);
        rover.add(body);
        modelWheels = rollingWheels;
        canvas.dataset.rover = software ? 'light' : 'full';
      })
      .catch(error => {
        canvas.dataset.rover = 'placeholder';
        console.warn('Modèle détaillé de Spirit indisponible.', error);
      });
  }
  const shadow=new T.Mesh(new T.CircleGeometry(1.45,22),new T.MeshBasicMaterial({color:0x231811,transparent:true,opacity:.25,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;
  scene.add(shadow);
  shadow.visible=software;
  if (software) {
    shadow.renderOrder = 1;
    placeholder.traverse(part => { part.renderOrder = 2; });
  }

  const pos=new T.Vector3();
  const velocity=new T.Vector3();
  const cameraTarget=new T.Vector3();
  const cameraLook=new T.Vector3();
  const roverGround=new T.Vector3();
  const screen=new T.Vector3();
  const keys=new Set();
  const touch=new Map();
  let era='present';
  let yaw=0;
  let grounded=true;
  let phase=0;
  let progress=0;
  let last=0;
  let lastRender=0;
  let flight=false;
  let scraping=0;
  let action=0;
  let ventCycle=0;
  let noticeUntil=0;
  let cameraReady=false;
  let finished=false;
  const guide=el('guide');
  const report=el('report');
  const victory=el('victory');
  const objectiveText='Mets au jour le dépôt blanc, analyse-le et transmets à la Terre ce qu’il révèle sur l’eau ancienne de Mars.';
  let lastCheckpoint=0;
  let orbit=0;
  let pitch=.55;
  let cameraDistance=13;
  let cameraPreset=0;
  let surveyed=new Set();
  let safeSurvey=null;
  let cameraDrag=null;
  const cameraPresets=[
    {name:'Suivi',pitch:.55,distance:13},
    {name:'Près du sol',pitch:.23,distance:11},
    {name:'Vue haute',pitch:1.09,distance:21}
  ];
  const waypoints=[{x:0,z:133},{x:16,z:-16},{x:16,z:-39}];
  function message(text) {
    el('notice').textContent=text;
    el('notice').hidden=false;
    noticeUntil=performance.now()+3350;
  }

  function applyEra() {
    const isPast=era==='past';
    worlds.past.visible=isPast;
    worlds.present.visible=!isPast;
    sky.setHex(palettes[era].sky);
    scene.fog.color.copy(sky);
    scene.fog.density=isPast?.006:.0036;
    ambient.color.setHex(isPast?0xd0e2e2:0xffebdb);
    sunlight.color.setHex(palettes[era].light);
    el('era').textContent=isPast?'Passé':'Présent';
    el('era-caption').textContent=isPast?'Reconstitution possible':'Époque de Spirit';
    el('switch-label').textContent=isPast?'Revenir au présent':'Passer au passé';
    document.body.dataset.era=era;
  }

  function flooded(x,z,y) {
    if (y<-.43 && basinDistance(x,z)<.88) return true;
    return y<7.27 && Math.hypot(x-mesa.x,z-mesa.z)<9;
  }

  function blocked(x,z,y,period) {
    if (Math.hypot(x,z-30)>145) return true;
    if(slabs[period].some(slab=>{
      const dx=x-slab.x,dz=z-slab.z,c=Math.cos(slab.angle),s=Math.sin(slab.angle);
      const localX=dx*c-dz*s,localZ=dx*s+dz*c;
      return y<slab.y+slab.h && Math.abs(localX)<slab.rx+.6 && Math.abs(localZ)<slab.rz+.6;
    })) return true;
    return rocks[period].some(rock =>
      y<rock.y+rock.h && Math.hypot(x-rock.x,z-rock.z)<rock.r+.65);
  }

  function toggleEra() {
    if (finished || scraping || guide.open || report.open) return;
    const next=era==='past'?'present':'past';
    if (blocked(pos.x,pos.z,pos.y,next) ||
        (next==='past' && flooded(pos.x,pos.z,pos.y)) ||
        elevation(pos.x,pos.z,next)>pos.y+.5) {
      message('Le terrain de cette époque occupe cet emplacement. Décale Spirit.');
      return;
    }
    era=next;
    applyEra();
  }

  function updateProgress() {
    if (lastCheckpoint===0 && Math.hypot(pos.x-mesa.x,pos.z-mesa.z)<32 && grounded) {
      lastCheckpoint=1;
      message('Plateau repéré. Cherche la rampe ancienne à gauche ou le geyser au pied du relief.');
    }
    if (era==='present' && grounded && Math.hypot(pos.x-mesa.x,pos.z-mesa.z)<11 && pos.y>5.7) {
      lastCheckpoint=2;
    }
    const step=surveyed.size+action;
    if (progress!==step || el('progress').value!==step || !el('progress-text').textContent.includes('MISSION')) {
      progress=step;
      el('progress').value=step;
      el('progress-text').textContent=action?'MISSION · ANALYSER':`MISSION · RELEVÉS ${surveyed.size}/${stations.length}`;
    }
    const pending=stations.findIndex((_,index)=>!surveyed.has(index));
    const next=stations[pending];
    const text=next ? (surveyed.size===0 ? objectiveText+' Commence par le relevé de la plaine au sud.' :
      `Prochain relevé · ${next.name} (${next.era==='past'?'Passé':'Présent'}).`) : action===1?'Le dépôt est dégagé. Analyse la matière blanche.':lastCheckpoint===2?
      'Approche-toi du repère et racle le sol.':lastCheckpoint===1?
      'Retrouve un accès au plateau. Dans le passé, une rampe rocheuse et un geyser sont encore visibles.':objectiveText;
    if (el('instruction').textContent!==text) el('instruction').textContent=text;
  }

  function reset(full=false) {
    if (full) {
      action=0;
      surveyed=new Set();
      safeSurvey=null;
      finished=false;
      lastCheckpoint=0;
      report.close();
      victory.close();
      el('report-form').reset();
      el('report-feedback').textContent='';
      el('notice').hidden=true;
    }
    scraping=0;
    const safe=lastCheckpoint===2?waypoints[2]:safeSurvey??waypoints[lastCheckpoint];
    era=safe.era??'present';
    pos.set(safe.x,elevation(safe.x,safe.z,era),safe.z);
    velocity.set(0,0,0);
    grounded=true;
    flight=false;
    yaw=0;
    orbit=0;
    applyEra();
    updateProgress();
    rover.position.copy(pos);
    cameraReady=false;
  }

  function launch() {
    grounded=false;
    flight=true;
    velocity.set((mesa.x-pos.x)*.55,12.9,-8.4);
    message('En vol · Bascule au présent pour te poser sur le plateau sec.');
  }

  function tick(dt) {
    ventCycle=(ventCycle+dt)%6.8;
    const active=ventCycle>5.05;
    const warning=ventCycle>4.1 && !active;
    const nearVent=Math.hypot(pos.x-vent.x,pos.z-vent.z)<1.72;
    jet.visible=active || warning;
    jet.scale.y=active?1:.23;
    if (!reduced.matches) {
      for (const drop of particles) drop.position.y=(drop.userData.height+ventCycle*4.4)%6.5;
    }
    if (era==='past' && nearVent && grounded) {
      if (active || (el('assist').checked && ventCycle>4.1)) launch();
      else if (warning && el('notice').hidden) message('Vapeur visible · le jet va jaillir.');
    }
    const held=new Set(touch.values());
    const down=key=>keys.has(key)||held.has(key);
    const steer=Number(down('right'))-Number(down('left'));
    const drive=Number(down('back'))-Number(down('forward'));

    if (scraping>0) {
      scraping=Math.max(0,scraping-dt);
      velocity.set(0,0,0);
      pos.x+=(deposit.x-pos.x)*dt*.5;
      pos.z+=(deposit.z-pos.z)*dt*.5;
      if (scraping===0) {
        action=1;
        message('Matière blanche dégagée. Lance l’analyse.');
      }
    } else if (!flight) {
      yaw -= steer * dt * 1.85;
      const speed=softSoil(pos.x,pos.z,era)?3.2:8.0;
      const throttle=drive>0?.55*drive:drive;
      const blend=1-Math.exp(-dt*13);
      velocity.x+=(Math.sin(yaw)*throttle*speed-velocity.x)*blend;
      velocity.z+=(Math.cos(yaw)*throttle*speed-velocity.z)*blend;
    }
    if (!grounded) velocity.y-=9.4*dt;
    const previousX=pos.x, previousZ=pos.z;
    const nx=pos.x+velocity.x*dt;
    const nz=pos.z+velocity.z*dt;
    const floorAt=(x,z)=>elevation(x,z,era);
    const canMove=(x,z)=>{
      if (blocked(x,z,pos.y,era)) return false;
      const nextFloor=floorAt(x,z);
      if (!grounded) return nextFloor<=pos.y+.045;
      const rise=nextFloor-floorAt(pos.x,pos.z);
      const distance=Math.hypot(x-pos.x,z-pos.z);
      return rise<=distance*.9+.002 &&
        (era==='present' || !flooded(x,z,nextFloor));
    };
    if (canMove(nx,pos.z)) pos.x=nx;
    if (canMove(pos.x,nz)) pos.z=nz;
    const floor=floorAt(pos.x,pos.z);
    if (grounded) pos.y=floor;
    else {
      pos.y+=velocity.y*dt;
      if (pos.y<=floor && velocity.y<=0) {
        if (era==='past' && flooded(pos.x,pos.z,floor)) {
          reset();
          message('Spirit est retombé dans l’eau. Réessaie depuis le pied du plateau.');
          return;
        }
        grounded=true;
        flight=false;
        velocity.y=0;
        pos.y=floor;
      }
    }
    rover.position.copy(pos);
    const slopeSample=.85;
    const forwardX=-Math.sin(yaw)*slopeSample, forwardZ=-Math.cos(yaw)*slopeSample;
    const slopeAhead=elevation(pos.x+forwardX,pos.z+forwardZ,era)-elevation(pos.x-forwardX,pos.z-forwardZ,era);
    const slopeSide=elevation(pos.x-forwardZ,pos.z+forwardX,era)-elevation(pos.x+forwardZ,pos.z-forwardX,era);
    roverGround.set(grounded?Math.atan2(slopeAhead,2*slopeSample):0,yaw,
      grounded?Math.atan2(slopeSide,2*slopeSample):0);
    rover.rotation.set(roverGround.x,roverGround.y,roverGround.z,'YXZ');
    shadow.position.set(pos.x,floor+.03,pos.z);
    shadow.material.opacity=.25/(1+Math.max(0,pos.y-floor)*.34);
    if (grounded) {
      const travel=-(pos.x-previousX)*Math.sin(yaw)-(pos.z-previousZ)*Math.cos(yaw);
      for (const wheel of modelWheels) wheel.rotation.x+=travel/.18;
      if (placeholder.parent) {
        for (const part of wheels) if (!part.locked) part.pivot.rotation.x-=travel/.38;
      }
    }
    updateProgress();
  }

  function currentSurvey() {
    if (!grounded) return -1;
    return stations.findIndex((station,index)=>!surveyed.has(index) && station.era===era &&
      Math.hypot(pos.x-station.x,pos.z-station.z)<3.2);
  }

  function updateInteraction() {
    const station=currentSurvey();
    const nearDeposit=era==='present' && grounded && Math.abs(pos.y-deposit.y)<1.25 &&
      Math.hypot(pos.x-deposit.x,pos.z-deposit.z)<3.2 && !scraping;
    const ready=nearDeposit && surveyed.size===stations.length;
    el('interact').hidden=finished || !(ready || station>=0);
    const label=station>=0?stations[station].action:action===0?'Racler le sol':'Analyser';
    if (el('interact').textContent!==label) el('interact').textContent=label;
    el('survey-hint').hidden=!(nearDeposit && !ready);
    exposed.visible=action>0;
    surveyMarkers.forEach((marker,index)=>{marker.visible=!surveyed.has(index);});
    const goal=ready?(action===0?'Mettre au jour le dépôt':'Analyser le dépôt'):'Trouver le dépôt blanc';
    if (el('goal').textContent!==goal) el('goal').textContent=goal;
  }

  function changeCamera() {
    cameraPreset=(cameraPreset+1)%cameraPresets.length;
    orbit=0;
    const view=cameraPresets[cameraPreset];
    pitch=view.pitch;
    cameraDistance=view.distance;
    el('camera-angle').textContent='Caméra · '+view.name;
  }

  const keymap={
    ArrowUp:'forward',KeyW:'forward',KeyZ:'forward',
    ArrowDown:'back',KeyS:'back',ArrowLeft:'left',KeyA:'left',KeyQ:'left',
    ArrowRight:'right',KeyD:'right'
  };
  window.addEventListener('keydown',event=>{
    if (guide.open || report.open || victory.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (keymap[event.code]) {
      event.preventDefault();
      keys.add(keymap[event.code]);
    }
    if (event.code==='KeyE' && !event.repeat) toggleEra();
    if(event.code==='KeyC' && !event.repeat) changeCamera();
    if(event.code==='KeyJ') orbit-=.12;
    if(event.code==='KeyL') orbit+=.12;
    if (event.code==='Space' && !event.repeat && !event.target.closest?.('button,a')) {
      event.preventDefault();
      toggleEra();
    }
  });
  window.addEventListener('keyup',event=>keys.delete(keymap[event.code]));
  window.addEventListener('blur',()=>{keys.clear();touch.clear();});
  for (const button of document.querySelectorAll('[data-move]')) {
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      touch.set(event.pointerId,button.dataset.move);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) {
      button.addEventListener(type,event=>touch.delete(event.pointerId));
    }
    button.addEventListener('click',event=>{
      if (event.detail!==0) return;
      const direction=button.dataset.move;
      keys.add(direction);
      window.setTimeout(()=>keys.delete(direction),220);
    });
  }
  canvas.addEventListener('pointerdown',event=>{
    if (!event.isPrimary || event.button!==0) return;
    cameraDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if (cameraDrag?.id!==event.pointerId) return;
    orbit-=(event.clientX-cameraDrag.x)*.008;
    pitch=T.MathUtils.clamp(pitch+(event.clientY-cameraDrag.y)*.006,.16,1.23);
    cameraDrag.x=event.clientX;
    cameraDrag.y=event.clientY;
  });
  canvas.addEventListener('lostpointercapture',()=>{cameraDrag=null;});
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    cameraDistance=T.MathUtils.clamp(cameraDistance+event.deltaY*.017,7,32);
  },{passive:false});
  el('camera-angle').addEventListener('click',changeCamera);
  el('switch').addEventListener('click',toggleEra);
  el('reset').addEventListener('click',()=>{reset();message('Retour au dernier point sûr.');});
  document.addEventListener('visibilitychange',()=>{keys.clear();touch.clear();});
  el('help').addEventListener('click',()=>{keys.clear();touch.clear();guide.showModal();});
  el('interact').addEventListener('click',()=>{
    if (el('interact').hidden) return;
    const station=currentSurvey();
    if (station>=0) {
      surveyed.add(station);
      safeSurvey=stations[station];
      updateProgress();
      updateInteraction();
      message(stations[station].name+' · relevé enregistré.');
      return;
    }
    if (surveyed.size!==stations.length) return;
    if (action===0) {
      scraping=reduced.matches?.1:1.2;
      message('La roue bloquée racle le sol.');
    } else {
      keys.clear();
      touch.clear();
      el('report-feedback').textContent='';
      report.showModal();
    }
  });
  el('report-form').addEventListener('submit',event=>{
    event.preventDefault();
    if (new FormData(event.currentTarget).get('answer')!=='ancient') {
      el('report-feedback').textContent='La silice est un indice sur la formation du dépôt. Relis ce que cette analyse permet de conclure.';
      return;
    }
    finished=true;
    el('progress').value=5;
    el('progress-text').textContent='MISSION · RAPPORT TRANSMIS';
    report.close();
    victory.showModal();
  });
  el('replay').addEventListener('click',()=>reset(true));
  victory.addEventListener('cancel',event=>event.preventDefault());

  function resize() {
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;
    renderer.setSize(width,height,false);
    camera.aspect=width/Math.max(1,height);
    camera.fov=camera.aspect<.85?66:59;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize',resize);
  resize();
  reset(true);
  function animate(now) {
    const dt=Math.min(.045,(now-(last||now))/1000);
    last=now;
    if (!guide.open && !report.open && !finished) {
      const steps = Math.max(1,Math.ceil(dt/.016));
      for (let i=0;i<steps;i++) tick(dt/steps);
    }
    if (noticeUntil<now) el('notice').hidden=true;
    phase+=dt;
    if (era==='past' && !reduced.matches) {
      for (const ripple of water) {
        const {x,z,phase:offset}=ripple.userData;
        ripple.position.x=x+Math.sin(phase*.9+offset)*.44;
        ripple.position.z=z+Math.cos(phase*.65+offset)*.16;
        ripple.scale.x=1.4+.55*Math.sin(phase*1.8+offset);
      }
    }
    const portrait=camera.aspect<.85;
    const radius=cameraDistance+(portrait?1.4:0);
    const distance=Math.cos(pitch)*radius;
    const heading=yaw+orbit;
    cameraTarget.set(pos.x+Math.sin(heading)*distance,pos.y+Math.sin(pitch)*radius,pos.z+Math.cos(heading)*distance);
    cameraLook.set(pos.x-Math.sin(heading)*4.9,pos.y+.9,pos.z-Math.cos(heading)*4.9);
    cameraTarget.y=Math.max(cameraTarget.y,elevation(cameraTarget.x,cameraTarget.z,era)+2.1);
    if (!cameraReady || reduced.matches) camera.position.copy(cameraTarget);
    else camera.position.lerp(cameraTarget,1-Math.exp(-dt*9));
    camera.lookAt(cameraLook);
    if (!software) {
      sunlight.target.position.copy(pos);
      sunlight.position.set(pos.x-24,pos.y+35,pos.z+15);
    }
    cameraReady=true;
    camera.updateMatrixWorld();
    const next=stations.find((_,index)=>!surveyed.has(index));
    const target=next??deposit;
    const targetName=next?next.name:'Dépôt blanc';
    const targetY=next?elevation(next.x,next.z,era):deposit.y;
    screen.set(target.x,targetY+2,target.z).project(camera);
    const visible=screen.z<1 && screen.z>-1 && Math.abs(screen.x)<.84 && Math.abs(screen.y)<.87 && !finished;
    const marker=el('destination');
    marker.classList.toggle('offscreen',!visible);
    marker.hidden=finished;
    const distanceToTarget=Math.round(Math.hypot(pos.x-target.x,pos.z-target.z));
    const markerLabel=targetName+' · '+distanceToTarget+' m';
    if (marker.firstElementChild.textContent!==markerLabel) marker.firstElementChild.textContent=markerLabel;
    if (visible) {
      marker.style.left=(50+screen.x*50)+'%';
      marker.style.top=(50-screen.y*50)+'%';
    } else {
      marker.style.removeProperty('left');
      marker.style.removeProperty('top');
    }
    updateInteraction();
    const hazard=el('terrain-status');
    const sandy=softSoil(pos.x,pos.z,era);
    const nearbySlab=slabs[era].some(s=>Math.hypot(pos.x-s.x,pos.z-s.z)<s.rx+3);
    const nearbyCrater=craters.some(c=>Math.hypot(pos.x-c.x,pos.z-c.z)<c.r+2);
    hazard.textContent=sandy?'Sable meuble · progression ralentie. Contourne la zone ou recule.':
      nearbySlab?'Dalles rocheuses · cherche un passage autour des rebords.':
      nearbyCrater?'Cuvette · évite les pentes raides et cherche une sortie douce.':'';
    hazard.hidden=!hazard.textContent;
    if (!software || now-lastRender>42) {
      renderer.render(scene,camera);
      lastRender=now;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
