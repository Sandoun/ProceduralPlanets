import * as THREE from './Three/three.module.js';
import { ShaderManager } from './SolarSystem/ShaderManager.js';
import { OrbitControls } from './Three/OrbitControls.js';
import { CelestialBody, Orbit } from './SolarSystem/Bodies/CelestialBody.js';
import { EffectComposer } from './Three/Postprocessing/EffectComposer.js';
import { RenderPass } from './Three/Postprocessing/RenderPass.js';
import { ShaderPass } from './Three/Postprocessing/ShaderPass.js';
import GUI from './Three/lil-gui.esm.js';
import SolarSystemRenderer from './SolarSystem/SolarSystemRenderer.js';
import { UiManager } from './UserInterface/UiManager.js';
import { WordGenerator } from './SolarSystem/WordGenerator.js';
import CameraDriver from './SolarSystem/CameraDriver.js';

window.addEventListener( 'resize', onWindowResize, false );

/** @type {THREE.Scene} */
let scene; 
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Camera} */
let camera;
/** @type {EffectComposer} */
let composer;
/** @type {SolarSystemRenderer} */
let solarSystem;
/** @type {UiManager} */
let uiManager;
/** @type {CameraDriver} */
let cameraDriver;
/** @type {OrbitControls} */
let controls;
/** @type {THREE.Clock} */
let clock = new THREE.Clock();
let delta = 0;

const gui = new GUI();

let debugOptions = {

  seed : Date.now().toString(), //"testseed",
  speedMultiplicator : 1,
  showOrbits : true,
  regenerateAll : () => {
    GenerateSystem();
  },
  cycleCamera : () => {
    cameraDriver.CycleCameraNextAnchor();
  },
  setFreeCamera : () => {
    cameraDriver.SetFreeCamera();
  }
};

function SetupDebugUI () {

  gui.add( debugOptions, 'seed').onChange((x) => RebuildPlanet());
  gui.add( debugOptions, 'speedMultiplicator', [0, .5, 1, 2, 10]).onChange((x) => {
    solarSystem.SetSpeedMultiplicator(x);
  });
  gui.add( debugOptions, 'showOrbits').onChange((x) => {
    solarSystem.SetAllOrbitsVisibility(x);
  });
  gui.add( debugOptions, 'regenerateAll');
  gui.add( debugOptions, 'cycleCamera');
  gui.add( debugOptions, 'setFreeCamera');

}

PreLoadFiles();

async function PreLoadFiles () {

  await ShaderManager.LoadShaders();
  await WordGenerator.Preload();

  Main();

}

function Main () {

  SetupDebugUI();

  SetupScene();

  SetupRenderer();

  RenderDebug();

  GenerateSystem();

  uiManager = new UiManager(solarSystem);
  cameraDriver.Start(solarSystem);

  animate();

}

function SetupScene () {

  scene = new THREE.Scene()
  scene.background = new THREE.Color("rgb(0, 0, 5)");

}

function SetupRenderer () {

  const defaultRendererW = window.innerWidth;
  const defaultRendererH = window.innerHeight;
  const aspect = defaultRendererW / defaultRendererH;

  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.setSize(defaultRendererW, defaultRendererH);

  camera = new THREE.PerspectiveCamera( 60, aspect, .1, 5000 );

  //debug controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .1;
  cameraDriver = new CameraDriver(camera, controls);
  cameraDriver.SetDefaultCamera();

  //post processing
  composer = new EffectComposer(renderer);
  composer.setSize(defaultRendererW, defaultRendererH);

  const renderPass = new RenderPass( scene, camera );
  composer.addPass( renderPass );

  document.body.appendChild( renderer.domElement );

}

function animate() {

  requestAnimationFrame( animate );
  delta = clock.getDelta();

  cameraDriver.OnAnimateLoop(delta);
  if(controls.enabled) controls.update();
  solarSystem.OnAnimateLoop(delta);
  uiManager.OnFrameUpdate();

  renderer.render(scene, camera);
  composer.render();

};

function RenderDebug () {

  //x is red
  //y is green
  // z is blue
  const axesHelper = new THREE.AxesHelper( 5 );
  //axesHelper.translateZ(50);
  scene.add( axesHelper );

}

function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
    solarSystem.OnRendererSizeChange();

}

function GenerateSystem () {

  solarSystem = new SolarSystemRenderer(renderer, scene, camera, composer);
  solarSystem.seed = debugOptions.seed;

  solarSystem.GenerateSystem();

}