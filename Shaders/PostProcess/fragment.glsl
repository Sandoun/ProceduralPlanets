#include <packing>

uniform float opacity;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;

uniform vec3 worldSpaceCamPos;
uniform vec3 viewVector;
varying vec2 vUv;
varying vec3 vInView;

#define FLT_MAX 3.402823466e+38
#define FLT_MIN 1.175494351e-38
#define DBL_MAX 1.7976931348623158e+308
#define DBL_MIN 2.2250738585072014e-308

vec2 raySphere (vec3 sphereCentre, float sphereRadius, vec3 rayOrigin, vec3 rayDir) {

     vec3 offset = rayOrigin - sphereCentre; 
     float a = 1.; // Set to dot(rayDir, rayDir) if rayDir might not be normalized 
     float b = 2. * dot(offset, rayDir); 
     float c = dot (offset, offset) - sphereRadius * sphereRadius;
     float d = b * b - 4. * a * c; // Discriminant from quadratic formula 

     // Number of intersections: 0 when d < 0; 1 when d = 0; 2 when d> 0 
     if (d > 0.) { 

        float s = sqrt(d);
        float dstToSphereNear = max(0., (-b - s) / (2. * a));
        float dstToSphereFar = (-b + s) / (2. * a);

        // Ignore intersections that occur behind the ray
        if (dstToSphereFar >= 0.) { 
            return vec2(dstToSphereNear, dstToSphereFar - dstToSphereNear);
        }

     }

    // Ray did not intersect sphere return float2 (maxFloat, 0);
    return vec2(FLT_MAX, 0.);

}       

float SampleDepthTexture( sampler2D depthSampler, vec2 coord ) {

    float fragCoordZ = texture2D( depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
    return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

}

void main() {

    vec4 original = texture2D( tDiffuse, vUv );
    vec4 outTex = original;
    float depth = SampleDepthTexture( tDepth, vUv);

    vec4 depthFinal = 1. - vec4(depth, depth, depth, 1.0);

    gl_FragColor = outTex;

}