// prettier-ignore
import { images, seedProducts, seedOrders, seedDeliveries, money, date } from './data.js?v=home4';
// prettier-ignore
import { SUPABASE_URL, SUPABASE_ANON_KEY, CONTACT_FACEBOOK_URL, CONTACT_INSTAGRAM_URL, CONTACT_PHONE } from './config.js?v=home4';

const root = document.querySelector('#root');
const statuses = [
  'Pending',
  'Processing',
  'Packed',
  'Ready for dispatch',
  'Completed',
];

// Validate stored demo records before loading them into the interface.
const validRows = (value) =>
  Array.isArray(value) &&
  value.every((row) => row && typeof row === 'object' && !Array.isArray(row));
const demoSnapshot = (() => {
  try {
    const value = JSON.parse(localStorage.getItem('onsieng-demo-v2'));
    return value &&
      ['products', 'orders', 'alerts', 'deliveries'].every((key) =>
        validRows(value[key]),
      )
      ? value
      : null;
  } catch {
    return null;
  }
})();
const validDemoRows = (key, value) =>
  validRows(value) &&
  value.every((row) => {
    const textKeys =
      key === 'onsieng-products'
        ? ['id', 'name', 'code', 'category']
        : key === 'onsieng-orders'
          ? ['id', 'customer', 'status', 'created_at']
          : key === 'onsieng-deliveries'
            ? ['id', 'order_id', 'status', 'assigned_driver']
            : ['message'];
    if (!textKeys.every((field) => typeof row[field] === 'string'))
      return false;
    if (key === 'onsieng-products')
      return (
        Number.isFinite(Number(row.price)) &&
        Number.isInteger(row.stock) &&
        row.stock >= 0
      );
    if (key === 'onsieng-orders')
      return (
        Number.isFinite(Number(row.total)) &&
        validRows(row.items) &&
        row.items.every(
          (i) =>
            typeof i.name === 'string' &&
            Number.isFinite(Number(i.price)) &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0,
        )
      );
    if (key === 'onsieng-deliveries')
      return (
        validRows(row.history) &&
        row.history.every(
          (e) => typeof e.status === 'string' && typeof e.at === 'string',
        )
      );
    return true;
  });
const readLocal = (key, fallback) => {
  try {
    const value =
      demoSnapshot?.[key.replace('onsieng-', '')] ??
      JSON.parse(localStorage.getItem(key));
    return validDemoRows(key, value) ? value : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
};

// Shared data and UI state. Render functions rebuild the root from this state.
const state = {
  products: readLocal('onsieng-products', seedProducts),
  orders: readLocal('onsieng-orders', seedOrders),
  alerts: readLocal('onsieng-alerts', []),
  deliveries: readLocal('onsieng-deliveries', seedDeliveries),
  trackingId: null,
  deliveryReady: true,
  role: 'guest',
  page: 'Shop',
  showAuth: false,
  catalogError: '',
  search: '',
  storeCategory: '',
  cart: [],
  modal: '',
  selected: null,
  session: null,
  profile: null,
  staff: [],
  team: [],
  mobile: false,
  authSignup: false,
  busy: false,
};
let supabase = null;
let noticeTimer;

// Escape values before inserting them into HTML; accept only HTTP(S) image URLs.
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const safeUrl = (value) => {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : images.chair;
  } catch {
    return images.chair;
  }
};

// SVG paths for icons reused across the storefront and workspace.
const paths = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  bag: '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  package: '<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
  boxes:
    '<path d="m12 2 5 3-5 3-5-3 5-3ZM7 5v5l5 3 5-3V5M7 12l5 3-5 3-5-3 5-3ZM2 15v5l5 3 5-3v-5m5-3 5 3-5 3-5-3 5-3Zm-5 3v5l5 3 5-3v-5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/>',
  chart: '<path d="M3 3v18h18M7 16v-4m5 4V7m5 9v-7"/>',
  store: '<path d="M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6"/>',
  clipboard:
    '<rect x="4" y="4" width="16" height="18" rx="2"/><path d="M9 4h6v3H9zM8 12h8M8 16h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  truck:
    '<path d="M3 5h12v11H3zM15 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cart: '<path d="M3 4h2l2 11h11l3-8H6"/><circle cx="9" cy="19" r="1"/><circle cx="18" cy="19" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  alert: '<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.package}</svg>`;
paths.facebook =
  '<path d="M14 21v-8h3l.5-3H14V8c0-1 .5-2 2-2h2V3.2c-.4-.1-1.4-.2-2.5-.2C12.8 3 11 4.6 11 7.6V10H8v3h3v8"/>';
paths.instagram =
  '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>';
paths.phone =
  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.6 9.5a16 16 0 0 0 6.9 6.9l1.3-1.3a2 2 0 0 1 1.7-.6l2.8.4a2 2 0 0 1 1.7 2Z"/>';
const navIcons = {
  Overview: 'dashboard',
  Orders: 'bag',
  Products: 'package',
  Inventory: 'boxes',
  Customers: 'users',
  Team: 'users',
  Reports: 'chart',
  Shop: 'store',
  'My orders': 'clipboard',
  'Assigned orders': 'clipboard',
  Deliveries: 'truck',
};
const button = (action, content, cls = '', attrs = '') =>
  `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${content}</button>`;
const brand = () =>
  `<div class="brand"><div class="brand-mark"><span></span><span></span><span></span><span></span></div><div><strong>onsieng<span>.</span></strong><small>WAREHOUSE &amp; COMMERCE</small></div></div>`;
const productImage = (p) =>
  `<div class="product-image"><img src="${esc(safeUrl(p.image))}" alt="${esc(p.name)}" data-fallback="${esc(images.chair)}"></div>`;
const badge = (s) =>
  `<span class="badge ${esc(s.toLowerCase().replaceAll(' ', '-'))}"><i></i>${esc(s)}</span>`;
const modal = (title, content) =>
  `<div class="modal-overlay" data-action="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">` +
  `<div class="modal-head"><h2>${esc(title)}</h2>${button('close', icon('x', 19), 'icon-button', 'aria-label="Close"')}` +
  `</div>${content}</div></div>`;
const pageTitle = (eyebrow, title, description, action = '') =>
  `<div class="page-heading"><div><div class="eyebrow"><span></span>${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`;
const empty = (text) => `<div class="empty">${esc(text)}</div>`;
const metric = (symbol, label, value, note, tone) =>
  `<div class="metric"><div class="metric-top"><span class="metric-icon ${tone}">${icon(symbol, 19)}</span>${icon('up', 16)}` +
  `</div><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small><span>●</span> ${esc(note)}</small></div>`;
const dataId = (value) => `data-id="${esc(value)}"`;

// Save demo data in this browser. Connected projects store their data in Supabase.
function persist() {
  if (supabase) return;
  try {
    localStorage.setItem(
      'onsieng-demo-v2',
      JSON.stringify({
        products: state.products,
        orders: state.orders,
        alerts: state.alerts,
        deliveries: state.deliveries,
        catalogVersion: 2,
      }),
    );
  } catch {
    setTimeout(
      () =>
        flash(
          'Browser storage is unavailable. Changes will last only until this page is reloaded.',
        ),
      0,
    );
  }
}

// Add the newer sample products to old demos once without replacing existing items.
function upgradeDemoCatalog() {
  if (SUPABASE_URL || SUPABASE_ANON_KEY || demoSnapshot?.catalogVersion === 2)
    return;
  let saved = !!demoSnapshot;
  try {
    saved ||= validDemoRows(
      'onsieng-products',
      JSON.parse(localStorage.getItem('onsieng-products')),
    );
  } catch {}
  if (!saved) return;
  const ids = new Set(state.products.map((p) => p.id)),
    codes = new Set(state.products.map((p) => p.code));
  for (const product of seedProducts.slice(6))
    if (!ids.has(product.id) && !codes.has(product.code)) {
      state.products.push(structuredClone(product));
      ids.add(product.id);
      codes.add(product.code);
    }
  persist();
}
const homePage = (role) =>
  role === 'customer'
    ? 'Shop'
    : role === 'staff'
      ? 'Assigned orders'
      : role === 'driver'
        ? 'Deliveries'
        : 'Overview';

// Clear the previous account's data and reset the UI when the session changes.
function clearAccountData() {
  Object.assign(state, {
    products: [],
    orders: [],
    deliveries: [],
    alerts: [],
    team: [],
    staff: [],
    cart: [],
    selected: null,
    trackingId: null,
    modal: '',
    profile: null,
    search: '',
    storeCategory: '',
    mobile: false,
    role: 'guest',
    page: 'Shop',
    showAuth: false,
  });
}

// Check that an async save still belongs to the account that started it.
function assertAccount(userId) {
  if (supabase && state.session?.user?.id !== userId)
    throw new Error(
      'Your account changed. Please reload the current workspace.',
    );
}

// Drop unavailable items and update cart quantities and prices from the catalog.
function reconcileCart() {
  let changed = false;
  state.cart = state.cart.flatMap((item) => {
    const product = getProduct(String(item.id));
    if (!product || product.stock <= 0) {
      changed = true;
      return [];
    }
    const quantity = Math.min(item.quantity, product.stock);
    if (
      quantity !== item.quantity ||
      Number(item.price) !== Number(product.price)
    )
      changed = true;
    return [{ ...product, quantity }];
  });
  return changed;
}

// Replace the current message with a temporary status notification.
function flash(text) {
  clearTimeout(noticeTimer);
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  noticeTimer = setTimeout(() => el.remove(), 4000);
}

// Open a page and reset the search, mobile menu, and active dialog.
function navigate(page) {
  state.page = page;
  state.search = '';
  state.mobile = false;
  state.modal = '';
  render();
}
function switchRole(role) {
  state.role = role;
  navigate(
    role === 'customer'
      ? 'Shop'
      : role === 'staff'
        ? 'Assigned orders'
        : role === 'driver'
          ? 'Deliveries'
          : 'Overview',
  );
}
const activeOrders = () => state.orders.filter((o) => o.status !== 'Completed');
const lowStock = () => state.products.filter((p) => p.stock <= 10);
const filteredProducts = () =>
  state.products.filter((p) =>
    `${p.name} ${p.code} ${p.category}`
      .toLowerCase()
      .includes(state.search.toLowerCase()),
  );
const filteredOrders = () =>
  [...state.orders]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .filter((o) =>
      `${o.id} ${o.customer} ${o.status}`
        .toLowerCase()
        .includes(state.search.toLowerCase()),
    );

// Build the shared order table with tracking for customers and details for staff.
function table(orders) {
  return (
    `<div class="table-scroll"><table><thead><tr><th>ORDER ID</th><th>CUSTOMER</th>` +
    `<th>DATE</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>${orders
      .map(
        (o) =>
          `<tr data-action="view-order" ${dataId(o.id)}><td><strong>#${esc(o.id)}</strong>` +
          `</td><td><div class="customer-cell"><span class="customer-avatar">${esc(o.customer?.charAt(0))}</span><span>${esc(o.customer)}</span>` +
          `</div></td><td>${esc(date(o.created_at))}</td><td><strong>${esc(money(o.total))}</strong>` +
          `</td><td>${badge(o.status)}</td><td>${state.role === 'customer' ? button('view-order', `Track order ${icon('arrow', 14)}`, 'track-order-button', `${dataId(o.id)} aria-label="Track order ${esc(o.id)}"`) : button('view-order', icon('right', 16), 'row-button', `${dataId(o.id)} aria-label="View order ${esc(o.id)}"`)}</td></tr>`,
      )
      .join('')}` +
    `</tbody></table>${orders.length ? '' : empty('No orders found just yet.')}</div>`
  );
}

// Build a contact link when a valid destination is configured.
function contactLink(label, value, symbol, isPhone = false) {
  let href = '';
  if (isPhone) {
    const clean = String(value || '').trim();
    if (/^\+?[0-9() .-]+$/.test(clean) && /\d/.test(clean))
      href = `tel:${clean.replace(/[() .-]/g, '')}`;
  } else {
    try {
      const parsed = new URL(value);
      if (['https:', 'http:'].includes(parsed.protocol)) href = parsed.href;
    } catch {}
  }
  const details = `<span class="contact-icon">${icon(symbol, 15)}</span><span><strong>${esc(label)}</strong><small>${esc(href ? (isPhone ? value : 'Visit our page') : 'Not added yet')}</small></span>`;
  return href
    ? `<a class="contact-row" href="${esc(href)}" ${isPhone ? '' : 'target="_blank" rel="noopener noreferrer"'}>${details}</a>`
    : `<div class="contact-row unset">${details}</div>`;
}
const cartCount = () => state.cart.reduce((n, item) => n + item.quantity, 0);

// Wrap workspace pages in the navigation, toolbar, and shared dialogs.
function shell(content) {
  const sections =
    state.role === 'admin'
      ? [
          [
            'WORKSPACE',
            ['Overview', 'Orders', 'Products', 'Inventory', 'Reports'],
          ],
          ['CUSTOMER MANAGEMENT', ['Customers']],
          ['TEAM MANAGEMENT', ['Team']],
        ]
      : state.role === 'staff'
        ? [['TEAM WORKSPACE', ['Assigned orders', 'Inventory']]]
        : state.role === 'driver'
          ? [['DRIVER WORKSPACE', ['Deliveries']]]
          : [['CUSTOMER AREA', ['Shop', 'My orders']]];
  const title =
    state.profile?.display_name ||
    (state.role === 'admin'
      ? 'Alex Morgan'
      : state.role === 'staff'
        ? 'Maria Cruz'
        : state.role === 'driver'
          ? 'Daniel Ramos'
          : 'Customer');
  const navigation = sections
    .map(
      ([label, items]) =>
        `<div class="nav-label nav-section-label">${esc(label)}</div><nav>${items.map((n) => button('nav', `${icon(navIcons[n])}<span>${esc(n)}</span>${n === 'Orders' && activeOrders().length ? `<em>${activeOrders().length}</em>` : ''}`, `nav-item ${state.page === n ? 'active' : ''}`, `data-page="${esc(n)}"`)).join('')}</nav>`,
    )
    .join('');
  const demoViews = !supabase
    ? `<div class="nav-label nav-section-label">DEMO VIEWS</div><nav>${state.role !== 'customer' ? button('switch-role', `${icon('store')}<span>Customer storefront</span>`, 'nav-item', 'data-role="customer"') : ''}` +
      `${state.role !== 'staff' ? button('switch-role', `${icon('clipboard')}<span>Team workspace</span>`, 'nav-item', 'data-role="staff"') : ''}` +
      `${state.role !== 'admin' ? button('switch-role', `${icon('dashboard')}<span>Admin workspace</span>`, 'nav-item', 'data-role="admin"') : ''}` +
      `${state.role !== 'driver' ? button('switch-role', `${icon('truck')}<span>Driver workspace</span>`, 'nav-item', 'data-role="driver"') : ''}</nav>`
    : '';
  const customerCart =
    state.role === 'customer'
      ? button(
          'cart',
          `${icon('cart', 18)} <span>Cart</span> <b>${cartCount()}</b>`,
          'header-cart',
          `aria-label="Open cart, ${cartCount()} items"`,
        )
      : '';
  const cartDock =
    state.role === 'customer' && cartCount() > 0
      ? `<div class="cart-dock" aria-label="Shopping cart summary"><div><span>${cartCount()} ${cartCount() === 1 ? 'item' : 'items'} in your cart</span><strong>` +
        `${esc(money(cartTotal()))}</strong></div>${button('cart', 'View cart', 'cart-dock-view')}${button('checkout', `Checkout ${icon('arrow', 16)}`, 'primary cart-dock-checkout')}</div>`
      : '';
  return (
    `<div class="app-shell"><aside class="sidebar ${state.mobile ? 'open' : ''}">${brand()}` +
    `<div class="workspace"><div class="workspace-icon">${icon('store', 17)}</div>` +
    `<div><strong>${state.role === 'customer' ? 'Onsieng store' : state.role === 'staff' ? 'Team workspace' : state.role === 'driver' ? 'Driver workspace' : 'Onsieng workspace'}</strong><small>` +
    `${state.role === 'customer' ? 'Customer area' : 'Warehouse management'}</small>` +
    `</div>${icon('down', 15)}</div>${navigation}${demoViews}<div class="sidebar-bottom">` +
    `<div class="contact-card"><div class="contact-heading"><span>LET'S KEEP IN TOUCH</span><strong>Contact us</strong>` +
    `</div>${contactLink('Facebook page', CONTACT_FACEBOOK_URL, 'facebook')}${contactLink('Instagram page', CONTACT_INSTAGRAM_URL, 'instagram')}` +
    `${contactLink('Phone number', CONTACT_PHONE, 'phone', true)}</div>${button('help', `${icon('help', 17)} Help &amp; connection`, 'side-settings')}` +
    `</div></aside><div class="main-wrap"><header class="topbar">${button('menu', icon('menu', 20), 'mobile-menu icon-button', 'aria-label="Open menu"')}` +
    `<div class="breadcrumb">${state.role === 'customer' ? 'Customer area' : state.role === 'staff' ? 'Team workspace' : state.role === 'driver' ? 'Driver workspace' : 'Workspace'} ` +
    `${icon('right', 14)} <strong>${esc(state.page)}</strong></div><div class="top-actions">` +
    `<label class="search">${icon('search', 17)}<input aria-label="Search" placeholder="Search anything..." value="${esc(state.search)}"><span>⌘ K</span>` +
    `</label>${customerCart}${button('notifications', `${icon('bell', 19)}<i></i>`, 'icon-button notification', 'aria-label="Notifications"')}` +
    `<div class="top-divider"></div>${button(
      'account',
      `<span class="avatar">${esc(title.charAt(0))}</span><span class="profile-copy"><strong>${esc(title)}</strong><small>` +
        `${state.role === 'admin' ? 'Administrator' : state.role === 'staff' ? 'Warehouse staff' : state.role === 'driver' ? 'Delivery driver' : 'Customer'}</small></span>${icon('down', 15)}`,
      'profile-button',
    )}` +
    `</div></header><main class="content">${content}</main><footer><span>© 2026 Onsieng. Made for better business.</span><span><i></i> ` +
    `${supabase ? 'Connected to Supabase' : 'Demo workspace'}</span></footer></div>${cartDock}${renderModal()}</div>`
  );
}

// Summarize order totals, sales, and inventory for the administrator.
function overview() {
  const orders = state.orders,
    low = lowStock(),
    revenue = orders.reduce((n, o) => n + Number(o.total), 0),
    count = (s) => orders.filter((o) => s.includes(o.status)).length;
  const all = orders.length;
  const a = all ? Math.round((count(['Completed']) / all) * 100) : 0,
    b = all
      ? Math.round(
          (count(['Completed', 'Packed', 'Ready for dispatch']) / all) * 100,
        )
      : 0,
    c = all
      ? Math.round(
          (count(['Completed', 'Packed', 'Ready for dispatch', 'Processing']) /
            all) *
            100,
        )
      : 0;
  return (
    `<div class="page-heading"><div><div class="eyebrow"><span></span> YOUR WORKSPACE AT A GLANCE` +
    `</div><h1>Good morning, ${esc(state.profile?.display_name?.split(' ')[0] || 'Alex')} ` +
    `</h1><p>Here's what's happening with your warehouse today.</p></div><div class="heading-actions"><span class="date-pill">` +
    `${icon('clock', 15)} ${esc(date(new Date()))}</span>${button('new-product', `${icon('plus', 17)} Add product`, 'primary')}` +
    `</div></div><div class="metrics">${metric('bag', 'Total orders', orders.length.toLocaleString(), 'All orders', 'orange')}` +
    `${metric('boxes', 'Products in stock', state.products.reduce((n, p) => n + Number(p.stock), 0).toLocaleString(), `${state.products.length} products`, 'blue')}` +
    `${metric('truck', 'Orders to fulfill', activeOrders().length.toLocaleString(), 'Needs your attention', 'purple')}${metric('chart', 'Total sales', money(revenue), 'Recorded order value', 'green')}` +
    `</div><div class="dashboard-grid"><section class="panel orders-panel"><div class="panel-heading">` +
    `<div><h2>Recent orders</h2><p>Keep track of your latest customer orders.</p>` +
    `</div>${button('nav', `View all orders ${icon('arrow', 15)}`, 'text-button', 'data-page="Orders"')}` +
    `</div>${table(filteredOrders().reverse().slice(0, 5))}</section><section class="panel snapshot">` +
    `<div class="panel-heading"><div><h2>Order overview</h2><p>A closer look at your orders.` +
    `</p></div>${button('nav', icon('more', 20), 'icon-button', 'data-page="Reports" aria-label="View reports"')}` +
    `</div><div class="donut-wrap"><div class="donut" style="background:conic-gradient(#ed8b58 0 ${a}%, #7ca99d 0 ${b}%, #e4c98d 0 ` +
    `${c}%, #e8eeeb 0)"><div><strong>${all}</strong><small>total orders</small></div>` +
    `</div></div><div class="legend">${[
      ['orange-dot', 'Completed', count(['Completed'])],
      ['sage-dot', 'Packed / ready', count(['Packed', 'Ready for dispatch'])],
      ['yellow-dot', 'Processing', count(['Processing'])],
      ['gray-dot', 'Pending', count(['Pending'])],
    ]
      .map(
        ([cl, l, n]) =>
          `<div><span><i class="dot ${cl}"></i> ${l}</span><strong>${n}</strong></div>`,
      )
      .join('')}` +
    `</div></section><section class="panel inventory-panel"><div class="panel-heading">` +
    `<div><h2>Inventory highlights</h2><p>A little attention goes a long way.</p>` +
    `</div>${button('nav', `View inventory ${icon('arrow', 15)}`, 'text-button', 'data-page="Inventory"')}` +
    `</div><div class="inventory-list">${(low.length ? low : state.products)
      .slice(0, 3)
      .map(
        (p) =>
          `<div class="inventory-row">${productImage(p)}<div class="inventory-name"><strong>${esc(p.name)}</strong><small>${esc(p.code)} · ` +
          `${esc(p.category)}</small></div><div class="stock-number"><strong>${esc(p.stock)} <small>units</small></strong><span>` +
          `${p.stock <= 10 ? 'Low stock' : 'In stock'}</span></div><div class="stock-bar"><i style="width:${Math.min(100, (p.stock / 50) * 100)}%"></i></div></div>`,
      )
      .join('')}` +
    `</div></section><section class="promo-card"><div class="promo-copy"><span>MADE FOR BETTER DAYS</span>` +
    `<h2>Little things,<br>beautifully managed.</h2><p>From the first click to the final delivery, we're with you.` +
    `</p>${!supabase ? button('role-customer', `Visit the storefront ${icon('up', 16)}`) : ''}` +
    `</div><div class="promo-orbit orbit-one"></div><div class="promo-orbit orbit-two">` +
    `</div><img src="${esc(images.chair)}" alt="A comfortable accent chair"></section></div>`
  );
}

// Show a shopping action or inventory controls based on where the card is used.
function productCard(p, shop = false) {
  return (
    `<article class="catalog-card">${productImage(p)}<div class="catalog-info"><div class="product-meta"><span>${esc(p.category)}</span><span>` +
    `${shop ? (p.stock > 0 ? 'IN STOCK' : 'SOLD OUT') : esc(p.code)}</span></div>` +
    `<h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="catalog-bottom"><strong>${esc(money(p.price))}</strong>` +
    `${shop ? '' : `<span class="${p.stock <= 10 ? 'low-stock' : ''}">${esc(p.stock)} in stock</span>`}` +
    `</div>${shop ? button('add-cart', `${icon('cart', 17)} ${p.stock > 0 ? 'Add to cart' : 'Out of stock'}`, 'add-to-cart', `${dataId(p.id)} aria-label="Add ${esc(p.name)} to cart" ${p.stock ? '' : 'disabled'}`) : `<div class="card-actions"><span>Location ${esc(p.location || '—')}</span>${state.role === 'admin' ? `<div>${button('edit-product', icon('edit', 15), '', `${dataId(p.id)} aria-label="Edit ${esc(p.name)}"`)}${button('delete-product', icon('trash', 15), '', `${dataId(p.id)} aria-label="Delete ${esc(p.name)}"`)}</div>` : state.role === 'staff' ? button('stock', 'Adjust stock', 'small-outline', dataId(p.id)) : ''}</div>`}</div></article>`
  );
}

// Build the public shop and combine the category and search filters.
function storefront() {
  const guest = state.role === 'guest';
  const categories = [
    ...new Set(state.products.map((p) => p.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  if (state.storeCategory && !categories.includes(state.storeCategory))
    state.storeCategory = '';
  const catalog = filteredProducts().filter(
    (p) => !state.storeCategory || p.category === state.storeCategory,
  );
  const filters = [
    ['', 'All products'],
    ...categories.map((category) => [category, category]),
  ]
    .map(([value, label]) =>
      button(
        'category',
        esc(label),
        `category-filter ${state.storeCategory === value ? 'active' : ''}`,
        `data-category="${esc(value)}" aria-pressed="${state.storeCategory === value}"`,
      ),
    )
    .join('');
  const account = guest
    ? button('open-auth', 'Sign in', 'store-signin')
    : button('account', `${icon('users', 17)} Account`, 'store-signin');
  return (
    `<div class="storefront"><div class="home-topline">A more considered home starts here.` +
    `</div><header class="store-header"><a class="store-logo" href="#top" aria-label="Onsieng home">onsieng<span>.</span></a>` +
    `<nav class="store-nav" aria-label="Store navigation"><a href="#top">Home</a><a href="#collection">Shop</a><a href="#about">Our story</a><a href="#contact">Contact</a>` +
    `</nav><div class="store-actions">${!guest ? button('nav', 'My orders', 'store-orders', 'data-page="My orders"') : ''}` +
    `${button('cart', `${icon('cart', 19)} <span>${cartCount()}</span>`, 'store-cart', `aria-label="Open cart, ${cartCount()} items"`)}` +
    `${account}</div></header><main id="top"><section class="home-hero" aria-labelledby="home-title">` +
    `<div class="home-hero-copy"><span class="home-eyebrow">THE ONSIENG COLLECTION</span>` +
    `<h1 id="home-title">Make space<br>for <em>living.</em></h1><p>Bring warmth to your everyday with furniture and finishing touches that feel like you.` +
    `</p><a href="#collection" class="home-cta">Shop the collection ${icon('arrow', 18)}</a>` +
    `<div class="home-hero-note"><span>01</span><p>Thoughtful finds for every corner of your home.` +
    `</p></div></div><div class="home-hero-image"><img src="${esc(images.sofa)}" alt="A comfortable sofa for your living space">` +
    `<div class="home-image-label"><span>THE ART OF EVERYDAY</span><strong>A place to feel at home.</strong>` +
    `</div></div></section><section class="store-collection" id="collection"><div class="store-section-heading">` +
    `<div><span class="home-eyebrow">FIND YOUR FAVORITES</span><h2>Made for your home<span>.</span>` +
    `</h2><p>Explore the pieces that make a space yours.</p></div><label class="search store-search">${icon('search', 17)}<input aria-label="Search products" placeholder="Search products" value="` +
    `${esc(state.search)}"></label></div><div class="collection-tools"><div class="category-filters" role="group" aria-label="Filter products by category">` +
    `${filters}</div><span class="collection-count">${catalog.length} ${catalog.length === 1 ? 'item' : 'items'}</span>` +
    `</div>${state.catalogError ? `<div class="store-error" role="status">${esc(state.catalogError)} ${button('retry-catalog', 'Try again', 'store-text-link')}</div>` : `<div class="product-grid shop-grid store-grid">${catalog.map((p) => productCard(p, true)).join('')}</div>${catalog.length ? '' : empty('No products found. Try a different search or category.')}`}` +
    `</section><section class="home-story" id="about"><div><span class="home-eyebrow">A LITTLE MORE ROOM TO LIVE</span>` +
    `<h2>Good things belong<br>at home.</h2></div><div><p>From your favorite chair to the finishing touches, find pieces for the moments that matter most.` +
    `</p><a href="#collection" class="home-story-link">Explore the collection ${icon('arrow', 16)}</a>` +
    `</div></section></main><footer class="store-footer" id="contact"><div><a class="store-logo" href="#top">onsieng<span>.</span></a>` +
    `<p>Good things live here.</p></div><div class="store-contact"><strong>LET'S KEEP IN TOUCH</strong>${contactLink('Facebook page', CONTACT_FACEBOOK_URL, 'facebook')}` +
    `${contactLink('Instagram page', CONTACT_INSTAGRAM_URL, 'instagram')}${contactLink('Phone number', CONTACT_PHONE, 'phone', true)}` +
    `</div><div class="store-footer-end"><span>© 2026 Onsieng</span>${!supabase ? button('switch-role', 'Explore team demo', 'store-text-link', 'data-role="admin"') : ''}` +
    `</div></footer>${renderModal()}</div>`
  );
}
function shop() {
  return storefront();
}

// Show the order list for the current role, including assigned orders for staff.
function orderPage() {
  let list = filteredOrders();
  if (state.role === 'staff')
    list = list.filter(
      (o) =>
        o.assigned_to === (supabase ? state.session.user.id : 'Maria Cruz'),
    );
  if (state.role === 'customer' && !supabase)
    list = list.filter((o) => o.user_id === 'demo-customer');
  const customer = state.role === 'customer',
    staff = state.role === 'staff';
  return `${pageTitle(staff ? 'FULFILLMENT' : customer ? 'YOUR PURCHASES' : 'ORDER MANAGEMENT', customer ? 'Your orders' : staff ? 'Your order queue' : 'All orders', staff ? 'Pick, pack, and keep every order moving.' : customer ? 'Follow your order from our warehouse to your door.' : 'Manage and monitor orders from start to finish.')}<section class="panel table-page"><div class="panel-heading"><div><h2>${staff ? 'Orders to fulfill' : 'Order history'}</h2><p>${list.length} orders shown</p></div></div>${table(list)}</section>`;
}

// Show the filtered catalog or inventory in the workspace.
function productPage() {
  const list = filteredProducts();
  return `${pageTitle('WAREHOUSE', state.page === 'Products' ? 'Product catalog' : 'Inventory', state.page === 'Products' ? 'Your collection, all in one place.' : 'A clear view of everything on your shelves.', state.role === 'admin' ? button('new-product', `${icon('plus', 17)} Add product`, 'primary') : '')}<div class="product-grid">${list.map((p) => productCard(p)).join('')}</div>${list.length ? '' : empty('No products found.')}`;
}

// Group orders by email to show customer purchase history.
function customers() {
  const people = [...new Map(state.orders.map((o) => [o.email, o])).values()];
  return `${pageTitle('YOUR COMMUNITY', 'Customers', 'The people behind every order.')}<section class="panel table-page"><div class="panel-heading"><div><h2>Customer records</h2><p>Customers who have placed an order.</p></div></div><div class="simple-list">${people.map((o) => `<div><span class="avatar light">${esc(o.customer?.charAt(0))}</span><div><strong>${esc(o.customer)}</strong><small>${esc(o.email)}</small></div><span>${state.orders.filter((x) => x.email === o.email).length} orders</span></div>`).join('')}</div></section>`;
}

// Render the role controls for accounts in the connected workspace.
function teamPage() {
  return `${pageTitle('WORKSPACE ACCESS', 'Team & accounts', 'Manage the people who use your workspace.')}<section class="panel table-page"><div class="panel-heading"><div><h2>Account roles</h2><p>${supabase ? 'Assign a role to each registered account.' : 'Connect Supabase to manage real accounts.'}</p></div></div>${
    !supabase
      ? empty('Account management is available when connected to Supabase.')
      : `<div class="simple-list">${state.team
          .map(
            (p) =>
              `<div><span class="avatar light">${esc(p.display_name?.charAt(0))}</span><div><strong>${esc(p.display_name)}</strong><small>` +
              `${p.id === state.session.user.id ? 'Your account' : 'Registered account'}</small>` +
              `</div><select data-change="role" ${dataId(p.id)} aria-label="Role for ${esc(p.display_name)}" ${p.id === state.session.user.id ? 'disabled' : ''}>` +
              `${(state.deliveryReady ? ['customer', 'staff', 'driver', 'admin'] : ['customer', 'staff', 'admin']).map((r) => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></div>`,
          )
          .join('')}</div>`
  }</section>`;
}

// Show sales figures and the breakdown of orders by status.
function reports() {
  const orders = state.orders;
  return `${pageTitle('BUSINESS INSIGHTS', 'Reports', 'A simple snapshot of your business.')}<div class="metrics">${metric('chart', 'Total order value', money(orders.reduce((n, o) => n + Number(o.total), 0)), 'All recorded orders', 'green')}${metric('check', 'Completed orders', orders.filter((o) => o.status === 'Completed').length, 'Ready and delivered', 'orange')}${metric('alert', 'Low stock items', lowStock().length, '10 units or fewer', 'purple')}${metric('package', 'Products', state.products.length, 'In your catalog', 'blue')}</div><section class="panel report-panel"><h2>Order status breakdown</h2><p>Track the progress of every order.</p>${statuses.map((s) => `<div class="report-row">${badge(s)}<div class="report-bar"><i style="width:${orders.length ? (orders.filter((o) => o.status === s).length / orders.length) * 100 : 0}%"></i></div><strong>${orders.filter((o) => o.status === s).length}</strong></div>`).join('')}</section>`;
}
const deliveryFor = (orderId) =>
  state.deliveries.find((d) => String(d.order_id) === String(orderId));
const receiptNumber = (order) => `RCP-${String(order.id).toUpperCase()}`;
const deliveryDate = (delivery, statuses) =>
  delivery?.history?.find((event) => statuses.includes(event.status))?.at;

// Translate the order and delivery history into steps for the customer.
function trackingPage() {
  const o = getOrder(String(state.trackingId));
  if (!o)
    return `${pageTitle('ORDER TRACKING', 'Order not found', 'Return to your orders to select an order.')}${button('nav', 'Back to orders', 'outline', 'data-page="My orders"')}`;
  const d = deliveryFor(o.id),
    shipped = deliveryDate(d, [
      'Picked up',
      'In transit',
      'Arrived',
      'Waiting for instructions',
      'Delivered',
    ]),
    received = deliveryDate(d, ['Delivered']);
  const steps = [
    { label: 'Order placed', icon: 'clipboard', done: true, at: o.created_at },
    {
      label: 'Payment verified',
      icon: 'check',
      done: !!o.payment_verified,
      at: null,
    },
    { label: 'Shipped out', icon: 'truck', done: !!shipped, at: shipped },
    {
      label: 'Order received',
      icon: 'package',
      done: !!received,
      at: received,
    },
    {
      label: 'Order completed',
      icon: 'check',
      done: o.status === 'Completed',
      at: received && o.status === 'Completed' ? received : null,
    },
  ];
  return (
    `<div class="tracking-heading">${button('nav', `${icon('right', 15)} Back to my orders`, 'back-link', 'data-page="My orders"')}` +
    `<div class="eyebrow"><span></span> YOUR ORDER JOURNEY</div><h1>Track your order<span>.</span>` +
    `</h1><p>Every update, from our warehouse to your doorstep.</p></div><section class="panel tracking-panel">` +
    `<div class="tracking-top"><div><span class="tracking-kicker">ORDER REFERENCE</span>` +
    `<h2>#${esc(o.id)}</h2><p>Placed ${esc(date(o.created_at))}</p></div><div class="receipt-tag"><span>RECEIPT NUMBER</span><strong>` +
    `${esc(receiptNumber(o))}</strong></div></div><div class="timeline" aria-label="Order progress">${steps.map((step, i) => `<div class="timeline-step ${step.done ? 'done' : ''}"><div class="timeline-icon">${icon(step.icon, 20)}</div><strong>${step.label}</strong><small>${step.at ? esc(date(step.at)) : step.done ? 'Confirmed' : 'Pending'}</small></div>`).join('')}` +
    `</div><div class="tracking-current"><span class="tracking-current-icon">${icon('truck', 19)}</span>` +
    `<div><strong>${esc(d ? d.status : o.status)}</strong><small>${d ? 'Delivery status' : 'Warehouse status'} · Updates appear as your order moves forward.</small>` +
    `</div>${badge(o.status)}</div></section><div class="tracking-grid"><section class="panel tracking-info">` +
    `<div class="tracking-section-head"><span class="tracking-section-icon">${icon('truck', 18)}</span>` +
    `<div><h2>Delivery details</h2><p>Everything you need for arrival.</p></div></div>` +
    `<div class="tracking-pair"><span>Delivery address</span><strong>${esc(o.address)}</strong>` +
    `</div><div class="tracking-pair"><span>Recipient</span><strong>${esc(o.customer)}</strong>` +
    `</div><div class="tracking-pair"><span>Contact</span><strong>${esc(o.phone || o.email || 'Not provided')}</strong>` +
    `</div><div class="tracking-pair"><span>Driver</span><strong>${esc(d?.driver_name || (state.deliveryReady ? 'Not assigned yet' : 'Delivery setup pending'))}</strong>` +
    `</div>${d?.recipient_name ? `<div class="tracking-pair"><span>Received by</span><strong>${esc(d.recipient_name)}</strong></div>` : ''}` +
    `</section><section class="panel tracking-info"><div class="tracking-section-head"><span class="tracking-section-icon peach">` +
    `${icon('bag', 18)}</span><div><h2>Order summary</h2><p>Your items and payment.` +
    `</p></div></div>${(o.items || []).map((i) => `<div class="tracking-item"><span>${esc(i.name)} <small>× ${esc(i.quantity)}</small></span><strong>${esc(money(i.price * i.quantity))}</strong></div>`).join('')}` +
    `<div class="tracking-pair"><span>Payment</span><strong>${esc(o.payment)} · ${o.payment_verified ? 'Verified' : 'Awaiting verification'}</strong>` +
    `</div><div class="tracking-pair tracking-total"><span>Total</span><strong>${esc(money(o.total))}</strong>` +
    `</div></section></div>`
  );
}

// List deliveries assigned to the current driver.
function driverPage() {
  const driverId = supabase ? state.session.user.id : 'demo-driver';
  const list = state.deliveries
    .filter((d) => d.assigned_driver === driverId)
    .map((d) => ({ delivery: d, order: getOrder(String(d.order_id)) }))
    .filter(
      (x) =>
        x.order &&
        `${x.order.id} ${x.order.customer} ${x.order.address}`
          .toLowerCase()
          .includes(state.search.toLowerCase()),
    );
  return `${pageTitle('DELIVERY WORKSPACE', 'Your deliveries', 'Pick up, deliver, and keep every customer informed.')}<div class="driver-intro"><div><span>READY FOR THE ROAD</span><h2>Every delivery matters.</h2><p>All your assigned deliveries, organized in one place.</p></div><div class="driver-intro-icon">${icon('truck', 38)}</div></div><div class="driver-metrics"><div><span>Assigned deliveries</span><strong>${list.length}</strong></div><div><span>In progress</span><strong>${list.filter((x) => !['Assigned', 'Delivered'].includes(x.delivery.status)).length}</strong></div><div><span>Delivered</span><strong>${list.filter((x) => x.delivery.status === 'Delivered').length}</strong></div></div><div class="driver-list-heading"><div><h2>Delivery assignments</h2><p>Open a delivery to see details and update its progress.</p></div></div><div class="driver-list">${list
    .map(
      ({ delivery: d, order: o }) =>
        `<article class="panel driver-card"><div class="driver-card-top"><div><span>RECEIPT</span><strong>${esc(receiptNumber(o))}</strong>` +
        `</div><span class="delivery-chip">${esc(d.status)}</span></div><div class="driver-card-body">` +
        `<div class="driver-avatar">${esc(o.customer?.charAt(0))}</div><div><h3>${esc(o.customer)}` +
        `</h3><p>${esc(o.address)}</p></div></div><div class="driver-card-footer"><span>${(o.items || []).reduce((n, i) => n + Number(i.quantity), 0)} items · ` +
        `${esc(money(o.total))}</span>${button('view-delivery', `View delivery ${icon('arrow', 15)}`, 'driver-open', dataId(o.id))}</div></article>`,
    )
    .join(
      '',
    )}</div>${list.length ? '' : empty('No deliveries have been assigned yet.')}`;
}

// Show delivery details and the next available action.
function driverDetail(o, d) {
  const next = {
    'Assigned': ['Accepted', 'Accept assignment'],
    'Accepted': ['Picked up', 'Confirm order pickup'],
    'Picked up': ['In transit', 'Start delivery'],
    'In transit': ['Arrived', 'Arrived at address'],
    'Waiting for instructions': ['Arrived', 'Retry delivery'],
  };
  const action = next[d.status];
  const packed = ['Packed', 'Ready for dispatch'].includes(o.status);
  return modal(
    'Delivery details',
    `<div class="driver-detail-head"><span class="delivery-chip">${esc(d.status)}</span><strong>${esc(receiptNumber(o))}</strong>` +
      `</div><div class="detail-section"><h3>Customer and address</h3><p><strong>${esc(o.customer)}</strong><br>${esc(o.address)}<br>` +
      `${esc(o.phone || 'Phone not provided')}<br>${esc(o.email)}</p></div><div class="detail-section">` +
      `<h3>Pickup and items</h3><p>Warehouse status: <strong>${esc(o.status)}</strong>` +
      `</p>${(o.items || []).map((i) => `<div class="detail-line"><span>${esc(i.name)} × ${esc(i.quantity)}</span><strong>${esc(money(i.price * i.quantity))}</strong></div>`).join('')}` +
      `<div class="detail-line total"><span>Total · ${esc(o.payment)}</span><strong>${esc(money(o.total))}</strong>` +
      `</div></div>${action ? button('delivery-step', `${action[1]} ${icon('arrow', 16)}`, 'primary full', `data-status="${action[0]}" ${d.status === 'Accepted' && !packed ? 'disabled' : ''}`) : ''}` +
      `${d.status === 'Accepted' && !packed ? '<p class="driver-note">The warehouse must mark this order packed before pickup.</p>' : ''}` +
      `${d.status === 'Arrived' ? `<div class="delivery-actions">${button('delivery-step', 'Customer unavailable', 'outline', 'data-status="Waiting for instructions"')}${button('confirm-delivery', `Confirm delivery ${icon('check', 16)}`, 'primary')}</div>` : ''}` +
      `${d.status === 'Delivered' ? `<p class="driver-note">Delivered to ${esc(d.recipient_name)}.</p>` : ''}`,
  );
}

// Choose the content for the current workspace page.
function pageContent() {
  switch (state.page) {
    case 'Overview':
      return overview();
    case 'Shop':
      return shop();
    case 'Orders':
    case 'Assigned orders':
    case 'My orders':
      return orderPage();
    case 'Products':
    case 'Inventory':
      return productPage();
    case 'Customers':
      return customers();
    case 'Team':
      return teamPage();
    case 'Reports':
      return reports();
    case 'Track order':
      return trackingPage();
    case 'Deliveries':
      return driverPage();
    default:
      return '';
  }
}
function field(label, name, value = '', type = 'text', extra = '') {
  return `<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

// Build the active dialog, such as the cart, checkout, or a product form.
function renderModal() {
  const p = state.selected;
  switch (state.modal) {
    case 'account':
      return modal(
        'Your workspace',
        `<p class="modal-description">${supabase ? `Signed in as ${esc(state.session.user.email)}. Your access is managed by your administrator.` : 'Explore the experience for each role. Demo data is saved in this browser.'}` +
          `</p>${supabase ? button('sign-out', `${icon('right', 16)} Sign out`, 'outline full') : `${button('sign-out', 'Leave demo account', 'outline full')}<div class="role-options">${['admin', 'staff', 'driver', 'customer'].map((r) => button('switch-role', `<span>${r === 'admin' ? 'Administrator' : r === 'staff' ? 'Warehouse staff' : r === 'driver' ? 'Delivery driver' : 'Customer'}</span>${icon('right', 17)}`, state.role === r ? 'selected' : '', `data-role="${r}"`)).join('')}</div>`}`,
      );
    case 'help':
      return modal(
        'Help & connection',
        `<p class="modal-description">${supabase ? 'This workspace is connected to Supabase. Contact your administrator for access or assistance.' : 'You are exploring a demo workspace. To connect your own data, configure the Supabase project URL and public key in config.js, then run the supplied database schema.'}` +
          `</p>${button('close', 'Got it', 'primary full')}`,
      );
    case 'notifications':
      return modal(
        'Notifications',
        `<div class="notification-list">${state.role === 'admin' ? state.alerts.map((a) => `<div><span class="notice-icon amber">${icon('alert', 17)}</span><p><strong>Order #${esc(String(a.order_id).slice(0, 8))}</strong><small>${esc(a.message)}</small></p></div>`).join('') : ''}` +
          `<div><span class="notice-icon">${icon('bag', 17)}</span><p><strong>${activeOrders().length} orders in progress</strong><small>Keep things moving in your order queue.</small>` +
          `</p></div><div><span class="notice-icon amber">${icon('alert', 17)}</span><p><strong>${lowStock().length} products running low</strong><small>Check inventory to plan your next restock.</small></p></div></div>`,
      );
    case 'product': {
      const v = p || {
        name: '',
        code: '',
        category: 'Furniture',
        price: '',
        stock: '',
        location: '',
        image: '',
        description: '',
      };
      return modal(
        p ? 'Edit product' : 'Add a product',
        `<form class="form-grid" data-form="product">${field('Product name', 'name', v.name, 'text', 'required')}${field('Product code', 'code', v.code, 'text', 'required')}` +
          `${field('Category', 'category', v.category, 'text', 'required')}${field('Price (₱)', 'price', v.price, 'number', 'required min="0" step="0.01"')}` +
          `${field('Stock quantity', 'stock', v.stock, 'number', 'required min="0" step="1"')}${field('Warehouse location', 'location', v.location)}` +
          `<div class="wide">${field('Image URL', 'image', v.image, 'url', 'placeholder="https://..."')}` +
          `</div><div class="wide">${field('Description', 'description', v.description)}` +
          `</div><button class="primary wide" type="submit">Save product ${icon('arrow', 16)}</button></form>`,
      );
    }
    case 'stock':
      return modal(
        'Adjust stock',
        `<p class="modal-description">Update the available quantity for ${esc(p.name)}.</p><form data-form="stock">${field('Available units', 'stock', p.stock, 'number', 'required min="0" step="1"')}<button class="primary full">Save quantity</button></form>`,
      );
    case 'order':
      return orderDetail(p);
    case 'driver-order': {
      const delivery = deliveryFor(p?.id);
      return p && delivery ? driverDetail(p, delivery) : '';
    }
    case 'delivery-confirm':
      return modal(
        'Confirm delivery',
        `<p class="modal-description">Enter the name of the person who received this order.` +
          `</p><form data-form="delivery-confirm">${field('Received by', 'recipient', '', 'text', 'required maxlength="120"')}<button class="primary full">Submit delivery confirmation ` +
          `${icon('check', 16)}</button></form>`,
      );
    case 'cart':
      return modal(
        'Your shopping cart',
        state.cart.length
          ? `<div class="cart-list">${state.cart
              .map(
                (item) =>
                  `<div class="cart-row">${productImage(item)}<div><strong>${esc(item.name)}</strong><small>${esc(money(item.price))}</small>` +
                  `</div><div class="quantity">${button('cart-minus', icon('minus', 13), '', `${dataId(item.id)} aria-label="Remove one ${esc(item.name)}"`)}` +
                  `${item.quantity}${button('cart-plus', icon('plus', 13), '', `${dataId(item.id)} aria-label="Add one ${esc(item.name)}" ${item.quantity >= item.stock ? 'disabled' : ''}`)}</div></div>`,
              )
              .join('')}` +
              `</div><div class="detail-line total"><span>Subtotal</span><strong>${esc(money(cartTotal()))}</strong>` +
              `</div>${button('checkout', `Continue to checkout ${icon('arrow', 16)}`, 'primary full')}${button('close', 'Continue shopping', 'link-button full')}`
          : `${empty('Your cart is waiting for something lovely.')}${button('close', 'Continue shopping', 'link-button full')}`,
      );
    case 'checkout':
      return modal(
        'Delivery & payment',
        `<p class="modal-description">Just a few details and your order will be on its way.` +
          `</p><form data-form="checkout">${field('Full name', 'customer', '', 'text', 'required')}${field('Email address', 'email', state.session?.user?.email || '', 'email', 'required')}` +
          `${state.deliveryReady ? field('Phone number (optional)', 'phone', '', 'tel', 'maxlength="40"') : ''}` +
          `<label>Delivery address<textarea required name="address"></textarea></label>` +
          `<label>Payment method<select name="payment"><option>Cash on delivery</option><option>Bank transfer</option>` +
          `</select></label><div class="detail-line total"><span>Order total</span><strong>${esc(money(cartTotal()))}</strong>` +
          `</div><button class="primary full">Confirm order ${icon('arrow', 16)}</button>${button('cart', 'Back to cart', 'link-button full')}</form>`,
      );
    case 'confirmation':
      return modal(
        'Your order is in!',
        `<div class="confirmation"><span>${icon('check', 32)}</span><h3>Thank you for shopping with us.` +
          `</h3><p>Order #${esc(p?.id)} has been recorded. You can follow its progress in your orders.` +
          `</p>${button('track', `Track my order ${icon('arrow', 16)}`, 'primary full')}</div>`,
      );
    default:
      return '';
  }
}

// Show order details and the controls available to the current role.
function orderDetail(o) {
  const role = state.role;
  const delivery = deliveryFor(o.id);
  const drivers = supabase
    ? state.team.filter((p) => p.role === 'driver')
    : [{ id: 'demo-driver', display_name: 'Daniel Ramos' }];
  return modal(
    `Order #${o.id}`,
    `<div class="detail-top">${badge(o.status)}<span>${esc(date(o.created_at))}</span>` +
      `</div><div class="detail-section"><h3>Customer details</h3><p><strong>${esc(o.customer)}</strong><br>${esc(o.email)}<br>` +
      `${esc(o.phone || 'Phone not provided')}<br>${esc(o.address)}</p></div><div class="detail-section">` +
      `<h3>Items</h3>${(o.items || []).map((i) => `<div class="detail-line"><span>${esc(i.name)} × ${esc(i.quantity)}</span><strong>${esc(money(i.price * i.quantity))}</strong></div>`).join('')}` +
      `<div class="detail-line total"><span>Total</span><strong>${esc(money(o.total))}</strong>` +
      `</div></div><div class="detail-section"><h3>Payment</h3><p>${esc(o.payment)} · ${o.payment_verified ? 'Verified' : 'Awaiting verification'}` +
      `</p>${role === 'admin' && !o.payment_verified ? button('verify', 'Mark payment verified', 'small-outline') : ''}` +
      `</div>${
        role === 'admin'
          ? `<label>Assign to staff<select data-change="assign"><option value="">Unassigned</option>${(supabase ? state.staff : [{ id: 'Maria Cruz', display_name: 'Maria Cruz' }]).map((s) => `<option value="${esc(s.id)}" ${o.assigned_to === s.id ? 'selected' : ''}>${esc(s.display_name)}</option>`).join('')}` +
            `</select></label><label>Assign delivery driver<select data-change="delivery-assign" ${!state.deliveryReady || !drivers.length || (delivery && delivery.status !== 'Assigned') ? 'disabled' : ''}><option value="">` +
            `${drivers.length ? 'Select a driver' : 'No driver accounts yet'}</option>${drivers.map((d) => `<option value="${esc(d.id)}" ${delivery?.assigned_driver === d.id ? 'selected' : ''}>${esc(d.display_name)}</option>`).join('')}` +
            `</select></label>${delivery ? `<p class="driver-note">Delivery: ${esc(delivery.status)} · ${esc(delivery.driver_name)}</p>` : !state.deliveryReady ? '<p class="driver-note">Run supabase/delivery-migration.sql in your Supabase project to enable driver assignments.</p>' : ''}`
          : ''
      }` +
      `${
        role === 'staff'
          ? `<div><p class="modal-description">Check availability, pick and inspect the items, then update the order as it moves toward dispatch.` +
            `</p>${button('alert-stock', 'Notify admin of unavailable stock', 'small-outline')} ${button('alert-ready', 'Notify admin order is ready', 'small-outline')}</div>`
          : ''
      }` +
      `${role !== 'customer' ? `<label>Order status<select data-change="status">${statuses.map((s) => `<option ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : ''}`,
  );
}
function cartTotal() {
  return state.cart.reduce((n, p) => n + Number(p.price) * p.quantity, 0);
}

// Build the demo entry screen or the connected sign-in and signup forms.
function authPage() {
  if (!supabase)
    return (
      `<div class="auth-page"><div class="auth-card">${button('browse-store', `${icon('arrow', 16)} Back to the store`, 'auth-back')}` +
      `${brand()}<div class="eyebrow"><span></span> DEMO ACCOUNT</div><h1>Welcome to Onsieng.` +
      `</h1><p>Continue as a demo customer to try checkout. Connect Supabase to use real accounts.` +
      `</p>${button('demo-signin', 'Continue as demo customer', 'primary full')}</div>` +
      `<div class="auth-art"><img src="${esc(images.sofa)}" alt="A welcoming living space"></div></div>`
    );
  return (
    `<div class="auth-page"><div class="auth-card">${button('browse-store', `${icon('arrow', 16)} Back to the store`, 'auth-back')}` +
    `${brand()}<div class="eyebrow"><span></span> WELCOME TO ONSIENG</div><h1>${state.authSignup ? 'Make yourself at home.' : 'Welcome back.'}` +
    `</h1><p>${state.authSignup ? 'Create an account to start shopping.' : 'Sign in to continue to your workspace.'}` +
    `</p><form data-form="auth">${state.authSignup ? field('Full name', 'name', '', 'text', 'required') : ''}${field('Email address', 'email', '', 'email', 'required')}` +
    `${field('Password', 'password', '', 'password', 'required minlength="6"')}<button class="primary full" >${state.authSignup ? 'Create account' : 'Sign in'} ` +
    `${icon('arrow', 16)}</button><p class="auth-feedback" role="status" aria-live="polite" hidden>` +
    `</p></form>${button('toggle-auth', state.authSignup ? 'Already have an account? Sign in' : 'New here? Create an account', 'auth-toggle')}` +
    `</div><div class="auth-art"><img src="${esc(images.sofa)}" alt="A welcoming living space">` +
    `<div><span>THE ONSIENG COLLECTION</span><h2>Good things<br>live here.</h2></div></div></div>`
  );
}

// Decide which screen to display: sign-in, account loading, shop, or workspace.
function render() {
  if (state.showAuth && state.role === 'guest') {
    root.innerHTML = authPage();
    return;
  }
  if (supabase && state.session && !state.profile) {
    root.innerHTML = `<div class="loading">${esc(state.loadError || 'Loading your account…')}${state.loadError ? button('retry-account', 'Retry', 'primary') + button('sign-out', 'Sign out', 'outline') : ''}</div>`;
    return;
  }
  if (
    state.role === 'guest' ||
    (state.role === 'customer' && state.page === 'Shop')
  ) {
    root.innerHTML = storefront();
    return;
  }
  root.innerHTML = shell(pageContent());
}

// Explain common sign-in rate limits in plain language.
function authMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');
  if (
    code === 'over_email_send_rate_limit' ||
    /email.{0,30}rate.{0,15}limit/i.test(message)
  )
    return 'Email sending limit reached. Please wait before trying again. If you already signed up, check your inbox for a confirmation email.';
  if (code === 'over_request_rate_limit')
    return 'Too many requests. Please wait a few minutes before trying again.';
  return message || 'Something went wrong. Please try again.';
}
function showAuthFeedback(form, message, isError = true) {
  const feedback = form.querySelector('.auth-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.classList.toggle('is-error', isError);
}
function getProduct(id) {
  return state.products.find((x) => String(x.id) === id);
}
function getOrder(id) {
  return state.orders.find((x) => String(x.id) === id);
}

// Only the latest request for the active session may update the data on screen.
let refreshVersion = 0;

// Refresh signed-in data and update any open order details from the latest results.
async function refreshData(resetPage = false) {
  if (!supabase || !state.session) return;
  const userId = state.session.user.id,
    version = ++refreshVersion;
  const [pr, or, profile, deliveries] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('deliveries')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);
  if (state.session?.user.id !== userId || version !== refreshVersion) return;
  const migrationMissing =
    deliveries.error && ['42P01', 'PGRST205'].includes(deliveries.error.code);
  const error =
    pr.error ||
    or.error ||
    profile.error ||
    (migrationMissing ? null : deliveries.error);
  if (error) throw error;
  if (!profile.data)
    throw new Error('Account profile is missing. Check the database setup.');
  let team = [],
    alerts = [];
  if (profile.data.role === 'admin') {
    const [people, notices] = await Promise.all([
      supabase.from('profiles').select('*').order('display_name'),
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    if (state.session?.user.id !== userId || version !== refreshVersion) return;
    if (people.error || notices.error) throw people.error || notices.error;
    team = people.data || [];
    alerts = notices.data || [];
  }
  const roleChanged = state.role !== profile.data.role;
  const guestCart =
    state.role === 'guest' && profile.data.role === 'customer'
      ? state.cart
      : [];
  Object.assign(state, {
    deliveryReady: !migrationMissing,
    products: pr.data || [],
    orders: or.data || [],
    deliveries: deliveries.data || [],
    profile: profile.data,
    role: profile.data.role,
    team,
    staff: team.filter((p) => p.role === 'staff'),
    alerts,
    loadError: '',
  });
  if (resetPage || roleChanged) {
    state.page = homePage(state.role);
    state.modal = '';
    state.selected = null;
    state.trackingId = null;
    state.cart = guestCart;
    state.search = '';
  }
  if (
    state.selected &&
    ['order', 'driver-order', 'delivery-confirm'].includes(state.modal)
  ) {
    state.selected = getOrder(String(state.selected.id));
    if (!state.selected) state.modal = '';
  }
  const cartChanged = state.modal !== 'checkout' && reconcileCart();
  if (cartChanged)
    flash(
      'Your cart was updated to match the current prices and stock. Please review it.',
    );
}

// Validate a product and save either its stock or its full details, depending on the role.
async function saveProduct(product) {
  const userId = state.session?.user?.id;
  if (!Number.isSafeInteger(product.stock) || product.stock < 0)
    throw new Error('Stock must be a whole number of zero or more.');
  if (!Number.isFinite(product.price) || product.price < 0)
    throw new Error('Enter a valid price.');
  if (state.role === 'admin') {
    for (const key of ['name', 'code', 'category']) {
      product[key] = product[key].trim();
      if (!product[key])
        throw new Error('Product name, code and category are required.');
    }
    if (
      state.products.some((p) => p.id !== product.id && p.code === product.code)
    )
      throw new Error('This product code is already in use.');
  }
  if (supabase) {
    const query =
      state.role === 'staff'
        ? supabase
            .from('products')
            .update({ stock: product.stock })
            .eq('id', product.id)
        : supabase.from('products').upsert(product);
    const { data, error } = await query.select().single();
    if (error) throw error;
    assertAccount(userId);
    product = data;
  }
  state.products = [
    ...state.products.filter((x) => x.id !== product.id),
    product,
  ];
  persist();
  state.modal = '';
  render();
  flash('Product saved successfully.');
}

// Save changes to the selected order and refresh the open view.
async function updateOrder(changes) {
  const userId = state.session?.user?.id;
  let order = state.selected;
  if (supabase) {
    const { data, error } = await supabase
      .from('orders')
      .update(changes)
      .eq('id', order.id)
      .select()
      .single();
    if (error) throw error;
    assertAccount(userId);
    order = data;
  } else order = { ...order, ...changes };
  state.orders = state.orders.map((o) => (o.id === order.id ? order : o));
  state.selected = order;
  persist();
  render();
  flash('Order updated.');
}

// Record a staff alert on the selected order.
async function notifyAdmin(message) {
  const alert = {
    order_id: state.selected.id,
    message,
    created_at: new Date().toISOString(),
  };
  if (supabase) {
    const { error } = await supabase
      .from('notifications')
      .insert({ ...alert, staff_id: state.session.user.id });
    if (error) throw error;
  } else state.alerts.unshift(alert);
  persist();
  flash('Admin notified.');
}

// Assign an order to a driver and update the delivery details.
async function assignDelivery(driverId) {
  if (!driverId) return;
  const userId = state.session?.user?.id;
  const order = state.selected;
  let delivery = deliveryFor(order.id);
  if (supabase) {
    const { data, error } = await supabase.rpc('assign_delivery', {
      p_order_id: order.id,
      p_driver_id: driverId,
    });
    if (error) throw error;
    assertAccount(userId);
    delivery = data;
  } else {
    if (delivery && delivery.status !== 'Assigned')
      throw new Error('Accepted deliveries cannot be reassigned.');
    const now = new Date().toISOString();
    delivery = {
      ...(delivery || {
        id: crypto.randomUUID(),
        order_id: order.id,
        created_at: now,
        history: [],
        status: 'Assigned',
        recipient_name: '',
      }),
      assigned_driver: driverId,
      driver_name: 'Daniel Ramos',
      updated_at: now,
      history: [...(delivery?.history || []), { status: 'Assigned', at: now }],
    };
  }
  state.deliveries = [
    ...state.deliveries.filter((d) => d.order_id !== delivery.order_id),
    delivery,
  ];
  persist();
  render();
  flash('Delivery assigned.');
}

// Advance the delivery one step and record the result.
async function advanceDelivery(status, recipient = '') {
  const userId = state.session?.user?.id;
  const order = state.selected;
  let delivery = deliveryFor(order.id);
  if (!delivery) throw new Error('Delivery not found.');
  if (supabase) {
    const { data, error } = await supabase.rpc('advance_delivery', {
      p_delivery_id: delivery.id,
      p_status: status,
      p_recipient: recipient,
    });
    if (error) throw error;
    assertAccount(userId);
    delivery = data;
  } else {
    const allowed = {
      Assigned: ['Accepted'],
      Accepted: ['Picked up'],
      'Picked up': ['In transit'],
      'In transit': ['Arrived'],
      Arrived: ['Delivered', 'Waiting for instructions'],
      'Waiting for instructions': ['Arrived'],
    };
    if (!allowed[delivery.status]?.includes(status))
      throw new Error('Invalid delivery step.');
    if (
      status === 'Picked up' &&
      !['Packed', 'Ready for dispatch'].includes(order.status)
    )
      throw new Error('The order must be packed before pickup.');
    if (status === 'Delivered' && !recipient.trim())
      throw new Error('Recipient name is required.');
    const now = new Date().toISOString();
    delivery = {
      ...delivery,
      status,
      recipient_name:
        status === 'Delivered' ? recipient.trim() : delivery.recipient_name,
      updated_at: now,
      history: [...(delivery.history || []), { status, at: now }],
    };
    if (status === 'Waiting for instructions' || status === 'Delivered')
      state.alerts.unshift({
        order_id: order.id,
        message:
          status === 'Delivered'
            ? 'Delivery confirmed by driver.'
            : 'Customer unavailable. Driver is waiting for instructions.',
        created_at: now,
      });
  }
  state.deliveries = state.deliveries.map((d) =>
    d.id === delivery.id ? delivery : d,
  );
  if (status === 'Delivered') {
    state.orders = state.orders.map((o) =>
      o.id === order.id ? { ...o, status: 'Completed' } : o,
    );
    state.selected = getOrder(String(order.id));
  }
  persist();
  state.modal = 'driver-order';
  render();
  flash(
    status === 'Waiting for instructions'
      ? 'Admin notified.'
      : 'Delivery updated.',
  );
}

// Validate the cart and delivery details, then submit the order.
async function placeOrder(details) {
  const userId = state.session?.user?.id;
  if (state.role === 'guest' || (supabase && !state.session))
    throw new Error('Sign in to place your order.');
  if (reconcileCart()) {
    render();
    throw new Error(
      'Prices or availability changed. Review your cart before confirming.',
    );
  }
  if (!state.cart.length) throw new Error('Your cart is empty.');
  for (const key of ['customer', 'email', 'address']) {
    details[key] = details[key].trim();
    if (!details[key])
      throw new Error('Name, email and delivery address are required.');
  }
  let order;
  if (supabase) {
    const args = {
      p_customer: details.customer,
      p_email: details.email,
      p_address: details.address,
      p_payment: details.payment,
      p_items: state.cart.map((x) => ({ id: x.id, quantity: x.quantity })),
    };
    if (state.deliveryReady) args.p_phone = details.phone || '';
    const { data, error } = await supabase.rpc(
      state.deliveryReady ? 'place_order_with_phone' : 'place_order',
      args,
    );
    if (error) throw error;
    assertAccount(userId);
    order = data;
  } else {
    order = {
      id: crypto.randomUUID(),
      user_id: 'demo-customer',
      ...details,
      items: state.cart.map(({ id, name, price, quantity }) => ({
        id,
        name,
        price,
        quantity,
      })),
      total: cartTotal(),
      status: 'Pending',
      payment_verified: false,
      assigned_to: '',
      created_at: new Date().toISOString(),
    };
  }
  // A successful order must be confirmed even when a subsequent refresh fails.
  state.products = state.products.map((p) => ({
    ...p,
    stock: p.stock - (state.cart.find((x) => x.id === p.id)?.quantity || 0),
  }));
  state.orders = [order, ...state.orders.filter((o) => o.id !== order.id)];
  state.cart = [];
  state.selected = order;
  state.modal = 'confirmation';
  persist();
  render();
  if (supabase) {
    try {
      await refreshData();
      render();
    } catch {
      flash(
        'Your order was recorded. Latest updates are temporarily unavailable.',
      );
    }
  }
}

// Handle button actions from one listener so they still work after a render.
root.addEventListener('click', async (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled || state.busy) return;
  const action = el.dataset.action,
    id = el.dataset.id;
  state.busy = true;
  refreshVersion++;
  try {
    switch (action) {
      case 'overlay':
        if (event.target === el) {
          state.modal = '';
          render();
        }
        break;
      case 'close':
        state.modal = '';
        render();
        break;
      case 'menu':
        state.mobile = !state.mobile;
        render();
        break;
      case 'nav':
        navigate(el.dataset.page);
        break;
      case 'category':
        state.storeCategory = el.dataset.category || '';
        render();
        root
          .querySelector('.category-filter[aria-pressed="true"]')
          ?.focus({ preventScroll: true });
        break;
      case 'role-customer':
        state.modal = '';
        switchRole('customer');
        break;
      case 'switch-role':
        state.modal = '';
        switchRole(el.dataset.role);
        break;
      case 'account':
      case 'help':
      case 'notifications':
      case 'cart':
        if (action === 'cart') reconcileCart();
        state.modal = action;
        render();
        break;
      case 'checkout':
        if (state.role === 'guest') {
          state.showAuth = true;
          state.modal = '';
          render();
          flash('Sign in or create an account to place your order.');
          break;
        }
        reconcileCart();
        if (!state.cart.length) {
          state.modal = 'cart';
          render();
          flash('Add an item to your cart first.');
        } else {
          state.modal = 'checkout';
          render();
        }
        break;
      case 'explore':
        document
          .querySelector('#collection')
          ?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'new-product':
        state.selected = null;
        state.modal = 'product';
        render();
        break;
      case 'edit-product':
        state.selected = getProduct(id);
        state.modal = 'product';
        render();
        break;
      case 'stock':
        state.selected = getProduct(id);
        state.modal = 'stock';
        render();
        break;
      case 'delete-product': {
        const product = getProduct(id);
        if (!product || !confirm(`Remove ${product.name} from the catalog?`))
          break;
        if (supabase) {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }
        state.products = state.products.filter((x) => String(x.id) !== id);
        persist();
        render();
        flash('Product removed.');
        break;
      }
      case 'view-order':
        state.selected = getOrder(id);
        if (state.role === 'customer') {
          state.trackingId = id;
          state.modal = '';
          navigate('Track order');
        } else {
          state.modal = 'order';
          render();
        }
        break;
      case 'view-delivery':
        state.selected = getOrder(id);
        state.modal = 'driver-order';
        render();
        break;
      case 'delivery-step':
        await advanceDelivery(el.dataset.status);
        break;
      case 'confirm-delivery':
        state.modal = 'delivery-confirm';
        render();
        break;
      case 'verify':
        await updateOrder({ payment_verified: true });
        break;
      case 'alert-stock':
        await notifyAdmin(
          'Stock unavailable. Please review inventory for this order.',
        );
        break;
      case 'alert-ready':
        await notifyAdmin('Order prepared for delivery.');
        break;
      case 'add-cart': {
        const product = getProduct(id);
        if (!product || product.stock <= 0) {
          flash('This item is out of stock.');
          break;
        }
        const existing = state.cart.find((x) => String(x.id) === id);
        if (existing && existing.quantity >= product.stock) {
          flash('No more stock is available.');
          break;
        }
        if (existing) existing.quantity++;
        else state.cart.push({ ...product, quantity: 1 });
        render();
        flash(`${product.name} added to your cart.`);
        break;
      }
      case 'cart-minus': {
        const item = state.cart.find((x) => String(x.id) === id);
        if (item) {
          item.quantity--;
          state.cart = state.cart.filter((x) => x.quantity > 0);
        }
        render();
        break;
      }
      case 'cart-plus': {
        const item = state.cart.find((x) => String(x.id) === id);
        if (item && item.quantity < item.stock) item.quantity++;
        render();
        break;
      }
      case 'track':
        state.trackingId = String(state.selected.id);
        state.modal = '';
        navigate('Track order');
        break;
      case 'open-auth':
        state.showAuth = true;
        state.modal = '';
        render();
        break;
      case 'demo-signin':
        state.role = 'customer';
        state.showAuth = false;
        state.page = 'Shop';
        render();
        flash('You are signed in as a demo customer.');
        break;
      case 'browse-store':
        state.showAuth = false;
        render();
        break;
      case 'toggle-auth':
        state.authSignup = !state.authSignup;
        render();
        break;
      case 'retry-catalog':
        await loadPublicCatalog();
        render();
        break;
      case 'retry-account':
        await refreshData(true);
        render();
        break;
      case 'sign-out': {
        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          state.session = null;
          refreshVersion++;
          clearAccountData();
          await loadPublicCatalog();
        } else {
          state.role = 'guest';
          state.page = 'Shop';
          state.modal = '';
          state.cart = [];
        }
        render();
        break;
      }
    }
  } catch (error) {
    flash(error.message || 'Something went wrong. Please try again.');
  } finally {
    state.busy = false;
  }
});

// Apply the search as the user types and restore the cursor after rendering.
root.addEventListener('input', (event) => {
  if (event.target.matches('.search input')) {
    const input = event.target,
      pos = input.selectionStart;
    state.search = input.value;
    render();
    const replacement = root.querySelector('.search input');
    replacement.focus();
    replacement.setSelectionRange(pos, pos);
  }
});

// Save changes made with the workspace assignment and status menus.
root.addEventListener('change', async (event) => {
  const el = event.target;
  if (!el.dataset.change || state.busy) return;
  state.busy = true;
  refreshVersion++;
  el.disabled = true;
  try {
    if (el.dataset.change === 'assign')
      await updateOrder({ assigned_to: el.value || null });
    if (el.dataset.change === 'status') await updateOrder({ status: el.value });
    if (el.dataset.change === 'delivery-assign') await assignDelivery(el.value);
    if (el.dataset.change === 'role') {
      const { error } = await supabase.rpc('set_user_role', {
        p_user_id: el.dataset.id,
        p_role: el.value,
      });
      if (error) throw error;
      await refreshData();
      render();
      flash('Account role updated.');
    }
  } catch (error) {
    render();
    flash(error.message);
  } finally {
    state.busy = false;
    if (el.isConnected) el.disabled = false;
  }
});

// Send each form to the right save, checkout, or authentication handler.
root.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    type = form.dataset.form;
  if (!type || state.busy) return;
  state.busy = true;
  refreshVersion++;
  const values = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('[type="submit"],button:not([type])');
  if (submit) submit.disabled = true;
  if (type === 'auth') {
    const feedback = form.querySelector('.auth-feedback');
    if (feedback) feedback.hidden = true;
  }
  try {
    if (type === 'product') {
      const product = {
        ...(state.selected || { id: crypto.randomUUID() }),
        ...values,
        price: Number(values.price),
        stock: Number(values.stock),
      };
      await saveProduct(product);
    } else if (type === 'stock') {
      await saveProduct({ ...state.selected, stock: Number(values.stock) });
    } else if (type === 'checkout') {
      await placeOrder(values);
    } else if (type === 'delivery-confirm') {
      await advanceDelivery('Delivered', values.recipient);
    } else if (type === 'auth') {
      const result = state.authSignup
        ? await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: { data: { display_name: values.name } },
          })
        : await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          });
      if (result.error) throw result.error;
      if (state.authSignup && !result.data.session)
        showAuthFeedback(
          form,
          'Account request received. If email confirmation is enabled, check your inbox before signing in. Contact the administrator if confirmation emails are unavailable.',
          false,
        );
    }
  } catch (error) {
    if (type === 'auth') showAuthFeedback(form, authMessage(error));
    else flash(error.message || 'Something went wrong. Please try again.');
  } finally {
    state.busy = false;
    if (submit && submit.isConnected) submit.disabled = false;
  }
});
root.addEventListener(
  'error',
  (event) => {
    const image = event.target;
    if (
      image instanceof HTMLImageElement &&
      image.dataset.fallback &&
      image.src !== image.dataset.fallback
    ) {
      image.src = image.dataset.fallback;
    }
  },
  true,
);

// Load the limited catalog available to visitors without an account.
async function loadPublicCatalog() {
  if (!supabase) return;
  const version = ++refreshVersion;
  const { data, error } = await supabase.rpc('store_products');
  if (state.session || version !== refreshVersion) return;
  if (error) {
    state.products = [];
    state.catalogError =
      'The collection is temporarily unavailable. Please try again.';
    return;
  }
  state.products = data || [];
  state.catalogError = '';
  reconcileCart();
}

// Start in demo mode or connect to Supabase and keep session data up to date.
async function start() {
  upgradeDemoCatalog();
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) {
    render();
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    root.innerHTML =
      '<div class="loading">Add both the Supabase URL and public key in config.js.</div>';
    return;
  }
  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/+esm'
    );
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    clearAccountData();

    // Keep the guest cart during sign-in and reload data for the new session.
    async function applySession(session) {
      const previous = state.session?.user?.id;
      const changed = previous !== session?.user?.id;
      const guestCart = !previous && session ? state.cart.slice() : [];
      state.session = session;
      if (changed) {
        refreshVersion++;
        clearAccountData();
        state.cart = guestCart;
        state.loadError = '';
      }
      if (session && (changed || !state.profile)) {
        render();
        try {
          await refreshData(true);
        } catch (error) {
          state.loadError = error.message;
        }
      } else if (!session) {
        await loadPublicCatalog();
      }
      if (!session && state.showAuth) return;
      render();
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await applySession(data.session);
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session), 0);
    });
    setInterval(async () => {
      if (state.busy) return;
      if (!state.session) {
        try {
          await loadPublicCatalog();
          if (
            !state.modal &&
            !state.showAuth &&
            !root.querySelector('.search input:focus')
          )
            render();
        } catch (error) {
          console.error('Unable to refresh catalog:', error.message);
        }
        return;
      }
      try {
        const previousRole = state.role;
        await refreshData();
        if (
          previousRole !== state.role ||
          (!state.modal && !root.querySelector('.search input:focus'))
        )
          render();
        else if (state.modal === 'driver-order') render();
      } catch (error) {
        console.error('Unable to refresh workspace:', error.message);
      }
    }, 15000);
  } catch (error) {
    root.innerHTML = `<div class="loading">Unable to connect: ${esc(error.message)}. Check config.js and your internet connection, then reload.</div>`;
  }
}
root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !state.busy && state.modal) {
    state.modal = '';
    render();
  }
});
start();
