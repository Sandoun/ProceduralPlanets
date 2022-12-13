import * as THREE from './three.module.js';
import { ShaderManager } from './ShaderLib/ShaderManager.js';
import { OrbitControls } from './OrbitControls.js';
import { Planet } from './PlanetGenerator.js';
import { EffectComposer } from './Postprocessing/EffectComposer.js';
import { RenderPass } from './Postprocessing/RenderPass.js';
import { ShaderPass } from './Postprocessing/ShaderPass.js';
import GUI from './lil-gui.esm.js';

window.addEventListener( 'resize', onWindowResize, false );

/** @type {THREE.Scene} */
let scene; 
/** @type {Planet} */
let planet; 
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.WebGLRenderTarget} */
let depthRenderTarget;
/** @type {THREE.Camera} */
let camera;
/** @type {EffectComposer} */
let composer;
/** @type {ShaderPass} */
let shaderPass;

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
  waterLevelOffset : .15,
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

  SetupDebugUI();

  SetupScene();

  SetupRenderer();

  //debug controls
  const controls = new OrbitControls( camera, renderer.domElement );

  BuildPlanet();

  SetupLighting();

  RenderDebug();

  animate();

  camera.position.x = planet.settings.minimalCentre + 5;
  camera.position.y = planet.settings.minimalCentre + 5;
  camera.position.z = -(planet.settings.minimalCentre + 5);
  camera.lookAt(0,0,0);

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
  scene.background = new THREE.Color("rgb(0, 0, 0)");

}


function SetupRenderer () {

  const defaultRendererW = window.innerWidth;
  const defaultRendererH = window.innerHeight;
  const aspect = defaultRendererW / defaultRendererH;

  renderer = new THREE.WebGLRenderer();

  camera = new THREE.PerspectiveCamera( 75, aspect, .1, 100 );

  renderer.shadowMap.enabled = true;
  renderer.setSize(defaultRendererW, defaultRendererH);

  //depth render target
  depthRenderTarget = new THREE.WebGLRenderTarget( defaultRendererW,  defaultRendererH );
  depthRenderTarget.texture.format = THREE.RGBFormat;
  depthRenderTarget.texture.minFilter = THREE.NearestFilter;
  depthRenderTarget.texture.magFilter = THREE.NearestFilter;
  depthRenderTarget.texture.generateMipmaps = false;
  depthRenderTarget.stencilBuffer = false;
  depthRenderTarget.depthBuffer = true;
  depthRenderTarget.depthTexture = new THREE.DepthTexture();
  depthRenderTarget.depthTexture.type = THREE.UnsignedShortType;

  //post processing
  composer = new EffectComposer(renderer);
  composer.setSize(defaultRendererW, defaultRendererH);

  const renderPass = new RenderPass( scene, camera );
  composer.addPass( renderPass );

  shaderPass = new ShaderPass(ShaderManager.PostProcessingShader());
  composer.addPass(shaderPass);

  document.body.appendChild( renderer.domElement );

}

function SetupLighting () {

  const centerObj = new THREE.Object3D();
  scene.add(centerObj);

  //light
  const light = new THREE.DirectionalLight( 'rgb(0,0,0)', .3);
  light.castShadow = true;
  light.position.set(planet.settings.minimalCentre * 2, planet.settings.minimalCentre * 2, planet.settings.minimalCentre * 2);
  light.target = centerObj;
  scene.add( light );

  const refCube = new THREE.BoxGeometry(1,1,1);
  const refMat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
  const cube = new THREE.Mesh( refCube, refMat );
  cube.position.set(planet.settings.minimalCentre * 2, planet.settings.minimalCentre * 2, planet.settings.minimalCentre * 2);
  scene.add( cube );

}

function BuildPlanet () {

  planet = new Planet(scene);

  RebuildPlanet();

}

function RebuildPlanet () {

  planet.settings.debug = planetOptions.debug;
  planet.settings.resolution = planetOptions.resolution;
  planet.settings.noiseLayers = planetOptions.noiseLayers;
  planet.settings.weightMultiplicator = planetOptions.weightMultiplicator;
  planet.settings.roughness = planetOptions.roughness;
  planet.settings.persistence = planetOptions.persistence;
  planet.settings.minimalCentre = planetOptions.minimalCentre;
  planet.settings.noiseStrength = planetOptions.noiseStrength;
  planet.settings.waterLevelOffset = planetOptions.waterLevelOffset;
  planet.settings.hasWater = planetOptions.hasWater;

  planet.Generate();

  scene.add(planet.Object);

}

function animate() {

    requestAnimationFrame( animate );

    var elapsedMilliseconds = Date.now() - startTime;
    var elapsedSeconds = elapsedMilliseconds / 1000.;
    planet.OnTimeUpdate(60 * elapsedSeconds);
    planet.Object.rotation.y += planetOptions.rotationSpeed / 2000;

    if(shaderPass != null && camera != null) {

      shaderPass.uniforms.worldSpaceCamPos.value = camera.getWorldPosition(new THREE.Vector3());
      shaderPass.uniforms.viewVector.value = camera.getWorldDirection(new THREE.Vector3());
      shaderPass.uniforms.cameraNear.value = camera.near * 5;
      shaderPass.uniforms.cameraFar.value = camera.far;
      shaderPass.uniforms.tDepth.value = depthRenderTarget.depthTexture;
      
    }
      
    //renderer.setRenderTarget( target );
    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, camera);
    composer.render();

    //renderer.render( scene, camera );

};

function RenderDebug () {

  //x is red
  //y is green
  // z is blue
  const axesHelper = new THREE.AxesHelper( 5 );
  axesHelper.translateZ(planet.settings.minimalCentre + 10);
  scene.add( axesHelper );

}

function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

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



