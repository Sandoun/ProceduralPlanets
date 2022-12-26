import { CelestialBody, BiomeData, GradientColorPoint, Orbit } from "./CelestialBody.js";
import { Prando } from '../Prando.js';
import greenlet from '../Greenlet.js';
import { WordGenerator } from '../WordGenerator.js';
import SolarSystemRenderer from "../SolarSystemRenderer.js";

export default class CelestialBodyFactory {

    //configuration
    maxMoonsPerPlanet = 1;
    minMoonSizeOfParent = .25;
    maxMoonSizeOfParent = .75;
    minDistanceMoons = 20;
    maxDistanceMoons = 100;
    moonOrbitPeriodSecondsMin = 10;
    moonOrbitPeriodSecondsMax = 60;
    maxAxisTilt = 15;

    /**
     * 
     * @param {SolarSystemRenderer} solSystem 
     */
    constructor (solSystem) {

        /** @type {SolarSystemRenderer} */
        this.solSystem = solSystem;

        /** @type {Prando} */
        this.rngGen = solSystem.rngGenerator;

        this.wordGenerator = new WordGenerator(solSystem.seed);

    }

    /**
     * 
     * @returns {CelestialBody[]}
     */
    async GenerateAsync () {

        const numOfPlanets = this.rngGen.nextInt(1, 1);

        let parallelMethods = [];
        let generatedBodies = [];

        for (let i = 0; i < numOfPlanets; i++) {

            //genrate N moons random
            const nMoons = 1;

            //generate planet random
            const planet = this.#PlanetRandom(nMoons);
            generatedBodies.push(planet);

            //gen planet geometry threaded
            parallelMethods.push((async () => {
                planet.Generate();
            })());

            //build moons
            let moonStartDist = 0;

            for (let i = 0; i < nMoons; i++) {

                //orbit offset from planet centre
                const moonOffset = planet.settings.size.minimalCentre + this.rngGen.next(this.minDistanceMoons, this.maxDistanceMoons);
                //orbital peroid in seconds
                const orbitPeroidS = this.rngGen.nextInt(this.moonOrbitPeriodSecondsMin, this.moonOrbitPeriodSecondsMax);
                //rand betweeen 0 and 360 deg
                const startAngleOffset = this.rngGen.next(0, 360);
                //probability of reverse orbit 20%
                const reversedOrbit = this.rngGen.nextInt(1, 10) <= 2;

                //generate moon random
                const moon = this.#MoonRandom(planet);
                generatedBodies.push(moon);

                moonStartDist += moonOffset + (moon.settings.size.minimalCentre * 2);

                //generate moon geometry threaded
                parallelMethods.push((async () => {
                    moon.Generate();
                    moon.Object.translateX(moonStartDist);
                })());  

                const orb = planet.AttachOrbitingBody(moon, planet, moonStartDist, startAngleOffset, orbitPeroidS, reversedOrbit);
                moon.ownOrbit = orb;
                moon.indexOrbitalPlane = i;
                moon.name = `${planet.name} ${this.#romanize(i + 1)}`;
                
            }

        }

        await Promise.all(parallelMethods);
        return generatedBodies;

    }

    #PlanetRandom () {

        const minCentre = this.rngGen.next(5,20);

        let body = new CelestialBody({
            seed : this.rngGen.nextInt(0, Number.MAX_SAFE_INTEGER),
            size : {
                resolution : Math.min(100, Math.floor(minCentre * 10)),
                minimalCentre : minCentre,
            },
            atmosphere : { 
                waveLengthRed : this.rngGen.next(0,1500),
                waveLengthGreen : this.rngGen.next(0,1000),
                waveLengthBlue : this.rngGen.next(0,1000),
                scatteringStrength : 2.0,
                scale : 1.0,
                fallOff : this.rngGen.next(10, 40),
                instensity : this.rngGen.next(1.0, 2.0),
            },
            water : {
                levelOffset : this.rngGen.next(.2, .5)
            },
            biomes : {
                noiseScale : .2,
                noiseFrequency : .2,
                blendingSize : 0.05,
                layers : [
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], 0),
                    new BiomeData([
                        new GradientColorPoint(218, 194, 124, 0),
                        new GradientColorPoint(215, 175, 114, .3),
                        new GradientColorPoint(168, 101, 30, 1.0),
                    ], .4),
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], .6),
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], .8),
                    new BiomeData([
                        new GradientColorPoint(255, 255, 255, 0),
                        new GradientColorPoint(230, 230, 230, .3),
                        new GradientColorPoint(255, 255, 255, 1.0),
                    ], .9),
                ]
            },
            rotation : {
                periodSeconds : this.rngGen.next(-this.moonOrbitPeriodSecondsMax, this.moonOrbitPeriodSecondsMax),
                axisTilt : this.rngGen.next(-this.maxAxisTilt, this.maxAxisTilt)
            }
        });

        body.type = "Planet";
        body.name = this.wordGenerator.GeneratePlanetNameNext();

        return body;

    }

    /**
     * 
     * @param {CelestialBody} parentPlanet 
     * @returns 
     */
    #MoonRandom (parentPlanet) {

        const minS = this.minMoonSizeOfParent;
        const maxS = parentPlanet.settings.size.minimalCentre * this.maxMoonSizeOfParent;

        const minCentre = this.rngGen.next(minS, maxS);

        let body = new CelestialBody({
            seed : this.rngGen.nextInt(0, Number.MAX_SAFE_INTEGER),
            size : {
                resolution : Math.min(100, Math.floor(minCentre * 10)),
                minimalCentre : minCentre,
            },
            atmosphere : { 
                waveLengthRed : this.rngGen.next(0,1500),
                waveLengthGreen : this.rngGen.next(0,1000),
                waveLengthBlue : this.rngGen.next(0,1000),
                scatteringStrength : 2.0,
                scale : 1.0,
                fallOff : this.rngGen.next(10, 40),
                instensity : this.rngGen.next(1.0, 2.0),
            },
            water : {
                levelOffset : this.rngGen.next(.2, .5)
            },
            biomes : {
                noiseScale : .2,
                noiseFrequency : .2,
                blendingSize : 0.05,
                layers : [
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], 0),
                    new BiomeData([
                        new GradientColorPoint(218, 194, 124, 0),
                        new GradientColorPoint(215, 175, 114, .3),
                        new GradientColorPoint(168, 101, 30, 1.0),
                    ], .4),
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], .6),
                    new BiomeData([
                        new GradientColorPoint(209,191,113,0),
                        new GradientColorPoint(0,50,0,.4),
                        new GradientColorPoint(15,112,0,.5),
                        new GradientColorPoint(100,100,100,.85),
                        new GradientColorPoint(255,255,255,.9),
                        new GradientColorPoint(255,255,255,1.0),
                    ], .8),
                    new BiomeData([
                        new GradientColorPoint(255, 255, 255, 0),
                        new GradientColorPoint(230, 230, 230, .3),
                        new GradientColorPoint(255, 255, 255, 1.0),
                    ], .9),
                ],
            },
            rotation : {
                periodSeconds : this.rngGen.next(-this.moonOrbitPeriodSecondsMax, this.moonOrbitPeriodSecondsMax),
                axisTilt : this.rngGen.next(-this.maxAxisTilt, this.maxAxisTilt)
            }
        });

        body.type = "Moon";
        return body;

    }

    #romanize (num) {

        const romanMatrix = [
            [1000, 'M'],[900, 'CM'],[500, 'D'],
            [400, 'CD'],[100, 'C'],[90, 'XC'],
            [50, 'L'],[40, 'XL'],[10, 'X'],
            [9, 'IX'],[5, 'V'],[4, 'IV'],[1, 'I']
        ];

        if (num === 0) return '';
        for (var i = 0; i < romanMatrix.length; i++) {
          if (num >= romanMatrix[i][0]) {
            return romanMatrix[i][1] + this.#romanize(num - romanMatrix[i][0]);
          }
        }

    }

}