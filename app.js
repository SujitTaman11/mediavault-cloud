// ======= Simple “DB” in localStorage =======
const LS_KEYS = {
  media: "ms_media_v1",
  user: "ms_user_v1"
};

function nowISO(){
  return new Date().toISOString();
}
function niceDate(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function getUser(){
  const u = JSON.parse(localStorage.getItem(LS_KEYS.user) || "null");
  return u || { username: "demoUser" }; // default “logged-in”
}
function setUser(username){
  localStorage.setItem(LS_KEYS.user, JSON.stringify({ username }));
}
function signOut(){
  localStorage.removeItem(LS_KEYS.user);
}

function loadMedia(){
  const raw = localStorage.getItem(LS_KEYS.media);
  if(!raw){
    const seed = seedMedia();
    localStorage.setItem(LS_KEYS.media, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw) || []; } catch { return []; }
}
function saveMedia(list){
  localStorage.setItem(LS_KEYS.media, JSON.stringify(list));
}
function seedMedia(){
  // Seed items so Home isn’t empty on first run
  const u = getUser().username;
  return [
    {
      id: uid(),
      title: "City skyline at dusk",
      description: "Demo item. Replace with uploads.",
      tags: ["city","skyline","night"],
      type: "image",
      visibility: "Public",
      owner: u,
      uploadDate: nowISO(),
      status: "Uploaded",
      views: 12,
      thumbDataUrl: null
    },
    {
      id: uid(),
      title: "Wildlife documentary clip",
      description: "Demo item (video metadata).",
      tags: ["wildlife","nature"],
      type: "video",
      visibility: "Public",
      owner: "anotherUser",
      uploadDate: nowISO(),
      status: "Processing",
      views: 34,
      thumbDataUrl: null
    }
  ];
}

function findById(id){
  return loadMedia().find(x => x.id === id) || null;
}
function updateById(id, patch){
  const list = loadMedia();
  const idx = list.findIndex(x => x.id === id);
  if(idx === -1) return false;
  list[idx] = { ...list[idx], ...patch };
  saveMedia(list);
  return true;
}
function deleteById(id){
  const list = loadMedia().filter(x => x.id !== id);
  saveMedia(list);
}

function parseTags(str){
  if(!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean).slice(0, 20);
}
function tagsToString(tags){
  return (tags || []).join(", ");
}

function allowedType(file){
  const ok = ["image/jpeg","image/png","video/mp4"];
  return ok.includes(file.type);
}

function fileTooLarge(file){
  // demo limit: 25MB
  return file.size > 25 * 1024 * 1024;
}

async function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

// ======= UI: Shared nav + user pill =======
function mountNav(active){
  const user = getUser();
  const el = document.getElementById("appNav");
  if(!el) return;

  el.innerHTML = `
    <div class="container">
      <div class="nav">
        <a class="logo" href="index.html">
          <div class="logo-badge" aria-hidden="true"></div>
          <span>MediaVault</span>
        </a>
        <div class="navlinks">
          <a href="index.html" ${active==="home"?"style='background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)'":""}>Home</a>
          <a href="upload.html" ${active==="upload"?"style='background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)'":""}>Upload</a>
          <a href="my-media.html" ${active==="mine"?"style='background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)'":""}>My Media</a>
          <a href="profile.html" ${active==="profile"?"style='background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)'":""}>Profile/Login</a>
        </div>
        <div class="spacer"></div>
        <div class="userpill">
          <span class="pill">User: <b>${escapeHtml(user.username)}</b></span>
          <button class="pill danger" id="btnSignOut" type="button">Sign out</button>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById("btnSignOut");
  if(btn){
    btn.onclick = () => { signOut(); location.href = "profile.html"; };
  }
}

function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ======= Home/Explore rendering helpers =======
function renderSkeletonGrid(container, count=8){
  container.innerHTML = "";
  for(let i=0;i<count;i++){
    const div = document.createElement("div");
    div.className = "item skeleton";
    div.innerHTML = `<div class="thumb"></div><div class="meta"><div style="height:14px;width:80%" class="skeleton"></div></div>`;
    container.appendChild(div);
  }
}

function mediaStatusBadge(status){
  if(status === "Uploaded") return `<span class="badge ok statusbadge">Uploaded</span>`;
  if(status === "Processing") return `<span class="badge warn statusbadge">Processing</span>`;
  if(status === "Failed") return `<span class="badge bad statusbadge">Failed</span>`;
  return `<span class="badge statusbadge">${escapeHtml(status||"")}</span>`;
}

function mediaTypeBadge(type){
  const label = type === "video" ? "Video" : "Image";
  return `<span class="badge typebadge">${label}</span>`;
}

function renderItemCard(item, { showQuickActions=false } = {}){
  const thumb = (() => {
    if(item.type === "image" && item.thumbDataUrl){
      return `<img alt="${escapeHtml(item.title)}" src="${item.thumbDataUrl}">`;
    }
    return `<div class="small" style="padding:10px;color:var(--muted)">No thumbnail</div>`;
  })();

  const tagChips = (item.tags || []).slice(0, 4).map(t => `<span class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join("");

  const quick = showQuickActions ? `
    <div class="actions">
      <a class="btn" href="edit.html?id=${encodeURIComponent(item.id)}">Edit</a>
      <button class="btn danger" data-del="${escapeHtml(item.id)}" type="button">Delete</button>
    </div>
  ` : "";

  return `
    <a href="details.html?id=${encodeURIComponent(item.id)}" class="item" style="cursor:pointer">
      <div class="thumb">
        ${mediaTypeBadge(item.type)}
        ${mediaStatusBadge(item.status)}
        ${thumb}
      </div>
      <div class="meta">
        <div class="titleline">
          <div class="title">${escapeHtml(item.title)}</div>
          <span class="badge">${escapeHtml(item.visibility || "Public")}</span>
        </div>
        <div class="submeta">
          by <b>${escapeHtml(item.owner)}</b> • ${escapeHtml(niceDate(item.uploadDate))}
        </div>
        <div class="chips" style="margin-top:10px">${tagChips}</div>
        ${quick}
      </div>
    </a>
  `;
}

function getQueryParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function paginate(list, page, pageSize){
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return { page: p, pages, total, slice: list.slice(start, start + pageSize) };
}

function applyFilters(list, filters){
  let out = [...list];

  // visibility on home: show public + user’s private (if any)
  const user = getUser().username;
  out = out.filter(x => x.visibility !== "Private" || x.owner === user);

  if(filters.onlyMine){
    out = out.filter(x => x.owner === user);
  }
  if(filters.type && filters.type !== "all"){
    out = out.filter(x => x.type === filters.type);
  }
  if(filters.q){
    const q = filters.q.toLowerCase();
    out = out.filter(x =>
      (x.title||"").toLowerCase().includes(q) ||
      (x.description||"").toLowerCase().includes(q) ||
      (x.owner||"").toLowerCase().includes(q) ||
      (x.tags||[]).some(t => t.toLowerCase().includes(q))
    );
  }
  if(filters.tag){
    const t = filters.tag.toLowerCase();
    out = out.filter(x => (x.tags||[]).some(z => z.toLowerCase() === t));
  }

  // sort
  if(filters.sort === "oldest"){
    out.sort((a,b) => (a.uploadDate||"").localeCompare(b.uploadDate||""));
  } else if(filters.sort === "views"){
    out.sort((a,b) => (b.views||0) - (a.views||0));
  } else {
    // newest
    out.sort((a,b) => (b.uploadDate||"").localeCompare(a.uploadDate||""));
  }

  return out;
}

// ======= Page initializers =======
window.MS = {
  mountNav,
  loadMedia,
  saveMedia,
  getUser,
  setUser,
  signOut,
  findById,
  updateById,
  deleteById,
  parseTags,
  tagsToString,
  allowedType,
  fileTooLarge,
  fileToDataUrl,
  renderSkeletonGrid,
  renderItemCard,
  getQueryParam,
  paginate,
  applyFilters,
  niceDate,
  escapeHtml
};

const API_BASE = "http://localhost:3000";

async function apiGetMedia() {
  const res = await fetch(`${API_BASE}/media`);
  if (!res.ok) throw new Error("Failed to fetch media");
  return await res.json();
}

async function apiGetMediaById(id) {
  const res = await fetch(`${API_BASE}/media/${id}`);
  if (!res.ok) throw new Error("Failed to fetch media item");
  return await res.json();
}

async function apiCreateMedia(media) {
  const res = await fetch(`${API_BASE}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(media)
  });

  if (!res.ok) throw new Error("Failed to create media");
  return await res.json();
}

async function apiUpdateMedia(id, media) {
  const res = await fetch(`${API_BASE}/media/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(media)
  });

  if (!res.ok) throw new Error("Failed to update media");
  return await res.json();
}

async function apiDeleteMedia(id) {
  const res = await fetch(`${API_BASE}/media/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) throw new Error("Failed to delete media");
  return await res.json();
}