const missions = [
  {name:"Sojourner", year:1997, site:"Ares Vallis", lat:19.13, lon:-33.22, title:"The first rover on Mars", story:"Deployed by the Pathfinder lander in Ares Vallis, Sojourner examines rocks and soils in an ancient flood plain. Its observations help researchers study the geological and climate history of Mars."},
  {name:"Spirit", year:2004, site:"Gusev Crater", lat:-14.57, lon:175.47, title:"A wheel reveals a soil rich in silica", story:"In 2007, a stuck wheel digs a trench near Home Plate. There Spirit uncovers a soil made almost entirely of pure silica, probably formed in an environment where water was present."},
  {name:"Phoenix", year:2008, site:"Vastitas Borealis", lat:68.22, lon:-125.75, title:"Ice beneath the Arctic surface", story:"Phoenix’s robotic arm digs into the ground near the Martian north pole. The mission confirms the presence of water ice beneath the surface and also detects perchlorate in the soil."},
  {name:"Ingenuity", year:2021, site:"Jezero Crater", lat:18.44, lon:77.45, title:"The first powered flight on another planet", story:"Carried beneath the Perseverance rover, Ingenuity makes the first powered, controlled flight on another planet in 2021. Planned for five flights, the helicopter completes 72 before its mission ends in 2024."}
];


const radians = Math.PI / 180;
const size = 520;
const radius = size / 2;
const fullTurn = 2 * Math.PI;
const maximumTilt = 90 * radians;
const orbitSpeed = .00023;
const maximumFlingSpeed = .0058;
const momentumDecay = 560;
const dragResponse = 14;
const releaseWindow = 150;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const canvas = document.querySelector("#globe");
canvas.width = canvas.height = size;
const context = canvas.getContext("2d");
const frame = context.createImageData(size, size);
const markerLayer = document.querySelector("#markers");
const list = document.querySelector("#mission-list");
const rotation = document.querySelector("#rotation");
const longitudeReadout = document.querySelector("#longitude");
const home = document.querySelector("#home");
const globeStage = document.querySelector("#globe-stage");
const planet = document.querySelector("#planet");
const surface = document.querySelector("#surface");
const landscape = document.querySelector("#landscape");
const arrival = document.querySelector("#arrival");
const arrivalLandscape = document.querySelector("#arrival-landscape");
const surfaceTitle = document.querySelector("#surface-title");
const surfaceLocation = document.querySelector("#surface-location");
const storyTitle = document.querySelector("#story-title");
const storyText = document.querySelector("#story-text");

for (const mission of missions) {
  mission.slug = mission.name.toLowerCase().replaceAll(" ", "-");
}

let angle = -26 * radians;
let tilt = 9 * radians;
let projectedTilt;
let rotating = !reducedMotion.matches;
let orbitDirection = 1;
let horizontalMomentum = 0;
let verticalMomentum = 0;
let pendingLongitude = 0;
let pendingLatitude = 0;
let drag = null;
let descent = null;
let lastEntry = null;
let previousTime;
let dirty = true;
let texture = null;

const starField = document.querySelector(".stars");
let seed = 8429;
function random() {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let index = 0; index < 130; index++) {
  const star = document.createElement("i");
  const diameter = random() > 0.91 ? 2 : 1;
  star.style.cssText = `left:${random()*100}%;top:${random()*100}%;width:${diameter}px;height:${diameter}px;opacity:${0.15+random()*0.65}`;
  starField.append(star);
}

const pins = missions.map((mission, index) => {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "marker";
  marker.hidden = true;
  marker.setAttribute("aria-label", mission.name + " on the globe");
  marker.addEventListener("click", () => enterMission(index, marker));
  markerLayer.append(marker);

  const row = document.createElement("button");
  row.type = "button";
  row.className = "mission";
  row.innerHTML = `<span>${mission.name}</span><span>${mission.year}</span>`;
  row.addEventListener("click", () => enterMission(index, row));
  const item = document.createElement("li");
  item.append(row);
  list.append(item);
  return { marker, row };
});

function syncRotation() {
  rotation.textContent = rotating ? "Pause" : "Resume";
  rotation.setAttribute("aria-label", rotating ? "Pause the rotation" : "Resume the rotation");
}

function clearMomentum() {
  horizontalMomentum = 0;
  verticalMomentum = 0;
  pendingLongitude = 0;
  pendingLatitude = 0;
}

function scenePath(mission) {
  return "scenes/" + mission.slug + ".webp";
}

function showRoute() {
  const mission = missions.find(item => location.hash === "#mission-" + item.slug);
  const wasOnSurface = !surface.hidden;
  home.hidden = Boolean(mission);
  surface.hidden = !mission;
  if (mission) {
    landscape.src = scenePath(mission);
    surfaceLocation.textContent = mission.site + " · " + mission.year;
    surfaceTitle.textContent = mission.name;
    storyTitle.textContent = mission.title;
    storyText.textContent = mission.story;
    document.title = mission.name + " — Atlas Mars";
    window.scrollTo(0, 0);
    surfaceTitle.focus({ preventScroll: true });
  } else {
    document.title = "Atlas Mars — Traces of Exploration";
    dirty = true;
    if (wasOnSurface) {
      window.scrollTo(0, lastEntry?.scroll ?? 0);
      const trigger = lastEntry?.trigger;
      (trigger && !trigger.hidden ? trigger : pins[0].row).focus();
    }
  }
}

function enterMission(index, trigger) {
  if (descent) return;
  hideDossier(true);
  const mission = missions[index];
  lastEntry = { trigger, scroll: window.scrollY };
  clearMomentum();
  const targetAngle = mission.lon * radians;
  const longitudeDifference = targetAngle - angle;
  const longitudeTravel = Math.atan2(Math.sin(longitudeDifference), Math.cos(longitudeDifference));
  const latitudeTravel = mission.lat * radians - tilt;
  descent = {
    mission,
    marker: pins[index].marker,
    startAngle: angle,
    startTilt: tilt,
    longitudeTravel,
    latitudeTravel,
    elapsed: 0,
    waitingForScene: 0
  };
  if (reducedMotion.matches) {
    completeDescent(descent);
    return;
  }

  const bounds = planet.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
    globeStage.scrollIntoView({ block: "center", behavior: "instant" });
  }
  descent.duration = 1370 + 240 * Math.max(Math.abs(longitudeTravel) / Math.PI, Math.abs(latitudeTravel) / Math.PI);
  arrivalLandscape.src = scenePath(mission);
  arrival.hidden = false;
  descent.marker.classList.add("destination");
  home.classList.add("descent");
}

function completeDescent(current) {
  angle = current.mission.lon * radians;
  tilt = current.mission.lat * radians;
  history.pushState({ fromOrbit: true }, "", "#mission-" + current.mission.slug);
  showRoute();
  cancelDescent();
}

function cancelDescent() {
  if (!descent) return;
  descent.marker.classList.remove("destination");
  descent = null;
  home.classList.remove("descent");
  planet.style.removeProperty("transform");
  planet.style.removeProperty("--destination-opacity");
  arrival.hidden = true;
  arrival.style.removeProperty("opacity");
  arrival.style.removeProperty("transform");
}

// Smooth interpolation with zero velocity at both ends of a transition.
function easeBetween(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function updateDescent(current, elapsed) {
  const revealStart = .67;
  current.startedAt ??= performance.now();
  const nextTime = performance.now() - current.startedAt;
  // Let the terrain load before revealing it, with a bounded wait on slow connections.
  if (!arrivalLandscape.complete && nextTime > revealStart * current.duration && current.waitingForScene < 900) {
    current.waitingForScene += elapsed;
    current.startedAt += elapsed;
    current.elapsed = revealStart * current.duration;
  } else {
    current.elapsed = nextTime;
  }
  const progress = Math.min(1, current.elapsed / current.duration);
  if (progress === 1) {
    completeDescent(current);
    return;
  }

  const alignment = easeBetween(progress, 0, .62);
  const nextAngle = current.startAngle + current.longitudeTravel * alignment;
  const nextTilt = current.startTilt + current.latitudeTravel * alignment;
  dirty ||= nextAngle !== angle || nextTilt !== tilt;
  angle = nextAngle;
  tilt = nextTilt;

  const zoom = easeBetween(progress, .09, .94);
  const zoomLimit = Math.max(4, 2.3 * Math.max(window.innerWidth, window.innerHeight) / planet.clientWidth);
  const scale = zoomLimit ** zoom;
  const destination = projectMission(current.mission, Math.sin(tilt), Math.cos(tilt));
  // Keep the zoom centered on the landing site while the globe turns towards it.
  const offset = (scale - 1) * planet.clientWidth / 2;
  planet.style.transform = `translate(${-destination.x * offset}px, ${destination.y * offset}px) scale(${scale})`;
  planet.style.setProperty("--destination-opacity", 1 - easeBetween(progress, .46, revealStart));
  arrival.style.opacity = easeBetween(progress, revealStart, .98);
  arrival.style.transform = `scale(${1 + .065 * (1 - easeBetween(progress, revealStart, 1))})`;
}

rotation.addEventListener("click", () => {
  if (descent) return;
  rotating = !rotating;
  clearMomentum();
  syncRotation();
});

for (const id of ["#back", "#home-link"]) {
  document.querySelector(id).addEventListener("click", event => {
    if (surface.hidden || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (history.state?.fromOrbit) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      showRoute();
    }
  });
}
window.addEventListener("hashchange", () => {
  cancelDescent();
  showRoute();
});

const pixels = [];
for (let row = 0; row < size; row++) {
  const y = (radius - row - 0.5) / radius;
  for (let column = 0; column < size; column++) {
    const x = (column + 0.5 - radius) / radius;
    const depth = 1 - x*x - y*y;
    if (depth <= 0) continue;
    const z = Math.sqrt(depth);
    const light = 0.25 + 0.91*Math.max(0, -0.39*x + 0.35*y + 0.85*z);
    const offset = (row * size + column) * 4;
    pixels.push({ offset, x, y, z, light, u: 0, textureRow: 0 });
    frame.data[offset + 3] = Math.min(255, depth * radius * 165);
  }
}

const image = new Image();
image.addEventListener("load", () => {
  const map = document.createElement("canvas");
  map.width = image.naturalWidth;
  map.height = image.naturalHeight;
  const source = map.getContext("2d");
  source.drawImage(image, 0, 0);
  texture = source.getImageData(0, 0, map.width, map.height);
  dirty = true;
});
image.src = "mars.webp";

function projectMission(mission, sinTilt, cosTilt) {
  const latitude = mission.lat * radians;
  const meridian = mission.lon * radians - angle;
  const north = Math.sin(latitude);
  const equator = Math.cos(latitude) * Math.cos(meridian);
  return {
    x: Math.cos(latitude) * Math.sin(meridian),
    y: north * cosTilt - equator * sinTilt,
    depth: north * sinTilt + equator * cosTilt
  };
}

function draw() {
  if (home.hidden) return;
  const sinTilt = Math.sin(tilt);
  const cosTilt = Math.cos(tilt);
  const turn = angle / fullTurn;
  if (texture) {
    const width = texture.width;
    const map = texture.data;
    // Cache the projection while only the longitude is changing.
    if (projectedTilt !== tilt) {
      for (const pixel of pixels) {
        const { x, y, z } = pixel;
        const north = y * cosTilt + z * sinTilt;
        const equator = z * cosTilt - y * sinTilt;
        pixel.u = Math.atan2(x, equator) / fullTurn + 0.5;
        const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, north))) / Math.PI;
        pixel.textureRow = Math.floor(v * (texture.height - 1)) * width;
      }
      projectedTilt = tilt;
    }
    for (const {offset,u,light,textureRow} of pixels) {
      const longitude = u + turn;
      const index = (textureRow + Math.floor((longitude - Math.floor(longitude))*width))*4;
      frame.data[offset] = map[index]*light;
      frame.data[offset+1] = map[index+1]*light;
      frame.data[offset+2] = map[index+2]*light;
    }
    context.putImageData(frame,0,0);
  }
  missions.forEach((mission, index) => {
    const { x, y, depth } = projectMission(mission, sinTilt, cosTilt);
    const pin = pins[index].marker;
    pin.hidden = depth < 0.15;
    pin.style.left = `${50+50*x}%`;
    pin.style.top = `${50-50*y}%`;
  });
  syncDossier();
  const longitude = Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) / radians);
  const latitude = Math.round(tilt / radians);
  longitudeReadout.textContent = `${Math.abs(latitude)}° ${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude)}° ${longitude < 0 ? "W" : "E"}`;
}

function animate(time) {
  const elapsed = Math.min(time - (previousTime ?? time), 50);
  previousTime = time;
  if (descent) {
    updateDescent(descent, elapsed);
  } else if (!home.hidden) {
    updateRotation(elapsed);
  }
  if (dirty) {
    draw();
    dirty = false;
  }
  requestAnimationFrame(animate);
}

function updateRotation(elapsed) {
  const follow = 1 - Math.exp(-elapsed / dragResponse);
  const horizontal = Math.abs(pendingLongitude) < .0001 ? pendingLongitude : pendingLongitude * follow;
  const vertical = Math.abs(pendingLatitude) < .0001 ? pendingLatitude : pendingLatitude * follow;
  pendingLongitude -= horizontal;
  pendingLatitude -= vertical;

  if (horizontal || vertical) turnGlobe(horizontal, vertical);
  const hasMomentum = horizontalMomentum !== 0 || verticalMomentum !== 0;
  if (!rotating || drag || (!hasMomentum && markerLayer.querySelector(":hover, :focus-visible"))) return;

  const decay = Math.exp(-elapsed / momentumDecay);
  const drift = momentumDecay * (1 - decay);
  turnGlobe(orbitDirection * orbitSpeed * elapsed + horizontalMomentum * drift, verticalMomentum * drift);
  horizontalMomentum *= decay;
  verticalMomentum *= decay;
  if (Math.abs(horizontalMomentum) < .00002) horizontalMomentum = 0;
  const hitPole = (tilt === maximumTilt && verticalMomentum > 0) || (tilt === -maximumTilt && verticalMomentum < 0);
  if (Math.abs(verticalMomentum) < .00002 || hitPole) verticalMomentum = 0;
}

canvas.addEventListener("pointerdown", event => {
  if (descent || !event.isPrimary || event.button !== 0) return;
  clearMomentum();
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
    horizontalSpeed: 0,
    verticalSpeed: 0
  };
  canvas.setPointerCapture(event.pointerId);
});
function trackDrag(event) {
  const sensitivity = 2.75 / canvas.clientWidth;
  const horizontal = (drag.x - event.clientX) * sensitivity;
  const vertical = (event.clientY - drag.y) * sensitivity;
  if (horizontal === 0 && vertical === 0) return;
  const elapsed = Math.max(8, event.timeStamp - drag.time);
  const smoothing = 1 - Math.exp(-elapsed / 26);
  if (reducedMotion.matches) {
    turnGlobe(horizontal, vertical);
  } else {
    pendingLongitude += horizontal;
    const desiredTilt = Math.max(-maximumTilt, Math.min(maximumTilt, tilt + pendingLatitude + vertical));
    pendingLatitude = desiredTilt - tilt;
  }
  drag.horizontalSpeed += (horizontal / elapsed - drag.horizontalSpeed) * smoothing;
  drag.verticalSpeed += (vertical / elapsed - drag.verticalSpeed) * smoothing;
  drag.x = event.clientX;
  drag.y = event.clientY;
  drag.time = event.timeStamp;
}
canvas.addEventListener("pointermove", event => {
  if (!descent && drag?.id === event.pointerId) trackDrag(event);
});
canvas.addEventListener("pointerup", event => {
  if (drag?.id !== event.pointerId) return;
  if (!descent) trackDrag(event);

  const age = event.timeStamp - drag.time;
  if (!descent && rotating && !reducedMotion.matches && age < releaseWindow) {
    const release = 1 - age / releaseWindow;
    const horizontal = maximumFlingSpeed * Math.tanh(drag.horizontalSpeed * release / maximumFlingSpeed);
    const vertical = maximumFlingSpeed * Math.tanh(drag.verticalSpeed * release / maximumFlingSpeed);
    if (Math.abs(horizontal) > orbitSpeed) orbitDirection = Math.sign(horizontal);
    horizontalMomentum = orbitDirection * Math.max(0, Math.abs(horizontal) - orbitSpeed);
    verticalMomentum = vertical;
  }
  drag = null;
});
canvas.addEventListener("lostpointercapture", event => {
  if (drag?.id === event.pointerId) drag = null;
});

function turnGlobe(horizontal, vertical) {
  angle += horizontal;
  tilt = Math.max(-maximumTilt, Math.min(maximumTilt, tilt + vertical));
  dirty = true;
}

const arrowSteps = new Map([
  ["ArrowLeft", [-12, 0]],
  ["ArrowRight", [12, 0]],
  ["ArrowUp", [0, 12]],
  ["ArrowDown", [0, -12]]
]);
function rotateStep(step) {
  if (descent) return;
  clearMomentum();
  turnGlobe(step[0] * radians, step[1] * radians);
}
canvas.addEventListener("keydown", event => {
  const step = arrowSteps.get(event.key);
  if (!step) return;
  event.preventDefault();
  rotateStep(step);
});
home.addEventListener("keydown", event => {
  if (event.key === "Escape" && descent) {
    cancelDescent();
    lastEntry?.trigger.focus();
  }
});

reducedMotion.addEventListener("change", event => {
  if (!event.matches) return;
  rotating = false;
  clearMomentum();
  if (descent) completeDescent(descent);
  syncRotation();
});

/* ---------- Fiche d'identification au survol d'un point ---------- */
// Données de la fiche, par mission. state : "abandoned" (matériel abandonné) ou "active".
const dossierData = {
  "spirit":     { object: "Spirit (MER-A)",         program: "Mars Exploration Rover", state: "abandoned" },
  "phoenix":    { object: "Phoenix Mars Lander",    program: "Phoenix Scout Mission",  state: "abandoned" },
  "sojourner":  { object: "Sojourner Rover",        program: "Mars Pathfinder",        state: "abandoned" },
  "ingenuity":  { object: "Ingenuity Mars Helicopter", program: "Mars 2020",           state: "abandoned" }
};
const statusLabels = { abandoned: "Abandoned hardware", active: "Active" };

const svgNS = "http://www.w3.org/2000/svg";
const leaderSvg = document.createElementNS(svgNS, "svg");
leaderSvg.setAttribute("class", "dossier-line");
leaderSvg.setAttribute("aria-hidden", "true");
const leaderPath = document.createElementNS(svgNS, "path");
const leaderRing = document.createElementNS(svgNS, "circle");
leaderRing.setAttribute("r", "10");
const leaderEnd = document.createElementNS(svgNS, "rect");
leaderEnd.setAttribute("width", "6");
leaderEnd.setAttribute("height", "6");
leaderSvg.append(leaderPath, leaderRing, leaderEnd);

const dossier = document.createElement("aside");
dossier.className = "dossier";
dossier.setAttribute("aria-live", "polite");
dossier.innerHTML = `
  <div class="dossier-head"><span data-field="id"></span><span>ARCHIVE · MARS</span></div>
  <h3 data-field="object"></h3>
  <dl>
    <dt>Mission</dt><dd data-field="program"></dd>
    <dt>Status</dt><dd class="dossier-status"><i></i><span data-field="status"></span></dd>
  </dl>`;
const dossierFields = Object.fromEntries([...dossier.querySelectorAll("[data-field]")].map(el => [el.dataset.field, el]));
home.append(leaderSvg, dossier);

let activeDossier = null;
let dossierTimer = 0;

function relativeBox(element, homeBox) {
  const box = element.getBoundingClientRect();
  return { l: box.left - homeBox.left, t: box.top - homeBox.top, r: box.right - homeBox.left, b: box.bottom - homeBox.top };
}
function overlapArea(a, b) {
  return Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
}
function markerCenter(index, homeBox) {
  const box = pins[index].marker.getBoundingClientRect();
  return { x: box.left + box.width / 2 - homeBox.left, y: box.top + box.height / 2 - homeBox.top };
}

// Cherche l'emplacement de la fiche qui gêne le moins : hors de l'écran interdit,
// peu de recouvrement avec le texte, les autres points et la planète, et proche du point survolé.
function placeDossier(index) {
  const homeBox = home.getBoundingClientRect();
  const w = dossier.offsetWidth;
  const h = dossier.offsetHeight;
  const planetBox = planet.getBoundingClientRect();
  const cx = planetBox.left + planetBox.width / 2 - homeBox.left;
  const cy = planetBox.top + planetBox.height / 2 - homeBox.top;
  const r = planetBox.width / 2;
  const { x: mx, y: my } = markerCenter(index, homeBox);

  const margin = 12;
  const headerBottom = document.querySelector(".top").getBoundingClientRect().bottom - homeBox.top;
  const minX = margin;
  const maxX = Math.max(minX, homeBox.width - margin - w);
  const minY = Math.max(headerBottom, -homeBox.top, 0) + margin;
  const maxY = Math.max(minY, Math.min(homeBox.height, innerHeight - homeBox.top) - margin - h);

  const obstacles = [".intro", ".missions", ".coordinates", ".controls", ".credit"]
    .map(selector => home.querySelector(selector)).filter(Boolean).map(el => relativeBox(el, homeBox));
  const others = pins.map((pin, i) => i === index || pin.marker.hidden ? null : markerCenter(i, homeBox))
    .filter(Boolean).map(p => ({ l: p.x - 15, t: p.y - 15, r: p.x + 15, b: p.y + 15 }));
  const ownMarker = { l: mx - 16, t: my - 16, r: mx + 16, b: my + 16 };

  const gap = 28;
  const xs = [cx + r + gap, cx - r - gap - w, mx + 36, mx - 36 - w];
  const ys = [my - 22, my - h / 2, my - h + 22, cy - r, cy - h / 2, cy + r - h];
  const candidates = [];
  for (const x of xs) for (const y of ys) candidates.push([x, y]);
  candidates.push([mx - w / 2, cy - r - gap - h], [mx - w / 2, cy + r + gap]);

  let best = null;
  for (const [rawX, rawY] of candidates) {
    const x = Math.max(minX, Math.min(maxX, rawX));
    const y = Math.max(minY, Math.min(maxY, rawY));
    const box = { l: x, t: y, r: x + w, b: y + h };
    let cost = Math.hypot(x + w / 2 - mx, y + h / 2 - my) * .6;
    for (const o of obstacles) cost += overlapArea(box, o) * 4;
    for (const o of others) cost += overlapArea(box, o) * 30;
    cost += overlapArea(box, ownMarker) * 2000;
    const nearX = Math.max(box.l, Math.min(cx, box.r));
    const nearY = Math.max(box.t, Math.min(cy, box.b));
    const depth = r - Math.hypot(nearX - cx, nearY - cy);
    if (depth > 0) cost += depth * 70;
    if (!best || cost < best.cost) best = { cost, left: x, top: y, w, h };
  }
  return best;
}

// Trace la ligne : du centre du point, une diagonale, puis un court segment jusqu'au bord de la fiche.
function drawLeader(restart) {
  const homeBox = home.getBoundingClientRect();
  const { x: mx, y: my } = markerCenter(activeDossier.index, homeBox);
  const { left, top, w, h } = activeDossier;
  const right = left + w;
  const bottom = top + h;
  let ax, ay, ex, ey;
  if (left > mx - 6) {
    ax = left; ay = top + 22;
    ex = ax - Math.min(26, Math.abs(ax - mx) / 2); ey = ay;
  } else if (right < mx + 6) {
    ax = right; ay = top + 22;
    ex = ax + Math.min(26, Math.abs(ax - mx) / 2); ey = ay;
  } else {
    const below = top > my;
    ay = below ? top : bottom;
    ax = Math.max(left + 18, Math.min(right - 18, mx));
    ex = ax; ey = ay + (below ? -1 : 1) * Math.min(26, Math.abs(ay - my) / 2);
  }
  leaderPath.setAttribute("d", `M${mx} ${my}L${ex} ${ey}L${ax} ${ay}`);
  leaderRing.setAttribute("cx", mx);
  leaderRing.setAttribute("cy", my);
  leaderEnd.setAttribute("x", ax - 3);
  leaderEnd.setAttribute("y", ay - 3);
  const length = leaderPath.getTotalLength();
  leaderPath.style.transition = "none";
  leaderPath.style.strokeDasharray = length;
  leaderPath.style.strokeDashoffset = restart ? length : 0;
  if (restart) {
    leaderPath.getBoundingClientRect();
    leaderPath.style.transition = "";
    leaderPath.style.strokeDashoffset = 0;
  }
}

function showDossier(index) {
  if (descent || home.hidden || pins[index].marker.hidden) return;
  clearTimeout(dossierTimer);
  if (activeDossier?.index === index) return;
  const mission = missions[index];
  const info = dossierData[mission.slug];
  dossierFields.id.textContent = "MARS-OBJ-" + String(index + 1).padStart(3, "0");
  dossierFields.object.textContent = info.object;
  dossierFields.program.textContent = info.program;
  dossierFields.status.textContent = statusLabels[info.state];
  dossier.dataset.state = info.state;

  dossier.classList.remove("visible");
  leaderSvg.classList.remove("visible");
  markerLayer.classList.add("has-focus");
  pins.forEach((pin, i) => pin.marker.classList.toggle("active", i === index));

  const spot = placeDossier(index);
  activeDossier = { index, ...spot };
  dossier.style.left = spot.left + "px";
  dossier.style.top = spot.top + "px";
  const marker = markerCenter(index, home.getBoundingClientRect());
  const towardMarker = spot.left > marker.x ? -1 : spot.left + spot.w < marker.x ? 1 : 0;
  dossier.style.setProperty("--shift-x", towardMarker * 14 + "px");
  dossier.style.setProperty("--shift-y", towardMarker === 0 ? (spot.top > marker.y ? -14 : 14) + "px" : "0px");
  drawLeader(true);
  dossier.getBoundingClientRect();
  dossier.classList.add("visible");
  leaderSvg.classList.add("visible");
}

function hideDossier(immediate) {
  clearTimeout(dossierTimer);
  const run = () => {
    activeDossier = null;
    dossier.classList.remove("visible");
    leaderSvg.classList.remove("visible");
    markerLayer.classList.remove("has-focus");
    pins.forEach(pin => pin.marker.classList.remove("active"));
  };
  if (immediate) run();
  else dossierTimer = setTimeout(run, 60);
}

// Appelé à chaque rendu : la ligne suit le point si le globe bouge encore.
function syncDossier() {
  if (!activeDossier) return;
  if (pins[activeDossier.index].marker.hidden) hideDossier(true);
  else drawLeader(false);
}

pins.forEach(({ marker }, index) => {
  marker.addEventListener("pointerenter", event => {
    if (event.pointerType !== "touch") showDossier(index);
  });
  marker.addEventListener("pointerleave", () => hideDossier());
  marker.addEventListener("focus", () => {
    if (marker.matches(":focus-visible")) showDossier(index);
  });
  marker.addEventListener("blur", () => hideDossier());
});
addEventListener("resize", () => hideDossier(true));

syncRotation();
showRoute();
requestAnimationFrame(animate);

/* ---------- Quêtes : progression écrite par les mini-jeux (localStorage), secours ?done=slug ---------- */
const QUEST_KEY = "atlasMarsQuests";
const questList = document.querySelector("#quest-list");
const questCount = document.querySelector("#quest-count");
let questState = {};
function readQuests() {
  try { return JSON.parse(localStorage.getItem(QUEST_KEY) || "{}") || {}; } catch { return {}; }
}
const questRows = missions.map(mission => {
  const item = document.createElement("li");
  item.innerHTML = `<span class="box" aria-hidden="true">✓</span><span class="txt">Complete the ${mission.name} mission</span><span class="sr-only status"></span>`;
  questList.append(item);
  return item;
});
function renderQuests(justDone) {
  questState = { ...questState, ...readQuests() };
  let count = 0;
  missions.forEach((mission, index) => {
    const done = Boolean(questState[mission.slug]);
    const row = questRows[index];
    if (done) count++;
    row.classList.toggle("done", done);
    row.querySelector(".status").textContent = done ? "Completed" : "Not completed";
    if (done && mission.slug === justDone) { row.classList.remove("fresh"); void row.offsetWidth; row.classList.add("fresh"); }
  });
  questCount.textContent = count + " / " + missions.length + " completed";
}
const doneParam = new URLSearchParams(location.search).get("done");
if (doneParam && missions.some(mission => mission.slug === doneParam)) {
  questState[doneParam] = true;
  try { localStorage.setItem(QUEST_KEY, JSON.stringify({ ...readQuests(), ...questState })); } catch {}
  history.replaceState(history.state, "", location.pathname + location.hash);
}
renderQuests(doneParam);
window.addEventListener("storage", event => { if (event.key === QUEST_KEY) renderQuests(); });
window.addEventListener("pageshow", () => renderQuests());
window.addEventListener("focus", () => renderQuests());
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderQuests(); });
