// public/character-sheet.js

let characterData = {
    "meta": { "schemaVersion": "1.1", "system": "Cypher System" },
    "identity": {
        "name": "Glaive", "playerName": "", "descriptor": "", "type": "", "focus": "",
        "tier": 1, "effort": 1, "xp": 0
    },
    "stats": {
        "might": { "pool": 10, "poolMax": 10, "edge": 1 },
        "speed": { "pool": 12, "poolMax": 12, "edge": 0 },
        "intel": { "pool": 8, "poolMax": 8, "edge": 0 }
    },
    "damageTrack": { "state": "hale" },
    "recoveryRolls": {
        "bonus": 0,
        "usedToday": { "action": false, "tenMinutes": false, "oneHour": false, "tenHours": false }
    },
    "skills": {
        "trained": [ { "name": "Escalade", "stat": "might" } ],
        "specialized": [],
        "inability": []
    },
    "abilities": [
        { "name": "Frappe en puissance", "type": "type", "cost": { "pool": "might", "amount": 2 }, "enabler": false }
    ],
    "equipment": {
        "weapons": [ { "name": "Épée longue", "type": "medium", "damage": 4 } ],
        "armor": { "value": 1, "speedEffortCost": 0 },
        "shins": 10
    },
    "cyphers": { "limit": 2, "carried": [] }
};

function renderCharacterSheet() {
    // Identity
    document.getElementById('cs-id-name').value = characterData.identity.name || '';
    document.getElementById('cs-id-descriptor').value = characterData.identity.descriptor || '';
    document.getElementById('cs-id-type').value = characterData.identity.type || '';
    document.getElementById('cs-id-focus').value = characterData.identity.focus || '';
    document.getElementById('cs-id-tier').value = characterData.identity.tier || 1;
    document.getElementById('cs-id-effort').value = characterData.identity.effort || 1;
    document.getElementById('cs-id-xp').value = characterData.identity.xp || 0;

    // Stats
    const statsList = ['might', 'speed', 'intel'];
    statsList.forEach(stat => {
        document.getElementById(`cs-stat-${stat}-pool`).value = characterData.stats[stat].pool;
        document.getElementById(`cs-stat-${stat}-max`).value = characterData.stats[stat].poolMax;
        document.getElementById(`cs-stat-${stat}-edge`).value = characterData.stats[stat].edge;
    });

    // Damage Track
    const dtRadios = document.getElementsByName('damageTrack');
    for (let radio of dtRadios) {
        radio.checked = (radio.value === characterData.damageTrack.state);
    }

    // Recovery
    document.getElementById('cs-recovery-bonus').value = characterData.recoveryRolls.bonus || 0;
    document.getElementById('cs-rec-action').checked = characterData.recoveryRolls.usedToday.action;
    document.getElementById('cs-rec-tenMinutes').checked = characterData.recoveryRolls.usedToday.tenMinutes;
    document.getElementById('cs-rec-oneHour').checked = characterData.recoveryRolls.usedToday.oneHour;
    document.getElementById('cs-rec-tenHours').checked = characterData.recoveryRolls.usedToday.tenHours;

    // Skills
    renderSkills();

    // Abilities
    renderAbilities();

    // Equipment
    renderWeapons();
    document.getElementById('cs-armor-value').value = characterData.equipment.armor.value || 0;
    document.getElementById('cs-armor-cost').value = characterData.equipment.armor.speedEffortCost || 0;
    document.getElementById('cs-shins').value = characterData.equipment.shins || 0;

    // Cyphers
    document.getElementById('cs-cyphers-limit').value = characterData.cyphers.limit || 2;
    renderCyphers();
}

function updateCharacterDataFromInputs() {
    // Identity
    characterData.identity.name = document.getElementById('cs-id-name').value;
    characterData.identity.descriptor = document.getElementById('cs-id-descriptor').value;
    characterData.identity.type = document.getElementById('cs-id-type').value;
    characterData.identity.focus = document.getElementById('cs-id-focus').value;
    characterData.identity.tier = parseInt(document.getElementById('cs-id-tier').value) || 1;
    characterData.identity.effort = parseInt(document.getElementById('cs-id-effort').value) || 1;
    characterData.identity.xp = parseInt(document.getElementById('cs-id-xp').value) || 0;

    // Stats
    const statsList = ['might', 'speed', 'intel'];
    statsList.forEach(stat => {
        characterData.stats[stat].poolMax = parseInt(document.getElementById(`cs-stat-${stat}-max`).value) || 0;
        characterData.stats[stat].edge = parseInt(document.getElementById(`cs-stat-${stat}-edge`).value) || 0;
        // pool is updated via + / - buttons, so we might just read it to be safe
        characterData.stats[stat].pool = parseInt(document.getElementById(`cs-stat-${stat}-pool`).value) || 0;
    });

    // Damage Track
    const dtRadios = document.getElementsByName('damageTrack');
    for (let radio of dtRadios) {
        if (radio.checked) {
            characterData.damageTrack.state = radio.value;
            break;
        }
    }

    // Recovery
    characterData.recoveryRolls.bonus = parseInt(document.getElementById('cs-recovery-bonus').value) || 0;
    characterData.recoveryRolls.usedToday.action = document.getElementById('cs-rec-action').checked;
    characterData.recoveryRolls.usedToday.tenMinutes = document.getElementById('cs-rec-tenMinutes').checked;
    characterData.recoveryRolls.usedToday.oneHour = document.getElementById('cs-rec-oneHour').checked;
    characterData.recoveryRolls.usedToday.tenHours = document.getElementById('cs-rec-tenHours').checked;

    // Equipment & Cyphers
    characterData.equipment.armor.value = parseInt(document.getElementById('cs-armor-value').value) || 0;
    characterData.equipment.armor.speedEffortCost = parseInt(document.getElementById('cs-armor-cost').value) || 0;
    characterData.equipment.shins = parseInt(document.getElementById('cs-shins').value) || 0;
    characterData.cyphers.limit = parseInt(document.getElementById('cs-cyphers-limit').value) || 2;

    // Skills, Abilities, Weapons, Cyphers are dynamically updated on interaction
    saveToLocalStorage();
}

function saveToLocalStorage() {
    localStorage.setItem('cypherCharacterData', JSON.stringify(characterData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('cypherCharacterData');
    if (saved) {
        try {
            characterData = JSON.parse(saved);
        } catch(e) {
            console.error("Erreur de parsing du localStorage", e);
        }
    }
}

// Helper to create list items
function createListItem(contentHTML) {
    const div = document.createElement('div');
    div.className = 'cs-list-item';
    div.innerHTML = contentHTML;
    return div;
}

// --- Renders for lists ---
function renderSkills() {
    const container = document.getElementById('cs-skills-list');
    container.innerHTML = '';
    // Pour simplifier l'affichage on regroupe tout dans une liste (trained, specialized, inability) avec un champ de sélection
    const allSkills = [
        ...characterData.skills.trained.map(s => ({...s, level: 'trained'})),
        ...characterData.skills.specialized.map(s => ({...s, level: 'specialized'})),
        ...characterData.skills.inability.map(s => ({...s, level: 'inability'}))
    ];

    allSkills.forEach((skill, index) => {
        const item = createListItem(`
            <span class="material-symbols-outlined cs-roll-icon" data-stat="${skill.stat}" data-skill="${skill.name}" title="Lancer pour ${skill.name}">casino</span>
            <input type="text" class="skill-name" value="${skill.name}" placeholder="Nom">
            <select class="skill-stat">
                <option value="might" ${skill.stat === 'might' ? 'selected' : ''}>Puissance</option>
                <option value="speed" ${skill.stat === 'speed' ? 'selected' : ''}>Vélocité</option>
                <option value="intel" ${skill.stat === 'intel' ? 'selected' : ''}>Intellect</option>
            </select>
            <select class="skill-level">
                <option value="trained" ${skill.level === 'trained' ? 'selected' : ''}>Entraîné (Trained)</option>
                <option value="specialized" ${skill.level === 'specialized' ? 'selected' : ''}>Spécialisé (Spec.)</option>
                <option value="inability" ${skill.level === 'inability' ? 'selected' : ''}>Incapacité (Inab.)</option>
            </select>
            <button class="cs-delete-btn" data-type="skill" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
        `);
        // Add listeners to update data
        item.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                const name = item.querySelector('.skill-name').value;
                const stat = item.querySelector('.skill-stat').value;
                const level = item.querySelector('.skill-level').value;

                // Remove from all arrays first
                characterData.skills.trained = characterData.skills.trained.filter(s => s.name !== skill.name);
                characterData.skills.specialized = characterData.skills.specialized.filter(s => s.name !== skill.name);
                characterData.skills.inability = characterData.skills.inability.filter(s => s.name !== skill.name);

                // Add to new array
                characterData.skills[level].push({ name, stat });
                skill.name = name; // update local ref
                updateCharacterDataFromInputs();
            });
        });

        container.appendChild(item);
    });
}

function renderAbilities() {
    const container = document.getElementById('cs-abilities-list');
    container.innerHTML = '';

    characterData.abilities.forEach((ability, index) => {
        const item = createListItem(`
            <input type="text" class="ab-name" value="${ability.name}" placeholder="Nom de capacité">
            <input type="number" class="ab-cost" value="${ability.cost ? ability.cost.amount : 0}" style="width: 50px;" title="Coût">
            <select class="ab-pool">
                <option value="might" ${ability.cost && ability.cost.pool === 'might' ? 'selected' : ''}>Pui.</option>
                <option value="speed" ${ability.cost && ability.cost.pool === 'speed' ? 'selected' : ''}>Vél.</option>
                <option value="intel" ${ability.cost && ability.cost.pool === 'intel' ? 'selected' : ''}>Int.</option>
            </select>
            <label style="display:flex; align-items:center; gap:5px; font-size:0.8rem; cursor:pointer;"><input type="checkbox" class="ab-enabler" ${ability.enabler ? 'checked' : ''}> Enabler</label>
            <button class="cs-delete-btn" data-type="ability" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
        `);

        item.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                ability.name = item.querySelector('.ab-name').value;
                if (!ability.cost) ability.cost = {};
                ability.cost.amount = parseInt(item.querySelector('.ab-cost').value) || 0;
                ability.cost.pool = item.querySelector('.ab-pool').value;
                ability.enabler = item.querySelector('.ab-enabler').checked;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}

function renderWeapons() {
    const container = document.getElementById('cs-weapons-list');
    container.innerHTML = '';

    characterData.equipment.weapons.forEach((wpn, index) => {
        const item = createListItem(`
            <input type="text" class="wpn-name" value="${wpn.name}" placeholder="Arme">
            <select class="wpn-type">
                <option value="light" ${wpn.type === 'light' ? 'selected' : ''}>Légère (Light)</option>
                <option value="medium" ${wpn.type === 'medium' ? 'selected' : ''}>Moyenne (Medium)</option>
                <option value="heavy" ${wpn.type === 'heavy' ? 'selected' : ''}>Lourde (Heavy)</option>
            </select>
            <input type="number" class="wpn-damage" value="${wpn.damage}" style="width:50px;" title="Dégâts">
            <button class="cs-delete-btn" data-type="weapon" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
        `);
        item.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                wpn.name = item.querySelector('.wpn-name').value;
                wpn.type = item.querySelector('.wpn-type').value;
                wpn.damage = parseInt(item.querySelector('.wpn-damage').value) || 0;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}

function renderCyphers() {
    const container = document.getElementById('cs-cyphers-list');
    container.innerHTML = '';

    characterData.cyphers.carried.forEach((cypher, index) => {
        const item = createListItem(`
            <input type="text" class="cy-name" value="${cypher.name || ''}" placeholder="Nom du cypher">
            <input type="number" class="cy-level" value="${cypher.level || 1}" style="width:50px;" title="Niveau">
            <button class="cs-delete-btn" data-type="cypher" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
        `);
        item.querySelectorAll('input').forEach(el => {
            el.addEventListener('change', () => {
                cypher.name = item.querySelector('.cy-name').value;
                cypher.level = parseInt(item.querySelector('.cy-level').value) || 1;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    loadFromLocalStorage();
    renderCharacterSheet();

    // Event Delegation for Delete Buttons
    document.querySelector('.cs-container').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.cs-delete-btn');
        if (deleteBtn) {
            const type = deleteBtn.getAttribute('data-type');
            const index = parseInt(deleteBtn.getAttribute('data-index'));

            if (type === 'skill') {
                // Determine which array it belongs to by recreating the flat array
                const allSkills = [
                    ...characterData.skills.trained.map(s => ({...s, level: 'trained'})),
                    ...characterData.skills.specialized.map(s => ({...s, level: 'specialized'})),
                    ...characterData.skills.inability.map(s => ({...s, level: 'inability'}))
                ];
                const skillToRemove = allSkills[index];
                if (skillToRemove) {
                    characterData.skills[skillToRemove.level] = characterData.skills[skillToRemove.level].filter(s => s.name !== skillToRemove.name);
                }
                renderSkills();
            } else if (type === 'ability') {
                characterData.abilities.splice(index, 1);
                renderAbilities();
            } else if (type === 'weapon') {
                characterData.equipment.weapons.splice(index, 1);
                renderWeapons();
            } else if (type === 'cypher') {
                characterData.cyphers.carried.splice(index, 1);
                renderCyphers();
            }
            updateCharacterDataFromInputs();
        }
    });

    // Add Buttons
    document.getElementById('cs-add-skill').addEventListener('click', () => {
        characterData.skills.trained.push({ name: "Nouvelle compétence", stat: "might" });
        renderSkills();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-ability').addEventListener('click', () => {
        characterData.abilities.push({ name: "Nouvelle capacité", type: "", cost: { pool: "might", amount: 1 }, enabler: false });
        renderAbilities();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-weapon').addEventListener('click', () => {
        characterData.equipment.weapons.push({ name: "Nouvelle arme", type: "medium", damage: 4 });
        renderWeapons();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-cypher').addEventListener('click', () => {
        characterData.cyphers.carried.push({ name: "Nouveau cypher", level: 1 });
        renderCyphers();
        updateCharacterDataFromInputs();
    });

    // Pool buttons (+ / -)
    document.querySelectorAll('.cs-pool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stat = e.target.getAttribute('data-stat');
            const action = e.target.getAttribute('data-action');
            const input = document.getElementById(`cs-stat-${stat}-pool`);
            let val = parseInt(input.value) || 0;
            if (action === 'plus') {
                val++;
            } else if (action === 'minus') {
                val--;
            }
            input.value = val;
            characterData.stats[stat].pool = val;
            updateCharacterDataFromInputs();
        });
    });

    // Auto-save on generic input change
    document.querySelector('.cs-container').addEventListener('change', (e) => {
        if (!e.target.closest('.cs-list-item')) { // Les éléments des listes s'occupent déjà de l'update
            updateCharacterDataFromInputs();
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Bouton de Sauvegarde manuel
    document.getElementById('cs-btn-save').addEventListener('click', () => {
        updateCharacterDataFromInputs();
        // Optionnel: feedback visuel
        const btn = document.getElementById('cs-btn-save');
        const oldColor = btn.style.color;
        btn.style.color = '#4caf50'; // Vert pour confirmer
        setTimeout(() => btn.style.color = oldColor, 1000);
    });

    // Exportation (Télécharger le JSON)
    document.getElementById('cs-btn-export').addEventListener('click', () => {
        updateCharacterDataFromInputs();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(characterData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        const fileName = (characterData.identity.name || "character") + ".json";
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Importation (Charger depuis un JSON)
    document.getElementById('cs-btn-import').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    // On pourrait vérifier le schéma, mais pour l'instant on fait confiance
                    characterData = importedData;
                    renderCharacterSheet();
                    saveToLocalStorage();

                    // Reset input for consecutive identical file uploads
                    event.target.value = '';
                } catch(err) {
                    console.error("Erreur lors de l'importation du fichier JSON :", err);
                    alert("Erreur: le fichier fourni n'est pas un JSON valide.");
                }
            };
            reader.readAsText(file);
        }
    });

    // Lancer de dé depuis la fiche
    document.querySelector('.cs-container').addEventListener('click', (e) => {
        // Clic sur l'icône de dé (stats & skills)
        if (e.target.classList.contains('cs-roll-icon')) {
            const stat = e.target.getAttribute('data-stat');
            const skill = e.target.getAttribute('data-skill'); // S'il y a une compétence liée

            let message = "Roll " + (stat.charAt(0).toUpperCase() + stat.slice(1));
            if (skill) {
                message += " pour " + skill;
            }
            console.log(message);
            // Plus tard, ce sera relié au système de chat, par exemple :
            // sendSystemMessage(message);
        }
    });
});
