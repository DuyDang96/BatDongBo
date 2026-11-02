/**
 * ==============================================================================
 * BÀI HỌC VÀ DỰ ÁN MINI STORE XỬ LÝ BẤT ĐỒNG BỘ TRONG JAVASCRIPT
 * ==============================================================================
 * Nội dung chính bao gồm:
 * 1. 4 Trạng thái giao diện: Loading (Đang tải), Success (Có dữ liệu), Empty (Rỗng), Error (Lỗi)
 * 2. Phân trang bằng LIMIT và SKIP:
 *    - Hiển thị "Trang x / y" với y tính từ total (totalPages = Math.ceil(total / limit))
 *    - Khóa nút Trước & Sau khi ở trang đầu, trang cuối hoặc khi đang tải
 *    - Trong lúc chờ API, hiển thị "Đang tải..."
 * 3. Tồn kho bằng 0: ghi "Hết hàng" và làm mờ thẻ (opacity & grayscale)
 * 4. Lưới responsive bằng CSS Grid: 4 cột (máy tính), 2 cột (máy tính bảng), 1 cột (điện thoại)
 * 5. Gọi API bất đồng bộ với Axios + async/await
 * 6. Gọi song song (Parallel execution) bằng Promise.all([fetchCategories(), fetchProducts()])
 * 7. Debounce ô tìm kiếm (tránh spam API khi gõ liên tục)
 * 8. Hủy request cũ (Cancel old request) bằng AbortController
 * ==============================================================================
 */

// ==========================================
// 1. CẤU HÌNH & HẰNG SỐ (CONFIG & CONSTANTS)
// ==========================================
const BASE_API_URL = "https://dummyjson.com/products";
const FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22300%22%20viewBox%3D%220%200%20400%20300%22%3E%3Crect%20fill%3D%22%231e293b%22%20width%3D%22400%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22600%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%227%22%3E%F0%9F%96%BC%EF%B8%8F%20Kh%C3%B4ng%20c%C3%B3%20%E1%BA%A3nh%3C%2Ftext%3E%3C%2Fsvg%3E`;

// Định nghĩa 4 trạng thái giao diện UI
const UI_STATES = {
  LOADING: "LOADING",   // Đang tải dữ liệu
  DATA: "DATA",         // Tải thành công và có dữ liệu
  EMPTY: "EMPTY",       // Dữ liệu trả về rỗng (0 sản phẩm)
  ERROR: "ERROR"        // Lỗi mạng hoặc server không phản hồi
};

// ==========================================
// 2. BIẾN TRẠNG THÁI TOÀN CỤC (GLOBAL STATE)
// ==========================================
const appState = {
  currentUIState: UI_STATES.LOADING,
  products: [],
  categories: [],
  selectedCategory: "all",
  searchKeyword: "",
  sortBy: "default",
  cartCount: 0,
  
  // PHÂN TRANG BẰNG LIMIT VÀ SKIP
  limit: 12,              // 12 sản phẩm mỗi trang (đẹp hoàn hảo với 4 cột máy tính, 2 cột tablet, 1 cột mobile)
  skip: 0,                // Vị trí bắt đầu: skip = (currentPage - 1) * limit
  currentPage: 1,         // Trang x
  total: 0,               // Tổng số sản phẩm từ API
  totalPages: 1,          // Tổng số trang y = Math.ceil(total / limit)
  isLoading: false,       // Cờ đang chờ API phản hồi
  
  // Chế độ mô phỏng kiểm thử
  simulationMode: "normal", // 'normal' | 'empty' | 'error' | 'delay' | 'outofstock'
  
  // AbortController để hủy request cũ
  abortController: null,
  requestId: 0
};

// ==========================================
// 3. CÁC PHẦN TỬ DOM (DOM ELEMENTS)
// ==========================================
const dom = {
  // 4 Containers đại diện 4 trạng thái
  stateLoading: document.getElementById("stateLoading"),
  stateData: document.getElementById("stateData"),
  stateEmpty: document.getElementById("stateEmpty"),
  stateError: document.getElementById("stateError"),
  
  // Product & Skeleton grids
  skeletonGrid: document.getElementById("skeletonGrid"),
  productsGrid: document.getElementById("productsGrid"),
  
  // Dynamic Categories
  categoryPillsContainer: document.getElementById("categoryPillsContainer"),
  
  // Controls
  searchInput: document.getElementById("searchInput"),
  searchFeedbackTag: document.getElementById("searchFeedbackTag"),
  sortSelect: document.getElementById("sortSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  emptyResetBtn: document.getElementById("emptyResetBtn"),
  errorRetryBtn: document.getElementById("errorRetryBtn"),
  
  // Phân trang DOM elements
  paginationWrapper: document.getElementById("paginationWrapper"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageStatusText: document.getElementById("pageStatusText"),
  
  // Status & Telemetry
  asyncStatusBadge: document.getElementById("asyncStatusBadge"),
  asyncStatusText: document.getElementById("asyncStatusText"),
  telemetryTag: document.getElementById("telemetryTag"),
  telemetryMessage: document.getElementById("telemetryMessage"),
  telemetryStats: document.getElementById("telemetryStats"),
  
  // Test simulation buttons
  simNormalBtn: document.getElementById("simNormalBtn"),
  simEmptyBtn: document.getElementById("simEmptyBtn"),
  simErrorBtn: document.getElementById("simErrorBtn"),
  simDelayBtn: document.getElementById("simDelayBtn"),
  simOutOfStockBtn: document.getElementById("simOutOfStockBtn"),
  
  // Cart & Toast
  cartCountBadge: document.getElementById("cartCountBadge"),
  toastContainer: document.getElementById("toastContainer"),
  
  // Modal
  productModal: document.getElementById("productModal"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  modalImg: document.getElementById("modalImg"),
  modalCategory: document.getElementById("modalCategory"),
  modalDiscount: document.getElementById("modalDiscount"),
  modalTitle: document.getElementById("modalTitle"),
  modalStars: document.getElementById("modalStars"),
  modalRatingScore: document.getElementById("modalRatingScore"),
  modalStock: document.getElementById("modalStock"),
  modalDesc: document.getElementById("modalDesc"),
  modalPrice: document.getElementById("modalPrice"),
  modalOriginalPrice: document.getElementById("modalOriginalPrice"),
  modalAddToCartBtn: document.getElementById("modalAddToCartBtn")
};

// ==========================================
// 4. QUẢN LÝ 4 TRẠNG THÁI GIAO DIỆN & PHÂN TRANG
// ==========================================
/**
 * Chuyển đổi linh hoạt giữa 4 trạng thái: LOADING, DATA, EMPTY, ERROR
 */
function setUIState(newState, message = "") {
  appState.currentUIState = newState;
  
  // Ẩn tất cả các container trạng thái
  dom.stateLoading.classList.remove("active");
  dom.stateData.classList.remove("active");
  dom.stateEmpty.classList.remove("active");
  dom.stateError.classList.remove("active");

  switch (newState) {
    case UI_STATES.LOADING:
      dom.stateLoading.classList.add("active");
      updateAsyncBadge(true, "Đang tải dữ liệu...");
      updateTelemetry("FETCH", `Đang gửi request trang <b>${appState.currentPage}</b>...`, "Chờ phản hồi");
      // Khi đang tải: Hiện "Đang tải..." và khóa nút Trước / Sau
      setPaginationLoading(true);
      if (dom.paginationWrapper) dom.paginationWrapper.style.display = "flex";
      break;

    case UI_STATES.DATA:
      dom.stateData.classList.add("active");
      updateAsyncBadge(false, "Đã sẵn sàng");
      updateTelemetry("SUCCESS", message || `Trang ${appState.currentPage}/${appState.totalPages} (${appState.products.length} SP)`, "200 OK");
      setPaginationLoading(false);
      if (dom.paginationWrapper) dom.paginationWrapper.style.display = "flex";
      break;

    case UI_STATES.EMPTY:
      dom.stateEmpty.classList.add("active");
      updateAsyncBadge(false, "Kết quả rỗng");
      updateTelemetry("EMPTY", message || "Không tìm thấy dữ liệu phù hợp", "0 sản phẩm");
      if (dom.paginationWrapper) dom.paginationWrapper.style.display = "none";
      break;

    case UI_STATES.ERROR:
      dom.stateError.classList.add("active");
      updateAsyncBadge(false, "Lỗi kết nối");
      document.getElementById("errorMessage").textContent = message || "Không thể tải dữ liệu từ API. Hãy kiểm tra lại kết nối.";
      updateTelemetry("ERROR", message || "Gặp lỗi trong quá trình xử lý", "500 Error");
      if (dom.paginationWrapper) dom.paginationWrapper.style.display = "none";
      break;
  }
}

/**
 * CẬP NHẬT TRẠNG THÁI PHÂN TRANG
 * Yêu cầu:
 * - Hiện "Trang x / y", với y tính từ total (y = Math.ceil(total / limit))
 * - Trong lúc chờ API, hiện "Đang tải..."
 * - Nút Trước và Sau bị khoá khi ở trang đầu, trang cuối hoặc khi đang tải
 */
function setPaginationLoading(isLoading) {
  appState.isLoading = isLoading;
  
  if (isLoading) {
    // Trong lúc chờ API: hiện "Đang tải..."
    dom.pageStatusText.classList.add("loading");
    dom.pageStatusText.innerHTML = '<span class="spin-icon">⏳</span> Đang tải...';
    // Khóa cả hai nút Trước và Sau khi đang tải
    dom.prevPageBtn.disabled = true;
    dom.nextPageBtn.disabled = true;
  } else {
    dom.pageStatusText.classList.remove("loading");
    updatePaginationUI();
  }
}

function updatePaginationUI() {
  const { currentPage, totalPages, isLoading } = appState;
  
  // Hiển thị chuẩn: "Trang x / y"
  dom.pageStatusText.textContent = `Trang ${currentPage} / ${totalPages}`;
  
  // Nút Trước bị khóa khi ở trang đầu (currentPage <= 1) hoặc khi đang tải
  dom.prevPageBtn.disabled = (currentPage <= 1) || isLoading;
  
  // Nút Sau bị khóa khi ở trang cuối (currentPage >= totalPages) hoặc khi đang tải
  dom.nextPageBtn.disabled = (currentPage >= totalPages) || isLoading;
}

// Cuộn mượt về đầu lưới sản phẩm khi chuyển trang
function scrollToProducts() {
  const controls = document.querySelector(".controls-section");
  if (controls) {
    controls.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Cập nhật huy hiệu trạng thái trên thanh Header
function updateAsyncBadge(isBusy, text) {
  if (isBusy) {
    dom.asyncStatusBadge.classList.add("busy");
  } else {
    dom.asyncStatusBadge.classList.remove("busy");
  }
  dom.asyncStatusText.textContent = text;
}

// Cập nhật thanh nhật ký telemetry thời gian thực
function updateTelemetry(tag, message, stats) {
  dom.telemetryTag.textContent = tag;
  dom.telemetryMessage.innerHTML = message;
  dom.telemetryStats.textContent = stats;
}

// ==========================================
// 5. TIỆN ÍCH BẤT ĐỒNG BỘ (ASYNC UTILITIES)
// ==========================================

/**
 * HÀM DEBOUNCE (Trì hoãn thực thi)
 */
function debounce(fn, delay = 400) {
  let timerId = null;
  return function (...args) {
    dom.searchFeedbackTag.classList.add("typing");
    dom.searchFeedbackTag.textContent = `⏳ Đang gõ... (chờ ${delay}ms)`;

    if (timerId) clearTimeout(timerId);

    timerId = setTimeout(() => {
      dom.searchFeedbackTag.classList.remove("typing");
      dom.searchFeedbackTag.textContent = "✓ Đã áp dụng bộ lọc";
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Tạo thẻ Skeleton Loading dạng Shimmer (12 thẻ ứng với 4 cột x 3 hàng)
 */
function renderSkeletons(count = 12) {
  dom.skeletonGrid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML = `
      <div class="skeleton-thumb shimmer-anim"></div>
      <div class="skeleton-line category shimmer-anim"></div>
      <div class="skeleton-line title shimmer-anim"></div>
      <div class="skeleton-line desc-1 shimmer-anim"></div>
      <div class="skeleton-line desc-2 shimmer-anim"></div>
      <div class="skeleton-footer">
        <div class="skeleton-line price shimmer-anim"></div>
        <div class="skeleton-btn shimmer-anim"></div>
      </div>
    `;
    dom.skeletonGrid.appendChild(card);
  }
}

// ==========================================
// 6. GỌI API & XỬ LÝ BẤT ĐỒNG BỘ
// ==========================================

/**
 * HÀM LẤY DANH SÁCH DANH MỤC (Promise.all)
 */
async function fetchCategories(signal) {
  try {
    const response = await axios.get(`${BASE_API_URL}/categories`, { signal });
    return response.data || [];
  } catch (error) {
    console.warn("Lỗi khi tải danh mục (sử dụng danh mục mặc định):", error);
    return [];
  }
}

/**
 * HÀM LẤY SẢN PHẨM VỚI ABORTCONTROLLER, LIMIT & SKIP
 */
async function fetchProducts(params = {}) {
  const currentReqId = ++appState.requestId;

  // 1. HỦY REQUEST CŨ NẾU CÒN ĐANG CHẠY (AbortController)
  if (appState.abortController) {
    appState.abortController.abort();
    console.log(`🛑 [AbortController] Đã hủy request #${appState.requestId - 1} để nhường cho request mới #${currentReqId}`);
    dom.searchFeedbackTag.classList.add("aborted");
    dom.searchFeedbackTag.textContent = "🛑 Đã hủy request cũ!";
    setTimeout(() => dom.searchFeedbackTag.classList.remove("aborted"), 800);
  }

  // Khởi tạo AbortController mới
  appState.abortController = new AbortController();
  const signal = appState.abortController.signal;

  // 2. HIỆN TRẠNG THÁI LOADING (Trong lúc chờ API: hiện "Đang tải...")
  setUIState(UI_STATES.LOADING);

  try {
    // Xử lý chế độ thử nghiệm (Simulation Mode)
    if (appState.simulationMode === "error") {
      await new Promise(resolve => setTimeout(resolve, 600));
      throw new Error("ERR_SIMULATED: Máy chủ gặp sự cố (500 Internal Server Error)!");
    }

    if (appState.simulationMode === "delay") {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // TÍNH TOÁN SKIP DỰA TRÊN CURRENT PAGE VÀ LIMIT
    const skip = (appState.currentPage - 1) * appState.limit;
    appState.skip = skip;

    // Xây dựng URL API với LIMIT và SKIP
    let url = `${BASE_API_URL}?limit=${appState.limit}&skip=${skip}`;

    if (params.search && params.search.trim() !== "") {
      url = `${BASE_API_URL}/search?q=${encodeURIComponent(params.search.trim())}&limit=${appState.limit}&skip=${skip}`;
    } else if (params.category && params.category !== "all") {
      url = `${BASE_API_URL}/category/${encodeURIComponent(params.category)}?limit=${appState.limit}&skip=${skip}`;
    }

    // Giả lập kết quả rỗng
    if (appState.simulationMode === "empty") {
      url = `${BASE_API_URL}/search?q=thiskeyworddoesnotexistatall12345xyz&limit=${appState.limit}&skip=0`;
    }

    console.log(`🚀 [Request #${currentReqId}] Đang gọi API với limit=${appState.limit}&skip=${skip}:`, url);

    // GỌI AXIOS VỚI SIGNAL
    const response = await axios.get(url, { signal });

    // Trích xuất danh sách sản phẩm
    let rawProducts = response?.data?.products || [];

    // TÍNH TOÁN PHÂN TRANG: y tính từ total (y = Math.ceil(total / limit))
    const total = typeof response?.data?.total === "number" ? response.data.total : rawProducts.length;
    appState.total = total;
    appState.totalPages = Math.ceil(total / appState.limit) || 1;

    // Áp dụng sắp xếp client nếu có
    rawProducts = sortProducts(rawProducts, appState.sortBy);
    appState.products = rawProducts;

    console.log(`✅ [Request #${currentReqId}] Phản hồi: ${rawProducts.length} SP | Tổng số: ${total} | Trang: ${appState.currentPage}/${appState.totalPages}`);

    // 3. KIỂM TRA TRẠNG THÁI RỖNG (EMPTY STATE)
    if (!rawProducts || rawProducts.length === 0) {
      setUIState(UI_STATES.EMPTY, `Không tìm thấy sản phẩm nào khớp với "${params.search || params.category || 'bộ lọc'}"`);
      return;
    }

    // 4. KIỂM TRA TRẠNG THÁI CÓ DỮ LIỆU (SUCCESS STATE)
    renderProductsToDOM(rawProducts);
    setUIState(UI_STATES.DATA, `Trang <b>${appState.currentPage}/${appState.totalPages}</b> &bull; Hiển thị ${rawProducts.length} sản phẩm`);

  } catch (error) {
    // 5. KIỂM TRA LỖI DO HỦY REQUEST HAY DO MẠNG
    if (axios.isCancel(error) || error.name === "CanceledError" || error.name === "AbortError") {
      console.log(`ℹ️ [Request #${currentReqId}] Đã bị hủy bỏ một cách an toàn. Bỏ qua cập nhật lỗi UI.`);
      return;
    }

    // Lỗi mạng thực tế
    console.error(`❌ [Request #${currentReqId}] Gặp lỗi khi gọi API:`, error);
    document.getElementById("errorCodeDetail").textContent = `${error.name || 'Error'}: ${error.message || 'Không thể kết nối'}`;
    setUIState(UI_STATES.ERROR, error.message || "Không thể tải dữ liệu từ máy chủ API");
  } finally {
    if (appState.requestId === currentReqId) {
      appState.abortController = null;
      appState.isLoading = false;
    }
  }
}

/**
 * GỌI SONG SONG (PARALLEL FETCHING) BẰNG PROMISE.ALL
 */
async function initializeAppParallel() {
  renderSkeletons(12);
  setUIState(UI_STATES.LOADING);
  updateTelemetry("INIT", "⚡ Đang chạy <b>Promise.all</b> gọi song song Danh mục & Sản phẩm...", "Promise.all");

  try {
    const controller = new AbortController();
    appState.abortController = controller;

    // Chạy song song cả hai tác vụ
    const [categoriesData, _] = await Promise.all([
      fetchCategories(controller.signal),
      fetchProducts({ category: "all" })
    ]);

    renderCategories(categoriesData);
    console.log("🌟 Gọi song song hoàn tất qua Promise.all!");
  } catch (error) {
    if (!axios.isCancel(error)) {
      console.error("Lỗi khi khởi tạo ứng dụng:", error);
      setUIState(UI_STATES.ERROR, "Lỗi khi nạp dữ liệu ban đầu.");
    }
  }
}

// ==========================================
// 7. RENDER DỮ LIỆU PHÒNG THỦ & XỬ LÝ HẾT HÀNG
// ==========================================

/**
 * Xử lý sự kiện ảnh bị lỗi không tải được
 */
window.handleImgError = function(imgElement) {
  if (imgElement) {
    imgElement.onerror = null;
    imgElement.src = FALLBACK_IMAGE;
    imgElement.alt = "Ảnh không khả dụng";
  }
};

/**
 * Render dữ liệu sản phẩm từ response.data.products ra DOM.
 * Yêu cầu đặc biệt:
 * - Tồn kho bằng 0 thì ghi "Hết hàng" và làm mờ thẻ.
 * - CSS Grid: 4 cột trên máy tính, 2 cột trên máy tính bảng, 1 cột trên điện thoại.
 * - Phòng thủ chống vỡ layout khi thiếu ảnh hoặc dữ liệu.
 */
function renderProductsToDOM(products) {
  dom.productsGrid.innerHTML = "";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });

  products.forEach(product => {
    const id = product?.id || Math.random();
    const title = escapeHtml(product?.title || "Sản phẩm chưa đặt tên");
    const description = escapeHtml(product?.description || "Chưa có thông tin mô tả chi tiết cho sản phẩm này.");
    const category = escapeHtml(product?.category || "Khác");
    const price = typeof product?.price === "number" ? product.price : 0;
    const discount = typeof product?.discountPercentage === "number" ? Math.round(product.discountPercentage) : 0;
    const originalPrice = discount > 0 ? (price / (1 - discount / 100)) : price;
    const rating = typeof product?.rating === "number" ? product.rating.toFixed(1) : "5.0";
    
    // KIỂM TRA TỒN KHO: TỒN KHO BẰNG 0 THÌ GHI "HẾT HÀNG" VÀ LÀM MỜ THẺ
    let stock = typeof product?.stock === "number" ? product.stock : 10;
    
    // Khi bật nút kiểm thử 'Giả lập SP Hết hàng', ép một số sản phẩm có stock = 0 để dễ dàng chấm điểm/kiểm tra
    if (appState.simulationMode === "outofstock" && (id === 1 || id === 3 || id === 6)) {
      stock = 0;
    }
    
    const isOutOfStock = stock <= 0;

    // Ưu tiên thumbnail, fallback an toàn
    const imageSrc = (product?.thumbnail && typeof product.thumbnail === "string" && product.thumbnail.trim() !== "")
      ? product.thumbnail
      : (Array.isArray(product?.images) && product.images.length > 0 ? product.images[0] : FALLBACK_IMAGE);

    const starsHtml = renderStarRating(rating);

    // Thẻ sản phẩm: Thêm class 'card-out-of-stock' nếu tồn kho bằng 0
    const card = document.createElement("div");
    card.className = `product-card ${isOutOfStock ? 'card-out-of-stock' : ''}`;
    card.setAttribute("data-id", id);
    
    card.innerHTML = `
      <div class="card-media">
        <div class="card-badges">
          ${discount > 0 ? `<span class="badge discount">-${discount}%</span>` : ''}
          <span class="badge category">${category}</span>
        </div>
        
        <!-- Badge Tồn kho: Tồn kho bằng 0 thì ghi 'Hết hàng' -->
        <span class="badge stock ${isOutOfStock ? 'out-of-stock' : (stock > 5 ? 'in-stock' : 'low-stock')}">
          ${isOutOfStock ? 'Hết hàng' : (stock > 0 ? `Còn ${stock} cái` : 'Hết hàng')}
        </span>
        
        <img 
          src="${imageSrc}" 
          alt="${title}" 
          class="card-img" 
          loading="lazy" 
          onerror="handleImgError(this)"
        />
      </div>

      <div class="card-body">
        <div class="card-rating">
          <span class="stars">${starsHtml}</span>
          <span class="score">${rating}</span>
        </div>
        
        <h3 class="card-title" title="${title}">${title}</h3>
        <p class="card-desc" title="${description}">${description}</p>
        
        <div class="card-footer">
          <div class="price-box">
            <span class="price-current">${formatter.format(price)}</span>
            ${discount > 0 ? `<span class="price-original">${formatter.format(originalPrice)}</span>` : ''}
          </div>
          
          <!-- Nút thêm vào giỏ: Bị khóa nếu hết hàng -->
          <button 
            class="btn-add-cart ${isOutOfStock ? 'disabled' : ''}" 
            data-id="${id}" 
            title="${isOutOfStock ? 'Sản phẩm đã hết hàng' : 'Thêm vào giỏ hàng'}" 
            aria-label="${isOutOfStock ? 'Hết hàng' : 'Thêm ' + title + ' vào giỏ'}"
            ${isOutOfStock ? 'disabled' : ''}
          >
            ${isOutOfStock ? '🚫' : '🛒'}
          </button>
        </div>
      </div>
    `;

    // Click vào card để xem chi tiết
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-add-cart")) return;
      openProductModal({ ...product, stock });
    });

    // Thêm vào giỏ hàng nếu còn hàng
    const addCartBtn = card.querySelector(".btn-add-cart");
    if (addCartBtn && !isOutOfStock) {
      addCartBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(product);
      });
    }

    dom.productsGrid.appendChild(card);
  });
}

/**
 * Render thanh filter danh mục động
 */
function renderCategories(categories) {
  dom.categoryPillsContainer.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `cat-pill ${appState.selectedCategory === "all" ? "active" : ""}`;
  allBtn.setAttribute("data-category", "all");
  allBtn.textContent = "Tất cả sản phẩm";
  allBtn.addEventListener("click", () => selectCategory("all", allBtn));
  dom.categoryPillsContainer.appendChild(allBtn);

  if (Array.isArray(categories)) {
    categories.slice(0, 14).forEach(cat => {
      const slug = typeof cat === "object" ? (cat.slug || cat.name) : cat;
      const name = typeof cat === "object" ? (cat.name || cat.slug) : cat;

      const btn = document.createElement("button");
      btn.className = `cat-pill ${appState.selectedCategory === slug ? "active" : ""}`;
      btn.setAttribute("data-category", slug);
      btn.textContent = name;

      btn.addEventListener("click", () => selectCategory(slug, btn));
      dom.categoryPillsContainer.appendChild(btn);
    });
  }
}

function selectCategory(categorySlug, activeBtnElement) {
  appState.selectedCategory = categorySlug;
  appState.searchKeyword = "";
  appState.currentPage = 1; // Reset về trang 1 khi đổi danh mục
  dom.searchInput.value = "";

  document.querySelectorAll(".cat-pill").forEach(el => el.classList.remove("active"));
  if (activeBtnElement) activeBtnElement.classList.add("active");

  fetchProducts({ category: categorySlug });
}

// ==========================================
// 8. TÌM KIẾM, SẮP XẾP, PHÂN TRANG VÀ TƯƠNG TÁC
// ==========================================

/**
 * Xử lý sự kiện tìm kiếm với Debounce (400ms)
 */
const handleDebouncedSearch = debounce((keyword) => {
  appState.searchKeyword = keyword;
  appState.currentPage = 1; // Reset về trang 1 khi gõ tìm kiếm mới
  
  if (keyword.trim() !== "") {
    document.querySelectorAll(".cat-pill").forEach(el => el.classList.remove("active"));
    fetchProducts({ search: keyword });
  } else {
    fetchProducts({ category: appState.selectedCategory });
  }
}, 400);

dom.searchInput.addEventListener("input", (e) => {
  const value = e.target.value;
  handleDebouncedSearch(value);
});

// Sắp xếp sản phẩm
dom.sortSelect.addEventListener("change", (e) => {
  appState.sortBy = e.target.value;
  if (appState.products && appState.products.length > 0) {
    appState.products = sortProducts(appState.products, appState.sortBy);
    renderProductsToDOM(appState.products);
  }
});

function sortProducts(items, sortKey) {
  const list = [...items];
  switch (sortKey) {
    case "price-asc":
      return list.sort((a, b) => (a.price || 0) - (b.price || 0));
    case "price-desc":
      return list.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "rating-desc":
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "title-asc":
      return list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    default:
      return list;
  }
}

// XỬ LÝ SỰ KIỆN PHÂN TRANG: NÚT TRƯỚC VÀ NÚT SAU
dom.prevPageBtn.addEventListener("click", () => {
  if (appState.currentPage > 1 && !appState.isLoading) {
    appState.currentPage--;
    fetchProducts({
      search: appState.searchKeyword,
      category: appState.selectedCategory
    });
    scrollToProducts();
  }
});

dom.nextPageBtn.addEventListener("click", () => {
  if (appState.currentPage < appState.totalPages && !appState.isLoading) {
    appState.currentPage++;
    fetchProducts({
      search: appState.searchKeyword,
      category: appState.selectedCategory
    });
    scrollToProducts();
  }
});

// Nút làm mới dữ liệu
dom.refreshBtn.addEventListener("click", () => {
  showToast("🔄 Đang tải lại danh sách sản phẩm...");
  fetchProducts({
    search: appState.searchKeyword,
    category: appState.selectedCategory
  });
});

// Nút reset ở Empty state
dom.emptyResetBtn.addEventListener("click", () => {
  appState.simulationMode = "normal";
  resetSimulationButtons();
  appState.searchKeyword = "";
  appState.currentPage = 1;
  dom.searchInput.value = "";
  selectCategory("all", document.querySelector('.cat-pill[data-category="all"]'));
});

// Nút thử lại ở Error state
dom.errorRetryBtn.addEventListener("click", () => {
  appState.simulationMode = "normal";
  resetSimulationButtons();
  fetchProducts({
    search: appState.searchKeyword,
    category: appState.selectedCategory
  });
});

// ==========================================
// 9. THANH THỬ NGHIỆM TRẠNG THÁI (SIMULATION LAB)
// ==========================================
function resetSimulationButtons() {
  [dom.simNormalBtn, dom.simEmptyBtn, dom.simErrorBtn, dom.simDelayBtn, dom.simOutOfStockBtn].forEach(b => {
    if (b) b.classList.remove("active");
  });
  if (dom.simNormalBtn) dom.simNormalBtn.classList.add("active");
}

function handleSimulationMode(mode, targetBtn) {
  appState.simulationMode = mode;
  [dom.simNormalBtn, dom.simEmptyBtn, dom.simErrorBtn, dom.simDelayBtn, dom.simOutOfStockBtn].forEach(b => {
    if (b) b.classList.remove("active");
  });
  if (targetBtn) targetBtn.classList.add("active");

  showToast(`🧪 Đã kích hoạt: ${targetBtn.textContent}`);
  fetchProducts({
    search: appState.searchKeyword,
    category: appState.selectedCategory
  });
}

dom.simNormalBtn.addEventListener("click", () => handleSimulationMode("normal", dom.simNormalBtn));
dom.simEmptyBtn.addEventListener("click", () => handleSimulationMode("empty", dom.simEmptyBtn));
dom.simErrorBtn.addEventListener("click", () => handleSimulationMode("error", dom.simErrorBtn));
dom.simDelayBtn.addEventListener("click", () => handleSimulationMode("delay", dom.simDelayBtn));
if (dom.simOutOfStockBtn) {
  dom.simOutOfStockBtn.addEventListener("click", () => handleSimulationMode("outofstock", dom.simOutOfStockBtn));
}

// ==========================================
// 10. MODAL CHI TIẾT & GIỎ HÀNG (UX ENHANCEMENTS)
// ==========================================
function openProductModal(product) {
  if (!product) return;
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const isOutOfStock = (product.stock <= 0);
  
  dom.modalImg.src = product.thumbnail || FALLBACK_IMAGE;
  dom.modalImg.onerror = () => handleImgError(dom.modalImg);
  dom.modalCategory.textContent = product.category || "General";
  dom.modalDiscount.textContent = product.discountPercentage ? `-${Math.round(product.discountPercentage)}%` : "Hot";
  dom.modalTitle.textContent = product.title || "Chi tiết sản phẩm";
  dom.modalStars.innerHTML = renderStarRating(product.rating || 5);
  dom.modalRatingScore.textContent = (product.rating || 5).toFixed(1);
  dom.modalStock.textContent = isOutOfStock ? "Tình trạng: Hết hàng" : `Kho: ${product.stock} sản phẩm`;
  dom.modalStock.style.color = isOutOfStock ? "var(--accent-rose)" : "var(--accent-emerald)";
  dom.modalDesc.textContent = product.description || "Chưa có mô tả.";
  dom.modalPrice.textContent = formatter.format(product.price || 0);
  
  const originalPrice = product.discountPercentage ? (product.price / (1 - product.discountPercentage / 100)) : product.price;
  dom.modalOriginalPrice.textContent = formatter.format(originalPrice);

  dom.modalAddToCartBtn.disabled = isOutOfStock;
  dom.modalAddToCartBtn.innerHTML = isOutOfStock ? "<span>🚫 Hết hàng</span>" : "<span>🛒 Thêm vào giỏ</span>";
  dom.modalAddToCartBtn.style.opacity = isOutOfStock ? "0.5" : "1";
  dom.modalAddToCartBtn.style.cursor = isOutOfStock ? "not-allowed" : "pointer";

  dom.modalAddToCartBtn.onclick = () => {
    if (!isOutOfStock) {
      addToCart(product);
      closeProductModal();
    }
  };

  dom.productModal.classList.add("open");
}

function closeProductModal() {
  dom.productModal.classList.remove("open");
}

dom.modalCloseBtn.addEventListener("click", closeProductModal);
dom.productModal.addEventListener("click", (e) => {
  if (e.target === dom.productModal) closeProductModal();
});

// Giỏ hàng
function addToCart(product) {
  appState.cartCount++;
  dom.cartCountBadge.textContent = appState.cartCount;
  showToast(`🛒 Đã thêm <b>${escapeHtml(product.title || 'Sản phẩm')}</b> vào giỏ!`);
}

document.getElementById("cartBtn").addEventListener("click", () => {
  showToast(`🛒 Giỏ hàng của bạn đang có <b>${appState.cartCount}</b> món đồ!`);
});

// Toast notification
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>⚡</span> <span>${msg}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// Utility: render star icons
function renderStarRating(ratingNum) {
  const rounded = Math.round(Number(ratingNum) || 5);
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? "★" : "☆";
  }
  return stars;
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 11. KHỞI CHẠY ỨNG DỤNG (ENTRY POINT)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("⚡ Ứng dụng Mini Store bắt đầu khởi chạy với Promise.all & Phân trang!");
  initializeAppParallel();
});
