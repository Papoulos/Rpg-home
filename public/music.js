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
        musicVolumeSlider, youtubeUrlInput, musicAddBtn, musicLoopToggle, musicPlaylistContainer,
        musicUploadBtn, musicUploadInput, localAudioPlayer;

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
        // Handle both YouTube events (event.data) and native audio events
        const state = event && event.data !== undefined ? event.data : null;
        updatePlayPauseIcon(state);

        if (state === YT.PlayerState.ENDED || (event && event.type === 'ended')) {
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
        const isLocalPlaying = localAudioPlayer && !localAudioPlayer.paused;
        const playerState = player && typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;

        if (playerState === YT.PlayerState.PLAYING || isLocalPlaying) {
            sendMusicControl('pause');
        } else {
            if (currentIndex === -1 && playlist.length > 0) {
                sendMusicControl('play', { index: 0 });
            } else {
                sendMusicControl('play', { index: currentIndex });
            }
        }
    }

    async function handleAddClick() {
        const url = youtubeUrlInput.value.trim();
        if (!url) return;

        if (url.endsWith('.mp3')) {
            musicAddBtn.disabled = true;
            youtubeUrlInput.value = '';
            youtubeUrlInput.placeholder = 'Téléchargement du MP3...';

            try {
                const response = await fetch('/download-music-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                if (!response.ok) throw new Error('Download failed');
                const data = await response.json();
                sendMusicControl('playlist-add', { videoId: data.url, title: data.filename, type: 'local', url: data.url });
            } catch (err) {
                alert("Erreur lors du téléchargement du MP3: " + err.message);
            } finally {
                cleanupTempPlayer();
            }
            return;
        }

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
        youtubeUrlInput.placeholder = 'Coller une URL YouTube ou MP3...';
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

    async function handleMusicUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('musicFile', file);

        musicUploadBtn.disabled = true;

        try {
            const response = await fetch('/upload-music', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            sendMusicControl('playlist-add', { videoId: data.url, title: data.filename, type: 'local', url: data.url });
        } catch (err) {
            alert("Erreur lors de l'upload: " + err.message);
        } finally {
            musicUploadBtn.disabled = false;
            event.target.value = '';
        }
    }

    // --- UI Rendering ---

    function renderPlaylist() {
        musicPlaylistContainer.innerHTML = '';
        playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            item.dataset.videoId = song.videoId;
            item.dataset.url = song.url || '';
            item.draggable = true;

            const iconName = song.type === 'local' ? 'audio_file' : 'youtube_tv';
            // Prevent XSS by creating elements or using textContent for user input
            const safeTitle = document.createElement('div');
            safeTitle.textContent = song.title || song.videoId;

            item.innerHTML = `
                <span class="playlist-item-icon material-symbols-outlined">${iconName}</span>
                <span class="playlist-item-title"></span>
                <div class="playlist-item-controls">
                    <button class="control-btn btn-delete" title="Supprimer">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;
            item.querySelector('.playlist-item-title').textContent = safeTitle.textContent;

            item.addEventListener('click', () => sendMusicControl('play', { index }));
            item.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                sendMusicControl('playlist-remove', { videoId: song.videoId, url: song.url });
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

        const isLocalPlaying = localAudioPlayer && !localAudioPlayer.paused;

        if (state === YT.PlayerState.PLAYING || isLocalPlaying) {
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
            newOrderedPlaylist.push(playlist.find(song => song.videoId === item.dataset.videoId && (song.url || '') === item.dataset.url));
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
            musicUploadBtn.addEventListener('click', () => musicUploadInput.click());
            musicUploadInput.addEventListener('change', handleMusicUpload);
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
                    const currentSong = playlist[currentIndex];

                    if (currentSong.type === 'local') {
                        player.pauseVideo();
                        localAudioPlayer.src = currentSong.url;
                        localAudioPlayer.volume = isMJ ? musicVolumeSlider.value / 100 : (value.volume || 100) / 100;
                        localAudioPlayer.play();
                    } else {
                        localAudioPlayer.pause();
                        player.loadVideoById(currentSong.videoId);
                        player.playVideo();
                    }
                    updatePlaylistUI();
                }
                break;
            case 'pause':
                player.pauseVideo();
                localAudioPlayer.pause();
                break;
            case 'volume':
                player.setVolume(value.volume);
                localAudioPlayer.volume = value.volume / 100;
                if (isMJ) musicVolumeSlider.value = value.volume;
                break;
            case 'playlist-update':
                playlist = value.playlist || [];
                isLooping = value.isLooping || false;
                if (isMJ) musicLoopToggle.checked = isLooping;
                renderPlaylist();
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
                    const currentSong = playlist[currentIndex];
                    if (currentSong.type === 'local') {
                        player.pauseVideo();
                        localAudioPlayer.src = currentSong.url;
                        localAudioPlayer.currentTime = value.currentTime;
                        localAudioPlayer.volume = value.volume / 100;
                        if (value.isPlaying) localAudioPlayer.play();
                        else localAudioPlayer.pause();
                    } else {
                        localAudioPlayer.pause();
                        player.loadVideoById(currentSong.videoId, value.currentTime);
                        player.setVolume(value.volume);
                        if (value.isPlaying) {
                            player.playVideo();
                        } else {
                            player.pauseVideo();
                        }
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
        musicUploadBtn = document.getElementById('music-upload-btn');
        musicUploadInput = document.getElementById('music-upload-input');
        localAudioPlayer = document.getElementById('local-audio-player');

        localAudioPlayer.addEventListener('play', () => updatePlayPauseIcon());
        localAudioPlayer.addEventListener('pause', () => updatePlayPauseIcon());
        localAudioPlayer.addEventListener('ended', onPlayerStateChange); // Trigger next song if ended

        window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        loadYoutubeAPI();
    });
})();
