

import { db }           from "./firebase-config.js";
import {
  collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let todosImoveis = [];         
let filtrados    = [];          
let activeChips  = new Set();   
let favoritos    = loadFavs();  



document.addEventListener("DOMContentLoaded", async () => {
  updateFavBadge();
  await carregarImoveis();
  bindChips();
  bindSearch();
  bindFavLink();
});



async function carregarImoveis() {
  try {
    const snap = await getDocs(
      query(collection(db, "imoveis"), orderBy("criadoEm", "desc"))
    );
    todosImoveis = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filtrados = [...todosImoveis];
    renderCards(filtrados);
    updateResultsInfo(filtrados.length);
  } catch (err) {
    console.error(err);
    document.getElementById("cards-grid").innerHTML =
      `<div class="loading-msg">Erro ao carregar imóveis. Verifique o Firebase.</div>`;
  }
}


function renderCards(lista, containerId = "cards-grid") {
  const grid = document.getElementById(containerId);
  if (!lista.length) {
    grid.innerHTML = `<div class="loading-msg">Nenhum imóvel encontrado.</div>`;
    return;
  }

  grid.innerHTML = lista.map(im => {
    const isFav = favoritos.has(im.id);
    const primeiraFoto = im.fotos && im.fotos.length ? im.fotos[0] : null;
    const imgHTML = primeiraFoto
      ? `<img src="${primeiraFoto}" alt="${im.titulo}" loading="lazy" />`
      : `<div class="card-img-placeholder" style="background:${bgColor(im.negocio)}">${emoji(im.tipo)}</div>`;

    return `
      <article class="card" onclick="abrirModal('${im.id}')">
        <div class="card-img-wrap">
          ${imgHTML}
          <span class="card-badge badge-${im.negocio.toLowerCase().replace('ã','a').replace('ç','c')}">${im.negocio}</span>
          ${im.destaque ? `<span class="card-destaque">⭐ Destaque</span>` : ""}
          <button class="card-fav-btn ${isFav ? "liked" : ""}"
            onclick="toggleFav(event,'${im.id}')"
            title="${isFav ? "Remover favorito" : "Favoritar"}">
            ${isFav ? "❤️" : "🤍"}
          </button>
        </div>
        <div class="card-body">
          <div class="card-price">${formatPreco(im.preco, im.negocio)}</div>
          <div class="card-title">${im.titulo}</div>
          <div class="card-local">📍 ${im.bairro}, ${im.cidade}</div>
          <div class="card-features">
            ${im.quartos > 0 ? `<span class="feat">🛏 ${im.quartos}q</span>` : ""}
            ${im.banheiros > 0 ? `<span class="feat">🚿 ${im.banheiros}ban</span>` : ""}
            <span class="feat">📐 ${im.area}m²</span>
            ${im.vagas > 0 ? `<span class="feat">🚗 ${im.vagas}v</span>` : ""}
          </div>
        </div>
      </article>`;
  }).join("");
}



window.abrirModal = function(id) {
  const im = todosImoveis.find(i => i.id === id);
  if (!im) return;

  const fotos = im.fotos && im.fotos.length ? im.fotos : null;
  const imgHTML = fotos
    ? `<img src="${fotos[0]}" alt="${im.titulo}" style="width:100%;height:100%;object-fit:cover" />`
    : `<span style="font-size:64px">${emoji(im.tipo)}</span>`;

  const wpp = im.telefone
    ? `https://wa.me/55${im.telefone.replace(/\D/g,"")}?text=Ol%C3%A1!%20Tenho%20interesse%20no%20im%C3%B3vel%3A%20${encodeURIComponent(im.titulo)}`
    : null;

  document.getElementById("modal-box").innerHTML = `
    <div class="modal-header">
      <h2>${im.titulo}</h2>
      <button class="modal-close" onclick="fecharModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="modal-img-carousel" style="background:${bgColor(im.negocio)}">${imgHTML}</div>
      <div class="modal-price">${formatPreco(im.preco, im.negocio)}</div>
      <div class="modal-title">${im.tipo} · ${im.negocio}</div>
      <div class="modal-local">📍 ${im.endereco ? im.endereco + " — " : ""}${im.bairro}, ${im.cidade}${im.cep ? " · CEP " + im.cep : ""}</div>
      <div class="modal-details">
        ${im.quartos > 0   ? row("Quartos", im.quartos) : ""}
        ${im.banheiros > 0 ? row("Banheiros", im.banheiros) : ""}
        ${row("Área", im.area + " m²")}
        ${im.vagas > 0 ? row("Vagas", im.vagas) : ""}
      </div>
      ${im.descricao ? `<div class="modal-desc">${im.descricao}</div>` : ""}
      ${wpp
        ? `<a href="${wpp}" target="_blank" rel="noopener"><button class="btn-whatsapp">💬 Falar no WhatsApp</button></a>`
        : `<button class="btn-whatsapp" onclick="showToast('Contato não cadastrado')">💬 Entrar em contato</button>`
      }
    </div>`;

  document.getElementById("modal").style.display = "flex";
  document.body.style.overflow = "hidden";
};

window.fecharModal = function() {
  document.getElementById("modal").style.display = "none";
  document.body.style.overflow = "";
};

window.closeModalOutside = function(e) {
  if (e.target.id === "modal") fecharModal();
};

function row(label, value) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value}</span>
  </div>`;
}


window.toggleFav = function(e, id) {
  e.stopPropagation();
  if (favoritos.has(id)) {
    favoritos.delete(id);
    showToast("Removido dos favoritos");
  } else {
    favoritos.add(id);
    showToast("❤️ Adicionado aos favoritos!");
  }
  saveFavs();
  updateFavBadge();
  renderCards(filtrados, "cards-grid");
  const favSection = document.getElementById("favoritos");
  if (favSection.style.display !== "none") renderFavs();
};

function renderFavs() {
  const favs = todosImoveis.filter(i => favoritos.has(i.id));
  const grid  = document.getElementById("fav-grid");
  const empty = document.getElementById("fav-empty");
  if (!favs.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
    renderCards(favs, "fav-grid");
  }
}

window.closeFavs = function() {
  document.getElementById("favoritos").style.display = "none";
};

function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem("cc_favs") || "[]")); }
  catch { return new Set(); }
}

function saveFavs() {
  localStorage.setItem("cc_favs", JSON.stringify([...favoritos]));
}

function updateFavBadge() {
  document.getElementById("fav-count").textContent = favoritos.size;
}

function bindFavLink() {
  document.getElementById("btn-ver-favs").addEventListener("click", e => {
    e.preventDefault();
    const sec = document.getElementById("favoritos");
    if (sec.style.display === "none") {
      sec.style.display = "block";
      renderFavs();
      sec.scrollIntoView({ behavior: "smooth" });
    } else {
      sec.style.display = "none";
    }
  });
}


function bindChips() {
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      chip.classList.toggle("active");
      activeChips.has(f) ? activeChips.delete(f) : activeChips.add(f);
      applyFilters();
    });
  });
}

function bindSearch() {
  document.getElementById("search-input").addEventListener("keyup", e => {
    if (e.key === "Enter") applyFilters();
  });
  document.getElementById("filter-negocio").addEventListener("change", applyFilters);
}

window.applyFilters = function() {
  const q      = document.getElementById("search-input").value.toLowerCase().trim();
  const negocio = document.getElementById("filter-negocio").value;
  const sort   = document.getElementById("sort-select").value;

  filtrados = todosImoveis.filter(im => {
    const matchQ = !q ||
      im.titulo.toLowerCase().includes(q) ||
      im.cidade.toLowerCase().includes(q) ||
      im.bairro.toLowerCase().includes(q);
    const matchNeg = !negocio || im.negocio === negocio;
    let matchChips = true;
    if (activeChips.size > 0) {
      matchChips = [...activeChips].every(f => {
        if (["Apartamento","Casa","Comercial","Terreno"].includes(f)) return im.tipo === f;
        if (f === "1q")     return Number(im.quartos) === 1;
        if (f === "2q")     return Number(im.quartos) >= 2;
        if (f === "garagem") return Number(im.vagas) > 0;
        return true;
      });
    }
    return matchQ && matchNeg && matchChips;
  });

  // ordenação
  if (sort === "preco-asc")  filtrados.sort((a,b) => a.preco - b.preco);
  if (sort === "preco-desc") filtrados.sort((a,b) => b.preco - a.preco);
  if (sort === "recente")    filtrados.sort((a,b) => (b.criadoEm?.seconds||0) - (a.criadoEm?.seconds||0));
  if (sort === "area-asc")   filtrados.sort((a,b) => a.area - b.area);
  if (sort === "area-desc")  filtrados.sort((a,b) => b.area - a.area);

  renderCards(filtrados, "cards-grid");
  updateResultsInfo(filtrados.length);
  document.getElementById("btn-limpar").style.display =
    (q || negocio || activeChips.size > 0) ? "inline" : "none";
};

window.clearFilters = function() {
  document.getElementById("search-input").value = "";
  document.getElementById("filter-negocio").value = "";
  document.getElementById("sort-select").value = "";
  activeChips.clear();
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  filtrados = [...todosImoveis];
  renderCards(filtrados, "cards-grid");
  updateResultsInfo(filtrados.length);
  document.getElementById("btn-limpar").style.display = "none";
};

function updateResultsInfo(n) {
  document.getElementById("results-info").textContent =
    `${n} imóvel${n !== 1 ? "s" : ""} encontrado${n !== 1 ? "s" : ""}`;
}



function formatPreco(preco, negocio) {
  const v = Number(preco).toLocaleString("pt-BR");
  return negocio === "Locação" ? `R$ ${v}/mês` : `R$ ${v}`;
}

function bgColor(negocio) {
  if (negocio === "Locação") return "#E1F5EE";
  if (negocio === "Lançamento") return "#FAEEDA";
  return "#E6F1FB";
}

function emoji(tipo) {
  if (tipo === "Casa") return "🏡";
  if (tipo === "Comercial") return "🏢";
  if (tipo === "Terreno") return "🌿";
  return "🏠";
}



window.showToast = function(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
};
