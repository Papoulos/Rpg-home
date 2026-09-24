// IIFE to avoid polluting the global scope
(() => {
    const gameSystems = {
        cypher: {
            name: 'Cypher System',
            help: '<strong>/cypher</strong> ou <strong>/c</strong> [Nom du jet] [/D difficulté] [/E effort] [/M malus] [/S skillBonus] [/P statusPenalty] [/B flatBonus] [/C cost] [/I impaired] - Lance un dé pour le Cypher System.',
            roll: (args) => {
                // --- Argument Parsing ---
                const params = { D: 0, E: 0, M: 0, B: 0, C: -1, S: 0, P: 0, I: 0 };
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
                const { D: difficulty, E: effort, M: malus, B: bonus, C: costParam, S: skillBonus, P: statusPenalty, I: impaired } = params;

                const roll = Math.floor(Math.random() * 20) + 1;
                let resultText = "";

                if (actionName) {
                    resultText += `Action : <strong>${actionName}</strong><br>`;
                }

                // --- Common values ---
                const target = difficulty > 0 ? difficulty * 3 : 0;
                const totalBonus = bonus + skillBonus + statusPenalty;
                const modifiedRoll = roll + (effort * 3) - (malus * 3) + totalBonus;

                // --- Case 1: No parameters provided (and no bonus) ---
                if (difficulty === 0 && effort === 0 && malus === 0 && totalBonus === 0 && impaired === 0) {
                    resultText += `Jet : <strong>${roll}</strong><br>`;
                    const beatenDifficulty = Math.floor(roll / 3);
                    resultText += `<em>Bat une Diff de ${beatenDifficulty} (cible ${beatenDifficulty * 3})</em>`;
                     if (roll === 1) {
                        resultText += '<br><br><strong>Échec critique !</strong> (Intrusion du MJ)';
                    } else if (roll === 20) {
                        resultText += '<br><br><strong>Réussite critique !</strong> (Bénéfice majeur)';
                    }
                    return resultText;
                }

                // --- Case 2: Parameters are provided (or bonus exists) ---

                // Line 2: Params (Diff, Effort, Malus, Cost, Bonus)
                let paramsLine = [];
                if (difficulty > 0) paramsLine.push(`Diff : ${difficulty} (${target})`);

                if (effort > 0) {
                    paramsLine.push(`Effort : ${effort} (+${effort * 3})`);
                    let cost = 0;
                    if (costParam !== -1) {
                        cost = costParam;
                    } else {
                        if (effort >= 1) cost += 3;
                        if (effort > 1) cost += (effort - 1) * 2;
                        if (impaired > 0) cost += effort; // +1 cost per effort level if impaired
                    }
                    paramsLine.push(`Coût : ${cost} pts`);
                }

                if (malus > 0) paramsLine.push(`Malus : ${malus} (-${malus * 3})`);
                if (skillBonus !== 0) paramsLine.push(`Compétence : ${skillBonus > 0 ? '+' + skillBonus : skillBonus}`);
                if (statusPenalty !== 0) paramsLine.push(`État : ${statusPenalty}`);
                if (impaired > 0) paramsLine.push(`État : Diminué (Impaired)`);
                if (bonus !== 0) paramsLine.push(`Divers : ${bonus > 0 ? '+' + bonus : bonus}`);

                if (paramsLine.length > 0) {
                    resultText += paramsLine.join(' - ') + `<br>`;
                }

                // Line 3: Math equation
                let mathLine = `Jet : ${roll}`;
                if (effort > 0) mathLine += ` + ${effort * 3} (Effort)`;
                if (malus > 0) mathLine += ` - ${malus * 3} (Malus)`;
                if (skillBonus > 0) mathLine += ` + ${skillBonus} (Compétence)`;
                if (skillBonus < 0) mathLine += ` - ${Math.abs(skillBonus)} (Compétence)`;
                if (statusPenalty < 0) mathLine += ` - ${Math.abs(statusPenalty)} (État)`;
                if (bonus > 0) mathLine += ` + ${bonus} (Divers)`;
                if (bonus < 0) mathLine += ` - ${Math.abs(bonus)} (Divers)`;

                if (effort > 0 || malus > 0 || totalBonus !== 0) {
                     mathLine += ` = <strong>${modifiedRoll}</strong>`;
                } else {
                     mathLine = `Jet : <strong>${roll}</strong>`;
                }
                resultText += mathLine;


                if (roll === 1) {
                    resultText += '<br><br><strong>Échec critique !</strong> (Intrusion du MJ)';
                } else if (roll === 20) {
                    resultText += '<br><br><strong>Réussite critique !</strong> (Bénéfice majeur)';
                } else if (difficulty > 0) {
                    if (modifiedRoll >= target) {
                        resultText += `<br><br><strong>Réussite !</strong>`;
                    } else {
                        resultText += `<br><br><strong>Échec.</strong>`;
                    }
                } else {
                    // Difficulty is 0, just tell them what they beat
                    const beatenDifficulty = Math.floor(modifiedRoll / 3);
                    resultText += `<br><br><em>Bat une Diff de ${beatenDifficulty} (cible ${beatenDifficulty * 3})</em>`;
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
