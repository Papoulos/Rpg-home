// IIFE to encapsulate the music player logic
(() => {
    // --- State ---
    let player;
    let isMJ = false;
    let playlist = [];
    let currentIndex = -1;
    let isLooping = false;
    let isPlayerReady = false;

    // --- DOM Elements ---
    let musicContainer, musicMainControls, musicCurrentTitle, musicPlayPauseBtn,
        musicVolumeSlider, youtubeUrlInput, musicAddBtn, musicLoopToggle, musicPlaylistContainer;

    // --- YouTube Player API Functions ---

    function onYouTubeIframeAPIReady() {
        player = new YT.Player('youtube-player', {
            height: '0',
            width: '0',
            playerVars: { 'playsinline': 1 },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    }

    function onPlayerReady(event) {
        console.log("YouTube Player is ready.");
        isPlayerReady = true;
        sendMusicControl('request-sync');
    }

    function onPlayerStateChange(event) {
        updatePlayPauseIcon(event.data);
        if (event.data === YT.PlayerState.ENDED) {
            playNextSong();
        }
    }

    function onPlayerError(event) {
        console.error("YouTube Player Error:", event.data);
        musicCurrentTitle.textContent = "Erreur de lecture de la vidéo.";
    }

    function loadYoutubeAPI() {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // --- Logic & Event Handlers ---

    function playNextSong() {
        if (playlist.length === 0) return;
        let nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) {
            if (isLooping) {
                nextIndex = 0;
            } else {
                musicCurrentTitle.textContent = "Fin de la playlist.";
                currentIndex = -1;
                updatePlaylistUI();
                return;
            }
        }
        sendMusicControl('play', { index: nextIndex });
    }

    function handlePlayPauseClick() {
        const playerState = player && typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
        if (playerState === YT.PlayerState.PLAYING) {
            sendMusicControl('pause');
        } else {
            if (currentIndex === -1 && playlist.length > 0) {
                sendMusicControl('play', { index: 0 });
            } else {
                sendMusicControl('play', { index: currentIndex });
            }
        }
    }

    function handleAddClick() {
        const url = youtubeUrlInput.value.trim();
        if (!url) return;
        const videoId = getYouTubeVideoId(url);

        if (videoId) {
            musicAddBtn.disabled = true;
            youtubeUrlInput.value = '';
            youtubeUrlInput.placeholder = 'Récupération du titre...';

            const tempPlayerContainer = document.createElement('div');
            tempPlayerContainer.id = 'temp-youtube-player';
            tempPlayerContainer.style.display = 'none';
            document.body.appendChild(tempPlayerContainer);

            new YT.Player('temp-youtube-player', {
                height: '0', width: '0', videoId: videoId,
                events: {
                    'onReady': (e) => {
                        const title = e.target.getVideoData().title;
                        sendMusicControl('playlist-add', { videoId: videoId, title: title });
                        cleanupTempPlayer(e.target, tempPlayerContainer);
                    },
                    'onError': (e) => {
                        console.error("Failed to fetch title for video:", videoId, "Error:", e.data);
                        sendMusicControl('playlist-add', { videoId: videoId, title: videoId }); // Fallback
                        cleanupTempPlayer(e.target, tempPlayerContainer);
                    }
                }
            });
        } else {
            alert("URL YouTube invalide.");
        }
    }

    function cleanupTempPlayer(targetPlayer, container) {
        musicAddBtn.disabled = false;
        youtubeUrlInput.placeholder = 'Coller une URL YouTube pour l\'ajouter à la playlist...';
        if (targetPlayer && typeof targetPlayer.destroy === 'function') {
            targetPlayer.destroy();
        }
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }

    function handleLoopToggle() {
        isLooping = musicLoopToggle.checked;
        sendMusicControl('playlist-toggle-loop', { isLooping });
    }

    function handleVolumeChange(event) {
        sendMusicControl('volume', { volume: event.target.value });
    }

    function getYouTubeVideoId(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // --- UI Rendering ---

    function renderPlaylist() {
        musicPlaylistContainer.innerHTML = '';
        playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            item.dataset.videoId = song.videoId;
            item.draggable = true;

            item.innerHTML = `
                <span class="playlist-item-title">${song.title || song.videoId}</span>
                <div class="playlist-item-controls">
                    <button class="control-btn btn-delete" title="Supprimer">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;

            item.addEventListener('click', () => sendMusicControl('play', { index }));
            item.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                sendMusicControl('playlist-remove', { videoId: song.videoId });
            });

            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('dragleave', handleDragLeave);
            item.addEventListener('drop', handleDrop);

            musicPlaylistContainer.appendChild(item);
        });
        updatePlaylistUI();
    }

    function updatePlaylistUI() {
        const items = musicPlaylistContainer.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === currentIndex) {
                item.classList.add('playing');
                if (playlist[index]) musicCurrentTitle.textContent = playlist[index].title;
            } else {
                item.classList.remove('playing');
            }
        });
        if (currentIndex === -1) {
            musicCurrentTitle.textContent = "Aucune musique sélectionnée";
        }
    }

    function updatePlayPauseIcon(state) {
        const icon = musicPlayPauseBtn.querySelector('.material-symbols-outlined');
        if (!icon) return;

        if (state === YT.PlayerState.PLAYING) {
            icon.textContent = 'pause';
        } else {
            icon.textContent = 'play_arrow';
        }
    }

    // --- Drag and Drop Handlers ---
    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => this.classList.add('dragging'), 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        const afterElement = getDragAfterElement(musicPlaylistContainer, e.clientY);
        if (afterElement == null) {
            musicPlaylistContainer.appendChild(draggedItem);
        } else {
            musicPlaylistContainer.insertBefore(draggedItem, afterElement);
        }
    }

    function handleDragLeave(e) { /* No action needed */ }

    function handleDrop(e) {
        e.stopPropagation();
        draggedItem.classList.remove('dragging');

        const newOrderedPlaylist = [];
        const items = musicPlaylistContainer.querySelectorAll('.playlist-item');
        items.forEach(item => {
            newOrderedPlaylist.push(playlist.find(song => song.videoId === item.dataset.videoId));
        });
        playlist = newOrderedPlaylist;

        sendMusicControl('playlist-reorder', { playlist });
        draggedItem = null;
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.playlist-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- Communication ---

    function sendMusicControl(action, value = {}) {
        if (isMJ && window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify({ type: 'music-control', action, value }));
        }
    }

    function setupMJControls() {
        if (isMJ) {
            musicContainer.classList.remove('hidden');
            musicPlayPauseBtn.addEventListener('click', handlePlayPauseClick);
            musicAddBtn.addEventListener('click', handleAddClick);
            musicLoopToggle.addEventListener('change', handleLoopToggle);
            musicVolumeSlider.addEventListener('input', handleVolumeChange);
        } else {
            musicContainer.classList.add('hidden');
        }
    }

    // --- Global Event Listener from script.js ---

    window.addEventListener('music-control', (event) => {
        if (!isPlayerReady) return;
        const { action, value } = event.detail;

        switch (action) {
            case 'play':
                if (value.index >= 0 && value.index < playlist.length) {
                    currentIndex = value.index;
                    player.loadVideoById(playlist[currentIndex].videoId);
                    player.playVideo();
                    updatePlaylistUI();
                }
                break;
            case 'pause':
                player.pauseVideo();
                break;
            case 'volume':
                player.setVolume(value.volume);
                if (isMJ) musicVolumeSlider.value = value.volume;
                break;
            case 'playlist-add':
                playlist.push(value);
                renderPlaylist(); // Re-render for simplicity, includes adding the new song
                break;
            case 'playlist-remove':
                playlist = playlist.filter(song => song.videoId !== value.videoId);
                renderPlaylist(); // Re-render to remove the song
                break;
            case 'playlist-reorder':
                playlist = value.playlist || [];
                renderPlaylist();
                break;
            case 'playlist-toggle-loop':
                isLooping = value.isLooping || false;
                if (isMJ) musicLoopToggle.checked = isLooping;
                break;
            case 'sync':
                playlist = value.playlist || [];
                isLooping = value.isLooping || false;
                currentIndex = value.currentIndex;

                if (isMJ) {
                    musicLoopToggle.checked = isLooping;
                    musicVolumeSlider.value = value.volume;
                }

                renderPlaylist();

                if (currentIndex >= 0 && currentIndex < playlist.length) {
                    player.loadVideoById(playlist[currentIndex].videoId, value.currentTime);
                    player.setVolume(value.volume);
                    if (value.isPlaying) {
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }
                }
                updatePlaylistUI();
                break;
        }
    });

    window.addEventListener('mj-status', (event) => {
        isMJ = event.detail.isMJ;
        setupMJControls();
    });

    // --- Initialization ---

    document.addEventListener('DOMContentLoaded', () => {
        // Check the global flag on load, in case the event was missed
        if (window.isMJ) {
            isMJ = true;
            setupMJControls();
        }

        musicContainer = document.querySelector('.music-container');
        musicMainControls = document.getElementById('music-main-controls');
        musicCurrentTitle = document.getElementById('music-current-title');
        musicPlayPauseBtn = document.getElementById('music-play-pause-btn');
        musicVolumeSlider = document.getElementById('music-volume-slider');
        youtubeUrlInput = document.getElementById('youtube-url-input');
        musicAddBtn = document.getElementById('music-add-btn');
        musicLoopToggle = document.getElementById('music-loop-toggle');
        musicPlaylistContainer = document.getElementById('music-playlist');

        window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        loadYoutubeAPI();
    });
})();
