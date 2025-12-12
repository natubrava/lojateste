/**
 * NATUBRAVA CATALOG SYSTEM - VERSÃO CORRIGIDA UX/UI
 * Foco: Ícones na vitrine e Modal Otimizado Mobile
 */

const CONFIG = {
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6FsKfgWJxQBzkKSP3ekD-Tbb7bfvGs_Df9aUT9bkv8gPL8dySYVkMmFdlajdrgxLZUs3pufrc0ZX8/pub?gid=1353948690&single=true&output=csv',
  WHATSAPP: '554733483186',
  PROXIES: ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?'],
  CACHE_KEY: 'nb_products_v3',
  CACHE_TIME: 5 * 60 * 1000, // 5 min
  ITEMS_PER_PAGE: 40
};

// --- ESTADO GLOBAL ---
let state = {
  products: [],
  filtered: [],
  cart: JSON.parse(localStorage.getItem('nb_cart')) || [],
  currentPage: 1,
  currentCategory: 'Todos',
  isLoading: false
};

// --- ELEMENTOS DOM ---
const $ = (id) => document.getElementById(id);
const els = {
  list: $('product-list'),
  loading: $('loading-status'),
  section: $('produtos'),
  search: $('search-box'),
  cats: $('category-filters'),
  counter: $('product-counter'),
  pagination: $('pagination'),
  error: $('error-section'),
  errDetails: $('error-details'),
  retry: $('retry-button'),
  
  // Cart
  cartBtn: $('cart-button'),
  cartBtnMob: $('cart-button-mobile'),
  cartPanel: $('cart-panel'),
  cartOverlay: $('cart-overlay'),
  cartItems: $('cart-items'),
  cartTotal: $('cart-total'),
  cartCount: $('cart-count'),
  cartCountMob: $('cart-count-mobile'),
  closeCart: $('close-cart-button'),
  checkout: $('checkout-button'),
  
  // Modais
  detailsModal: $('product-details-modal'),
  detailsOverlay: $('product-details-modal-overlay'),
  closeDetails: $('close-details-modal-button'),
  
  nameModal: $('name-modal'),
  nameOverlay: $('name-modal-overlay'),
  confirmCheckout: $('confirm-checkout-button'),
  cancelCheckout: $('cancel-checkout-button'),
  
  clubInfoBtn: $('club-info-button'),
  clubOverlay: $('club-info-modal-overlay'),
  closeClub: $('close-club-modal-button')
};

// --- SISTEMA DE DADOS ---

async function init() {
  renderCart();
  try {
    const cached = localStorage.getItem(CONFIG.CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.ts < CONFIG.CACHE_TIME) {
        state.products = data.items;
        finalizeLoad();
        // Background refresh
        fetchProducts(true);
        return;
      }
    }
    await fetchProducts();
  } catch (e) {
    showError(e.message);
  }
}

async function fetchProducts(isBackground = false) {
  if (!isBackground) state.isLoading = true;
  
  let csvText = null;
  let lastError = null;

  for (const proxy of CONFIG.PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(CONFIG.CSV_URL));
      if (res.ok) {
        csvText = await res.text();
        break;
      }
    } catch (e) {
      lastError = e;
      console.warn(`Proxy falhou: ${proxy}`);
    }
  }

  if (!csvText) {
    if (!isBackground) throw new Error('Não foi possível carregar a planilha. Verifique sua conexão.');
    return;
  }

  const items = parseCSV(csvText);
  if (items.length === 0 && !isBackground) throw new Error('A planilha parece estar vazia.');

  state.products = items;
  localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
  
  if (!isBackground) finalizeLoad();
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toUpperCase().replace(/"/g, ''));
  
  // Map columns dynamic
  const map = {
    sku: headers.indexOf('SKU'),
    name: headers.indexOf('NOME_SITE'),
    price: headers.indexOf('PRECO'),
    stock: headers.indexOf('ESTOQUE'),
    cat: headers.indexOf('CATEGORIA'),
    img: headers.indexOf('URL_FOTO'),
    club: headers.find(h => h.includes('CLUB')) ? headers.indexOf(headers.find(h => h.includes('CLUB'))) : -1,
    tags: headers.indexOf('TAGS'),
    ingredients: headers.indexOf('INGREDIENTES')
  };

  return lines.slice(1).map((line, i) => {
    // Regex complexo para lidar com vírgulas dentro de aspas no CSV
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    
    if (!cols[map.sku] || !cols[map.name]) return null;

    const price = parseFloat(cols[map.price]?.replace(',', '.') || 0);
    const stock = parseFloat(cols[map.stock]?.replace(',', '.') || 0);
    const clubPrice = map.club > -1 ? parseFloat(cols[map.club]?.replace(',', '.') || 0) : 0;
    const cat = cols[map.cat] || 'Geral';
    const isGranel = cat.toUpperCase() === 'GRANEL';

    return {
      id: i,
      sku: cols[map.sku],
      name: cols[map.name],
      cat: cat,
      price: isGranel ? price / 1000 : price, // Base price unitário (g ou un)
      clubPrice: (clubPrice > 0) ? (isGranel ? clubPrice / 1000 : clubPrice) : null,
      stock: stock,
      isGranel: isGranel,
      img: cols[map.img],
      tags: cols[map.tags] || '',
      ingredients: cols[map.ingredients] || '',
      // Granel step: 100g. Unitário: 1
      step: isGranel ? 100 : 1,
      min: isGranel ? 50 : 1
    };
  }).filter(Boolean);
}

function finalizeLoad() {
  els.loading.style.display = 'none';
  els.section.style.display = 'block';
  renderCategories();
  applyFilters();
}

// --- RENDERIZAÇÃO DA VITRINE ---

function generateDietIcons(tagsString) {
  if (!tagsString) return '';
  const tags = tagsString.toLowerCase();
  let html = '';

  // Regras de negócio para ícones
  if (tags.includes('glúten') && (tags.includes('sem') || tags.includes('nao') || tags.includes('não'))) {
    html += `<div class="diet-icon-badge diet-gluten-free" title="Sem Glúten"><ion-icon name="ban-outline"></ion-icon></div>`;
  }
  if (tags.includes('vegano') || tags.includes('vegana')) {
    html += `<div class="diet-icon-badge diet-vegan" title="Vegano"><ion-icon name="leaf-outline"></ion-icon></div>`;
  }
  if (tags.includes('açúcar') && (tags.includes('sem') || tags.includes('zero'))) {
    html += `<div class="diet-icon-badge diet-sugar-free" title="Sem Açúcar"><ion-icon name="cube-outline"></ion-icon></div>`;
  }
  if (tags.includes('lactose') && (tags.includes('sem') || tags.includes('zero'))) {
    html += `<div class="diet-icon-badge diet-lactose-free" title="Sem Lactose"><ion-icon name="water-outline"></ion-icon></div>`;
  }
  
  return html ? `<div class="diet-icons-row">${html}</div>` : '';
}

function renderProducts() {
  const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
  const pageItems = state.filtered.slice(start, start + CONFIG.ITEMS_PER_PAGE);
  
  els.list.innerHTML = pageItems.map(p => {
    const hasClub = p.clubPrice && p.clubPrice < p.price;
    const priceDisplay = p.isGranel ? p.price * 100 : p.price; // Mostra por 100g ou Un
    const clubDisplay = p.isGranel ? p.clubPrice * 100 : p.clubPrice;
    
    // Fallback Image
    const imgUrl = p.img && p.img.length > 5 ? p.img : `https://placehold.co/300x300/e2e8f0/1e293b?text=${p.sku}`;
    
    return `
      <div class="product-card bg-white rounded-xl overflow-hidden fade-in-up group relative">
        <div class="card-image-wrapper cursor-pointer" onclick="openDetails(${p.id})">
          <img src="${imgUrl}" alt="${p.name}" loading="lazy" onerror="this.src='https://placehold.co/300x300/fee2e2/ef4444?text=Sem+Foto'">
          
          <!-- Botão Detalhes (Olho) -->
          <div class="details-overlay-btn">
            <ion-icon name="eye-outline"></ion-icon> Detalhes
          </div>
        </div>

        <div class="p-4 flex flex-col flex-1">
          <!-- Ícones de Dieta (Visíveis) -->
          ${generateDietIcons(p.tags)}

          <div class="text-xs text-gray-500 mb-1">${p.sku} | ${p.cat}</div>
          <h3 class="font-bold text-gray-800 text-sm md:text-base leading-snug mb-2 flex-1 cursor-pointer hover:text-green-700" onclick="openDetails(${p.id})">${p.name}</h3>
          
          <div class="mt-auto pt-3 border-t border-gray-100">
            <div class="flex justify-between items-end mb-3">
              <div class="flex flex-col">
                ${hasClub ? `
                  <span class="text-xs text-gray-400 line-through">R$ ${formatMoney(priceDisplay)}</span>
                  <div class="flex items-center gap-1">
                     <span class="text-green-700 font-bold text-lg">R$ ${formatMoney(clubDisplay)}</span>
                     <ion-icon name="star" class="text-yellow-400 text-xs"></ion-icon>
                  </div>
                ` : `
                  <span class="text-green-700 font-bold text-lg">R$ ${formatMoney(priceDisplay)}</span>
                `}
                <span class="text-[10px] text-gray-400">${p.isGranel ? 'Preço por 100g' : 'Unidade'}</span>
              </div>
            </div>

            <!-- Controles de Compra -->
            <div class="flex items-center gap-2">
              <div class="flex items-center border border-gray-300 rounded-lg h-9 bg-gray-50">
                 <button class="px-2 text-gray-600 hover:text-green-700" onclick="updateCardQty(${p.id}, -1)">-</button>
                 <input type="text" id="qty-${p.id}" value="${p.step}${p.isGranel ? 'g' : ''}" class="w-12 text-center bg-transparent border-none text-xs font-semibold focus:ring-0 p-0" readonly data-val="${p.step}">
                 <button class="px-2 text-gray-600 hover:text-green-700" onclick="updateCardQty(${p.id}, 1)">+</button>
              </div>
              <button class="flex-1 bg-green-600 hover:bg-green-700 text-white h-9 rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition shadow-sm active:scale-95" onclick="addCart(${p.id})">
                <ion-icon name="cart-outline"></ion-icon> Comprar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  $('no-products-message').style.display = pageItems.length === 0 ? 'block' : 'none';
  renderPagination();
  els.counter.innerText = `Exibindo ${pageItems.length} de ${state.filtered.length} produtos`;
}

// --- LÓGICA DE DETALHES (MODAL) ---

function openDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  // Imagem
  const img = $('detail-image');
  img.src = p.img || '';
  img.onerror = () => { img.src = `https://placehold.co/300x300/e2e8f0/1e293b?text=${p.sku}`; };

  $('detail-name').innerText = p.name;
  $('detail-sku').innerText = p.sku;
  $('detail-category').innerText = p.cat;

  // Preço Modal
  const hasClub = p.clubPrice && p.clubPrice < p.price;
  const priceDisplay = p.isGranel ? p.price * 100 : p.price;
  const clubDisplay = p.isGranel ? p.clubPrice * 100 : p.clubPrice;
  const unitLabel = p.isGranel ? '/ 100g' : '';

  let priceHtml = '';
  if (hasClub) {
    priceHtml = `
      <div class="flex flex-col">
        <span class="text-xs text-gray-500 line-through">De: R$ ${formatMoney(priceDisplay)}</span>
        <div class="flex items-center gap-2">
            <span class="text-2xl font-bold text-green-700">R$ ${formatMoney(clubDisplay)}${unitLabel}</span>
            <span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                <ion-icon name="star"></ion-icon> CLUB
            </span>
        </div>
      </div>`;
  } else {
    priceHtml = `<span class="text-2xl font-bold text-green-700">R$ ${formatMoney(priceDisplay)}${unitLabel}</span>`;
  }
  $('detail-price-container').innerHTML = priceHtml;

  // Tags (Texto badges)
  const tagContainer = $('detail-tags-container');
  tagContainer.innerHTML = '';
  if (p.tags) {
    p.tags.split(',').forEach(tag => {
        const span = document.createElement('span');
        span.className = 'bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded uppercase font-semibold border border-gray-200';
        span.innerText = tag.trim();
        tagContainer.appendChild(span);
    });
  }

  // Ingredientes
  const ingElem = $('detail-ingredients');
  const msgElem = $('no-ingredients-msg');
  if (p.ingredients && p.ingredients.length > 2) {
    ingElem.innerText = p.ingredients;
    ingElem.classList.remove('hidden');
    msgElem.classList.add('hidden');
  } else {
    ingElem.classList.add('hidden');
    msgElem.classList.remove('hidden');
  }

  // Animação de entrada
  els.detailsOverlay.classList.remove('hidden');
  els.detailsOverlay.classList.add('flex'); // Garante display flex
  setTimeout(() => {
    els.detailsOverlay.classList.add('opacity-100');
    els.detailsModal.classList.remove('scale-95', 'opacity-0');
    els.detailsModal.classList.add('scale-100', 'opacity-100');
  }, 10);
  
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  els.detailsModal.classList.remove('scale-100', 'opacity-100');
  els.detailsModal.classList.add('scale-95', 'opacity-0');
  els.detailsOverlay.classList.remove('opacity-100');
  
  setTimeout(() => {
    els.detailsOverlay.classList.add('hidden');
    els.detailsOverlay.classList.remove('flex');
    document.body.style.overflow = '';
  }, 300);
}

// --- CARRINHO & CHECKOUT ---

function addCart(id) {
  const p = state.products.find(x => x.id === id);
  const input = $(`qty-${id}`);
  const qty = parseInt(input.dataset.val);

  const existing = state.cart.find(x => x.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ ...p, qty });
  }

  saveCart();
  renderCart();
  
  // Feedback visual
  const btn = input.parentElement.nextElementSibling;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<ion-icon name="checkmark-circle"></ion-icon> Adicionado!`;
  btn.classList.add('bg-green-800');
  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.classList.remove('bg-green-800');
  }, 1500);
  
  // Reset input
  input.dataset.val = p.step;
  input.value = `${p.step}${p.isGranel ? 'g' : ''}`;
}

function updateCardQty(id, dir) {
  const p = state.products.find(x => x.id === id);
  const input = $(`qty-${id}`);
  let val = parseInt(input.dataset.val);
  
  val += (dir * p.step);
  if (val < p.min) val = p.min;
  
  input.dataset.val = val;
  input.value = `${val}${p.isGranel ? 'g' : ''}`;
}

function renderCart() {
  const count = state.cart.length;
  els.cartCount.innerText = count;
  els.cartCountMob.innerText = count;
  
  let total = 0;
  els.cartItems.innerHTML = state.cart.map((item, idx) => {
    // Cálculo de preço: se item.clubPrice existe, usa. Senão item.price.
    // O preço armazenado em 'item.price' no array products já é base (por 1g se granel).
    // Mas vamos recalcular aqui pra garantir.
    const priceToUse = (item.clubPrice && item.clubPrice < item.price) ? item.clubPrice : item.price;
    const itemTotal = priceToUse * item.qty;
    total += itemTotal;
    
    return `
      <div class="flex items-start gap-3 border-b border-gray-100 pb-3">
        <div class="flex-1">
          <h4 class="font-medium text-sm text-gray-800 line-clamp-2">${item.name}</h4>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-gray-500">${item.isGranel ? item.qty + 'g' : item.qty + ' un'}</span>
            <span class="font-bold text-green-700 text-sm">R$ ${formatMoney(itemTotal)}</span>
          </div>
        </div>
        <button onclick="removeItem(${idx})" class="text-red-400 hover:text-red-600 p-1">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    `;
  }).join('') || '<div class="text-center text-gray-400 mt-10"><ion-icon name="basket-outline" class="text-4xl"></ion-icon><p>Carrinho vazio</p></div>';

  els.cartTotal.innerText = `R$ ${formatMoney(total)}`;
  els.checkout.disabled = count === 0;
}

function removeItem(idx) {
  state.cart.splice(idx, 1);
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem('nb_cart', JSON.stringify(state.cart));
}

// --- CHECKOUT WHATSAPP ---

function startCheckout() {
  els.nameOverlay.classList.remove('hidden');
  els.nameOverlay.classList.add('flex');
}

function finishCheckout() {
  const name = $('client-name').value.trim();
  const obs = $('client-observation').value.trim();
  
  if (!name) {
    $('name-error').classList.remove('hidden');
    return;
  }

  let msg = `*NOVO PEDIDO - NATUBRAVA*\n`;
  msg += `👤 Cliente: *${name}*\n`;
  if (obs) msg += `📝 Obs: ${obs}\n`;
  msg += `--------------------------------\n`;

  let total = 0;
  state.cart.forEach(item => {
    const price = (item.clubPrice && item.clubPrice < item.price) ? item.clubPrice : item.price;
    const sub = price * item.qty;
    total += sub;
    msg += `• ${item.name}\n   ${item.isGranel ? item.qty+'g' : item.qty+'un'} x R$${formatMoney(price * (item.isGranel ? 1000 : 1))}/${item.isGranel ? 'kg' : 'un'} = R$ ${formatMoney(sub)}\n`;
  });

  msg += `--------------------------------\n`;
  msg += `*TOTAL ESTIMADO: R$ ${formatMoney(total)}*\n\n`;
  msg += `Olá! Gostaria de confirmar disponibilidade e valores.`;

  const link = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(msg)}`;
  window.open(link, '_blank');
  
  // Limpar e fechar
  state.cart = [];
  saveCart();
  renderCart();
  closeCart();
  $('name-modal-overlay').classList.add('hidden');
  $('name-modal-overlay').classList.remove('flex');
}

// --- FILTROS & CATEGORIAS ---

function renderCategories() {
  const cats = ['Todos', ...new Set(state.products.map(p => p.cat))].sort();
  els.cats.innerHTML = cats.map(c => `
    <button class="cat-btn px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-600 hover:bg-green-50 hover:text-green-700 ${c === 'Todos' ? 'active' : ''}" onclick="filterCat('${c}')">
      ${c}
    </button>
  `).join('');
}

function filterCat(cat) {
  state.currentCategory = cat;
  state.currentPage = 1;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.innerText === cat);
  });
  applyFilters();
}

function applyFilters() {
  const term = els.search.value.toLowerCase();
  
  state.filtered = state.products.filter(p => {
    const matchCat = state.currentCategory === 'Todos' || p.cat === state.currentCategory;
    const matchSearch = p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
    return matchCat && matchSearch;
  });

  state.currentPage = 1;
  renderProducts();
}

function renderPagination() {
  const totalPages = Math.ceil(state.filtered.length / CONFIG.ITEMS_PER_PAGE);
  if (totalPages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  let html = '';
  // Prev
  html += `<button class="p-2 border rounded hover:bg-gray-100 disabled:opacity-50" ${state.currentPage === 1 ? 'disabled' : ''} onclick="changePage(-1)"><ion-icon name="chevron-back"></ion-icon></button>`;
  
  // Current info
  html += `<span class="px-4 text-sm font-medium">Pág ${state.currentPage} de ${totalPages}</span>`;
  
  // Next
  html += `<button class="p-2 border rounded hover:bg-gray-100 disabled:opacity-50" ${state.currentPage === totalPages ? 'disabled' : ''} onclick="changePage(1)"><ion-icon name="chevron-forward"></ion-icon></button>`;
  
  els.pagination.innerHTML = html;
}

function changePage(dir) {
  state.currentPage += dir;
  renderProducts();
  els.section.scrollIntoView({ behavior: 'smooth' });
}

// --- UTILITÁRIOS ---

function formatMoney(val) {
  return val.toFixed(2).replace('.', ',');
}

function showError(msg) {
  els.loading.style.display = 'none';
  els.section.style.display = 'none';
  els.error.classList.remove('hidden');
  els.errDetails.innerText = msg;
}

function closeCart() {
  els.cartOverlay.classList.remove('open');
  els.cartPanel.classList.remove('open');
}

// --- EVENT LISTENERS ---

els.search.addEventListener('input', () => { applyFilters(); });
els.retry.addEventListener('click', () => { location.reload(); });

// Cart Toggles
[els.cartBtn, els.cartBtnMob].forEach(b => b.addEventListener('click', () => {
  els.cartOverlay.classList.add('open');
  els.cartPanel.classList.add('open');
}));
els.closeCart.addEventListener('click', closeCart);
els.cartOverlay.addEventListener('click', (e) => { if(e.target === els.cartOverlay) closeCart(); });

// Checkout
els.checkout.addEventListener('click', startCheckout);
els.cancelCheckout.addEventListener('click', () => $('name-modal-overlay').classList.add('hidden'));
els.confirmCheckout.addEventListener('click', finishCheckout);

// Club Info
els.clubInfoBtn.addEventListener('click', () => { els.clubOverlay.classList.remove('hidden'); els.clubOverlay.classList.add('flex'); });
els.closeClub.addEventListener('click', () => { els.clubOverlay.classList.add('hidden'); els.clubOverlay.classList.remove('flex'); });
els.clubOverlay.addEventListener('click', (e) => { if(e.target === els.clubOverlay) els.closeClub.click(); });

// Details Modal
els.closeDetails.addEventListener('click', closeDetailsModal);
els.detailsOverlay.addEventListener('click', (e) => { if(e.target === els.detailsOverlay) closeDetailsModal(); });

// Back to Top
window.addEventListener('scroll', () => {
  const btn = $('back-to-top');
  if (window.scrollY > 300) {
    btn.classList.remove('translate-y-20', 'opacity-0');
  } else {
    btn.classList.add('translate-y-20', 'opacity-0');
  }
});
$('back-to-top').addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));

// Init
init();
