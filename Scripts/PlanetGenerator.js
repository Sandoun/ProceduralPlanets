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
} from './three.module.js';

import { Perlin } from './Perlin.js';

class Planet {

    static loadedVertexShader; 
    static loadedFragmentShader;

    settings = {
        radius : 2, 
        minimalCentre : 1,
        resolution : 4, 
        debug : false,
        noiseLayers : 3,
        roughness : 1,
        persistence : 1,
        weightMultiplicator : 1,
    };

    #perlin;

    /**
     * 
     * @param {Scene} scene 
     * @param {Object} options
     * @param {Number} options.radius
     * @param {Number} options.minimalCentre
     * @param {Number} options.resolution
     * @param {Boolean} options.debug
     * @param {Number} options.noiseLayers
     * @param {Number} options.roughness
     * @param {Number} options.persistence
     * @param {Number} options.weightMultiplicator
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

        /**
         * @type {Vector3[]}
         */
        this.verticies = [];

        /**
         * @type {Vector3[]}
         */
        this.surfacePoints = [];

        this.minSurfacePoint = 0;
        this.maxSurfacePoint = 1;

        this.Object = new Object3D();

        this.#perlin = new Perlin(Math.random());

        console.log("gen planet", this);
        
        this.Object.attach(this.#GeneratePlanet());

    }

    #GeneratePlanet () {

        this.minSurfacePoint = Number.MAX_SAFE_INTEGER;
        this.maxSurfacePoint = 0;

        //draw radius test line
        this.#drawDebugLine(
            new Vector3(),
            new Vector3(1,1,1).normalize().multiplyScalar(this.settings.radius), 
            'yellow');

        let merged = [];

        for (let i = 0; i < this.DirectionsList.length; i++) {
            
            let verts = this.#GenerateFace(this.DirectionsList[i]);

            merged = [...merged, ...verts];

        }

        let obj = this.Render(merged);
        return obj;

    }

    /**
     * 
     * @param {Vector3} localUp 
     */
    #GenerateFace (localUp) {

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

    Render (_verts) {

        //mesh
        const geometry = new BufferGeometry().setFromPoints(_verts);
        geometry.computeVertexNormals();

        const material = new ShaderMaterial ({
            uniforms: {
                color1 : {type: 'vec3', value: new Color('rgb(0,255,0)')},
                color2 : {type: 'vec3', value: new Color('rgb(255,0,0)')},
                texture1: {value: this.GenerateTexture()},
                elevationMinMax : {type: 'vec2', value: new Vector2(this.minSurfacePoint, this.maxSurfacePoint)},
            },
            vertexShader: Planet.loadedVertexShader,
            fragmentShader: Planet.loadedFragmentShader
        });

        let objRef = new Mesh(geometry, material);

        objRef.receiveShadow = true;
        objRef.castShadow = true;

        return objRef;

    }

    GenerateTexture () {

        const width = 255;
        const height = 255;
        const data = new Uint8Array( 4 * width );

        for ( let i = 0; i < width * height; i ++ ) {

            const stride = i * 4;

            data[ stride ] = 0;
            data[ stride + 1 ] = 0;
            data[ stride + 2 ] = i;
            data[ stride + 3 ] = 255;

        }

        const texture = new DataTexture(data, 100, 1);
        texture.repeat = new Vector2(1,1);
        texture.needsUpdate = true;

        const m = new MeshBasicMaterial({
            map: texture,
        });

        const g = new PlaneGeometry(0, 0);
        const plane = new Mesh(g, m);
        plane.rotateY(180 * 0.0174533);
        plane.translateY(3);
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
        let _amp = 0.2;
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

        let final = Math.max(this.settings.minimalCentre, _noiseVal + this.settings.minimalCentre);

        return final;

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

    Clamp (num, min, max) {
        return Math.min(Math.max(num, min), max);
    }

}

export { Planet }