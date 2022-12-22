precision highp float;
precision highp sampler2DArray;

uniform float time;

//color gen
uniform vec2 elevationMinMax;
uniform vec3 waterColor;
uniform float minWaterLevel;

struct Biome {
  float offsetY;
};

#define BIOMES_SIZE 3
uniform Biome[BIOMES_SIZE] biomes;
uniform sampler2D biomeGradients;
uniform float biomeNoiseScale;
uniform float biomeBlending;

//shared
varying vec3 vUv;
varying vec3 vecNormal;

//noise
varying float genWaveNoise;
varying float genBiomeNoise;

//lighting
uniform float lightIntensity;

struct DirectionalLight {
  vec3 color;
  vec3 direction; // light position, in camera coordinates
};

uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];

vec3 calcOwnShadow (in vec3 sDirection, in vec3 normV, in vec3 color) {

  float shadingMin = -5.0;
  float shadingMax = .1;
  float intensity = -3.0;
  float intensityShadow = 10.0;

  vec3 darkness = vec3(-1,-1,-1) * intensityShadow;

  vec3 lightDarkRatio = (color + intensity) - darkness;

  float dotProd = dot(sDirection,normV);

  vec3 specLighting = vec3(1) * dotProd;
  vec3 baseLighting = clamp(dotProd, shadingMin, shadingMax) * lightDarkRatio;

  return baseLighting + specLighting;

}

float calcVertPos (in vec3 _uv, in float _elevation) {

  return clamp(((_uv.y + 1.0) / 2.0) / (_elevation) + .43, 0., 1.);

}

vec3 calcSurfaceColor (in float vertPos, in float steppedHeight) {

  //only 1 biome
  if(BIOMES_SIZE == 1) {
    vec4 colorPoint = texture2D(biomeGradients, vec2(steppedHeight, 0));
    return colorPoint.rgb;
  }

  //add noise to biomes
  float offsetNoise = genBiomeNoise * biomeNoiseScale;
  vertPos += offsetNoise;

  //calc current layer index
  int currentLayerIndex = 0;
  for(int i = 0; i < BIOMES_SIZE; i++) {
    if(vertPos > biomes[i].offsetY) {
      currentLayerIndex = i;

    }
  }

  float nextBiomeOffset = biomes[currentLayerIndex + 1].offsetY;

  vec4 sampledColor = vec4(vec3(0), 1.0);

  const float epsilon = .1;

  float texCoordY = float(currentLayerIndex) / float(BIOMES_SIZE) + epsilon;
  float texCoordYNext = float(currentLayerIndex + 1) / float(BIOMES_SIZE) + epsilon;

  vec4 colorPoint1 = texture2D(biomeGradients, vec2(steppedHeight, texCoordY));
  vec4 colorPoint2 = texture2D(biomeGradients, vec2(steppedHeight, texCoordYNext));

  float offsetRangeNeg = nextBiomeOffset - biomeBlending;
  float offsetRangePos = nextBiomeOffset + biomeBlending;

  if(currentLayerIndex == BIOMES_SIZE - 1) {

    sampledColor = colorPoint2;

  } else if(vertPos > offsetRangeNeg) {

    float lerpPerc = (vertPos - offsetRangeNeg) / (offsetRangePos - vertPos);

    vec3 lerpedCol = mix(colorPoint1.rgb, colorPoint2.rgb, lerpPerc);

    sampledColor = vec4(lerpedCol, 1.0);

  } else if(vertPos < offsetRangeNeg) {

    sampledColor = colorPoint1;

  }

  return sampledColor.rgb;

}

void main () {

  vec4 final = vec4(0,0,0, 1);

  //calculate lighting
  vec4 addedLights = vec4(0,0,0,1.0);
  #if NUM_DIR_LIGHTS > 0           
  for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
    addedLights.rgb += calcOwnShadow(
      directionalLights[i].direction, 
      vecNormal, 
      directionalLights[i].color
    );
  }
  #endif

  //calculate terrain gradient
  float len = length(vUv);

  //calc elevation color
  float stepped = smoothstep(elevationMinMax.x, elevationMinMax.y, len);

  //vertical positon on object 0-1 from bottom to top
  float verticalPos = calcVertPos(vUv, elevationMinMax.y);

  final.rgb = calcSurfaceColor(verticalPos, stepped);

  //elevation min water level
  if(len <= minWaterLevel) {

    float intensity = 0.5;

    vec3 waveColor = (vec3(1,1,1) * genWaveNoise) * intensity;

    final.rgb = waterColor + waveColor;

  }

  //add lighting last
  final *= addedLights;

  gl_FragColor = final;

}