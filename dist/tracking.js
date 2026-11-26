(() => {
  'use strict';

  const config = window.TFL_CONFIG;
  if (!config || window.__TFL_TRACKING_LOADED__) return;
  window.__TFL_TRACKING_LOADED__ = true;

  const root = document.documentElement;
  const isThankYouPage = Boolean(document.body && document.body.dataset.page === 'thank-you');
  const status = (service, value) => root.setAttribute('data-tfl-' + service, value);
  const hostname = window.location.hostname.toLowerCase();
  const localHost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' || hostname === '::1' || hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname);
  let embedded = true;
  try { embedded = window.self !== window.top; } catch (_) { /* Cross-origin preview. */ }

  if (config.trackingEnabled === false || window.location.protocol !== 'https:' || localHost || embedded) {
    status('analytics', 'disabled');
    status('replay', 'disabled');
    return;
  }

  function remoteUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function startAnalytics() {
    const measurementId = typeof config.analyticsId === 'string' ? config.analyticsId.trim() : '';
    if (config.analyticsEnabled === false || !/^G-[A-Z0-9]+$/.test(measurementId)) {
      status('analytics', 'disabled');
      return;
    }

    const pageLocation = window.location.origin + window.location.pathname;
    let pageReferrer = '';
    try { if (document.referrer) pageReferrer = new URL(document.referrer).origin + '/'; } catch (_) { /* No referrer. */ }
    const pageTitle = isThankYouPage ? 'Cảm ơn bạn | The Fragrance Lab' : 'Baccarat 540 Trắng | The Fragrance Lab';
    const campaignParameters = {};
    const campaignKeys = {
      utm_source: 'campaign_source',
      utm_medium: 'campaign_medium',
      utm_campaign: 'campaign_name',
      utm_content: 'campaign_content',
      utm_term: 'campaign_term',
      utm_id: 'campaign_id'
    };
    const query = new URLSearchParams(window.location.search);
    Object.entries(campaignKeys).forEach(([queryKey, analyticsKey]) => {
      const raw = query.get(queryKey);
      if (!raw) return;
      const value = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
      const containsEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
      const containsPhone = /(?:^|[^\d])(?:\+?84|0)[35789](?:[\s.()\-]*\d){8}(?!\d)/.test(value);
      if (value && !containsEmail && !containsPhone) campaignParameters[analyticsKey] = value.slice(0, 200);
    });
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    function track(name, parameters) {
      try {
        window.gtag('event', name, {
          send_to: measurementId,
          page_location: pageLocation,
          page_referrer: pageReferrer,
          page_title: pageTitle,
          ...parameters
        });
        return true;
      } catch (_) {
        status('analytics', 'unavailable');
        return false;
      }
    }

    function offerFor(quantity) {
      const key = String(quantity);
      if (!config.offers || !Object.prototype.hasOwnProperty.call(config.offers, key)) return null;
      const offer = config.offers[key];
      if (!Number.isInteger(offer.quantity) || offer.quantity < 1 ||
          !Number.isFinite(offer.subtotal) || offer.subtotal < 0) return null;
      return offer;
    }

    let selectedOffer = offerFor(1);
    let checkoutStarted = false;
    const receivedOrders = new Set();

    function itemParameters(offer) {
      const unitPrice = offer.subtotal / offer.quantity;
      const single = offerFor(1);
      const discount = single ? Math.max(0, single.subtotal - unitPrice) : 0;
      return {
        currency: 'VND',
        value: offer.subtotal,
        items: [{
          item_id: 'TFL-540-BLANC-50',
          item_name: 'Baccarat 540 Trắng',
          item_brand: 'The Fragrance Lab',
          item_category: 'Nước hoa',
          item_variant: '50ml',
          price: unitPrice,
          discount,
          quantity: offer.quantity
        }]
      };
    }

    // Register before loading the external tag, so early interactions are queued.
    document.addEventListener('tfl:offer_selected', (event) => {
      if (isThankYouPage) return;
      const detail = event.detail || {};
      const offer = offerFor(detail.quantity);
      if (!offer) return;
      selectedOffer = offer;
      if (detail.userInitiated !== true) return;
      track('select_offer', {
        ...itemParameters(offer),
        offer_id: offer.quantity === 1 ? 'single' : 'duo'
      });
    });

    document.addEventListener('tfl:checkout_started', (event) => {
      if (isThankYouPage || checkoutStarted) return;
      const offer = offerFor(event.detail && event.detail.quantity) || selectedOffer;
      if (!offer) return;
      checkoutStarted = true;
      track('begin_checkout', itemParameters(offer));
    });

    document.addEventListener('tfl:order_received', (event) => {
      const detail = event.detail || {};
      const onTracked = typeof detail.onTracked === 'function' ? detail.onTracked : null;
      let completed = false;
      const complete = () => {
        if (completed || !onTracked) return;
        completed = true;
        try { onTracked(); } catch (_) { /* Navigation must not affect analytics. */ }
      };
      if (isThankYouPage || detail.acknowledged !== true || typeof detail.orderId !== 'string' || !detail.orderId.trim()) { complete(); return; }
      if (receivedOrders.has(detail.orderId)) { complete(); return; }
      const offer = offerFor(detail.quantity) || selectedOffer;
      if (!offer) { complete(); return; }
      receivedOrders.add(detail.orderId);
      // The ID stays in memory for deduplication; customer data never enters the tag payload.
      const queued = track('generate_lead', {
        currency: 'VND',
        value: offer.subtotal,
        lead_source: 'website_order_form',
        offer_id: offer.quantity === 1 ? 'single' : 'duo',
        quantity: offer.quantity,
        ...(onTracked ? {event_callback: complete, event_timeout: 1000} : {})
      });
      if (!queued) complete();
    });

    document.addEventListener('click', (event) => {
      if (isThankYouPage || !event.isTrusted || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href="#dat-hang"]');
      if (!link) return;
      const placement = link.closest('.mobile-buybar') ? 'mobile_bar' :
        link.closest('header') ? 'header' :
        link.closest('#uu-dai') ? 'offers' :
        link.closest('.gift-section') ? 'gift' :
        link.closest('footer') ? 'footer' : 'page';
      track('cta_click', {placement});
    }, {passive: true});

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      page_location: pageLocation,
      page_referrer: pageReferrer,
      page_title: pageTitle,
      ...campaignParameters,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    track('page_view', {});
    if (!isThankYouPage && selectedOffer) track('view_item', itemParameters(selectedOffer));

    const script = document.createElement('script');
    script.id = 'tfl-google-tag';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    script.addEventListener('load', () => status('analytics', 'loaded'), {once: true});
    script.addEventListener('error', () => status('analytics', 'unavailable'), {once: true});
    status('analytics', 'queued');
    document.head.appendChild(script);
  }

  function startReplay() {
    const source = remoteUrl(config.replayScriptUrl);
    const endpoint = remoteUrl(config.replayEndpoint);
    if (config.replayEnabled === false || !source || !endpoint) {
      status('replay', 'disabled');
      return;
    }

    let initialized = false;
    const script = document.createElement('script');
    script.id = 'tfl-session-replay';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = source;
    script.addEventListener('load', () => {
      if (initialized) return;
      const recorder = window.TNANOReplay;
      if (!recorder || typeof recorder.initReplay !== 'function') {
        status('replay', 'api-missing');
        return;
      }
      initialized = true;
      try {
        // Use only the initialization contract supplied by the shop owner.
        const result = recorder.initReplay({endpoint: config.replayEndpoint});
        Promise.resolve(result).then(
          () => status('replay', 'initialized'),
          () => status('replay', 'init-failed')
        );
      } catch (_) {
        status('replay', 'init-failed');
      }
    }, {once: true});
    script.addEventListener('error', () => status('replay', 'unavailable'), {once: true});
    status('replay', 'loading');
    document.head.appendChild(script);
  }

  try { startAnalytics(); } catch (_) { status('analytics', 'unavailable'); }
  try { startReplay(); } catch (_) { status('replay', 'unavailable'); }
})();
