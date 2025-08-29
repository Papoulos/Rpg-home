// IIFE to encapsulate the music player logic
(() => {
    let player;
    let isMJ = false;

    // DOM Elements
    let musicControls, youtubeUrlInput, musicPlayBtn, musicPauseBtn, musicVolumeSlider, musicTitle;

    // This function creates an <iframe> (and YouTube player)
    // after the API code downloads.
    function onYouTubeIframeAPIReady() {
        player = new YT.Player('youtube-player', {
            height: '0', // Player is invisible
            width: '0',
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    }

    // The API will call this function when the video player is ready.
    function onPlayerReady(event) {
        // Player is ready, we can now control it.
        // We might want to request the current music state from the server here.
        console.log("YouTube Player is ready.");
    }

    // The API calls this function when the player's state changes.
    function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
            // Update the UI with the video title
            const videoData = player.getVideoData();
            musicTitle.textContent = videoData.title || 'Lecture en cours...';
        } else if (event.data == YT.PlayerState.PAUSED) {
            musicTitle.textContent = 'Musique en pause';
        } else if (event.data == YT.PlayerState.ENDED) {
            musicTitle.textContent = 'Aucune musique en cours';
        }
    }

    function onPlayerError(event) {
        console.error("YouTube Player Error:", event.data);
        musicTitle.textContent = "Erreur de lecture de la vidéo.";
    }

    // Function to load the YouTube Iframe API
    function loadYoutubeAPI() {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Helper to send control messages to the server
    function sendMusicControl(action, value = null) {
        if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'music-control',
                action: action
            };
            if (value !== null) {
                payload.value = value;
            }
            window.socket.send(JSON.stringify(payload));
        } else {
            console.error("WebSocket is not connected. Music control not sent.");
        }
    }

    // Extracts YouTube Video ID from various URL formats
    function getYouTubeVideoId(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // --- Event Handlers ---

    function handlePlayClick() {
        const url = youtubeUrlInput.value;
        const videoId = getYouTubeVideoId(url);
        if (videoId) {
            sendMusicControl('play', videoId);
        } else {
            alert("Veuillez entrer une URL YouTube valide.");
        }
    }

    function handlePauseClick() {
        sendMusicControl('pause');
    }

    function handleVolumeChange(event) {
        const volume = event.target.value;
        sendMusicControl('volume', volume);
    }

    // --- Setup Functions ---

    function setupMJControls() {
        if (isMJ) {
            musicControls.classList.remove('hidden');
            musicPlayBtn.addEventListener('click', handlePlayClick);
            musicPauseBtn.addEventListener('click', handlePauseClick);
            musicVolumeSlider.addEventListener('input', handleVolumeChange);
        } else {
            musicControls.classList.add('hidden');
        }
    }

    // --- Global Event Listeners from script.js ---

    window.addEventListener('mj-status', (event) => {
        isMJ = event.detail.isMJ;
        setupMJControls();
    });

    window.addEventListener('music-control', (event) => {
        const { action, value } = event.detail;
        if (!player) return;

        switch (action) {
            case 'play':
                player.loadVideoById(value);
                player.playVideo();
                break;
            case 'pause':
                player.pauseVideo();
                break;
            case 'volume':
                player.setVolume(value);
                // Also update the MJ's slider if they are not the one who initiated the change
                // (though in the current model, only the MJ can)
                if (isMJ) {
                    musicVolumeSlider.value = value;
                }
                break;
            case 'sync':
                // Syncs a newly connected client
                if (value.videoId) {
                    player.loadVideoById(value.videoId, value.currentTime);
                    player.setVolume(value.volume);
                    if (value.isPlaying) {
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }
                     if (isMJ) {
                        musicVolumeSlider.value = value.volume;
                        youtubeUrlInput.value = `https://www.youtube.com/watch?v=${value.videoId}`;
                    }
                }
                break;
        }
    });


    // --- Initialization ---

    document.addEventListener('DOMContentLoaded', () => {
        // Assign DOM elements
        musicControls = document.querySelector('.music-controls');
        youtubeUrlInput = document.getElementById('youtube-url-input');
        musicPlayBtn = document.getElementById('music-play-btn');
        musicPauseBtn = document.getElementById('music-pause-btn');
        musicVolumeSlider = document.getElementById('music-volume-slider');
        musicTitle = document.getElementById('music-title');

        // The YouTube API needs a global function to call, so we attach it to window
        window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        loadYoutubeAPI();
    });

})();
