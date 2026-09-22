// IIFE to avoid polluting the global scope
(() => {
    const gameSystems = {
        cypher: {
            name: 'Cypher System',
            help: '<strong>/cypher</strong> ou <strong>/c</strong> [Nom du jet] [/D difficulté] [/E effort] [/M malus] - Lance un dé pour le Cypher System.',
            roll: (args) => {
                // --- Argument Parsing ---
                const params = { D: 0, E: 0, M: 0 };
                let actionNameParts = [];

                for (let i = 0; i < args.length; i++) {
                    const param = args[i].toUpperCase();
                    if (param.startsWith('/') && params.hasOwnProperty(param.substring(1))) {
                        const value = parseInt(args[i + 1], 10);
                        if (!isNaN(value)) {
                            params[param.substring(1)] = value;
                            i++; // Skip the value in the next iteration
                        }
                    } else {
                        // Extract text before flags as action name
                        actionNameParts.push(args[i]);
                    }
                }

                const actionName = actionNameParts.join(' ').trim();
                const { D: difficulty, E: effort, M: malus } = params;

                const roll = Math.floor(Math.random() * 20) + 1;
                let resultText = "";

                if (actionName) {
                    resultText += `<strong>Action : ${actionName}</strong>`;
                    if (difficulty > 0 || effort > 0 || malus > 0) {
                         resultText += ` | `;
                    } else {
                         resultText += `<br>`;
                    }
                }

                // --- Case 1: No parameters provided ---
                if (difficulty === 0 && effort === 0 && malus === 0) {
                    resultText += `Jet : <strong>${roll}</strong>. `;
                    const beatenDifficulty = Math.floor(roll / 3);
                    resultText += `Le jet brut bat une difficulté de <strong>${beatenDifficulty}</strong> (cible ${beatenDifficulty * 3}).`;
                     if (roll === 1) {
                        resultText += '<br><strong>Échec critique !</strong> Le MJ peut introduire une intrusion.';
                    } else if (roll === 20) {
                        resultText += '<br><strong>Réussite critique !</strong> Le joueur gagne un bénéfice majeur.';
                    }
                    return resultText;
                }

                // --- Case 2: Parameters are provided ---
                const target = difficulty * 3;
                const modifiedRoll = roll + (effort * 3) - (malus * 3);

                if (difficulty > 0) resultText += `Diff. ${difficulty} (${target})`;
                if (effort > 0) resultText += ` | Effort ${effort}`;
                if (malus > 0) resultText += ` | Malus ${malus}`;

                resultText += `<br>Jet : <strong>${roll}</strong>`;

              
                if (effort > 0) resultText += ` + ${effort * 3} (Effort)`;
                if (malus > 0) resultText += ` - ${malus * 3} (Malus)`;
                if (effort > 0 || malus > 0) resultText += `<br>Total modifié : <strong>${modifiedRoll}</strong>`;

                if (effort > 0) {
                    let cost = 0;
                    if (effort >= 1) cost += 3;
                    if (effort > 1) cost += (effort - 1) * 2;
                    resultText += `<br><em>Coût de l'effort : ${cost} points.</em>`;
                }
                
                if (roll === 1) {
                    resultText += '<br><br><strong>Échec critique !</strong> Le MJ peut introduire une intrusion.';
                } else if (roll === 20) {
                    resultText += '<br><br><strong>Réussite critique !</strong> Le joueur gagne un bénéfice majeur.';
                } else {
                    if (modifiedRoll >= target) {
                        resultText += `<br><br><strong>Réussite !</strong>`;
                    } else {
                        resultText += `<br><br><strong>Échec.</strong>`;
                    }
                }

                return resultText;
            }
        }
    };

    // Alias /c to /cypher
    gameSystems.c = { ...gameSystems.cypher, help: '<strong>/c</strong> ou <strong>/cypher</strong> [/D difficulté] [/E effort] [/M malus] - Lance un dé pour le Cypher System.' };


    // Expose the game systems to the global window object
    window.gameSystems = gameSystems;
})();
