precision highp float;
precision highp sampler2DArray;

uniform float time;

//shared
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vecNormal;

varying float genBaseNoise;
varying float genSpotsNoise;

void main () {

  vec3 baseColor = vec3(.93, .3,.01);
  vec3 noiseColor = vec3(1., .5, 0.);
  vec3 spotsColor = vec3(1., 1., 1.) * .8;

  vec3 mixed = 
  baseColor + 
  (noiseColor * genBaseNoise) +
  (spotsColor * genSpotsNoise);

  gl_FragColor = vec4(vec3(mixed), 1.0);

}