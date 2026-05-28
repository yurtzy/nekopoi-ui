const API_BASE = 'https://nekopoi-api-yurtzy.vercel.app';
const container = document.getElementById('app-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

async function api(endpoint) {
    container.innerHTML = '<div class="loading">fetching...</div>';
    window.scrollTo(0, 0);
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'API Error');
        return json.data;
    } catch (e) {
        container.innerHTML = `<div class="error">error: ${e.message}</div>`;
        return null;
    }
}

async function loadLatest() {
    const data = await api('/latest');
    if (!data) return;
    
    let html = `<div style="margin-bottom: 2rem; opacity: 0.6; text-transform: lowercase;">latest updates</div><div class="grid">`;
    // sometimes it's directly an array if the scraper returns array, sometimes it has a .results wrapper
    const items = Array.isArray(data) ? data : data.results;
    
    if (items) {
        items.forEach(item => {
            html += `
            <div class="card" onclick="loadDetail('${item.url}')">
                <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
                <div class="card-title">${item.title}</div>
                <div class="card-meta">${item.date || ''}</div>
            </div>`;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
}

async function loadSearch(query) {
    const data = await api(`/search?q=${encodeURIComponent(query)}`);
    if (!data) return;
    
    if (!data.results || data.results.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 4rem;">no results found for '${query}'.</div>`;
        return;
    }

    let html = `<div style="margin-bottom: 2rem; opacity: 0.6; text-transform: lowercase;">results for: ${query}</div><div class="grid">`;
    data.results.forEach(item => {
        html += `
        <div class="card" onclick="loadDetail('${item.url}')">
            <div class="card-img" style="background-image: url('${item.thumbnail || ''}')"></div>
            <div class="card-title">${item.title}</div>
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

async function loadDetail(url) {
    const data = await api(`/detail?url=${encodeURIComponent(url)}`);
    if (!data) return;
    
    let html = `
    <div class="detail-view">
        <button class="raw-btn" onclick="loadLatest()" style="width: fit-content;">return</button>
        <div class="detail-header">
            <h1>${data.title}</h1>
            <div class="meta-info">
    `;
            
    if (data.metadata) {
        for (const [k, v] of Object.entries(data.metadata)) {
            let val = Array.isArray(v) ? v.join(', ') : v;
            html += `<span class="meta-item"><strong>${k.replace(/_/g, ' ')}</strong> ${val}</span>`;
        }
    }
    
    html += `</div></div>`;
    
    if (data.thumbnail) {
        html += `<img src="${data.thumbnail}" style="max-width: 300px; height: auto; border: 1px solid var(--border);" alt="cover"/>`;
    }

    if (data.synopsis) {
        html += `<div class="synopsis">${data.synopsis}</div>`;
    }

    // Is a Series with Episode List
    if (data.type === 'series' && data.episodes) {
        html += `<h3>episodes</h3><ul class="list-raw">`;
        data.episodes.forEach(ep => {
            html += `
            <li>
                <span class="episode-link" onclick="loadDetail('${ep.url}')">${ep.title}</span>
                <span class="card-meta">${ep.date || ep.badge || ''}</span>
            </li>`;
        });
        html += `</ul>`;
    } 
    // Is an Episode with streams and downloads
    else {
        if (data.streamServers && data.streamServers.length > 0) {
            html += `<h3>stream</h3><div class="streams-container">`;
            
            // Prefer the first one or specifically streampoi (which usually has directUrl)
            const mainStream = data.streamServers.find(s => s.directUrl) || data.streamServers[0];
            
            const src = mainStream.directUrl || mainStream.url;
            html += `
                <div style="margin-bottom: 0.5rem; font-size: 11px; opacity: 0.7;">now playing: ${mainStream.server}</div>
                <iframe class="video-frame" src="${src}" frameborder="0" allowfullscreen></iframe>
            `;

            if (data.streamServers.length > 1) {
                html += `<div style="font-size: 12px; margin-top: 1rem;">alternate servers: `;
                data.streamServers.forEach(s => {
                    html += `<a href="${s.directUrl || s.url}" target="_blank" style="margin-right: 1rem; color: var(--fg);">${s.server}</a>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        }

        if (data.downloads && data.downloads.length > 0) {
            html += `<h3>downloads</h3><ul class="list-raw">`;
            data.downloads.forEach(dl => {
                let linksHtml = dl.links.map(l => `<a href="${l.url}" target="_blank">${l.host}</a>`).join(' ');
                html += `
                <li>
                    <span style="font-weight:bold">${dl.name}</span> 
                    <span class="link-group">${linksHtml}</span>
                </li>`;
            });
            html += `</ul>`;
        }
    }

    html += `</div>`;
    container.innerHTML = html;
}

// Navigation abstraction
function navigate(view) {
    if (view === 'home') {
        searchInput.value = '';
        const state = { page: 'home' };
        history.pushState(state, '', '?home');
        loadLatest();
    }
}

// Events
searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if(q) {
        history.pushState({ page: 'search', q }, '', `?search=${encodeURIComponent(q)}`);
        loadSearch(q);
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if(q) {
            history.pushState({ page: 'search', q }, '', `?search=${encodeURIComponent(q)}`);
            loadSearch(q);
        }
    }
});

// Handle browser back button (rudimentary)
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'search' && e.state.q) {
        searchInput.value = e.state.q;
        loadSearch(e.state.q);
    } else {
        navigate('home');
    }
});

// init
window.addEventListener('DOMContentLoaded', () => {
    // Simple query param routing
    const params = new URLSearchParams(window.location.search);
    if (params.has('search')) {
        const q = params.get('search');
        searchInput.value = q;
        loadSearch(q);
    } else {
        navigate('home');
    }
});