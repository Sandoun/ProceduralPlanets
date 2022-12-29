precision highp float;

uniform mat4 IN_INV_PROJECTION_MATRIX;
uniform mat4 IN_INV_VIEW_MATRIX;

varying vec2 vUv;
varying vec3 viewVector;
varying mat4 INV_PROJECTION_MATRIX;
varying mat4 INV_VIEW_MATRIX;

void main() {

    vUv = uv;

    INV_PROJECTION_MATRIX = IN_INV_PROJECTION_MATRIX;
    INV_VIEW_MATRIX = IN_INV_VIEW_MATRIX;

    viewVector = (INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, 0.0, 1.0)).xyz;
	viewVector = (INV_VIEW_MATRIX * vec4(viewVector, 0.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}