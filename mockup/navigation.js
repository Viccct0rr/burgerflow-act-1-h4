(function () {
  const routes = {
    dashboard: '../index.html',
    panel: '../index.html',
    ventas: '../panel_de_cajero_pos/code.html',
    sales: '../panel_de_cajero_pos/code.html',
    pedidos: '../carrito_y_confirmaci_n/code.html',
    orders: '../carrito_y_confirmaci_n/code.html',
    inventario: '../gesti_n_de_inventario/code.html',
    inventory: '../gesti_n_de_inventario/code.html',
    menú: '../men_de_clientes/code.html',
    menu: '../men_de_clientes/code.html',
    cocina: '../monitor_de_cocina_kds/code.html',
    kitchen: '../monitor_de_cocina_kds/code.html',
    delivery: '../panel_de_delivery/code.html',
    reportes: '../dashboard_del_vendedor/code.html',
    reports: '../dashboard_del_vendedor/code.html',
    settings: '../dashboard_del_vendedor/code.html',
    configuración: '../dashboard_del_vendedor/code.html',
    payments: '../panel_de_cajero_pos/code.html',
    receipt_long: '../carrito_y_confirmaci_n/code.html',
    inventory_2: '../gesti_n_de_inventario/code.html',
    restaurant_menu: '../men_de_clientes/code.html',
    local_shipping: '../panel_de_delivery/code.html',
    assessment: '../dashboard_del_vendedor/code.html',
    personalizar: '../personalizar_hamburguesa/code.html',
    shopping_cart: '../carrito_y_confirmaci_n/code.html',
    agregar_al_carrito: '../carrito_y_confirmaci_n/code.html'
  };

  function addPersistentSidebar() {
    if (document.querySelector('.sidebar, nav.bg-inverse-surface')) return;

    const sidebar = document.createElement('aside');
    sidebar.className = 'persistent-sidebar';
    sidebar.innerHTML = `
      <div class="persistent-brand"><span class="material-symbols-outlined">restaurant</span><strong>BurgerFlow</strong></div>
      <button class="persistent-new-order" data-route="../panel_de_cajero_pos/code.html"><span class="material-symbols-outlined">add</span>Nuevo pedido</button>
      <nav aria-label="Navegación principal">
        <a href="../index.html"><span class="material-symbols-outlined">dashboard</span>Panel principal</a>
        <a href="../panel_de_cajero_pos/code.html"><span class="material-symbols-outlined">payments</span>Ventas</a>
        <a href="../carrito_y_confirmaci_n/code.html"><span class="material-symbols-outlined">receipt_long</span>Pedidos</a>
        <a href="../gesti_n_de_inventario/code.html"><span class="material-symbols-outlined">inventory_2</span>Inventario</a>
        <a href="../men_de_clientes/code.html"><span class="material-symbols-outlined">restaurant_menu</span>Menú</a>
        <a href="../monitor_de_cocina_kds/code.html"><span class="material-symbols-outlined">kitchen</span>Cocina</a>
        <a href="../panel_de_delivery/code.html"><span class="material-symbols-outlined">local_shipping</span>Delivery</a>
        <a href="../dashboard_del_vendedor/code.html"><span class="material-symbols-outlined">assessment</span>Reportes</a>
      </nav>
      <a class="persistent-settings" href="../dashboard_del_vendedor/code.html"><span class="material-symbols-outlined">settings</span>Configuración</a>`;

    const style = document.createElement('style');
    style.textContent = `
      .persistent-sidebar { position:fixed; inset:0 auto 0 0; z-index:60; width:256px; display:flex; flex-direction:column; gap:16px; padding:24px 16px; color:#f7f7f7; background:#2f3131; box-sizing:border-box; font-family:Inter,sans-serif; }
      .persistent-brand { display:flex; align-items:center; gap:10px; padding:0 10px 12px; font:700 20px Montserrat,sans-serif; }
      .persistent-brand .material-symbols-outlined { color:#fff; background:#d32f2f; border-radius:10px; padding:8px; }
      .persistent-new-order { min-height:48px; display:flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:9px; color:#fff; background:#d32f2f; font:600 14px Inter,sans-serif; cursor:pointer; }
      .persistent-sidebar nav { display:grid; gap:4px; }
      .persistent-sidebar a { display:flex; align-items:center; gap:12px; min-height:44px; padding:0 12px; border-left:3px solid transparent; border-radius:0 8px 8px 0; color:#c9c9c9; text-decoration:none; font-size:14px; }
      .persistent-sidebar a:hover, .persistent-sidebar a:focus-visible { color:#1a1c1c; background:#e2e2e2; border-left-color:#d32f2f; outline:none; }
      .persistent-settings { margin-top:auto; }
      body.has-persistent-sidebar { padding-left:256px; }
      @media (max-width:760px) { .persistent-sidebar { transform:translateX(-100%); transition:transform .2s ease; } body.has-persistent-sidebar { padding-left:0; } }
    `;
    document.head.appendChild(style);
    document.body.prepend(sidebar);
    document.body.classList.add('has-persistent-sidebar');
  }

  

  function routeFor(label) {
    return routes[label.trim().toLowerCase().replace(/[.,]/g, '')];
  }

  function feedback(message) {
    let toast = document.getElementById('navigationToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'navigationToast';
      toast.setAttribute('role', 'status');
      toast.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:100;padding:14px 18px;border-radius:9px;color:#fff;background:#2f3131;box-shadow:0 8px 24px rgba(0,0,0,.2);font:14px Inter,sans-serif;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toast.feedbackTimer);
    toast.feedbackTimer = setTimeout(() => toast.remove(), 2200);
  }

  const currentPath = window.location.pathname;
  const navigationTargets = {
    dashboard: '../index.html', payments: '../panel_de_cajero_pos/code.html',
    receipt_long: '../carrito_y_confirmaci_n/code.html', inventory_2: '../gesti_n_de_inventario/code.html',
    restaurant_menu: '../men_de_clientes/code.html', kitchen: '../monitor_de_cocina_kds/code.html',
    local_shipping: '../panel_de_delivery/code.html', assessment: '../dashboard_del_vendedor/code.html',
    settings: '../dashboard_del_vendedor/code.html'
  };

  document.querySelectorAll('a[href="#"]').forEach((link) => {
    const icon = link.querySelector('[data-icon], .material-symbols-outlined');
    const destination = navigationTargets[icon ? icon.textContent.trim().toLowerCase() : ''] || routeFor(link.textContent);
    if (destination) link.href = destination;
  });

  document.querySelectorAll('nav a, nav button').forEach((item) => {
    const iconName = item.querySelector('[data-icon], .material-symbols-outlined')?.textContent.trim().toLowerCase();
    const destination = navigationTargets[iconName] || item.dataset.route;
    if (destination) {
      if (item.tagName === 'A') {
        item.classList.remove('bg-surface-container-highest', 'text-on-surface', 'font-bold', 'border-primary');
      }
      item.dataset.route = destination;
      const targetPath = new URL(destination, window.location.href).pathname;
      if (targetPath === currentPath) item.classList.add('bf-active');
    }
  });

  const shell = document.querySelector('body > nav:not(.persistent-sidebar)');
  shell?.classList.add('bf-standard-sidebar');
  if (shell && !document.querySelector('.bf-mobile-toggle')) {
    const toggle = document.createElement('button');
    toggle.className = 'bf-mobile-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Abrir navegación');
    toggle.innerHTML = '<span class="material-symbols-outlined">menu</span>';
    document.body.appendChild(toggle);
    const backdrop = document.createElement('button');
    backdrop.className = 'bf-nav-backdrop';
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Cerrar navegación');
    document.body.appendChild(backdrop);
    const closeNavigation = () => { shell.classList.remove('bf-open'); backdrop.classList.remove('bf-visible'); closeButton.style.display = 'none'; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
    toggle.addEventListener('click', () => { shell.classList.toggle('bf-open'); backdrop.classList.toggle('bf-visible'); });
    backdrop.addEventListener('click', closeNavigation);
    const closeButton = document.createElement('button');
    closeButton.className = 'bf-close-navigation';
    closeButton.type = 'button';
    closeButton.style.display = 'none';
    closeButton.setAttribute('aria-label', 'Cerrar navegación');
    closeButton.innerHTML = '<span class="material-symbols-outlined">close</span>';
    shell.append(closeButton);
    toggle.setAttribute('aria-controls', 'bf-main-navigation');
    toggle.setAttribute('aria-expanded', 'false');
    shell.id = 'bf-main-navigation';
    closeButton.addEventListener('click', closeNavigation);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNavigation(); });
    shell.querySelectorAll('a, button').forEach((item) => item.addEventListener('click', closeNavigation));
    toggle.addEventListener('click', () => { const open = shell.classList.contains('bf-open'); toggle.setAttribute('aria-expanded', open ? 'false' : 'true'); closeButton.style.display = open ? 'none' : 'grid'; });
  }

  const style = document.createElement('style');
  style.textContent = `
    :root { color-scheme: light; }
    body { color:#1a1c1c; background:#f9f9f9; }
    .text-tertiary, .text-on-surface-variant { color:#575757 !important; }
    .text-surface-variant { color:#e2e2e2 !important; }
    nav.bg-inverse-surface .text-surface-variant,
    nav.bg-inverse-surface a,
    nav.bg-inverse-surface button { color:#f1f1f1 !important; }
    .text-secondary, .text-on-secondary-container { color:#653900 !important; }
    .text-error, .text-on-error-container { color:#8f0008 !important; }
    .text-primary { color:#af101a !important; }
    .bg-primary, .bg-primary-container { background-color:#d32f2f !important; }
    .bg-secondary, .bg-secondary-container { background-color:#ff9800 !important; }
    .bg-error { background-color:#ba1a1a !important; }
    .text-on-secondary { color:#ffffff !important; }
    .text-on-primary-container { color:#ffffff !important; }
    .bg-\[\#4CAF50\] { background-color:#4CAF50 !important; }
    .text-\[\#4CAF50\] { color:#4CAF50 !important; }
    .border-\[\#4CAF50\] { border-color:#4CAF50 !important; }
    .bg-\[\#D32F2F\] { background-color:#D32F2F !important; }
    .bg-primary-fixed, .bg-primary-fixed-dim { background-color:#ffdad6 !important; }
    .bg-secondary-fixed, .bg-secondary-fixed-dim { background-color:#ffdcbe !important; }
    .bg-error-container { background-color:#ffdad6 !important; }
    .border-surface-variant { border-color:#e2e2e2 !important; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline:3px solid #7a2800 !important; outline-offset:2px; }
    .bf-active { color:#ffffff !important; background:#4a4d4d !important; border-left-color:#d32f2f !important; font-weight:700 !important; }
    .bf-active .material-symbols-outlined { color:#ffb3ac !important; }
    .bf-standard-sidebar { padding:24px 16px !important; }
    .bf-standard-sidebar.bf-open { display:flex !important; }
    .bf-standard-sidebar > div:first-child { display:flex !important; flex-direction:row !important; align-items:center !important; gap:10px !important; margin:0 0 20px !important; padding:0 10px 12px !important; }
    .bf-standard-sidebar > div:first-child > div:first-child { width:40px; height:40px; display:grid; place-items:center; flex:0 0 40px; border-radius:10px; background:#d32f2f; }
    .bf-standard-sidebar > div:first-child > div:first-child img { display:none; }
    .bf-standard-sidebar > div:first-child > div:first-child::before { content:none !important; }
    .bf-standard-sidebar > div:first-child h1 { margin:0 !important; font:700 20px/1.2 Montserrat,sans-serif !important; }
    .bf-standard-sidebar > div:first-child p { margin:5px 0 0 !important; font:11px/1.2 Inter,sans-serif !important; }
    .bf-standard-sidebar > button { width:calc(100% - 0px) !important; margin:0 0 20px !important; min-height:48px; }
    .bf-standard-sidebar ul { gap:4px !important; }
    .bf-standard-sidebar ul a { min-height:44px; border-left:3px solid transparent; border-radius:0 8px 8px 0; }
    body > nav:not(.persistent-sidebar) { width:256px !important; flex:0 0 256px !important; }
    body > nav:not(.persistent-sidebar) a, body > nav:not(.persistent-sidebar) button { min-height:44px; }
    .persistent-sidebar { width:256px !important; flex:0 0 256px !important; }
    .bf-mobile-toggle, .bf-nav-backdrop, .bf-close-navigation { display:none !important; }
    @media (max-width:760px) {
      body > nav:not(.persistent-sidebar) { transform:translateX(-105%); transition:transform .2s ease; }
      body > nav:not(.persistent-sidebar).bf-open { transform:translateX(0); }
      body > main { margin-left:0 !important; }
      .bf-mobile-toggle { position:fixed; top:12px; left:12px; z-index:80; width:44px; height:44px; display:grid; place-items:center; border:1px solid #e2e2e2; border-radius:10px; color:#1a1c1c; background:#fff; box-shadow:0 4px 12px rgba(33,33,33,.12); }
      .bf-close-navigation { display:none; }
      .bf-standard-sidebar .bf-close-navigation { position:absolute; top:12px; right:12px; }
      .bf-nav-backdrop { position:fixed; inset:0; z-index:49; border:0; background:rgba(26,28,28,.38); }
      .bf-nav-backdrop.bf-visible { display:block; }
      .bf-standard-sidebar.bf-open .bf-close-navigation { display:grid !important; place-items:center; width:44px; height:44px; border:0; border-radius:8px; color:#fff; background:transparent; }
    }
  `;
  document.head.appendChild(style);

  document.querySelectorAll('button').forEach((button) => {
    const label = button.textContent.trim().toLowerCase();
    const icon = button.querySelector('[data-icon], .material-symbols-outlined');
    const iconName = icon ? icon.textContent.trim().toLowerCase() : '';
    let destination;
    if (button.dataset.route) destination = button.dataset.route;
    if (!destination && routes[iconName] && iconName !== 'shopping_cart') destination = routes[iconName];
    if (label.includes('new order') || label.includes('nuevo pedido')) destination = routes.ventas;
    if (label.includes('volver al menú') || label.includes('volver al menu') || label.includes('inicio')) destination = routes.menu;
    if (label.includes('personalizar')) destination = routes.personalizar;
    if (iconName === 'shopping_cart') destination = routes.shopping_cart;
    if (label.includes('agregar al carrito')) destination = routes.agregar_al_carrito;
    if (!destination) return;
    button.addEventListener('click', () => {
      window.location.href = destination;
    });
  });

  document.querySelectorAll('.category-button').forEach((categoryButton) => {
    categoryButton.addEventListener('click', () => {
      const category = categoryButton.dataset.category;
      document.querySelectorAll('.category-button').forEach((item) => item.classList.remove('bg-primary-container', 'text-on-primary-container'));
      categoryButton.classList.add('bg-primary-container', 'text-on-primary-container');
      document.querySelectorAll('[data-product]').forEach((product) => {
        product.hidden = category !== 'all' && product.dataset.category !== category;
      });
    });
  });

  const menuSearch = document.getElementById('menuSearch');
  menuSearch?.addEventListener('input', () => {
    const query = menuSearch.value.trim().toLowerCase();
    if (typeof updateMenu === 'function') { updateMenu(); return; }
    document.querySelectorAll('[data-product]').forEach((product) => {
      product.hidden = Boolean(query) && !product.textContent.toLowerCase().includes(query);
    });
  });

  document.querySelectorAll('button[aria-label="Storefront"]').forEach((button) => {
    button.addEventListener('click', () => { window.location.href = routes.menu; });
  });

  document.querySelectorAll('button').forEach((button) => {
    const icon = button.querySelector('.material-symbols-outlined')?.textContent.trim().toLowerCase();
    const label = button.textContent.trim().toLowerCase();
    if (icon === 'edit') {
      button.addEventListener('click', () => feedback('Edición disponible para este producto'));
    }
    if (label.includes('agregar producto') || label.includes('nuevo producto')) {
      button.addEventListener('click', () => feedback('Formulario de nuevo producto disponible en el siguiente paso'));
    }
    if (label === 'anterior' || label === 'siguiente') {
      button.addEventListener('click', () => feedback(label === 'anterior' ? 'Página anterior' : 'Página siguiente'));
    }
    if (icon === 'notifications') {
      button.addEventListener('click', () => feedback('No tienes notificaciones nuevas'));
    }
    if (icon === 'my_location') {
      button.addEventListener('click', () => feedback('Centrando mapa en tu ubicación'));
    }
    if (icon === 'layers') {
      button.addEventListener('click', () => feedback('Capas del mapa actualizadas'));
    }
    if (label.includes('contactar cliente')) {
      button.addEventListener('click', () => feedback('Abriendo contacto del cliente'));
    }
  });

  document.querySelectorAll('[data-age-minutes]').forEach((card) => {
    if (Number(card.dataset.ageMinutes) > 15) {
      card.classList.add('bg-error-container/30', 'border-error');
    }
  });

  document.querySelectorAll('button').forEach((button) => {
    const icon = button.querySelector('.material-symbols-outlined')?.textContent.trim().toLowerCase();
    const label = button.textContent.trim().toLowerCase();
    if (icon === 'add' || icon === 'remove') {
      button.addEventListener('click', () => {
        const control = button.parentElement;
        const value = control?.querySelector('span:not(.material-symbols-outlined)');
        if (!value || !/^\d+$/.test(value.textContent.trim())) return;
        const next = Math.max(1, Number(value.textContent.trim()) + (icon === 'add' ? 1 : -1));
        value.textContent = String(next);
      });
    }
    if (icon === 'delete') {
      button.addEventListener('click', () => {
        const row = button.closest('tr, .group, article');
        if (row) row.remove();
      });
    }
    if (label.includes('aceptar') || label.includes('listo para despacho')) {
      button.addEventListener('click', () => {
        const card = button.closest('article');
        const nextColumn = card?.parentElement?.parentElement?.nextElementSibling?.querySelector('div.flex-1');
        if (card && nextColumn) nextColumn.appendChild(card);
        button.disabled = true;
        button.textContent = 'Actualizado';
      });
    }
  });

  const posSearch = document.querySelector('input[placeholder="Buscar producto, código..."]');
  const posSection = posSearch?.closest('main')?.querySelector('section');
  const posProducts = posSection ? [...posSection.querySelectorAll('.group')] : [];
  const orderSection = posSearch?.closest('main') ? [...posSearch.closest('main').querySelectorAll('section')].find((section) => section.textContent.includes('Orden Actual')) : null;
  posSearch?.addEventListener('input', () => {
    const query = posSearch.value.trim().toLowerCase();
    posProducts.forEach((product) => {
      product.hidden = query && !product.textContent.toLowerCase().includes(query);
    });
  });

  posProducts.forEach((product) => product.addEventListener('click', () => {
    if (product.querySelector('.bg-error')) return;
    const orderList = orderSection?.querySelector('.overflow-y-auto');
    const template = orderList?.querySelector('.group');
    if (!orderList || !template) return;
    const item = template.cloneNode(true);
    const title = product.querySelector('h3')?.textContent.trim();
    const price = product.querySelector('p')?.textContent.trim();
    const itemTitle = item.querySelector('h4');
    const itemPrice = item.querySelector('.font-semibold');
    if (itemTitle) itemTitle.textContent = title || 'Producto';
    if (itemPrice) itemPrice.textContent = price || 'Bs 0.00';
    orderList.appendChild(item);
  }));

  posSection?.querySelectorAll('button').forEach((categoryButton) => {
    categoryButton.addEventListener('click', () => {
      const category = categoryButton.textContent.toLowerCase();
      posSection.querySelectorAll('button').forEach((item) => item.classList.remove('bg-inverse-surface', 'text-on-primary'));
      categoryButton.classList.add('bg-inverse-surface', 'text-on-primary');
      posProducts.forEach((product) => {
        const text = product.textContent.toLowerCase();
        const match = category.includes('hamburg') ? /burger|chicken/.test(text) : category.includes('acompa') ? /papas|fries/.test(text) : category.includes('bebida') ? /drink|shake|coke/.test(text) : category.includes('postre') ? /postre|dessert|cake/.test(text) : true;
        product.hidden = !match;
      });
    });
  });

  document.querySelectorAll('button').forEach((button) => {
    const label = button.textContent.trim().toLowerCase();
    if (label.includes('enviar a cocina')) {
      button.addEventListener('click', () => {
        window.location.href = routes.kitchen;
      });
    }
    if (/\b(efectivo|tarjeta|app)\b/.test(label)) {
      button.addEventListener('click', () => {
        button.parentElement?.querySelectorAll('button').forEach((item) => item.classList.remove('border-primary', 'text-primary'));
        button.classList.add('border-primary', 'text-primary');
      });
    }
  });

  const inventorySearch = document.querySelector('input[placeholder="Buscar productos..."]');
  inventorySearch?.addEventListener('input', () => {
    const query = inventorySearch.value.trim().toLowerCase();
    inventorySearch.closest('main')?.querySelectorAll('tbody tr').forEach((row) => {
      row.hidden = query && !row.textContent.toLowerCase().includes(query);
    });
  });

  const deliverySearch = document.querySelector('input[placeholder="Buscar pedido o dirección..."]');
  deliverySearch?.addEventListener('input', () => {
    const query = deliverySearch.value.trim().toLowerCase();
    deliverySearch.closest('div')?.parentElement?.parentElement?.querySelectorAll('.cursor-pointer').forEach((card) => {
      card.hidden = query && !card.textContent.toLowerCase().includes(query);
    });
  });

  document.querySelectorAll('button').forEach((button) => {
    const label = button.textContent.trim().toLowerCase();
    if (!/^(todas|asignadas|en camino)/.test(label)) return;
    button.addEventListener('click', () => {
      const panel = button.closest('div.sticky')?.parentElement;
      const status = label.startsWith('todas') ? '' : label.startsWith('asignadas') ? 'asignada' : 'en camino';
      panel?.querySelectorAll('.cursor-pointer').forEach((card) => {
        card.hidden = Boolean(status) && !card.textContent.toLowerCase().includes(status);
      });
    });
  });
})();