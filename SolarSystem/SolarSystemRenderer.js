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
import { RenderPass } from '../Three/Postprocessing/RenderPass.js';
import { ShaderPass } from '../Three/Postprocessing/ShaderPass.js';
import { ShaderManager } from './ShaderManager.js';
import { CelestialBody } from './CelestialBody.js';

class SolarSystemRenderer {

    /**@type {RandomNumberGen} Rng generator*/
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

        if(!ShaderManager.loadedFiles) {
            throw new Error("Preaload the shaders first by calling ShaderManager.LoadShaders()");
        }

        //paramas assign
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = composer;

        //rng
        this.seed = Date.now().toString();
        this.rngGenerator = new RandomNumberGen(this.seed);

        //time
        this.startTime = Date.now();

        this.#SetupDepthRenderer();
        this.GenerateSystem();

    }

    
    OnAnimateLoop () {

        var elapsedMilliseconds = Date.now() - this.startTime;
        var elapsedSeconds = elapsedMilliseconds / 1000.;

        this.#UpdateAtmosShaderPass();
        this.renderer.setRenderTarget(this.depthRenderTarget);

        //update all bodys on animate
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

    GenerateSystem () {

        const numOfPlanets = this.rngGenerator.GetNextInt(1, 3);

        for (let i = 0; i < numOfPlanets; i++) {

            this.#AddPlanet(i);
            
        }

        //add the pp shader with num of shaded bodies
        this.#SetupAtmosphereRenderer(numOfPlanets);
        
    }

    #AddPlanet (planetIndex) {

        const seed = this.rngGenerator.GetNext();
        const minCentre = this.rngGenerator.GetNext(5,20);

        let body = new CelestialBody({
            seed : seed,
            size : {
                resolution : Math.min(100, Math.floor(minCentre * 10)),
                minimalCentre : minCentre,
            },
            atmosphere : {
                waveLengthRed : this.rngGenerator.GetNext(0,1500),
                waveLengthGreen : this.rngGenerator.GetNext(0,1000),
                waveLengthBlue : this.rngGenerator.GetNext(0,1000),
                scatteringStrength : 2.0,
                scale : 1.0,
                fallOff : this.rngGenerator.GetNext(1.5, 40),
                instensity : this.rngGenerator.GetNext(.4, 3),
            }
        });

        body.Generate();

        //translate planet
        body.Object.translateX(planetIndex * 50);

        this.scene.add(body.Object);
        this.celestialBodys.push(body);

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

class RandomNumberGen {

    constructor (seedStr) {

        this.generator = new Math.seedrandom(seedStr,{ entropy: true });

    }

    /**
     * 
     * @param {Number} min Minimal return value
     * @param {Number} max Maximal return value
     * @returns A value between min and max
     */
    GetNext (min = 0, max = 1) {

        const gen = this.generator();
        return this.#map(gen, -1, 1, min, max);;

    }

    /**
     * 
     * @param {Number} min Minimal return value
     * @param {Number} max Maximal return value
     * @returns A value between min and max rounded
     */
    GetNextInt (min = 0, max = 1) {

        return Math.round(this.#map(this.generator(), -1, 1, min, max));

    }

    #map (val, in_min, in_max, out_min, out_max) {

        return (val - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    
    }


}

export { SolarSystemRenderer }

//rng generator

(function (global, pool, math) {

    var width = 256,        // each RC4 output is 0 <= x < 256
        chunks = 6,         // at least six RC4 outputs for each double
        digits = 52,        // there are 52 significant digits in a double
        rngname = 'random', // rngname: name for Math.random and Math.seedrandom
        startdenom = math.pow(width, chunks),
        significance = math.pow(2, digits),
        overflow = significance * 2,
        mask = width - 1,
        nodecrypto;         // node.js crypto module, initialized at the bottom.
    
    //
    // seedrandom()
    // This is the seedrandom function described above.
    //
    function seedrandom(seed, options, callback) {
      var key = [];
      options = (options == true) ? { entropy: true } : (options || {});
    
      // Flatten the seed string or build one from local entropy if needed.
      var shortseed = mixkey(flatten(
        options.entropy ? [seed, tostring(pool)] :
        (seed == null) ? autoseed() : seed, 3), key);
    
      // Use the seed to initialize an ARC4 generator.
      var arc4 = new ARC4(key);
    
      // This function returns a random double in [0, 1) that contains
      // randomness in every bit of the mantissa of the IEEE 754 value.
      var prng = function() {
        var n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
            d = startdenom,                 //   and denominator d = 2 ^ 48.
            x = 0;                          //   and no 'extra last byte'.
        while (n < significance) {          // Fill up all significant digits by
          n = (n + x) * width;              //   shifting numerator and
          d *= width;                       //   denominator and generating a
          x = arc4.g(1);                    //   new least-significant-byte.
        }
        while (n >= overflow) {             // To avoid rounding up, before adding
          n /= 2;                           //   last byte, shift everything
          d /= 2;                           //   right using integer math until
          x >>>= 1;                         //   we have exactly the desired bits.
        }
        return (n + x) / d;                 // Form the number within [0, 1).
      };
    
      prng.int32 = function() { return arc4.g(4) | 0; }
      prng.quick = function() { return arc4.g(4) / 0x100000000; }
      prng.double = prng;
    
      // Mix the randomness into accumulated entropy.
      mixkey(tostring(arc4.S), pool);
    
      // Calling convention: what to return as a function of prng, seed, is_math.
      return (options.pass || callback ||
          function(prng, seed, is_math_call, state) {
            if (state) {
              // Load the arc4 state from the given state if it has an S array.
              if (state.S) { copy(state, arc4); }
              // Only provide the .state method if requested via options.state.
              prng.state = function() { return copy(arc4, {}); }
            }

            if (is_math_call) { math[rngname] = prng; return seed; }
    
            // Otherwise, it is a newer calling convention, so return the
            // prng directly.
            else return prng;
          })(
      prng,
      shortseed,
      'global' in options ? options.global : (this == math),
      options.state);
    }
    
    function ARC4(key) {
      var t, keylen = key.length,
          me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
    
      // The empty key [] is treated as [0].
      if (!keylen) { key = [keylen++]; }
    
      // Set up S using the standard key scheduling algorithm.
      while (i < width) {
        s[i] = i++;
      }
      for (i = 0; i < width; i++) {
        s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))];
        s[j] = t;
      }
    
      // The "g" method returns the next (count) outputs as one number.
      (me.g = function(count) {
        // Using instance members instead of closure state nearly doubles speed.
        var t, r = 0,
            i = me.i, j = me.j, s = me.S;
        while (count--) {
          t = s[i = mask & (i + 1)];
          r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))];
        }
        me.i = i; me.j = j;
        return r;
      })(width);
    }
    
    function copy(f, t) {
      t.i = f.i;
      t.j = f.j;
      t.S = f.S.slice();
      return t;
    };
    
    function flatten(obj, depth) {
      var result = [], typ = (typeof obj), prop;
      if (depth && typ == 'object') {
        for (prop in obj) {
          try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
        }
      }
      return (result.length ? result : typ == 'string' ? obj : obj + '\0');
    }
    
    function mixkey(seed, key) {
      var stringseed = seed + '', smear, j = 0;
      while (j < stringseed.length) {
        key[mask & j] =
          mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
      }
      return tostring(key);
    }
    
    function autoseed() {
      try {
        var out;
        if (nodecrypto && (out = nodecrypto.randomBytes)) {
          // The use of 'out' to remember randomBytes makes tight minified code.
          out = out(width);
        } else {
          out = new Uint8Array(width);
          (global.crypto || global.msCrypto).getRandomValues(out);
        }
        return tostring(out);
      } catch (e) {
        var browser = global.navigator,
            plugins = browser && browser.plugins;
        return [+new Date, global, plugins, global.screen, tostring(pool)];
      }
    }

    function tostring(a) {
      return String.fromCharCode.apply(0, a);
    }
    
    mixkey(math.random(), pool);
    
    //
    // Nodejs and AMD support: export the implementation as a module using
    // either convention.
    //
    if ((typeof module) == 'object' && module.exports) {
      module.exports = seedrandom;
      // When in node.js, try using crypto package for autoseeding.
      try {
        nodecrypto = require('crypto');
      } catch (ex) {}
    } else if ((typeof define) == 'function' && define.amd) {
      define(function() { return seedrandom; });
    } else {
      // When included as a plain script, set up Math.seedrandom global.
      math['seed' + rngname] = seedrandom;
    }
    
})(
    (typeof self !== 'undefined') ? self : this,
    [],     // pool: entropy pool starts empty
    Math    // math: package containing random, pow, and seedrandom
);