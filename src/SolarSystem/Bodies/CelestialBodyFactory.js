import { CelestialBody, BiomeData, GradientColorPoint, Orbit } from "./CelestialBody.js";
import { Prando } from '../Prando.js';
import greenlet from '../Greenlet.js';
import { WordGenerator } from '../WordGenerator.js';
import SolarSystemRenderer from "../SolarSystemRenderer.js";

export default class CelestialBodyFactory {

    //configuration
    minSunSize = 30;
    maxSunSize = 150;
    maxMoonsPerPlanet = 1;
    minMoonSizeOfParent = .25;
    maxMoonSizeOfParent = .75;
    minDistanceMoons = 20;
    maxDistanceMoons = 100;
    minDistancePlanets = 70;
    maxDistancePlanets = 150;
    moonOrbitPeriodSecondsMin = 60;
    moonOrbitPeriodSecondsMax = 60 * 10;
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

        let parallelMethods = [];
        let generatedBodies = [];

        const numOfPlanets = this.rngGen.nextInt(1, 3);
        const numOfSuns = this.rngGen.nextInt(1, 1);
        const baseOrbitalPeriod = this.rngGen.nextInt(this.moonOrbitPeriodSecondsMin, this.moonOrbitPeriodSecondsMax);

        let planetStartDist = 0;

        //suns
        for (let i = 0; i < numOfSuns; i++) {
           
            const sun = this.#SunRandom();
            generatedBodies.push(sun);

            //gen planet geometry threaded
            parallelMethods.push((async () => {
                sun.Generate();
            })());

            planetStartDist += sun.settings.size.minimalCentre * 2;

        }

        //generate planets
        for (let i = 0; i < numOfPlanets; i++) {

            //genrate N moons random
            const nMoons = this.rngGen.nextInt(0, 2);

            //orbit offset from planet centre
            const plOffset = this.rngGen.next(this.minDistancePlanets, this.maxDistancePlanets);
            //orbital peroid in seconds
            const plOrbitPeroidS = baseOrbitalPeriod * (i + 1);
            //rand betweeen 0 and 360 deg
            const plStartAngleOffset = this.rngGen.next(0, 360);
            //probability of reverse orbit 20%
            const plReversedOrbit = this.rngGen.nextInt(1, 10) <= 2;

            //generate planet random
            const planet = this.#PlanetRandom(nMoons);
            generatedBodies.push(planet);

            planetStartDist += plOffset + (planet.settings.size.minimalCentre * 2);

            //gen planet geometry threaded
            parallelMethods.push((async () => {
                planet.Generate();
            })());

            //build moons
            let moonStartDist = 0;
            const moonBaseOrbitalPeriod = this.rngGen.nextInt(this.moonOrbitPeriodSecondsMin, this.moonOrbitPeriodSecondsMax);

            for (let j = 0; j < nMoons; j++) {

                //orbit offset from planet centre
                const moonOffset = planet.settings.size.minimalCentre + this.rngGen.next(this.minDistanceMoons, this.maxDistanceMoons);
                //orbital peroid in seconds
                const moonOrbitPeroidS = moonBaseOrbitalPeriod * (j + 1);
                //rand betweeen 0 and 360 deg
                const moonStartAngleOffset = this.rngGen.next(0, 360);
                //probability of reverse orbit 20%
                const moonReversedOrbit = this.rngGen.nextInt(1, 10) <= 2;

                //generate moon random
                const moon = this.#MoonRandom(planet);
                generatedBodies.push(moon);

                moonStartDist += moonOffset + (moon.settings.size.minimalCentre * 2);

                //generate moon geometry threaded
                parallelMethods.push((async () => {
                    moon.Generate();
                    moon.Object.translateX(moonStartDist);
                })());  

                const orb = planet.AttachOrbitingBody(moon, planet, moonStartDist, moonStartAngleOffset, moonOrbitPeroidS, moonReversedOrbit);
                moon.ownOrbit = orb;
                moon.indexOrbitalPlane = j;
                moon.name = `${planet.name} ${this.#romanize(j + 1)}`;

                //add last moon orbit to next planet starting dist
                if(j == nMoons - 1) {

                    planetStartDist += orb.distanceToCenter * 2;

                }

            }

            const orb = this.solSystem.AttachOrbitingBody(planet, planetStartDist, plStartAngleOffset, plOrbitPeroidS, plReversedOrbit);
            planet.ownOrbit = orb;
            planet.indexOrbitalPlane = i;

            planet.solSystem = this.solSystem;
            planet.GenerateOrbitRings();
            
        }

        this.solSystem.GenerateOrbitRings();

        await Promise.all(parallelMethods);
        return generatedBodies;

    }

    #SunRandom () {

        const minCentre = this.rngGen.next(this.minSunSize, this.maxSunSize);

        let body = new CelestialBody({
            seed : this.rngGen.nextInt(0, Number.MAX_SAFE_INTEGER),
            size : {
                resolution : Math.min(100, Math.floor(minCentre * 10)),
                minimalCentre : minCentre,
            },
            atmosphere : undefined,
            water : undefined,
            biomes : undefined,
            rotation : {
                periodSeconds : this.rngGen.next(60, 120) * (this.rngGen.nextBoolean() ? -1 : 1),
                axisTilt : 0
            }
        });

        body.type = "Sun";
        body.name = "Sun";//this.wordGenerator.GeneratePlanetNameNext();

        return body;

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
                scatteringStrength : 1.0,
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