import { 
    Color,
    Vector2,
    UniformsLib,
    ShaderMaterial,
    Vector3
} from '../three.module.js'

import * as UniformsUtils from '../UniformsUtils.js'

class ShaderManager {

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
        AtmosphereShader : {
            vPath : "/Shaders/Atmosphere/vertex.glsl",
            fPath : "/Shaders/Atmosphere/fragment.glsl",
            shader : null,
        },
    };

    static async LoadShaders () {

        for (const [key, value] of Object.entries(ShaderManager.glslData)) {
            
            value.shader = await GlslShader.LoadFromFiles(value.vPath, value.fPath);

        }

    }

    static PlanetShaderMat (texture, minSurfPoint, maxSurfPoint, waterLvlOffset) {

        const merged = UniformsUtils.mergeUniforms([
            UniformsLib.lights,
            UniformsLib.normalmap,
            {
                time: { type: "f", value: 1.0 },
                waterColor : {type: 'vec3', value: new Color('rgb(0,0,255)')},
                minWaterLevel : {type: 'float', value : minSurfPoint + waterLvlOffset},
                texture1: { value: texture },
                elevationMinMax : {type: 'vec2', value: new Vector2(minSurfPoint, maxSurfPoint)},
            }
        ]);

        return new ShaderMaterial ({
            uniforms: merged,
            vertexShader: ShaderManager.glslData.PlanetShader.shader.vertex,
            fragmentShader: ShaderManager.glslData.PlanetShader.shader.fragment,
            lights: true
        });

    }

    static AtmosphereShaderMat (color, opacity) {

        const merged = UniformsUtils.mergeUniforms([
            UniformsLib.lights,
            UniformsLib.normalmap,
            {
                time: { type: "f", value: 1.0 },
                atmosColor : {type: 'vec3', value: color},
                atmosOpacity : { type: "f", value: opacity}
            }
        ]);

        return new ShaderMaterial ({
            uniforms: merged,
            vertexShader: ShaderManager.glslData.AtmosphereShader.shader.vertex,
            fragmentShader: ShaderManager.glslData.AtmosphereShader.shader.fragment,
            lights: true,
            transparent : true
        });

    }

    static PostProcessingShader () {

        const merged = UniformsUtils.mergeUniforms([
            {
                worldSpaceCamPos : {value : new Vector3(0,0,0)},
                viewVector :  {value : new Vector3(0,0,0)},
                tDiffuse : { value: null },
                tDepth : { value: null },
                cameraNear : { value : 0 },
                cameraFar : { value : 0 },
                opacity : { value: 1.0 }
            }
        ]);

        return {
            uniforms: merged,
            vertexShader: ShaderManager.glslData.PPshader.shader.vertex,
            fragmentShader: ShaderManager.glslData.PPshader.shader.fragment,
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