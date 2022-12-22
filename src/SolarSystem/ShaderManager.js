import { 
    Color,
    Vector2,
    UniformsLib,
    ShaderMaterial,
    Vector3,
    Matrix4,
    DataArrayTexture
} from '../Three/three.module.js'

import * as UniformsUtils from '../Three/UniformsUtils.js'
import { CelestialBody } from './CelestialBody.js';

class ShaderManager {

    static loadedFiles = false;

    static glslData = {
        PlanetShader : {
            vPath : "/Shaders/Planet/vertex.glsl",
            fPath : "/Shaders/Planet/fragment.glsl",
            shader : null,
        },
        PPshader : {
            vPath : "/Shaders/PostProcess/vertex.glsl",
            fPath : "/Shaders/PostProcess/fragment.glsl",
            shader : null,
        },
    };

    static async LoadShaders () {

        for (const [key, value] of Object.entries(ShaderManager.glslData)) {
            
            value.shader = await GlslShader.LoadFromFiles(value.vPath, value.fPath);

        }

        this.loadedFiles = true;

    }

    /**
     * 
     * @param {*} biomesArr 
     * @param {*} biomesTexture 
     * @param {CelestialBody} body 
     * @returns 
     */
    static PlanetShaderMat (biomesArr, biomesTexture, body) {

        const merged = UniformsUtils.mergeUniforms([
            UniformsLib.lights,
            UniformsLib.normalmap,
            {
                time: { type: "f", value: 1.0 },
                waterColor : {type: 'vec3', value: new Color('rgb(0,0,255)')},
                minWaterLevel : {type: 'float', value : body.minSurfacePoint + body.settings.water?.levelOffset ?? 0},
                biomes: { value : biomesArr},
                biomeGradients : { value : biomesTexture},
                biomeNoiseScale : { value : body.settings.biomes.noiseScale },
                biomeNoiseFrequ : { value : body.settings.biomes.noiseFrequency },
                biomeBlending : { value : body.settings.biomes.blendingSize },
                elevationMinMax : {type: 'vec2', value: new Vector2(body.minSurfacePoint, body.maxSurfacePoint)},
            }
        ]);

        const vert = ShaderManager.glslData.PlanetShader.shader.vertex;
        const frag = ShaderManager.glslData.PlanetShader.shader.fragment;

        return new ShaderMaterial ({
            uniforms: merged,
            vertexShader: vert,
            fragmentShader: frag.replace("#define BIOMES_SIZE 3", `#define BIOMES_SIZE ${biomesArr.length}`),
            lights: true
        });

    }

    static PostProcessingShader (numBodies) {

        const merged = UniformsUtils.mergeUniforms([
            {
                IN_INV_PROJECTION_MATRIX : {value : new Matrix4()},
                IN_INV_VIEW_MATRIX : {value : new Matrix4()},
                tDiffuse : { value: null },
                tDepth : { value: null },
                worldSpaceCamPos : {value : new Vector3(0,0,0)},
                shadeableBodies : {
                    value : []
                }

            }
        ]);

        return {
            uniforms: merged,
            vertexShader: ShaderManager.glslData.PPshader.shader.vertex,
            fragmentShader: ShaderManager.glslData.PPshader.shader.fragment.replace("#define NUM_BODIES 10", `#define NUM_BODIES ${numBodies}`),
        };

    }

}

function readFile(file) {
    return new Promise((resolve, reject) => {
        fetch(file)
        .then(response => response.text())
        .then(text => {
            resolve(text);
        })
    });
}

class GlslShader {

    constructor (_vert, _frag) {
        /** @type {String} */
        this.vertex = _vert;
        /** @type {String} */
        this.fragment = _frag;
    }

    static LoadFromFiles (_vertexPath, _fragmentPath) {

        return new Promise((resolve, reject) => {

            readFile(_vertexPath)
            .then((v) => {
                readFile(_fragmentPath)
                .then((f) => {
                    resolve(new GlslShader(v, f));
                })
            })

        });

    }

}

export { ShaderManager }