import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { Planet } from './PlanetGenerator.js';

window.addEventListener( 'resize', onWindowResize, false );

let scene, planet, renderer, camera;

PreLoadFiles();

async function PreLoadFiles () {

  Planet.loadedFragmentShader = await readFile("../Shaders/PlanetGradient_fragment.glsl");
  Planet.loadedVertexShader = await readFile("../Shaders/PlanetGradient_vertex.glsl");

  SetupRendering();

}

//setup renderer

function SetupRendering () {

  scene = new THREE.Scene()
  scene.background = new THREE.Color("rgb(20, 20, 20)");

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;

  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  //debug controls
  const controls = new OrbitControls( camera, renderer.domElement );

  const centerObj = new THREE.Object3D();
  scene.add(centerObj);

  //light
  const light = new THREE.DirectionalLight( 0xfffffff, 1 );
  light.castShadow = true;
  light.position.set(5,5,5);
  light.target = centerObj;
  scene.add( light );

  planet = new Planet(scene, {
    debug : true,
    radius : 1,
    resolution : 100,
    noiseLayers : 30,
    weightMultiplicator : 3,
    roughness : 1.4,
    persistence : .5,
    minimalCentre : 1.5
  });

  scene.add(planet.Object);

  //planet.Render();

  //debug
  RenderDebug();

  camera.position.x = 5;
  camera.position.y = 2;
  camera.position.z = -5;
  camera.lookAt(0,0,0);

  animate();

}

function animate() {

    requestAnimationFrame( animate );
    //planet.Object.rotation.x += 0.01;
    planet.Object.rotation.y += 0.002;

    renderer.render( scene, camera );
};

function RenderDebug () {

  const materialSphereCenter = new THREE.MeshBasicMaterial( { color: 'yellow' } );
  const sphereCenterGeo = new THREE.SphereGeometry(.01, 0, 0);
  const sphereCenter = new THREE.Mesh( sphereCenterGeo, materialSphereCenter );
  scene.add( sphereCenter );

  //x is red
  //y is green
  // z is blue
  const axesHelper = new THREE.AxesHelper( 5 );
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



