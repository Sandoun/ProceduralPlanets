import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { Planet } from './PlanetGenerator.js';
import GUI from './lil-gui.esm.js';

window.addEventListener( 'resize', onWindowResize, false );

/** @type {THREE.Scene} */
let scene; 
/** @type {Planet} */
let planet; 
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Camera} */
let camera;

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
  waterLevelOffset : .1,
  hasWater : true,
  rotationSpeed : .5,

	Rebuild: () => { 

    RebuildPlanet();

  }

};

PreLoadFiles();

async function PreLoadFiles () {

  Planet.loadedFragmentShader = await readFile("../Shaders/PlanetGradient_fragment.glsl");
  Planet.loadedVertexShader = await readFile("../Shaders/PlanetGradient_vertex.glsl");

  Main();

}

function Main () {

  SetupDebugUI();

  scene = new THREE.Scene()
  scene.background = new THREE.Color("rgb(20, 20, 20)");

  SetupRenderer();

  SetupCamera();

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

function SetupCamera () {

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, .1, 100 );
  
  //debug controls
  const controls = new OrbitControls( camera, renderer.domElement );

}

function SetupRenderer () {

  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;

  renderer.setSize( window.innerWidth, window.innerHeight );
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

  const litCube = new THREE.BoxGeometry(3,3,3);
  const litMat = new THREE.MeshPhongMaterial( {color: 0x00ff00} );
  const litC = new THREE.Mesh( litCube, litMat );
  litC.position.set(20,20,20);
  scene.add( litC );

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

    var elapsedMilliseconds = Date.now() - startTime;
    var elapsedSeconds = elapsedMilliseconds / 1000.;
    planet.OnTimeUpdate(60 * elapsedSeconds);

    requestAnimationFrame( animate );

    planet.Object.rotation.y += planetOptions.rotationSpeed / 2000;

    renderer.render( scene, camera );

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



