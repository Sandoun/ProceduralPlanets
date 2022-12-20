import * as THREE from './Three/three.module.js';
import { ShaderManager } from './SolarSystem/ShaderManager.js';
import { OrbitControls } from './Three/OrbitControls.js';
import { CelestialBody } from './SolarSystem/CelestialBody.js';
import { EffectComposer } from './Three/Postprocessing/EffectComposer.js';
import { RenderPass } from './Three/Postprocessing/RenderPass.js';
import { ShaderPass } from './Three/Postprocessing/ShaderPass.js';
import GUI from './Three/lil-gui.esm.js';
import { SolarSystemRenderer } from './SolarSystem/SolarSystemRenderer.js';

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

let startTime = Date.now();

const gui = new GUI();
let planetOptions = {

  debug : false,
  seed : '0123456',
  minimalCentre : 15,
  //mesh resolution
  resolution : 300,
  //increase detail
  noiseLayers : 10,
  weightMultiplicator : 2,
  //how rought should the terrain look 
  roughness : 3,
  //overall how many places with high areas should appear
  persistence : .4,
  noiseStrength : 1,
  waterLevelOffset : Math.random() * .3,
  hasWater : true,
  rotationSpeed : .5,

	Rebuild: () => { 

    RebuildPlanet();

  }

};

PreLoadFiles();

async function PreLoadFiles () {

  await ShaderManager.LoadShaders();

  Main();

}

function Main () {

  SetupScene();

  SetupRenderer();

  //debug controls
  const controls = new OrbitControls( camera, renderer.domElement );

  SetupLighting();

  RenderDebug();
  
  scene.addEventListener("")

  solarSystem = new SolarSystemRenderer(renderer, scene, camera, composer);

  animate();

}

function SetupDebugUI () {

  gui.add( planetOptions, 'debug').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'seed').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'minimalCentre').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'resolution').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'noiseStrength').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'noiseLayers').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'roughness').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'persistence').onChange((x) => RebuildPlanet());
  gui.add( planetOptions, 'weightMultiplicator').onChange((x) => RebuildPlanet());

  gui.add( planetOptions, 'Rebuild');

  gui.add(planetOptions, 'rotationSpeed', 0, 10, 0.1);
  gui.add(planetOptions, 'waterLevelOffset', 0, 1, 0.1);
  gui.add(planetOptions, 'hasWater');

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

  //depth render target
  /* depthRenderTarget = new THREE.WebGLRenderTarget( defaultRendererW,  defaultRendererH );
  depthRenderTarget.texture.format = THREE.RGBFormat;
  depthRenderTarget.texture.minFilter = THREE.NearestFilter;
  depthRenderTarget.texture.magFilter = THREE.NearestFilter;
  depthRenderTarget.texture.generateMipmaps = false;
  depthRenderTarget.stencilBuffer = false;
  depthRenderTarget.depthBuffer = true;
  depthRenderTarget.depthTexture = new THREE.DepthTexture();
  depthRenderTarget.depthTexture.type = THREE.UnsignedShortType; */

  //post processing
  composer = new EffectComposer(renderer);
  composer.setSize(defaultRendererW, defaultRendererH);

  const renderPass = new RenderPass( scene, camera );
  composer.addPass( renderPass );

  //shaderPass = new ShaderPass(ShaderManager.PostProcessingShader());
  //composer.addPass(shaderPass);

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

  /* if(shaderPass != null && camera != null) {

    shaderPass.uniforms.worldSpaceCamPos.value = camera.getWorldPosition(new THREE.Vector3());
    shaderPass.uniforms.IN_INV_PROJECTION_MATRIX.value = camera.projectionMatrixInverse;
    shaderPass.uniforms.IN_INV_VIEW_MATRIX.value = camera.matrix;
    shaderPass.uniforms.tDepth.value = depthRenderTarget.depthTexture;
    
  } */
    
  //renderer.setRenderTarget(depthRenderTarget);

  solarSystem.OnAnimateLoop();
  renderer.render(scene, camera);
  composer.render();

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


