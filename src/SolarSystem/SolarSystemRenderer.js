import { 
    WebGLRenderer,
    WebGLRenderTarget,
    Scene, 
    Camera,
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
    DepthTexture,
    RGBFormat,
    UnsignedShortType,
    LineDashedMaterial,
} from '../Three/three.module.js';

import { EffectComposer } from '../Three/Postprocessing/EffectComposer.js';
import { ShaderPass } from '../Three/Postprocessing/ShaderPass.js';
import { ShaderManager } from './ShaderManager.js';
import { CelestialBody, Orbit } from './Bodies/CelestialBody.js';
import CelestialBodyFactory from './Bodies/CelestialBodyFactory.js';
import { Prando } from './Prando.js';
import { join } from '../UserInterface/Lit/lit-all.min.js';

export default class SolarSystemRenderer extends EventTarget {

    /**@type {Prando} Rng generator*/
    rngGenerator;

    /**@type {CelestialBody[]} Collection of all celestial bodys*/
    celestialBodys = [];

    /**@type {Object3D} Parent of all celestial bodys*/
    object3D;

    /**@type {Number} */
    startTime;

    /**@type {WebGLRenderTarget} */
    depthRenderTarget;

    /**@type {ShaderPass} */
    atmosphereShaderPass;

    /**@type {ShaderPass} */
    sunPostShaderPass;

    #elapsedTimeTotal = 0;

    /** @type {Orbit[]} Orbits this body has */
    orbits = [];

    /** @type {Vector3} current combined center of the suns */
    centerMassPoint;

    /**
     * Sets up a new solar system renderer
     * @param {WebGLRenderer} renderer 
     * @param {Scene} scene 
     * @param {Camera} camera 
     * @param {EffectComposer} composer 
     */
    constructor (renderer, scene, camera, composer) {

        super();

        if(!ShaderManager.loadedFiles) {
            throw new Error("Preaload the shaders first by calling ShaderManager.LoadShaders()");
        }

        //paramas assign
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = composer;

        //rng
        this.seed = "testseeed";

        //time
        this.startTime = Date.now();
        this.speedMultiplicator = 1.0;

        this.object3D = new Object3D();
        this.shaderSunsStructs = [];


        this.#SetupDepthRenderer();
        this.scene.add(this.object3D);

    }

    
    OnAnimateLoop (delta) {

        const deltaSpeed = delta * this.speedMultiplicator;
        this.#elapsedTimeTotal += deltaSpeed;

        //let the moons orbit
        for (let i = 0; i < this.orbits.length; i++) {
            
            const orbit = this.orbits[i];

            //calc periodFactor
            if(orbit.isReversed) {
                orbit.angle += deltaSpeed / ((orbit.periodSeconds) / 360) * -1;
            } else {
                orbit.angle += deltaSpeed / ((orbit.periodSeconds) / 360);
            }

            const angleRadians = (orbit.angle + orbit.startAngle) * (Math.PI / 180);
            const newX = Math.cos(angleRadians) * orbit.distanceToCenter;
            const newY = Math.sin(angleRadians) * orbit.distanceToCenter;
            
            orbit.attachedBody.Object.position.set(newX + this.object3D.position.x, this.object3D.position.y, newY + this.object3D.position.z);

            //determine if the orbit ring is visual
            /** @type {Mesh} */
            const ring = this.orbitRings[i];
            ring.visible = orbit.isVisual;

            ring.position.set(this.object3D.position.x, this.object3D.position.y, this.object3D.position.z);

        }

        //update all bodys on animate
        if(!this.celestialBodys) return;

        this.shaderSunsStructs = [];
        for (const body of this.celestialBodys) { 
            if(body.type == "Sun") {
                this.shaderSunsStructs.push({
                    color : new Color(1.0,1.0,1.0),
                    position : new Vector3(
                        body.Object.position.x, 
                        body.Object.position.y, 
                        body.Object.position.z, 
                    ),
                    radius : body.settings.size.minimalCentre,
                });
            }
        }
        
        for (const body of this.celestialBodys) {

            //set position of suns for each shaded body
            if(body.type != "Sun") {
                body.CurrentMesh.material.uniforms.suns.value = this.shaderSunsStructs;
            }

            body.OnTimeUpdate(this.#elapsedTimeTotal);

        }

        this.renderer.setRenderTarget(this.depthRenderTarget);
        this.#UpdateAtmosShaderPass();
        this.#UpdateSunPostShaderPass(this.#elapsedTimeTotal * 1000);
        

    }

    OnRendererSizeChange () {

        if(this.depthRenderTarget) {

            const w = this.renderer.domElement.width;
            const h = this.renderer.domElement.height;
            this.depthRenderTarget.setSize(w, h);

        }
            
    }

    async GenerateSystem () {

        this.celestialBodys = [];
        this.object3D.children = [];

        this.rngGenerator = new Prando(this.seed);
        this.bodyFactory = new CelestialBodyFactory(this);

        this.celestialBodys = await this.bodyFactory.GenerateAsync();
        
        console.log(this);
        console.log(this.celestialBodys)

        if(this.celestialBodys == null || this.celestialBodys.length <= 0) return;

        let numBodiesWithAtmos = 0;
        for (let i = 0; i < this.celestialBodys.length; i++) {
        
            this.object3D.add(this.celestialBodys[i].Object);
            
            if(this.celestialBodys[i].settings.atmosphere != undefined)
                numBodiesWithAtmos++;

        }

        this.dispatchEvent(new Event("bodies-loaded"));

        this.#SetupSunPostProcessRenderer();

        //add the pp shader with num of shaded bodies
        if(numBodiesWithAtmos > 0)
            this.#SetupAtmosphereRenderer(numBodiesWithAtmos);
        
        this.SetAllOrbitsVisibility(true);

    }

    #SetupDepthRenderer () {

        const w = this.renderer.domElement.width;
        const h = this.renderer.domElement.height;
        this.depthRenderTarget = new WebGLRenderTarget(w, h);

        this.depthRenderTarget.texture.format = RGBFormat;
        this.depthRenderTarget.texture.minFilter = NearestFilter;
        this.depthRenderTarget.texture.magFilter = NearestFilter;
        this.depthRenderTarget.texture.generateMipmaps = false;
        this.depthRenderTarget.stencilBuffer = false;
        this.depthRenderTarget.depthBuffer = true;
        this.depthRenderTarget.depthTexture = new DepthTexture();
        this.depthRenderTarget.depthTexture.type = UnsignedShortType;

    }

    #SetupAtmosphereRenderer (numBodies) {

      //this.composer.removePass(this.atmosphereShaderPass);
      
      this.atmosphereShaderPass = new ShaderPass(ShaderManager.PostProcessingPlanetShader(numBodies));
      this.composer.addPass(this.atmosphereShaderPass);

    }

    #SetupSunPostProcessRenderer (numBodies) {

        this.sunPostShaderPass = new ShaderPass(ShaderManager.PostProcessingSunShader());
        this.composer.addPass(this.sunPostShaderPass);
  
      }

    #UpdateAtmosShaderPass () {

        if(this.atmosphereShaderPass == null || this.camera == null) return;

        this.atmosphereShaderPass.uniforms.worldSpaceCamPos.value = this.camera.getWorldPosition(new Vector3());
        this.atmosphereShaderPass.uniforms.IN_INV_PROJECTION_MATRIX.value = this.camera.projectionMatrixInverse;
        this.atmosphereShaderPass.uniforms.IN_INV_VIEW_MATRIX.value = this.camera.matrix;
        this.atmosphereShaderPass.uniforms.tDepth.value = this.depthRenderTarget.depthTexture;

        let planetShadingStructs = [];
        for (const body of this.celestialBodys) {

            if(!body.settings.atmosphere) continue;

            const bodyRadius = body.maxSurfacePoint + .25;

            const r = body.settings.atmosphere.waveLengthRed;
            const g = body.settings.atmosphere.waveLengthGreen;
            const b = body.settings.atmosphere.waveLengthBlue;

            let waveLengths = new Vector3(r,g,b);

            let scatterR = Math.pow(400 / waveLengths.x, 4) * body.settings.atmosphere.scatteringStrength;
            let scatterG = Math.pow(400 / waveLengths.y, 4) * body.settings.atmosphere.scatteringStrength;
            let scatterB = Math.pow(400 / waveLengths.z, 4) * body.settings.atmosphere.scatteringStrength;
            
            let _scatteringCoefficients = new Vector3(scatterR, scatterG, scatterB);
            let _atmoRadius = bodyRadius * (body.settings.atmosphere.scale + 1.0);

            //calculate average point where the sunlight is coming from to 
            //avoid rendering multiple atmosphere passes for each light source
            let sunPositions = [];
            for (let i = 0; i < this.shaderSunsStructs.length; i++) {
                sunPositions.push(this.shaderSunsStructs[i].position);
            }
            this.centerMassPoint = SolarSystemRenderer.CalculateCenterOfMassPoints(sunPositions);

            planetShadingStructs.push({
                PlanetCentre : body.Object.position,
                PlanetRadius : bodyRadius,
                AtmosphereRadius : _atmoRadius,
                DirToSun : this.centerMassPoint.clone().sub(body.Object.position).normalize(),
                NumInScatteringPoints : 10,
                NumOpticalDepthPoints : 10,
                ScatteringCoefficients : _scatteringCoefficients,
                DensityFalloff : body.settings.atmosphere.fallOff,
                Intensity : body.settings.atmosphere.instensity
            });

        }

        this.atmosphereShaderPass.uniforms.shadeableBodies.value = planetShadingStructs;

    }

    #UpdateSunPostShaderPass (_t) {

        if(this.sunPostShaderPass == null || this.camera == null) return;

        this.sunPostShaderPass.uniforms.time.value = _t;
        this.sunPostShaderPass.uniforms.worldSpaceCamPos.value = this.camera.getWorldPosition(new Vector3());
        this.sunPostShaderPass.uniforms.IN_INV_PROJECTION_MATRIX.value = this.camera.projectionMatrixInverse;
        this.sunPostShaderPass.uniforms.IN_INV_VIEW_MATRIX.value = this.camera.matrix;
        this.sunPostShaderPass.uniforms.tDepth.value = this.depthRenderTarget.depthTexture;
        
        if(this.shaderSunsStructs.length > 0)
            this.sunPostShaderPass.uniforms.suns.value = this.shaderSunsStructs;

    }

    /**
     * Calculates the center of mass point for a point cloud
     * @param {Vector3[]} points 
     * @returns {Vector3} Center of mass point
     */
    static CalculateCenterOfMassPoints (points) {
        let x = 0, y = 0, z = 0;
        for (let i = 0; i < points.length; i++) {
            x += points[i].x;
            y += points[i].y;
            z += points[i].z;
        }
        return new Vector3(
            x / points.length,
            y / points.length,
            z / points.length,
        );
    }

    //orbit rendering

    /**
     * Generates orbital rings for this system
     */
    GenerateOrbitRings () {

        this.orbitRings = [];

        for (let i = 0; i < this.orbits.length; i++) {

            const orbit = this.orbits[i];
            const segmentCount = Math.floor(orbit.distanceToCenter);
            const radius = orbit.distanceToCenter;

            let verts = [];

            for (var j = 0; j <= segmentCount; j++) {
                
                var theta = (j / segmentCount) * Math.PI * 2;
                const vec = new Vector3(
                    Math.cos(theta) * radius,
                    0,
                    Math.sin(theta) * radius,
                );

                verts.push(vec);         
                
            }

            const ring = new Line(
                new BufferGeometry().setFromPoints(verts),
                new LineDashedMaterial({ 
                    color: 0xFFFFFF,
                    opacity : .3,
                    transparent: true,
                    linewidth: 1,
                    scale: 1,
                    dashSize: 3,
                    gapSize: 10,
                })
            );

            ring.computeLineDistances();

            this.orbitRings.push(ring);
            this.scene.add(ring);

        }

    }

    /**
     * 
     * @param {CelestialBody} body 
     * @param {Number} distanceToCenter 
     * @param {Number} angle 
     * @returns {Orbit} the calculated orbit
     */
    AttachOrbitingBody (body, distanceToCenter, angle, periodSeconds, reversed) {

        const orb = new Orbit(body, undefined, distanceToCenter, 0, angle, periodSeconds, reversed);
        this.orbits.push(orb);
        return orb;

    }

    /**
     * 
     * @param {Boolean} state 
     */
    SetAllOrbitsVisibility (state = true) {

        for (let i = 0; i < this.orbits.length; i++) {
         
            this.orbits[i].isVisual = state;

        }

        for (let i = 0; i < this.celestialBodys.length; i++) {
            
            if(this.celestialBodys[i].orbits && this.celestialBodys[i].orbits.length > 0) {

                for (let j = 0; j < this.celestialBodys[i].orbits.length; j++) {
         
                    this.celestialBodys[i].orbits[j].isVisual = state;

                }

            }

        }

    }

    /**
     * 
     * @param {Number} mult 
     */
    SetSpeedMultiplicator (mult) {

        this.speedMultiplicator = mult;

    }

}