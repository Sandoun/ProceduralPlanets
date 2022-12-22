import { Prando } from "./Prando.js";

class WordGenerator {

    static wordList = [];

    static prefixes = [
        "Alpha",
        "Beta",
        "Gamma",
        "Delta",
        "Epsilon",
        "Zeta",
        "Eta",
        "Theta",
        "Iota",
        "Kappa",
        "Lambda",
        "Mu",
        "Nu",
        "Xi",
        "Omikron",
        "Pi",
        "Rho",
        "Sigma",
        "Tau",
        "Upsilon",
        "Phi",
        "Chi",
        "Psi",
        "Omega",
    ];

    static async Preload () {

        this.wordList = await this.#ReadFile('../SolarSystem/Static/wordlist.json');

    }

    static #ReadFile (file) {

        return new Promise((resolve, reject) => {
            fetch(file)
            .then(response => response.json())
            .then(j => {
                resolve(j);
            })
        });
    }

    constructor(seed) {

        this.generator = new Prando(seed);

    }

    GeneratePlanetNameNext () {

        let final = "";

        if(this.generator.nextBoolean()) {

            final += `${this.generator.nextArrayItem(WordGenerator.prefixes)}-`;

        }

        final += this.#GenerateGibberishNext().firstUpper();

        if(this.generator.nextBoolean()) {

            final += `-${this.generator.nextInt(0, 999)}`;

        }

        return final;
    }


    #GenerateGibberishNext (minSyllables = 2, maxSyllables = 3) {

        const asciiLowercase = "abcdefghijklmnopqrstuvwxyz".split('');

        const vowels = ["a", "e", "i", "o", "u"]
        const trouble = ["q", "x", "y"]
        const consonants = asciiLowercase.filter(x => !vowels.includes(x)).filter(x => !trouble.includes(x));

        let word = "";

        while (true) {

            const vowel = () => vowels[this.generator.nextInt(0, vowels.length - 1)];
            const consonant = () => consonants[this.generator.nextInt(0, consonants.length - 1)];
            const cv = () => consonant() + vowel();
            const cvc = () => cv() + consonant();
            const syllable = () => [vowel(), cv(), cvc()][this.generator.nextInt(0, 2)];

            for (let i = 0; i < this.generator.nextInt(minSyllables, maxSyllables); i++) {
                word += syllable();
            }

            if(!WordGenerator.wordList.includes(word)) return word;

        }


    }

}

String.prototype.firstUpper = function () {

    return this[0].toUpperCase() + this.substring(1);

};

export { WordGenerator }