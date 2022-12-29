precision highp float;

#define FLT_MAX 3.402823466e+38
#define FLT_MIN 1.175494351e-38
#define DBL_MAX 1.7976931348623158e+308
#define DBL_MIN 2.2250738585072014e-308
#define NUM_BODIES 10

//default and depth texture of the post processing pass
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;

//transforms, matricies and positions
uniform vec3 worldSpaceCamPos;
varying vec3 viewVector;
varying vec2 vUv;
varying mat4 INV_PROJECTION_MATRIX;

struct ShadeableBody {

	vec3 PlanetCentre;
	float PlanetRadius;
	float AtmosphereRadius;
	vec3 DirToSun;

	int NumInScatteringPoints;
	int NumOpticalDepthPoints;
	vec3 ScatteringCoefficients;
	float DensityFalloff;
	float Intensity;

};

uniform ShadeableBody shadeableBodies[NUM_BODIES];

vec3 depth(sampler2D dTex, vec2 screenUv, mat4 inv_projection_matrix) {

	// Get depth value from DEPTH_TEXTURE
	float depth = texture(dTex, screenUv).r;

	//hacky solution to prevent clipping into each other
	depth -= 0.0003;

	// Normalized Device Coordinates needs to be 0 to 1 in Z axis for Vulkan
	vec3 ndc = vec3(screenUv * 2.0 - 1.0, depth);
	// Convert between NDC and view space to get distance to camera
	vec4 view = inv_projection_matrix * vec4(ndc, 1.0);
	view.xyz /= view.w;

	return view.xyz; //-view.z;
}

float densityAtPoint(
	vec3 densitySamplePoint, 
	ShadeableBody body
) {
	float heightAboveSurface = length(densitySamplePoint - body.PlanetCentre) - body.PlanetRadius;
	float height01 = heightAboveSurface / (body.AtmosphereRadius - body.PlanetRadius);
	float localDensity = exp(-height01 * body.DensityFalloff) * (1.0 - height01);
	return localDensity;
}

float opticalDepth(
	vec3 rayOrigin, 
	vec3 rayDir, 
	float rayLength,
	ShadeableBody body
) {

	vec3 densitySamplePoint = rayOrigin;
	float stepSize = rayLength / (float(body.NumOpticalDepthPoints) - 1.0);
	float opticalDepth = 0.0;

	for (int i = 0; i < body.NumOpticalDepthPoints; i ++) {
		float localDensity = densityAtPoint(densitySamplePoint, body);
		opticalDepth += localDensity * stepSize;
		densitySamplePoint += rayDir * stepSize;
	}
	return opticalDepth;
}

vec2 raySphere(vec3 sphereCentre, float sphereRadius, vec3 rayOrigin, vec3 rayDir) { 
	
	vec3 offset = rayOrigin - sphereCentre;
	float a = 1.0;
	float b = 2.0 * dot(offset, rayDir);
	float c = dot(offset, offset) - sphereRadius * sphereRadius;
	float d = b * b - 4.0 * a * c;

	if (d > 0.0) {
	
		float s = sqrt(d);
		float dstToSphereNear = max(0.0, (-b - s) / (2.0 * a));
		float dstToSphereFar = (-b + s) / (2.0 * a);
		
		// Ignore intersections that occur behind the ray
		if (dstToSphereFar >= 0.0) {
			return vec2(dstToSphereNear, dstToSphereFar - dstToSphereNear);
		}
		
	}

	// Ray did not intersect sphere
	return vec2 (FLT_MAX, 0);
}

vec3 calculateLight(
	vec3 rayOrigin, 
	vec3 rayDir, 
	float rayLength, 
	vec3 originalCol, 
	ShadeableBody body
) {

	vec3 inScatterPoint = rayOrigin;
	float stepSize = rayLength / float(body.NumInScatteringPoints - 1);
	vec3 inScatteredLight = vec3(0);
	float viewRayOpticalDepth = 0.0;

	for (int i = 0; i < body.NumInScatteringPoints; i ++) {
		
		float localDensity = densityAtPoint(inScatterPoint, body);
		float sunRayLength = raySphere(body.PlanetCentre, body.AtmosphereRadius, inScatterPoint, body.DirToSun).y;
		float sunRayOpticalDepth = opticalDepth(inScatterPoint, body.DirToSun, sunRayLength, body);
		viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i), body);
		
		vec3 transmittance = exp(
			-(sunRayOpticalDepth + viewRayOpticalDepth)
			* body.ScatteringCoefficients
		);

		inScatteredLight += localDensity * transmittance * body.ScatteringCoefficients * stepSize;
		inScatterPoint += rayDir * stepSize;
	}
	
	return mix(originalCol, inScatteredLight * body.Intensity,.5);
	
}

void main() {

    //depth at view pos
	vec3 viewPos = depth(tDepth, vUv, INV_PROJECTION_MATRIX);
	//linear and scene depth
	float linearDepth = -viewPos.z;
	float sceneDepth = linearDepth * length(viewVector);
	
	//test ray stuff
	vec3 rayOrigin = worldSpaceCamPos;
	vec3 rayDir = normalize(viewVector);
	
	vec4 original = texture2D( tDiffuse, vUv );
	vec4 finalCol = original; 

	for(int i = 0; i < NUM_BODIES; i++) {
		
		vec3 _plCentre = shadeableBodies[i].PlanetCentre;
		float _plRadius = shadeableBodies[i].PlanetRadius;

		vec2 hitInfo = raySphere(_plCentre, _plRadius, rayOrigin, rayDir);
		float dstToAtmosphere = hitInfo.x;
		float dstThroughAtmosphere = min(hitInfo.y, sceneDepth - dstToAtmosphere);

		//in order to render objects around atmosphere too
		if (dstThroughAtmosphere > 0.0) {

			const float epsilon = 0.0001;
			vec3 pointInAtmosphere = rayOrigin + rayDir * (dstToAtmosphere + epsilon);
			
			vec3 light = calculateLight(
				pointInAtmosphere,
				rayDir,
				dstThroughAtmosphere - epsilon * 2.0,
				original.rgb,
				shadeableBodies[i]
			);

			finalCol += vec4(light, 1.0);
		}

	}
    
    gl_FragColor = vec4(finalCol.rgb, 1.0);

}