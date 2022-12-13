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
} from './three.module.js';

import * as BufferGeometryUtils from './BufferGeometryUtils.js'
import * as UniformsUtils from './UniformsUtils.js'

import { Perlin } from './Perlin.js';

class Planet {

    static loadedVertexShader; 
    static loadedFragmentShader;

    settings = {
        minimalCentre : 1,
        resolution : 4, 
        debug : false,
        noiseStrength : 1,
        noiseLayers : 3,
        roughness : 1,
        persistence : 1.5,
        weightMultiplicator : 1,
        waterLevelOffset : .1,
        hasWater : true,
    };

    #perlin;

    /**
     * 
     * @param {Scene} scene 
     * @param {Object} options
     * @param {Number} options.minimalCentre
     * @param {Number} options.resolution
     * @param {Boolean} options.debug
     * @param {Number} options.noiseLayers
     * @param {Number} options.roughness
     * @param {Number} options.persistence
     * @param {Number} options.weightMultiplicator
     * @param {Number} options.noiseStrength
     */
    constructor (scene, options) {

        Object.assign(this.settings, options)

        //init
        /** @type {Scene} */
        this.scene = scene;

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

        /** @type {Mesh} */
        this.CurrentMesh = null;
        this.Object = new Object3D();

        this.#perlin = new Perlin(Math.random());

    }

    Generate () {

        if(this.CurrentMesh != null) {

            console.log("removed old planet from scene");

            this.CurrentMesh.removeFromParent();
            this.scene.remove(this.Object);

        }

        this.minSurfacePoint = Number.MAX_SAFE_INTEGER;
        this.maxSurfacePoint = 0;

        //draw radius test line
        this.#drawDebugLine(
            new Vector3(),
            new Vector3(1,1,1).normalize().multiplyScalar(this.settings.minimalCentre), 
            'yellow');

        let merged = [];

        for (let i = 0; i < this.DirectionsList.length; i++) {
            
            let verts = this.#generateFace(this.DirectionsList[i]);

            merged = [...merged, ...verts];

        }

        let obj = this.#render(merged);

        this.Object.attach(obj);

        console.log("gen planet", this);

        return obj;

    }

    OnTimeUpdate (_t) {

        this.CurrentMesh.material.uniforms.time.value = _t;

    }

    /**
     * 
     * @param {Vector3} localUp 
     */
    #generateFace (localUp) {

        let axisA = new Vector3(localUp.y, localUp.z, localUp.x);
        let axisB = new Vector3().crossVectors(localUp, axisA);

        //draw axis test line
        this.#drawDebugLine(
            localUp.clone().add(axisB),
            axisA.clone().add(localUp).add(axisB), 
            'purple');

        this.#drawDebugLine(
            new Vector3(),
            localUp, 
            'white');

        let toGenPoints = this.settings.resolution * this.settings.resolution;

        let points = [];

        let pos = 0;

        for (let y = 0; y < this.settings.resolution; y++) {
            for (let x = 0; x < this.settings.resolution ; x++) {

                let percent = new Vector2(x,y).divideScalar(this.settings.resolution - 1);
                
                let vA = axisA.clone().multiplyScalar((percent.x - .5) * 2);
                let vB = axisB.clone().multiplyScalar((percent.y - .5) * 2);
                let pointOnUnitCube = localUp.clone().add(vA).add(vB);

                let pointOnRegularSphere = pointOnUnitCube.normalize();

                let noiseVal = this.#evaluateNoiseOnPoint(pointOnRegularSphere);
                let pointOnSphere = pointOnRegularSphere.clone().multiplyScalar(noiseVal);

                //calc min max points
                let pLen = pointOnSphere.length();
                if(pLen < this.minSurfacePoint) {
                    this.minSurfacePoint = pLen;
                } 
                if(pLen > this.maxSurfacePoint) {
                    this.maxSurfacePoint = pLen;
                }

                let col = new Color( pos / toGenPoints,0,0);
                this.#drawDebugPoint(pointOnSphere, col, 0.01);

                points.push(pointOnSphere);

                pos++;

            }
        }

        let currentQuad = 0;

        let verts = [];

        //calc tries for face points
        for (let x = 0; x < this.settings.resolution - 1; x++) {
            
            for (let y = 0; y < this.settings.resolution - 1; y++) {
                
                let offset = x;

                let c0off = currentQuad + offset;
                let c1off = currentQuad + 1 + offset;
                let c2off = currentQuad + (this.settings.resolution) + offset;
                let c3off = currentQuad + (this.settings.resolution + 1) + offset;

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

        //mesh
        let geometry = new BufferGeometry().setFromPoints(_verts);
        geometry.computeVertexNormals();

        let uniforms = {
            time: { type: "f", value: 1.0 },
            waterColor : {type: 'vec3', value: new Color('rgb(0,0,255)')},
            minWaterLevel : {type: 'float', value : this.minSurfacePoint + this.settings.waterLevelOffset},
            texture1: {value: this.#generateTexture()},
            elevationMinMax : {type: 'vec2', value: new Vector2(this.minSurfacePoint, this.maxSurfacePoint)},
        };

        const merged = UniformsUtils.mergeUniforms([
            UniformsLib.lights,
            UniformsLib.normalmap,
            uniforms
        ]);
    
        const material = new ShaderMaterial ({
            uniforms: merged,
            vertexShader: Planet.loadedVertexShader,
            fragmentShader: Planet.loadedFragmentShader,
            lights: true
        });

        this.CurrentMesh = new Mesh(geometry, material);

        this.CurrentMesh.receiveShadow = true;
        this.CurrentMesh.castShadow = true;

        return this.CurrentMesh;

    }

    #generateTexture () {

        const width = 128 * 20;

        let colorPoints = [
            {
                position : 0,
                r : 209,
                g : 191,
                b : 113
            },
            {
                position : .4,
                r : 0,
                g : 255,
                b : 0
            },
            {
                position : .5,
                r : 15,
                g : 112,
                b : 0
            },
            {
                position : .85,
                r : 100,
                g : 100,
                b : 100
            },
            {
                position : .9,
                r : 255,
                g : 255,
                b : 255
            },
            {
                position : 1,
                r : 255,
                g : 255,
                b : 255
            },
        ];

        let generatedFade = [];

        for (let i = 0; i < colorPoints.length - 1; i++) {

            let col = colorPoints[i];
            let nextCol = colorPoints[i + 1];

            const usePixelWidthA = Math.floor(width * (col.position));
            const usePixelWidthB = Math.floor(width * (nextCol.position));
            const pixelCount = Math.floor(usePixelWidthB - usePixelWidthA);

            //console.log(`Writing pixel index from ${usePixelWidthA} to ${usePixelWidthB}, with count of ${pixelCount}`);

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

        var canv = document.createElement('canvas');
        canv.width = width;
        canv.height = 50;
        canv.style = "position: fixed; z-index: 3; top: 0; left: 0;";
        var ctx = canv.getContext("2d");
        document.body.appendChild(canv);

        console.log("text width ", width);

        for (let i = 0; i < width; i++) {
            
            let stride = i * 4;

            let r = generatedFade[stride];
            let g = generatedFade[stride + 1];
            let b = generatedFade[stride + 2];

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(i, 0, 1, canv.height);

        }

        console.log("fade", generatedFade);

        const data = Uint8Array.from(generatedFade);
        const texture = new DataTexture(data, width, 1);
        texture.needsUpdate = true;

        const m = new MeshBasicMaterial({
            map: texture,
        });


        const planeSize = this.settings.minimalCentre / 2;
        const g = new PlaneGeometry(planeSize, planeSize);
        const plane = new Mesh(g, m);
        plane.rotateY(180 * 0.0174533);
        this.scene.add(plane);

        return texture;

    }

    /**
     * Evaluates the noise for a 3d point
     * @param {Vector3} v Vector point
     * @returns {number} Number between 0-1
     */
    #evaluateNoiseOnPoint (v) {

        let _freq = this.settings.roughness;
        let _amp = 1;
        let _noiseVal = 0;
        let _weight = 1;

        for (let i = 0; i < this.settings.noiseLayers; i++) {
           
            let n = this.#perlin.noise(
                v.x * _freq, 
                v.y * _freq, 
                v.z * _freq
            );

            n *= n;
            n *= _weight;

            if(n * this.settings.weightMultiplicator < 1 && n * this.settings.weightMultiplicator >0) {
                _weight = 1;
            } else {
                _weight = 0;
            }

            _noiseVal += n * _amp;
            _freq *= this.settings.roughness;
            _amp *= this.settings.persistence;

        }

        _noiseVal *= this.settings.noiseStrength;
        _noiseVal += this.settings.minimalCentre;

        if(this.settings.hasWater) {
            return this.#clamp(_noiseVal, this.settings.minimalCentre + this.settings.waterLevelOffset, 100);
        } else {
            return this.#clamp(_noiseVal, this.settings.minimalCentre, 100);
        }

    }

    #drawDebugLine (v1, v2, _color) {

        if(!this.debugMode) return;

        const points = [];
        points.push(v1);
        points.push(v2);

        const geometry = new BufferGeometry().setFromPoints( points );
        const material = new LineBasicMaterial( { color: _color } );
        const line = new Line( geometry, material );
        this.scene.add(line);
        this.Object.attach(line);

    }

    #drawDebugPoint (v, _color, size) {

        if(!this.debugMode) return;

        const material = new MeshBasicMaterial( { color: _color } );
        const gizmoSphereGeo = new SphereGeometry(size, size * 2,  size * 2);
        const sphere = new Mesh( gizmoSphereGeo, material );

        this.scene.add( sphere );
        sphere.position.set(v.x, v.y, v.z);

        this.Object.attach(sphere);

    }

    #clamp (num, min, max) {

        return Math.min(Math.max(num, min), max);

    }

    #lerp (x, y, t) {

        return x * (1 - t) + y * t;

    }

}

export { Planet }