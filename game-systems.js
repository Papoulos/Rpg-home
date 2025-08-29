// IIFE to avoid polluting the global scope
(() => {
    const gameSystems = {
        cypher: {
            name: 'Cypher System',
            help: '/cypher <difficulty> [effort] [hindrance]',
            roll: (args) => {
                const difficulty = parseInt(args[0], 10);
                const effort = parseInt(args[1], 10) || 0;
                const hindrance = parseInt(args[2], 10) || 0;

                if (isNaN(difficulty)) {
                    return 'Erreur : La difficulté doit être un nombre.';
                }

                const target = difficulty * 3;
                const roll = Math.floor(Math.random() * 20) + 1;
                const modifiedRoll = roll + (effort * 3) - (hindrance * 3);

                let resultText = `Difficulté ${difficulty} (cible > ${target}).`;
                resultText += ` Jet : <strong>${roll}</strong>`;

                if (effort > 0) {
                    resultText += ` + ${effort * 3} (Effort)`;
                }
                if (hindrance > 0) {
                    resultText += ` - ${hindrance * 3} (Malus)`;
                }

                if (effort > 0 || hindrance > 0) {
                    resultText += `. Total modifié : <strong>${modifiedRoll}</strong>`;
                }


                if (roll === 1) {
                    resultText += '<br><strong>Échec critique !</strong> Le MJ peut introduire une intrusion.';
                } else if (roll === 20) {
                    resultText += '<br><strong>Réussite critique !</strong> Le joueur gagne un bénéfice majeur.';
                } else {
                    if (modifiedRoll > target) {
                        resultText += `<br><strong>Réussite !</strong> Le total de ${modifiedRoll} bat la cible de ${target}.`;
                    } else {
                        resultText += `<br><strong>Échec.</strong> Le total de ${modifiedRoll} n'atteint pas la cible de ${target}.`;
                    }
                }

                if (effort > 0) {
                    let cost = 0;
                    if (effort >= 1) {
                        cost += 3;
                    }
                    if (effort > 1) {
                        cost += (effort - 1) * 2;
                    }
                    resultText += `<br><em>Coût de l'effort : ${cost} points.</em>`;
                }

                return resultText;
            }
        }
    };

    // Expose the game systems to the global window object
    window.gameSystems = gameSystems;
})();
