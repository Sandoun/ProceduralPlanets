import { OrbitControls } from '../Three/OrbitControls.js';
import { 
    Camera,
    Vector3,
    Vector2,
    Mesh,
    SphereGeometry,
    MeshBasicMaterial,
    Color,
} from '../Three/three.module.js';
import { CelestialBody } from './Bodies/CelestialBody.js';
import SolarSystemRenderer from "./SolarSystemRenderer.js";

export default class CameraDriver {

    #elapsedTimeTotal = 0;

    /** @type {SolarSystemRenderer} */
    system;

    /** @type {Mesh[]} */
    visualizedHeightPoints;

    /** @type {CameraAnchorPoint[]} */
    cameraAnchorPoints = [];

    /** @type {CameraAnchorPoint} */
    currentAnchorPoint;

    /** @type {CameraAnchorPoint} */
    lastAnchorPoint;

    /** @type {Number} */
    currentAnchorIndex = -1;

    #currentCameraLookAtPos = new Vector3();
    #isInTransition = false;
    #loadedSystem;

    /**
     * 
     * @param {Camera} camera 
     * @param {SolarSystemRenderer} solSystem 
     * @param {OrbitControls} solSystem 
     */
    constructor (camera, controls) {

        //time
        this.startTime = Date.now();
        this.speedMultiplicator = 1.0;

        /** @type {Camera} */
        this.camera = camera;

        /** @type {OrbitControls} */
        this.orbitControls = controls;

    }

    Start (solSystem) {

        /** @type {SolarSystemRenderer} */
        this.system = solSystem;

        this.system.addEventListener("bodies-loaded", () => this.OnSolarSystemLoaded());

    }

    OnSolarSystemLoaded () {

        this.GenerateCameraAnchors();

        this.#loadedSystem = true;

    }

    OnAnimateLoop (delta) {

        this.#elapsedTimeTotal += delta * this.speedMultiplicator;

        if(this.#loadedSystem) {
            
            this.UpdateCameraAnchors();
            
            //this.VisualizePoints();

        }

        this.AnimateCamera();

    }

    VisualizePoints () {

        if(this.visualizedHeightPoints == null) {

            this.visualizedHeightPoints = [];

            for (const aPoint of this.cameraAnchorPoints) {
            
                const geom = new SphereGeometry(.5, 10, 10);
                const msh1 = new Mesh(geom, new MeshBasicMaterial({color : 'red'}));
                const msh2 = new Mesh(geom, new MeshBasicMaterial({color : 'lime'}));
                this.visualizedHeightPoints.push(msh1);
                this.visualizedHeightPoints.push(msh2);
                this.system.scene.add(msh1);
                this.system.scene.add(msh2);

            }

        }

        for (let i = 0; i < this.cameraAnchorPoints.length; i++) {

            const aPoint = this.cameraAnchorPoints[i];
            
            this.visualizedHeightPoints[i * 2].position.set(
                aPoint.position.x,
                aPoint.position.y,
                aPoint.position.z,
            );

            this.visualizedHeightPoints[(i * 2) + 1].position.set(
                aPoint.lookAtPoint.x,
                aPoint.lookAtPoint.y,
                aPoint.lookAtPoint.z,
            );

        }

    }

    GenerateCameraAnchors () {

        for (let i = 0; i < this.system.celestialBodys.length; i++) {
           
            const body = this.system.celestialBodys[i];
            
            this.cameraAnchorPoints.push(new CameraAnchorPoint(
                body,
                "Overview"
            ));

            if(body.type == "Planet") {

                this.cameraAnchorPoints.push(new CameraAnchorPoint(
                    body,
                    "PlanetSystemFaceSun"
                ));

            }
        
        }

    }

    UpdateCameraAnchors () {

        for (let i = 0; i < this.cameraAnchorPoints.length; i++) {
                
            const aPoint = this.cameraAnchorPoints[i];
            
            aPoint.UpdatePosition(this.system);

        }

    }

    AnimateCamera () {

        //free cam lock on last planet
        if(this.currentAnchorIndex == -1 && this.lastAnchorPoint) {

            this.orbitControls.target = this.lastAnchorPoint.position;
            
        }

        //transition
        if(this.#isInTransition) {

            let currentCamPos = this.camera.position.clone();
            let newCamPos = currentCamPos.lerp(this.currentAnchorPoint.position, .1);   

            let currentCamLook = this.#currentCameraLookAtPos.clone();
            let newCamLook = currentCamLook.lerp(this.currentAnchorPoint.lookAtPoint, .1); 

            this.camera.position.set(
                newCamPos.x,
                newCamPos.y,
                newCamPos.z,
            );

            this.camera.lookAt(newCamLook);
            this.#currentCameraLookAtPos = newCamLook;

            const distToTarget = currentCamPos.distanceTo(this.currentAnchorPoint.position);
            if(distToTarget < .1) 
                this.#isInTransition = false;

            return;
        }

        //locked in cam pos
        if(this.currentAnchorPoint != null) {
        
            this.camera.position.set(
                this.currentAnchorPoint.position.x,
                this.currentAnchorPoint.position.y,
                this.currentAnchorPoint.position.z,
            );

            this.#currentCameraLookAtPos = this.currentAnchorPoint.lookAtPoint;
            this.camera.lookAt(this.currentAnchorPoint.lookAtPoint);

        }

    }

    CycleCameraNextAnchor () {
        
        if(this.currentAnchorIndex + 1 == this.cameraAnchorPoints.length) {
            this.currentAnchorIndex = -1;
        } else {
            this.currentAnchorIndex++;
        }

        this.SetCurrentAnchorPoint(this.currentAnchorIndex);

    }

    SetCurrentAnchorPoint (index, ignoreDefaultCamera = false) {

        this.lastAnchorPoint = this.currentAnchorPoint;

        if(index == -1 && !ignoreDefaultCamera) {
            this.SetDefaultCamera();
        } else {
            this.#isInTransition = true;
            this.orbitControls.enabled = false;
        }   

        if(index < 0) {
            this.currentAnchorIndex = -1;
            this.currentAnchorPoint = null;
        } else {
            this.currentAnchorPoint = this.cameraAnchorPoints[index];
        }

    }

    SetDefaultCamera () {

        this.#isInTransition = false;
        this.orbitControls.enabled = true;
        this.lastAnchorPoint = null;
        this.orbitControls.target = new Vector3();

        this.camera.position.x = 500;
        this.camera.position.y = 500;
        this.camera.position.z = -500;
        this.camera.lookAt(0,0,0);

    }

    SetFreeCamera () {

        this.SetCurrentAnchorPoint(-1, true);

        this.#isInTransition = false;
        this.orbitControls.enabled = true;

    }

}

class CameraAnchorPoint {

    /** @typedef {'Overview'|'PlanetSystemFaceSun'|'SunSynchronous'} AnchorType */

    /** @type {AnchorType} */
    type;

    /** @type {CelestialBody} */
    attachedBody;

    /** @type {Vector3} Position of the anchor*/
    position;

    /** @type {Vector3} Look direction of the anchor*/
    lookAtPoint;

    /**
     * 
     * @param {CelestialBody} forBody 
     * @param {AnchorType} type 
     */
    constructor(forBody, type) {

        this.type = type;
        this.attachedBody = forBody;

    }

    /**
     * 
     * @param {SolarSystemRenderer} solSystem 
     */
    UpdatePosition (solSystem) {

        if(this.type == "Overview") {
            this.CalcOverview();
        }

        if(this.type == "PlanetSystemFaceSun") {
            this.CalcSystemFacingSun(solSystem);
        }

    }

    CalcOverview () {

        const planetRad = this.attachedBody.settings.size.minimalCentre;

        const planetPos = this.attachedBody.Object.getWorldPosition(new Vector3());
        const surfPos = this.attachedBody.highestPointObj.getWorldPosition(new Vector3());

        const planetRot = this.attachedBody.Object.rotation.y;
        const angleRadians = 90 * (Math.PI / 180);
        const newX = Math.cos(angleRadians) * (planetRad * 3.5) + 5;
        const newY = Math.sin(angleRadians) * (planetRad * 3.5) + 5;

        this.position = new Vector3(newX, 0, newY).add(planetPos);
        this.lookAtPoint = planetPos.clone();

    }

    /**
     * 
     * @param {SolarSystemRenderer} solSystem 
     */
    CalcSystemFacingSun (solSystem) {

        if(solSystem.centerMassPoint == null) return;

        const lastPlanet = solSystem.celestialBodys.filter(x => x.type  == "Planet").slice(-1)[0];
        const lastPlanetDistanceFromCenter = lastPlanet.ownOrbit.distanceToCenter;

        const planetRad = this.attachedBody.settings.size.minimalCentre;
        const planetDistSun = this.attachedBody.ownOrbit.distanceToCenter;
        const planetPos = this.attachedBody.Object.getWorldPosition(new Vector3());
        const angleDeg = (((lastPlanetDistanceFromCenter + 100) - planetDistSun) * .005);
        const angleRadians = angleDeg * (Math.PI / 180);

        let dirSunPlanet = planetPos.clone().sub(solSystem.centerMassPoint).normalize();
        dirSunPlanet = dirSunPlanet.applyAxisAngle(new Vector3(0, 1, 0), angleRadians);


        let outerPos = solSystem.centerMassPoint.clone();
        outerPos = outerPos.add(dirSunPlanet.multiplyScalar(planetDistSun + (planetRad * 5)));
        outerPos = outerPos.add(new Vector3(0, planetRad * 2, 0));

        this.position = outerPos;
        this.lookAtPoint = planetPos;

    }

}

/* TestPoints () {

    const resolution = 100;
    let testPs = [
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(10,30,0),
      new THREE.Vector3(20,0,0),
  
      new THREE.Vector3(30,-30,0),
      new THREE.Vector3(40,0,0),
    ];
  
  
    let scaledPoints = [];
    for (let i = 0; i < resolution; i++) {
      
      const p = bezierCurve(testPs, i / resolution);
      scaledPoints.push(p);
    
    }
  
    const geometry = new THREE.BufferGeometry().setFromPoints( scaledPoints );
    const line = new THREE.Line( geometry, new THREE.LineBasicMaterial({color : 'white'}) );
    scene.add(line);
    line.translateX(200);
  
  } */

/**
 * 
 * @param {Vector3[]} inputPoints 
 * @param {Number} t 
 * @returns 
 */
function bezierCurve(inputPoints, t) {

    const factorial = (n) => {
      if (n === 0) return 1;
      return n * factorial(n - 1);
    }
  
    let point = new THREE.Vector3();
  
    for (let k = 0; k < inputPoints.length; k++) {
      let coefficient = factorial(inputPoints.length - 1) / (factorial(k) * factorial(inputPoints.length - 1 - k));
      point.x += coefficient * Math.pow(1 - t, inputPoints.length - 1 - k) * Math.pow(t, k) * inputPoints[k].x;
      point.y += coefficient * Math.pow(1 - t, inputPoints.length - 1 - k) * Math.pow(t, k) * inputPoints[k].y;
      point.z += coefficient * Math.pow(1 - t, inputPoints.length - 1 - k) * Math.pow(t, k) * inputPoints[k].z;
    }
  
    return point;
  
  }