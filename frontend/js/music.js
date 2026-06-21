/**
 * 音乐播放器前端逻辑
 */

const SESSION_KEY = 'server_monitor_session';

// 获取会话ID
function getSessionId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('sessionId');
    if (urlSessionId) {
        return urlSessionId;
    }
    
    try {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) return JSON.parse(session).sessionId;
    } catch (e) {}
    
    try {
        const session = sessionStorage.getItem(SESSION_KEY);
        if (session) return JSON.parse(session).sessionId;
    } catch (e) {}
    
    return null;
}

// 跳转到登录页
function redirectToLogin() {
    window.location.href = '/login.html';
}

// 检查登录状态
function checkAuth() {
    const sessionId = getSessionId();
    if (!sessionId) {
        redirectToLogin();
        return false;
    }
    
    fetch('/api/auth/check', {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => {
        if (!res.ok) { redirectToLogin(); return; }
        return res.json();
    })
    .then(data => {
        if (data && data.isDefault) {
            window.location.href = '/change-password.html?sessionId=' + encodeURIComponent(sessionId) + '&force=true';
        }
    })
    .catch(() => {});
    
    return true;
}

// 全局变量
let currentSong = null;
let playlist = [];
let currentIndex = -1;
let playMode = 'list'; // list: 列表循环, single: 单曲循环, random: 随机
let isPlaying = false;
let searchResults = [];
let currentTab = 'search';

// DOM 元素
const audioPlayer = document.getElementById('audioPlayer');
const albumCover = document.getElementById('albumCover');
const playerCover = document.querySelector('.player-cover');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressThumb = document.getElementById('progressThumb');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const playBtnLarge = document.getElementById('playBtnLarge');
const playIconLarge = document.getElementById('playIconLarge');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const modeBtn = document.getElementById('modeBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const songList = document.getElementById('songList');
const lyricContent = document.getElementById('lyricContent');
const tabBtns = document.querySelectorAll('.tab-btn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查认证
    if (!checkAuth()) {
        return;
    }
    
    initUserInfo();
    initPlayer();
    bindEvents();
    loadRecommendSongs();
});

// 初始化用户信息
function initUserInfo() {
    const sessionId = getSessionId();
    
    fetch('/api/user/info', {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => res.json())
    .then(data => {
        if (data.username) {
            document.getElementById('username').textContent = data.username;
        }
    })
    .catch(() => {});
    
    // 更新修改密码链接
    const changePasswordLink = document.getElementById('changePasswordLink');
    if (changePasswordLink) {
        changePasswordLink.href = '/change-password.html?sessionId=' + encodeURIComponent(sessionId || '');
    }
    
    // 用户下拉菜单
    const userDropdownBtn = document.getElementById('userDropdownBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    
    if (userDropdownBtn && userDropdownMenu) {
        userDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', () => {
            userDropdownMenu.classList.remove('show');
        });
    }
    
    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 'X-Session-Id': sessionId }
            }).finally(() => {
                localStorage.removeItem(SESSION_KEY);
                sessionStorage.removeItem(SESSION_KEY);
                window.location.href = '/login.html';
            });
        });
    }
}

// 初始化播放器
function initPlayer() {
    // 设置初始音量
    audioPlayer.volume = 0.8;
}

// 绑定事件
function bindEvents() {
    // 播放按钮
    playBtn.addEventListener('click', togglePlay);
    playBtnLarge.addEventListener('click', togglePlay);
    
    // 上一首/下一首
    prevBtn.addEventListener('click', playPrev);
    nextBtn.addEventListener('click', playNext);
    
    // 播放模式
    modeBtn.addEventListener('click', togglePlayMode);
    
    // 音量控制
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        audioPlayer.volume = volume;
        updateVolumeIcon(volume);
    });
    
    volumeBtn.addEventListener('click', toggleMute);
    
    // 进度条
    progressBar.addEventListener('click', seekTo);
    
    // 音频事件
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('ended', handleSongEnd);
    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButton();
        playerCover.classList.add('playing');
    });
    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButton();
        playerCover.classList.remove('playing');
    });
    audioPlayer.addEventListener('error', handleAudioError);
    
    // 搜索
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // 标签切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

// 切换播放/暂停
function togglePlay() {
    if (!currentSong) {
        // 如果没有选中歌曲，播放列表第一首
        if (playlist.length > 0) {
            playSong(playlist[0], 0);
        }
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
}

// 更新播放按钮状态
function updatePlayButton() {
    const icon = isPlaying ? '⏸️' : '▶️';
    playIcon.textContent = icon;
    playIconLarge.textContent = icon;
}

// 播放歌曲
function playSong(song, index = -1) {
    if (!song) return;
    
    currentSong = song;
    if (index >= 0) {
        currentIndex = index;
    }
    
    // 更新UI
    songTitle.textContent = song.name;
    songArtist.textContent = song.artist;
    
    // 更新封面
    if (song.picUrl) {
        albumCover.src = song.picUrl + '?param=300y300';
    } else {
        albumCover.src = '';
    }
    
    // 获取播放地址
    const sessionId = getSessionId();
    fetch(`/api/music/url?id=${song.id}`, {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.url) {
            audioPlayer.src = data.url;
            audioPlayer.play();
        } else {
            alert('获取播放地址失败');
        }
    })
    .catch(err => {
        console.error('获取播放地址失败:', err);
        alert('获取播放地址失败');
    });
    
    // 加载歌词
    loadLyric(song.id);
    
    // 更新列表高亮
    updateSongListHighlight();
}

// 加载歌词
function loadLyric(songId) {
    const sessionId = getSessionId();
    
    fetch(`/api/music/lyric?id=${songId}`, {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.lyric) {
            renderLyric(data.lyric);
        } else {
            lyricContent.innerHTML = `
                <div class="lyric-placeholder">
                    <span>🎵</span>
                    <p>暂无歌词</p>
                </div>
            `;
        }
    })
    .catch(() => {
        lyricContent.innerHTML = `
            <div class="lyric-placeholder">
                <span>🎵</span>
                <p>暂无歌词</p>
            </div>
        `;
    });
}

// 解析并渲染歌词
function renderLyric(lyricText) {
    const lines = lyricText.split('\n');
    const lyricData = [];
    
    // 解析歌词
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    
    lines.forEach(line => {
        const matches = [...line.matchAll(timeRegex)];
        const text = line.replace(timeRegex, '').trim();
        
        if (text && matches.length > 0) {
            matches.forEach(match => {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3].padEnd(3, '0'));
                const time = minutes * 60 + seconds + milliseconds / 1000;
                
                lyricData.push({ time, text });
            });
        }
    });
    
    // 按时间排序
    lyricData.sort((a, b) => a.time - b.time);
    
    // 渲染
    if (lyricData.length === 0) {
        lyricContent.innerHTML = `
            <div class="lyric-placeholder">
                <span>🎵</span>
                <p>暂无歌词</p>
            </div>
        `;
        return;
    }
    
    lyricContent.innerHTML = lyricData.map((item, index) => 
        `<div class="lyric-line" data-time="${item.time}" data-index="${index}">${item.text}</div>`
    ).join('');
    
    // 保存歌词数据
    window.currentLyric = lyricData;
}

// 更新歌词高亮
function updateLyricHighlight(currentTime) {
    if (!window.currentLyric || window.currentLyric.length === 0) return;
    
    let activeIndex = -1;
    
    for (let i = 0; i < window.currentLyric.length; i++) {
        if (window.currentLyric[i].time <= currentTime) {
            activeIndex = i;
        } else {
            break;
        }
    }
    
    if (activeIndex >= 0) {
        const lines = lyricContent.querySelectorAll('.lyric-line');
        lines.forEach((line, index) => {
            if (index === activeIndex) {
                line.classList.add('active');
                // 滚动到可视区域
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                line.classList.remove('active');
            }
        });
    }
}

// 更新进度
function updateProgress() {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    if (duration) {
        const percent = (current / duration) * 100;
        progressFill.style.width = percent + '%';
        progressThumb.style.left = percent + '%';
    }
    
    currentTimeEl.textContent = formatTime(current);
    
    // 更新歌词
    updateLyricHighlight(current);
}

// 更新时长
function updateDuration() {
    totalTimeEl.textContent = formatTime(audioPlayer.duration);
}

// 跳转到指定位置
function seekTo(e) {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * audioPlayer.duration;
    audioPlayer.currentTime = time;
}

// 格式化时间
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 上一首
function playPrev() {
    if (playlist.length === 0) return;
    
    if (playMode === 'random') {
        const randomIndex = Math.floor(Math.random() * playlist.length);
        playSong(playlist[randomIndex], randomIndex);
    } else {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        playSong(playlist[currentIndex], currentIndex);
    }
}

// 下一首
function playNext() {
    if (playlist.length === 0) return;
    
    if (playMode === 'random') {
        const randomIndex = Math.floor(Math.random() * playlist.length);
        playSong(playlist[randomIndex], randomIndex);
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
        playSong(playlist[currentIndex], currentIndex);
    }
}

// 歌曲结束处理
function handleSongEnd() {
    if (playMode === 'single') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        playNext();
    }
}

// 切换播放模式
function togglePlayMode() {
    const modes = ['list', 'single', 'random'];
    const icons = ['🔁', '🔂', '🔀'];
    const names = ['列表循环', '单曲循环', '随机播放'];
    
    const currentModeIndex = modes.indexOf(playMode);
    const nextIndex = (currentModeIndex + 1) % modes.length;
    
    playMode = modes[nextIndex];
    modeBtn.textContent = icons[nextIndex];
    modeBtn.title = names[nextIndex];
}

// 音量控制
function updateVolumeIcon(volume) {
    if (volume === 0) {
        volumeBtn.textContent = '🔇';
    } else if (volume < 0.5) {
        volumeBtn.textContent = '🔉';
    } else {
        volumeBtn.textContent = '🔊';
    }
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        window.lastVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeSlider.value = 0;
    } else {
        audioPlayer.volume = window.lastVolume || 0.8;
        volumeSlider.value = (window.lastVolume || 0.8) * 100;
    }
    updateVolumeIcon(audioPlayer.volume);
}

// 音频错误处理
function handleAudioError() {
    console.error('音频播放错误');
    // 可以尝试下一首
    if (playlist.length > 1) {
        playNext();
    }
}

// 执行搜索
function performSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) return;
    
    // 切换到搜索标签
    switchTab('search');
    
    // 显示加载状态
    songList.innerHTML = `
        <div class="song-list-loading">
            <div class="loading-spinner"></div>
            <span>搜索中...</span>
        </div>
    `;
    
    const sessionId = getSessionId();
    
    fetch(`/api/music/search?keyword=${encodeURIComponent(keyword)}`, {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.songs) {
            searchResults = data.songs;
            renderSongList(data.songs, 'search');
        } else {
            songList.innerHTML = `
                <div class="song-list-placeholder">
                    <span>🔍</span>
                    <p>未找到相关歌曲</p>
                </div>
            `;
        }
    })
    .catch(err => {
        console.error('搜索失败:', err);
        songList.innerHTML = `
            <div class="song-list-placeholder">
                <span>❌</span>
                <p>搜索失败，请稍后重试</p>
            </div>
        `;
    });
}

// 加载推荐音乐
function loadRecommendSongs() {
    const sessionId = getSessionId();
    
    fetch('/api/music/new', {
        headers: { 'X-Session-Id': sessionId }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.songs) {
            // 保存到推荐列表
            window.recommendSongs = data.songs;
            // 如果当前是推荐标签，渲染
            if (currentTab === 'recommend') {
                renderSongList(data.songs, 'recommend');
            }
        }
    })
    .catch(err => {
        console.error('加载推荐音乐失败:', err);
    });
}

// 切换标签
function switchTab(tab) {
    currentTab = tab;
    
    // 更新标签按钮状态
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 渲染对应列表
    if (tab === 'search') {
        if (searchResults.length > 0) {
            renderSongList(searchResults, 'search');
        } else {
            songList.innerHTML = `
                <div class="song-list-placeholder">
                    <span>🔍</span>
                    <p>搜索歌曲或查看推荐</p>
                </div>
            `;
        }
    } else if (tab === 'playlist') {
        if (playlist.length > 0) {
            renderSongList(playlist, 'playlist');
        } else {
            songList.innerHTML = `
                <div class="song-list-placeholder">
                    <span>📋</span>
                    <p>播放列表为空</p>
                    <p style="font-size: 12px; margin-top: 4px;">点击歌曲添加到播放列表</p>
                </div>
            `;
        }
    } else if (tab === 'recommend') {
        if (window.recommendSongs && window.recommendSongs.length > 0) {
            renderSongList(window.recommendSongs, 'recommend');
        } else {
            songList.innerHTML = `
                <div class="song-list-loading">
                    <div class="loading-spinner"></div>
                    <span>加载中...</span>
                </div>
            `;
            loadRecommendSongs();
        }
    }
}

// 渲染歌曲列表
function renderSongList(songs, type) {
    if (!songs || songs.length === 0) {
        songList.innerHTML = `
            <div class="song-list-placeholder">
                <span>🎶</span>
                <p>暂无歌曲</p>
            </div>
        `;
        return;
    }
    
    songList.innerHTML = songs.map((song, index) => {
        const isPlaying = currentSong && currentSong.id === song.id;
        const duration = formatTime((song.duration || 0) / 1000);
        
        return `
            <div class="song-item ${isPlaying ? 'playing' : ''}" 
                 data-id="${song.id}" 
                 data-index="${index}"
                 data-type="${type}">
                <img src="${song.picUrl ? song.picUrl + '?param=100y100' : ''}" 
                     alt="" 
                     class="song-item-cover"
                     onerror="this.style.display='none'">
                <div class="song-item-info">
                    <div class="song-item-name">${song.name}</div>
                    <div class="song-item-artist">${song.artist}</div>
                </div>
                <span class="song-item-duration">${duration}</span>
                <button class="song-item-play-btn" title="播放">▶️</button>
            </div>
        `;
    }).join('');
    
    // 绑定点击事件
    const songItems = songList.querySelectorAll('.song-item');
    songItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const id = parseInt(item.dataset.id);
            const index = parseInt(item.dataset.index);
            const type = item.dataset.type;
            
            let song;
            if (type === 'search') {
                song = searchResults[index];
            } else if (type === 'playlist') {
                song = playlist[index];
            } else if (type === 'recommend') {
                song = window.recommendSongs[index];
            }
            
            if (song) {
                // 添加到播放列表
                addToPlaylist(song);
                // 播放
                const playlistIndex = playlist.findIndex(s => s.id === song.id);
                playSong(song, playlistIndex);
            }
        });
    });
}

// 添加到播放列表
function addToPlaylist(song) {
    // 检查是否已存在
    const exists = playlist.find(s => s.id === song.id);
    if (!exists) {
        playlist.push(song);
    }
}

// 更新歌曲列表高亮
function updateSongListHighlight() {
    const songItems = songList.querySelectorAll('.song-item');
    songItems.forEach(item => {
        const id = parseInt(item.dataset.id);
        if (currentSong && currentSong.id === id) {
            item.classList.add('playing');
        } else {
            item.classList.remove('playing');
        }
    });
}
