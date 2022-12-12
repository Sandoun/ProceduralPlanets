uniform vec3 color1;
uniform vec3 color2;
uniform vec2 elevationMinMax;
uniform sampler2D gradientTex;

varying vec3 vUv;

void main() {
  
  float len = length(vUv);
  float stepped = smoothstep(elevationMinMax.x, elevationMinMax.y, len);
 
  //get color from gradient texture
  float stepOff = stepped;
  vec4 tex = texture2D(gradientTex, vec2(stepOff,0));

  gl_FragColor = vec4(tex.x, tex.y, tex.z, 1.0);

}
