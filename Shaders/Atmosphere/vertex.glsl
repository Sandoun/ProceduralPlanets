varying vec3 vUv; 
varying vec3 vNormal;

void main () {

    vUv = position; 
    vNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 

}