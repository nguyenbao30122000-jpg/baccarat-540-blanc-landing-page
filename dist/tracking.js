(() => {
  'use strict';

  const config = window.TFL_CONFIG;
  if (!config || window.__TFL_TRACKING_LOADED__) return;
  window.__TFL_TRACKING_LOADED__ = true;

  const status = (service, value) => document.documentElement.setAttribute('data-tfl-' + service, value);
  const isThankYouPage = Boolean(document.body && document.body.dataset.page === 'thank-you');
  const publicHosts = ['thefragrancelabperfume.shop', 'www.thefragrancelabperfume.shop'];
  let embedded = true;
  try { embedded = window.self !== window.top; } catch (_) { /* Cross-origin preview. */ }
  if (config.trackingEnabled !== true || window.location.protocol !== 'https:' ||
      !publicHosts.includes(window.location.hostname.toLowerCase()) || embedded) {
    ['analytics', 'pixel', 'replay'].forEach((service) => status(service, 'disabled'));
    return;
  }

  const pageLocation = window.location.origin + window.location.pathname;
  function titleFor(product) {
    return isThankYouPage ? 'Cảm ơn bạn | The Fragrance Lab' :
      product === 'white' ? 'Baccarat 540 Pearl (Trắng) | The Fragrance Lab' :
      product === 'red' ? 'Baccarat 540 Ruby (Đỏ) | The Fragrance Lab' :
      'Baccarat 540 Trắng & Đỏ | The Fragrance Lab';
  }
  let pageTitle = titleFor(document.body?.dataset?.product);
  let pageReferrer = '';
  try { if (document.referrer) pageReferrer = new URL(document.referrer).origin + '/'; } catch (_) {}
  const query = new URLSearchParams(window.location.search);
  const containsPersonalData = (value) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
    /(?:^|[^\d])(?:\+?84|0)[35789](?:[\s.()\-]*\d){8}(?!\d)/.test(value);
  const sensitiveQuery = Array.from(query).some(([key, value]) =>
    /^(?:customer(?:Name)?|name|phone|email|address|note|orderId)$/i.test(key) || containsPersonalData(value));
  const campaignParameters = {};
  const campaignKeys = {utm_source: 'campaign_source', utm_medium: 'campaign_medium',
    utm_campaign: 'campaign_name', utm_content: 'campaign_content', utm_term: 'campaign_term', utm_id: 'campaign_id'};
  Object.entries(campaignKeys).forEach(([key, parameter]) => {
    const raw = query.get(key);
    if (!raw) return;
    const value = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (value && !containsPersonalData(value)) campaignParameters[parameter] = value.slice(0, 200);
  });

  let analyticsReady = false;
  let pixelReady = false;
  const measurementId = typeof config.analyticsId === 'string' ? config.analyticsId.trim() : '';
  const pixelId = typeof config.metaPixelId === 'string' ? config.metaPixelId.trim() : '';

  function ga(name, parameters) {
    if (!analyticsReady) return;
    try {
      window.gtag('event', name, {send_to: measurementId, page_location: pageLocation,
        page_referrer: pageReferrer, page_title: pageTitle, ...parameters});
    } catch (_) { status('analytics', 'unavailable'); }
  }

  function meta(name, parameters, custom = false) {
    if (!pixelReady) return;
    try { window.fbq(custom ? 'trackCustom' : 'track', name, parameters); }
    catch (_) { status('pixel', 'unavailable'); }
  }

  function addScript(id, source, onLoad) {
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = source;
    script.addEventListener('load', onLoad, {once: true});
    return script;
  }

  function startAnalytics() {
    if (config.analyticsEnabled === false || !/^G-[A-Z0-9]+$/.test(measurementId)) {
      status('analytics', 'disabled');
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {send_page_view: false, page_location: pageLocation,
      page_referrer: pageReferrer, page_title: pageTitle, ...campaignParameters,
      allow_google_signals: false, allow_ad_personalization_signals: false});
    analyticsReady = true;
    ga('page_view', {});
    const script = addScript('tfl-google-tag',
      'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId),
      () => status('analytics', 'loaded'));
    script.addEventListener('error', () => status('analytics', 'unavailable'), {once: true});
    status('analytics', 'queued');
    document.head.appendChild(script);
  }

  function startPixel() {
    if (config.metaPixelEnabled === false || !/^\d+$/.test(pixelId) || sensitiveQuery) {
      status('pixel', sensitiveQuery ? 'privacy-blocked' : 'disabled');
      return;
    }
    if (!window.fbq) {
      const fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
    }
    // No automatic form matching or customer data is supplied to the pixel.
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId);
    pixelReady = true;
    meta('PageView', {});
    const script = addScript('tfl-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js',
      () => status('pixel', 'loaded'));
    script.addEventListener('error', () => status('pixel', 'unavailable'), {once: true});
    status('pixel', 'queued');
    document.head.appendChild(script);
  }

  const productNames = Object.freeze({'TFL-540-BLANC-50': 'Baccarat 540 Trắng',
    'TFL-540-ROUGE-50': 'Baccarat 540 Đỏ'});
  function offerFor(id) {
    if (!['white', 'red', 'duo'].includes(id)) return null;
    const offer = window.TFLApp?.offers[id];
    if (!offer || !Array.isArray(offer.items) || !Number.isInteger(offer.quantity) ||
        !Number.isFinite(offer.subtotal) || offer.subtotal < 0 ||
        offer.items.length !== offer.quantity || !offer.items.every((item) =>
          Object.hasOwn(productNames, item.sku) && item.quantity === 1 && item.volumeMl === 50)) return null;
    return offer;
  }

  function itemParameters(offer) {
    const unitPrice = offer.subtotal / offer.quantity;
    return {currency: 'VND', value: offer.subtotal, offer_id: offer.id, quantity: offer.quantity,
      items: offer.items.map((item) => ({item_id: item.sku, item_name: productNames[item.sku],
        item_brand: 'The Fragrance Lab', item_category: 'Nước hoa', item_variant: '50ml',
        price: unitPrice, discount: Math.max(0, offer.listPrice / offer.quantity - unitPrice), quantity: item.quantity}))};
  }

  function pixelParameters(offer) {
    return {currency: 'VND', value: offer.subtotal, offer_id: offer.id, content_name: offer.name,
      content_type: 'product', content_ids: offer.items.map((item) => item.sku),
      contents: offer.items.map((item) => ({id: item.sku, quantity: item.quantity,
        item_price: offer.subtotal / offer.quantity})), num_items: offer.quantity};
  }

  let selected = 'duo';
  let viewedInitialOffer = false;
  const checkoutOffers = new Set();
  const receivedOrders = new Set();

  document.addEventListener('tfl:offer_selected', (event) => {
    if (isThankYouPage) return;
    const detail = event.detail || {};
    const offer = offerFor(detail.offerId);
    if (!offer) return;
    selected = offer.id;
    if (!viewedInitialOffer) {
      viewedInitialOffer = true;
      ga('view_item', itemParameters(offer));
      meta('ViewContent', pixelParameters(offer));
    }
    if (detail.userInitiated !== true) return;
    ga('select_offer', itemParameters(offer));
    meta('SelectOffer', pixelParameters(offer), true);
  });

  // A change of product tab is a real product view, not a new page load.
  document.addEventListener('tfl:tab_selected', (event) => {
    if (isThankYouPage) return;
    const detail = event.detail || {};
    const validTab = {duo:'duo',pearl:'white',ruby:'red'};
    if (!Object.hasOwn(validTab, detail.tab) || validTab[detail.tab] !== detail.offerId) return;
    const offer = offerFor(detail.offerId);
    if (!offer) return;
    selected = offer.id;
    pageTitle = titleFor(offer.id);
    viewedInitialOffer = true;
    ga('select_product_tab', {...itemParameters(offer), product_tab:detail.tab});
    ga('view_item', {...itemParameters(offer), product_tab:detail.tab});
    meta('ViewContent', {...pixelParameters(offer), product_tab:detail.tab});
  });

  document.addEventListener('tfl:checkout_started', (event) => {
    const detail = event.detail || {};
    if (isThankYouPage || config.mode !== 'live' || detail.ready !== true) return;
    const offer = offerFor(detail.offerId);
    if (!offer || checkoutOffers.has(offer.id)) return;
    checkoutOffers.add(offer.id);
    ga('begin_checkout', itemParameters(offer));
    meta('InitiateCheckout', pixelParameters(offer));
  });

  document.addEventListener('tfl:order_received', (event) => {
    const detail = event.detail || {};
    if (isThankYouPage || config.mode !== 'live' || detail.acknowledged !== true ||
        detail.schemaVersion !== 2 || detail.receiverVersion !== 2 ||
        typeof detail.orderId !== 'string' || !detail.orderId.trim() || detail.orderId.length > 120 ||
        receivedOrders.has(detail.orderId)) return;
    const offer = offerFor(detail.offerId);
    if (!offer) return;
    // app.js dispatches only after validating the server's complete v2 ACK.
    // The order ID remains in memory for deduplication and is never sent to analytics.
    receivedOrders.add(detail.orderId);
    ga('generate_lead', {...itemParameters(offer), lead_source: 'website_order_form'});
    meta('Lead', pixelParameters(offer));
  });

  document.addEventListener('click', (event) => {
    if (isThankYouPage || !event.isTrusted || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href="#dat-hang"], [data-choose], [data-checkout], #sticky-cta');
    if (!link) return;
    const offer = offerFor(link.dataset.choose || selected);
    if (!offer) return;
    const placement = link.closest('#sticky-buy, .mobile-buybar') ? 'mobile_bar' :
      link.closest('header') ? 'header' : link.closest('#uu-dai') ? 'offers' :
      link.closest('#bo-suu-tap') ? 'collection' : link.closest('footer') ? 'footer' : 'page';
    ga('cta_click', {...itemParameters(offer), placement});
    meta('CTA_Click', {...pixelParameters(offer), placement}, true);
  }, {passive: true});

  function remoteUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }

  function startReplay() {
    const source = remoteUrl(config.replayScriptUrl);
    const endpoint = remoteUrl(config.replayEndpoint);
    if (config.replayEnabled === false || !source || !endpoint) {
      status('replay', 'disabled');
      return;
    }
    const privateRegions = ['order-form', 'order-dialog'].map((id) => document.getElementById(id)).filter(Boolean);
    if (sensitiveQuery || privateRegions.some((element) => !element.classList.contains('rr-block'))) {
      status('replay', 'privacy-blocked');
      return;
    }
    let initialized = false;
    const script = addScript('tfl-session-replay', source, () => {
      if (initialized) return;
      const recorder = window.TNANOReplay;
      if (!recorder || typeof recorder.initReplay !== 'function') {
        status('replay', 'api-missing');
        return;
      }
      initialized = true;
      try {
        // Preserve the shop's existing initialization contract without adding capture options.
        const result = recorder.initReplay({endpoint: config.replayEndpoint});
        Promise.resolve(result).then(() => status('replay', 'initialized'),
          () => status('replay', 'init-failed'));
      } catch (_) { status('replay', 'init-failed'); }
    });
    script.addEventListener('error', () => status('replay', 'unavailable'), {once: true});
    status('replay', 'loading');
    document.head.appendChild(script);
  }

  try { startAnalytics(); } catch (_) { status('analytics', 'unavailable'); }
  try { startPixel(); } catch (_) { status('pixel', 'unavailable'); }
  try { startReplay(); } catch (_) { status('replay', 'unavailable'); }
})();
