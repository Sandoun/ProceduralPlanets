precision highp float;

uniform float time;

//color gen
uniform vec2 elevationMinMax;
uniform vec3 waterColor;
uniform float minWaterLevel;
uniform sampler2D gradientTex;

//shared
varying vec3 vUv;
varying vec3 vecNormal;

//water noise
varying float genWaterNoise;
varying float genWaveNoise;

//lighting
uniform float lightIntensity;

struct DirectionalLight {
  vec3 color;
  vec3 direction; // light position, in camera coordinates
};

uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];

vec3 calcOwnShadow (in vec3 sDirection, in vec3 normV, in vec3 color) {

  float shadingMin = -5.0;
  float shadingMax = 0.4;
  float intensity = -8.0;
  float intensityShadow = 10.0;

  vec3 darkness = vec3(-1,-1,-1) * intensityShadow;

  vec3 lightDarkRatio = (color + intensity) - darkness;

  float dotProd = dot(sDirection,normV);

  vec3 specLighting = vec3(0,1,0) * dotProd;
  vec3 baseLighting = clamp(dotProd, shadingMin, shadingMax) * lightDarkRatio;

  return baseLighting + specLighting;

}

float pnoise();

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

  float stepped = smoothstep(elevationMinMax.x, elevationMinMax.y, len);
  vec4 heightColor = texture2D(gradientTex, vec2(stepped,0));

  final.rgb += heightColor.rgb;

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