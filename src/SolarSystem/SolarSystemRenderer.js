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
} from '../Three/three.module.js';

import { EffectComposer } from '../Three/Postprocessing/EffectComposer.js';
import { ShaderPass } from '../Three/Postprocessing/ShaderPass.js';
import { ShaderManager } from './ShaderManager.js';
import { CelestialBody } from './Bodies/CelestialBody.js';
import CelestialBodyFactory from './Bodies/CelestialBodyFactory.js';
import { Prando } from './Prando.js';

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

        this.object3D = new Object3D();

        this.#SetupDepthRenderer();

        this.scene.add(this.object3D);

    }

    
    OnAnimateLoop () {

        var elapsedMilliseconds = Date.now() - this.startTime;
        var elapsedSeconds = elapsedMilliseconds / 1000.;

        this.#UpdateAtmosShaderPass();
        this.renderer.setRenderTarget(this.depthRenderTarget);

        //update all bodys on animate
        if(!this.celestialBodys) return;
        for (const body of this.celestialBodys) {
            body.OnTimeUpdate(elapsedMilliseconds);
        }

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
    
        console.log(this.celestialBodys)

        if(this.celestialBodys == null || this.celestialBodys.length <= 0) return;

        let numBodiesWithAtmos = 0;
        for (let i = 0; i < this.celestialBodys.length; i++) {
            
            this.object3D.add(this.celestialBodys[i].Object);
            
            if(this.celestialBodys[i].settings.atmosphere != undefined)
                numBodiesWithAtmos++;

        }

        this.dispatchEvent(new Event("bodies-loaded"));

        //add the pp shader with num of shaded bodies
        if(numBodiesWithAtmos > 0)
            this.#SetupAtmosphereRenderer(numBodiesWithAtmos);
        
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
      
      this.atmosphereShaderPass = new ShaderPass(ShaderManager.PostProcessingShader(numBodies));
      this.composer.addPass(this.atmosphereShaderPass);

    }

    #UpdateAtmosShaderPass () {

        if(this.atmosphereShaderPass == null || this.camera == null) return;

        this.atmosphereShaderPass.uniforms.worldSpaceCamPos.value = this.camera.getWorldPosition(new Vector3());
        this.atmosphereShaderPass.uniforms.IN_INV_PROJECTION_MATRIX.value = this.camera.projectionMatrixInverse;
        this.atmosphereShaderPass.uniforms.IN_INV_VIEW_MATRIX.value = this.camera.matrix;
        this.atmosphereShaderPass.uniforms.tDepth.value = this.depthRenderTarget.depthTexture;

        let planetShadingStructs = [];
        for (const body of this.celestialBodys) {

            const bodyRadius = body.maxSurfacePoint;

            const r = body.settings.atmosphere.waveLengthRed;
            const g = body.settings.atmosphere.waveLengthGreen;
            const b = body.settings.atmosphere.waveLengthBlue;

            let waveLengths = new Vector3(r,g,b);

            let scatterR = Math.pow(400 / waveLengths.x, 4) * body.settings.atmosphere.scatteringStrength;
            let scatterG = Math.pow(400 / waveLengths.y, 4) * body.settings.atmosphere.scatteringStrength;
            let scatterB = Math.pow(400 / waveLengths.z, 4) * body.settings.atmosphere.scatteringStrength;
            
            let _scatteringCoefficients = new Vector3(scatterR, scatterG, scatterB);
            let _atmoRadius = bodyRadius * (body.settings.atmosphere.scale + 1.0);

            planetShadingStructs.push({
                PlanetCentre : body.Object.position,
                PlanetRadius : bodyRadius,
                AtmosphereRadius : _atmoRadius,
                DirToSun : new Vector3(1,1,1),
                NumInScatteringPoints : 10,
                NumOpticalDepthPoints : 10,
                ScatteringCoefficients : _scatteringCoefficients,
                DensityFalloff : body.settings.atmosphere.fallOff,
                Intensity : body.settings.atmosphere.instensity
            });

        }

        this.atmosphereShaderPass.uniforms.shadeableBodies.value = planetShadingStructs;

    }

}