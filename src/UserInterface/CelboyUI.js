import {
    LitElement,
    css,
    html, 
    styleMap,
    unsafeCSS
} from './Lit/lit-all.min.js';

import { 
    WebGLRenderer,
    WebGLRenderTarget,
    Scene, 
    Camera,
    Color,
    Object3D,
    Vector2, 
    Vector3,
    Frustum,
    Matrix4,
} from '../Three/three.module.js';

import { CelestialBody } from '../SolarSystem/Bodies/CelestialBody.js';
import { UiManager } from './UiManager.js';
import './CustomConverters.js';

//general ui wrapper
class CelboyUI {

    static maxDistance = 150;

    /**
     * @param {UiManager} manager 
     * @param {CelestialBody} body 
     */
    constructor(manager, body) {

        /** @type {UiManager} */
        this.manager = manager;
        /** @type {CelestialBody} */
        this.body = body;

        this.infoEl = document.createElement('planet-info');
        this.infoEl.celBodyInfo = this.body;

        this.manager.rootEl.appendChild(this.infoEl)

    }

    /**
     * 
     * @param {Camera} camera 
     */
    OnFrameUpdate (camera) {
        
        const worldPos = this.body.Object.getWorldPosition(new Vector3(0,0,1)).clone();
        const camWorldPos = camera.getWorldPosition(new Vector3(0,0,0));
        const dist = camWorldPos.distanceTo(worldPos);
        const screenCoords = this.#WorldToScreenCoords(camera, this.body.maxSurfacePoint + 5, worldPos);

        //hide if out of view
        const frustum = new Frustum()
        const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        frustum.setFromProjectionMatrix(matrix)
        
        this.infoEl.isVisible = frustum.containsPoint(worldPos) && dist <= CelboyUI.maxDistance;
        this.infoEl.distToCam = dist;

        if(!this.infoEl.isVisible) return;

        this.infoEl.distOpacity = (CelboyUI.maxDistance - dist) / (CelboyUI.maxDistance / 2);
        this.infoEl.zIdx = Math.floor(CelboyUI.maxDistance - dist);

        //wait for it to render
        if(this.infoEl.shadowRoot.querySelector("div")) {

            const elWidth = this.infoEl.shadowRoot.querySelector("div").clientWidth;
            const elHeight = this.infoEl.shadowRoot.querySelector("div").clientHeight;

            const newX = screenCoords.x - (elWidth / 2);
            const newY = screenCoords.y - elHeight;

            if(newX > -elWidth && newX < window.innerWidth + elWidth) 
                this.infoEl.left = newX;
            if(newY > -elHeight && newY < window.innerHeight + elHeight)
                this.infoEl.top = newY;

        }  

    }

    /**
     * 
     * @param {Camera} camera 
     */
    #WorldToScreenCoords (camera, offY, worldPos) {

        const width = window.innerWidth, height = window.innerHeight;
        const widthHalf = width / 2, heightHalf = height / 2;

        const pos = worldPos.clone();

        pos.y += offY;
        pos.project(camera);

        const _x = ( pos.x * widthHalf ) + widthHalf;
        const _y = - ( pos.y * heightHalf ) + heightHalf;

        return {
            x : _x,
            y : _y 
        };

    }

}

//ui definition
export class PlanetInfo extends LitElement {
    static properties = {
        top: {},
        left: {},
        isVisible: {},
        /** @type {CelestialBody} */
        celBodyInfo : {},
        distOpacity : {},
        distToCam : {},
        zIdx : {}
    };
    static styles = css`
        :host {
            pointer-events: auto;
            user-select: none;
            position : absolute;
        }
        .rootdiv {
            position : absolute;
            background : #303030;
            color : white;
            border-radius: 1em;
            min-width: 18ch;
            white-space: wrap;  
            z-index: var(--z-idx-off);
        }
        .visible {
            opacity : var(--dist-opa);
            transition: opacity 1s;
        }
        .hidden {
            opacity : 0;
        }
        .topinfo {
            margin: .5em 1em .5em 1em;
        }
        .name {
            white-space: nowrap;    
        }
        .info {
            white-space: nowrap;    
            color: gray;
        }
        .subinfo {
            padding: .5em 1em 1em 1em;
            white-space: wrap;    
            font-size: .7em;
            background: rgba(0,0,0, .1);
            color: gray;
        }
    `;
    constructor() {
        super();
        this.top = 0;
        this.left = 0;
        this.distToCam = 0;
        this.isVisible = true;
        /** @type {CelestialBody} */
        this.celBodyInfo = null;
    }
    renderPlanet () {
        return html`
            <div style="left: ${this.left}px; 
                        top: ${this.top}px; 
                        --dist-opa: ${this.distOpacity};
                        --z-idx-off: ${this.zIdx}" 
                 class="rootdiv ${this.isVisible ? "visible" : "hidden"}">
                 
                <div class="topinfo">
                    <span class="name">${this.celBodyInfo.name}</span><br/>
                    <span class="info">Distance ${this.distToCam.roundPrecise(0)}U</span><br/>
                </div>
                
            </div>
        `;
    }

    renderMoon () {
        return html`
            <div style="left: ${this.left}px; 
                        top: ${this.top}px; 
                        --dist-opa: ${this.distOpacity};
                        --z-idx-off: ${this.zIdx}" 
                 class="rootdiv ${this.isVisible ? "visible" : "hidden"}">
                 
                <div class="topinfo">
                    <span class="name">${this.celBodyInfo.name}</span><br/>
                    <span class="info">Distance ${this.distToCam.roundPrecise(0)}U</span><br/>
                </div>
                
                <div class="subinfo">
                    <span>
                        Is orbiting the planet ${this.celBodyInfo.ownOrbit.orbitObject.name} 
                        with a period of ${this.celBodyInfo.ownOrbit.periodSeconds.secondsToStr()}
                    </span>
                </div>
            </div>
        `;
    }

    render() {
        switch(this.celBodyInfo.type) {
            case "Planet" :
            return this.renderPlanet();
            case "Moon" :
            return this.renderMoon();
        } 
    }
}

customElements.define('planet-info', PlanetInfo);

export { CelboyUI }