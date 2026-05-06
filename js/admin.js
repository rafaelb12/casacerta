

import { db, auth } from "../js/firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const CLOUDINARY_CLOUD_NAME    = "dkeyabx5v";  
const CLOUDINARY_UPLOAD_PRESET = "casacerta";      

let imoveis      = [];
let pendingFiles = [];
let adminImoveis = [];

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("screen-login").style.display = "none";
    document.getElementById("screen-admin").style.display = "block";
    document.getElementById("admin-email-label").textContent = user.email;
    loadImoveis();
  } else {
    document.getElementById("screen-login").style.display = "flex";
    document.getElementById("screen-admin").style.display = "none";
  }
});

// ──────────────────────────────────────────
//  Login / Logout
// ──────────────────────────────────────────
window.doLogin = async function() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const errEl = document.getElementById("login-error");
  const btn   = document.getElementById("btn-login");
  if (!email || !pass) { errEl.textContent = "Preencha e-mail e senha."; errEl.style.display = "block"; return; }
  btn.disabled = true; btn.textContent = "Entrando..."; errEl.style.display = "none";
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    errEl.textContent = "E-mail ou senha incorretos."; errEl.style.display = "block";
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
};

window.doLogout = async function() { await signOut(auth); showToast("Sessão encerrada"); };

document.addEventListener("DOMContentLoaded", () => {
  ["login-email","login-pass"].forEach(id => {
    document.getElementById(id)?.addEventListener("keyup", e => { if (e.key === "Enter") doLogin(); });
  });
});


async function loadImoveis() {
  try {
    const snap   = await getDocs(query(collection(db, "imoveis"), orderBy("criadoEm", "desc")));
    imoveis      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    adminImoveis = [...imoveis];
    updateStats();
    renderAdminList(imoveis);
  } catch (err) { console.error(err); showToast("Erro ao carregar imóveis"); }
}

function updateStats() {
  document.getElementById("stat-total").textContent      = imoveis.length;
  document.getElementById("stat-venda").textContent      = imoveis.filter(i => i.negocio === "Venda").length;
  document.getElementById("stat-locacao").textContent    = imoveis.filter(i => i.negocio === "Locação").length;
  document.getElementById("stat-lancamento").textContent = imoveis.filter(i => i.negocio === "Lançamento").length;
}



function renderAdminList(lista) {
  const el = document.getElementById("admin-list");
  if (!lista.length) { el.innerHTML = `<div class="loading-msg">Nenhum imóvel cadastrado.</div>`; return; }
  el.innerHTML = lista.map(im => {
    const thumb = im.fotos && im.fotos.length ? `<img src="${im.fotos[0]}" alt="" />` : getEmojiForType(im.tipo);
    return `
      <div class="admin-row">
        <div class="admin-thumb">${thumb}</div>
        <div class="admin-row-info">
          <div class="admin-row-name">${im.titulo}</div>
          <div class="admin-row-meta">${im.negocio} · R$ ${Number(im.preco).toLocaleString("pt-BR")} · ${im.bairro}, ${im.cidade}</div>
        </div>
        <div class="admin-row-actions">
          <button class="btn-action danger" onclick="deleteImovel('${im.id}', this)">Remover</button>
        </div>
      </div>`;
  }).join("");
}

window.filterAdminList = function() {
  const q = document.getElementById("admin-search").value.toLowerCase();
  renderAdminList(adminImoveis.filter(im =>
    im.titulo.toLowerCase().includes(q) || im.cidade.toLowerCase().includes(q) || im.bairro.toLowerCase().includes(q)
  ));
};


async function uploadParaCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "casacerta/imoveis");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Falha no upload");
  const data = await res.json();
  return data.secure_url;
}


window.publishImovel = async function() {
  const negocio   = document.getElementById("f-negocio").value;
  const tipo      = document.getElementById("f-tipo").value;
  const titulo    = document.getElementById("f-titulo").value.trim();
  const desc      = document.getElementById("f-desc").value.trim();
  const preco     = parseFloat(document.getElementById("f-preco").value);
  const area      = parseFloat(document.getElementById("f-area").value);
  const quartos   = parseInt(document.getElementById("f-quartos").value);
  const banheiros = parseInt(document.getElementById("f-banheiros").value);
  const vagas     = parseInt(document.getElementById("f-vagas").value);
  const cep       = document.getElementById("f-cep").value.trim();
  const cidade    = document.getElementById("f-cidade").value.trim();
  const bairro    = document.getElementById("f-bairro").value.trim();
  const endereco  = document.getElementById("f-endereco").value.trim();
  const telefone  = document.getElementById("f-telefone").value.trim();
  const destaque  = document.getElementById("f-destaque").checked;

  if (!negocio || !tipo || !titulo || !preco || !area || !cidade || !bairro || !telefone) {
    showToast("⚠️ Preencha todos os campos obrigatórios (*)"); return;
  }

  const btn = document.getElementById("btn-publicar");
  btn.disabled = true;

  try {
    const fotosURLs = [];
    for (let i = 0; i < pendingFiles.length; i++) {
      btn.textContent = `Enviando foto ${i + 1} de ${pendingFiles.length}...`;
      fotosURLs.push(await uploadParaCloudinary(pendingFiles[i]));
    }
    btn.textContent = "Salvando...";
    await addDoc(collection(db, "imoveis"), {
      negocio, tipo, titulo, descricao: desc, preco, area, quartos, banheiros, vagas,
      cep, cidade, bairro, endereco, telefone, destaque, fotos: fotosURLs,
      criadoEm: serverTimestamp()
    });
    showToast("✅ Imóvel publicado!");
    clearForm();
    await loadImoveis();
  } catch (err) {
    console.error(err);
    showToast("Erro ao publicar. Verifique as configurações do Cloudinary.");
  } finally {
    btn.disabled = false; btn.textContent = "Publicar imóvel";
  }
};


window.deleteImovel = async function(id, btn) {
  if (!confirm("Remover este imóvel? Essa ação não pode ser desfeita.")) return;
  btn.disabled = true; btn.textContent = "Removendo...";
  try {
    await deleteDoc(doc(db, "imoveis", id));
    showToast("Imóvel removido");
    await loadImoveis();
  } catch { showToast("Erro ao remover"); btn.disabled = false; btn.textContent = "Remover"; }
};


window.handleFiles = function(event) {
  const files = Array.from(event.target.files);
  if (pendingFiles.length + files.length > 10) { showToast("Máximo de 10 fotos"); return; }
  files.forEach(file => {
    if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} excede 10MB`); return; }
    pendingFiles.push(file);
    const reader = new FileReader();
    reader.onload = e => addPreview(e.target.result, pendingFiles.length - 1);
    reader.readAsDataURL(file);
  });
  event.target.value = "";
};

function addPreview(src, index) {
  const grid = document.getElementById("preview-grid");
  const div  = document.createElement("div");
  div.className = "preview-item";
  div.innerHTML = `<img src="${src}" alt="preview" /><button class="preview-remove" onclick="removePreview(${index})">×</button>`;
  grid.appendChild(div);
}

window.removePreview = function(index) {
  pendingFiles.splice(index, 1);
  const grid = document.getElementById("preview-grid");
  grid.innerHTML = "";
  pendingFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => addPreview(e.target.result, i);
    reader.readAsDataURL(file);
  });
};


window.showTab = function(tabId, btn) {
  document.querySelectorAll(".admin-tab-content").forEach(t => t.style.display = "none");
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");
  if (tabId === "tab-lista") loadImoveis();
};

window.clearForm = function() {
  ["f-titulo","f-desc","f-preco","f-area","f-cep","f-cidade","f-bairro","f-endereco","f-telefone"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["f-negocio","f-tipo","f-quartos","f-vagas","f-banheiros"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
  document.getElementById("f-destaque").checked = false;
  document.getElementById("preview-grid").innerHTML = "";
  pendingFiles = [];
};

window.formatCEP = function(input) {
  let v = input.value.replace(/\D/g,"");
  if (v.length > 5) v = v.slice(0,5) + "-" + v.slice(5,8);
  input.value = v;
};

window.formatTel = function(input) {
  let v = input.value.replace(/\D/g,"");
  if (v.length > 10)     v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/,"($1) $2-$3");
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d*)/,"($1) $2-$3");
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d*)/,"($1) $2");
  input.value = v;
};

function getEmojiForType(tipo) {
  return {"Casa":"🏡","Comercial":"🏢","Terreno":"🌿","Apartamento":"🏠"}[tipo] || "🏠";
}

window.showToast = function(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
};
