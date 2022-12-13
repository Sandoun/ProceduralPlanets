uniform vec3 atmosColor;
uniform float atmosOpacity;
uniform float time;

varying vec3 vUv; 
varying vec3 vNormal;

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];

vec4 ownLight () {

  vec4 addedLights = vec4(0,0,0,1.0);

  float shadingMin = -5.0;
  float shadingMax = 1.0;
  float intensity = -8.0;
  float intensityShadow = 10.0;

  for(int i = 0; i < NUM_DIR_LIGHTS; i++) {

    vec3 darkness = vec3(-1,-1,-1) * intensityShadow;

    vec3 lightDarkRatio = (directionalLights[i].color + intensity) - darkness;

    addedLights.rgb += clamp(dot(directionalLights[i].direction, vNormal), shadingMin, shadingMax) * lightDarkRatio;
 
  }
 
  return addedLights;

}

void main () {

  vec4 calcedOwnLight = vec4(0.,0.,0.,1.0);

  #if NUM_DIR_LIGHTS > 0
  calcedOwnLight = ownLight();
  #endif

  gl_FragColor = vec4(atmosColor.rgb * calcedOwnLight.rgb,atmosOpacity);

}