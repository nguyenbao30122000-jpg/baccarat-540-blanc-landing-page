# Google Sheets order receiver

The receiver appends confirmed order requests to the spreadsheet selected by the shop:

https://docs.google.com/spreadsheets/d/1O-QtB1kgtPPfwxzRHl6JlLfCnVb0javKbG8pCAaSoQQ/edit

The default destination is a dedicated tab named **Don_hang_Web**. Existing tabs are not cleared or repurposed. If the destination tab exists but has different headers, the receiver stops with a configuration error instead of overwriting it.

## Deploy

1. Sign in with a Google account that can edit the destination spreadsheet.
2. Create an Apps Script project, or use **Extensions > Apps Script** from the spreadsheet. Add the supplied Code.gs.
3. Enable the manifest in **Project Settings**, then use the supplied appsscript.json. It requests the Spreadsheet service scope; the sheet itself does not need public access.
4. Run **setupOrderSheet** once from the editor and approve access. This creates the dedicated tab and headers if necessary, without adding an order.
5. Choose **Deploy > New deployment > Web app**:
   - Execute as: **Me** / the deploying account.
   - Who has access: **Anyone**, including signed-out visitors. In the manifest this is ANYONE_ANONYMOUS, not ANYONE (which requires a signed-in user).
6. Copy the production URL ending in **/exec**. The **/dev** URL is for editors and must not be placed in the public landing page.
7. Configure the landing page to use the Apps Script transport and this real endpoint. Verify an actual acknowledged test order in the sheet before enabling live checkout.

If an organization policy prevents anonymous web apps, the public receiver cannot work with that deployment. The frontend must remain in preview until a deployment with the required access or a separate server endpoint is available.

Updates require a new deployed version through **Deploy > Manage deployments**. Updating the existing deployment preserves its URL.

To use a different dedicated tab, set the Script Property **ORDER_SHEET_NAME**. An existing nonempty tab must have the receiver's exact headers. Do not select a tab containing unrelated business data.

## Browser transport

The production frontend sends an HTML form POST to the deployment URL, targeting an off-screen iframe. The form uses application/x-www-form-urlencoded and contains these fields:

| Field | Value |
| --- | --- |
| payload | JSON string containing the order data |
| responseMode | bridge |
| parentOrigin | The exact location.origin of the landing page |
| requestId | The payload's idempotencyKey, a random UUID v4 |
| responseToken | A separate cryptographically random token, 32–128 letters, digits, hyphens or underscores |

Allowed landing origins are defined in Code.gs:

- https://thefragrancelabperfume.shop
- https://www.thefragrancelabperfume.shop
- https://nguyenbao30122000-jpg.github.io

The receiver returns an HtmlService page with ALLOWALL framing. That page sends a postMessage acknowledgement to each ancestor using the exact allowed parentOrigin. This accommodates Google's HtmlService sandbox iframe and the site's optional preview frame.

The client must validate all of the following before accepting an acknowledgement:

- The message type is **tfl:order-result** and its shape is correct.
- requestId and responseToken match the current request.
- The sender uses HTTPS and a permitted Apps Script origin: script.google.com, script.googleusercontent.com, or a hostname matching the anchored pattern **^[a-z0-9-]+-script\.googleusercontent\.com$**.
- The sender window, or one of its bounded parent windows, is the exact iframe created for this submission.
- success is true, orderId is a valid identifier, and quantity/total match the selected offer.

Do not use a wildcard targetOrigin. The allowlist controls message delivery; it is not authentication of an anonymous sender. The server validates all incoming data independently.

A successful response has this shape:

~~~json
{
  "type": "tfl:order-result",
  "requestId": "<request UUID>",
  "responseToken": "<matching random token>",
  "success": true,
  "orderId": "<server UUID>",
  "quantity": 1,
  "total": 579000,
  "currency": "VND",
  "duplicate": false
}
~~~

An error has success:false, a code, a customer-safe message and retryable. A receipt never includes the customer's name, phone, address, note, UTM data or sheet contents.

An iframe load event alone is not proof of a saved order. If no valid acknowledgement arrives, show that the order's status is unconfirmed and keep the same idempotencyKey for a retry. A fresh responseToken may be used for each transport attempt. Only a confirmed acknowledgement should trigger an order-received event or conversion tracking.

## Order data and storage

The payload accepts the existing site's fields:

- product, sku, volumeMl, quantity, currency
- customerName, phone, address, note
- attribution: utm_source, utm_medium, utm_campaign, utm_content, utm_term
- idempotencyKey

Client product names and monetary values are not trusted. The receiver stores the configured product/SKU and recalculates prices:

| Quantity | Subtotal | Shipping | Total |
| --- | ---: | ---: | ---: |
| 1 × 50ml | 549000 | 30000 | 579000 |
| 2 × 50ml | 998000 | 0 | 998000 |

The receiver validates a UUID v4 request ID, the SKU/volume/currency, the two supported quantities, Vietnamese mobile numbers and bounded customer fields. It normalizes Vietnamese text to NFC. Untrusted text is escaped as literal spreadsheet text, preserving phone zeros and preventing formula evaluation.

Every row includes a Vietnam-time timestamp, a server-generated UUID order ID, the idempotency key, a fingerprint, status, product and price fields, customer fields and the five allowed UTM values. The receiver does not change the spreadsheet's global timezone.

A Script Lock covers duplicate lookup and append. A retry with the same idempotency key and same order returns the original order ID. Reusing a key for changed customer/order content is rejected. Successful acknowledgement occurs only after appendRow and SpreadsheetApp.flush complete. If saving succeeded but the response was lost, retrying the unchanged request does not add another row.

Do not remove or edit the request key, fingerprint, order ID or numeric amount columns in existing rows. Moving this receiver into a second Apps Script project requires care: Script Locks coordinate one project, not different projects writing to the same tab.

GET returns only a service-health object. It does not read or expose orders. It proves that the web app is reachable, not that an order has been saved.

## Why the bridge

ContentService redirects output to googleusercontent.com. Its documented TextOutput interface does not offer arbitrary response headers, and the Web Apps guide does not promise browser CORS/preflight support for this checkout. A direct JSON response remains available for server-to-server callers that follow redirects.

The browser checkout therefore uses an acknowledged iframe form POST. It does not interpret an opaque mode:no-cors response, HTTP completion or iframe load as success.

The sheet stays private. Visitors submit to the deployed script, which runs with the owner's authorized sheet access. No Google credentials or OAuth token belongs in the frontend.

## Local verification

Run:

~~~sh
node integrations/google-apps-script/backend.test.cjs
~~~

These tests use an in-memory Apps Script service stub. They check price tampering, validation, literal cell values, duplicate handling, preservation of existing tab content, lost acknowledgement/retry behavior and the receipt contract. They do not deploy or contact Google and do not replace a real browser-to-sheet check after deployment.

## Primary references

- [Apps Script web apps: POST parameters, deployment and execution identity](https://developers.google.com/apps-script/guides/web)
- [Manifest access levels: ANYONE versus ANYONE_ANONYMOUS](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [HtmlService XFrameOptionsMode](https://developers.google.com/apps-script/reference/html/x-frame-options-mode)
- [HtmlService iframe restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [ContentService redirects and JSONP limitations](https://developers.google.com/apps-script/guides/content)
- [TextOutput API](https://developers.google.com/apps-script/reference/content/text-output)
- [LockService](https://developers.google.com/apps-script/reference/lock/lock-service)
- [HTML Standard: origin checks and postMessage](https://html.spec.whatwg.org/multipage/web-messaging.html#posting-messages)
