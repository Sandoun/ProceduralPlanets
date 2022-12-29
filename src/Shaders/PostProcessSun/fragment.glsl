precision highp float;

#define FLT_MAX 3.402823466e+38
#define FLT_MIN 1.175494351e-38
#define DBL_MAX 1.7976931348623158e+308
#define DBL_MIN 2.2250738585072014e-308
#define NUM_BODIES 10

const float minCoronaRingSize = 1.;
const float minCoronaOffset = .1;
const float coronaIntensity = 1.;

//default and depth texture of the post processing pass
uniform float time;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;

//transforms, matricies and positions
uniform vec3 worldSpaceCamPos;
varying vec3 viewVector;
varying vec2 vUv;
varying mat4 INV_PROJECTION_MATRIX;

#define NUM_SUNS 1
struct Sun {
  vec3 color;
  vec3 position;
  float radius;
};
uniform Sun suns[NUM_SUNS]; 

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}
vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;
  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www; 
  return p;
}
float snoise(vec4 v){
  const vec2  C = vec2( 0.138196601125010504,
                        0.309016994374947451); 
  vec4 i  = floor(v + dot(v, C.yyyy) );
  vec4 x0 = v -   i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 ); 
  vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
  vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
  vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
  vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
  i = mod(i, 289.0); 
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;
  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}

float generateBaseNoise () {

    float _scaledTime = time / 40000.0;

    vec4 p = vec4((vUv + (normalize(viewVector.xy) * .1)) * 3., 1., _scaledTime);

    float sum = 0.;
    float amp = 1.;
    float scale = 1.;

    for(int i = 0; i < 5; i++) {
        sum += snoise((p * scale) * amp);
        p.w += 100.;
        amp *= .9;
        scale *= 2.;
    }

    return smoothstep(.55, 1., (sum + 1.0) / 2.);

}

vec3 depth(sampler2D dTex, vec2 screenUv, mat4 inv_projection_matrix) {

	// Get depth value from DEPTH_TEXTURE
	float depth = texture(dTex, screenUv).r;

	// Normalized Device Coordinates needs to be 0 to 1 in Z axis for Vulkan
	vec3 ndc = vec3(screenUv, depth);
	// Convert between NDC and view space to get distance to camera
	vec4 view = inv_projection_matrix * vec4(ndc, 1.0);
	view.xyz /= view.w;

	return view.xyz; //-view.z;
}

float densityAtPoint(vec3 densitySamplePoint, Sun sun) {

	float noise = generateBaseNoise();
	float sunRad = sun.radius;
	float bloomRadius = sun.radius + minCoronaRingSize + noise;

	float heightAboveSurface = length(densitySamplePoint - sun.position) - sunRad;
	float height01 = heightAboveSurface / (bloomRadius - sunRad);
	float localDensity = exp(-height01) * (minCoronaOffset - height01);
	return localDensity;
}

float opticalDepth(
	vec3 rayOrigin, 
	vec3 rayDir, 
	float rayLength,
	Sun sun
) {

	int numDepthPoints = 10;

	vec3 densitySamplePoint = rayOrigin;
	float stepSize = rayLength / (float(numDepthPoints) - 1.0);
	float opticalDepth = 0.0;

	for (int i = 0; i < numDepthPoints; i ++) {
		float localDensity = densityAtPoint(densitySamplePoint, sun);
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

vec3 calcSunsCorona () {

	vec3 depthPos = depth(tDepth, vUv, INV_PROJECTION_MATRIX);
	float linearDepth = -depthPos.z;
	float sceneDepth = (linearDepth) * length(viewVector);

	vec3 rayOrigin = worldSpaceCamPos;
	vec3 rayDir = normalize(viewVector);
	
	float finalAll = 0.0;

	for(int i = 0; i < NUM_SUNS; i++) {
		
		float distToSunFromCam = abs(distance(rayOrigin, suns[i].position));

		if(distToSunFromCam > 1500.) continue;

		float raydetectRadius = suns[i].radius + 20.;

		vec2 hitInfo = raySphere(suns[i].position, raydetectRadius, rayOrigin, rayDir);
		float dstToAtmosphere = hitInfo.x;
		float dstThroughAtmosphere = min(hitInfo.y, sceneDepth - dstToAtmosphere);

		float raylen = dstToAtmosphere + dstThroughAtmosphere + 10.;
		float dep = opticalDepth(rayOrigin, rayDir, raylen, suns[i]);

		float forSun = clamp((dep * -1.0) * coronaIntensity, 0., 1.);

		float distmodifier = clamp(1500. / (distToSunFromCam + 500.), 0., 1.);
		finalAll += mix(0., forSun, distmodifier);

	}

	return vec3(1., .2, 0.) * finalAll;

}

void main() {

	vec4 original = texture2D( tDiffuse, vUv );
	vec4 finalCol = original; 

	vec3 test = calcSunsCorona();

    gl_FragColor = vec4(test + original.rgb , 1.0);

}

//raylentgh erohöhen auf planet atmos?