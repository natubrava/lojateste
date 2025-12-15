{
type: uploaded file
fileName: script.js
fullContent:
// ===== CONFIGURAÇÕES =====
const CONFIG = {
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6FsKfgWJxQBzkKSP3ekD-Tbb7bfvGs_Df9aUT9bkv8gPL8dySYVkMmFdlajdrgxLZUs3pufrc0ZX8/pub?gid=1353948690&single=true&output=csv',
  WHATSAPP_NUMBER: '554733483186',
  PROXIES: [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
  ],
  CACHE_DURATION: 3 * 60 * 1000, // 3 minutos
  CACHE_KEY: 'natuBrava_products_cache',
  ITEMS_PER_PAGE: 60,
  SCROLL_THRESHOLD: 300,
  LOW_STOCK_THRESHOLD: 100, // Gramas - estoque baixo para granel
  MIN_GRANEL_QUANTITY: 50 // Quantidade mínima para granel
};

// ===== FUNÇÕES DE CACHE OTIMIZADAS =====
function getCachedProducts() {
  try {
    const cached = localStorage.getItem(CONFIG.CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < CONFIG.CACHE_DURATION) {
        return data.products;
      }
    }
  } catch (error) {
    localStorage.removeItem(CONFIG.CACHE_KEY);
  }
  return null;
}

function setCachedProducts(products) {
  try {
    const cacheData = {
      products: products,
      timestamp: Date.now()
    };
    localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Erro ao salvar cache de produtos:', error);
  }
}

// ===== FUNÇÕES DE PERSISTÊNCIA DO CARRINHO =====
function saveCartToLocalStorage() {
  try {
    const cartData = {
      items: cart,
      timestamp: Date.now(),
      version: '2.1'
    };
    localStorage.setItem('natuBravaCart', JSON.stringify(cartData));
  } catch (error) {
    console.error('Erro ao salvar carrinho:', error);
  }
}

function loadCartFromLocalStorage() {
  try {
    const savedData = localStorage.getItem('natuBravaCart');
    if (!savedData) return [];
    
    const cartData = JSON.parse(savedData);
    
    if (Array.isArray(cartData)) {
      return cartData;
    }
    
    if (cartData.items && Array.isArray(cartData.items)) {
      const daysSinceLastSave = (Date.now() - (cartData.timestamp || 0)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSave > 7) {
        localStorage.removeItem('natuBravaCart');
        return [];
      }
      return cartData.items;
    }
    
    return [];
  } catch (error) {
    localStorage.removeItem('natuBravaCart');
    return [];
  }
}

// ===== FETCH OTIMIZADO COM PROXIES =====
async function fetchWithProxy(url) {
  const errors = [];
  
  for (const proxy of CONFIG.PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        headers: {
          'Accept': 'text/csv,text/plain,*/*'
        }
      });
      
      if (response.ok) {
        return response;
      }
      
      errors.push(`Proxy ${proxy}: Status ${response.status}`);
    } catch (error) {
      errors.push(`Proxy ${proxy}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`Todos os proxies falharam: ${errors.join(', ')}`);
}

// ===== ESTADO GLOBAL =====
let products = [];
let filteredProducts = [];
let cart = [];
let currentFilter = 'Todos';
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let searchTimeout;

// ===== ELEMENTOS DOM (CACHE) =====
const elements = {
  loadingStatus: document.getElementById('loading-status'),
  produtosSection: document.getElementById('produtos'),
  errorSection: document.getElementById('error-section'),
  errorDetails: document.getElementById('error-details'),
  retryButton: document.getElementById('retry-button'),
  productList: document.getElementById('product-list'),
  categoryFilters: document.getElementById('category-filters'),
  noProductsMessage: document.getElementById('no-products-message'),
  cartButton: document.getElementById('cart-button'),
  cartButtonMobile: document.getElementById('cart-button-mobile'),
  closeCartButton: document.getElementById('close-cart-button'),
  cartPanel: document.getElementById('cart-panel'),
  cartOverlay: document.getElementById('cart-overlay'),
  cartItems: document.getElementById('cart-items'),
  cartCount: document.getElementById('cart-count'),
  cartCountMobile: document.getElementById('cart-count-mobile'),
  cartTotal: document.getElementById('cart-total'),
  checkoutButton: document.getElementById('checkout-button'),
  cartEmptyMessage: document.getElementById('cart-empty-message'),
  currentYear: document.getElementById('current-year'),
  searchBox: document.getElementById('search-box'),
  nameModalOverlay: document.getElementById('name-modal-overlay'),
  nameModal: document.getElementById('name-modal'),
  clientNameInput: document.getElementById('client-name'),
  clientObservation: document.getElementById('client-observation'),
  nameError: document.getElementById('name-error'),
  confirmCheckoutButton: document.getElementById('confirm-checkout-button'),
  cancelCheckoutButton: document.getElementById('cancel-checkout-button'),
  deliveryInfoButton: document.getElementById('delivery-info-button'),
  deliveryModalOverlay: document.getElementById('delivery-modal-overlay'),
  closeDeliveryModalButton: document.getElementById('close-delivery-modal-button'),
  okDeliveryModalButton: document.getElementById('ok-delivery-modal-button'),
  clubInfoButton: document.getElementById('club-info-button'),
  clubInfoModalOverlay: document.getElementById('club-info-modal-overlay'),
  closeClubModalButton: document.getElementById('close-club-modal-button'),
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  clubInfoButtonMobile: document.getElementById('club-info-button-mobile'),
  deliveryInfoButtonMobile: document.getElementById('delivery-info-button-mobile'),
  pagination: document.getElementById('pagination'),
  productCounter: document.getElementById('product-counter'),
  backToTop: document.getElementById('back-to-top'),
  searchResults: document.getElementById('search-results'),
  notifyModalOverlay: document.getElementById('notify-modal-overlay'),
  notifyModal: document.getElementById('notify-modal'),
  clientNotifyName: document.getElementById('client-notify-name'),
  clientNotifyPhone: document.getElementById('client-notify-phone'),
  clientNotifyObservation: document.getElementById('client-notify-observation'),
  notifyError: document.getElementById('notify-error'),
  confirmNotifyButton: document.getElementById('confirm-notify-button'),
  cancelNotifyButton: document.getElementById('cancel-notify-button'),
  closeNotifyModalButton: document.getElementById('close-notify-modal-button'),
  // NOVOS ELEMENTOS: Detalhes do Produto
  productDetailsModalOverlay: document.getElementById('product-details-modal-overlay'),
  closeDetailsModalButton: document.getElementById('close-details-modal-button'),
  detailImage: document.getElementById('detail-image'),
  detailCategory: document.getElementById('detail-category'),
  detailName: document.getElementById('detail-name'),
  detailSku: document.getElementById('detail-sku'),
  detailPriceContainer: document.getElementById('detail-price-container'),
  detailTagsContainer: document.getElementById('detail-tags-container'),
  detailIngredientsContainer: document.getElementById('detail-ingredients-container'),
  detailIngredients: document.getElementById('detail-ingredients'),
  detailActions: document.getElementById('detail-actions'),
  detailActionsSection: document.getElementById('detail-actions-section'),
  detailOutOfStockBadge: document.getElementById('detail-out-of-stock-badge'),
};

// ===== FUNÇÕES UTILITÁRIAS =====
function parsePrice(priceStr) { 
  if (!priceStr) return 0; 
  return parseFloat(priceStr.toString().replace(',', '.')) || 0; 
}

function formatPrice(price) { 
  return price.toFixed(2).replace('.', ','); 
}

function normalizeText(text) { 
  if (!text) return ''; 
  return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); 
}

function showStatus(message, isError = false) {
  if (isError) {
    elements.loadingStatus.style.display = 'none';
    elements.produtosSection.style.display = 'none';
    elements.errorSection.style.display = 'block';
    elements.errorDetails.textContent = message;
  } else {
    elements.loadingStatus.style.display = 'block';
    elements.produtosSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    elements.loadingStatus.innerHTML = `<div class="loading-spinner"></div><p class="mt-4 text-gray-600">${message}</p>`;
  }
}

function showSuccess() {
  elements.loadingStatus.style.display = 'none';
  elements.errorSection.style.display = 'none';
  elements.produtosSection.style.display = 'block';
}

function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') throw new Error('CSV inválido ou vazio');
  
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV deve ter cabeçalho e dados');
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const required = ['SKU', 'NOME_SITE', 'PRECO', 'ESTOQUE', 'CATEGORIA', 'URL_FOTO'];
  
  if (required.some(col => !headers.includes(col))) {
    throw new Error(`Colunas ausentes: ${required.filter(c=>!headers.includes(c)).join(', ')}`);
  }
  
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (values[index] || '').trim().replace(/^"|"$/g, '');
    });
    return obj;
  }).filter(item => item.SKU && item.NOME_SITE);
}

// ===== FUNÇÃO PARA DETERMINAR STATUS DO PRODUTO (CORRIGIDA) =====
function getProductStatus(product) {
  if (!product.isGranel) {
    // Produto unitário - permite compra com qualquer quantidade > 0
    if (product.stock <= 0) return 'out_of_stock';
    if (product.stock === 1) return 'low_stock'; // Última unidade
    return 'available';
  } else {
    // Produto a granel
    const stockInGrams = product.stock * 1000;
    if (stockInGrams <= 0) return 'out_of_stock';
    if (stockInGrams < CONFIG.MIN_GRANEL_QUANTITY) return 'out_of_stock'; // Não permite venda abaixo de 50g
    if (stockInGrams < CONFIG.LOW_STOCK_THRESHOLD) return 'low_stock'; // Entre 50-99g = estoque baixo
    return 'available';
  }
}

// ===== HELPER PARA RENDERIZAR TAGS COLORIDAS (MODAL) =====
function renderTags(tagsString) {
  if (!tagsString) return '';

  const tags = tagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);

  return tags.map(tag => {
    let colorClass = 'tag-default';
    const lowerTag = normalizeText(tag);

    if (lowerTag.includes('sem gluten') || lowerTag.includes('gluten free')) {
      colorClass = 'tag-gluten';
    } else if (lowerTag.includes('vegano') || lowerTag.includes('vegana') || lowerTag.includes('vegan')) {
      colorClass = 'tag-vegan';
    } else if (lowerTag.includes('sem acucar') || lowerTag.includes('zero acucar')) {
      colorClass = 'tag-sugar';
    } else if (lowerTag.includes('sem lactose') || lowerTag.includes('sem leite') || lowerTag.includes('lactose free')) {
      colorClass = 'tag-lactose';
    } else if (lowerTag.includes('sem conservante')) {
      colorClass = 'tag-preservative';
    }

    return `<span class="product-tag ${colorClass}">${tag}</span>`;
  }).join('');
}

// ===== BADGES DE DIETA (CARDS) - VERSÃO MELHORADA (PILLS) =====
function getDietBadges(tagsString) {
  if (!tagsString) return [];
  const t = normalizeText(tagsString);

  const badges = [];
  const add = (key, label, icon, cssClass) => {
    if (!badges.some(b => b.key === key)) badges.push({ key, label, icon, cssClass });
  };

  // Usando badges estilo "Pill" (Texto + Icone) para clareza
  if (t.includes('sem gluten') || t.includes('gluten free')) {
    add('gluten', 'Sem Glúten', 'ban-outline', 'diet-pill-gluten');
  }
  if (t.includes('vegano') || t.includes('vegana') || t.includes('vegan')) {
    add('vegan', 'Vegano', 'leaf-outline', 'diet-pill-vegan');
  }
  if (t.includes('sem acucar') || t.includes('zero acucar')) {
    add('sugar', 'Zero Açúcar', 'cube-outline', 'diet-pill-sugar');
  }
  if (t.includes('sem lactose') || t.includes('sem leite') || t.includes('lactose free')) {
    add('lactose', 'Sem Lactose', 'water-outline', 'diet-pill-lactose');
  }
  if (t.includes('sem conservante')) {
    add('preservative', 'Sem Conservantes', 'shield-checkmark-outline', 'diet-pill-preservative');
  }

  return badges;
}

function renderDietBadges(tagsString) {
  const badges = getDietBadges(tagsString);
  if (badges.length === 0) return '';

  // Renderiza como Pills (Texto explícito)
  return `
    <div class="diet-badges">
      ${badges.map(b => `
        <span class="diet-pill ${b.cssClass}" title="${b.label}">
          <ion-icon name="${b.icon}"></ion-icon>
          <span class="diet-pill-text">${b.label}</span>
        </span>
      `).join('')}
    </div>
  `;
}


// ===== LAZY LOADING DE IMAGENS =====
function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.1
  });
  
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// ===== CARREGAMENTO INICIAL DO CARRINHO =====
function loadInitialCart() {
  try {
    const savedCart = loadCartFromLocalStorage();
    if (savedCart.length > 0) {
      cart = savedCart;
      renderCart();
    }
  } catch (error) {
    cart = [];
  }
}

// ===== VALIDAÇÃO DO CARRINHO =====
function validateCartWithProducts() {
  if (cart.length === 0) return;
  
  const validatedCart = [];
  let hasChanges = false;
  let removedItems = [];
  let adjustedItems = [];
  
  for (const cartItem of cart) {
    const currentProduct = products.find(p => 
      (p.id === cartItem.id) || 
      (p.sku === cartItem.sku) || 
      (p.sku === cartItem.id)
    );
    
    if (!currentProduct) {
      hasChanges = true;
      removedItems.push(cartItem.name || `Produto ${cartItem.sku || cartItem.id}`);
      continue;
    }
    
    // Verificar se produto está disponível
    const status = getProductStatus(currentProduct);
    if (status === 'out_of_stock') {
      hasChanges = true;
      removedItems.push(currentProduct.name);
      continue;
    }
    
    const maxStock = currentProduct.isGranel ? currentProduct.stock * 1000 : currentProduct.stock;
    let finalQuantity = cartItem.quantity;
    
    if (finalQuantity > maxStock) {
      finalQuantity = maxStock;
      hasChanges = true;
      adjustedItems.push({
        name: currentProduct.name,
        oldQty: cartItem.quantity,
        newQty: finalQuantity,
        unit: currentProduct.isGranel ? 'g' : ''
      });
    }
    
    validatedCart.push({
      ...currentProduct,
      quantity: finalQuantity
    });
  }
  
  cart = validatedCart;
  renderCart();
  
  if (removedItems.length > 0) {
    showNotification(`Removido(s) do carrinho: ${removedItems.join(', ')} (indisponível)`, 5000);
  }
  
  if (adjustedItems.length > 0) {
    adjustedItems.forEach(item => {
      showNotification(`${item.name}: quantidade ajustada para ${item.newQty}${item.unit} (estoque limitado)`, 4000);
    });
  }
  
  if (hasChanges) {
    saveCartToLocalStorage();
  }
}

// ===== CARREGAMENTO OTIMIZADO DE PRODUTOS =====
async function loadProducts() {
  if (isLoading) return;
  isLoading = true;
  
  const cachedProducts = getCachedProducts();
  if (cachedProducts) {
    products = cachedProducts;
    validateCartWithProducts();
    renderCategoryFilters();
    applyFilters();
    showSuccess();
    isLoading = false;
    
    loadProductsFromSheet(true);
    return;
  }
  
  await loadProductsFromSheet(false);
}

async function loadProductsFromSheet(isBackground = false) {
  if (!isBackground) {
    showStatus('Conectando com a planilha...');
  }
  
  try {
    let response;
    
    try {
      response = await fetch(CONFIG.SHEET_CSV_URL, {
        headers: {
          'Accept': 'text/csv,text/plain,*/*',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) throw new Error('Acesso direto falhou');
    } catch (directError) {
      if (!isBackground) showStatus('Conectando via proxy...');
      response = await fetchWithProxy(CONFIG.SHEET_CSV_URL);
    }

    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
    
    if (!isBackground) showStatus('Processando dados da planilha...');
    const csvText = await response.text();
    
    if (!csvText.trim()) throw new Error('Planilha vazia ou inacessível');
    
    const rawData = parseCSV(csvText);
    
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const possibleClubColumns = headers.filter(h => 
      h.toUpperCase().includes('CLUB') || 
      h.toUpperCase().includes('CLUBE') || 
      h.toUpperCase().includes('VLR') ||
      h.toUpperCase().includes('DESCONTO') ||
      h.toUpperCase().includes('PROMO')
    );
    
    const newProducts = rawData.map((item, index) => {
      const isGranel = (item.CATEGORIA || '').toUpperCase() === 'GRANEL';
      const basePrice = parsePrice(item.PRECO);
      
      let stockValue;
      if (item.ESTOQUE) {
        stockValue = parseFloat(item.ESTOQUE.toString().replace(',', '.')) || 0;
      } else {
        stockValue = 0;
      }
      
      let clubPrice = 0;
      
      if (item.CLUB_VLR) {
        clubPrice = parsePrice(item.CLUB_VLR);
      }
      
      if (clubPrice === 0) {
        for (const col of possibleClubColumns) {
          if (item[col]) {
            const testPrice = parsePrice(item[col]);
            if (testPrice > 0) {
              clubPrice = testPrice;
              break;
            }
          }
        }
      }
      
      const finalClubPrice = clubPrice > 0 ? (isGranel ? clubPrice / 1000 : clubPrice) : null;
      
      const product = {
        id: parseInt(item.SKU) || index + Date.now(),
        sku: item.SKU || `ITEM${index + 1}`,
        name: item.NOME_SITE || 'Produto sem nome',
        price: isGranel ? basePrice / 1000 : basePrice,
        clubPrice: finalClubPrice,
        stock: stockValue,
        category: item.CATEGORIA || 'Outros',
        image: item.URL_FOTO || `https://placehold.co/300x200/166534/ffffff?text=${item.SKU}`,
        isGranel: isGranel,
        minQuantity: isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1,
        quantityStep: isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1,
        // NOVOS CAMPOS: Leitura das colunas INGREDIENTES e TAGS
        ingredients: item.INGREDIENTES || '',
        tags: item.TAGS || ''
      };
      
      product.status = getProductStatus(product);
      
      return product;
    }).filter(p => p.price > 0 && p.name !== 'Produto sem nome');
    
    if (newProducts.length === 0) {
      throw new Error('Nenhum produto válido encontrado na planilha.');
    }
    
    products = newProducts;
    setCachedProducts(products);
    
    if (!isBackground) {
      validateCartWithProducts();
      renderCategoryFilters();
      applyFilters();
      showSuccess();
    } else {
      validateCartWithProducts();
    }
    
  } catch (error) {
    if (!isBackground) {
      showStatus(`Erro: ${error.message}`, true);
      console.error('Erro ao carregar produtos:', error);
    }
  } finally {
    isLoading = false;
  }
}

// ===== RENDERIZAÇÃO DE CATEGORIAS (CORRIGIDA - SEM "FORA DE ESTOQUE") =====
function renderCategoryFilters() {
  const clubProducts = products.filter(p => p.clubPrice !== null && p.clubPrice > 0);
  
  // Contar produtos por categoria
  const categoryCount = {};
  products.forEach(p => {
    categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
  });
  
  // ADICIONADO: Produtos específicos na categoria SUPLEMENTOS
  const specificSupplementsProducts = products.filter(p => p.sku === '2' || p.sku === '409' || p.sku === '340');
  if (specificSupplementsProducts.length > 0) {
    categoryCount['SUPLEMENTOS'] = (categoryCount['SUPLEMENTOS'] || 0) + specificSupplementsProducts.length;
  }
  
  const originalCategories = [...new Set(products.map(p => p.category))];
  
  const displayCategories = [];
  let hasViaAromaCategories = false;
  let viaAromaCount = 0;
  
  originalCategories.forEach(category => {
    if (category === 'OLEO ESSENCIAL' || category === 'ESSENCIAS') {
      if (!hasViaAromaCategories) {
        displayCategories.push('VIAAROMA');
        hasViaAromaCategories = true;
      }
      viaAromaCount += categoryCount[category] || 0;
    } else {
      displayCategories.push(category);
    }
  });
  
  // Separar categorias especiais
  const regularCategories = displayCategories.filter(cat => cat !== 'GELADEIRA');
  const hasGeladeira = displayCategories.includes('GELADEIRA');
  
  let categories = [{ 
    name: 'Todos', 
    count: products.length
  }];
  
  // Adicionar categorias regulares primeiro
  regularCategories.forEach(cat => {
    if (cat === 'VIAAROMA') {
      categories.push({ 
        name: cat, 
        count: viaAromaCount
      });
    } else {
      categories.push({ 
        name: cat, 
        count: categoryCount[cat] || 0
      });
    }
  });
  
  // Adicionar GELADEIRA como penúltima (se existir)
  if (hasGeladeira) {
    categories.push({ 
      name: 'GELADEIRA', 
      count: categoryCount['GELADEIRA'] || 0
    });
  }
  
  // Adicionar Club NatuBrava como última categoria (se existir)
  if (clubProducts.length > 0) {
    categories.push({ 
      name: '⭐ Club NatuBrava', 
      count: clubProducts.length
    });
  }
  
  elements.categoryFilters.innerHTML = categories.map(cat => {
    let buttonClass = 'category-btn text-sm sm:text-base px-4 py-2 rounded-full';
    let buttonContent = cat.name;
    
    if (cat.name === '⭐ Club NatuBrava') {
      buttonClass += ' club-category-btn';
      buttonContent = `<span class="flex items-center"><ion-icon name="star" class="text-yellow-400 mr-1"></ion-icon>Club NatuBrava <span class="ml-2 text-xs bg-white bg-opacity-30 px-2 py-0.5 rounded-full">${cat.count}</span></span>`;
    } else {
      buttonContent = `${cat.name} <span class="text-xs ml-1 bg-green-700 bg-opacity-20 px-2 py-0.5 rounded-full">${cat.count}</span>`;
    }
    
    return `<button class="${buttonClass}" data-category="${cat.name}">${buttonContent}</button>`;
  }).join('');
}

// ===== APLICAR FILTROS E BUSCA (CORRIGIDO PARA SUPLEMENTOS) =====
function applyFilters() {
  const searchTerm = normalizeText(elements.searchBox.value);
  const searchTerms = searchTerm.split(' ').filter(t => t.length > 0);
  
  filteredProducts = products.filter(product => {
    // Se há busca, ignorar filtro de categoria e buscar globalmente
    if (searchTerms.length > 0) {
      const productText = normalizeText(`${product.name} ${product.sku}`);
      return searchTerms.every(term => productText.includes(term));
    }
    
    // Se não há busca, aplicar filtro de categoria
    if (currentFilter === 'Todos') {
      return true;
    } else if (currentFilter === '⭐ Club NatuBrava') {
      return product.clubPrice !== null && product.clubPrice > 0;
    } else if (currentFilter === 'VIAAROMA') {
      return product.category === 'OLEO ESSENCIAL' || product.category === 'ESSENCIAS';
    } else if (currentFilter === 'SUPLEMENTOS') {
      // ADICIONADO: Incluir produtos específicos na categoria SUPLEMENTOS
      return product.category === 'SUPLEMENTOS' || product.sku === '2' || product.sku === '409' || product.sku === '340';
    } else {
      return product.category === currentFilter;
    }
  });
  
  // Ordenar produtos
  filteredProducts.sort((a, b) => {
    const statusOrder = { 'available': 0, 'low_stock': 1, 'out_of_stock': 2 };
    if (a.status !== b.status) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    
    if (a.status === 'available' && b.status === 'available') {
      const aHasClub = a.clubPrice !== null && a.clubPrice > 0;
      const bHasClub = b.clubPrice !== null && b.clubPrice > 0;
      if (aHasClub && !bHasClub) return -1;
      if (!aHasClub && bHasClub) return 1;
    }
    
    return 0;
  });
  
  totalPages = Math.ceil(filteredProducts.length / CONFIG.ITEMS_PER_PAGE);
  currentPage = 1;
  
  renderProducts();
  renderPagination();
  updateProductCounter();
}

// ===== RENDERIZAÇÃO DE PRODUTOS =====
function renderProducts() {
  const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
  const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
  const pageProducts = filteredProducts.slice(startIndex, endIndex);
  
  elements.productList.innerHTML = '';
  elements.noProductsMessage.style.display = pageProducts.length === 0 ? 'block' : 'none';
  
  const fragment = document.createDocumentFragment();
  
  pageProducts.forEach(product => {
    const card = document.createElement('div');
    const isGranel = product.isGranel;
    const initialQty = isGranel ? 100 : 1; 
    const hasClubPrice = product.clubPrice !== null && product.clubPrice > 0;
    const status = product.status;
    
    // Verificação para botão "Ver Detalhes"
    const hasDetails = (product.ingredients && product.ingredients.length > 2) || (product.tags && product.tags.length > 0);
    
    let cardClass = 'product-card bg-white rounded-lg shadow-md overflow-hidden';
    if (status === 'out_of_stock') {
      cardClass += ' out-of-stock-card';
    } else if (status === 'low_stock') {
      cardClass += ' low-stock-card';
    }
    if (hasClubPrice && status !== 'out_of_stock') {
      cardClass += ' club-product-card';
    }
    
    card.className = cardClass;
    card.style.animation = 'fadeInUp 0.5s ease-out';
    card.dataset.id = product.id;
    
    let priceHTML = '';
    let statusBadgeHTML = '';
    let quantityControlsHTML = '';
    let buttonHTML = '';
    
    // Badge de status
    if (status === 'out_of_stock') {
      statusBadgeHTML = '<div class="status-badge out-of-stock-badge">Produto Indisponível</div>';
    } else if (status === 'low_stock') {
      statusBadgeHTML = '<div class="status-badge low-stock-badge">Últimas Unidades</div>';
    }
    
    // Preços
    if (hasClubPrice && status !== 'out_of_stock') {
      const normalPrice = isGranel ? product.price * 100 : product.price;
      const clubPriceDisplay = isGranel ? product.clubPrice * 100 : product.clubPrice;
      priceHTML = `
        <div class="price-container">
          <div class="normal-price">De: <span class="original-price">R$ ${formatPrice(normalPrice)}${isGranel ? '/100g' : ''}</span></div>
          <div class="club-price-container">
            <span class="club-badge">CLUB</span>
            <span class="club-price">R$ ${formatPrice(clubPriceDisplay)}${isGranel ? '/100g' : ''}</span>
            <button class="club-info-icon ml-1 text-green-600 hover:text-green-800" onclick="openClubInfoModal(event)" title="Saiba mais sobre o Club NatuBrava">
              <ion-icon name="information-circle-outline" class="text-sm"></ion-icon>
            </button>
          </div>
        </div>`;
    } else {
      priceHTML = `<span class="text-lg font-bold text-green-700">R$ ${formatPrice(isGranel ? product.price * 100 : product.price)}${isGranel ? '/100g' : ''}</span>`;
    }
    
    // Controles de quantidade e botão
    if (status === 'out_of_stock') {
      quantityControlsHTML = '';
      buttonHTML = `
        <button class="notify-me-btn w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-1" data-product-id="${product.id}">
          <ion-icon name="notifications-outline" class="text-base"></ion-icon>
          <span>Avise-me assim que chegar</span>
        </button>`;
    } else {
      const minQty = isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1;
      const maxQty = isGranel ? product.stock * 1000 : product.stock;
      
      quantityControlsHTML = `
        <div class="flex items-center space-x-1">
          <button class="product-quantity-change p-1 rounded-full bg-gray-100 hover:bg-gray-200" data-change="-1" ${initialQty <= minQty ? 'disabled' : ''}><ion-icon name="remove-outline" class="pointer-events-none"></ion-icon></button>
          <span class="product-quantity font-medium text-base ${isGranel ? 'w-16' : 'w-6'} text-center">${isGranel ? `${initialQty}g` : initialQty}</span>
          <button class="product-quantity-change p-1 rounded-full bg-gray-100 hover:bg-gray-200" data-change="1" ${initialQty >= maxQty ? 'disabled' : ''}><ion-icon name="add-outline" class="pointer-events-none"></ion-icon></button>
        </div>`;
      
      buttonHTML = `
        <button class="add-to-cart-btn w-full bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-1">
          <ion-icon name="cart-outline" class="text-base"></ion-icon>
          <span>Adicionar</span>
        </button>`;
    }
    
    // Destacar termos de busca no nome
    let displayName = product.name;
    const searchTerm = elements.searchBox.value.trim();
    if (searchTerm) {
      const regex = new RegExp(`(${searchTerm.split(' ').join('|')})`, 'gi');
      displayName = displayName.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    }
    
    const imageHTML = `
      <img data-src="${product.image}" 
           alt="${product.name}" 
           class="product-image ${status === 'out_of_stock' ? 'grayscale' : ''}" 
           loading="lazy"
           onerror="this.parentElement.innerHTML='<div class=\\'product-image-error\\'>Imagem<br>Indisponível</div>'">
    `;
    
    // Lógica CONDICIONAL para "Ver Detalhes"
    // Removemos a div "view-details-overlay" antiga e o botão "info-btn" (i)
    // Adicionamos um botão explícito apenas se tiver detalhes
    const detailsButtonHTML = hasDetails ? `
        <button class="view-details-btn info-btn-trigger">
          <ion-icon name="eye-outline"></ion-icon> Ver Detalhes
        </button>
    ` : '';
    
    card.innerHTML = `
      <div class="product-image-container ${hasDetails ? 'has-details-cursor' : ''}">
        ${imageHTML}
        ${statusBadgeHTML}
        ${detailsButtonHTML}
      </div>
      <div class="product-card-content">
        <h3 class="text-lg font-semibold text-green-800 mb-1 leading-tight">${displayName}</h3>
        ${renderDietBadges(product.tags)}
        <p class="text-xs text-gray-400 mb-2 flex-grow">Cód.: ${product.sku}</p>
        <div class="product-card-footer">
          <div class="flex justify-between items-center mb-3">
            ${priceHTML}
            ${quantityControlsHTML}
          </div>
          ${isGranel && status !== 'out_of_stock' ? `<div class="text-center mb-2"><span class="text-sm font-semibold text-green-800">Total: R$ <span class="product-total-price">${formatPrice((hasClubPrice ? product.clubPrice : product.price) * initialQty)}</span></span></div>` : ''}
          ${buttonHTML}
        </div>
      </div>`;
    
    fragment.appendChild(card);
  });
  
  elements.productList.appendChild(fragment);
  setupLazyLoading();
  
  document.querySelectorAll('#category-filters .category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === currentFilter);
  });
  
  if (currentPage > 1) {
    elements.produtosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ===== RENDERIZAR PAGINAÇÃO =====
function renderPagination() {
  if (!elements.pagination || totalPages <= 1) {
    if (elements.pagination) elements.pagination.style.display = 'none';
    return;
  }
  
  elements.pagination.style.display = 'flex';
  elements.pagination.innerHTML = '';
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.innerHTML = '<ion-icon name="chevron-back-outline"></ion-icon>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);
  elements.pagination.appendChild(prevBtn);
  
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    const firstPageBtn = createPageButton(1);
    elements.pagination.appendChild(firstPageBtn);
    
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      elements.pagination.appendChild(dots);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = createPageButton(i);
    elements.pagination.appendChild(pageBtn);
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      elements.pagination.appendChild(dots);
    }
    
    const lastPageBtn = createPageButton(totalPages);
    elements.pagination.appendChild(lastPageBtn);
  }
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.innerHTML = '<ion-icon name="chevron-forward-outline"></ion-icon>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);
  elements.pagination.appendChild(nextBtn);
}

function createPageButton(pageNumber) {
  const btn = document.createElement('button');
  btn.className = 'pagination-btn' + (pageNumber === currentPage ? ' active' : '');
  btn.textContent = pageNumber;
  btn.onclick = () => goToPage(pageNumber);
  return btn;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderProducts();
  renderPagination();
}

// ===== ATUALIZAR CONTADOR DE PRODUTOS =====
function updateProductCounter() {
  if (!elements.productCounter) return;
  
  const total = filteredProducts.length;
  const start = total > 0 ? (currentPage - 1) * CONFIG.ITEMS_PER_PAGE + 1 : 0;
  const end = Math.min(currentPage * CONFIG.ITEMS_PER_PAGE, total);
  
  elements.productCounter.innerHTML = `
    Mostrando <strong>${start}-${end}</strong> de <strong>${total}</strong> produtos
  `;
}

// ===== BUSCA OTIMIZADA COM DEBOUNCE =====
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    applyFilters();
  }, 300);
}

// ===== CARRINHO =====
function triggerCartAnimation() {
  if (elements.cartButton) {
    elements.cartButton.classList.add('cart-bounce-animation');
    setTimeout(() => elements.cartButton.classList.remove('cart-bounce-animation'), 400);
  }
  if (elements.cartButtonMobile) {
    elements.cartButtonMobile.classList.add('cart-bounce-animation');
    setTimeout(() => elements.cartButtonMobile.classList.remove('cart-bounce-animation'), 400);
  }
}

// ===== ADICIONAR AO CARRINHO (CORRIGIDO) =====
function addToCart(productId, quantity) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  // Verificar se produto está disponível
  if (product.status === 'out_of_stock') {
    showNotification('Este produto não está disponível para compra no momento.');
    return;
  }

  // Verificação de quantidade mínima
  if (product.isGranel && quantity < CONFIG.MIN_GRANEL_QUANTITY) {
    showNotification(`Quantidade mínima para produtos a granel: ${CONFIG.MIN_GRANEL_QUANTITY}g`);
    return;
  }
  
  if (!product.isGranel && quantity < 1) {
    showNotification('Quantidade mínima: 1 unidade');
    return;
  }

  const existingItem = cart.find(item => item.id === productId);
  const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
  const newTotalQuantity = currentQuantityInCart + quantity;
  const maxStock = product.isGranel ? product.stock * 1000 : product.stock;

  if (newTotalQuantity > maxStock) {
    const availableStock = maxStock - currentQuantityInCart;
    showNotification(`Estoque insuficiente. Você pode adicionar mais ${availableStock}${product.isGranel ? 'g' : ' unidade(s)'}.`);
    return;
  }

  const finalPrice = product.clubPrice || product.price;

  if (existingItem) {
    existingItem.quantity = newTotalQuantity;
    existingItem.price = finalPrice;
  } else {
    cart.push({ ...product, quantity, price: finalPrice });
  }
  
  triggerCartAnimation();
  showNotification(`${product.isGranel ? quantity+'g' : quantity+'x'} de ${product.name} adicionado!`);
  renderCart();
  saveCartToLocalStorage();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  renderCart();
  saveCartToLocalStorage();
}

function updateCartQuantity(productId, change) {
  const itemIndex = cart.findIndex(item => item.id === productId);
  if (itemIndex === -1) return;
  const item = cart[itemIndex];
  
  const currentProduct = products.find(p => p.id === productId);
  const step = currentProduct ? (currentProduct.isGranel ? currentProduct.quantityStep : 1) : (item.isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1);
  const minQty = currentProduct ? (currentProduct.isGranel ? currentProduct.minQuantity : 1) : (item.isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1);
  
  let newQuantity = item.quantity + (change * step);
  const maxStock = currentProduct ? (currentProduct.isGranel ? currentProduct.stock * 1000 : currentProduct.stock) : 9999;

  if (newQuantity < minQty) {
    removeFromCart(productId);
  } else if (newQuantity <= maxStock) {
    item.quantity = newQuantity;
    if (currentProduct && currentProduct.clubPrice) {
      item.price = currentProduct.clubPrice;
    }
    renderCart();
    saveCartToLocalStorage();
  } else {
    showNotification(`Estoque máximo atingido: ${maxStock}${item.isGranel ? 'g' : ''}`);
  }
}

function renderCart() {
  elements.cartItems.innerHTML = '';
  let total = 0;
  elements.cartEmptyMessage.style.display = cart.length === 0 ? 'block' : 'none';

  if (cart.length > 0) {
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      const itemElement = document.createElement('div');
      itemElement.className = 'flex items-center justify-between border-b pb-3 pt-1';
      
      itemElement.innerHTML = `
        <div class="flex items-center space-x-3 flex-grow min-w-0">
          <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded object-cover flex-shrink-0">
          <div class="flex-grow min-w-0">
            <p class="font-medium text-sm truncate">${item.name}</p>
            <div class="flex items-center space-x-1 mt-1">
              <button class="cart-quantity-change text-gray-500 hover:text-black p-0.5 rounded bg-gray-100 hover:bg-gray-200" data-id="${item.id}" data-change="-1">
                <ion-icon name="remove-outline" class="text-sm pointer-events-none"></ion-icon>
              </button>
              <span class="text-sm font-medium w-12 text-center">${item.isGranel ? `${item.quantity}g` : item.quantity}</span>
              <button class="cart-quantity-change text-gray-500 hover:text-black p-0.5 rounded bg-gray-100 hover:bg-gray-200" data-id="${item.id}" data-change="1">
                <ion-icon name="add-outline" class="text-sm pointer-events-none"></ion-icon>
              </button>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-end justify-center ml-2">
          <span class="font-semibold text-sm">R$ ${formatPrice(itemTotal)}</span>
          <button class="remove-item text-red-500 text-lg p-1 mt-1" data-id="${item.id}"><ion-icon name="trash-outline" class="pointer-events-none"></ion-icon></button>
        </div>`;
      elements.cartItems.appendChild(itemElement);
    });
  }
  
  const cartLength = cart.length;
  if (elements.cartCount) {
    elements.cartCount.textContent = cartLength;
  }
  if (elements.cartCountMobile) {
    elements.cartCountMobile.textContent = cartLength;
  }
  
  elements.cartTotal.textContent = `R$ ${formatPrice(total)}`;
  elements.checkoutButton.disabled = cart.length === 0;
}

// ===== MODAIS =====
function openCartPanel() { 
  elements.cartPanel.classList.add('open'); 
  elements.cartOverlay.classList.add('open'); 
  document.body.style.overflow = 'hidden';
}

function closeCartPanel() { 
  elements.cartPanel.classList.remove('open'); 
  elements.cartOverlay.classList.remove('open'); 
  document.body.style.overflow = '';
}

function openNameModal() { 
  elements.nameModalOverlay.classList.add('open'); 
  elements.nameModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    elements.nameModal.style.transform = 'scale(1)';
    elements.nameModal.style.opacity = '1';
  }, 50);
}

function closeNameModal() {
  elements.nameModal.style.transform = 'scale(0.95)';
  elements.nameModal.style.opacity = '0';
  setTimeout(() => {
    elements.nameModalOverlay.classList.remove('open');
    elements.nameModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
  elements.nameError.classList.add('hidden');
  elements.clientNameInput.classList.remove('border-red-500');
  elements.clientNameInput.value = '';
  elements.clientObservation.value = '';
}

// ===== NOVO MODAL DE DETALHES =====
function openProductDetails(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  // Preencher dados básicos
  elements.detailImage.src = product.image;
  elements.detailImage.onerror = () => { elements.detailImage.src = 'https://placehold.co/400x400/166534/ffffff?text=Sem+Imagem'; };
  elements.detailCategory.textContent = product.category;
  elements.detailName.textContent = product.name;
  elements.detailSku.textContent = product.sku;

  // Lógica de Preço
  const isGranel = product.isGranel;
  const hasClubPrice = product.clubPrice !== null && product.clubPrice > 0;
  
  let priceHTML = '';
  if (hasClubPrice) {
    const normalPrice = isGranel ? product.price * 100 : product.price;
    const clubPriceDisplay = isGranel ? product.clubPrice * 100 : product.clubPrice;
    
    priceHTML = `
      <div class="flex flex-col">
        <span class="text-sm text-gray-500 line-through">De R$ ${formatPrice(normalPrice)}${isGranel ? '/100g' : ''}</span>
        <div class="flex items-center gap-2">
          <span class="text-3xl font-bold text-green-700">R$ ${formatPrice(clubPriceDisplay)}${isGranel ? '/100g' : ''}</span>
          <span class="bg-green-600 text-white text-xs px-2 py-1 rounded font-bold uppercase">Club</span>
        </div>
      </div>
    `;
  } else {
    priceHTML = `
      <span class="text-3xl font-bold text-green-700">R$ ${formatPrice(isGranel ? product.price * 100 : product.price)}${isGranel ? '/100g' : ''}</span>
    `;
  }
  elements.detailPriceContainer.innerHTML = priceHTML;

  // Tags
  elements.detailTagsContainer.innerHTML = renderTags(product.tags);

  // Ingredientes (se vazio, esconde a seção)
  if (product.ingredients && product.ingredients.trim() !== '') {
    elements.detailIngredients.textContent = product.ingredients;
    elements.detailIngredientsContainer.classList.remove('hidden');
  } else {
    elements.detailIngredientsContainer.classList.add('hidden');
  }
  
  // Ações e Estoque
  const actionsSection = elements.detailActionsSection || document.getElementById('detail-actions-section');

  if (product.status === 'out_of_stock') {
    elements.detailOutOfStockBadge.classList.remove('hidden');
    if (actionsSection) {
       actionsSection.classList.remove('hidden');
       elements.detailActions.innerHTML = `
        <button class="notify-me-btn w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2" onclick="closeDetailsModal(); openNotifyModal(${product.id})">
          <ion-icon name="notifications-outline" class="text-xl"></ion-icon>
          <span>Avise-me quando chegar</span>
        </button>`;
    }
  } else {
    elements.detailOutOfStockBadge.classList.add('hidden');
    // REMOVIDO BOTÃO DE ADICIONAR AO CARRINHO DO MODAL - MODAL AGORA É APENAS INFORMATIVO
    if (actionsSection) actionsSection.classList.add('hidden');
    elements.detailActions.innerHTML = '';
  }

  // Abrir Modal
  elements.productDetailsModalOverlay.classList.add('open');
  elements.productDetailsModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    document.getElementById('product-details-modal').style.transform = 'scale(1)';
    document.getElementById('product-details-modal').style.opacity = '1';
  }, 50);
}

function closeDetailsModal() {
  document.getElementById('product-details-modal').style.transform = 'scale(0.95)';
  document.getElementById('product-details-modal').style.opacity = '0';
  setTimeout(() => {
    elements.productDetailsModalOverlay.classList.remove('open');
    elements.productDetailsModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

// Funções Auxiliares do Modal de Detalhes (Escopo Global para acesso via HTML string)
window.changeModalQuantity = function(direction, isGranel, step, maxQty) {
    // Funcionalidade mantida caso seja reativada no futuro, mas oculta agora
};

window.addToCartFromModal = function(productId, isGranel) {
   // Funcionalidade mantida caso seja reativada no futuro
};

// ... (Resto das funções de modal existentes: Notify, Delivery, ClubInfo) ...

function openNotifyModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('notify-product-name').textContent = product.name;
  document.getElementById('notify-product-sku').textContent = product.sku;
  
  elements.notifyModalOverlay.classList.add('open');
  elements.notifyModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    elements.notifyModal.style.transform = 'scale(1)';
    elements.notifyModal.style.opacity = '1';
  }, 50);
  
  elements.notifyModal.dataset.productId = productId;
}

function closeNotifyModal() {
  elements.notifyModal.style.transform = 'scale(0.95)';
  elements.notifyModal.style.opacity = '0';
  setTimeout(() => {
    elements.notifyModalOverlay.classList.remove('open');
    elements.notifyModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
  
  elements.notifyError.classList.add('hidden');
  elements.clientNotifyName.classList.remove('border-red-500');
  elements.clientNotifyPhone.classList.remove('border-red-500');
  elements.clientNotifyName.value = '';
  elements.clientNotifyPhone.value = '';
  elements.clientNotifyObservation.value = '';
  delete elements.notifyModal.dataset.productId;
}

function sendNotifyRequest() {
  const productId = parseInt(elements.notifyModal.dataset.productId);
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const clientName = elements.clientNotifyName.value.trim();
  const clientPhone = elements.clientNotifyPhone.value.trim();
  const observation = elements.clientNotifyObservation.value.trim();
  
  let hasError = false;
  
  elements.clientNotifyName.classList.remove('border-red-500');
  elements.clientNotifyPhone.classList.remove('border-red-500');
  elements.notifyError.classList.add('hidden');
  
  if (!clientName) {
    elements.clientNotifyName.classList.add('border-red-500');
    hasError = true;
  }
  
  if (!clientPhone) {
    elements.clientNotifyPhone.classList.add('border-red-500');
    hasError = true;
  }
  
  if (hasError) {
    elements.notifyError.classList.remove('hidden');
    return;
  }
  
  let message = `🔔 *AVISO DE INTERESSE EM PRODUTO*\n\n`;
  message += `*Cliente:* ${clientName}\n`;
  message += `*Telefone:* ${clientPhone}\n\n`;
  message += `*PRODUTO SOLICITADO*\n`;
  message += `*Nome:* ${product.name}\n`;
  message += `*SKU:* ${product.sku}\n`;
  message += `*Categoria:* ${product.category}\n\n`;
  
  if (observation) {
    message += `*Observações do cliente:* ${observation}\n\n`;
  }
  
  message += `📋 *O cliente gostaria de ser avisado quando este produto voltar ao estoque.*\n\n`;
  message += `⚠️ *Status atual:* Produto Indisponível\n`;
  message += `📞 *Contato do cliente:* ${clientPhone}\n\n`;
  message += `✅ Por favor, incluir este cliente na lista de interessados no produto e avisar quando houver reestoque.\n\n`;
  message += `Mensagem enviada automaticamente pelo site NatuBrava.`;
  
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  
  closeNotifyModal();
  showNotification('✅ Seu interesse foi registrado! Entraremos em contato quando o produto estiver disponível.', 5000);
}

function openDeliveryModal() { 
  elements.deliveryModalOverlay.classList.add('open'); 
  elements.deliveryModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    document.querySelector('#delivery-modal').style.transform = 'scale(1)';
    document.querySelector('#delivery-modal').style.opacity = '1';
  }, 50);
}

function closeDeliveryModal() { 
  document.querySelector('#delivery-modal').style.transform = 'scale(0.95)';
  document.querySelector('#delivery-modal').style.opacity = '0';
  setTimeout(() => {
    elements.deliveryModalOverlay.classList.remove('open'); 
    elements.deliveryModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

function openClubInfoModal(e) { 
  if(e) { e.preventDefault(); e.stopPropagation(); }
  elements.clubInfoModalOverlay.classList.add('open'); 
  elements.clubInfoModalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    document.querySelector('#club-info-modal').style.transform = 'scale(1)';
    document.querySelector('#club-info-modal').style.opacity = '1';
  }, 50);
}

function closeClubInfoModal() { 
  document.querySelector('#club-info-modal').style.transform = 'scale(0.95)';
  document.querySelector('#club-info-modal').style.opacity = '0';
  setTimeout(() => {
    elements.clubInfoModalOverlay.classList.remove('open'); 
    elements.clubInfoModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

function toggleMobileMenu() {
  const isOpen = !elements.mobileMenu.classList.contains('hidden');
  if (isOpen) {
    elements.mobileMenu.classList.add('hidden');
    elements.mobileMenuButton.innerHTML = '<ion-icon name="menu-outline" class="text-2xl"></ion-icon>';
  } else {
    elements.mobileMenu.classList.remove('hidden');
    elements.mobileMenuButton.innerHTML = '<ion-icon name="close-outline" class="text-2xl"></ion-icon>';
  }
}

function closeMobileMenu() {
  elements.mobileMenu.classList.add('hidden');
  elements.mobileMenuButton.innerHTML = '<ion-icon name="menu-outline" class="text-2xl"></ion-icon>';
}

function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'cart-notification fixed bottom-5 right-5 bg-green-600 text-white py-2 px-4 rounded-lg shadow-lg z-50';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), duration);
}

// ===== SCROLL TO TOP =====
function handleScroll() {
  if (elements.backToTop) {
    if (window.pageYOffset > CONFIG.SCROLL_THRESHOLD) {
      elements.backToTop.classList.add('show');
    } else {
      elements.backToTop.classList.remove('show');
    }
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  if (elements.cartButton) {
    elements.cartButton.addEventListener('click', (e) => {
      e.preventDefault();
      openCartPanel();
    });
  }
  
  if (elements.cartButtonMobile) {
    elements.cartButtonMobile.addEventListener('click', (e) => {
      e.preventDefault();
      openCartPanel();
    });
  }
  
  elements.closeCartButton.addEventListener('click', closeCartPanel);
  elements.cartOverlay.addEventListener('click', closeCartPanel);
  elements.retryButton.addEventListener('click', loadProducts);
  elements.searchBox.addEventListener('input', handleSearch);
  
  if (elements.backToTop) {
    elements.backToTop.addEventListener('click', scrollToTop);
  }
  
  window.addEventListener('scroll', handleScroll);
  
  // Listeners para Modais existentes
  if (elements.deliveryInfoButton) elements.deliveryInfoButton.addEventListener('click', (e) => { e.preventDefault(); openDeliveryModal(); });
  if (elements.closeDeliveryModalButton) elements.closeDeliveryModalButton.addEventListener('click', closeDeliveryModal);
  if (elements.okDeliveryModalButton) elements.okDeliveryModalButton.addEventListener('click', closeDeliveryModal);
  if (elements.deliveryModalOverlay) elements.deliveryModalOverlay.addEventListener('click', (e) => { if (e.target === elements.deliveryModalOverlay) closeDeliveryModal(); });

  if (elements.clubInfoButton) elements.clubInfoButton.addEventListener('click', openClubInfoModal);
  if (elements.clubInfoButtonMobile) elements.clubInfoButtonMobile.addEventListener('click', (e) => { e.preventDefault(); closeMobileMenu(); openClubInfoModal(); });
  if (elements.deliveryInfoButtonMobile) elements.deliveryInfoButtonMobile.addEventListener('click', (e) => { e.preventDefault(); closeMobileMenu(); openDeliveryModal(); });
  
  if (elements.closeClubModalButton) elements.closeClubModalButton.addEventListener('click', closeClubInfoModal);
  if (elements.clubInfoModalOverlay) elements.clubInfoModalOverlay.addEventListener('click', (e) => { if (e.target === elements.clubInfoModalOverlay) closeClubInfoModal(); });

  if (elements.mobileMenuButton) elements.mobileMenuButton.addEventListener('click', (e) => { e.preventDefault(); toggleMobileMenu(); });

  elements.mobileMenu.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') closeMobileMenu();
  });

  if (elements.closeNotifyModalButton) elements.closeNotifyModalButton.addEventListener('click', closeNotifyModal);
  if (elements.cancelNotifyButton) elements.cancelNotifyButton.addEventListener('click', closeNotifyModal);
  if (elements.confirmNotifyButton) elements.confirmNotifyButton.addEventListener('click', sendNotifyRequest);
  
  // Listeners para Modal de Detalhes
  if (elements.closeDetailsModalButton) elements.closeDetailsModalButton.addEventListener('click', closeDetailsModal);
  if (elements.productDetailsModalOverlay) elements.productDetailsModalOverlay.addEventListener('click', (e) => { if (e.target === elements.productDetailsModalOverlay) closeDetailsModal(); });

  elements.categoryFilters.addEventListener('click', e => {
    if (e.target.matches('.category-btn') || e.target.closest('.category-btn')) {
      const button = e.target.closest('.category-btn') || e.target;
      currentFilter = button.dataset.category;
      applyFilters();
    }
  });

  // ===== EVENT LISTENER PARA PRODUTOS (CORRIGIDO) =====
  elements.productList.addEventListener('click', e => {
    // Verificar se clicou no botão "Avise-me"
    if (e.target.closest('.notify-me-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const card = e.target.closest('.product-card') || e.target.closest('.notify-me-btn'); // Fallback
      if (card && card.dataset.productId) { // Caso seja botão isolado
          openNotifyModal(parseInt(card.dataset.productId));
      } else if (card && card.dataset.id) { // Caso dentro do card
          openNotifyModal(parseInt(card.dataset.id));
      }
      return;
    }

    const card = e.target.closest('.product-card');
    if (!card) return;
    
    const productId = parseInt(card.dataset.id);
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Abrir Modal de Detalhes ao clicar no botão "Ver Detalhes" OU na imagem (se tiver detalhes)
    if (e.target.closest('.info-btn-trigger') || (e.target.closest('.product-image-container') && card.querySelector('.product-image-container').classList.contains('has-details-cursor'))) {
      if (!e.target.classList.contains('status-badge')) {
        e.preventDefault();
        e.stopPropagation();
        openProductDetails(productId);
        return;
      }
    }
    
    const qtySpan = card.querySelector('.product-quantity');
    const isGranel = product.isGranel;
    const hasClubPrice = product.clubPrice !== null && product.clubPrice > 0;

    if (e.target.closest('.add-to-cart-btn')) {
      e.preventDefault();
      e.stopPropagation();
      
      let quantityText = qtySpan.textContent.trim();
      let quantity;
      
      if (isGranel) {
        quantity = parseInt(quantityText.replace('g', ''));
      } else {
        quantity = parseInt(quantityText);
      }
      
      if (isNaN(quantity) || quantity <= 0) {
        showNotification('Erro: quantidade inválida');
        return;
      }
      
      addToCart(productId, quantity);
    } 
    else if (e.target.closest('.product-quantity-change')) {
      e.preventDefault();
      e.stopPropagation();
      
      const changeBtn = e.target.closest('[data-change]');
      const change = parseInt(changeBtn.dataset.change);
      let currentQty = parseInt(qtySpan.textContent.replace('g', ''));
      
      // Calcular nova quantidade
      let newQty;
      if (isGranel) {
        newQty = currentQty + (change * CONFIG.MIN_GRANEL_QUANTITY);
      } else {
        newQty = currentQty + change;
      }
      
      // Definir limites
      const minQty = isGranel ? CONFIG.MIN_GRANEL_QUANTITY : 1;
      const maxQty = isGranel ? product.stock * 1000 : product.stock;

      // Verificar se a nova quantidade está dentro dos limites
      if (newQty >= minQty && newQty <= maxQty) {
        qtySpan.textContent = isGranel ? `${newQty}g` : newQty;
        
        // Atualizar total para produtos a granel
        if (isGranel) {
          const priceToUse = hasClubPrice ? product.clubPrice : product.price;
          const totalPriceSpan = card.querySelector('.product-total-price');
          if (totalPriceSpan) {
            totalPriceSpan.textContent = formatPrice(priceToUse * newQty);
          }
        }
        
        // Atualizar estado dos botões
        const decreaseBtn = card.querySelector('[data-change="-1"]');
        const increaseBtn = card.querySelector('[data-change="1"]');
        
        if (decreaseBtn) {
          decreaseBtn.disabled = newQty <= minQty;
        }
        if (increaseBtn) {
          increaseBtn.disabled = newQty >= maxQty;
        }
      } else {
        // Quantidade fora dos limites - mostrar notificação
        if (newQty < minQty) {
          showNotification(`Quantidade mínima: ${minQty}${isGranel ? 'g' : ''}`);
        } else if (newQty > maxQty) {
          showNotification(`Estoque máximo: ${maxQty}${isGranel ? 'g' : ''}`);
        }
      }
    }
  });

  elements.cartItems.addEventListener('click', e => {
    const removeButton = e.target.closest('.remove-item');
    if (removeButton) {
      removeFromCart(parseInt(removeButton.dataset.id));
      return;
    }
    
    const quantityButton = e.target.closest('.cart-quantity-change');
    if (quantityButton) {
      updateCartQuantity(parseInt(quantityButton.dataset.id), parseInt(quantityButton.dataset.change));
    }
  });

  elements.checkoutButton.addEventListener('click', () => {
    if (cart.length > 0) openNameModal();
  });
  
  elements.cancelCheckoutButton.addEventListener('click', closeNameModal);
  
  elements.confirmCheckoutButton.addEventListener('click', () => {
    const clientName = elements.clientNameInput.value.trim();
    if (!clientName) {
      elements.nameError.classList.remove('hidden');
      elements.clientNameInput.classList.add('border-red-500');
      return;
    }
    
    const observation = elements.clientObservation.value.trim();
    
    let total = 0;
    let message = `Olá NatuBrava!\n*Pedido de:* ${clientName}\n\n*RESUMO DO PEDIDO*\n`;
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      
      const originalProduct = products.find(p => p.id === item.id);
      const isClubPrice = originalProduct && originalProduct.clubPrice && item.price === originalProduct.clubPrice;
      const priceLabel = isClubPrice ? ' (CLUB NATUBRAVA)' : '';
      
      message += `-----------------------------------\n*Produto:* ${item.name}${priceLabel}\n*SKU:* ${item.sku}\n*Quantidade:* ${item.isGranel ? `${item.quantity}g` : `Qtd: ${item.quantity}`}\n*Subtotal:* R$ ${formatPrice(itemTotal)}\n`;
    });
    message += `-----------------------------------\n\n*TOTAL GERAL: R$ ${formatPrice(total)}*\n`;
    
    if (observation) {
        message += `\n*Observações:* ${observation}\n`;
    }

    message += `\n📋 *Este pedido é para confirmação de estoque e valores.*\nEstou ciente de que os preços apresentados no catálogo online são informativos e podem sofrer alterações.\n\n✅ Aguardo confirmação de disponibilidade e valores atualizados.\n\nObrigado!`;
    
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
    
    closeNameModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
      closeCartPanel();
      closeNameModal();
      closeDeliveryModal();
      closeClubInfoModal();
      closeNotifyModal();
      closeDetailsModal(); // Adicionado
      closeMobileMenu();
    }
  });
}

// ===== FUNÇÃO GLOBAL PARA MODAL DO CLUB =====
window.openClubInfoModal = openClubInfoModal;
window.closeDetailsModal = closeDetailsModal; // Exposto para onclick inline

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  elements.currentYear.textContent = new Date().getFullYear();
  setupEventListeners();
  loadInitialCart();
  loadProducts();
});
}

{
type: uploaded file
fileName: styles.css
fullContent:
/* ===== ESTILOS PARA BOTÕES DO HEADER ===== */
.header-nav-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #15803d;
  background-color: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.header-nav-btn:hover {
  color: #ffffff;
  background-color: #15803d;
  border-color: #15803d;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(21, 128, 61, 0.2);
}

.header-nav-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);
}

.header-nav-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.2);
}

/* Efeito adicional para o botão Club NatuBrava */
.header-nav-btn:has(ion-icon[name="star-outline"]) {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
  border-color: #10b981;
  font-weight: 600;
}

.header-nav-btn:has(ion-icon[name="star-outline"]):hover {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #059669;
  color: #ffffff;
}

/* Responsivo para telas menores */
@media (min-width: 640px) {
  .header-nav-btn {
    font-size: 1rem;
    padding: 10px 18px;
  }
}

/* ===== CORREÇÕES HEADER ===== */
header nav button {
  background-color: transparent;
}

/* ===== ESTILOS PARA INSTAGRAM ===== */
.instagram-btn {
  background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
  box-shadow: 0 4px 12px rgba(131, 58, 180, 0.3);
}

.instagram-btn:hover {
  background: linear-gradient(135deg, #6c2b8f 0%, #e01818 50%, #e09b39 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(131, 58, 180, 0.4);
}

/* ===== CORREÇÕES PARA LAYOUT SHIFT (CLS) ===== */
header { min-height: 80px; }
header nav { min-height: 60px; }
header img[alt="Logo da NatuBrava"] { width: 160px !important; height: 60px !important; object-fit: contain; }
.bg-gradient-to-r { min-height: 200px; }
#sobre { min-height: 500px; }
#category-filters { min-height: 50px; }
.max-w-xl.mx-auto.mb-6 { min-height: 80px; }
body { font-display: swap; }

/* ===== ESTILOS PARA PAGINAÇÃO ===== */
#pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 2rem; flex-wrap: wrap; }
.pagination-btn { min-width: 40px; height: 40px; padding: 0.5rem; border: 2px solid #e5e7eb; background-color: white; color: #374151; font-weight: 500; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
.pagination-btn:hover:not(:disabled) { background-color: #10b981; color: white; border-color: #10b981; transform: translateY(-1px); }
.pagination-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pagination-btn.active { background-color: #15803d; color: white; border-color: #15803d; }
.pagination-dots { padding: 0 0.5rem; color: #9ca3af; }

/* ===== ESTILOS PARA CONTADOR DE PRODUTOS ===== */
#product-counter { font-size: 0.875rem; color: #4b5563; margin-bottom: 1rem; }
#product-counter strong { color: #15803d; font-weight: 600; }

/* ===== ESTILOS PARA BOTÃO VOLTAR AO TOPO ===== */
.back-to-top { position: fixed; bottom: 2rem; right: 2rem; width: 48px; height: 48px; background-color: #15803d; color: white; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; opacity: 0; visibility: hidden; transition: all 0.3s ease; z-index: 40; box-shadow: 0 4px 12px rgba(21, 128, 61, 0.3); }
.back-to-top.show { opacity: 1; visibility: visible; }
.back-to-top:hover { background-color: #166534; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(21, 128, 61, 0.4); }
.back-to-top:active { transform: translateY(0); }

/* ===== DESTAQUE DE BUSCA ===== */
mark { background-color: #fef08a; color: inherit; padding: 0 0.125rem; border-radius: 0.125rem; }

/* ===== ESTILOS RESPONSIVOS PARA NOVOS ELEMENTOS ===== */
@media (max-width: 640px) {
  .pagination-btn { min-width: 36px; height: 36px; font-size: 0.875rem; }
  .back-to-top { bottom: 1.5rem; right: 1.5rem; width: 40px; height: 40px; font-size: 1.25rem; }
  #product-counter { font-size: 0.75rem; }
}

/* ===== CÓDIGO GERAL ===== */
body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
html { scroll-behavior: smooth; }

/* Loading Spinner */
.loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #15803d; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; transform: translateZ(0); }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes cart-bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); } }
.cart-bounce-animation { animation: cart-bounce 0.4s ease-in-out; }

/* Painel do Carrinho e Modais */
.cart-panel { transition: transform 0.3s ease-in-out; transform: translateX(100%); backface-visibility: hidden; }
.cart-panel.open { transform: translateX(0); }
.cart-overlay, #name-modal-overlay, #delivery-modal-overlay, #club-info-modal-overlay, #notify-modal-overlay, #product-details-modal-overlay { transition: opacity 0.3s ease-in-out; opacity: 0; pointer-events: none; }
.cart-overlay.open, #name-modal-overlay.open, #delivery-modal-overlay.open, #club-info-modal-overlay.open, #notify-modal-overlay.open, #product-details-modal-overlay.open { opacity: 1; pointer-events: auto; }
#name-modal-overlay, #delivery-modal-overlay, #club-info-modal-overlay, #notify-modal-overlay, #product-details-modal-overlay { display: none; }
#name-modal-overlay.open, #delivery-modal-overlay.open, #club-info-modal-overlay.open, #notify-modal-overlay.open, #product-details-modal-overlay.open { display: flex !important; }
#name-modal, #delivery-modal, #club-info-modal, #notify-modal, #product-details-modal { transform: scale(0.95); opacity: 0; transition: all 0.3s ease-in-out; }
#name-modal-overlay.open #name-modal, #delivery-modal-overlay.open #delivery-modal, #club-info-modal-overlay.open #club-info-modal, #notify-modal-overlay.open #notify-modal, #product-details-modal-overlay.open #product-details-modal { transform: scale(1); opacity: 1; }
.cart-items { scrollbar-width: thin; scrollbar-color: #c1c1c1 #f1f1f1; }
.cart-items::-webkit-scrollbar { width: 6px; }
.cart-items::-webkit-scrollbar-track { background: #f1f1f1; }
.cart-items::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.cart-items::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
.add-to-cart-btn:active, .product-quantity-change:active, .category-btn:active, .cart-quantity-change:active, .notify-me-btn:active, .info-btn:active { transform: scale(0.95); }
.product-quantity-change:disabled, .cart-quantity-change:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

/* Filtros de categoria roláveis */
#category-filters { display: flex; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
#category-filters::-webkit-scrollbar { display: none; }
#category-filters .category-btn { flex-shrink: 0; }

/* ===== ESTILOS DOS BOTÕES DE CATEGORIA (CORRIGIDOS) ===== */
.category-btn {
  background-color: #16a34a;
  color: white;
  border: none;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: visible;
  position: relative;
  z-index: 1;
}

.category-btn:hover {
  background-color: #15803d;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  z-index: 10;
}

.category-btn.active {
  background-color: #14532d;
  color: white;
  box-shadow: none;
  transform: translateY(0);
  border-bottom: 3px solid #34d399;
  z-index: 5;
}

/* Contadores dentro dos botões de categoria */
.category-btn span .text-xs {
  font-size: 0.75rem;
  line-height: 1rem;
  padding: 0.125rem 0.6rem;
  border-radius: 9999px;
  margin-left: 0.75rem;
  font-weight: 700;
  color: white;
  background-color: #15803d;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.category-btn.active span .text-xs {
  background-color: #166534;
}

/* ===== CATEGORIA CLUB NATUBRAVA ESPECIAL ===== */
.club-category-btn {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
  color: white !important;
  font-weight: 600;
  box-shadow: 0 4px 8px rgba(5, 150, 105, 0.3);
  border: none !important;
  border-bottom: 3px solid transparent !important;
  z-index: 1;
}

.club-category-btn:hover {
  background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
  box-shadow: 0 6px 12px rgba(5, 150, 105, 0.4);
  z-index: 10;
}

.club-category-btn.active {
  background: linear-gradient(135deg, #064e3b 0%, #047857 100%) !important;
  box-shadow: none !important;
  border-bottom: 3px solid #6ee7b7 !important;
  z-index: 5;
}

.club-category-btn span .text-xs {
  background-color: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

/* ===== PADRONIZAÇÃO DE IMAGENS E CARDS ===== */
.product-card { transition: all 0.3s ease; display: flex; flex-direction: column; height: 100%; min-height: 380px; }
.product-card:hover { transform: translateY(-2px); }

/* ALTURA REDUZIDA CONFORME SOLICITADO */
.product-image-container { 
  position: relative; 
  width: 100%; 
  height: 150px !important; /* Reduzido de 220px */
  min-height: 150px; 
  max-height: 150px; 
  overflow: hidden; 
  background-color: #ffffff; 
  border-radius: 0.5rem 0.5rem 0 0; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border: 1px solid #f1f5f9; 
  /* Removido o pointer por padrão, adicionado via JS se tiver detalhes */
}

/* Cursor pointer apenas se tiver detalhes (via JS) */
.product-image-container.has-details-cursor {
  cursor: pointer;
}

.product-image { 
  width: 100% !important; 
  height: 100% !important; 
  min-height: 150px !important; /* Reduzido */
  max-height: 150px !important; /* Reduzido */
  object-fit: contain !important; 
  object-position: center !important; 
  transition: transform 0.3s ease; 
  background-color: #fff; 
  padding: 8px; 
}

.product-card:hover .product-image { transform: scale(1.03); }

.product-image-error { 
  display: flex !important; 
  align-items: center; 
  justify-content: center; 
  width: 100%; 
  height: 150px !important; /* Reduzido */
  min-height: 150px !important; 
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
  color: #666; 
  font-size: 0.9rem; 
  text-align: center; 
  padding: 1rem; 
  border: 1px solid #dee2e6; 
}

.product-card-content { flex: 1; display: flex; flex-direction: column; padding: 1rem; min-height: 200px; }
.product-card-footer { margin-top: auto; }

/* ===== BOTÃO VER DETALHES (NOVO) ===== */
.view-details-btn {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(21, 128, 61, 0.9);
  color: white;
  text-align: center;
  padding: 6px 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.view-details-btn ion-icon { font-size: 1rem; }

/* Exibe o botão ao passar o mouse NO CARD */
.product-card:hover .view-details-btn {
  transform: translateY(0);
}

/* Mobile: Botão sempre visível ou ícone discreto? Deixar sempre visível no mobile pode poluir.
   Melhor deixar como está: mobile o tap na imagem abre.
   A classe .info-btn antiga foi removida do JS.
*/

/* ===== TAGS DO MODAL ===== */
.product-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  white-space: nowrap;
}

/* Cores das Tags */
.tag-gluten { background-color: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; } 
.tag-vegan { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; } 
.tag-lactose { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; } 
.tag-default { background-color: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; } 
.tag-sugar { background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; } 
.tag-preservative { background-color: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; } 


/* ===== BADGES DE DIETA NO CARD (ESTILO PILL - MELHORADO) ===== */
.diet-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 8px;
}

/* Pill Style: Texto + Icone */
.diet-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,0.06);
  gap: 3px;
  white-space: nowrap;
  max-width: 100%;
}

.diet-pill ion-icon {
  font-size: 12px;
}

.diet-pill-text {
  display: inline-block;
}

.diet-pill-gluten { background-color: #ffedd5; color: #9a3412; border-color: #fed7aa; }
.diet-pill-vegan { background-color: #dcfce7; color: #166534; border-color: #bbf7d0; }
.diet-pill-sugar { background-color: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
.diet-pill-lactose { background-color: #fef3c7; color: #92400e; border-color: #fde68a; }
.diet-pill-preservative { background-color: #f3f4f6; color: #374151; border-color: #e5e7eb; }

/* ===== MODAL DETALHES OTIMIZADO ===== */
#product-details-modal .product-details-image {
  max-height: 250px !important;
  max-width: 250px !important;
  width: auto !important;
  height: auto !important;
}

/* MOBILE: LAYOUT THUMBNAIL PARA MODAL */
@media (max-width: 640px) {
  /* Layout vira Grid ou Flex Row para colocar Imagem ao lado do Titulo */
  #product-details-modal .product-details-layout {
    flex-direction: column !important; /* Fallback */
    display: block !important;
  }

  /* Container da imagem vira pequeno e flutua à direita ou flex */
  #product-details-modal .product-details-image-col {
    width: 80px !important;
    height: 80px !important;
    padding: 0 !important;
    min-height: auto !important;
    float: left;
    margin-right: 12px;
    margin-bottom: 8px;
    background: transparent !important;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #product-details-modal .product-details-image {
    max-height: 70px !important;
    max-width: 70px !important;
  }

  /* Ajuste do conteúdo para fluir ao redor ou ao lado */
  #product-details-modal .product-details-info-col {
    padding: 1rem !important;
    display: block !important;
  }

  /* Header do modal (Categoria, Nome) */
  #product-details-modal .product-details-info-col > div:first-child {
    min-height: 80px; /* Garante altura mínima para alinhar com a imagem */
  }

  #detail-name {
    font-size: 1.25rem !important;
    margin-top: 4px !important;
  }

  /* Limpar float após o cabeçalho se necessário, mas o fluxo normal resolve */
}

/* Ajustes finos no mobile */
@media (max-width: 640px) {
  .view-details-chip { font-size: 0.68rem; padding: 6px 9px; }
  
  /* Ajuste das pills no mobile para não quebrar muito */
  .diet-pill {
    padding: 1px 5px;
    font-size: 0.65rem;
  }
}

/* ===== ESTILOS PARA PRODUTOS FORA DE ESTOQUE E ESTOQUE BAIXO ===== */
.out-of-stock-card {
  opacity: 0.75;
  border: 2px solid #ef4444;
  background-color: #fef2f2;
}

.out-of-stock-card:hover {
  transform: none;
  opacity: 0.8;
}

.low-stock-card {
  border: 2px solid #f59e0b;
  background-color: #fffbeb;
}

.low-stock-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.25);
}

/* Imagem em escala de cinza para produtos fora de estoque */
.product-image.grayscale {
  filter: grayscale(100%);
  opacity: 0.6;
}

/* ===== BADGES DE STATUS ===== */
.status-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.out-of-stock-badge {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: white;
  animation: pulse-out-of-stock 2s infinite;
}

.low-stock-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  animation: pulse-low-stock 2s infinite;
}

@keyframes pulse-out-of-stock {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes pulse-low-stock {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

/* ===== BOTÃO "AVISE-ME ASSIM QUE CHEGAR" ===== */
.notify-me-btn {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}

.notify-me-btn:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
}

.notify-me-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}

/* ===== ESTILOS PARA PREÇOS CLUB ===== */
.price-container { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.normal-price { font-size: 0.75rem; color: #6b7280; line-height: 1; }
.original-price { text-decoration: line-through; font-weight: 500; }
.club-price-container { display: flex; align-items: center; gap: 4px; }
.club-badge { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3); animation: pulse-club 2s infinite; }
.club-price { font-size: 1rem; font-weight: 700; color: #059669; text-shadow: 0 1px 2px rgba(5, 150, 105, 0.1); }
.club-info-icon { opacity: 0.7; transition: all 0.2s ease; cursor: pointer; }
.club-info-icon:hover { opacity: 1; transform: scale(1.1); }
@keyframes pulse-club { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.product-card { animation: fadeInUp 0.4s ease-out; }

/* ===== Melhorias Granel e Botões de Quantidade ===== */
.product-card .product-quantity { min-width: 48px; font-weight: 600; color: #15803d; }
.product-card .product-total-price { font-weight: 600; color: #15803d; }
.product-quantity-change, .cart-quantity-change { transition: all 0.2s ease; min-width: 28px; min-height: 28px; display: flex; align-items: center; justify-content: center; }
.product-quantity-change:hover:not(:disabled), .cart-quantity-change:hover:not(:disabled) { background-color: #15803d; color: white; transform: scale(1.1); }
.product-quantity-change:disabled, .cart-quantity-change:disabled { background-color: #f3f4f6; color: #9ca3af; }

/* ===== MELHORIAS NO CARD PARA PRODUTOS CLUB ===== */
.club-product-card {
  border: 2px solid #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.club-product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.25);
}

/* ===== ESTILOS PARA BOTÃO "REGISTRAR INTERESSE" (SEMPRE ATIVO) ===== */
#confirm-notify-button {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%) !important;
  color: white !important;
  border: none !important;
  cursor: pointer !important;
  opacity: 1 !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3) !important;
}

#confirm-notify-button:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4) !important;
}

#confirm-notify-button:active {
  transform: translateY(0) !important;
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3) !important;
}

/* Remove qualquer estilo de desabilitado */
#confirm-notify-button:disabled {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%) !important;
  color: white !important;
  opacity: 1 !important;
  cursor: pointer !important;
}

/* ===== RESPONSIVIDADE GERAL ===== */
@media (max-width: 640px) {
  .cart-panel { max-width: 100%; }
  .product-card { margin-bottom: 1rem; min-height: 400px; }
  /* Reduzido altura no mobile tambem */
  .product-image-container, .product-image, .product-image-error { height: 140px !important; min-height: 140px !important; max-height: 140px !important; }
  .product-card-content { min-height: 200px; }
  .product-card h3 { font-size: 1rem; line-height: 1.2; }
  .product-card .text-lg { font-size: 1rem; }
  .cart-items .text-sm { font-size: 0.8rem; }
  .product-quantity-change, .cart-quantity-change { min-width: 36px; min-height: 36px; }
  .product-card .product-quantity { min-width: 56px; font-size: 0.9rem; }
  .club-badge { font-size: 0.55rem; padding: 1px 4px; }
  .club-price { font-size: 0.9rem; }
  .normal-price { font-size: 0.7rem; }
  .club-category-btn { padding: 8px 12px !important; font-size: 0.8rem; }
  .status-badge { font-size: 0.6rem; padding: 3px 6px; }
  .notify-me-btn { font-size: 0.85rem; padding: 8px 12px; }
}

@media (min-width: 1024px) {
  /* No desktop pode ser um pouco maior, mas mantendo compacto */
  .product-image-container, .product-image, .product-image-error { height: 160px !important; min-height: 160px !important; max-height: 160px !important; }
  .product-card { min-height: 400px; }
}

/* ===== Notificações, Modais e Otimizações Finais ===== */
.cart-notification { box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); backdrop-filter: blur(10px); max-width: 300px; word-wrap: break-word; transition: all 0.3s ease; }
@media (max-width: 640px) {
  #name-modal, #delivery-modal, #club-info-modal, #notify-modal, #product-details-modal { margin: 1rem; max-height: 90vh; overflow-y: auto; max-width: calc(100vw - 2rem); }
  #name-modal, #notify-modal { padding: 1.5rem; }
  #name-modal h3, #notify-modal h3 { font-size: 1.25rem; }
  #name-modal .text-sm, #notify-modal .text-sm { font-size: 0.875rem; }
  #name-modal .text-xs, #notify-modal .text-xs { font-size: 0.75rem; }
}
#name-modal .bg-green-100, #notify-modal .bg-blue-50 { background-color: #dcfce7; }
#name-modal input:focus, #name-modal textarea:focus, #notify-modal input:focus, #notify-modal textarea:focus { ring-width: 2px; ring-color: #10b981; border-color: #10b981; }
#notify-modal input:focus, #notify-modal textarea:focus { ring-color: #3b82f6; border-color: #3b82f6; }
#name-modal button, #notify-modal button { font-weight: 500; }
#name-modal button:focus, #notify-modal button:focus { outline: none; ring-2: #10b981; ring-offset-2; }
#notify-modal button:focus { ring-2: #3b82f6; }
#mobile-menu { animation: slideDown 0.3s ease-out; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
#mobile-menu button { border: none; background: none; text-align: left; transition: all 0.2s ease; }
#mobile-menu button:hover, #mobile-menu a:hover { background-color: #f0fdf4; border-radius: 8px; transform: translateX(4px); }
#mobile-menu-button { transition: transform 0.3s ease; }
#mobile-menu-button:active { transform: scale(0.95); }
.cart-items img { width: 3rem; height: 3rem; object-fit: cover; border-radius: 0.375rem; background-color: #f8f9fa; }
.product-card, .cart-panel, .loading-spinner, .cart-notification { will-change: transform; }
h1, h2, h3, h4, h5, h6 { text-rendering: optimizeLegibility; }
@media (max-width: 768px) { body { -webkit-overflow-scrolling: touch; } }
input, textarea, select { font-size: 1rem; line-height: 1.5rem; }
input:focus, textarea:focus { --tw-ring-offset-width: 0px; --tw-ring-color: #22c55e; }
button { font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }

}
