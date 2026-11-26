(() => {
  'use strict';

  // The hidden form POST avoids a CORS preflight. Its load event is never
  // treated as a saved order: only the matching server acknowledgement is.
  function randomId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }

  function isGoogleResponse(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === 'https:' && !url.port && (
        url.hostname === 'script.google.com' ||
        url.hostname === 'script.googleusercontent.com' ||
        /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname)
      );
    } catch (_) {
      return false;
    }
  }

  function isFrameSource(source, frame) {
    // Apps Script HtmlService nests its response in a Google sandbox iframe.
    // Cross-origin Window.parent is readable; document contents are not read.
    let current = source;
    for (let depth = 0; current && depth < 8; depth += 1) {
      if (current === frame.contentWindow) return true;
      try {
        const parent = current.parent;
        if (!parent || parent === current) return false;
        current = parent;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  function validResult(result) {
    return result && result.success === true &&
      typeof result.orderId === 'string' && result.orderId.length > 0 &&
      result.orderId.length <= 120;
  }

  function submitAppsScript(payload, options) {
    const endpoint = new URL(options.endpoint);
    if (endpoint.origin !== 'https://script.google.com' ||
        !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname) ||
        endpoint.search || endpoint.hash) {
      return Promise.reject(new Error('invalid_endpoint'));
    }
    return new Promise((resolve, reject) => {
      const responseToken = randomId();
      const frame = document.createElement('iframe');
      frame.name = 'tfl_order_' + responseToken.replace(/-/g, '');
      frame.title = 'Trạng thái gửi đơn hàng';
      frame.hidden = true;
      frame.tabIndex = -1;
      frame.className = 'rr-block';
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('data-private', 'true');
      frame.referrerPolicy = 'no-referrer';

      const postForm = document.createElement('form');
      postForm.method = 'POST';
      postForm.action = endpoint.href;
      postForm.target = frame.name;
      postForm.hidden = true;
      postForm.className = 'rr-block';
      postForm.setAttribute('data-private', 'true');
      const values = {
        payload: JSON.stringify(payload),
        responseMode: 'bridge',
        parentOrigin: window.location.origin,
        requestId: payload.idempotencyKey,
        responseToken
      };
      Object.entries(values).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        postForm.append(input);
      });
      let settled = false;
      let timeout;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        window.removeEventListener('message', receive);
        postForm.remove();
        frame.remove();
        if (error) reject(error);
        else resolve(result);
      }
      function receive(event) {
        if (!isGoogleResponse(event.origin) || !isFrameSource(event.source, frame)) return;
        const result = event.data;
        if (!result || result.type !== 'tfl:order-result' ||
            result.requestId !== payload.idempotencyKey ||
            result.responseToken !== responseToken) return;
        if (!validResult(result) || result.quantity !== payload.quantity ||
            result.total !== payload.total || result.currency !== 'VND') {
          const error = new Error('order_rejected');
          error.code = typeof result.code === 'string' ? result.code : 'unconfirmed';
          finish(error);
          return;
        }
        finish(null, result);
      }
      window.addEventListener('message', receive);
      timeout = setTimeout(() => {
        const error = new Error('confirmation_timeout');
        error.name = 'TimeoutError';
        finish(error);
      }, options.timeoutMs || 30000);
      document.body.append(frame, postForm);
      try {
        // Native form submission works even when a field is named "submit".
        HTMLFormElement.prototype.submit.call(postForm);
      } catch (error) {
        finish(error);
      }
    });
  }

  async function submitJson(payload, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        credentials: 'omit',
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !validResult(result)) throw new Error('unconfirmed');
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  function submit(payload, options) {
    if (!options || !/^https:\/\//.test(options.endpoint || '')) {
      return Promise.reject(new Error('missing_endpoint'));
    }
    return options.transport === 'apps-script'
      ? submitAppsScript(payload, options)
      : submitJson(payload, options);
  }

  window.TFLOrders = Object.freeze({submit, randomId});
})();
