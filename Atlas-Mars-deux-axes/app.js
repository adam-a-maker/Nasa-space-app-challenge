const missions = [
  {name:"Viking 1", year:1976, site:"Chryse Planitia", lat:22.27, lon:-47.95, title:"Le sol martien à l’épreuve", story:"Viking 1 prélève de la terre avec son bras robotique et la confie à trois expériences. Les résultats suscitent un débat, mais ils ne suffisent pas à établir la présence de vie.", source:"https://science.nasa.gov/mission/viking-1/"},
  {name:"Pathfinder", year:1997, site:"Ares Vallis", lat:19.13, lon:-33.22, title:"Le premier rover à rouler sur Mars", story:"Le petit Sojourner descend de son atterrisseur et va examiner les roches. Son spectromètre révèle la présence de silicium et d’autres éléments, donnant aux chercheurs des indices sur leur composition.", source:"https://science.nasa.gov/mission/mars-pathfinder/"},
  {name:"Opportunity", year:2004, site:"Meridiani Planum", lat:-1.95, lon:-5.53, title:"Des roches qui racontent l’eau", story:"Opportunity approche ses instruments des roches d’un petit cratère. Il y trouve des minéraux et des traces dans les couches rocheuses qui indiquent que de l’eau liquide a autrefois circulé ici.", source:"https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/"},
  {name:"Phoenix", year:2008, site:"Vastitas Borealis", lat:68.22, lon:-125.75, title:"De la glace sous la poussière", story:"Le bras de Phoenix creuse près du pôle nord martien. Des fragments clairs disparaissent après quelques jours et l’analyse d’un prélèvement confirme la présence d’eau sous forme de glace.", source:"https://science.nasa.gov/mission/phoenix/"},
  {name:"Curiosity", year:2012, site:"Cratère Gale", lat:-4.59, lon:137.44, title:"Au fond d’un ancien lac", story:"Curiosity fore une roche et analyse la poudre. Les minéraux et les couches de sédiments racontent l’histoire d’un ancien lac qui réunissait des conditions favorables à la vie microbienne.", source:"https://science.nasa.gov/mission/msl-curiosity/"},
  {name:"Perseverance", year:2021, site:"Cratère Jezero", lat:18.44, lon:77.45, title:"Des échantillons pour une enquête future", story:"Dans un cratère où une rivière se jetait autrefois dans un lac, Perseverance prélève des carottes de roche. Ces échantillons pourraient aider à chercher des traces de vie ancienne.", source:"https://science.nasa.gov/mission/mars-2020-perseverance/"}
];

const radians = Math.PI / 180;
const size = 520;
const radius = size / 2;
const fullTurn = 2 * Math.PI;
const maximumTilt = 90 * radians;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const canvas = document.querySelector("#globe");
canvas.width = canvas.height = size;
const context = canvas.getContext("2d");
const frame = context.createImageData(size, size);
const markerLayer = document.querySelector("#markers");
const list = document.querySelector("#mission-list");
const story = document.querySelector("#story");
const rotation = document.querySelector("#rotation");
const longitudeReadout = document.querySelector("#longitude");

let angle = -26 * radians;
let tilt = 9 * radians;
let projectedTilt;
let selected = 2;
let rotating = !reducedMotion.matches;
let drag = null;
let target = null;
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
  marker.setAttribute("aria-label", mission.name + " sur le globe");
  const label = document.createElement("span");
  label.textContent = mission.name;
  marker.append(label);
  marker.addEventListener("click", () => selectMission(index, false));
  markerLayer.append(marker);

  const row = document.createElement("button");
  row.type = "button";
  row.className = "mission";
  row.innerHTML = `<small>${String(index+1).padStart(2,"0")}</small><span>${mission.name}</span><span class="year">${mission.year}</span>`;
  row.addEventListener("click", () => selectMission(index, true));
  list.append(row);
  return { marker, row };
});

function syncRotation() {
  rotation.innerHTML = rotating ? "<span>Pause</span>" : "<span>Reprendre</span>";
  rotation.setAttribute("aria-label", rotating ? "Mettre la rotation en pause" : "Relancer la rotation");
}

function showMission() {
  const mission = missions[selected];
  story.innerHTML = `<div class="story-site">${mission.site}</div><h3>${mission.title}</h3><p>${mission.story}</p><a href="${mission.source}" target="_blank" rel="noopener">Fiche NASA</a>`;
  pins.forEach(({marker,row}, index) => {
    marker.classList.toggle("active", index === selected);
    row.setAttribute("aria-pressed", index === selected);
  });
}

function selectMission(index, center) {
  selected = index;
  rotating = false;
  target = center ? { angle: missions[index].lon * radians, tilt: missions[index].lat * radians } : null;
  if (target && reducedMotion.matches) finishCentering();
  syncRotation();
  showMission();
  dirty = true;
}

rotation.addEventListener("click", () => {
  rotating = !rotating;
  target = null;
  syncRotation();
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

function draw() {
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
    const latitude = mission.lat * radians;
    const meridian = mission.lon * radians - angle;
    const x = Math.cos(latitude)*Math.sin(meridian);
    const north = Math.sin(latitude);
    const equator = Math.cos(latitude)*Math.cos(meridian);
    const y = north * cosTilt - equator * sinTilt;
    const depth = north * sinTilt + equator * cosTilt;
    const pin = pins[index].marker;
    pin.hidden = depth < 0.15;
    pin.style.left = `${50+50*x}%`;
    pin.style.top = `${50-50*y}%`;
  });
  const longitude = Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) / radians);
  const latitude = Math.round(tilt / radians);
  longitudeReadout.textContent = `${Math.abs(latitude)}° ${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude)}° ${longitude < 0 ? "O" : "E"}`;
}

function finishCentering() {
  ({ angle, tilt } = target);
  target = null;
  dirty = true;
}

function animate(time) {
  const elapsed = Math.min(time - (previousTime ?? time), 50);
  previousTime = time;
  if (target !== null) {
    const horizontal = target.angle - angle;
    const longitudeDelta = Math.atan2(Math.sin(horizontal), Math.cos(horizontal));
    const latitudeDelta = target.tilt - tilt;
    const progress = 1 - Math.exp(-elapsed / 115);
    angle += longitudeDelta * progress;
    tilt += latitudeDelta * progress;
    if (Math.abs(longitudeDelta) < 0.004 && Math.abs(latitudeDelta) < 0.004) finishCentering();
    dirty = true;
  } else if (rotating && !drag && !markerLayer.querySelector(":hover, :focus-visible")) {
    angle += elapsed * 0.00023;
    dirty = true;
  }
  if (dirty) {
    draw();
    dirty = false;
  }
  requestAnimationFrame(animate);
}

canvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  target = null;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", event => {
  if (drag?.id !== event.pointerId) return;
  const sensitivity = Math.PI / canvas.clientWidth;
  turnGlobe((drag.x - event.clientX) * sensitivity, (event.clientY - drag.y) * sensitivity);
  drag.x = event.clientX;
  drag.y = event.clientY;
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
canvas.addEventListener("keydown", event => {
  const step = arrowSteps.get(event.key);
  if (!step) return;
  event.preventDefault();
  rotating = false;
  target = null;
  turnGlobe(step[0] * radians, step[1] * radians);
  syncRotation();
});

reducedMotion.addEventListener("change", event => {
  if (!event.matches) return;
  rotating = false;
  if (target) finishCentering();
  syncRotation();
});

showMission();
syncRotation();
requestAnimationFrame(animate);
