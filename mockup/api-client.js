(function () {
  const API = '/api';
  let currentUser = null;
  const money = (cents) => `Bs ${(Number(cents || 0) / 100).toFixed(2)}`;
  const extraPriceDeltas = new Map([
    ['Queso extra', 100],
    ['Tocino extra', 150],
    ['Huevo frito', 100],
    ['Aros de cebolla', 120]
  ]);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function personalizationPriceDelta(option) {
    if (!option || typeof option.name !== 'string' || typeof option.value !== 'string') return 0;
    if (option.name === 'Tamaño' && option.value === 'grande') return 200;
    if (option.name === 'Extra') return extraPriceDeltas.get(option.value) || 0;
    if (option.name === 'Personalización') {
      const legacyExtra = option.value.match(/^(Queso extra|Tocino extra|Huevo frito|Aros de cebolla)(?:\s*\+\s*Bs\s*\d+(?:\.\d{1,2})?)?$/i)?.[1];
      return [...extraPriceDeltas].find(([name]) => name.toLowerCase() === legacyExtra?.toLowerCase())?.[1] || 0;
    }
    return 0;
  }

  function itemUnitPriceCents(product, item) {
    const options = Array.isArray(item.personalizations) ? item.personalizations : [];
    return product.priceCents + options.reduce((sum, option) =>
      sum + personalizationPriceDelta(option), 0);
  }

  function toast(message, error = false) {
    let node = $('#burgerFlowToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'burgerFlowToast';
      node.setAttribute('role', 'status');
      node.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:120;padding:14px 18px;border-radius:9px;color:#fff;background:#2f3131;box-shadow:0 8px 24px rgba(0,0,0,.2);font:14px Inter,sans-serif;max-width:min(420px,calc(100vw - 32px));';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.style.background = error ? '#af101a' : '#2f3131';
    clearTimeout(node.timer);
    node.timer = setTimeout(() => node.remove(), 3500);
  }

  function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    return fetch(`${API}${path}`, {
      ...options,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }).then(async (response) => {
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(body?.error || `Error HTTP ${response.status}`);
        error.status = response.status;
        if (response.status === 401) showLogin();
        throw error;
      }
      return body;
    });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showLogin() {
    if ($('#burgerFlowLogin')) return;
    const overlay = element('div');
    overlay.id = 'burgerFlowLogin';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(20,20,20,.65);display:grid;place-items:center;padding:20px;';
    const panel = element('section');
    panel.setAttribute('aria-labelledby', 'burgerFlowLoginTitle');
    panel.style.cssText = 'width:min(100%,420px);background:#fff;border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Inter,sans-serif;';
    const title = element('h2', '', 'Acceso a BurgerFlow');
    title.id = 'burgerFlowLoginTitle';
    title.style.cssText = 'font:700 24px Montserrat,sans-serif;margin:0 0 8px;color:#1a1c1c;';
    const hint = element('p', '', 'Inicia sesión con una cuenta de demostración.');
    hint.style.cssText = 'margin:0 0 20px;color:#575757;font-size:14px;';
    const form = element('form');
    const emailLabel = element('label', '', 'Correo');
    emailLabel.style.cssText = 'display:grid;gap:6px;margin-bottom:12px;font-size:14px;font-weight:600;';
    const email = element('input');
    email.type = 'email';
    email.name = 'email';
    email.required = true;
    email.autocomplete = 'username';
    email.style.cssText = 'padding:12px;border:1px solid #ccc;border-radius:8px;font:inherit;';
    emailLabel.appendChild(email);
    const passwordLabel = element('label', '', 'Contraseña');
    passwordLabel.style.cssText = emailLabel.style.cssText;
    const password = element('input');
    password.type = 'password';
    password.name = 'password';
    password.required = true;
    password.autocomplete = 'current-password';
    password.style.cssText = email.style.cssText;
    passwordLabel.appendChild(password);
    const error = element('p');
    error.setAttribute('role', 'alert');
    error.style.cssText = 'min-height:20px;color:#af101a;font-size:13px;';
    const submit = element('button', '', 'Iniciar sesión');
    submit.type = 'submit';
    submit.style.cssText = 'width:100%;padding:13px;border:0;border-radius:8px;background:#af101a;color:#fff;font-weight:700;cursor:pointer;';
    form.append(emailLabel, passwordLabel, error, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = '';
      try {
        const result = await request('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
        currentUser = result.user;
        window.BurgerFlowUser = currentUser;
        overlay.remove();
        window.location.reload();
      } catch (loginError) {
        error.textContent = loginError.message;
      } finally {
        submit.disabled = false;
      }
    });
    panel.append(title, hint, form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    email.focus();
  }

  async function requireRole(roles) {
    if (!currentUser) {
      showLogin();
      throw new Error('Se requiere iniciar sesión.');
    }
    if (!roles.includes(currentUser.role)) {
      toast('Esta pantalla no corresponde a tu rol.', true);
      throw new Error('Rol no autorizado para esta pantalla.');
    }
    return currentUser;
  }

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function safeSessionCart() {
    try {
      const cart = JSON.parse(sessionStorage.getItem('burgerflowCart') || '[]');
      return Array.isArray(cart) ? cart.filter((item) =>
        item && Number.isSafeInteger(item.productId) && Number.isSafeInteger(item.quantity) && item.quantity > 0)
        .map((item) => ({
          ...item,
          personalizations: Array.isArray(item.personalizations) ? item.personalizations.filter((option) =>
            option && typeof option.name === 'string' && typeof option.value === 'string') : []
        })) : [];
    } catch (error) {
      console.error('No se pudo leer el carrito de demostración.', error);
      return [];
    }
  }

  function addLogoutControl() {
    if (!currentUser || $('#burgerFlowLogout')) return;
    const hasNavigation = Boolean($('.sidebar') || $('body > nav') || $('.persistent-sidebar'));
    const button = element('button', '');
    button.id = 'burgerFlowLogout';
    button.type = 'button';
    button.textContent = `Cerrar sesión · ${currentUser.role}`;
    button.style.cssText = hasNavigation
      ? 'position:fixed;left:12px;bottom:12px;z-index:100;width:232px;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;color:#f1f1f1;background:#3c3f3f;text-align:left;font:600 13px Inter,sans-serif;cursor:pointer;'
      : 'position:fixed;right:16px;bottom:16px;z-index:100;max-width:calc(100vw - 32px);padding:10px 12px;border:1px solid #d7d7d7;border-radius:8px;color:#fff;background:#3c3f3f;text-align:left;font:600 13px Inter,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.18);';
    button.addEventListener('click', async () => {
      try {
        await request('/auth/logout', { method: 'POST' });
        location.href = '/index.html';
      } catch (error) {
        toast(error.message, true);
      }
    });
    document.body.appendChild(button);
  }

  function saveCart(cart) {
    sessionStorage.setItem('burgerflowCart', JSON.stringify(cart));
  }

  function personalize() {
    const button = $('#addToCartBtn');
    const id = Number(new URLSearchParams(location.search).get('product'));
    if (!button) return;
    request('/products').then(({ products }) => {
      const product = products.find((item) => item.id === id) || products[0];
      if (!product) throw new Error('No hay productos activos para personalizar.');
      button.dataset.productId = String(product.id);
      const title = $('main h1');
      if (title) title.textContent = product.name;
      const price = $('main h1 + span');
      if (price) price.textContent = money(product.priceCents);
      window.dispatchEvent(new Event('burgerflow:product-loaded'));
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const quantity = Number($('input[type="number"]')?.value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 25) {
          toast('La cantidad debe ser un entero entre 1 y 25.', true);
          return;
        }
        const choices = [];
        const size = $('input[name="size"]:checked');
        if (size) choices.push({ name: 'Tamaño', value: size.value });
        for (const input of $$('input[type="checkbox"]:checked')) {
          const label = input.closest('label');
          const optionName = label?.querySelector('div span')?.textContent.trim() ||
            label?.querySelector('span')?.textContent.trim();
          if (!optionName) continue;
          if (/\+\s*Bs/.test(label.textContent)) choices.push({ name: 'Extra', value: optionName });
          else choices.push({ name: 'Sin', value: optionName.replace(/^Sin\s+/i, '') });
        }
        const cart = safeSessionCart();
        cart.push({ productId: product.id, quantity, personalizations: choices });
        saveCart(cart);
        toast(`${product.name} agregado al carrito. El precio se verificará en el servidor.`);
        setTimeout(() => { location.href = '../carrito_y_confirmaci_n/code.html'; }, 400);
      }, { once: true });
    }).catch((error) => toast(error.message, true));
  }

  function customerMenu() {
    request('/products').then(({ products }) => {
      const grid = $('#menuProductGrid');
      if (!grid) throw new Error('No se encontró la cuadrícula del menú.');
      const cards = $$('[data-product]', grid);
      const template = cards[0];
      if (!template) throw new Error('No se encontró una tarjeta de producto para el menú.');

      const imageByName = new Map(cards.map((card) => [
        $('h3', card)?.textContent.trim().toLocaleLowerCase(),
        $('img', card)?.getAttribute('src')
      ]));
      const categoryKey = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const categoryAliases = { acompanamientos: 'papas' };
      grid.replaceChildren();

      for (const product of products) {
        const card = template.cloneNode(true);
        const category = categoryKey(product.category);
        card.dataset.productId = String(product.id);
        card.dataset.category = categoryAliases[category] || category;
        setText($('h3', card), product.name);
        setText($('p', card), product.description);
        setText($('.font-headline-md.text-headline-md.text-on-surface', card), money(product.priceCents));

        const image = $('img', card);
        const imageSource = imageByName.get(product.name.toLocaleLowerCase());
        if (image && imageSource) {
          image.src = imageSource;
          image.alt = product.name;
        } else if (image) {
          const media = image.parentElement;
          image.remove();
          media.classList.add('flex', 'items-center', 'justify-center');
          media.appendChild(element('span', 'material-symbols-outlined text-tertiary text-6xl', 'restaurant'));
        }

        const customizeButton = $('button', card);
        customizeButton.type = 'button';
        if (card.dataset.category === 'hamburguesas') {
          customizeButton.addEventListener('click', () => {
            location.href = `../personalizar_hamburguesa/code.html?product=${product.id}`;
          });
        } else {
          customizeButton.querySelector('[data-icon]')?.replaceChildren('add_shopping_cart');
          const labelText = [...customizeButton.childNodes].find((node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (labelText) labelText.textContent = ' Agregar al carrito';
          customizeButton.setAttribute('aria-label', `Agregar ${product.name} al carrito`);
          customizeButton.addEventListener('click', () => {
            const cart = safeSessionCart();
            cart.push({ productId: product.id, quantity: 1, personalizations: [] });
            saveCart(cart);
            toast(`${product.name} agregado al carrito.`);
            setTimeout(() => { location.href = '../carrito_y_confirmaci_n/code.html'; }, 400);
          });
        }
        grid.appendChild(card);
      }
      window.updateMenu?.();
    }).catch((error) => toast(error.message, true));
  }

  function cartPage() {
    const main = $('main');
    const confirmButton = $('#confirmOrderBtn');
    if (!main || !confirmButton) return;
    const rows = $$('.group', main).filter((row) => $('button[aria-label="Increase quantity"]', row));
    const container = rows[0]?.parentElement;
    if (!container) return;
    const template = rows[0];
    rows.forEach((row) => row.remove());
    const productMap = new Map();
    const empty = element('p', 'text-center text-tertiary p-md', 'Tu carrito está vacío. Agrega productos desde el menú.');
    container.appendChild(empty);
    let orderTypeSelect;
    const summary = confirmButton.parentElement;
    const paymentField = $('#paymentMethod');
    if (paymentField) {
      const label = element('label', 'flex flex-col gap-xs font-label-md text-label-md text-on-surface-variant');
      label.appendChild(element('span', '', 'Tipo de pedido'));
      orderTypeSelect = element('select', 'w-full border-2 border-surface-variant rounded-lg p-sm bg-surface-container-lowest');
      orderTypeSelect.add(new Option('Comer aquí', 'dine_in'));
      orderTypeSelect.add(new Option('Para llevar', 'pickup'));
      orderTypeSelect.add(new Option('Delivery', 'delivery'));
      orderTypeSelect.value = 'dine_in';
      label.appendChild(orderTypeSelect);
      summary.insertBefore(label, paymentField.parentElement);
    }

    function renderCart(products) {
      const cart = safeSessionCart();
      productMap.clear();
      products.forEach((product) => productMap.set(product.id, product));
      $$('[data-cart-index]', container).forEach((row) => row.remove());
      for (const [index, item] of cart.entries()) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        const row = template.cloneNode(true);
        row.dataset.cartIndex = String(index);
        const title = $('h2', row);
        setText(title, product.name);
        const price = $('h2 + span', row);
        setText(price, money(product.priceCents));
        const count = $('button[aria-label="Increase quantity"]', row)?.previousElementSibling;
        setText(count, String(item.quantity));
        const increaseButton = $('button[aria-label="Increase quantity"]', row);
        if (increaseButton) increaseButton.disabled = item.quantity >= 25;
        const note = $('p', row);
        setText(note, (item.personalizations || []).map((option) => option.value).join(', '));
        setText($('h2 + span', row), money(itemUnitPriceCents(product, item)));
        container.appendChild(row);
      }
      empty.hidden = cart.length > 0;
      if (!cart.length) container.appendChild(empty);
      const subtotal = cart.reduce((sum, item) => {
        const product = productMap.get(item.productId);
        return sum + (product ? itemUnitPriceCents(product, item) : 0) * item.quantity;
      }, 0);
      const tax = Math.round(subtotal * 0.08);
      const service = cart.length ? 50 : 0;
      const amounts = $$('.justify-between span:last-child', summary);
      if (amounts.length >= 4) {
        setText(amounts[0], money(subtotal));
        setText(amounts[1], money(tax));
        setText(amounts[2], money(service));
        setText(amounts[3], money(subtotal + tax + service));
      }
      confirmButton.disabled = !cart.length || !paymentField?.value;
    }
    paymentField?.addEventListener('change', () => {
      confirmButton.disabled = !safeSessionCart().length || !paymentField.value;
    });

    function askDeliveryInfo() {
      return new Promise((resolve) => {
        const overlay = element('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:150;background:rgba(20,20,20,.6);display:grid;place-items:center;padding:20px;';
        const form = element('form');
        form.className = 'w-full max-w-md rounded-xl bg-white p-6 shadow-2xl grid gap-3';
        form.appendChild(element('h2', 'font-headline-md', 'Datos de entrega (demo)'));
        const fields = [['name', 'Nombre ficticio', 'text'], ['phone', 'Teléfono ficticio', 'tel'], ['address', 'Dirección ficticia', 'text']];
        const controls = {};
        for (const [name, placeholder, type] of fields) {
          const input = element('input', 'border-2 border-surface-variant rounded-lg p-3');
          input.name = name;
          input.type = type;
          input.placeholder = placeholder;
          input.required = true;
          input.maxLength = name === 'address' ? 240 : 100;
          controls[name] = input;
          form.appendChild(input);
        }
        const actions = element('div', 'flex justify-end gap-2');
        const cancel = element('button', 'rounded-lg border-2 border-surface-variant px-4 py-2', 'Cancelar');
        cancel.type = 'button';
        const save = element('button', 'rounded-lg bg-primary-container px-4 py-2 text-white', 'Confirmar');
        save.type = 'submit';
        actions.append(cancel, save);
        form.appendChild(actions);
        cancel.addEventListener('click', () => { overlay.remove(); resolve(null); });
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const values = Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value.trim()]));
          overlay.remove();
          resolve(values);
        });
        overlay.appendChild(form);
        document.body.appendChild(overlay);
        controls.name.focus();
      });
    }

    let submitting = false;
    confirmButton.addEventListener('click', async (event) => {
      event.preventDefault();
      if (submitting) return;
      const cart = safeSessionCart();
      if (!cart.length || !paymentField?.value) {
        toast('Agrega productos y selecciona un método de pago.', true);
        return;
      }
      if (!currentUser) {
        showLogin();
        toast('Inicia sesión como cliente o cajero para registrar el pedido.', true);
        return;
      }
      let delivery;
      if (orderTypeSelect?.value === 'delivery') {
        delivery = await askDeliveryInfo();
        if (!delivery) return;
      }
      submitting = true;
      confirmButton.disabled = true;
      try {
        const result = await request('/orders', {
          method: 'POST',
          body: {
            items: cart,
            orderType: orderTypeSelect?.value || 'dine_in',
            paymentMethod: { Efectivo: 'cash', Tarjeta: 'card', QR: 'qr' }[paymentField.value],
            delivery
          }
        });
        sessionStorage.removeItem('burgerflowCart');
        const overlay = $('#confirmationOverlay');
        if (overlay) {
          setText($('h2 + p', overlay), `#${result.order.code}`);
          for (const row of $$('.justify-between', overlay)) {
            const label = row.firstElementChild?.textContent.trim();
            if (label === 'Tipo:') {
              const labelByType = { dine_in: 'Comer en el local', pickup: 'Para llevar', delivery: 'Delivery' };
              setText(row.lastElementChild, labelByType[result.order.type]);
            }
            if (label === 'Total:') setText(row.lastElementChild, money(result.order.totalCents));
          }
          overlay.classList.remove('hidden', 'opacity-0');
          const modal = overlay.firstElementChild;
          modal?.classList.remove('scale-95');
          modal?.classList.add('scale-100');
        }
        toast(`Pedido ${result.order.code} registrado en la base de datos.`);
        renderCart([]);
      } catch (error) {
        toast(error.message, true);
      } finally {
        submitting = false;
        confirmButton.disabled = !safeSessionCart().length || !paymentField?.value;
      }
    });
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const row = button?.closest('[data-cart-index]');
      if (!button || !row) return;
      const cart = safeSessionCart();
      const index = Number(row.dataset.cartIndex);
      if (button.matches('[aria-label="Increase quantity"]')) {
        if (cart[index].quantity >= 25) return toast('La cantidad máxima por producto es 25.', true);
        cart[index].quantity += 1;
      }
      else if (button.matches('[aria-label="Decrease quantity"]')) cart[index].quantity -= 1;
      else if (button.querySelector('.material-symbols-outlined')?.textContent.trim() === 'delete') cart.splice(index, 1);
      if (cart[index]?.quantity <= 0) cart.splice(index, 1);
      saveCart(cart);
      renderCart([...productMap.values()]);
    });
    request('/products').then(({ products }) => renderCart(products)).catch((error) => toast(error.message, true));
    $('#closeOverlayBtn')?.addEventListener('click', () => { location.href = '../index.html'; });
    $('#continueShoppingBtn')?.addEventListener('click', () => { location.href = '../men_de_clientes/code.html'; });
  }

  function inventoryPage() {
    const body = $('tbody');
    const addButton = $$('button').find((button) => button.textContent.includes('Agregar Producto'));
    if (!body || !addButton) return;

    const showProductForm = () => {
      if ($('#inventoryForm')) return;
      const overlay = element('div', 'fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4');
      overlay.id = 'inventoryForm';
      const form = element('form', 'w-full max-w-md rounded-xl bg-white p-6 shadow-2xl grid gap-3');
      form.appendChild(element('h2', 'font-headline-md mb-2', 'Agregar producto'));
      const controls = {};
      for (const [name, placeholder, type] of [
        ['name', 'Nombre del producto', 'text'], ['category', 'Categoría', 'text'],
        ['price', 'Precio (Bs)', 'number'], ['quantity', 'Stock actual', 'number'], ['unit', 'Unidad', 'text']
      ]) {
        const input = element('input', 'border-2 border-surface-variant rounded-lg p-3');
        input.name = name;
        input.placeholder = placeholder;
        input.type = type;
        input.required = true;
        if (type === 'number') {
          input.min = '0';
          input.step = name === 'price' ? '0.01' : '1';
        }
        controls[name] = input;
        form.appendChild(input);
      }
      const buttons = element('div', 'mt-2 flex justify-end gap-2');
      const cancel = element('button', 'rounded-lg border-2 border-surface-variant px-4 py-2', 'Cancelar');
      cancel.type = 'button';
      const save = element('button', 'rounded-lg bg-primary-container px-4 py-2 text-white', 'Guardar');
      save.type = 'submit';
      buttons.append(cancel, save);
      form.appendChild(buttons);
      cancel.addEventListener('click', () => overlay.remove());
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const quantity = Number(controls.quantity.value);
        const price = Number(controls.price.value);
        if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) {
          toast('El stock debe ser entero no negativo y el precio debe ser válido.', true);
          return;
        }
        try {
          await request('/products', { method: 'POST', body: {
            name: controls.name.value,
            category: controls.category.value,
            description: '',
            priceCents: Math.round(price * 100),
            quantity,
            unit: controls.unit.value
          } });
          overlay.remove();
          await loadInventory();
          toast('Producto guardado en SQLite.');
        } catch (error) {
          toast(error.message, true);
        }
      });
      overlay.appendChild(form);
      document.body.appendChild(overlay);
      controls.name.focus();
    };

    function button(icon, label, action, className) {
      const control = element('button', className || 'p-2 hover:bg-surface-container rounded-full');
      control.type = 'button';
      control.dataset.inventoryAction = action;
      control.setAttribute('aria-label', label);
      control.appendChild(element('span', 'material-symbols-outlined', icon));
      return control;
    }

    function renderInventory(items) {
      body.replaceChildren();
      for (const item of items) {
        const row = element('tr', 'hover:bg-surface transition-colors');
        row.dataset.productId = String(item.id);
        row.dataset.priceCents = String(item.priceCents);
        const values = [
          [item.name, 'px-md py-4 font-semibold'],
          [item.category, 'px-md py-4 text-on-surface-variant'],
          [String(item.quantity), 'px-md py-4 font-headline-md'],
          [item.unit, 'px-md py-4 text-on-surface-variant'],
          [item.quantity <= item.lowStockThreshold ? 'Bajo' : 'Suficiente', 'px-md py-4']
        ];
        for (const [text, className] of values) {
          const cell = element('td', className);
          if (className.includes('py-4') && text === 'Bajo' || text === 'Suficiente') {
            const badge = element('span', 'inline-block rounded-full px-3 py-1 text-white');
            badge.classList.add(text === 'Bajo' ? 'bg-error' : 'bg-[#4CAF50]');
            badge.textContent = text;
            cell.appendChild(badge);
          } else cell.textContent = text;
          row.appendChild(cell);
        }
        const actions = element('td', 'px-md py-4 text-right');
        const group = element('div', 'flex justify-end gap-2 text-on-surface-variant');
        group.append(
          button('edit', 'Editar producto', 'edit', 'p-2 hover:bg-surface-container rounded-full hover:text-primary'),
          button('inventory_2', 'Ajustar stock', 'stock'),
          button('delete', 'Desactivar producto', 'deactivate', 'p-2 hover:bg-surface-container rounded-full hover:text-error')
        );
        actions.appendChild(group);
        row.appendChild(actions);
        body.appendChild(row);
      }
      const caption = body.closest('table')?.parentElement?.nextElementSibling?.querySelector('span');
      setText(caption, `Mostrando ${items.length} productos activos`);
    }

    async function loadInventory() {
      const { inventory } = await request('/inventory');
      renderInventory(inventory);
    }

    addButton.addEventListener('click', showProductForm);
    body.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-inventory-action]');
      const row = button?.closest('tr[data-product-id]');
      if (!button || !row) return;
      const itemId = Number(row.dataset.productId);
      const name = row.cells[0].textContent;
      try {
        if (button.dataset.inventoryAction === 'stock') {
          const current = Number(row.cells[2].textContent);
          const answer = window.prompt(`Nueva cantidad para ${name}:`, String(current));
          if (answer === null) return;
          const quantity = Number(answer);
          if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('La cantidad debe ser un entero no negativo.');
          await request(`/inventory/${itemId}`, { method: 'PATCH', body: { quantity, reason: 'Ajuste desde inventario' } });
        } else if (button.dataset.inventoryAction === 'edit') {
          const nameInput = window.prompt('Nombre del producto:', name);
          if (nameInput === null) return;
          const category = window.prompt('Categoría:', row.cells[1].textContent);
          if (category === null) return;
          const currentPrice = (Number(row.dataset.priceCents) / 100).toFixed(2);
          const priceInput = window.prompt('Precio en Bs:', currentPrice);
          if (priceInput === null) return;
          const price = Number(priceInput);
          if (!Number.isFinite(price) || price < 0 || !/^\d+(?:\.\d{1,2})?$/.test(priceInput.trim())) {
            throw new Error('El precio debe ser un importe no negativo con hasta dos decimales.');
          }
          await request(`/products/${itemId}`, { method: 'PATCH', body: {
            name: nameInput,
            category,
            priceCents: Math.round(price * 100)
          } });
        } else if (button.dataset.inventoryAction === 'deactivate') {
          if (!window.confirm(`¿Desactivar ${name}? Se conserva el historial de pedidos.`)) return;
          await request(`/products/${itemId}`, { method: 'DELETE' });
        }
        await loadInventory();
        toast('Cambios guardados en la base de datos.');
      } catch (error) {
        toast(error.message, true);
      }
    });
    loadInventory().catch((error) => toast(error.message, true));
  }

  function posPage() {
    const search = $('input[placeholder="Buscar producto, código..."]');
    const main = search?.closest('main');
    if (!main) return;
    const productGrid = [...main.querySelectorAll('section')][0]?.querySelector('.grid');
    const orderSection = [...main.querySelectorAll('section')].find((section) => section.textContent.includes('Orden Actual'));
    const orderList = orderSection?.querySelector('.overflow-y-auto');
    const template = orderList?.querySelector('.group');
    if (!productGrid || !orderList || !template) return;
    const productCards = [...productGrid.querySelectorAll('.group')];
    const selected = new Map();
    let productCache = [];
    const paymentButtons = [...main.querySelectorAll('button')].filter((button) => /^(efectivo|tarjeta|app)$/i.test(button.textContent.trim()));
    let paymentMethod = 'cash';
    const orderType = 'dine_in';

    function renderOrder() {
      orderList.replaceChildren();
      for (const [id, quantity] of selected) {
        const product = productCache.find((item) => item.id === id);
        if (!product) continue;
        const row = template.cloneNode(true);
        row.dataset.productId = String(id);
        setText($('h4', row), product.name);
        setText($('.font-semibold', row), money(product.priceCents));
        const amount = row.querySelector('button')?.parentElement?.querySelector('span:not(.material-symbols-outlined)');
        setText(amount, String(quantity));
        row.querySelectorAll('button').forEach((button) => button.dataset.posAction =
          button.querySelector('.material-symbols-outlined')?.textContent.trim() === 'delete' ? 'remove' :
          button.querySelector('.material-symbols-outlined')?.textContent.trim() === 'add' ? 'increase' : 'decrease');
        orderList.appendChild(row);
      }
      const subtotal = [...selected].reduce((sum, [id, quantity]) =>
        sum + (productCache.find((product) => product.id === id)?.priceCents || 0) * quantity, 0);
      const amounts = $$('.justify-between span:last-child', orderSection.querySelector('.sticky.bottom-0') || orderSection);
      if (amounts.length >= 3) {
        setText(amounts[0], money(subtotal));
        setText(amounts[1], money(Math.round(subtotal * 0.08)));
        setText(amounts[2], money(subtotal + Math.round(subtotal * 0.08) + 50));
      }
    }

    request('/products').then(({ products }) => {
      productCache = products;
      const byName = new Map(products.map((product) => [product.name.toLocaleLowerCase(), product]));
      productCards.forEach((card) => {
        const product = byName.get($('h3', card)?.textContent.trim().toLocaleLowerCase());
        if (!product) {
          card.style.display = 'none';
          return;
        }
        card.style.display = '';
        card.dataset.productId = String(product.id);
        setText($('p', card), money(product.priceCents));
      });
      selected.clear();
      renderOrder();
    }).catch((error) => toast(error.message, true));

    productGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.group[data-product-id]');
      if (!card) return;
      const id = Number(card.dataset.productId);
      selected.set(id, Math.min(25, (selected.get(id) || 0) + 1));
      renderOrder();
    });
    orderList.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const row = button?.closest('[data-product-id]');
      if (!button || !row) return;
      const id = Number(row.dataset.productId);
      const action = button.dataset.posAction;
      const next = (selected.get(id) || 0) + (action === 'increase' ? 1 : action === 'remove' ? -selected.get(id) : -1);
      if (next > 0 && next <= 25) selected.set(id, next);
      else selected.delete(id);
      renderOrder();
    });
    paymentButtons.forEach((button) => button.addEventListener('click', () => {
      paymentMethod = /tarjeta/i.test(button.textContent) ? 'card' : /app/i.test(button.textContent) ? 'qr' : 'cash';
    }));
    const submit = [...main.querySelectorAll('button')].find((button) => button.textContent.toLowerCase().includes('enviar a cocina'));
    submit?.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!selected.size) {
        toast('Agrega al menos un producto al pedido.', true);
        return;
      }
      try {
        const result = await request('/orders', {
          method: 'POST',
          body: { items: [...selected].map(([productId, quantity]) => ({ productId, quantity })), orderType, paymentMethod }
        });
        selected.clear();
        renderOrder();
        toast(`Pedido ${result.order.code} registrado y enviado a cocina.`);
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  function createKitchenCard(order, onAdvance) {
    const card = element('article', 'bg-surface rounded-lg shadow-[0px_4px_12px_rgba(33,33,33,0.08)] border-t-8 border-primary p-sm flex flex-col gap-sm');
    card.dataset.orderId = String(order.id);
    const header = element('div', 'flex justify-between items-start border-b border-surface-variant pb-xs');
    const info = element('div');
    info.append(element('span', 'font-headline-md text-headline-md', `#${order.code}`));
    info.append(element('span', 'font-label-md text-label-md text-on-surface-variant block mt-1', order.type === 'delivery' ? 'Delivery' : order.type === 'pickup' ? 'Para llevar' : 'Comer aquí'));
    header.appendChild(info);
    card.appendChild(header);
    const list = element('ul', 'flex flex-col gap-2 font-body-lg text-body-lg');
    for (const item of order.items) {
      const line = element('li', 'flex items-start gap-2');
      line.append(element('span', 'font-bold', `${item.quantity}x`));
      const details = element('div', '', item.name);
      for (const option of item.personalizations) {
        const choice = element('span', 'block text-error font-bold font-label-lg text-label-lg mt-1', `${option.name}: ${option.value}`);
        details.appendChild(choice);
      }
      line.appendChild(details);
      list.appendChild(line);
    }
    card.appendChild(list);
    if (order.status !== 'ready') {
      const action = element('button', 'w-full bg-primary-container text-on-primary font-label-lg text-label-lg h-12 rounded-md shadow-md');
      action.type = 'button';
      action.textContent = order.status === 'pending' ? 'Aceptar' : 'Listo para despacho';
      action.addEventListener('click', () => onAdvance(order, action));
      card.appendChild(action);
    }
    return card;
  }

  function kitchenPage() {
    const columns = [...$$('main section')];
    if (columns.length < 3) return;
    const [newColumn, prepColumn, readyColumn] = columns;
    const lists = [newColumn, prepColumn, readyColumn].map((column) => column.querySelector('.flex-1.min-h-0'));
    if (lists.some((list) => !list)) return;
    async function load() {
      const { orders } = await request('/orders/kitchen');
      lists.forEach((list) => list.replaceChildren());
      const counts = [0, 0, 0];
      for (const order of orders) {
        const index = order.status === 'pending' ? 0 : order.status === 'preparing' ? 1 : 2;
        counts[index] += 1;
        lists[index].appendChild(createKitchenCard(order, async (current, button) => {
          try {
            const status = current.status === 'pending' ? 'preparing' : 'ready';
            await request(`/orders/${current.id}/status`, { method: 'PATCH', body: { status } });
            await load();
          } catch (error) {
            toast(error.message, true);
            button.disabled = false;
          }
        }));
      }
      columns.forEach((column, index) => setText(column.querySelector('h2 span'), String(counts[index])));
    }
    load().catch((error) => toast(error.message, true));
    setInterval(() => load().catch((error) => toast(error.message, true)), 15000);
  }

  function deliveryPage() {
    const cardsContainer = $('.p-md.space-y-4.overflow-y-auto');
    if (!cardsContainer) return;
    const selectedOrder = { value: null };
    const detailTitle = $$('main h2').find((heading) => heading.textContent.includes('Details'));
    const detailText = detailTitle?.parentElement?.querySelector('p');
    const detailItems = detailTitle?.parentElement?.parentElement?.nextElementSibling;
    const actionButton = $('#deliveryAdvanceButton');
    const contactButton = [...document.querySelectorAll('button')].find((button) =>
      /contactar cliente/i.test(button.textContent));
    actionButton?.parentElement?.previousElementSibling?.remove();
    if (contactButton) {
      contactButton.disabled = true;
      contactButton.title = 'El contacto externo no está integrado.';
    }
    const statuses = { ready: 'Asignada', out_for_delivery: 'En camino' };

    function clearSelection() {
      selectedOrder.value = null;
      setText(detailTitle, 'Selecciona una entrega');
      setText(detailText, 'Los detalles aparecerán al elegir una entrega asignada.');
      detailItems?.replaceChildren();
      if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = 'Selecciona una entrega';
      }
    }

    function selectOrder(order) {
      selectedOrder.value = order;
      setText(detailTitle, `${order.code} Detalles`);
      setText(detailText, 'Entrega asignada a tu cuenta');
      if (detailItems) {
        detailItems.replaceChildren();
        detailItems.appendChild(element('p', '', `Cliente: ${order.delivery?.name || 'Cliente de demostración'}`));
        detailItems.appendChild(element('p', '', `Teléfono: ${order.delivery?.phone || 'No disponible'}`));
        detailItems.appendChild(element('p', '', `Dirección: ${order.delivery?.address || 'No disponible'}`));
        for (const item of order.items) detailItems.appendChild(element('p', '', `${item.quantity}x ${item.name}`));
      }
      if (actionButton) {
        actionButton.disabled = false;
        actionButton.textContent = order.status === 'ready' ? 'Iniciar entrega' : 'Marcar como entregado';
      }
    }

    clearSelection();

    async function load() {
      const { orders } = await request('/orders/delivery');
      cardsContainer.replaceChildren();
      const filterButtons = [...(cardsContainer.parentElement?.querySelectorAll('button') || [])];
      const totalButton = filterButtons.find((button) => /^Todas/.test(button.textContent.trim()));
      const assignedButton = filterButtons.find((button) => /^Asignadas/.test(button.textContent.trim()));
      const inRouteButton = filterButtons.find((button) => /^En camino/.test(button.textContent.trim()));
      setText(totalButton, `Mis entregas (${orders.length})`);
      setText(assignedButton, `Asignadas (${orders.filter((order) => order.status === 'ready').length})`);
      setText(inRouteButton, `En camino (${orders.filter((order) => order.status === 'out_for_delivery').length})`);

      for (const order of orders) {
        const card = element('article', 'bg-surface rounded-xl shadow-[0_4px_12px_rgba(33,33,33,0.08)] border-l-4 border-primary p-4 cursor-pointer');
        card.dataset.orderId = String(order.id);
        card.appendChild(element('strong', 'text-primary block', order.code));
        card.appendChild(element('span', 'block font-bold mt-1', order.delivery?.name || 'Cliente de demostración'));
        card.appendChild(element('span', 'block text-sm mt-2', order.delivery?.address || 'Dirección no disponible'));
        card.appendChild(element('span', 'inline-block mt-3 rounded-full px-3 py-1 bg-surface-container-high', statuses[order.status]));
        card.addEventListener('click', () => selectOrder(order));
        cardsContainer.appendChild(card);
      }
      if (!orders.length) cardsContainer.appendChild(element('p', 'text-tertiary', 'No tienes entregas asignadas.'));
      if (selectedOrder.value) {
        const stillAssigned = orders.find((order) => order.id === selectedOrder.value.id);
        if (stillAssigned) selectOrder(stillAssigned);
        else clearSelection();
      }
    }

    actionButton?.addEventListener('click', async () => {
      const order = selectedOrder.value;
      if (!order) return toast('Selecciona una entrega asignada.', true);
      try {
        const status = order.status === 'ready' ? 'out_for_delivery' : 'delivered';
        await request(`/orders/${order.id}/status`, { method: 'PATCH', body: { status } });
        clearSelection();
        await load();
      } catch (error) {
        toast(error.message, true);
      }
    });
    load().catch((error) => toast(error.message, true));
    setInterval(() => load().catch((error) => toast(error.message, true)), 15000);
  }

  function dashboardPage() {
    request('/dashboard').then(({ metrics }) => {
      const cards = $$('.metric');
      for (const card of cards) {
        const label = card.querySelector('.metric-head')?.textContent.toLowerCase() || '';
        const value = $('strong', card);
        if (label.includes('ventas')) setText(value, money(metrics.todaySalesCents));
        else if (label.includes('pedidos')) setText(value, String(metrics.orderCount));
        else if (label.includes('tiempo')) setText(value, `${metrics.inProgress} en curso`);
      }
      if (!cards.length) {
        const sellerCards = $$('main > div.grid > div');
        for (const card of sellerCards) {
          const label = card.textContent.toLowerCase();
          const value = card.querySelector('.font-headline-md');
          if (label.includes('ventas de hoy')) setText(value, money(metrics.todaySalesCents));
          else if (label.includes('pedidos totales')) setText(value, String(metrics.orderCount));
          else if (label.includes('stock bajo')) setText(value, `${metrics.lowStock} alertas`);
          else if (label.includes('en curso')) setText(card.lastElementChild, `En curso: ${metrics.inProgress}`);
        }
      }
      if (pathIncludesSellerDashboard()) {
        request('/inventory').then(({ inventory }) => {
          const alertPanel = $$('main h3').find((heading) => heading.textContent.toLowerCase().includes('alertas de inventario'));
          const list = alertPanel?.parentElement?.querySelector('.flex.flex-col.gap-md.flex-1');
          if (!list) return;
          list.replaceChildren();
          const low = inventory.filter((item) => item.quantity <= item.lowStockThreshold).slice(0, 4);
          if (!low.length) list.appendChild(element('p', 'text-tertiary', 'No hay productos bajo el umbral de stock.'));
          for (const item of low) {
            const row = element('div', 'flex justify-between font-label-lg text-label-lg');
            row.append(element('span', '', item.name), element('span', 'text-error', `${item.quantity} ${item.unit}`));
            list.appendChild(row);
          }
        }).catch((error) => toast(error.message, true));
      }
      request('/orders').then(({ orders }) => {
        const recent = $('.orders');
        if (!recent) return;
        recent.replaceChildren();
        const labels = {
          pending: ['Nuevo', 'new'],
          preparing: ['En preparación', 'prep'],
          ready: ['Listo', 'ready'],
          out_for_delivery: ['En camino', 'prep'],
          delivered: ['Entregado', 'ready'],
          cancelled: ['Cancelado', 'new']
        };
        for (const order of orders.slice(0, 5)) {
          const row = element('div', 'order');
          row.appendChild(element('div', 'order-icon material-symbols-outlined', order.type === 'delivery' ? 'two_wheeler' : 'receipt_long'));
          const details = element('div');
          details.appendChild(element('strong', '', `#${order.code}`));
          details.appendChild(element('span', '', `${order.type === 'delivery' ? 'Delivery' : order.type === 'pickup' ? 'Para llevar' : 'Comer aquí'} · ${money(order.totalCents)}`));
          const [label, state] = labels[order.status] || ['Pendiente', 'new'];
          row.append(details, element('span', `status ${state}`, label));
          recent.appendChild(row);
        }
        if (!orders.length) recent.appendChild(element('p', 'text-tertiary', 'Todavía no hay pedidos registrados.'));
      }).catch((error) => toast(error.message, true));
      if (!pathIncludesSellerDashboard()) {
        request('/inventory').then(({ inventory }) => {
          const rows = $$('.progress-row');
          inventory.slice(0, rows.length).forEach((item, index) => {
            const row = rows[index];
            setText(row.children[0], item.name);
            setText(row.children[2], `${item.quantity} ${item.unit}`);
            const progress = row.querySelector('.progress i');
            if (progress) progress.style.width = `${Math.max(3, Math.min(100, Math.round(item.quantity / Math.max(item.lowStockThreshold * 4, 1) * 100)))}%`;
          });
        }).catch((error) => toast(error.message, true));
      }
    }).catch((error) => toast(error.message, true));
  }

  function pathIncludesSellerDashboard() {
    return location.pathname.toLowerCase().includes('/dashboard_del_vendedor/');
  }

  async function initialize() {
    try {
      const result = await request('/auth/me');
      currentUser = result.user;
      window.BurgerFlowUser = currentUser;
      addLogoutControl();
    } catch (error) {
      toast(error.message, true);
      return;
    }
    const path = location.pathname.toLowerCase();
    if (path.includes('/monitor_de_cocina_kds/')) {
      $$('main section .flex-1.min-h-0').forEach((list) => list.replaceChildren());
    }
    if (path.includes('/panel_de_delivery/')) {
      $('.p-md.space-y-4.overflow-y-auto')?.replaceChildren();
    }
    if (path.includes('/gesti_n_de_inventario/')) $('tbody')?.replaceChildren();
    if (path.includes('/gesti_n_de_inventario/')) {
      await requireRole(['admin']);
      inventoryPage();
    } else if (path.includes('/panel_de_cajero_pos/')) {
      await requireRole(['admin', 'cashier']);
      posPage();
    } else if (path.includes('/monitor_de_cocina_kds/')) {
      await requireRole(['admin', 'kitchen']);
      kitchenPage();
    } else if (path.includes('/panel_de_delivery/')) {
      await requireRole(['admin', 'delivery']);
      deliveryPage();
    } else if (path.includes('/carrito_y_confirmaci_n/')) cartPage();
    else if (path.includes('/personalizar_hamburguesa/')) personalize();
    else if (path.includes('/men_de_clientes/')) customerMenu();
    else if (path.includes('/dashboard_del_vendedor/')) {
      await requireRole(['admin']);
      dashboardPage();
    } else if (path.endsWith('/index.html') || path === '/') {
      dashboardPage();
    }
  }

  window.BurgerFlowAPI = { request, toast, money, showLogin, get user() { return currentUser; } };
  initialize().catch((error) => {
    if (!/iniciar sesión|rol no autorizado/i.test(error.message)) toast(error.message, true);
  });
})();
