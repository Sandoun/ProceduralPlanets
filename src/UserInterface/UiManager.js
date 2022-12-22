import { CelboyUI } from "./CelboyUI.js";
import { SolarSystemRenderer } from "../SolarSystem/SolarSystemRenderer.js";

class UiManager {

    /** @type {HTMLDivElement} */
    rootEl;

    /** @type {CelboyUI[]} */
    celBodyContainers = [];

    /**
     * 
     * @param {SolarSystemRenderer} system 
     */
    constructor (system) {

        /** @type {SolarSystemRenderer} */
        this.system = system;

        this.#BuildRoot();

        this.#BuildCelBodies();

    }

    OnFrameUpdate () {

        for (let i = 0; i < this.celBodyContainers.length; i++) {
            
            this.celBodyContainers[i].OnFrameUpdate(this.system.camera);
            
        }

    }

    #BuildRoot () {

        this.rootEl = document.createElement("div");
        this.rootEl.id = "root-ui";
        this.rootEl.style = `
        width : 100%;
        height : 100%;  
        top : 0;
        left : 0;
        position : fixed;
        pointer-events: none;
        overflow: hidden;
        `;
        document.body.appendChild(this.rootEl);

    }

    #BuildCelBodies () {

        for (const clbody of this.system.celestialBodys) {
            
            this.celBodyContainers.push(new CelboyUI(this, clbody));

        }

    }

}

export { UiManager }