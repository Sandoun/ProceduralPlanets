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
varying vec3 vNormal;
varying vec3 vecNormal;
varying mat4 mViewMatrix;
varying vec3 vViewPosition;

//noise
varying float genWaveNoise;
varying float genBiomeNoise;

//lighting
#define NUM_SUNS 1
struct Sun {
  vec3 color;
	vec3 position;
  float radius;
};
uniform Sun suns[NUM_SUNS]; 

vec3 calcOwnShadow (in vec3 normV, in vec3 baseColor) {

  vec3 finalCol = baseColor;

  #if NUM_SUNS > 0           
  for(int i = 0; i < NUM_SUNS; i++) {

    //calc direction
    vec3 sourcePos = suns[i].position;
    vec3 norm = normalize(vNormal);
    vec4 viewLightPos = mViewMatrix * vec4(sourcePos, 1.0);
    vec3 lightVector = normalize(viewLightPos.xyz - vViewPosition);
    float nDotL = clamp(dot(lightVector, norm), 0.02, 1.);

    finalCol *= nDotL;

  }
  #endif

  return finalCol;

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

vec3 calcWaterColor (in vec3 normV) {
  
  float waveIntensity = 1.0; 

  vec3 waveColor = (vec3(1.) * genWaveNoise) * waveIntensity;
  vec3 baseColor = clamp(waterColor + waveColor, vec3(0), vec3(1.));

  return baseColor;

}

void main () {

  vec4 final = vec4(0,0,0, 1);

  //calculate terrain gradient
  float len = length(vUv);

  //calc elevation color
  float stepped = smoothstep(elevationMinMax.x, elevationMinMax.y, len);

  //vertical positon on object 0-1 from bottom to top
  float verticalPos = calcVertPos(vUv, elevationMinMax.y);
  final.rgb = calcSurfaceColor(verticalPos, stepped);

  //elevation min water level
  if(len <= minWaterLevel) {

    final.rgb = calcWaterColor(vecNormal);

  }
  
  //add lighting last
  final.rgb = calcOwnShadow(vecNormal, final.rgb);

  gl_FragColor = final;

}