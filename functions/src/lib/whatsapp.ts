import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";

export const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
export const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
export const WHATSAPP_VERIFY_TOKEN = defineSecret("WHATSAPP_VERIFY_TOKEN");

// Set to false once templates are approved and webhook is configured
const STUB = false;

const GRAPH_API_VERSION = "v25.0";

/**
 * Sends a WhatsApp template message via the Graph API.
 * @param {string} toPhoneNumber recipient phone number in E.164 format (no +)
 * @param {string} templateName approved Meta template name
 * @param {string} language BCP-47 language code, e.g. "he"
 * @param {object[]} components template variable components
 * @return {Promise<void>}
 */
export async function sendTemplate(
  toPhoneNumber: string,
  templateName: string,
  language: string,
  components: object[],
): Promise<void> {
  if (STUB) {
    logger.info("[STUB] sendTemplate", {
      to: toPhoneNumber,
      templateName,
      language,
      components,
    });
    return;
  }

  const token = WHATSAPP_TOKEN.value();
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: toPhoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  };

  logger.info("Sending WhatsApp template", {
    to: toPhoneNumber,
    templateName,
    language,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${text}`);
  }
}

/**
 * Sends a plain text WhatsApp message within an open 24-hour service window.
 * @param {string} phone recipient phone number in E.164 format (no +)
 * @param {string} text message body
 * @return {Promise<void>}
 */
export async function sendText(phone: string, text: string): Promise<void> {
  if (STUB) {
    logger.info("[STUB] sendText", { to: phone, text });
    return;
  }

  const token = WHATSAPP_TOKEN.value();
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${text2}`);
  }
}

/**
 * Sends an interactive quick-reply button message. Only deliverable within
 * an open 24-hour service window (i.e. in reply to an inbound message).
 * @param {string} phone recipient phone number in E.164 format (no +)
 * @param {string} bodyText message body shown above the buttons
 * @param {Array<{id: string, title: string}>} buttons up to 3 reply buttons
 * @return {Promise<void>}
 */
export async function sendInteractiveButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  if (STUB) {
    logger.info("[STUB] sendInteractiveButtons", { to: phone, bodyText, buttons });
    return;
  }

  const token = WHATSAPP_TOKEN.value();
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${text}`);
  }
}

/**
 * Downloads inbound media (e.g. a confirmation photo) from the Graph API.
 * Two-step flow: resolve the media ID to a short-lived URL, then fetch the
 * binary from that URL — both calls require the same bearer token.
 * @param {string} mediaId WhatsApp media ID from an inbound message
 * @return {Promise<Buffer>} the raw media bytes
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const token = WHATSAPP_TOKEN.value();

  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    throw new Error(`WhatsApp media lookup error ${metaRes.status}: ${await metaRes.text()}`);
  }
  const { url } = (await metaRes.json()) as { url: string };

  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) {
    throw new Error(`WhatsApp media download error ${fileRes.status}: ${await fileRes.text()}`);
  }
  return Buffer.from(await fileRes.arrayBuffer());
}
