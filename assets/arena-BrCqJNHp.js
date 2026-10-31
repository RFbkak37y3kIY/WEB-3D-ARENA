import{i as e,n as t,r as n}from"./mobile-controls-CERcSp5f.js";var r=`#version 300 es\r
    precision mediump float;\r
    in vec2 position;\r
    void main() { gl_Position = vec4(position, 0.0, 1.0); }\r
`,i=`#version 300 es\r
precision mediump float;\r
precision mediump int;\r
precision mediump sampler2D;\r
out vec4 color;\r
uniform sampler2D u_map;\r
uniform sampler2D u_floor;\r
uniform sampler2D u_sky;\r
uniform vec2 u_resolution;\r
uniform vec3 u_camera;\r
uniform mat3 u_basis;\r
uniform float u_time;\r
uniform float u_graniteScale;\r
uniform vec3 u_graniteBase;\r
uniform vec3 u_graniteDark;\r
uniform vec3 u_graniteLight;\r
// Exponential projection is paused during hybrid wall rendering.\r
// uniform float u_k;\r
uniform bool u_accelerate;\r
uniform int u_collected;\r
uniform vec3 u_cores[5];\r
uniform vec3 u_fires[3];\r
uniform vec3 u_exit;\r
const float CELL = 2.6;\r
const float FAR = 56.0;\r
const float FLOOR_HEIGHT = 4.0;\r
const float WALL_HEIGHT = 3.8;\r
const float STAIR_MIN_X = 3.0 * CELL;\r
const float STAIR_MAX_X = 8.0 * CELL;\r
const float STAIR_STEPS = 12.0;\r
const vec2 POOL_MIN = vec2(8.0, 9.0) * CELL;\r
const vec2 POOL_MAX = vec2(10.0, 11.0) * CELL;\r
const vec2 POOL_RIPPLE_CENTERS[4] = vec2[4](\r
  vec2(0.0, 0.0), vec2(1.5, 2.3), vec2(-2.1, 1.1), vec2(0.8, -1.8));\r
const vec3 POOL_RIPPLE_PARAMETERS[4] = vec3[4](\r
  vec3(0.015, 12.0, 3.5), vec3(0.010, 18.0, 4.2),\r
  vec3(0.008, 22.0, 5.0), vec3(0.012, 15.0, 3.8));\r
\r
struct WaterSurface {\r
  float height;\r
  vec3 normal;\r
};\r
\r
bool wall(ivec2 cell) {\r
  if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, textureSize(u_map, 0)))) return true;\r
  return texelFetch(u_map, cell, 0).r > 0.5;\r
}\r
\r
float box(vec2 p, vec2 halfSize) {\r
  vec2 d = abs(p) - halfSize;\r
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);\r
}\r
\r
float box3(vec3 p, vec3 halfSize) {\r
  vec3 d = abs(p) - halfSize;\r
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);\r
}\r
\r
bool inFlight0(vec2 xz) {\r
  return xz.x >= STAIR_MIN_X && xz.x < STAIR_MAX_X &&\r
    xz.y >= 13.0 * CELL && xz.y < 14.0 * CELL;\r
}\r
\r
bool inFlight1(vec2 xz) {\r
  return xz.x >= STAIR_MIN_X && xz.x < STAIR_MAX_X &&\r
    xz.y >= 12.0 * CELL && xz.y < 13.0 * CELL;\r
}\r
\r
bool inPool(vec2 xz) {\r
  return all(greaterThanEqual(xz, POOL_MIN)) && all(lessThan(xz, POOL_MAX));\r
}\r
\r
float stairProgress0(float x) { return clamp((x - STAIR_MIN_X) / (STAIR_MAX_X - STAIR_MIN_X), 0.0, 1.0); }\r
float stairProgress1(float x) { return clamp((STAIR_MAX_X - x) / (STAIR_MAX_X - STAIR_MIN_X), 0.0, 1.0); }\r
\r
float poolRipple(vec2 gridPos, vec2 center, vec3 parameters) {\r
  float distanceToCenter = length(gridPos - center);\r
  return sin(distanceToCenter * parameters.y - u_time * parameters.z)\r
    * parameters.x / (1.0 + distanceToCenter * 0.5);\r
}\r
\r
float poolRippleHeight(vec2 gridPos) {\r
  float height = 0.0;\r
  for (int i = 0; i < 4; i++) {\r
    height += poolRipple(gridPos, POOL_RIPPLE_CENTERS[i], POOL_RIPPLE_PARAMETERS[i]);\r
  }\r
  return height;\r
}\r
\r
WaterSurface waterSurface(vec2 worldXZ) {\r
  vec2 poolCenter = (POOL_MIN + POOL_MAX) * 0.5;\r
  vec2 gridPos = worldXZ - poolCenter;\r
  const float delta = 0.01;\r
  float height = poolRippleHeight(gridPos);\r
  float hR = poolRippleHeight(gridPos + vec2(delta, 0.0));\r
  float hU = poolRippleHeight(gridPos + vec2(0.0, delta));\r
  WaterSurface surface;\r
  surface.height = 0.48 + height;\r
  surface.normal = normalize(vec3(height - hR, delta, height - hU));\r
  return surface;\r
}\r
\r
vec2 sphereUv(vec3 direction) {\r
  vec3 d = normalize(direction);\r
  float denominator = 2.0 * sqrt(max(1.0 + d.y, 0.0001));\r
  return vec2(0.5) + vec2(d.x, d.z) / denominator;\r
}\r
\r
vec3 skyColor(vec3 direction) {\r
  if (direction.y < 0.0) return vec3(0.025, 0.04, 0.065);\r
  vec2 uv = sphereUv(direction);\r
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {\r
    return vec3(0.025, 0.04, 0.065);\r
  }\r
  return texture(u_sky, uv).rgb;\r
}\r
\r
void consider(inout vec2 result, float distanceValue, float material) {\r
  if (distanceValue < result.x) result = vec2(distanceValue, material);\r
}\r
\r
vec2 scene(vec3 p) {\r
  vec2 result = vec2(100.0, 2.0);\r
  vec2 xz = p.xz;\r
  bool pool = inPool(xz);\r
  if (pool && p.y < FLOOR_HEIGHT) {\r
    vec2 halfSize = (POOL_MAX - POOL_MIN) * 0.5;\r
    vec2 center = (POOL_MAX + POOL_MIN) * 0.5;\r
    consider(result, max(abs(p.y - 0.08), box(xz - center, halfSize - vec2(0.16))), 5.0);\r
  }\r
  for (int i = 0; i < 5; i++) {\r
    if ((u_collected & (1 << i)) != 0) continue;\r
    float d = length(p - (u_cores[i] + vec3(0.0, sin(u_time * 2.0 + float(i)) * 0.1, 0.0))) - 0.23;\r
    if (d < result.x) result = vec2(d, 3.0);\r
  }\r
  return result;\r
}\r
\r
vec2 rayBox(vec3 origin, vec3 direction, vec3 center, vec3 halfSize) {\r
  vec3 safeDirection = vec3(\r
    abs(direction.x) < 0.000001 ? (direction.x < 0.0 ? -0.000001 : 0.000001) : direction.x,\r
    abs(direction.y) < 0.000001 ? (direction.y < 0.0 ? -0.000001 : 0.000001) : direction.y,\r
    abs(direction.z) < 0.000001 ? (direction.z < 0.0 ? -0.000001 : 0.000001) : direction.z);\r
  vec3 inverseDirection = 1.0 / safeDirection;\r
  vec3 cornerA = (center - halfSize - origin) * inverseDirection;\r
  vec3 cornerB = (center + halfSize - origin) * inverseDirection;\r
  vec3 nearValues = min(cornerA, cornerB);\r
  vec3 farValues = max(cornerA, cornerB);\r
  float nearT = max(max(nearValues.x, nearValues.y), max(nearValues.z, 0.0));\r
  float farT = min(min(farValues.x, farValues.y), farValues.z);\r
  return vec2(nearT, farT);\r
}\r
\r
vec3 boxNormal(vec3 p, vec3 center, vec3 halfSize) {\r
  vec3 local = p - center;\r
  vec3 faceDistance = abs(abs(local) - halfSize);\r
  if (faceDistance.x < faceDistance.y && faceDistance.x < faceDistance.z) return vec3(sign(local.x), 0.0, 0.0);\r
  if (faceDistance.y < faceDistance.z) return vec3(0.0, sign(local.y), 0.0);\r
  return vec3(0.0, 0.0, sign(local.z));\r
}\r
\r
vec4 tracePoolRim(vec3 origin, vec3 direction) {\r
  vec2 poolHalfSize = (POOL_MAX - POOL_MIN) * 0.5;\r
  vec2 poolCenter = (POOL_MIN + POOL_MAX) * 0.5;\r
  float side = 0.16, wallY = 0.27;\r
  vec3 center = vec3(poolCenter.x, wallY, poolCenter.y);\r
  vec3 outerHalfSize = vec3(poolHalfSize.x, wallY, poolHalfSize.y);\r
  vec2 outerInterval = rayBox(origin, direction, center, outerHalfSize);\r
  if (outerInterval.y < outerInterval.x || outerInterval.x > FAR) return vec4(FAR, vec3(0.0));\r
\r
  vec3 outerPoint = origin + direction * outerInterval.x;\r
  vec3 pointFromCenter = outerPoint - center;\r
  vec3 normal;\r
  float hitDistance;\r
  vec3 innerHalfSize = vec3(poolHalfSize.x - side, wallY, poolHalfSize.y - side);\r
  bool entersRim = abs(pointFromCenter.x) >= innerHalfSize.x ||\r
    abs(pointFromCenter.z) >= innerHalfSize.z;\r
  if (entersRim) {\r
    hitDistance = outerInterval.x;\r
    normal = boxNormal(outerPoint, center, outerHalfSize);\r
  } else {\r
    vec2 innerInterval = rayBox(origin, direction, center, innerHalfSize);\r
    if (innerInterval.y < innerInterval.x || innerInterval.y > outerInterval.y ||\r
      innerInterval.y > FAR) return vec4(FAR, vec3(0.0));\r
    hitDistance = innerInterval.y;\r
    normal = -boxNormal(origin + direction * hitDistance, center, innerHalfSize);\r
    if (abs(normal.y) > 0.5) return vec4(FAR, vec3(0.0));\r
  }\r
  return vec4(hitDistance, normal);\r
}\r
\r
vec4 tracePool(vec3 origin, vec3 direction) {\r
  vec2 poolHalfSize = (POOL_MAX - POOL_MIN) * 0.5;\r
  vec2 poolCenter = (POOL_MAX + POOL_MIN) * 0.5;\r
  vec3 center = vec3(poolCenter.x, 0.31, poolCenter.y);\r
  vec3 halfSize = vec3(poolHalfSize.x, 0.23, poolHalfSize.y);\r
  vec2 interval = rayBox(origin, direction, center, halfSize);\r
  if (interval.y < interval.x || interval.x > FAR) return vec4(FAR, vec3(0.0));\r
\r
  float low = interval.x, high = min(interval.y, FAR);\r
  vec3 lowPoint = origin + direction * low;\r
  vec3 highPoint = origin + direction * high;\r
  float lowSide = lowPoint.y - waterSurface(lowPoint.xz).height;\r
  float highSide = highPoint.y - waterSurface(highPoint.xz).height;\r
  if (lowSide * highSide > 0.0) return vec4(FAR, vec3(0.0));\r
\r
  for (int iteration = 0; iteration < 12; iteration++) {\r
    float middle = (low + high) * 0.5;\r
    vec3 point = origin + direction * middle;\r
    float side = point.y - waterSurface(point.xz).height;\r
    if ((lowSide <= 0.0 && side <= 0.0) || (lowSide >= 0.0 && side >= 0.0)) {\r
      low = middle;\r
      lowSide = side;\r
    } else {\r
      high = middle;\r
      highSide = side;\r
    }\r
  }\r
\r
  float hitDistance = (low + high) * 0.5;\r
  vec3 hitPoint = origin + direction * hitDistance;\r
  vec2 visibleHalfSize = poolHalfSize - vec2(0.22);\r
  if (any(greaterThan(abs(hitPoint.xz - poolCenter), visibleHalfSize))) {\r
    return vec4(FAR, vec3(0.0));\r
  }\r
  return vec4(hitDistance, waterSurface(hitPoint.xz).normal);\r
}\r
\r
vec4 traceStairs(vec3 origin, vec3 direction) {\r
  float closestT = FAR;\r
  vec3 closestNormal = vec3(0.0);\r
  float stepDepth = (STAIR_MAX_X - STAIR_MIN_X) / STAIR_STEPS;\r
\r
  for (int flight = 0; flight < 2; flight++) {\r
    float base = float(flight) * FLOOR_HEIGHT;\r
    float laneZ = (12.5 + float(1 - flight)) * CELL;\r
    vec3 flightCenter = vec3((STAIR_MIN_X + STAIR_MAX_X) * 0.5,\r
      base + FLOOR_HEIGHT * 0.5, laneZ);\r
    vec2 flightInterval = rayBox(origin, direction, flightCenter,\r
      vec3((STAIR_MAX_X - STAIR_MIN_X) * 0.5, FLOOR_HEIGHT * 0.5, CELL * 0.5));\r
    if (flightInterval.y < flightInterval.x || flightInterval.x > closestT || flightInterval.x > FAR) continue;\r
\r
    for (int stepIndex = 0; stepIndex < 12; stepIndex++) {\r
      float i = float(stepIndex);\r
      float segment = flight == 0 ? i : 11.0 - i;\r
      float cx = STAIR_MIN_X + (segment + 0.5) * stepDepth;\r
      float top = base + (i + 1.0) * FLOOR_HEIGHT / STAIR_STEPS;\r
      vec3 center = vec3(cx, base + (top - base) * 0.5, laneZ);\r
      vec3 halfSize = vec3(stepDepth * 0.5, (top - base) * 0.5, CELL * 0.5);\r
      vec2 interval = rayBox(origin, direction, center, halfSize);\r
      if (interval.y >= interval.x && interval.x < closestT && interval.x <= FAR) {\r
        closestT = interval.x;\r
        closestNormal = boxNormal(origin + direction * closestT, center, halfSize);\r
      }\r
    }\r
  }\r
\r
  return vec4(closestT, closestNormal);\r
}\r
\r
vec4 tracePlanes(vec3 origin, vec3 direction) {\r
  float closestT = FAR;\r
  float material = -1.0;\r
  float normalY = 0.0;\r
  if (abs(direction.y) < 0.000001) return vec4(closestT, material, normalY, 0.0);\r
\r
  for (int level = 0; level < 3; level++) {\r
    float base = float(level) * FLOOR_HEIGHT;\r
    float floorT = (base - origin.y) / direction.y;\r
    if (floorT >= 0.0 && floorT < closestT && floorT <= FAR) {\r
      vec3 point = origin + direction * floorT;\r
      bool flight0 = inFlight0(point.xz), flight1 = inFlight1(point.xz);\r
      bool floorHole = level == 0 ? flight0 : (level == 1 ? (flight0 || flight1) : flight1);\r
      if (!floorHole && !(level == 0 && inPool(point.xz))) {\r
        closestT = floorT;\r
        material = 0.0;\r
        normalY = direction.y < 0.0 ? 1.0 : -1.0;\r
      }\r
    }\r
\r
    if (level < 2) {\r
      float ceilingT = (base + WALL_HEIGHT - origin.y) / direction.y;\r
      if (ceilingT >= 0.0 && ceilingT < closestT && ceilingT <= FAR) {\r
        vec3 point = origin + direction * ceilingT;\r
        bool ceilingHole = level == 0 ? inFlight0(point.xz) : inFlight1(point.xz);\r
        if (!ceilingHole) {\r
          closestT = ceilingT;\r
          material = 2.0;\r
          normalY = direction.y > 0.0 ? -1.0 : 1.0;\r
        }\r
      }\r
    }\r
  }\r
\r
  return vec4(closestT, material, normalY, material >= 0.0 ? 1.0 : 0.0);\r
}\r
\r
vec4 traceWalls(vec3 origin, vec3 direction) {\r
  ivec2 cell = ivec2(floor(origin.xz / CELL));\r
  ivec2 cellStep = ivec2(\r
    direction.x > 0.0 ? 1 : (direction.x < 0.0 ? -1 : 0),\r
    direction.z > 0.0 ? 1 : (direction.z < 0.0 ? -1 : 0));\r
  vec2 deltaT = vec2(\r
    abs(direction.x) > 0.000001 ? CELL / abs(direction.x) : 1e20,\r
    abs(direction.z) > 0.000001 ? CELL / abs(direction.z) : 1e20);\r
  vec2 boundary = vec2(\r
    float(cell.x + (cellStep.x > 0 ? 1 : 0)) * CELL,\r
    float(cell.y + (cellStep.y > 0 ? 1 : 0)) * CELL);\r
  vec2 sideT = vec2(\r
    abs(direction.x) > 0.000001 ? (boundary.x - origin.x) / direction.x : 1e20,\r
    abs(direction.z) > 0.000001 ? (boundary.y - origin.z) / direction.z : 1e20);\r
  float closestT = FAR;\r
  ivec2 closestCell = ivec2(-1);\r
  int closestLevel = -1;\r
\r
  for (int stepIndex = 0; stepIndex < 40; stepIndex++) {\r
    ivec2 mapSize = textureSize(u_map, 0);\r
    if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, mapSize))) break;\r
    if (min(sideT.x, sideT.y) > closestT) break;\r
\r
    if (wall(cell)) {\r
      for (int level = 0; level < 3; level++) {\r
        float floorBase = float(level) * FLOOR_HEIGHT;\r
        vec3 center = vec3(\r
          (float(cell.x) + 0.5) * CELL,\r
          floorBase + WALL_HEIGHT * 0.5,\r
          (float(cell.y) + 0.5) * CELL);\r
        vec2 interval = rayBox(origin, direction, center,\r
          vec3(CELL * 0.5, WALL_HEIGHT * 0.5, CELL * 0.5));\r
        if (interval.y >= interval.x && interval.x < closestT && interval.x <= FAR) {\r
          closestT = interval.x;\r
          closestCell = cell;\r
          closestLevel = level;\r
        }\r
      }\r
    }\r
\r
    if (min(sideT.x, sideT.y) > FAR) break;\r
    if (sideT.x < sideT.y) {\r
      cell.x += cellStep.x;\r
      sideT.x += deltaT.x;\r
    } else {\r
      cell.y += cellStep.y;\r
      sideT.y += deltaT.y;\r
    }\r
  }\r
\r
  return vec4(closestT, vec2(closestCell), float(closestLevel));\r
}\r
\r
vec3 wallNormal(vec3 p, ivec2 cell, int level) {\r
  vec3 center = vec3(\r
    (float(cell.x) + 0.5) * CELL,\r
    float(level) * FLOOR_HEIGHT + WALL_HEIGHT * 0.5,\r
    (float(cell.y) + 0.5) * CELL);\r
  return boxNormal(p, center, vec3(CELL * 0.5, WALL_HEIGHT * 0.5, CELL * 0.5));\r
}\r
\r
vec3 normalAt(vec3 p) {\r
  const float e = 0.003;\r
  vec3 a = vec3(1,-1,-1), b = vec3(-1,-1, 1), c = vec3(-1, 1,-1), d = vec3(1, 1, 1);\r
  vec3 g = a*scene(p+a*e).x + b*scene(p+b*e).x\r
    + c*scene(p+c*e).x + d*scene(p+d*e).x;\r
  return length(g)>1e-20 ? g/length(g) : -u_basis[2];\r
}\r
\r
vec3 path(vec2 uv, float z) {\r
  return u_camera + u_basis * vec3(uv * z, z);\r
  // Previous nonlinear projection, retained for the experiment:\r
  // return u_camera + u_basis * vec3(uv * z * exp2(z * u_k), z);\r
}\r
\r
float speed(vec2 uv, float z) {\r
  return length(vec3(uv, 1.0));\r
  // Previous nonlinear speed bound:\r
  // float s = exp2(z * u_k) * (1.0 + z * u_k * 0.69314718);\r
  // return length(vec3(uv * s, 1.0));\r
}\r
\r
float adaptiveDepth(float z, float distanceValue, vec2 uv, float end) {\r
  float worldStep = min(distanceValue*0.85, distanceValue);\r
  float candidate = min(z+worldStep, end);\r
  return min(z+worldStep/speed(uv, candidate), end);\r
}\r
\r
float hash(vec3 p) {\r
  p = fract(p * 0.3183099 + 0.1) * 17.0;\r
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));\r
}\r
\r
float noise(vec3 p) {\r
  vec3 b = floor(p), f = fract(p);\r
  vec3 t = f * f * (3.0 - 2.0 * f);\r
  return mix(\r
    mix(mix(hash(b), hash(b + vec3(1, 0, 0)), t.x),\r
        mix(hash(b + vec3(0, 1, 0)), hash(b + vec3(1, 1, 0)), t.x), t.y),\r
    mix(mix(hash(b + vec3(0, 0, 1)), hash(b + vec3(1, 0, 1)), t.x),\r
        mix(hash(b + vec3(0, 1, 1)), hash(b + vec3(1, 1, 1)), t.x), t.y), t.z);\r
}\r
\r
vec2 hash2(vec2 p) {\r
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));\r
  return fract(sin(p) * 43758.5453123);\r
}\r
\r
float voronoi(vec2 p) {\r
  vec2 cell = floor(p), local = fract(p);\r
  float minDistance = 1.0;\r
  for (int j = -1; j <= 1; j++) {\r
    for (int i = -1; i <= 1; i++) {\r
      vec2 offset = vec2(float(i), float(j));\r
      vec2 feature = hash2(cell + offset);\r
      vec2 delta = offset + feature - local;\r
      minDistance = min(minDistance, dot(delta, delta));\r
    }\r
  }\r
  return sqrt(minDistance);\r
}\r
\r
float graniteNoise(vec2 p) {\r
  vec2 cell = floor(p), local = fract(p);\r
  vec2 blend = local * local * (3.0 - 2.0 * local);\r
  float n00 = dot(hash2(cell), local);\r
  float n10 = dot(hash2(cell + vec2(1.0, 0.0)), local - vec2(1.0, 0.0));\r
  float n01 = dot(hash2(cell + vec2(0.0, 1.0)), local - vec2(0.0, 1.0));\r
  float n11 = dot(hash2(cell + vec2(1.0, 1.0)), local - vec2(1.0, 1.0));\r
  return mix(mix(n00, n10, blend.x), mix(n01, n11, blend.x), blend.y) + 0.5;\r
}\r
\r
vec3 granitePlanar(vec2 worldUv) {\r
  vec2 uv = worldUv * u_graniteScale;\r
  float fineGrain = voronoi(uv * 2.5);\r
  float crystalGrain = voronoi(uv * 5.0 + 9.31);\r
  float mineralVariation = graniteNoise(uv * 0.3);\r
  vec3 colorValue = u_graniteBase;\r
  colorValue = mix(colorValue, u_graniteDark, 1.0 - smoothstep(0.0, 0.3, fineGrain));\r
  colorValue = mix(colorValue, u_graniteLight, 1.0 - smoothstep(0.0, 0.2, crystalGrain));\r
  return max(colorValue - vec3(mineralVariation * 0.12), vec3(0.0));\r
}\r
\r
vec3 graniteTriplanar(vec3 worldPosition, vec3 worldNormal) {\r
  vec3 weights = pow(abs(normalize(worldNormal)), vec3(4.0));\r
  weights /= max(weights.x + weights.y + weights.z, 0.0001);\r
  vec3 xProjection = granitePlanar(worldPosition.zy);\r
  vec3 yProjection = granitePlanar(worldPosition.xz);\r
  vec3 zProjection = granitePlanar(worldPosition.xy);\r
  return xProjection * weights.x + yProjection * weights.y + zProjection * weights.z;\r
}\r
\r
float fireDensity(vec3 p) {\r
  vec3 q = p / vec3(0.65, 1.0, 0.65);\r
  float envelope = 1.0 - dot(q, q);\r
  if (envelope <= 0.0) return 0.0;\r
  float h = clamp(q.y * 0.5 + 0.5, 0.0, 1.0);\r
  p.x += sin(u_time * 1.7 + p.y * 3.0) * 0.09 * h;\r
  float radial = 1.0 - smoothstep(0.05, mix(0.56, 0.10, h), length(p.xz));\r
  if (radial <= 0.0) return 0.0;\r
  return envelope * radial * smoothstep(0.25, 0.75, noise(p * 4.0 - vec3(0, u_time * 2.5, 0))) * 2.0;\r
}\r
\r
vec3 firePass(vec3 background, vec2 uv, float depth) {\r
  // One shared interval keeps samples ordered even when fire volumes overlap in camera Z.\r
  float begin = FAR, end = 0.0;\r
  for (int i = 0; i < 3; i++) {\r
    vec3 c = transpose(u_basis) * (u_fires[i] - u_camera);\r
    float extent = length(vec3(0.65, 1.0, 0.65) * u_basis[2]);\r
    float lo = max(0.0, c.z - extent), hi = min(depth, c.z + extent);\r
    if (hi > lo) { begin = min(begin, lo); end = max(end, hi); }\r
  }\r
  if (end <= begin) return background;\r
  float dz = (end - begin) / 8.0;\r
  float transmission = 1.0;\r
  vec3 glow = vec3(0.0);\r
  for (int sampleIndex = 0; sampleIndex < 8; sampleIndex++) {\r
    float z = begin + (float(sampleIndex) + 0.5) * dz;\r
    vec3 p = path(uv, z);\r
    float density = 0.0;\r
    for (int i = 0; i < 3; i++) density += fireDensity(p - u_fires[i]);\r
    float alpha = 1.0 - exp(-density * dz * speed(uv, z));\r
    vec3 emission = mix(vec3(1.0, 0.12, 0.015), vec3(1.0, 0.85, 0.35), clamp(density, 0.0, 1.0)) * 1.8;\r
    glow += transmission * alpha * emission * exp(-z * 0.045);\r
    transmission *= 1.0 - alpha;\r
  }\r
  return glow + transmission * background;\r
}\r
\r
void main() {\r
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);\r
  vec3 rayDirection = u_basis * vec3(uv, 1.0);\r
  vec4 wallHit = traceWalls(u_camera, rayDirection);\r
  vec4 stairHit = traceStairs(u_camera, rayDirection);\r
  vec4 planeHit = tracePlanes(u_camera, rayDirection);\r
  vec4 poolHit = tracePool(u_camera, rayDirection);\r
  vec4 rimHit = tracePoolRim(u_camera, rayDirection);\r
  bool stairFirst = stairHit.x < (wallHit.w >= 0.0 ? wallHit.x : FAR);\r
  bool poolFirst = poolHit.x < FAR && poolHit.x <\r
    min(min(wallHit.w >= 0.0 ? wallHit.x : FAR, stairHit.x),\r
      min(planeHit.w > 0.0 ? planeHit.x : FAR, rimHit.x));\r
  bool planeFirst = planeHit.w > 0.0 &&\r
    planeHit.x < min(min(wallHit.w >= 0.0 ? wallHit.x : FAR, stairHit.x),\r
      min(poolHit.x, rimHit.x));\r
  bool rimFirst = rimHit.x < FAR &&\r
    rimHit.x < min(min(wallHit.w >= 0.0 ? wallHit.x : FAR, stairHit.x),\r
      min(planeHit.w > 0.0 ? planeHit.x : FAR, poolHit.x));\r
  float traceEnd = min(min(wallHit.w >= 0.0 ? wallHit.x : FAR, stairHit.x),\r
    min(min(planeHit.w > 0.0 ? planeHit.x : FAR, poolHit.x), rimHit.x));\r
  float z = 0.01;\r
  bool hit = false;\r
  bool numericalStop = false, pending = false, relax = u_accelerate;\r
  float safeZ = 0.0, savedDistance = 0.0, travel = 0.0;\r
  vec2 info = vec2(0.0);\r
  vec3 p = u_camera;\r
  for (int i = 0; i < 100; i++) {\r
    if (z > traceEnd) break;\r
    p = path(uv, z);\r
    info = scene(p);\r
    if (isnan(info.x) || isinf(info.x)) { numericalStop = true; break; }\r
    if (pending) {\r
      pending = false;\r
      if (0.85*(savedDistance+max(info.x, 0.0))<travel) {\r
        z = safeZ; relax = false; continue;\r
      }\r
    }\r
    if (info.x < 0.006) { hit = true; break; }\r
    if (z >= traceEnd) break;\r
    float nextZ = adaptiveDepth(z, info.x, uv, traceEnd);\r
    if (relax) {\r
      safeZ = nextZ;\r
      float candidate = min(z+info.x*1.6, traceEnd);\r
      float maxSpeed = speed(uv, candidate);\r
      nextZ = min(z+info.x*1.6/maxSpeed, traceEnd);\r
      travel = (nextZ-z)*maxSpeed;\r
      savedDistance = info.x; pending = true;\r
    }\r
    if (nextZ<=z || isnan(nextZ) || isinf(nextZ)) { numericalStop = true; break; }\r
    z = nextZ;\r
  }\r
  if (!hit && rimFirst) {\r
    z = rimHit.x;\r
    p = path(uv, z);\r
    info = vec2(0.0, 5.0);\r
    hit = true;\r
  } else if (!hit && poolFirst) {\r
    z = poolHit.x;\r
    p = path(uv, z);\r
    info = vec2(0.0, 4.0);\r
    hit = true;\r
  } else if (!hit && planeFirst) {\r
    z = planeHit.x;\r
    p = path(uv, z);\r
    info = vec2(0.0, planeHit.y);\r
    hit = true;\r
  } else if (!hit && stairFirst) {\r
    z = stairHit.x;\r
    p = path(uv, z);\r
    info = vec2(0.0, 6.0);\r
    hit = true;\r
  } else if (!hit && wallHit.w >= 0.0) {\r
    z = wallHit.x;\r
    p = path(uv, z);\r
    info = vec2(0.0, 1.0);\r
    hit = true;\r
  }\r
  vec3 result = vec3(0.025, 0.04, 0.065);\r
  if (hit) {\r
    vec3 n = normalAt(p);\r
    if (info.y == 1.0) n = wallNormal(p, ivec2(wallHit.yz), int(wallHit.w));\r
    if (info.y == 6.0 && stairFirst) n = stairHit.yzw;\r
    if (planeFirst) n = vec3(0.0, planeHit.z, 0.0);\r
    if (info.y == 4.0 && poolFirst) n = poolHit.yzw;\r
    if (info.y == 5.0 && rimFirst) n = rimHit.yzw;\r
    if (info.y == 4.0) n = waterSurface(p.xz).normal;\r
    vec3 albedo = vec3(0.13, 0.17, 0.20);\r
    float grout = 0.0;\r
    if (info.y == 1.0) {\r
      albedo = graniteTriplanar(p, n);\r
    } else if (info.y == 0.0 || info.y == 6.0) {\r
      albedo = texture(u_floor, p.xz / CELL).rgb;\r
      if (info.y == 6.0) albedo *= 0.72;\r
    } else if (info.y == 4.0) {\r
      WaterSurface surface = waterSurface(p.xz);\r
      vec3 viewDirection = normalize(u_camera - p);\r
      vec3 incident = -viewDirection;\r
      vec3 waterNormal = dot(incident, surface.normal) < 0.0 ? surface.normal : -surface.normal;\r
      vec3 refractedDirection = refract(incident, waterNormal, 1.0 / 1.333);\r
      float distanceToBasin = (surface.height - 0.08) / max(-refractedDirection.y, 0.08);\r
      vec2 refractedPoint = p.xz + refractedDirection.xz * distanceToBasin;\r
      albedo = texture(u_floor, refractedPoint / CELL).rgb * vec3(0.13, 0.52, 0.66);\r
      float rippleLight = max(dot(surface.normal, normalize(vec3(0.3, 1.0, 0.2))), 0.0);\r
      result = albedo * (0.72 + 0.08 * rippleLight);\r
    } else if (info.y == 5.0) {\r
      albedo = vec3(0.12, 0.27, 0.34);\r
    } else if (info.y == 3.0) {\r
      vec3 viewDirection = normalize(u_camera - p);\r
      vec3 waveNormal = normalize(n + 0.09 * vec3(\r
        sin(p.y * 58.0 + u_time * 2.4),\r
        sin(p.z * 51.0 - u_time * 1.9),\r
        sin(p.x * 67.0 + u_time * 2.1)));\r
      vec3 reflectedDirection = reflect(-viewDirection, waveNormal);\r
      float facing = max(dot(waveNormal, viewDirection), 0.0);\r
      float fresnel = 0.24 + 0.72 * pow(1.0 - facing, 5.0);\r
      vec2 floorUv = (p.xz + reflectedDirection.xz *\r
        (p.y / max(-reflectedDirection.y, 0.18))) / CELL;\r
      vec3 reflection = reflectedDirection.y >= 0.0\r
        ? skyColor(reflectedDirection)\r
        : texture(u_floor, floorUv).rgb * vec3(0.55, 0.72, 0.82);\r
      result = mix(vec3(0.008, 0.11, 0.16), reflection * vec3(0.72, 0.9, 1.0), fresnel);\r
      for (int i = 0; i < 3; i++) {\r
        vec3 toLight = u_fires[i] - p;\r
        float distanceToLight = length(toLight);\r
        float specular = pow(max(dot(reflectedDirection, toLight / max(distanceToLight, 0.001)), 0.0), 72.0);\r
        result += vec3(1.0, 0.48, 0.2) * specular * 4.0\r
          / (1.0 + distanceToLight * distanceToLight * 0.25);\r
      }\r
      result += vec3(0.01, 0.18, 0.23) * pow(1.0 - facing, 3.0);\r
    } else {\r
      albedo = vec3(0.13, 0.17, 0.20);\r
      vec2 tile = floor(p.xz * 1.5);\r
      albedo *= 0.75 + 0.25 * mod(tile.x + tile.y, 2.0);\r
    }\r
    if (info.y != 4.0 && info.y != 3.0) {\r
      albedo *= 1.0 - grout * 0.55;\r
      result = albedo * (0.25 + 0.45 * max(dot(n, normalize(vec3(0.4, 1.0, -0.3))), 0.0));\r
    }\r
    if (info.y != 3.0) {\r
      for (int i = 0; i < 3; i++) {\r
        vec3 toLight = u_fires[i] - p;\r
        float distanceToLight = length(toLight);\r
        float diffuse = max(dot(n, toLight / max(distanceToLight, 0.001)), 0.0);\r
        result += albedo * vec3(1.0, 0.4, 0.08) * (diffuse + 0.12) * 5.0\r
          / (1.0 + distanceToLight * distanceToLight * 0.5);\r
      }\r
    }\r
    float exitGlow = exp(-length(p - u_exit) * 1.3);\r
    result += (u_collected == 31 ? vec3(0.05, 0.8, 0.25) : vec3(0.35, 0.08, 0.02)) * exitGlow;\r
    result = mix(result, vec3(0.025, 0.04, 0.065), 1.0 - exp(-z * 0.045));\r
  } else {\r
    result = skyColor(normalize(rayDirection));\r
  }\r
  result = firePass(result, uv, hit ? z : min(z, FAR));\r
  if (!hit && numericalStop) result = vec3(1.0, 0.35, 0.025);\r
  color = vec4(pow(max(result, vec3(0.0)), vec3(0.85)), 1.0);\r
}\r
`,a=`./assets/Steel_C-CHQZxMJV.jpg`,o=`./assets/SKY-C31tPj8y.jpg`;(()=>{let s=[`###############`,`#S....#......E#`,`#.##..#.###...#`,`#.....#...#...#`,`#.##......#.#.#`,`#....##...#...#`,`###..##.......#`,`#......###....#`,`#.##...###.##.#`,`#..#..........#`,`#..#..##..##..#`,`#.....##......#`,`#.........##..#`,`#.............#`,`###############`],c=2.6,l=.22,u=3*c,d=8*c,f=[8*c,9*c],ee=[10*c,11*c],p=(e,t,n=.85,r=0)=>[(e+.5)*c,n+r*4,(t+.5)*c],m=[p(4,3),p(8,5),p(2,9,.85,1),p(12,11,.85,1),p(7,6,.85,2)],te=[p(4,5,1),p(11,6,1,1),p(11,7,1,2)],h=p(13,1,.85,2),g=document.getElementById(`view`),_=document.getElementById(`overlay`),v=document.getElementById(`play`),y=document.getElementById(`restart`),b=document.getElementById(`heading`),ne=document.getElementById(`status`),x=document.getElementById(`error`),S=document.getElementById(`textureStatus`),C=document.getElementById(`textureNotice`),w=document.getElementById(`quality`),re=document.getElementById(`distortion`),ie=document.getElementById(`accelerate`);t(document.getElementById(`fullscreenToggle`),x);let T=new Set,E={x:0,z:0,level:0,height:0,vy:0,yaw:0,pitch:0},D=0,O=!1,k=!1,A=0,j=0,M=0,N=0,P=0,F=0,I=!1;function L(e){k=!0,cancelAnimationFrame(A),T.clear(),document.pointerLockElement===g&&document.exitPointerLock(),_.hidden=!1,b.textContent=`Renderer error`,x.textContent=e,v.disabled=!0,console.error(e)}function ae(e,t){return t<0||t>=s.length||e<0||e>=s[0].length||s[t][e]===`#`}function R(e,t){return e>=u&&e<d&&t>=13*c&&t<14*c}function z(e,t){return e>=u&&e<d&&t>=12*c&&t<13*c}function B(e,t,n){if(R(t,n)&&e<=1){let e=Math.max(0,Math.min(1,(t-u)/13));return e===0?0:Math.ceil(e*12)*4/12}if(z(t,n)&&e>=1){let e=Math.max(0,Math.min(1,(d-t)/13));return 4+(e===0?0:Math.ceil(e*12)*4/12)}return e*4}function V(e,t,n,r,i){let a=R(t,n)||R(r,i),o=z(t,n)||z(r,i);if(a){if(e===0&&t<d&&r>=d)return 1;if(e===1&&t>u&&r<=u)return 0}if(o){if(e===1&&t>u&&r<=u)return 2;if(e===2&&t<d&&r>=d)return 1}return e}function oe(e,t,n=E.level,r=B(n,E.x,E.z)){if(n<0||n>2||n===0&&e>=f[0]-l&&e<ee[0]+l&&t>=f[1]-l&&t<ee[1]+l)return!0;for(let n=Math.floor((t-l)/c);n<=Math.floor((t+l)/c);n++)for(let r=Math.floor((e-l)/c);r<=Math.floor((e+l)/c);r++){if(!ae(r,n))continue;let i=Math.max(r*c,Math.min(e,(r+1)*c)),a=Math.max(n*c,Math.min(t,(n+1)*c));if((e-i)**2+(t-a)**2<l**2)return!0}return Math.abs(B(n,e,t)-r)>.3633333333333333}function H(){let e=Math.floor(E.x/c),t=Math.floor(E.z/c),n=s.map((n,r)=>[...n].map((n,i)=>i===e&&r===t?`@`:n===`#`?`#`:n===`E`?E.level===2?`E`:` `:m.some((e,t)=>!(D&1<<t)&&Math.round((e[1]-.85)/4)===E.level&&Math.floor(e[0]/c)===i&&Math.floor(e[2]/c)===r)?`*`:r===13&&i>=3&&i<8?E.level===0?`>`:E.level===1?`<`:` `:r===12&&i>=3&&i<8?E.level===1?`<`:E.level===2?`>`:` `:` `).join(``)).join(`
`);document.getElementById(`map`).textContent=`Floor ${E.level+1}/3\n${n}`}function U(){let e=D.toString(2).replace(/0/g,``).length;ne.textContent=`Floor ${E.level+1}/3 · Energy cores: ${e}/5 · ${e===5?`Exit unlocked: E on the map.`:`Collect all cores: * on the map.`}`}function se(){[E.x,,E.z]=p(1,1),E.level=0,E.height=0,E.vy=0,E.yaw=Math.PI/2,E.pitch=0,D=0,O=!1,M=0,b.textContent=`WEB 3D ARENA`,v.textContent=`Play`,y.hidden=!0,H(),U()}let W=e(g,{vertexSource:r,fragmentSource:i,onError:L});if(!W)return;let{gl:G,program:ce}=W,K={};for(let e of[`map`,`floor`,`sky`,`resolution`,`camera`,`basis`,`time`,`graniteScale`,`graniteBase`,`graniteDark`,`graniteLight`,`accelerate`,`collected`,`cores[0]`,`fires[0]`,`exit`])K[e]=G.getUniformLocation(ce,`u_${e}`);G.uniform1f(K.graniteScale,1.6),G.uniform3f(K.graniteBase,.65,.63,.62),G.uniform3f(K.graniteDark,.15,.15,.16),G.uniform3f(K.graniteLight,.85,.83,.8);let q=G.createTexture();if(!q){L(`Failed to create the map texture.`),W.dispose();return}G.bindTexture(G.TEXTURE_2D,q),G.pixelStorei(G.UNPACK_ALIGNMENT,1),G.texImage2D(G.TEXTURE_2D,0,G.R8,s[0].length,s.length,0,G.RED,G.UNSIGNED_BYTE,new Uint8Array(s.join(``).split(``).map(e=>e===`#`?255:0))),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MIN_FILTER,G.NEAREST),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MAG_FILTER,G.NEAREST),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_S,G.CLAMP_TO_EDGE),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_T,G.CLAMP_TO_EDGE),G.uniform1i(K.map,0);let J=G.createTexture();if(!J){L(`Failed to create the floor texture.`),W.dispose();return}G.activeTexture(G.TEXTURE1),G.bindTexture(G.TEXTURE_2D,J),G.texImage2D(G.TEXTURE_2D,0,G.RGBA8,1,1,0,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array([95,105,115,255])),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MIN_FILTER,G.LINEAR_MIPMAP_LINEAR),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MAG_FILTER,G.LINEAR),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_S,G.REPEAT),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_T,G.REPEAT),G.generateMipmap(G.TEXTURE_2D),G.uniform1i(K.floor,1);let Y=G.createTexture();if(!Y){L(`Failed to create the sky texture.`),W.dispose();return}G.activeTexture(G.TEXTURE2),G.bindTexture(G.TEXTURE_2D,Y),G.texImage2D(G.TEXTURE_2D,0,G.RGBA8,1,1,0,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array([18,30,48,255])),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MIN_FILTER,G.LINEAR_MIPMAP_LINEAR),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_MAG_FILTER,G.LINEAR),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_S,G.CLAMP_TO_EDGE),G.texParameteri(G.TEXTURE_2D,G.TEXTURE_WRAP_T,G.CLAMP_TO_EDGE),G.generateMipmap(G.TEXTURE_2D),G.uniform1i(K.sky,2),G.activeTexture(G.TEXTURE0);let X=new Image;X.onload=()=>{k||(G.activeTexture(G.TEXTURE1),G.bindTexture(G.TEXTURE_2D,J),G.pixelStorei(G.UNPACK_FLIP_Y_WEBGL,!0),G.texImage2D(G.TEXTURE_2D,0,G.RGBA8,G.RGBA,G.UNSIGNED_BYTE,X),G.generateMipmap(G.TEXTURE_2D),G.pixelStorei(G.UNPACK_FLIP_Y_WEBGL,!1),G.activeTexture(G.TEXTURE0),S.textContent=`Steel floor loaded · ${X.naturalWidth}×${X.naturalHeight} · one tile per cell`,C.textContent=``)},X.onerror=()=>{let e=`Failed to load Steel_C.jpg; using the fallback floor color.`;S.textContent=e,C.textContent=e,x.textContent=e,console.error(e,a)},X.src=a;let Z=new Image;Z.onload=()=>{k||(G.activeTexture(G.TEXTURE2),G.bindTexture(G.TEXTURE_2D,Y),G.pixelStorei(G.UNPACK_FLIP_Y_WEBGL,!0),G.texImage2D(G.TEXTURE_2D,0,G.RGBA8,G.RGBA,G.UNSIGNED_BYTE,Z),G.generateMipmap(G.TEXTURE_2D),G.pixelStorei(G.UNPACK_FLIP_Y_WEBGL,!1),G.activeTexture(G.TEXTURE0),S.textContent+=` · sky ${Z.naturalWidth}×${Z.naturalHeight}`)},Z.onerror=()=>{let e=`Failed to load SKY.jpg; using the dark fallback background.`;C.textContent=[C.textContent,e].filter(Boolean).join(` `),x.textContent=[x.textContent,e].filter(Boolean).join(` `),console.error(e,o)},Z.src=o,window.addEventListener(`pagehide`,e=>{e.persisted||(G.deleteTexture(q),G.deleteTexture(J),G.deleteTexture(Y))}),G.uniform3fv(K[`cores[0]`],new Float32Array(m.flat())),G.uniform3fv(K[`fires[0]`],new Float32Array(te.flat())),G.uniform3fv(K.exit,h);let le=new Set([`KeyW`,`KeyA`,`KeyS`,`KeyD`,`ArrowUp`,`ArrowDown`,`ArrowLeft`,`ArrowRight`,`ShiftLeft`,`ShiftRight`,`Space`]),Q=n({canvas:g,onMove:(e,t)=>{for(let[n,r]of[[`KeyA`,e<-.25],[`KeyD`,e>.25],[`KeyW`,t>.25],[`KeyS`,t<-.25]])r?T.add(n):T.delete(n)},onLook:(e,t)=>{E.yaw=(E.yaw+e*.003)%(2*Math.PI),E.pitch=Math.max(-1.35,Math.min(1.35,E.pitch-t*.003))},actions:[{label:`Sprint`,onDown:()=>T.add(`ShiftLeft`),onUp:()=>T.delete(`ShiftLeft`)},{label:`Jump`,onDown:()=>{I&&E.height===0&&(E.vy=4)}},{label:`Pause`,onDown:()=>{I=!1,T.clear(),Q.setActive(!1),_.hidden=!1,v.textContent=`Continue`}}]});document.addEventListener(`keydown`,e=>{document.pointerLockElement===g&&le.has(e.code)&&(e.preventDefault(),T.add(e.code),e.code===`Space`&&!e.repeat&&E.height===0&&(E.vy=4))}),document.addEventListener(`keyup`,e=>T.delete(e.code)),window.addEventListener(`blur`,()=>{T.clear(),document.pointerLockElement===g&&document.exitPointerLock(),I&&(I=!1,Q.setActive(!1),!O&&!k&&(_.hidden=!1,v.textContent=`Continue`))}),document.addEventListener(`visibilitychange`,()=>{document.hidden&&I&&(I=!1,T.clear(),Q.setActive(!1),!O&&!k&&(_.hidden=!1,v.textContent=`Continue`))}),document.addEventListener(`mousemove`,e=>{document.pointerLockElement===g&&(E.yaw=(E.yaw+e.movementX*.002)%(2*Math.PI),E.pitch=Math.max(-1.35,Math.min(1.35,E.pitch-e.movementY*.002)))}),document.addEventListener(`pointerlockchange`,()=>{T.clear(),_.hidden=document.pointerLockElement===g&&!O&&!k,!O&&!k&&(v.textContent=`Continue`)}),document.addEventListener(`pointerlockerror`,()=>{x.textContent=`Could not capture the mouse. Open the page in a separate tab and click the button again.`,console.error(`Pointer lock request failed`)}),v.addEventListener(`click`,async()=>{if(!(k||O)){if(x.textContent=``,matchMedia(`(pointer: coarse)`).matches)I=!0,_.hidden=!0,Q.setActive(!0);else try{await g.requestPointerLock()}catch(e){x.textContent=`Mouse capture is unavailable: ${e instanceof Error?e.message:String(e)}`,console.error(e)}}}),y.addEventListener(`click`,()=>{se(),v.click()}),w.addEventListener(`input`,()=>{document.getElementById(`qualityValue`).textContent=`${Math.round(Number(w.value)*100)}%`}),re.addEventListener(`input`,()=>{document.getElementById(`distortionValue`).textContent=Number(re.value).toFixed(3)});function ue(e){let t=E.level,n=Number(T.has(`KeyW`)||T.has(`ArrowUp`))-Number(T.has(`KeyS`)||T.has(`ArrowDown`)),r=Number(T.has(`KeyD`)||T.has(`ArrowRight`))-Number(T.has(`KeyA`)||T.has(`ArrowLeft`)),i=Math.hypot(n,r)||1,a=e*(T.has(`ShiftLeft`)||T.has(`ShiftRight`)?5:3),o=(Math.sin(E.yaw)*n+Math.cos(E.yaw)*r)/i*a,s=(Math.cos(E.yaw)*n-Math.sin(E.yaw)*r)/i*a,c=Math.max(1,Math.ceil(Math.hypot(o,s)/(l*.5)));for(let e=0;e<c;e++){let e=E.x+o/c,t=V(E.level,E.x,E.z,e,E.z);oe(e,E.z,t,B(E.level,E.x,E.z))||(E.x=e,E.level=t);let n=E.z+s/c;t=V(E.level,E.x,E.z,E.x,n),oe(E.x,n,t,B(E.level,E.x,E.z))||(E.z=n,E.level=t)}E.level!==t&&(U(),H()),E.vy-=10*e,E.height=Math.max(0,E.height+E.vy*e),E.height===0&&(E.vy=0),m.forEach((e,t)=>{Math.hypot(E.x-e[0],E.z-e[2])<.65&&Math.abs(B(E.level,E.x,E.z)-(e[1]-.85))<.6&&!(D&1<<t)&&(D|=1<<t,U(),H())}),D===31&&E.level===2&&Math.hypot(E.x-h[0],E.z-h[2])<.8&&(O=!0,I=!1,Q.setActive(!1),b.textContent=`Arena complete!`,ne.textContent=`All cores collected. Time: ${M.toFixed(1)} s`,v.textContent=`Done`,y.hidden=!1,document.exitPointerLock(),_.hidden=!1)}function $(e){if(k)return;let t=j===0?0:(e-j)*.001,n=Math.min(t,.05);j=e;let r=(document.pointerLockElement===g||I)&&!O;r&&(M+=n,ue(n));let i=W.beginFrame(Number(w.value),.5,G.NEAREST);if(!i)return;let{width:a,height:o}=i,s=Math.sin(E.yaw),c=Math.cos(E.yaw),l=Math.sin(E.pitch),u=Math.cos(E.pitch);G.uniformMatrix3fv(K.basis,!1,new Float32Array([c,0,-s,-s*l,u,-c*l,s*u,l,c*u])),G.uniform2f(K.resolution,a,o),G.uniform3f(K.camera,E.x,B(E.level,E.x,E.z)+1.25+E.height,E.z),G.uniform1f(K.time,M),G.uniform1i(K.accelerate,+!!ie.checked),G.uniform1i(K.collected,D),W.draw(),N++,P+=t,F+=n,P>=.5&&(document.getElementById(`fps`).textContent=Math.round(N/P),N=0,P=0),F>=.15&&(r&&H(),F=0),A=requestAnimationFrame(r?$:de)}function de(e){k||(document.pointerLockElement===g||e-j>=100?$(e):A=requestAnimationFrame(de))}se(),v.disabled=!1,A=requestAnimationFrame($)})();