// ===== CONFIGURAÇÕES =====
const CONFIG = {
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6FsKfgWJxQBzkKSP3ekD-Tbb7bfvGs_Df9aUT9bkv8gPL8dySYVkMmFdlajdrgxLZUs3pufrc0ZX8/pub?gid=1353948690&single=true&output=csv',
  WHATSAPP_NUMBER: '554733483186',
  PROXIES: ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?'],
  CACHE_DURATION: 3 * 60 * 1000,
  CACHE_KEY: 'natuBrava_products_cache',
  ITEMS_PER_PAGE: 60,
  SCROLL_THRESHOLD: 300,
  LOW_STOCK_THRESHOLD: 100,
  MIN_GRANEL_QUANTITY: 50
};

// Variáveis Globais
let products = [];
let filteredProducts = [];
let cart = [];
let currentFilter = 'Todos';
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let searchTimeout;

// ===== FUNÇÕES DE UTILIDADE E CACHE =====
function normalizeText(text) { return text ? text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : ''; }
function parsePrice(str) { return parseFloat(str?.toString().replace(',', '.') || 0); }
function formatPrice(num) { return num.toFixed(2).replace('.', ','); }

function getCachedProducts() {
  try {
    const cached = localStorage.getItem(CONFIG.CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < CONFIG.CACHE_DURATION) return data.products;
    }
  } catch (e) { localStorage.removeItem(CONFIG.CACHE_KEY); }
  return null;
}

function setCachedProducts(data) {
  localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ products: data, timestamp: Date.now() }));
}

function getProductStatus(product) {
  if (product.isGranel) {
    const stockGrams = product.stock * 1000;
    if (stockGrams <= 0 || stockGrams < CONFIG.MIN_GRANEL_QUANTITY) return 'out_of_stock';
    if (stockGrams < CONFIG.LOW_STOCK_THRESHOLD) return 'low_stock';
  } else {
    if (product.stock <= 0) return 'out_of_stock';
    if (product.stock === 1) return 'low_stock';
  }
  return 'available';
}

// ===== LÓGICA DE ÍCONES (NOVA) =====
function getDietaryInfo(tagsString) {
    if (!tagsString) return [];
    const tags = tagsString.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
    const infoList = [];

    tags.forEach(tag => {
        if (tag.includes('sem glúten') || tag.includes('gluten free')) {
            infoList.push({ icon: 'ban-outline', label: 'Sem Glúten', bgClass: 'bg-gluten-free' });
        } else if (tag.includes('vegano') || tag.includes('vegan')) {
            infoList.push({ icon: 'leaf-outline', label: 'Vegano', bgClass: 'bg-vegan' });
        } else if (tag.includes('sem açúcar') || tag.includes('zero açúcar')) {
            infoList.push({ icon: 'cube-outline', label: 'Sem Açúcar', bgClass: 'bg-sugar-free' });
        } else if (tag.includes('sem lactose') || tag.includes('zero lactose')) {
            infoList.push({ icon: 'water-outline', label: 'Sem Lactose', bgClass: 'bg-lactose-free' });
        }
    });
    return infoList;
}

// ===== RENDERIZAÇÃO DO CARD =====
function renderProducts() {
  const list = document.getElementById('product-list');
  const start = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
  const pageProducts = filteredProducts.slice(start, start + CONFIG.ITEMS_PER_PAGE);
  
  list.innerHTML = '';
  document.getElementById('no-products-message').style.display = pageProducts.length ? 'none' : 'block';
  
  const fragment = document.createDocumentFragment();
  
  pageProducts.forEach(p => {
    const card = document.createElement('div');
    const isGranel = p.isGranel;
    const status = p.status;
    const hasClub = p.clubPrice && p.clubPrice > 0;
    const initQty = isGranel ? 100 : 1;
    
    let cardClass = 'product-card';
    if (status === 'out_of_stock') cardClass += ' out-of-stock-card';
    
    card.className = cardClass;
    card.dataset.id = p.id;

    // Badges de Dieta
    const dietaryIcons = getDietaryInfo(p.tags).slice(0, 4).map(info => `
        <div class="dietary-icon-badge ${info.bgClass}" title="${info.label}">
            <ion-icon name="${info.icon}"></ion-icon>
        </div>
    `).join('');

    // Preço
    let priceHTML = '';
    if (hasClub && status !== 'out_of_stock') {
        priceHTML = `
            <div class="price-container">
                <span class="normal-price">De R$ ${formatPrice(isGranel ? p.price * 100 : p.price)}</span>
                <div class="club-price-container">
                    <span class="club-badge">CLUB</span>
                    <span class="club-price">R$ ${formatPrice(isGranel ? p.clubPrice * 100 : p.clubPrice)}${isGranel ? '/100g' : ''}</span>
                </div>
            </div>`;
    } else {
        priceHTML = `<div class="price-container"><span class="text-lg font-bold text-green-700">R$ ${formatPrice(isGranel ? p.price * 100 : p.price)}${isGranel ? '/100g' : ''}</span></div>`;
    }

    // Ações (Botões)
    let actionsHTML = '';
    if (status === 'out_of_stock') {
        actionsHTML = `<button class="notify-me-btn" onclick="openNotifyModal(${p.id})">Avise-me</button>`;
    } else {
        const min = isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1;
        actionsHTML = `
            <div class="product-actions">
                <button class="product-quantity-change" data-change="-1" ${initQty <= min ? 'disabled' : ''}><ion-icon name="remove-outline"></ion-icon></button>
                <span class="product-quantity font-bold text-gray-800 w-12 text-center">${isGranel ? initQty+'g' : initQty}</span>
                <button class="product-quantity-change" data-change="1"><ion-icon name="add-outline"></ion-icon></button>
                <button class="add-to-cart-btn"><ion-icon name="cart-outline"></ion-icon> Add</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="product-image-container">
            <button class="info-btn"><ion-icon name="eye-outline"></ion-icon> Ver Detalhes</button>
            <img src="${p.image}" class="product-image ${status === 'out_of_stock' ? 'grayscale' : ''}" loading="lazy" onerror="this.src='https://placehold.co/300x200?text=Sem+Foto'">
            ${status === 'out_of_stock' ? '<span class="status-badge out-of-stock-badge">Esgotado</span>' : ''}
        </div>
        <div class="product-card-content">
            <h3 class="font-semibold text-gray-800">${p.name}</h3>
            <p class="text-xs text-gray-500 mb-1">Cód: ${p.sku}</p>
            <div class="dietary-icons-row">${dietaryIcons}</div>
            ${priceHTML}
            ${actionsHTML}
        </div>
    `;
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
  renderPagination();
}

// ===== MODAL DE DETALHES (ATUALIZADO) =====
function openProductDetails(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    // Preencher Infos
    document.getElementById('detail-image').src = p.image;
    document.getElementById('detail-name').textContent = p.name;
    document.getElementById('detail-name-mobile').textContent = p.name; // Mobile
    document.getElementById('detail-sku').textContent = p.sku;
    document.getElementById('detail-sku-mobile').textContent = `Cód: ${p.sku}`; // Mobile
    document.getElementById('detail-category').textContent = p.category;

    // Tags (Pílulas)
    const tagsHTML = getDietaryInfo(p.tags).map(info => 
        `<span class="modal-tag-badge ${info.bgClass}"><ion-icon name="${info.icon}"></ion-icon> ${info.label}</span>`
    ).join('');
    document.getElementById('detail-tags-container').innerHTML = tagsHTML;

    // Preço (Informativo apenas)
    const isGranel = p.isGranel;
    const hasClub = p.clubPrice && p.clubPrice > 0;
    const priceDisplay = isGranel ? (p.price * 100) : p.price;
    const clubDisplay = isGranel ? (p.clubPrice * 100) : p.clubPrice;
    
    let priceHTML = '';
    if (hasClub) {
        priceHTML = `
            <div class="flex flex-col">
                <span class="text-sm text-gray-500 line-through">De R$ ${formatPrice(priceDisplay)}</span>
                <span class="text-2xl font-bold text-green-700">R$ ${formatPrice(clubDisplay)} <span class="text-xs bg-green-600 text-white px-2 py-1 rounded">CLUB</span></span>
            </div>`;
    } else {
        priceHTML = `<span class="text-2xl font-bold text-green-700">R$ ${formatPrice(priceDisplay)}</span>`;
    }
    document.getElementById('detail-price-container').innerHTML = priceHTML + (isGranel ? '<span class="text-xs text-gray-500 block mt-1">Valor referente a 100g</span>' : '');

    // Ingredientes
    const ingEl = document.getElementById('detail-ingredients');
    ingEl.innerHTML = p.ingredients ? p.ingredients : '<p class="italic text-gray-400">Informações detalhadas não disponíveis.</p>';

    // Abrir
    const modal = document.getElementById('product-details-modal-overlay');
    modal.classList.add('open');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// ===== CARREGAMENTO =====
async function loadProducts() {
    if (isLoading) return;
    isLoading = true;
    
    const cached = getCachedProducts();
    if (cached) {
        products = cached;
        finishLoad();
        loadFromSheet(true);
        return;
    }
    await loadFromSheet(false);
}

async function loadFromSheet(bg = false) {
    try {
        if (!bg) document.getElementById('loading-status').style.display = 'block';
        
        let res;
        try { res = await fetch(CONFIG.SHEET_CSV_URL); } 
        catch { res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(CONFIG.SHEET_CSV_URL)); }
        
        const txt = await res.text();
        const lines = txt.trim().split('\n').map(l => l.trim());
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        
        products = lines.slice(1).map((line, idx) => {
             // Parse CSV simples ignorando virgulas dentro de aspas
             const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
             const obj = {};
             headers.forEach((h, i) => obj[h] = vals[i] || '');
             
             const isGranel = (obj.CATEGORIA||'').toUpperCase() === 'GRANEL';
             const price = parsePrice(obj.PRECO);
             const clubPrice = parsePrice(obj.CLUB_VLR || obj.VLR_CLUB || '0');
             
             return {
                 id: idx + 1,
                 sku: obj.SKU || `ID${idx}`,
                 name: obj.NOME_SITE || 'Produto',
                 category: obj.CATEGORIA || 'Geral',
                 image: obj.URL_FOTO || '',
                 price: isGranel ? price/1000 : price,
                 clubPrice: (clubPrice > 0) ? (isGranel ? clubPrice/1000 : clubPrice) : null,
                 stock: parsePrice(obj.ESTOQUE),
                 isGranel: isGranel,
                 ingredients: obj.INGREDIENTES || '',
                 tags: obj.TAGS || '',
                 status: 'available' // Será atualizado
             };
        }).filter(p => p.price > 0);

        products.forEach(p => p.status = getProductStatus(p));
        setCachedProducts(products);
        finishLoad();
    } catch (e) {
        console.error(e);
        if(!bg) document.getElementById('error-section').style.display = 'block';
    } finally { isLoading = false; }
}

function finishLoad() {
    document.getElementById('loading-status').style.display = 'none';
    document.getElementById('produtos').style.display = 'block';
    renderFilters();
    applyFilters();
}

function renderFilters() {
    const cats = ['Todos', ...new Set(products.map(p => p.category))];
    const container = document.getElementById('category-filters');
    container.innerHTML = cats.map(c => `
        <button class="category-btn ${c === currentFilter ? 'active' : ''}" onclick="setFilter('${c}')">
            ${c}
        </button>
    `).join('');
}

window.setFilter = (cat) => {
    currentFilter = cat;
    applyFilters();
    renderFilters();
};

function applyFilters() {
    const term = normalizeText(document.getElementById('search-box').value);
    filteredProducts = products.filter(p => {
        const matchSearch = term ? normalizeText(p.name + p.sku).includes(term) : true;
        const matchCat = currentFilter === 'Todos' || p.category === currentFilter;
        return matchSearch && matchCat;
    });
    currentPage = 1;
    renderProducts();
}

function renderPagination() {
    // Código básico de paginação se necessário, mas para simplificar aqui vamos mostrar tudo em scroll ou simples
    // Se quiser paginação completa, avise. Por enquanto, limpo para não dar erro.
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    
    // Busca
    document.getElementById('search-box').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    // Clique no Produto (Delegação de Eventos)
    document.getElementById('product-list').addEventListener('click', e => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const id = parseInt(card.dataset.id);

        // Se clicou na imagem, no botão detalhes ou no título
        if (e.target.closest('.product-image-container') || e.target.closest('.info-btn')) {
            openProductDetails(id);
            return;
        }

        // Se clicou em Adicionar
        if (e.target.closest('.add-to-cart-btn')) {
            const qtySpan = card.querySelector('.product-quantity');
            const qty = parseInt(qtySpan.innerText.replace('g', ''));
            addToCart(id, qty);
        }

        // Mudar Quantidade
        if (e.target.closest('.product-quantity-change')) {
            const btn = e.target.closest('.product-quantity-change');
            const change = parseInt(btn.dataset.change);
            const qtySpan = card.querySelector('.product-quantity');
            const p = products.find(prod => prod.id === id);
            const step = p.isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1;
            let val = parseInt(qtySpan.innerText.replace('g', '')) + (change * step);
            if (val >= step) qtySpan.innerText = p.isGranel ? val + 'g' : val;
        }
    });

    // Fechar Modais
    document.querySelectorAll('[id$="-overlay"]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el) el.classList.remove('open');
        });
    });
    
    document.getElementById('close-details-modal-button').addEventListener('click', () => {
        document.getElementById('product-details-modal-overlay').classList.remove('open');
    });

    // Carrinho Toggle
    const toggleCart = () => {
        document.getElementById('cart-panel').classList.toggle('open');
        document.getElementById('cart-overlay').classList.toggle('open');
    };
    document.getElementById('cart-button').onclick = toggleCart;
    document.getElementById('cart-button-mobile').onclick = toggleCart;
    document.getElementById('close-cart-button').onclick = toggleCart;
});

// ===== CARRINHO (SIMPLIFICADO) =====
function addToCart(id, qty) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    
    const exist = cart.find(x => x.id === id);
    if (exist) exist.qty += qty;
    else cart.push({ ...p, qty });
    
    updateCartUI();
    // Efeito Visual
    const btn = document.getElementById('cart-button');
    btn.classList.add('scale-125');
    setTimeout(() => btn.classList.remove('scale-125'), 200);
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    container.innerHTML = cart.map(item => `
        <div class="flex justify-between items-center border-b pb-2">
            <div>
                <p class="font-bold text-sm">${item.name}</p>
                <p class="text-xs text-gray-500">${item.isGranel ? item.qty+'g' : item.qty+' un'}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-green-700">R$ ${formatPrice(item.price * item.qty)}</p>
                <button onclick="removeFromCart(${item.id})" class="text-red-500 text-xs">Remover</button>
            </div>
        </div>
    `).join('');
    
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    document.getElementById('cart-total').innerText = 'R$ ' + formatPrice(total);
    document.getElementById('cart-count').innerText = cart.length;
    document.getElementById('cart-count-mobile').innerText = cart.length;
    document.getElementById('checkout-button').disabled = cart.length === 0;
}

window.removeFromCart = (id) => {
    cart = cart.filter(x => x.id !== id);
    updateCartUI();
};

window.openNotifyModal = (id) => {
    const p = products.find(x => x.id === id);
    document.getElementById('notify-product-name').innerText = p.name;
    document.getElementById('notify-modal-overlay').classList.add('open');
};
