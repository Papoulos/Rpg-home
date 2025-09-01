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
            playerVars: {
                'playsinline': 1
            },
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
        // Request initial state from server
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
                // End of playlist
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
            // If paused, resume. If stopped, play current or first song.
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
            // To get the title, we have to load it. This is a bit tricky.
            // We'll let the server handle fetching the title.
            sendMusicControl('playlist-add', { videoId });
            youtubeUrlInput.value = '';
        } else {
            alert("URL YouTube invalide.");
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

            if (index === currentIndex) {
                item.classList.add('playing');
            }

            item.innerHTML = `
                <span class="playlist-item-title">${song.title || song.videoId}</span>
                <div class="playlist-item-controls">
                    <button class="control-btn btn-delete" title="Supprimer">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;

            // Event Listeners for playlist items
            item.addEventListener('click', () => sendMusicControl('play', { index }));
            item.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent playing the song
                sendMusicControl('playlist-remove', { videoId: song.videoId });
            });

            // Drag and Drop
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('dragleave', handleDragLeave);
            item.addEventListener('drop', handleDrop);

            musicPlaylistContainer.appendChild(item);
        });
    }

    function updatePlaylistUI() {
        const items = musicPlaylistContainer.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === currentIndex) {
                item.classList.add('playing');
                musicCurrentTitle.textContent = playlist[index].title;
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
        e.dataTransfer.setData('text/html', this.innerHTML);
        setTimeout(() => this.classList.add('dragging'), 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        this.classList.add('over');
    }

    function handleDragLeave(e) {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        e.stopPropagation();
        this.classList.remove('over');

        if (draggedItem !== this) {
            const fromIndex = parseInt(draggedItem.dataset.index, 10);
            const toIndex = parseInt(this.dataset.index, 10);

            // Reorder array
            const item = playlist.splice(fromIndex, 1)[0];
            playlist.splice(toIndex, 0, item);

            sendMusicControl('playlist-reorder', { playlist });
        }
        draggedItem.classList.remove('dragging');
        draggedItem = null;
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
            case 'playlist-update':
                playlist = value.playlist || [];
                isLooping = value.isLooping || false;
                if (isMJ) musicLoopToggle.checked = isLooping;
                renderPlaylist();
                updatePlaylistUI();
                break;
            case 'sync': // Full state sync for new joiners or upon request
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
        // Assign DOM elements
        musicContainer = document.querySelector('.music-container');
        musicMainControls = document.getElementById('music-main-controls');
        musicCurrentTitle = document.getElementById('music-current-title');
        musicPlayPauseBtn = document.getElementById('music-play-pause-btn');
        musicVolumeSlider = document.getElementById('music-volume-slider');
        youtubeUrlInput = document.getElementById('youtube-url-input');
        musicAddBtn = document.getElementById('music-add-btn');
        musicLoopToggle = document.getElementById('music-loop-toggle');
        musicPlaylistContainer = document.getElementById('music-playlist');

        // The YouTube API needs a global function to call
        window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        loadYoutubeAPI();
    });
})();
