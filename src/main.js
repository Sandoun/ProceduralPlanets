import * as THREE from './Three/three.module.js';
import { ShaderManager } from './SolarSystem/ShaderManager.js';
import { OrbitControls } from './Three/OrbitControls.js';
import { CelestialBody } from './SolarSystem/CelestialBody.js';
import { EffectComposer } from './Three/Postprocessing/EffectComposer.js';
import { RenderPass } from './Three/Postprocessing/RenderPass.js';
import { ShaderPass } from './Three/Postprocessing/ShaderPass.js';
import GUI from './Three/lil-gui.esm.js';
import { SolarSystemRenderer } from './SolarSystem/SolarSystemRenderer.js';
import { UiManager } from './UserInterface/UiManager.js';
import { WordGenerator } from './SolarSystem/WordGenerator.js';

window.addEventListener( 'resize', onWindowResize, false );

/** @type {THREE.Scene} */
let scene; 
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Camera} */
let camera;
/** @type {EffectComposer} */
let composer;
/** @type {ShaderPass} */
let shaderPass;
/** @type {SolarSystemRenderer} */
let solarSystem;

/** @type {UiManager} */
let uiManager;

let startTime = Date.now();

const gui = new GUI();

let debugOptions = {

  seed : "testseeed",

  regenerateAll : () => {
    GenerateSystem();
  }

};

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

  //debug controls
  const controls = new OrbitControls( camera, renderer.domElement );

  SetupLighting();

  RenderDebug();

  GenerateSystem();

  uiManager = new UiManager(solarSystem);

  animate();

}

function SetupDebugUI () {

  gui.add( debugOptions, 'seed').onChange((x) => RebuildPlanet());
  gui.add( debugOptions, 'regenerateAll');

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

  camera = new THREE.PerspectiveCamera( 75, aspect, .1, 1000 );
  camera.position.x = 20;
  camera.position.y = 20;
  camera.position.z = -20;
  camera.lookAt(0,0,0);

  //post processing
  composer = new EffectComposer(renderer);
  composer.setSize(defaultRendererW, defaultRendererH);

  const renderPass = new RenderPass( scene, camera );
  composer.addPass( renderPass );

  document.body.appendChild( renderer.domElement );

}

function SetupLighting () {

  const centerObj = new THREE.Object3D();
  scene.add(centerObj);

  //light
  const light = new THREE.DirectionalLight( 'rgb(0,0,0)', .3);
  light.castShadow = true;
  light.position.set(100, 100, 100);
  light.target = centerObj;
  scene.add( light );

  const refCube = new THREE.BoxGeometry(1,1,1);
  const refMat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
  const cube = new THREE.Mesh( refCube, refMat );
  cube.position.set(100, 100, 100);
  scene.add( cube );

}

function animate() {

  requestAnimationFrame( animate );

  solarSystem.OnAnimateLoop();
  renderer.render(scene, camera);
  composer.render();

  uiManager.OnFrameUpdate();

};

function RenderDebug () {

  //x is red
  //y is green
  // z is blue
  const axesHelper = new THREE.AxesHelper( 5 );
  axesHelper.translateZ(50);
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

