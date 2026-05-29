/*
  ======================================================
  nekopoi. — Premium Application Logic (Velvet Core)
  API Integration, Navigation, LocalStorage, HLS Player
  ======================================================
*/

const API_BASE = 'https://nekopoi-api-yurtzy.vercel.app';
const container = document.getElementById('app-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// Premium View Counter Utility Functions
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// App State
let state = {
    view: 'home', // home, directory, genres, schedule, watchlist, history, search, detail, category, hentai, jav
    page: 1,
    query: '',
    categoryName: '',
    letter: '',
    dirType: 'jav', // 'jav' or 'hentai'
    activeDetailUrl: '',
    hasNextPage: false,
    adShield: false
};

// LocalStorage Keys
const KEYS = {
    BOOKMARKS: 'nekopoi_bookmarks',
    HISTORY: 'nekopoi_watch_history'
};

// API Fetch Helper
async function api(endpoint) {
    showSpinner();
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'API Error');
        return json.data;
    } catch (e) {
        showError(e.message);
        return null;
    }
}

// Show skeleton shimmers while loading
function showSkeletons() {
    container.innerHTML = `
    <div class="skeleton-container">
        <div class="skeleton-title"></div>
        <div class="skeleton-grid">
            ${Array(8).fill(`
                <div class="skeleton-card">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line"></div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

function showSpinner() {
    container.innerHTML = `
    <div class="spinner-container">
        <div class="glow-spinner"></div>
    </div>`;
}

function showError(msg) {
    container.innerHTML = `
    <div class="error-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h4>fetch failed</h4>
        <p>${msg}</p>
        <button class="btn-back" onclick="navigate('home')" style="margin-top: 1rem;">return home</button>
    </div>`;
}

// Sync Navbar tabs visual active state
function syncNavbarTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.dataset.view === state.view) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// 1. View: Load Latest Updates (Paginated)
async function loadLatest(page = 1) {
    state.view = 'home';
    state.page = page;
    syncNavbarTabs();
    showSkeletons();

    const data = await api(`/latest?page=${page}`);
    if (!data) return;

    state.hasNextPage = data.hasNextPage;
    const items = Array.isArray(data) ? data : data.results;

    let html = `
    <div class="section-header">
        <h2 class="section-title">latest releases</h2>
        <span class="card-meta">page ${page}</span>
    </div>
    <div class="grid">`;

    if (items && items.length > 0) {
        items.forEach(item => {
            // Check if title has JAV or Hentai tags to render visual badges
            let badge = '';
            if (item.title.toLowerCase().includes('jav') || item.title.match(/^[a-zA-Z0-9]+-[0-9]+/)) {
                badge = `<span class="card-badge">jav</span>`;
            } else {
                badge = `<span class="card-badge">hentai</span>`;
            }

            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img-wrapper">
                    ${badge}
                    <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta-row">
                        <span class="card-meta"><i class="fa-regular fa-folder-open"></i> feed</span>
                        <span class="card-date">${item.date || ''}</span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
        html += renderPaginationControls('loadLatest');
    } else {
        html = renderEmptyState('no releases found.');
    }
    
    container.innerHTML = html;
}

// 2. View: Search (Paginated)
async function loadSearch(query, page = 1) {
    state.view = 'search';
    state.query = query;
    state.page = page;
    syncNavbarTabs();
    showSkeletons();

    const data = await api(`/search?q=${encodeURIComponent(query)}&page=${page}`);
    if (!data) return;

    state.hasNextPage = data.hasNextPage;

    let html = `
    <div class="section-header">
        <h2 class="section-title">results for: "${query}"</h2>
        <span class="card-meta">page ${page}</span>
    </div>
    <div class="grid">`;

    if (data.results && data.results.length > 0) {
        data.results.forEach(item => {
            let badge = '';
            if (item.title.toLowerCase().includes('jav') || item.title.match(/^[a-zA-Z0-9]+-[0-9]+/)) {
                badge = `<span class="card-badge">jav</span>`;
            } else {
                badge = `<span class="card-badge">hentai</span>`;
            }

            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img-wrapper">
                    ${badge}
                    <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta-row">
                        <span class="card-meta" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <i class="fa-solid fa-tags"></i> ${item.genres ? item.genres.join(', ') : 'search'}
                        </span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
        html += renderPaginationControls('loadSearch', `'${query}'`);
    } else {
        html = renderEmptyState(`no results found for "${query}".`);
    }

    container.innerHTML = html;
}

// 3. View: Genres Cloud Explorer
async function loadGenres() {
    state.view = 'genres';
    syncNavbarTabs();
    showSpinner();

    const data = await api('/genres');
    if (!data) return;

    let html = `
    <div class="section-header">
        <h2 class="section-title">browse genres</h2>
    </div>
    <div class="genres-tag-cloud">`;

    data.forEach(genre => {
        html += `
        <div class="genre-tag-card" onclick="loadCategory('${genre.slug}', '${genre.name}')">
            <i class="fa-solid fa-hashtag" style="color: var(--accent); margin-right: 0.4rem;"></i>
            ${genre.name}
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// 4. View: Category/Genre Detail Listing (Paginated)
async function loadCategory(catSlug, catName, page = 1) {
    if (catSlug === 'hentai') {
        state.view = 'hentai';
    } else if (catSlug === 'jav') {
        state.view = 'jav';
    } else {
        state.view = 'category';
    }
    state.categoryName = catSlug;
    state.query = catName;
    state.page = page;
    syncNavbarTabs();
    showSkeletons();

    const data = await api(`/category/${catSlug}?page=${page}`);
    if (!data) return;

    state.hasNextPage = data.hasNextPage;

    let backBarHtml = '';
    if (state.view === 'category') {
        backBarHtml = `
        <div class="detail-back-bar">
            <button class="btn-back" onclick="navigate('genres')">
                <i class="fa-solid fa-arrow-left-long"></i> return to genres
            </button>
        </div>`;
    }

    let html = `
    ${backBarHtml}
    <div class="section-header" style="margin-top: ${state.view === 'category' ? '1rem' : '0.5rem'};">
        <h2 class="section-title">${catName} releases</h2>
        <span class="card-meta">page ${page}</span>
    </div>
    <div class="grid">`;

    if (data.results && data.results.length > 0) {
        data.results.forEach(item => {
            let badge = '';
            if (item.title.toLowerCase().includes('jav') || item.title.match(/^[a-zA-Z0-9]+-[0-9]+/)) {
                badge = `<span class="card-badge">jav</span>`;
            } else {
                badge = `<span class="card-badge">hentai</span>`;
            }

            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img-wrapper">
                    ${badge}
                    <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta-row">
                        <span class="card-meta">${item.date || 'genre listing'}</span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
        html += renderPaginationControls('loadCategory', `'${catSlug}', '${catName}'`);
    } else {
        html = renderEmptyState(`no items found in this genre.`);
    }

    container.innerHTML = html;
}

// 5. View: Alphabet AZ Directory lists
async function loadDirectory(type = 'jav', letter = '') {
    state.view = 'directory';
    state.dirType = type;
    state.letter = letter;
    syncNavbarTabs();
    showSpinner();

    const data = await api(`/list/${type}`);
    if (!data) return;

    // Compile letters available
    const letters = data.map(group => group.letter);
    const activeLetter = letter || letters[0] || '';
    state.letter = activeLetter;

    // Filter results to active letter
    const activeGroup = data.find(group => group.letter === activeLetter);

    let alphabetHtml = `<div class="alphabet-bar">`;
    letters.forEach(letItem => {
        const activeClass = letItem === activeLetter ? 'active' : '';
        alphabetHtml += `<button class="btn-letter ${activeClass}" onclick="loadDirectory('${type}', '${letItem}')">${letItem}</button>`;
    });
    alphabetHtml += `</div>`;

    let html = `
    <div class="directory-nav-container">
        <div class="directory-selector-row">
            <button class="btn-dir-select ${type === 'jav' ? 'active' : ''}" onclick="loadDirectory('jav')">JAV A-Z Directory</button>
            <button class="btn-dir-select ${type === 'hentai' ? 'active' : ''}" onclick="loadDirectory('hentai')">Hentai A-Z Directory</button>
        </div>
        ${alphabetHtml}
    </div>
    
    <div class="dir-results-container">`;

    if (activeGroup && activeGroup.items && activeGroup.items.length > 0) {
        html += `
        <div class="dir-letter-section">
            <h3 class="dir-letter-heading">${activeLetter}</h3>
            <div class="dir-links-list">`;
            
        activeGroup.items.forEach(link => {
            html += `<a class="dir-link-item" onclick="loadDetail('${link.url}')" title="${link.title}">${link.title}</a>`;
        });
        
        html += `</div></div>`;
    } else {
        html += renderEmptyState('no directory list items found under this letter.');
    }

    html += `</div>`;
    container.innerHTML = html;
}

// 6. View: Upcoming Release Schedule
async function loadSchedule() {
    state.view = 'schedule';
    syncNavbarTabs();
    showSpinner();

    const data = await api('/schedule');
    if (!data) return;

    let html = `
    <div class="section-header">
        <h2 class="section-title">upcoming release schedule</h2>
    </div>`;

    if (data && data.length > 0) {
        data.forEach(monthGroup => {
            html += `
            <div class="schedule-month-container">
                <h3 class="schedule-month-header">
                    <i class="fa-regular fa-calendar-check" style="color: var(--accent); margin-right: 0.6rem;"></i>
                    ${monthGroup.month}
                </h3>
                <div class="schedule-releases-grid">`;

            monthGroup.releases.forEach(rel => {
                html += `
                <div class="schedule-release-card">
                    <div class="schedule-release-thumb" style="background-image: url('${rel.thumbnail || ''}')"></div>
                    <div class="schedule-release-info">
                        <div class="schedule-release-title" title="${rel.title}">${rel.title}</div>
                        <div class="schedule-release-producer">
                            <i class="fa-solid fa-building-user"></i> ${rel.producer || 'Unknown Studio'}
                        </div>
                        <div class="schedule-release-meta">
                            <span class="schedule-release-date">
                                <i class="fa-regular fa-clock"></i> ${rel.releaseDate || 'TBA'}
                            </span>
                            ${rel.episode ? `<span class="schedule-release-ep">${rel.episode}</span>` : ''}
                        </div>
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        });
    } else {
        html = renderEmptyState('no upcoming releases scheduled currently.');
    }

    container.innerHTML = html;
}

// 7. View: Watchlist Bookmarks (LocalStorage)
function loadWatchlist() {
    state.view = 'watchlist';
    syncNavbarTabs();
    showSpinner();

    const bookmarks = getLocalStorage(KEYS.BOOKMARKS);

    let html = `
    <div class="section-header">
        <h2 class="section-title">my watchlist bookmarks</h2>
    </div>`;

    if (bookmarks && bookmarks.length > 0) {
        html += `<div class="grid">`;
        bookmarks.forEach(item => {
            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img-wrapper">
                    <span class="card-badge" style="background: var(--text-main); color: #000;">saved</span>
                    <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta-row">
                        <span class="card-meta"><i class="fa-solid fa-bookmark" style="color: var(--accent);"></i> watchlisted</span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-regular fa-bookmark"></i></div>
            <div class="empty-state-text">your watchlist is empty.</div>
            <p style="color: var(--text-sub); font-size: 0.88rem;">bookmark your favorite series or JAV codes to keep track of them here!</p>
            <button class="btn-back" onclick="navigate('home')">discover anime</button>
        </div>`;
    }

    container.innerHTML = html;
}

// 8. View: Play History (LocalStorage)
function loadHistory() {
    state.view = 'history';
    syncNavbarTabs();
    showSpinner();

    const historyItems = getLocalStorage(KEYS.HISTORY);

    let html = `
    <div class="section-header">
        <h2 class="section-title">recently watched</h2>
        <button class="btn-back" onclick="clearWatchHistory()" style="padding: 0.4rem 0.8rem; font-size: 11px;">
            <i class="fa-solid fa-trash-can"></i> clear history
        </button>
    </div>`;

    if (historyItems && historyItems.length > 0) {
        html += `<div class="grid">`;
        // Show reverse chronological
        [...historyItems].reverse().forEach(item => {
            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img-wrapper">
                    <span class="card-badge" style="background: var(--text-sub); color: #FFF;"><i class="fa-regular fa-clock"></i> history</span>
                    <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta-row">
                        <span class="card-meta" style="font-size: 10px; color: var(--accent-light);">
                            watched: ${new Date(item.timestamp).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
            <div class="empty-state-text">no watch history.</div>
            <p style="color: var(--text-sub); font-size: 0.88rem;">episodes and videos you watch will be saved here so you can easily resume them.</p>
        </div>`;
    }

    container.innerHTML = html;
}

// 9. View: Detailed View & Media Player (Custom HLS integration)
async function loadDetail(url) {
    state.view = 'detail';
    state.activeDetailUrl = url;
    syncNavbarTabs();
    showSpinner();

    // Persist details routing in browser history
    if (window.location.search !== `?video=${encodeURIComponent(url)}`) {
        history.pushState({ page: 'detail', url }, '', `?video=${encodeURIComponent(url)}`);
    }

    const data = await api(`/detail?url=${encodeURIComponent(url)}`);
    if (!data) return;

    // Update document/tab title dynamically
    document.title = `${data.title} — nekopoi.`;

    // Save to Watch/Clicked history
    saveToWatchHistory(data, url);

    const isBookmarked = checkIsBookmarked(url);

    // Calculate seeded views count
    const baseViews = Math.abs(hashCode(url)) % 6000 + 1500;
    const totalViews = baseViews + (data.views || 0);

    let html = `
    <div class="detail-view">
        <div class="detail-back-bar">
            <button class="btn-back" onclick="goBackFromDetail()">
                <i class="fa-solid fa-arrow-left-long"></i> go back
            </button>
        </div>

        <div class="detail-main-grid">
            <!-- Sidebar (Poster & Actions) -->
            <div class="detail-sidebar">
                <img class="detail-poster" src="${data.thumbnail || ''}" alt="poster"/>
                
                <div class="bookmark-action-container">
                    <button class="btn-bookmark-action ${isBookmarked ? 'remove' : 'add'}" onclick="toggleBookmark('${encodeURIComponent(JSON.stringify(data))}', '${encodeURIComponent(url)}')">
                        <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                        <span>${isBookmarked ? 'remove watchlist' : 'add to watchlist'}</span>
                    </button>
                </div>
            </div>

            <!-- Content Area -->
            <div class="detail-content">
                <div class="detail-header">
                    <h1 class="detail-title">${data.title}</h1>
                    <div class="detail-metadata-tags">
                        <div class="metadata-tag">
                            <i class="fa-solid fa-eye" style="color: var(--accent); margin-right: 0.3rem;"></i>
                            <strong>views:</strong> ${formatNumber(totalViews)}
                        </div>`;

    if (data.metadata) {
        for (const [k, v] of Object.entries(data.metadata)) {
            let val = Array.isArray(v) ? v.join(', ') : v;
            html += `
            <div class="metadata-tag">
                <strong>${k.replace(/_/g, ' ')}:</strong> ${val}
            </div>`;
        }
    }
    
    html += `</div></div>`;

    if (data.synopsis) {
        html += `<div class="synopsis-box">${data.synopsis}</div>`;
    }

    // A. Content Type: Series (Shows episode list cards)
    if (data.type === 'series' && data.episodes) {
        html += `
        <div class="episodes-section">
            <div class="section-header">
                <h3 class="section-title" style="font-size: 1.4rem;">available episodes</h3>
            </div>
            <div class="episodes-list">`;
            
        data.episodes.forEach(ep => {
            html += `
            <div class="episode-item-card" onclick="loadDetail('${ep.url}')">
                <div class="episode-thumb-mini" style="background-image: url('${ep.thumbnail || data.thumbnail || ''}')"></div>
                <div class="episode-info">
                    <div class="episode-info-title">${ep.title}</div>
                    <div class="episode-info-meta">
                        <span class="ep-badge"><i class="fa-solid fa-circle-play"></i> ${ep.badge || 'Ep'}</span>
                        <span class="ep-date">${ep.date || ''}</span>
                    </div>
                </div>
            </div>`;
        });
        
        html += `</div></div>`;
    } 
    // B. Content Type: Episode (Shows player and downloads)
    else {
        // Player tab block
        if (data.streamServers && data.streamServers.length > 0) {
            // Find a direct URL server (streampoi/resolved direct stream link is highly preferred)
            const mainStream = data.streamServers.find(s => s.directUrl) || data.streamServers[0];
            const hasDirectStream = !!mainStream.directUrl;
            
            html += `
            <div class="video-section">
                <div class="now-playing-banner" style="background: linear-gradient(135deg, rgba(233, 121, 145, 0.1) 0%, rgba(233, 121, 145, 0.02) 100%); border-left: 4px solid var(--accent); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.2rem;">
                    <span style="font-size: 0.7rem; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;"><i class="fa-solid fa-play" style="margin-right: 0.3rem;"></i> now playing</span>
                    <span style="font-size: 1.05rem; color: var(--text-main); font-weight: 600; line-height: 1.4;">${data.title}</span>
                </div>
                <div class="section-header">
                    <h3 class="section-title" style="font-size: 1.4rem;">media player</h3>
                </div>
                <div class="player-wrapper">`;

            if (hasDirectStream) {
                // PREMIUM HLS.JS PLAYER INTEGRATION
                html += `
                <video id="hls-video" controls autoplay width="100%" height="100%" poster="${data.thumbnail || ''}"></video>
                <script>
                    setTimeout(() => {
                        const video = document.getElementById('hls-video');
                        const streamUrl = "${mainStream.directUrl}";
                        if (Hls.isSupported()) {
                            const hls = new Hls();
                            hls.loadSource(streamUrl);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                                video.play().catch(e => console.log("Autoplay blocked, user interaction required"));
                            });
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = streamUrl;
                        }
                    }, 200);
                </script>`;
            } else {
                // Standard iframe fallback
                const sandboxAttr = state.adShield ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock allow-popups"' : '';
                html += `
                <iframe class="video-frame" id="iframe-player" src="${mainStream.url}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen" ${sandboxAttr}></iframe>`;
            }

            html += `</div>`; // Close player-wrapper

            // Ad Shield Toggle row
            html += `
            <div class="ad-shield-row" style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); padding: 0.6rem 1rem; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-sub);">
                    <i class="fa-solid fa-shield-halved" style="color: ${state.adShield ? 'var(--accent)' : '#94a3b8'}; transition: color 0.2s;"></i>
                    <span><strong>Ad-Block Shield</strong> ${state.adShield ? '(Safe Mode)' : '(Disabled - Ads allowed)'}</span>
                </div>
                <button class="btn-dir-select ${state.adShield ? 'active' : ''}" onclick="toggleAdShield()" style="padding: 0.3rem 0.8rem; font-size: 0.75rem; border-radius: 4px; border: 1px solid ${state.adShield ? 'var(--accent)' : 'var(--border)'}; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    ${state.adShield ? 'disable ad shield' : 'enable ad shield'}
                </button>
            </div>
            `;

            // Server Selection pills
            if (data.streamServers.length > 1) {
                html += `
                <div class="server-selection">
                    <span class="server-label">streaming servers:</span>
                    <div class="server-pills">`;
                
                data.streamServers.forEach((s, idx) => {
                    const activeClass = s.server === mainStream.server ? 'active' : '';
                    const payload = encodeURIComponent(JSON.stringify(s));
                    html += `
                    <button class="server-pill ${activeClass}" onclick="switchStreamServer(this, '${payload}')">
                        ${s.server} ${s.directUrl ? '<i class="fa-solid fa-bolt" style="color:#000; margin-left:3px;"></i>' : ''}
                    </button>`;
                });
                
                html += `</div></div>`;
            }

            html += `</div>`; // Close video-section
        }

        // Downloads block
        if (data.downloads && data.downloads.length > 0) {
            html += `
            <div class="downloads-section">
                <div class="section-header">
                    <h3 class="section-title" style="font-size: 1.4rem;">download coordinates</h3>
                </div>`;
                
            data.downloads.forEach(dl => {
                let linksHtml = dl.links.map(l => `
                    <a href="${l.url}" target="_blank" class="btn-download-link">
                        <i class="fa-solid fa-arrow-down-to-bracket"></i> ${l.host}
                    </a>
                `).join('');
                
                html += `
                <div class="download-resolution-card">
                    <span class="res-name"><i class="fa-solid fa-film"></i> ${dl.name}</span> 
                    <div class="download-links-grid">${linksHtml}</div>
                </div>`;
            });
            
            html += `</div>`;
        }
    }

    html += `</div></div></div>`;
    container.innerHTML = html;
    window.scrollTo(0, 0);
}

// Interactive helper to switch player servers
window.switchStreamServer = function(btnEl, serverPayload) {
    const serverObj = JSON.parse(decodeURIComponent(serverPayload));
    
    // De-activate other pills
    btnEl.parentNode.querySelectorAll('.server-pill').forEach(pill => pill.classList.remove('active'));
    btnEl.classList.add('active');

    const wrapper = document.querySelector('.player-wrapper');
    if (!wrapper) return;

    if (serverObj.directUrl) {
        // Embed direct Hls player
        wrapper.innerHTML = `
        <video id="hls-video" controls autoplay width="100%" height="100%"></video>`;
        const video = document.getElementById('hls-video');
        const streamUrl = serverObj.directUrl;
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log(e));
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
        }
    } else {
        // Embed standard iframe fallback
        const sandboxAttr = state.adShield ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock allow-popups"' : '';
        wrapper.innerHTML = `
        <iframe class="video-frame" id="iframe-player" src="${serverObj.url}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen" ${sandboxAttr}></iframe>`;
    }
};

window.toggleAdShield = function() {
    state.adShield = !state.adShield;
    
    // Dynamically rebuild the iframe in the DOM to apply/remove the sandbox instantly without API re-fetch
    const iframe = document.getElementById('iframe-player');
    if (iframe) {
        const parent = iframe.parentNode;
        const newIframe = document.createElement('iframe');
        newIframe.className = iframe.className;
        newIframe.id = iframe.id;
        newIframe.frameBorder = iframe.frameBorder;
        if (iframe.hasAttribute('allowfullscreen')) {
            newIframe.setAttribute('allowfullscreen', '');
        }
        newIframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
        
        if (state.adShield) {
            newIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock allow-popups');
        }
        
        // Reset src context to about:blank first, then load the target URL after a tiny timeout to completely clear browser sandbox state
        const targetSrc = iframe.src;
        newIframe.src = 'about:blank';
        parent.replaceChild(newIframe, iframe);
        
        setTimeout(() => {
            newIframe.src = targetSrc;
        }, 50);
    }
    
    // Instantly update the Ad-Shield toggle UI row
    const shieldRow = document.querySelector('.ad-shield-row');
    if (shieldRow) {
        shieldRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-sub);">
            <i class="fa-solid fa-shield-halved" style="color: ${state.adShield ? 'var(--accent)' : '#94a3b8'}; transition: color 0.2s;"></i>
            <span><strong>Ad-Block Shield</strong> ${state.adShield ? '(Safe Mode)' : '(Disabled - Ads allowed)'}</span>
        </div>
        <button class="btn-dir-select ${state.adShield ? 'active' : ''}" onclick="toggleAdShield()" style="padding: 0.3rem 0.8rem; font-size: 0.75rem; border-radius: 4px; border: 1px solid ${state.adShield ? 'var(--accent)' : 'var(--border)'}; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            ${state.adShield ? 'disable ad shield' : 'enable ad shield'}
        </button>
        `;
    }
};

// Simple History Routing GoBack Control
function goBackFromDetail() {
    // Reset tab title
    document.title = 'nekopoi. — premium anime hub';

    if (state.query) {
        if (state.view === 'category' || state.categoryName) {
            history.pushState({ page: 'category', catSlug: state.categoryName, catName: state.query }, '', `?${state.categoryName}`);
            loadCategory(state.categoryName, state.query, state.page);
        } else {
            history.pushState({ page: 'search', q: state.query }, '', `?search=${encodeURIComponent(state.query)}`);
            loadSearch(state.query, state.page);
        }
    } else {
        history.pushState({ page: 'home' }, '', '?home');
        loadLatest(state.page);
    }
}

// Pagination Controls Renderer
function renderPaginationControls(actionName, extraParams = '') {
    const prevDisabled = state.page <= 1 ? 'disabled' : '';
    const nextDisabled = !state.hasNextPage ? 'disabled' : '';
    const paramsStr = extraParams ? `${extraParams}, ` : '';
    
    return `
    <div class="pagination-controls">
        <button class="btn-pagination" ${prevDisabled} onclick="${actionName}(${paramsStr}${state.page - 1})">
            <i class="fa-solid fa-angle-left"></i> prev
        </button>
        <span class="pagination-info">page ${state.page}</span>
        <button class="btn-pagination" ${nextDisabled} onclick="${actionName}(${paramsStr}${state.page + 1})">
            next <i class="fa-solid fa-angle-right"></i>
        </button>
    </div>`;
}

function renderEmptyState(msg) {
    return `
    <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
        <div class="empty-state-text">${msg}</div>
    </div>`;
}

// LocalStorage Utilities
function getLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
    } catch (e) {
        return [];
    }
}

function setLocalStorage(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
        console.error('LocalStorage write error', e);
    }
}

// Bookmarking logic
function checkIsBookmarked(url) {
    const list = getLocalStorage(KEYS.BOOKMARKS);
    return list.some(item => item.url === url);
}

window.toggleBookmark = function(encodedData, encodedUrl) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const url = decodeURIComponent(encodedUrl);
    let list = getLocalStorage(KEYS.BOOKMARKS);

    if (checkIsBookmarked(url)) {
        list = list.filter(item => item.url !== url);
        setLocalStorage(KEYS.BOOKMARKS, list);
    } else {
        list.push({
            title: data.title,
            thumbnail: data.thumbnail,
            url: url
        });
        setLocalStorage(KEYS.BOOKMARKS, list);
    }

    // Refresh UI
    loadDetail(url);
};

// Play/Click History log logic
function saveToWatchHistory(data, url) {
    let list = getLocalStorage(KEYS.HISTORY);
    // Remove if already exists to push to front
    list = list.filter(item => item.url !== url);
    
    list.push({
        title: data.title,
        thumbnail: data.thumbnail,
        url: url,
        timestamp: Date.now()
    });

    // Cap history items at 50
    if (list.length > 50) {
        list.shift();
    }
    setLocalStorage(KEYS.HISTORY, list);
}

window.clearWatchHistory = function() {
    setLocalStorage(KEYS.HISTORY, []);
    loadHistory();
};

// Unified Navigation controller
window.navigate = function(view) {
    state.query = '';
    state.page = 1;
    state.categoryName = '';
    state.letter = '';
    searchInput.value = '';

    if (view === 'home') {
        history.pushState({ page: 'home' }, '', '?home');
        loadLatest(1);
    } else if (view === 'hentai') {
        history.pushState({ page: 'hentai' }, '', '?hentai');
        loadCategory('hentai', 'Hentai', 1);
    } else if (view === 'jav') {
        history.pushState({ page: 'jav' }, '', '?jav');
        loadCategory('jav', 'JAV', 1);
    } else if (view === 'directory') {
        history.pushState({ page: 'directory' }, '', '?directory');
        loadDirectory('jav');
    } else if (view === 'genres') {
        history.pushState({ page: 'genres' }, '', '?genres');
        loadGenres();
    } else if (view === 'schedule') {
        history.pushState({ page: 'schedule' }, '', '?schedule');
        loadSchedule();
    } else if (view === 'watchlist') {
        history.pushState({ page: 'watchlist' }, '', '?watchlist');
        loadWatchlist();
    } else if (view === 'history') {
        history.pushState({ page: 'history' }, '', '?history');
        loadHistory();
    }
};

// Event Listeners
searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (q) {
        history.pushState({ page: 'search', q }, '', `?search=${encodeURIComponent(q)}`);
        loadSearch(q, 1);
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) {
            history.pushState({ page: 'search', q }, '', `?search=${encodeURIComponent(q)}`);
            loadSearch(q, 1);
        }
    }
});

// Simple Browser popstate (Back/Forward) handler
window.addEventListener('popstate', (e) => {
    handleUrlRouting();
});

function handleUrlRouting() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('video')) {
        loadDetail(params.get('video'));
    } else if (params.has('search')) {
        const q = params.get('search');
        searchInput.value = q;
        loadSearch(q, 1);
        document.title = 'nekopoi. — premium anime hub';
    } else if (params.has('hentai')) {
        loadCategory('hentai', 'Hentai', 1);
        document.title = 'Hentai Releases — nekopoi.';
    } else if (params.has('jav')) {
        loadCategory('jav', 'JAV', 1);
        document.title = 'JAV Releases — nekopoi.';
    } else if (params.has('directory')) {
        loadDirectory('jav');
        document.title = 'Directory — nekopoi.';
    } else if (params.has('genres')) {
        loadGenres();
        document.title = 'Genres — nekopoi.';
    } else if (params.has('schedule')) {
        loadSchedule();
        document.title = 'Schedule — nekopoi.';
    } else if (params.has('watchlist')) {
        loadWatchlist();
        document.title = 'Watchlist — nekopoi.';
    } else if (params.has('history')) {
        loadHistory();
        document.title = 'History — nekopoi.';
    } else {
        loadLatest(1);
        document.title = 'nekopoi. — premium anime hub';
    }
}

// Initial Boot
window.addEventListener('DOMContentLoaded', () => {
    handleUrlRouting();
});