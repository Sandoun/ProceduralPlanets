import { 
    Scene, 
    Color,
    Object3D,
    Vector2, 
    Vector3,
    BufferGeometry, 
    SphereGeometry,
    LineBasicMaterial,
    LineSegments,
    EdgesGeometry,
    Line,
    MeshBasicMaterial,
    Mesh,
    MeshStandardMaterial,
    MeshLambertMaterial,
    MeshPhongMaterial,
    ShaderMaterial,
    Vector4,
    DataTexture,
    NearestFilter,
    RepeatWrapping,
    PlaneHelper,
    PlaneGeometry,
    TextureLoader,
    LuminanceFormat,
    UnsignedByteType,
    UniformsLib,
    ShaderLib,
} from '../../Three/three.module.js';

import { ShaderManager } from '../ShaderManager.js';
import { Perlin } from '../Perlin.js';
import { Prando } from '../Prando.js';
import { WordGenerator } from '../WordGenerator.js';
import SolarSystemRenderer from '../SolarSystemRenderer.js';

class CelestialBody {

    //perlin noise
    #perlin;

    /**
     * @typedef {Object} CelestialSettings
     * @property {String} seed Planet rng seed
     * @property {Object} size Planet size settings
     * @property {Number} size.minimalCentre Minimal center radius the planet should have
     * @property {Number} size.resolution Subdivision of the cubesphere 
     * @property {Object} terrain Terrain generation settings
     * @property {Number} terrain.layers Layers of noise octaves 
     * @property {Number} terrain.weightMultiplicator Weight multiplicator of each octave
     * @property {Number} terrain.roughness Overall roughness
     * @property {Number} terrain.persistence How persistent should the terrain be
     * @property {Number} terrain.strength Overall strenght of the noise
     * @property {Object} [water] Water generation settings, leave undefined to not use water
     * @property {Number} water.levelOffset Offset of the water from the minimal centre
     * @property {Object} [atmosphere] Atmosphere generation settings, leave undefined to not use atmosphere
     * @property {Number} atmosphere.waveLengthRed Red spectrum wavelength
     * @property {Number} atmosphere.waveLengthGreen Green spectrum wavelength
     * @property {Number} atmosphere.waveLengthBlue Blue spectrum wavelength
     * @property {Number} atmosphere.scatteringStrength Light scattering strenght
     * @property {Number} atmosphere.scale Atmosphere scale 0 - 1
     * @property {Number} atmosphere.fallOff Atmosphere density falloff 4-40 work good, lower values mean more light spread around
     * @property {Number} atmosphere.instensity Atmosphere intensity
     * @property {Object} biomes Biome settings
     * @property {Number} biomes.noiseScale Noise size scale
     * @property {Number} biomes.noiseFrequency Noise frequency
     * @property {Number} biomes.blendingSize Size of the range for blending inbetween biomes
     * @property {BiomeData[]} biomes.layers biome layer definitions
     * @property {Object} rotation Rotation settings
     * @property {Number} rotation.axisTilt Axis tilt in degrees
     * @property {Number} rotation.periodSeconds Own rotation peroid in seconds
     */

    /** @type {CelestialSettings} */
    settings = {
        seed : undefined,
        size : {
            minimalCentre : 15,
            resolution : 300,
        },
        terrain : {
            layers : 10,
            weightMultiplicator : 2,
            roughness : 3,
            persistence : .4,
            strength : 1,
        },
        water : {
            levelOffset : .35,
        },
        atmosphere : {
            waveLengthRed : 700,
            waveLengthGreen : 530,
            waveLengthBlue : 460,
            scatteringStrength : 20,
            scale : 1.0,
            fallOff : .25,
            instensity : 1,
        },
        biomes : {
            noiseScale : .2,
            noiseFrequency : .2,
            blendingSize : 0.05,
            layers : [
                new BiomeData([
                    new GradientColorPoint(209,191,113,0),
                    new GradientColorPoint(0,50,0,.4),
                    new GradientColorPoint(15,112,0,.5),
                    new GradientColorPoint(100,100,100,.85),
                    new GradientColorPoint(255,255,255,.9),
                    new GradientColorPoint(255,255,255,1.0),
                ], 0),
                new BiomeData([
                    new GradientColorPoint(218, 194, 124, 0),
                    new GradientColorPoint(215, 175, 114, .3),
                    new GradientColorPoint(168, 101, 30, 1.0),
                ], .4),
                new BiomeData([
                    new GradientColorPoint(209,191,113,0),
                    new GradientColorPoint(0,50,0,.4),
                    new GradientColorPoint(15,112,0,.5),
                    new GradientColorPoint(100,100,100,.85),
                    new GradientColorPoint(255,255,255,.9),
                    new GradientColorPoint(255,255,255,1.0),
                ], .6),
            ]
        }, 
        rotation : {
            axisTilt : 15,
            periodSeconds : 10,
        }
    };

    /** @type {String} Naming of the body */
    name;

    /** @type {('Generic'|'Planet'|'Moon')} Type of celestial body it is */
    type;

    /** @type {Orbit} Own orbit of the body*/
    ownOrbit;

    /** @type {Number} Index on the orbital plane this body is orbiting on */
    indexOrbitalPlane;

    /** @type {Orbit[]} Orbits this body has */
    orbits = [];

    /**
     * Initiates a new celestial body
     * @param {CelestialSettings} options Planet options
     */
    constructor (options) {

        mergeDeep(this.settings, options);

        this.DirectionsList = [
            new Vector3(0, 1, 0),
            new Vector3(0, -1, 0),
            new Vector3(-1, 0, 0),
            new Vector3(1, 0, 0),
            new Vector3(0, 0, 1),
            new Vector3(0, 0, -1),
        ];

        this.minSurfacePoint = 0;
        this.maxSurfacePoint = 1;
        this.waterSurfacePoint = 0;

        /** @type {Mesh} */
        this.CurrentMesh = null;

        /** @type {Mesh[]} */
        this.TextureMeshes = [];

        this.Object = new Object3D();

        this.#perlin = new Perlin(this.settings.seed);

    }

    //generation
    Generate () {

        if(this.CurrentMesh != null) {
            this.CurrentMesh.removeFromParent();
        }

        this.minSurfacePoint = Number.MAX_SAFE_INTEGER;
        this.maxSurfacePoint = 0;

        if(this.settings.water) {
            this.waterSurfacePoint = this.settings.size.minimalCentre + this.settings.water.levelOffset;
        } 

        //generate verts and merge all 6 face sides
        let merged = [];
        for (let i = 0; i < this.DirectionsList.length; i++) {
            
            let verts = this.#generateFace(this.DirectionsList[i]);
            merged = [...merged, ...verts];

        }

        this.#render(merged);
        this.Object.attach(this.CurrentMesh);

    }

    /**
     * 
     * @param {CelestialBody} body 
     * @param {Number} distanceToCenter 
     * @param {Number} angle 
     * @returns {Orbit} the calculated orbit
     */
    AttachOrbitingBody (body, parent, distanceToCenter, angle, periodSeconds, reversed) {

        const orb = new Orbit(body, parent, distanceToCenter, angle, periodSeconds, reversed);
        this.orbits.push(orb);
        return orb;

    }

    OnTimeUpdate (_t) {

        //update time on shader
        this.CurrentMesh.material.uniforms.time.value = _t / 30;

        //let the body rotate
        const rotAngle = _t / ((this.settings.rotation.periodSeconds * 1000) / 360) * -1;
        this.Object.rotation.y = rotAngle * (Math.PI / 180);
        this.Object.rotation.x = this.settings.rotation.axisTilt * (Math.PI / 180);

        //let the moons orbit
        for (let i = 0; i < this.orbits.length; i++) {
            
            const orbit = this.orbits[i];

            //calc periodFactor
            if(orbit.isReversed) {
                orbit.angle = _t / ((orbit.periodSeconds * 1000) / 360) * -1;
            } else {
                orbit.angle = _t / ((orbit.periodSeconds * 1000) / 360);
            }

            const angleRadians = orbit.angle * (Math.PI / 180);
            const newX = Math.cos(angleRadians) * orbit.distanceToCenter;
            const newY = Math.sin(angleRadians) * orbit.distanceToCenter;
            
            orbit.attachedBody.Object.position.set(newX + this.Object.position.x, this.Object.position.y, newY + this.Object.position.z);

        }

    }

    /**
     * 
     * @param {Vector3} localUp 
     */
    #generateFace (localUp) {

        let axisA = new Vector3(localUp.y, localUp.z, localUp.x);
        let axisB = new Vector3().crossVectors(localUp, axisA);

        let points = [];
        let pos = 0;

        for (let y = 0; y < this.settings.size.resolution; y++) {
            for (let x = 0; x < this.settings.size.resolution ; x++) {

                let percent = new Vector2(x,y).divideScalar(this.settings.size.resolution - 1);
                
                let vA = axisA.clone().multiplyScalar((percent.x - .5) * 2);
                let vB = axisB.clone().multiplyScalar((percent.y - .5) * 2);
                let pointOnUnitCube = localUp.clone().add(vA).add(vB);

                let pointOnRegularSphere = pointOnUnitCube.normalize();

                let noiseVal = this.#evaluateNoiseOnPoint(pointOnRegularSphere);
                let pointOnSphere = pointOnRegularSphere.clone().multiplyScalar(noiseVal);

                //calc min max points
                let pLen = pointOnSphere.length();
                
                if(pLen <= this.waterSurfacePoint) {
                    this.minSurfacePoint = this.waterSurfacePoint;
                } else if (pLen < this.minSurfacePoint) {
                    this.minSurfacePoint = pLen;
                } 
                
                if(pLen > this.maxSurfacePoint) {
                    this.maxSurfacePoint = pLen;
                }

                points.push(pointOnSphere);

                pos++;

            }
        }

        let currentQuad = 0;

        let verts = [];

        //calc tries for face points
        for (let x = 0; x < this.settings.size.resolution - 1; x++) {
            
            for (let y = 0; y < this.settings.size.resolution - 1; y++) {
                
                let offset = x;

                let c0off = currentQuad + offset;
                let c1off = currentQuad + 1 + offset;
                let c2off = currentQuad + (this.settings.size.resolution) + offset;
                let c3off = currentQuad + (this.settings.size.resolution + 1) + offset;

                //lower left
                let c0 = points[c0off];
                //lower right
                let c1 = points[c1off];
                
                //upper left
                let c2 = points[c2off];
                //upper right
                let c3 = points[c3off];

                //counterclockwise first
                verts.push(c0);
                verts.push(c1);
                verts.push(c3);

                //counterclockwise second
                verts.push(c0);
                verts.push(c3)
                verts.push(c2)

                currentQuad++;

            }

        }

        return verts;

    }

    #render (_verts) {

        //clear old texture meshes
        if(this.TextureMeshes.length > 0) {

            for (let i = 0; i < this.TextureMeshes.length; i++) {
                this.Object.remove(this.TextureMeshes[i]);
            }

            this.TextureMeshes = [];
        }

        //mesh planet
        let geometry = new BufferGeometry().setFromPoints(_verts);
        geometry.computeVertexNormals();

        let biomesData = this.#generateTexture(this.settings.biomes.layers);

        const material = ShaderManager.PlanetShaderMat(
            biomesData.biomes,
            biomesData.texture,
            this,
        );

        this.CurrentMesh = new Mesh(geometry, material);
        this.CurrentMesh.receiveShadow = true;
        this.CurrentMesh.castShadow = true;

    }

    /**
     * 
     * @param {BiomeData[]} biomeDataArr 
     * @returns 
     */
    #generateTexture (biomeDataArr) {

        const width = 128 * 20;

        let generatedFade = [];
        let biomes = [];

        for (let b = 0; b < biomeDataArr.length; b++) {
           
            const biomeDat = biomeDataArr[b];
            const colorPoints = biomeDat.colorPoints;

            for (let i = 0; i < colorPoints.length - 1; i++) {

                let col = colorPoints[i];
                let nextCol = colorPoints[i + 1];
    
                const usePixelWidthA = Math.floor(width * (col.offset));
                const usePixelWidthB = Math.floor(width * (nextCol.offset));
                const pixelCount = Math.floor(usePixelWidthB - usePixelWidthA);
    
                for (let j = usePixelWidthA; j < usePixelWidthB; j++) {
    
                    const perc = (j - usePixelWidthA) / pixelCount;
    
                    let v1 = new Vector3(col.r, col.g, col.b);
                    let v2 = new Vector3(nextCol.r, nextCol.g, nextCol.b);
    
                    //lerp values
                    let v3 = new Vector3().lerpVectors(v1, v2, perc);
    
                    generatedFade.push(Math.floor(v3.x));
                    generatedFade.push(Math.floor(v3.y));
                    generatedFade.push(Math.floor(v3.z));
                    generatedFade.push(255);

                }
    
            }

            biomes.push({
                offsetY : biomeDat.offset
            });

        }

        const data = Uint8Array.from(generatedFade);
        const texture = new DataTexture(data, width, biomeDataArr.length);
        texture.needsUpdate = true;

        const m = new MeshBasicMaterial({
            map: texture,
        });

        const planeSize = this.settings.size.minimalCentre / 2;
        const g = new PlaneGeometry(planeSize, planeSize);
        const plane = new Mesh(g, m);
        plane.rotateY(180 * 0.0174533);

        this.Object.add(plane);
        this.TextureMeshes.push(plane);

        return {

            biomes : biomes,
            texture : texture,

        };

    }

    /**
     * Evaluates the noise for a 3d point
     * @param {Vector3} v Vector point
     * @returns {number} Number between 0-1
     */
    #evaluateNoiseOnPoint (v) {

        let _freq = this.settings.terrain.roughness;
        let _amp = 1;
        let _noiseVal = 0;
        let _weight = 1;

        //calc noise layered octaves
        for (let i = 0; i < this.settings.terrain.layers; i++) {
           
            let n = this.#perlin.noise(
                v.x * _freq, 
                v.y * _freq, 
                v.z * _freq
            );

            n *= n;
            n *= _weight;

            if(n * this.settings.terrain.weightMultiplicator < 1 && n * this.settings.terrain.weightMultiplicator > 0) {
                _weight = 1;
            } else {
                _weight = 0;
            }

            _noiseVal += n * _amp;
            _freq *= this.settings.terrain.roughness;
            _amp *= this.settings.terrain.persistence;

        }

        _noiseVal *= this.settings.terrain.strength;
        _noiseVal += this.settings.size.minimalCentre;

        return this.#clamp(_noiseVal, this.waterSurfacePoint, 100);

    }

    #clamp (num, min, max) {

        return Math.min(Math.max(num, min), max);

    }

}

class BiomeData {

    constructor (colorPoints, offset) {

        /** @type {GradientColorPoint[]} */
        this.colorPoints = colorPoints;
        /** @type {Number} */
        this.offset = offset;
    
    }

}

class GradientColorPoint {
    
    constructor (r,g,b,offset) {

        this.r = r;
        this.g = g;
        this.b = b;
        this.offset = offset;

    }

}

class Orbit {

    constructor (body, parent, distCenter, angle, periodSeconds, reversed) {

        /** @type {CelestialBody} */
        this.attachedBody = body;

        /** @type {CelestialBody} */
        this.orbitObject = parent;

        /** @type {Number} */
        this.distanceToCenter = distCenter;
        
        /** @type {Number} */
        this.angle = angle;

        /** @type {Number} */
        this.periodSeconds = periodSeconds;

        this.isReversed = reversed;

    }

}

function MapNum (val, in_min, in_max, out_min, out_max) {
    return (val - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function mergeDeep(target, ...sources) {

    function isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
        if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            mergeDeep(target[key], source[key]);
        } else {
            Object.assign(target, { [key]: source[key] });
        }
        }
    }

    return mergeDeep(target, ...sources);
}

export { CelestialBody, BiomeData, GradientColorPoint, Orbit }