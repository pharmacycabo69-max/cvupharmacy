/*
 * Checkout de cvupharmacy.com: formulario corto, solo lo necesario.
 *
 * Reemplaza al formulario original de la copia (que pedía tipo de dirección, quién recibe, propina en tarjeta
 * aparte, logos de pago…). Pide: nombre, teléfono, correo, dónde entregar (+ habitación), cuándo y notas.
 * La propina y la forma de pago son una fila cada una, dentro del resumen.
 *
 *   Pay by card      -> POST /checkout/ con los datos; el servidor crea la sesión de Stripe y devuelve su URL.
 *   Pay on delivery  -> arma el mensaje de pedido y abre WhatsApp (igual que antes).
 *
 * Se carga solo en /checkout/ (lo inyecta src/app/[[...path]]/route.ts). Usa el carrito de WooCommerce Store API
 * (/wp-json/wc/store/v1/cart) y recuerda los datos del cliente 7 días en su navegador.
 */
(function () {
  'use strict';
  if (!/^\/checkout\/?/i.test(location.pathname)) return;
  var root = document.getElementById('cvu-ck-root');
  if (!root) return;

  var STORE_API = '/wp-json/wc/store/v1/cart';
  var LS_KEY = 'cvu_checkout_data';
  var WA_NUMBER = '526242261023';
  var TIMES = [
    ['asap', 'As soon as possible (30-60 min)'], ['1h', 'Within 1 hour'], ['2h', 'Within 2 hours'],
    ['morning', 'Tomorrow morning (9am-12pm)'], ['afternoon', 'Tomorrow afternoon (12pm-6pm)'], ['evening', 'Tomorrow evening (6pm-9pm)']
  ];
  var CODES = [
    ['+1', '🇺🇸 +1'], ['+52', '🇲🇽 +52'], ['+44', '🇬🇧 +44'],
    ['+33', '🇫🇷 +33'], ['+49', '🇩🇪 +49'], ['+34', '🇪🇸 +34']
  ];
  var TIPS = [0, 5, 10, 20];
  var REQUIRED = {
    name: 'Enter your full name', phone: 'Enter a valid phone number',
    email: 'Enter a valid email address', place: 'Enter the hotel, villa or address'
  };

  /* ---------- estado ---------- */

  function guessCode() {
    var region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
    return { MX: '+52', GB: '+44', FR: '+33', DE: '+49', ES: '+34' }[region] || '+1';
  }
  var state = {
    cart: null,
    busy: false,
    d: { name: '', countryCode: guessCode(), phone: '', email: '', place: '', room: '', deliveryTime: 'asap', instructions: '', tip: 0, pmtMethod: 'pay-now' }
  };

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!o || !o.t || Date.now() - o.t > 7 * 24 * 3600 * 1000) return;
      var d = o.d || {};
      // el formulario anterior guardaba hotel / Airbnb / otra dirección por separado
      if (d.place === undefined) d.place = d.hotelName || d.airbnbAddress || d.otherAddress || '';
      if (d.room === undefined) d.room = d.roomNumber || d.airbnbUnit || '';
      if (typeof d.tip !== 'number') d.tip = 0;
      Object.keys(state.d).forEach(function (k) { if (d[k] !== undefined) state.d[k] = d[k]; });
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), d: state.d })); } catch (e) { /* idem */ }
  }

  /* ---------- utilidades ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(cents, sym) { return (sym || '$') + ((parseFloat(cents) || 0) / 100).toFixed(2); }
  function decode(s) { var el = document.createElement('div'); el.innerHTML = String(s || ''); return el.textContent || s; }
  function placeLine() { return state.d.place + (state.d.room ? ', room ' + state.d.room : ''); }

  /* ---------- estilos propios (se suman al CSS original de la tienda) ---------- */

  var style = document.createElement('style');
  style.textContent =
    '#cvu-ck-root.cvu-ck2{max-width:860px;margin:0 auto;padding:10px 14px 120px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-h1{margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-.4px;color:#0f172a}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-card{padding:14px 16px;margin-bottom:10px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-card h3{margin:0 0 10px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-fld{margin-bottom:10px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-fld label{margin-bottom:4px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-fld input,#cvu-ck-root.cvu-ck2 .cvu-ck-fld select{padding:10px 12px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-row2{display:grid;grid-template-columns:1fr 110px;gap:10px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-lbl2{font-size:12px;font-weight:600;color:#334155;margin:10px 0 6px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-chips{margin-bottom:0}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-chip{padding:8px 12px;flex:1;text-align:center}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-msg{color:#dc2626;font-size:12px;font-weight:600;margin-top:4px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-banner{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:10px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-sum-row span:first-child{padding-right:12px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-place-inline{display:none;width:100%;margin-top:12px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-sub2{font-size:11px;color:#64748b;text-align:center;margin-top:8px}' +
    '@media(min-width:720px){' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-cols{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;align-items:start}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-right{position:sticky;top:84px}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-place-inline{display:block}' +
    '#cvu-ck-root.cvu-ck2 .cvu-ck-sticky{display:none}' +
    '#cvu-ck-root.cvu-ck2{padding-bottom:40px}' +
    '}';
  document.head.appendChild(style);

  /* ---------- vista ---------- */

  function field(key, label, attrs, extra) {
    return '<div class="cvu-ck-fld"><label>' + label + '</label><input data-fld="' + key + '" value="' + esc(state.d[key]) + '" ' + attrs + '></div>' + (extra || '');
  }

  function render() {
    var cart = state.cart;
    if (!cart) { root.innerHTML = '<div class="cvu-ck-loading" style="display:block">Loading checkout...</div>'; return; }
    var items = cart.items || [];
    if (!items.length) {
      root.innerHTML = '<div class="cvu-ck-empty"><h3>Your cart is empty</h3><p>Add products to your cart before checkout.</p><a href="/shop/">Continue shopping</a></div>';
      return;
    }
    var d = state.d;
    var sym = (cart.totals && cart.totals.currency_symbol) || '$';
    var sub = parseFloat(cart.totals && cart.totals.total_items) || 0;
    var tip = d.tip * 100;
    var total = sub + tip;
    var cc = CODES.map(function (c) { return '<option value="' + c[0] + '"' + (d.countryCode === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('');
    var times = TIMES.map(function (t) { return '<option value="' + t[0] + '"' + (d.deliveryTime === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('');
    var rows = items.map(function (it) {
      return '<div class="cvu-ck-sum-row"><span>' + esc(decode(it.name)) + ' &times;' + it.quantity + '</span><span>' + money(it.totals && it.totals.line_subtotal, sym) + '</span></div>';
    }).join('');
    var tipChips = TIPS.map(function (v) {
      return '<button type="button" class="cvu-ck-chip' + (d.tip === v ? ' cvu-ck-on' : '') + '" data-tip="' + v + '">' + (v ? '$' + v : 'No tip') + '</button>';
    }).join('');
    var payChips =
      '<button type="button" class="cvu-ck-chip' + (d.pmtMethod === 'pay-now' ? ' cvu-ck-on' : '') + '" data-pmt="pay-now">Pay by card</button>' +
      '<button type="button" class="cvu-ck-chip' + (d.pmtMethod === 'cod' ? ' cvu-ck-on' : '') + '" data-pmt="cod">Pay on delivery</button>';
    var label = d.pmtMethod === 'cod' ? 'Order on WhatsApp &rarr;' : 'Pay securely &rarr;';

    root.innerHTML =
      '<h1 class="cvu-ck-h1">Checkout</h1>' +
      '<div class="cvu-ck-cols"><div class="cvu-ck-left">' +
        '<div class="cvu-ck-card"><h3>Your details</h3>' +
          field('name', 'Full name *', 'type="text" placeholder="John Smith" autocomplete="name"') +
          '<div class="cvu-ck-fld"><label>Phone *</label><div class="cvu-ck-phone-wrap"><select data-fld="countryCode" aria-label="Country code">' + cc + '</select>' +
            '<input type="tel" data-fld="phone" value="' + esc(d.phone) + '" placeholder="555 123 4567" autocomplete="tel"></div></div>' +
          field('email', 'Email *', 'type="email" placeholder="you@example.com" autocomplete="email" inputmode="email"') +
        '</div>' +
        '<div class="cvu-ck-card"><h3>Delivery</h3>' +
          '<div class="cvu-ck-row2">' +
            field('place', 'Hotel, villa or address *', 'type="text" placeholder="e.g. Hilton Los Cabos" autocomplete="street-address"') +
            field('room', 'Room / unit', 'type="text" placeholder="1204"') +
          '</div>' +
          '<div class="cvu-ck-fld"><label>When</label><select data-fld="deliveryTime">' + times + '</select></div>' +
          field('instructions', 'Notes (optional)', 'type="text" maxlength="300" placeholder="e.g. Ask for John at reception"') +
        '</div>' +
      '</div><div class="cvu-ck-right"><div class="cvu-ck-card"><h3>Your order</h3>' +
        '<div class="cvu-ck-summary" style="margin-top:0">' + rows +
          '<div class="cvu-ck-sum-row"><span>Subtotal</span><span>' + money(sub, sym) + '</span></div>' +
          (tip > 0 ? '<div class="cvu-ck-sum-row"><span>Tip</span><span>' + money(tip, sym) + '</span></div>' : '') +
          '<div class="cvu-ck-sum-row cvu-ck-sum-total"><span>Total</span><span>' + money(total, sym) + '</span></div>' +
        '</div>' +
        '<div class="cvu-ck-lbl2">Tip for the delivery team (optional)</div><div class="cvu-ck-chips">' + tipChips + '</div>' +
        '<div class="cvu-ck-lbl2">Payment</div><div class="cvu-ck-chips">' + payChips + '</div>' +
        '<button type="button" class="cvu-ck-place cvu-ck-place-inline" data-place>' + label + '</button>' +
        '<div class="cvu-ck-sub2">' + (d.pmtMethod === 'cod' ? 'We confirm your order on WhatsApp.' : 'Secure payment with Stripe. Your delivery details are shown there.') + '</div>' +
      '</div></div></div>' +
      '<div class="cvu-ck-sticky"><div class="cvu-ck-sticky-inner">' +
        '<div class="cvu-ck-sticky-total"><div class="cvu-ck-sticky-total-lbl">Total</div><div class="cvu-ck-sticky-total-val">' + money(total, sym) + '</div></div>' +
        '<button type="button" class="cvu-ck-place" data-place>' + label + '</button>' +
      '</div></div>';
    bind();
  }

  /* ---------- eventos ---------- */

  function bind() {
    root.querySelectorAll('[data-fld]').forEach(function (el) {
      var k = el.getAttribute('data-fld');
      var on = function () {
        state.d[k] = el.value; save();
        if (el.classList.contains('cvu-ck-err') && el.value.trim()) clearError(el);
      };
      el.addEventListener('input', on);
      el.addEventListener('change', on);
      // Enter pasa al siguiente campo; en el último, hace el pedido
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || el.tagName === 'SELECT') return;
        e.preventDefault();
        var all = [].slice.call(root.querySelectorAll('input[data-fld]'));
        var next = all[all.indexOf(el) + 1];
        if (next) next.focus(); else placeOrder();
      });
    });
    root.querySelectorAll('[data-tip]').forEach(function (el) {
      el.addEventListener('click', function () { state.d.tip = parseInt(el.getAttribute('data-tip'), 10) || 0; save(); render(); });
    });
    root.querySelectorAll('[data-pmt]').forEach(function (el) {
      el.addEventListener('click', function () { state.d.pmtMethod = el.getAttribute('data-pmt'); save(); render(); });
    });
    root.querySelectorAll('[data-place]').forEach(function (el) { el.addEventListener('click', placeOrder); });
  }

  function clearError(el) {
    el.classList.remove('cvu-ck-err');
    var box = el.closest('.cvu-ck-fld');
    var m = box && box.querySelector('.cvu-ck-msg');
    if (m) m.remove();
  }

  function validate() {
    var d = state.d, errs = [];
    if (!d.name || d.name.trim().length < 2) errs.push('name');
    if (!d.phone || d.phone.replace(/\D/g, '').length < 7) errs.push('phone');
    if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.push('email');
    if (!d.place || !d.place.trim()) errs.push('place');
    return errs;
  }

  function showErrors(errs) {
    root.querySelectorAll('.cvu-ck-msg').forEach(function (m) { m.remove(); });
    errs.forEach(function (k) {
      var el = root.querySelector('[data-fld="' + k + '"]');
      if (!el) return;
      el.classList.add('cvu-ck-err');
      var m = document.createElement('div');
      m.className = 'cvu-ck-msg';
      m.textContent = REQUIRED[k];
      (el.closest('.cvu-ck-fld') || el.parentNode).appendChild(m);
    });
    var first = root.querySelector('.cvu-ck-err');
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); first.focus({ preventScroll: true }); }
  }

  function showBanner(msg) {
    var old = root.querySelector('.cvu-ck-banner');
    if (old) old.remove();
    var b = document.createElement('div');
    b.className = 'cvu-ck-banner';
    b.setAttribute('role', 'alert');
    b.textContent = msg;
    var card = root.querySelector('.cvu-ck-right .cvu-ck-card');
    card.parentNode.insertBefore(b, card);
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setBusy(busy) {
    state.busy = busy;
    root.querySelectorAll('[data-place]').forEach(function (b) {
      b.disabled = busy;
      b.innerHTML = busy ? 'Opening secure payment&hellip;' : (state.d.pmtMethod === 'cod' ? 'Order on WhatsApp &rarr;' : 'Pay securely &rarr;');
    });
  }

  function placeOrder() {
    if (state.busy) return;
    var errs = validate();
    if (errs.length) { showErrors(errs); return; }
    if (state.d.pmtMethod === 'cod') { whatsapp(); return; }
    var d = state.d;
    var old = root.querySelector('.cvu-ck-banner');
    if (old) old.remove();
    setBusy(true);
    fetch('/checkout/', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: d.name, countryCode: d.countryCode, phone: d.phone, email: d.email,
        addrType: 'other', otherAddress: placeLine(),
        deliveryTime: d.deliveryTime, instructions: d.instructions, tip: d.tip
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j.url) { window.location.href = x.j.url; return; }
        throw new Error((x.j && x.j.error) || '');
      })
      .catch(function (e) {
        setBusy(false);
        showBanner(e && e.message && e.message !== 'Failed to fetch' ? e.message : 'We could not start the card payment. Please try again or choose Pay on delivery.');
      });
  }

  function whatsapp() {
    var d = state.d, c = state.cart, sym = (c.totals && c.totals.currency_symbol) || '$';
    var sub = parseFloat(c.totals && c.totals.total_items) || 0;
    var tip = d.tip * 100;
    var timeLabel = (TIMES.filter(function (t) { return t[0] === d.deliveryTime; })[0] || ['', d.deliveryTime])[1];
    var items = c.items.map(function (it) { return '• ' + decode(it.name) + ' x' + it.quantity + ' — ' + money(it.totals.line_subtotal, sym); }).join('\n');
    var msg = 'Hi CVU, I would like to place a delivery order:\n\n' +
      '━━━━━ ORDER ━━━━━\n' + items + '\n\n' +
      'Subtotal: ' + money(sub, sym) + (tip > 0 ? '\nTip: ' + money(tip, sym) : '') + '\nTOTAL: ' + money(sub + tip, sym) + '\n\n' +
      '━━━━━ CONTACT ━━━━━\n' +
      '• Name: ' + d.name + '\n• Phone: ' + d.countryCode + ' ' + d.phone + '\n• Email: ' + d.email + '\n\n' +
      '━━━━━ DELIVERY ━━━━━\n' +
      '• Address: ' + placeLine() + '\n• Time: ' + timeLabel + (d.instructions ? '\n• Notes: ' + d.instructions : '') + '\n\n' +
      '━━━━━ PAYMENT ━━━━━\n• Method: Pay on delivery\n\nPlease confirm my order. Thanks!';
    window.location.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  /* ---------- arranque ---------- */

  function focusFirstEmpty() {
    // el cursor empieza en el primer campo vacío (solo con ratón/trackpad: en el móvil abriría el teclado de golpe)
    try {
      if (!window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
      var keys = ['name', 'phone', 'email', 'place'];
      for (var i = 0; i < keys.length; i++) {
        var el = root.querySelector('[data-fld="' + keys[i] + '"]');
        if (el && !el.value) { el.focus({ preventScroll: true }); return; }
      }
    } catch (e) { /* no es crítico */ }
  }

  function init() {
    document.body.classList.add('cvu-ck-active');
    root.classList.add('cvu-ck2');
    root.style.display = 'block';
    root.setAttribute('aria-hidden', 'false');
    load();
    render();
    fetch(STORE_API + '?_=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (cart) { state.cart = cart; render(); focusFirstEmpty(); })
      .catch(function () {
        root.innerHTML = '<div class="cvu-ck-empty"><h3>Could not load your cart</h3><p>Please try refreshing the page.</p><a href="/shop/">Continue shopping</a></div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
