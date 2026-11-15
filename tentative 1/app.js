const missions = [
  {name:"Spirit", year:2004, site:"Cratère Gusev", lat:-14.57, lon:175.47, title:"Une roue révèle un sol riche en silice", story:"En 2007, une roue bloquée creuse une tranchée près de Home Plate. Spirit y met au jour un sol presque composé de silice pure, probablement formé dans un environnement où l’eau était présente.", source:"https://science.nasa.gov/resource/rovers-wheel-churns-up-bright-martian-soil/"},
  {name:"Phoenix", year:2008, site:"Vastitas Borealis", lat:68.22, lon:-125.75, title:"De la glace sous la surface arctique", story:"Le bras robotique de Phoenix creuse le sol près du pôle nord martien. La mission confirme la présence de glace d’eau sous la surface et détecte aussi du perchlorate dans le sol.", source:"https://science.nasa.gov/mission/phoenix/"},
  {name:"Sojourner", year:1997, site:"Ares Vallis", lat:19.13, lon:-33.22, title:"Le premier rover sur Mars", story:"Déployé par l’atterrisseur Pathfinder dans Ares Vallis, Sojourner examine des roches et des sols d’une ancienne plaine d’inondation. Ses observations contribuent à étudier l’histoire géologique et climatique de Mars.", source:"https://science.nasa.gov/mission/mars-pathfinder/"},
  {name:"Ingenuity", year:2021, site:"Cratère Jezero", lat:18.44, lon:77.45, title:"Le premier vol motorisé sur une autre planète", story:"Transporté sous le rover Perseverance, Ingenuity réalise en 2021 le premier vol motorisé et contrôlé sur une autre planète. Prévu pour cinq vols, l’hélicoptère en effectue 72 avant la fin de sa mission en 2024.", source:"https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/"}
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
const storySource = document.querySelector("#story-source");

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
  marker.setAttribute("aria-label", mission.name + " sur le globe");
  const label = document.createElement("span");
  label.textContent = mission.name;
  marker.append(label);
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
  rotation.textContent = rotating ? "Pause" : "Reprendre";
  rotation.setAttribute("aria-label", rotating ? "Mettre la rotation en pause" : "Relancer la rotation");
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
    storySource.href = mission.source;
    document.title = mission.name + " — Atlas Mars";
    window.scrollTo(0, 0);
    surfaceTitle.focus({ preventScroll: true });
  } else {
    document.title = "Atlas Mars — Les traces de l’exploration";
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
  const longitude = Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) / radians);
  const latitude = Math.round(tilt / radians);
  longitudeReadout.textContent = `${Math.abs(latitude)}° ${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude)}° ${longitude < 0 ? "O" : "E"}`;
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

syncRotation();
showRoute();
requestAnimationFrame(animate);
