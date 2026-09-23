// public/character-sheet.js

const defaultCharacterData = {
  "meta": {
    "schemaVersion": "1.4",
    "system": "Cypher System"
  },
  "identity": {
    "name": "",
    "playerName": "",
    "descriptor": "",
    "type": "",
    "focus": "",
    "tier": 1,
    "effort": 1,
    "xp": 0,
    "portraitUrl": ""
  },
  "stats": {
    "might": { "pool": 10, "poolMax": 10, "edge": 0 },
    "speed": { "pool": 10, "poolMax": 10, "edge": 0 },
    "intel": { "pool": 10, "poolMax": 10, "edge": 0 }
  },
  "damageTrack": {
    "state": "hale"
  },
  "recoveryRolls": {
    "bonus": 0,
    "usedToday": {
      "action": false,
      "tenMinutes": false,
      "oneHour": false,
      "tenHours": false
    }
  },
  "skills": {
    "trained": [ { "name": "", "stat": "might" } ],
    "specialized": [],
    "inability": []
  },
  "abilities": [
    {
      "name": "",
      "type": "type",
      "cost": { "pool": "none", "amount": 0 },
      "enabler": false,
      "description": ""
    }
  ],
  "equipment": {
    "weapons": [
      { "name": "", "type": "light", "damage": 0, "notes": "" }
    ],
    "armor": { "value": 0, "speedEffortCost": 0, "description": "" },
    "implants": [
      { "name": "", "description": "" }
    ],
    "generalItems": [
      { "name": "", "level": 0, "description": "" }
    ],
    "shins": 0
  },
  "cyphers": {
    "limit": 3,
    "carried": [
      { "name": "", "level": 0, "effect": "", "identified": false }
    ]
  },
  "artifactsAndOddities": {
    "artifacts": [
      { "name": "", "level": 0, "effect": "", "identified": false }
    ],
    "oddities": [
      { "name": "", "description": "" }
    ]
  },
  "advancement": {
    "pointsAvailable": 0,
    "optionsUsed": {
      "increasePool": false,
      "trainSkill": false,
      "gainEffort": false,
      "advancedAbility": false,
      "moveTowardPerfection": false,
      "extraSpecialAbility": false
    }
  }
};

// Deep copy for initial state
let characterData = JSON.parse(JSON.stringify(defaultCharacterData));

// Helper for object deep merge to handle missing fields in old JSONs
function deepMerge(target, source) {
    if (typeof target !== 'object' || target === null) {
        return source;
    }
    for (const key in source) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue; // Prevent prototype pollution
        if (source[key] instanceof Array) {
            target[key] = source[key].slice(); // arrays are replaced/shallow copied
        } else if (source[key] instanceof Object && key in target) {
            target[key] = deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

window.renderCharacterTabs = function() {
    const tabsContainer = document.getElementById('cs-tabs-container');
    if (!tabsContainer) return;

    // We get the character list from the global context, which should be updated by socket messages
    const characters = window.availableCharacters || [];

    tabsContainer.innerHTML = '';
    characters.forEach(char => {
        const tab = document.createElement('div');
        tab.className = 'cs-tab';

        // Mark active if this is the currently loaded character
        if (characterData && characterData.identity && characterData.identity.name === char.name) {
            tab.classList.add('active');
        }

        tab.innerHTML = `
            <img src="${char.portraitUrl || 'https://via.placeholder.com/24?text=?'}" alt="${char.name}">
            <span>${char.name}</span>
        `;

        tab.addEventListener('click', () => {
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({ type: 'load-character', id: char.id }));
            }
        });

        tabsContainer.appendChild(tab);
    });

    if (window.isMJ) {
        const newTab = document.createElement('div');
        newTab.className = 'cs-tab';
        newTab.style.backgroundColor = '#1a3a1a';
        newTab.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
            <span>Nouveau</span>
        `;
        newTab.addEventListener('click', () => {
            const name = prompt("Entrez le nom du nouveau personnage :");
            if (name && name.trim() !== '') {
                const newCharData = JSON.parse(JSON.stringify(window.defaultCharacterData || defaultCharacterData));
                if (newCharData.identity) {
                    newCharData.identity.name = name.trim();
                }

                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                   window.socket.send(JSON.stringify({
                       type: 'update-character',
                       id: name.trim(),
                       data: newCharData
                   }));
                   // Also request to load it immediately
                   window.socket.send(JSON.stringify({ type: 'load-character', id: name.trim() }));
                }
            }
        });
        tabsContainer.appendChild(newTab);
    }
};

function renderCharacterSheet() {
    // Determine read-only mode based on ownership/MJ status
    const isOwner = (window.getUsername && window.getUsername() === characterData.identity.name);
    const isMJ = window.isMJ;
    const container = document.querySelector('.cs-container');
    if (container) {
        if (!isOwner && !isMJ) {
            container.classList.add('cs-readonly');
        } else {
            container.classList.remove('cs-readonly');
        }
    }

    // Toggle MJ-only import/delete button visibility
    const importLabel = document.querySelector('label[for="cs-btn-import"]');
    if (importLabel) {
        importLabel.style.display = isMJ ? 'flex' : 'none';
    }
    const deleteBtn = document.getElementById('cs-btn-delete');
    if (deleteBtn) {
        deleteBtn.style.display = isMJ ? 'flex' : 'none';
    }

    // Re-render tabs
    window.renderCharacterTabs();

    // Identity - Header Display
    document.getElementById('cs-display-name').textContent = characterData.identity.name || 'Nom Inconnu';
    const descriptor = characterData.identity.descriptor || 'Descripteur';
    const type = characterData.identity.type || 'Type';
    const focus = characterData.identity.focus || 'Focus';
    document.getElementById('cs-display-keywords').textContent = `${descriptor} ${type} qui ${focus}`;

    const portraitContainer = document.getElementById('cs-display-portrait-container');
    if (characterData.identity.portraitUrl) {
        portraitContainer.innerHTML = `<img src="${escapeHtml(characterData.identity.portraitUrl)}" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        portraitContainer.innerHTML = '?';
    }

    // Identity - Inputs
    document.getElementById('cs-id-name').value = characterData.identity.name || '';
    document.getElementById('cs-id-playerName').value = characterData.identity.playerName || '';
    document.getElementById('cs-id-descriptor').value = characterData.identity.descriptor || '';
    document.getElementById('cs-id-type').value = characterData.identity.type || '';
    document.getElementById('cs-id-focus').value = characterData.identity.focus || '';
    document.getElementById('cs-id-portraitUrl').value = characterData.identity.portraitUrl || '';
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
    renderImplants();
    renderGeneralItems();
    document.getElementById('cs-armor-value').value = characterData.equipment.armor.value || 0;
    document.getElementById('cs-armor-cost').value = characterData.equipment.armor.speedEffortCost || 0;
    document.getElementById('cs-armor-desc').value = characterData.equipment.armor.description || '';
    document.getElementById('cs-shins').value = characterData.equipment.shins || 0;

    // Cyphers
    if (!characterData.cyphers) {
        characterData.cyphers = { limit: 3, carried: [] };
    }
    document.getElementById('cs-cyphers-limit').value = characterData.cyphers.limit || 3;
    renderCyphers();

    // Artifacts & Oddities
    renderArtifacts();
    renderOddities();

    // Advancement
    document.getElementById('cs-adv-xp-available').value = characterData.advancement.pointsAvailable || 0;
    document.getElementById('cs-adv-increasePool').checked = characterData.advancement.optionsUsed.increasePool;
    document.getElementById('cs-adv-trainSkill').checked = characterData.advancement.optionsUsed.trainSkill;
    document.getElementById('cs-adv-gainEffort').checked = characterData.advancement.optionsUsed.gainEffort;
    document.getElementById('cs-adv-advancedAbility').checked = characterData.advancement.optionsUsed.advancedAbility;
    document.getElementById('cs-adv-moveTowardPerfection').checked = characterData.advancement.optionsUsed.moveTowardPerfection;
}

function updateCharacterDataFromInputs() {
    // Identity
    characterData.identity.name = document.getElementById('cs-id-name').value;
    characterData.identity.playerName = document.getElementById('cs-id-playerName').value;
    characterData.identity.descriptor = document.getElementById('cs-id-descriptor').value;
    characterData.identity.type = document.getElementById('cs-id-type').value;
    characterData.identity.focus = document.getElementById('cs-id-focus').value;
    characterData.identity.portraitUrl = document.getElementById('cs-id-portraitUrl').value;
    characterData.identity.tier = parseInt(document.getElementById('cs-id-tier').value) || 1;
    characterData.identity.effort = parseInt(document.getElementById('cs-id-effort').value) || 1;
    characterData.identity.xp = parseInt(document.getElementById('cs-id-xp').value) || 0;

    // Update display instantly
    document.getElementById('cs-display-name').textContent = characterData.identity.name || 'Nom Inconnu';
    const descriptor = characterData.identity.descriptor || 'Descripteur';
    const type = characterData.identity.type || 'Type';
    const focus = characterData.identity.focus || 'Focus';
    document.getElementById('cs-display-keywords').textContent = `${descriptor} ${type} qui ${focus}`;
    const portraitContainer = document.getElementById('cs-display-portrait-container');
    if (characterData.identity.portraitUrl) {
        portraitContainer.innerHTML = `<img src="${escapeHtml(characterData.identity.portraitUrl)}" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        portraitContainer.innerHTML = '?';
    }

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

    // Equipment
    characterData.equipment.armor.value = parseInt(document.getElementById('cs-armor-value').value) || 0;
    characterData.equipment.armor.speedEffortCost = parseInt(document.getElementById('cs-armor-cost').value) || 0;
    characterData.equipment.armor.description = document.getElementById('cs-armor-desc').value;
    characterData.equipment.shins = parseInt(document.getElementById('cs-shins').value) || 0;

    if (!characterData.cyphers) characterData.cyphers = { limit: 3, carried: [] };
    characterData.cyphers.limit = parseInt(document.getElementById('cs-cyphers-limit').value) || 3;

    // Advancement
    characterData.advancement.pointsAvailable = parseInt(document.getElementById('cs-adv-xp-available').value) || 0;
    characterData.advancement.optionsUsed.increasePool = document.getElementById('cs-adv-increasePool').checked;
    characterData.advancement.optionsUsed.trainSkill = document.getElementById('cs-adv-trainSkill').checked;
    characterData.advancement.optionsUsed.gainEffort = document.getElementById('cs-adv-gainEffort').checked;
    characterData.advancement.optionsUsed.advancedAbility = document.getElementById('cs-adv-advancedAbility').checked;
    characterData.advancement.optionsUsed.moveTowardPerfection = document.getElementById('cs-adv-moveTowardPerfection').checked;

    // Skills, Abilities, Weapons, Cyphers are dynamically updated on interaction
    saveToLocalStorage();
}

function saveToLocalStorage() {
    localStorage.setItem('cypherCharacterData', JSON.stringify(characterData));

    // Also save to server if socket is open
    if (window.socket && window.socket.readyState === WebSocket.OPEN && characterData.identity && characterData.identity.name) {
        window.socket.send(JSON.stringify({
            type: 'update-character',
            id: characterData.identity.name,
            data: characterData
        }));
    }
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('cypherCharacterData');
    if (saved) {
        try {
            const parsedData = JSON.parse(saved);
            let freshData = JSON.parse(JSON.stringify(defaultCharacterData));
            characterData = deepMerge(freshData, parsedData);
        } catch(e) {
            console.error("Erreur de parsing du localStorage", e);
        }
    }
}

// Helper to create list items, preventing self-XSS through innerHTML with user input
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

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

    // Add unique IDs internally to help tracking without relying on name filtering
    const allSkills = [
        ...characterData.skills.specialized.map(s => ({...s, level: 'specialized'})),
        ...characterData.skills.trained.map(s => ({...s, level: 'trained'})),
        ...characterData.skills.inability.map(s => ({...s, level: 'inability'}))
    ];

    allSkills.forEach((skill, index) => {
        const item = createListItem(`
            <span class="material-symbols-outlined cs-roll-icon" data-stat="${escapeHtml(skill.stat)}" data-skill="${escapeHtml(skill.name)}" data-skill-level="${escapeHtml(skill.level)}" title="Lancer pour ${escapeHtml(skill.name)}">casino</span>
            <input type="text" class="skill-name" value="${escapeHtml(skill.name)}" placeholder="Nom">
            <select class="skill-stat">
                <option value="might" ${skill.stat === 'might' ? 'selected' : ''}>Might</option>
                <option value="speed" ${skill.stat === 'speed' ? 'selected' : ''}>Speed</option>
                <option value="intel" ${skill.stat === 'intel' ? 'selected' : ''}>Intel</option>
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

                // Track if level changed to trigger full re-render
                const originalLevel = allSkills[index].level;

                // Using index in the flattened array to rebuild the arrays accurately
                allSkills[index] = { name, stat, level };

                // Rebuild the grouped arrays from the modified flat array
                characterData.skills.trained = [];
                characterData.skills.specialized = [];
                characterData.skills.inability = [];

                allSkills.forEach(s => {
                    characterData.skills[s.level].push({ name: s.name, stat: s.stat });
                });

                updateCharacterDataFromInputs();

                // Re-render immediately if level changed to keep DOM sync with logical structure
                if (originalLevel !== level) {
                    renderSkills();
                }
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
            <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                <div style="display:flex; gap:10px; width:100%; align-items:center;">
                    <input type="text" class="ab-name" value="${escapeHtml(ability.name)}" placeholder="Nom de capacité" style="flex-grow:1;">
                    <select class="ab-type" style="width: 80px;" title="Type/Source">
                        <option value="type" ${ability.type === 'type' ? 'selected' : ''}>Type</option>
                        <option value="focus" ${ability.type === 'focus' ? 'selected' : ''}>Focus</option>
                        <option value="descriptor" ${ability.type === 'descriptor' ? 'selected' : ''}>Desc.</option>
                    </select>
                    <input type="number" class="ab-cost" value="${ability.cost ? ability.cost.amount : 0}" style="width: 50px;" title="Coût">
                    <select class="ab-pool">
                        <option value="none" ${ability.cost && ability.cost.pool === 'none' ? 'selected' : ''}>-</option>
                        <option value="might" ${ability.cost && ability.cost.pool === 'might' ? 'selected' : ''}>Might</option>
                        <option value="speed" ${ability.cost && ability.cost.pool === 'speed' ? 'selected' : ''}>Speed</option>
                        <option value="intel" ${ability.cost && ability.cost.pool === 'intel' ? 'selected' : ''}>Intel</option>
                    </select>
                    <label style="display:flex; align-items:center; gap:5px; font-size:0.8rem; cursor:pointer;"><input type="checkbox" class="ab-enabler" ${ability.enabler ? 'checked' : ''}> Enabler</label>
                    <span class="material-symbols-outlined cs-desc-icon" data-index="${index}" title="${escapeHtml(ability.description || 'Description')}" style="cursor:pointer; color:#aaa; font-size: 1.2rem;">help</span>
                    <button class="cs-delete-btn" data-type="ability" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                </div>
            </div>
        `);

        item.querySelectorAll('input:not(.ab-desc), select').forEach(el => {
            el.addEventListener('change', () => {
                ability.name = item.querySelector('.ab-name').value;
                ability.type = item.querySelector('.ab-type').value;
                if (!ability.cost) ability.cost = {};
                ability.cost.amount = parseInt(item.querySelector('.ab-cost').value) || 0;
                ability.cost.pool = item.querySelector('.ab-pool').value;
                ability.enabler = item.querySelector('.ab-enabler').checked;
                ability.description = item.querySelector('.ab-desc').value;
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
            <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                <div style="display:flex; gap:10px; width:100%;">
                    <input type="text" class="wpn-name" value="${escapeHtml(wpn.name)}" placeholder="Arme">
                    <select class="wpn-type">
                        <option value="light" ${wpn.type === 'light' ? 'selected' : ''}>Légère (Light)</option>
                        <option value="medium" ${wpn.type === 'medium' ? 'selected' : ''}>Moyenne (Medium)</option>
                        <option value="heavy" ${wpn.type === 'heavy' ? 'selected' : ''}>Lourde (Heavy)</option>
                    </select>
                    <input type="number" class="wpn-damage" value="${wpn.damage || 0}" style="width:50px;" title="Dégâts">
                    <button class="cs-delete-btn" data-type="weapon" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                </div>
                <input type="text" class="wpn-notes" value="${escapeHtml(wpn.notes || '')}" placeholder="Notes..." style="width:100%; font-size:0.8rem; background:#111;">
            </div>
        `);
        item.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                wpn.name = item.querySelector('.wpn-name').value;
                wpn.type = item.querySelector('.wpn-type').value;
                wpn.damage = parseInt(item.querySelector('.wpn-damage').value) || 0;
                wpn.notes = item.querySelector('.wpn-notes').value;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}

function renderImplants() {
    const container = document.getElementById('cs-implants-list');
    container.innerHTML = '';

    if (characterData.equipment.implants) {
        characterData.equipment.implants.forEach((implant, index) => {
            const item = createListItem(`
                <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                    <div style="display:flex; gap:10px; width:100%; align-items:center;">
                        <input type="text" class="imp-name" value="${escapeHtml(implant.name || '')}" placeholder="Nom de l'implant" style="flex-grow:1;">
                        <button class="cs-delete-btn" data-type="implant" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <input type="text" class="imp-desc" value="${escapeHtml(implant.description || '')}" placeholder="Description..." style="width:100%; font-size:0.8rem; background:#111;">
                </div>
            `);
            item.querySelectorAll('input').forEach(el => {
                el.addEventListener('change', () => {
                    implant.name = item.querySelector('.imp-name').value;
                    implant.description = item.querySelector('.imp-desc').value;
                    updateCharacterDataFromInputs();
                });
            });
            container.appendChild(item);
        });
    }
}

function renderGeneralItems() {
    const container = document.getElementById('cs-general-items-list');
    container.innerHTML = '';

    if (characterData.equipment.generalItems) {
        characterData.equipment.generalItems.forEach((itemObj, index) => {
            const item = createListItem(`
                <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                    <div style="display:flex; gap:10px; width:100%; align-items:center;">
                        <input type="text" class="gi-name" value="${escapeHtml(itemObj.name || '')}" placeholder="Nom de l'objet" style="flex-grow:1;">
                        <input type="text" class="gi-level" value="${escapeHtml(itemObj.level || '1')}" style="width:50px;" title="Niveau">
                        <button class="cs-delete-btn" data-type="generalItem" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <input type="text" class="gi-desc" value="${escapeHtml(itemObj.description || '')}" placeholder="Description..." style="width:100%; font-size:0.8rem; background:#111;">
                </div>
            `);
            item.querySelectorAll('input').forEach(el => {
                el.addEventListener('change', () => {
                    itemObj.name = item.querySelector('.gi-name').value;
                    itemObj.level = item.querySelector('.gi-level').value;
                    itemObj.description = item.querySelector('.gi-desc').value;
                    updateCharacterDataFromInputs();
                });
            });
            container.appendChild(item);
        });
    }
}


function renderCyphers() {
    const container = document.getElementById('cs-cyphers-list');
    if(!container) return;
    container.innerHTML = '';

    if (characterData.cyphers && characterData.cyphers.carried) {
        characterData.cyphers.carried.forEach((cypher, index) => {
            const item = createListItem(`
                <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                    <div style="display:flex; gap:10px; width:100%; align-items:center;">
                        <input type="text" class="cy-name" value="${escapeHtml(cypher.name || '')}" placeholder="Nom du cypher" style="flex-grow:1;">
                        <input type="text" class="cy-level" value="${escapeHtml(cypher.level || '1')}" style="width:50px;" title="Niveau">
                        <label style="display:flex; align-items:center; gap:5px; font-size:0.8rem; cursor:pointer;"><input type="checkbox" class="cy-identified" ${cypher.identified ? 'checked' : ''}> Id.</label>
                        <button class="cs-delete-btn" data-type="cypher" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <input type="text" class="cy-effect" value="${escapeHtml(cypher.effect || '')}" placeholder="Effet..." style="width:100%; font-size:0.8rem; background:#111;">
                </div>
            `);
            item.querySelectorAll('input').forEach(el => {
                el.addEventListener('change', () => {
                    cypher.name = item.querySelector('.cy-name').value;
                    cypher.level = item.querySelector('.cy-level').value; // Keep as string for ? or ranges
                    cypher.effect = item.querySelector('.cy-effect').value;
                    cypher.identified = item.querySelector('.cy-identified').checked;
                    updateCharacterDataFromInputs();
                });
            });
            container.appendChild(item);
        });
    }
}

function renderArtifacts() {
    const container = document.getElementById('cs-artifacts-list');
    container.innerHTML = '';

    characterData.artifactsAndOddities.artifacts.forEach((artifact, index) => {
        const item = createListItem(`
            <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                <div style="display:flex; gap:10px; width:100%;">
                    <input type="text" class="art-name" value="${escapeHtml(artifact.name || '')}" placeholder="Nom de l'artéfact" style="flex-grow:1;">
                    <input type="text" class="art-level" value="${escapeHtml(artifact.level || '1')}" style="width:50px;" title="Niveau">
                    <input type="text" class="art-depletion" value="${escapeHtml(artifact.depletion || '1 in 1d6')}" style="width:70px;" title="Depletion">
                    <button class="cs-delete-btn" data-type="artifact" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
                </div>
                <input type="text" class="art-effect" value="${escapeHtml(artifact.effect || '')}" placeholder="Effet..." style="width:100%; font-size:0.8rem; background:#111;">
            </div>
        `);
        item.querySelectorAll('input').forEach(el => {
            el.addEventListener('change', () => {
                artifact.name = item.querySelector('.art-name').value;
                artifact.level = item.querySelector('.art-level').value;
                artifact.depletion = item.querySelector('.art-depletion').value;
                artifact.effect = item.querySelector('.art-effect').value;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}

function renderOddities() {
    const container = document.getElementById('cs-oddities-list');
    container.innerHTML = '';

    characterData.artifactsAndOddities.oddities.forEach((oddity, index) => {
        const item = createListItem(`
            <input type="text" class="odd-name" value="${escapeHtml(oddity.name || '')}" placeholder="Description de l'oddity" style="flex-grow:1;">
            <button class="cs-delete-btn" data-type="oddity" data-index="${index}"><span class="material-symbols-outlined">close</span></button>
        `);
        item.querySelectorAll('input').forEach(el => {
            el.addEventListener('change', () => {
                oddity.name = item.querySelector('.odd-name').value;
                updateCharacterDataFromInputs();
            });
        });
        container.appendChild(item);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Re-render character sheet when MJ status changes to show/hide import button
    window.addEventListener('mj-status', () => {
        renderCharacterSheet();
    });

    // Listen for socket events related to characters
    window.addEventListener('character-loaded', (e) => {
        characterData = deepMerge(JSON.parse(JSON.stringify(defaultCharacterData)), e.detail.data);
        renderCharacterSheet();
    });

    window.addEventListener('character-updated', (e) => {
        // If the updated character is the one we are currently viewing, re-render it
        if (characterData && characterData.identity && characterData.identity.name === e.detail.id) {
            // But don't overwrite if we are the one making the change (basic check, could be improved)
            // Actually, for a single source of truth, if we are viewing it, we update it.
            // If it's our character and we are making rapid changes, there could be slight cursor jumps,
            // but for simple inputs handled by 'change' event, it should be fine.
            characterData = deepMerge(JSON.parse(JSON.stringify(defaultCharacterData)), e.detail.data);
            renderCharacterSheet();
        }
    });

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
                    ...characterData.skills.specialized.map(s => ({...s, level: 'specialized'})),
                    ...characterData.skills.trained.map(s => ({...s, level: 'trained'})),
                    ...characterData.skills.inability.map(s => ({...s, level: 'inability'}))
                ];

                // Remove the element from the flat array by index
                allSkills.splice(index, 1);

                // Rebuild the object structure
                characterData.skills.trained = [];
                characterData.skills.specialized = [];
                characterData.skills.inability = [];

                allSkills.forEach(s => {
                    characterData.skills[s.level].push({ name: s.name, stat: s.stat });
                });

                renderSkills();
            } else if (type === 'ability') {
                characterData.abilities.splice(index, 1);
                renderAbilities();
            } else if (type === 'weapon') {
                characterData.equipment.weapons.splice(index, 1);
                renderWeapons();
            } else if (type === 'implant') {
                characterData.equipment.implants.splice(index, 1);
                renderImplants();
            } else if (type === 'generalItem') {
                characterData.equipment.generalItems.splice(index, 1);
                renderGeneralItems();
            } else if (type === 'cypher') {
                if (characterData.cyphers && characterData.cyphers.carried) {
                    characterData.cyphers.carried.splice(index, 1);
                    renderCyphers();
                }
            } else if (type === 'artifact') {
                characterData.artifactsAndOddities.artifacts.splice(index, 1);
                renderArtifacts();
            } else if (type === 'oddity') {
                characterData.artifactsAndOddities.oddities.splice(index, 1);
                renderOddities();
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
        characterData.abilities.push({ name: "Nouvelle capacité", type: "type", cost: { pool: "none", amount: 0 }, enabler: false, description: "" });
        renderAbilities();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-weapon').addEventListener('click', () => {
        characterData.equipment.weapons.push({ name: "Nouvelle arme", type: "medium", damage: 4 });
        renderWeapons();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-implant').addEventListener('click', () => {
        if (!characterData.equipment.implants) characterData.equipment.implants = [];
        characterData.equipment.implants.push({ name: "Nouvel implant", description: "" });
        renderImplants();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-general-item').addEventListener('click', () => {
        if (!characterData.equipment.generalItems) characterData.equipment.generalItems = [];
        characterData.equipment.generalItems.push({ name: "Nouvel objet", level: "1", description: "" });
        renderGeneralItems();
        updateCharacterDataFromInputs();
    });

    const addCypherBtn = document.getElementById('cs-add-cypher');
    if(addCypherBtn) {
        addCypherBtn.addEventListener('click', () => {
            if (!characterData.cyphers) characterData.cyphers = { limit: 3, carried: [] };
            if (!characterData.cyphers.carried) characterData.cyphers.carried = [];
            characterData.cyphers.carried.push({ name: "Nouveau cypher", level: "1", effect: "", identified: false });
            renderCyphers();
            updateCharacterDataFromInputs();
        });
    }

    document.getElementById('cs-add-artifact').addEventListener('click', () => {
        characterData.artifactsAndOddities.artifacts.push({ name: "Nouvel artéfact", level: "1", depletion: "1 in 1d6", effect: "" });
        renderArtifacts();
        updateCharacterDataFromInputs();
    });

    document.getElementById('cs-add-oddity').addEventListener('click', () => {
        characterData.artifactsAndOddities.oddities.push({ name: "Nouvelle oddity" });
        renderOddities();
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

    // Suppression du personnage - Réservé au MJ
    const deleteConfirmModal = document.getElementById('cs-delete-confirm-modal');

    document.getElementById('cs-btn-delete').addEventListener('click', () => {
        if (window.isMJ && characterData && characterData.identity && characterData.identity.name) {
            deleteConfirmModal.style.display = 'flex';
        }
    });

    document.getElementById('cs-delete-confirm-cancel').addEventListener('click', () => {
        deleteConfirmModal.style.display = 'none';
    });

    deleteConfirmModal.addEventListener('click', (e) => {
        if (e.target === deleteConfirmModal) {
            deleteConfirmModal.style.display = 'none';
        }
    });

    document.getElementById('cs-delete-confirm-accept').addEventListener('click', () => {
        deleteConfirmModal.style.display = 'none';
        if (window.socket && window.socket.readyState === WebSocket.OPEN && characterData.identity.name) {
            window.socket.send(JSON.stringify({
                type: 'delete-character',
                id: characterData.identity.name
            }));

            // Revenir au premier personnage de la liste, ou charger une fiche vide
            const remainingCharacters = window.availableCharacters ? window.availableCharacters.filter(c => c.id !== characterData.identity.name) : [];
            if (remainingCharacters.length > 0) {
                window.socket.send(JSON.stringify({ type: 'load-character', id: remainingCharacters[0].id }));
            } else {
                // S'il n'y a plus de personnages, on affiche une fiche vide
                characterData = JSON.parse(JSON.stringify(window.defaultCharacterData || defaultCharacterData));
                renderCharacterSheet();
            }
        }
    });

    // Importation (Charger depuis un JSON) - Réservé au MJ, envoie directement au serveur
    document.getElementById('cs-btn-import').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Fallback "intellect" -> "intel"
                    if (importedData.stats && importedData.stats.intellect) {
                        importedData.stats.intel = importedData.stats.intellect;
                        delete importedData.stats.intellect;
                    }

                    if (!importedData.identity || !importedData.identity.name) {
                        throw new Error("Le JSON ne contient pas d'identité ou de nom de personnage.");
                    }

                    // Replace with a deep merge with default object to guarantee missing properties are present
                    let freshData = JSON.parse(JSON.stringify(window.defaultCharacterData || defaultCharacterData));
                    let finalData = deepMerge(freshData, importedData);

                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        // Envoie les données au serveur
                        window.socket.send(JSON.stringify({
                            type: 'update-character',
                            id: finalData.identity.name.trim(),
                            data: finalData
                        }));

                        // Demande au serveur de charger ce personnage pour l'afficher
                        window.socket.send(JSON.stringify({
                            type: 'load-character',
                            id: finalData.identity.name.trim()
                        }));
                    } else {
                        alert("Erreur: Non connecté au serveur.");
                    }

                    // Reset input for consecutive identical file uploads
                    event.target.value = '';
                } catch(err) {
                    console.error("Erreur lors de l'importation du fichier JSON :", err);
                    alert("Erreur: le fichier fourni n'est pas un JSON valide, ou il manque des informations vitales.");
                }
            };
            reader.readAsText(file);
        }
    });

    // Identity Edit Modal
    const identityModal = document.getElementById('cs-identity-modal');
    const btnEditIdentity = document.getElementById('cs-btn-edit-identity');
    const identityBtnCancel = document.getElementById('cs-identity-modal-cancel');
    const identityBtnConfirm = document.getElementById('cs-identity-modal-confirm');

    function closeIdentityModal() {
        identityModal.style.display = 'none';
    }

    if(btnEditIdentity) {
        btnEditIdentity.addEventListener('click', () => {
            identityModal.style.display = 'flex';
        });
    }

    if(identityBtnCancel) {
        identityBtnCancel.addEventListener('click', closeIdentityModal);
    }

    if(identityBtnConfirm) {
        identityBtnConfirm.addEventListener('click', () => {
            updateCharacterDataFromInputs();
            closeIdentityModal();
        });
    }

    if(identityModal) {
        identityModal.addEventListener('click', (e) => {
            if (e.target === identityModal) {
                closeIdentityModal();
            }
        });

        // Handle Enter key for fast save in identity modal
        const identityInputs = document.querySelectorAll('#cs-identity-modal input');
        identityInputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    updateCharacterDataFromInputs();
                    closeIdentityModal();
                }
            });
        });
    }

    // Modal de description
    const descModal = document.getElementById('cs-desc-modal');
    const descModalTitle = document.getElementById('cs-desc-modal-title');
    const descModalText = document.getElementById('cs-desc-modal-text');
    const descBtnCancel = document.getElementById('cs-desc-modal-cancel');
    const descBtnConfirm = document.getElementById('cs-desc-modal-confirm');
    let currentDescIndex = -1;

    function closeDescModal() {
        descModal.style.display = 'none';
        descModalText.value = '';
        currentDescIndex = -1;
    }

    descBtnCancel.addEventListener('click', closeDescModal);

    descBtnConfirm.addEventListener('click', () => {
        if (currentDescIndex >= 0 && characterData.abilities[currentDescIndex]) {
            characterData.abilities[currentDescIndex].description = descModalText.value;
            saveToLocalStorage();
            renderAbilities(); // Re-render to update the tooltip
        }
        closeDescModal();
    });

    descModal.addEventListener('click', (e) => {
        if (e.target === descModal) {
            closeDescModal();
        }
    });

    // Modal de lancer de dé
    const rollModal = document.getElementById('cs-roll-modal');
    const rollModalTitle = document.getElementById('cs-roll-modal-title');
    const rollModalDiff = document.getElementById('cs-roll-modal-diff');
    const rollModalEffort = document.getElementById('cs-roll-modal-effort');
    const btnCancel = document.getElementById('cs-roll-modal-cancel');
    const btnConfirm = document.getElementById('cs-roll-modal-confirm');
    let currentRollName = "";
    let currentRollSkillBonus = 0;
    let currentRollStatusPenalty = 0;
    let currentRollStat = "";

    function closeRollModal() {
        rollModal.style.display = 'none';
        rollModalDiff.value = 0;
        rollModalEffort.value = 0;
    }

    btnCancel.addEventListener('click', closeRollModal);

    rollModal.addEventListener('click', (e) => {
        if (e.target === rollModal) {
            closeRollModal();
        }
    });

    function submitRoll() {
        if (rollModal.style.display === 'none') return;

        const diff = parseInt(rollModalDiff.value, 10) || 0;
        const effort = parseInt(rollModalEffort.value, 10) || 0;

        // Construct the command
        let command = `/c ${currentRollName} /D ${diff} /E ${effort}`;
        if (currentRollSkillBonus !== 0) {
            command += ` /S ${currentRollSkillBonus}`;
        }
        if (currentRollStatusPenalty !== 0) {
            command += ` /P ${currentRollStatusPenalty}`;
        }

        // Calculate effort cost and deduct from pool if effort > 0
        if (effort > 0 && currentRollStat) {
            let cost = 0;
            if (effort >= 1) cost += 3;
            if (effort > 1) cost += (effort - 1) * 2;

            // Subtract edge
            const edge = characterData.stats[currentRollStat].edge;
            let finalCost = cost - edge;
            if (finalCost < 0) finalCost = 0;

            command += ` /C ${finalCost}`;

            // Deduct from pool and update UI
            let currentPool = characterData.stats[currentRollStat].pool;
            let newPool = currentPool - finalCost;
            if (newPool < 0) newPool = 0;

            characterData.stats[currentRollStat].pool = newPool;
            document.getElementById(`cs-stat-${currentRollStat}-pool`).value = newPool;
            saveToLocalStorage();
        }

        // Inject into chat input and simulate send
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-button');

        if (chatInput && sendBtn) {
            chatInput.value = command;
            sendBtn.click();
        } else {
            console.error("Chat input or send button not found");
        }

        closeRollModal();
    }

    btnConfirm.addEventListener('click', submitRoll);

    // Pressing enter in inputs submits
    rollModalDiff.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitRoll();
    });
    rollModalEffort.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitRoll();
    });

    // Lancer de dé depuis la fiche
    document.querySelector('.cs-container').addEventListener('click', (e) => {
        // Clic sur l'icône de description
        if (e.target.classList.contains('cs-desc-icon')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            if (!isNaN(index) && characterData.abilities[index]) {
                currentDescIndex = index;
                const ability = characterData.abilities[index];
                descModalTitle.textContent = `Description : ${ability.name || 'Capacité'}`;
                descModalText.value = ability.description || '';
                descModal.style.display = 'flex';
                descModalText.focus();
            }
            return;
        }

        // Clic sur l'icône de dé (stats & skills)
        if (e.target.classList.contains('cs-roll-icon')) {

            // Check if it's a recovery roll
            if (e.target.classList.contains('cs-rec-roll')) {
                const recType = e.target.getAttribute('data-rec');
                const checkbox = document.getElementById(`cs-rec-${recType}`);

                if (checkbox.checked) {
                    return; // Already used
                }

                // Check it
                checkbox.checked = true;
                updateCharacterDataFromInputs();

                const tier = characterData.identity.tier || 1;
                const bonus = characterData.recoveryRolls.bonus || 0;
                const roll = Math.floor(Math.random() * 6) + 1;
                const total = roll + tier + bonus;

                let recTypeName = "";
                if (recType === 'action') recTypeName = "1 Action";
                else if (recType === 'tenMinutes') recTypeName = "10 Minutes";
                else if (recType === 'oneHour') recTypeName = "1 Heure";
                else if (recType === 'tenHours') recTypeName = "10 Heures";

                const message = `Récupération - ${recTypeName}<br>1D6 + ${tier} (Tier) + ${bonus} (Bonus)<br><br>Résultat : ${roll} + ${tier} + ${bonus} = <strong>${total}</strong>`;

                if (window.sendMessage) {
                    window.sendMessage({ type: 'game-roll', message: message, system: 'Cypher System' });
                }
                return; // Stop further execution for recovery roll
            }

            const stat = e.target.getAttribute('data-stat');
            const skill = e.target.getAttribute('data-skill'); // S'il y a une compétence liée
            const skillLevel = e.target.getAttribute('data-skill-level');

            let rollName = "";
            let skillBonus = 0;
            let statusPenalty = 0;

            if (skill) {
                rollName = skill;

                if (skillLevel === 'specialized') skillBonus = 6;
                else if (skillLevel === 'trained') skillBonus = 3;
                else if (skillLevel === 'inability') skillBonus = -3;
            } else {
                rollName = stat.charAt(0).toUpperCase() + stat.slice(1);
            }

            // Determine damage track status and penalty
            const dtRadios = document.getElementsByName('damageTrack');
            for (let radio of dtRadios) {
                if (radio.checked) {
                    if (radio.value === 'impaired') {
                        statusPenalty = -3;
                    } else if (radio.value === 'debilitated') {
                        statusPenalty = -6;
                    }
                    break;
                }
            }

            currentRollName = rollName;
            currentRollSkillBonus = skillBonus;
            currentRollStatusPenalty = statusPenalty;
            currentRollStat = stat;

            // Limit effort max based on character identity
            const maxEffort = parseInt(document.getElementById('cs-id-effort').value) || 1;
            rollModalEffort.setAttribute('max', maxEffort);

            rollModalTitle.textContent = `Lancer : ${rollName}`;
            rollModal.style.display = 'flex';

            // Focus on effort first
            rollModalEffort.focus();
            rollModalEffort.select();
        }
    });
});
