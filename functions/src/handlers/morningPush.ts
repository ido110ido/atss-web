import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, sendTemplate } from "../lib/whatsapp.js";
import { getAllPendingDeliveries, getTodaysPendingDeliveries } from "../lib/deliveries.js";
import { db } from "../lib/firebase.js";
import {
  MORNING_HEADER_TEMPLATE,
  // DELIVERY_ITEM_TEMPLATE,
  DEFAULT_LANGUAGE,
  formatDateForMessage,
  DELIVERY_ITEM_TEMPLATE,
} from "../config/messages.js";
import { DeliveryDoc } from "../config/constants.js";

/**
 * Core business logic decoupled from triggers for testability.
 * @param {Array<Object>} deliveries Deliveries to process.
 * @param {string} [overridePhone] Phone to route all messages to, for testing.
 * @return {Promise<Object>} Summary counts of the run.
 */
export async function executeMorningPush(
  deliveries: Array<DeliveryDoc & { id: string }>,
  overridePhone?: string,
) {
  if (!deliveries || deliveries.length === 0) {
    logger.info("Morning push: No deliveries to process.");
    return { totalWorkers: 0, successfulWorkers: 0, failedWorkers: 0 };
  }

  const byWorker = new Map<string, Array<DeliveryDoc & { id: string }>>();

  for (const d of deliveries) {
    // Override phone number if running in test mode
    const phone = overridePhone || d.workerPhone;
    if (!d.workerId || !phone) continue;

    const list = byWorker.get(d.workerId) ?? [];
    list.push({ ...d, workerPhone: phone });
    byWorker.set(d.workerId, list);
  }

  const workerPromises = Array.from(byWorker.entries()).map(
    async ([workerId, workerDeliveries]) => {
      const first = workerDeliveries[0];
      const language = DEFAULT_LANGUAGE;

      const sorted = [...workerDeliveries].sort((a, b) =>
        String(a.expectedTime).localeCompare(String(b.expectedTime)),
      );
      // Send morning header template
      try {
        await sendTemplate(first.workerPhone, MORNING_HEADER_TEMPLATE, language, [
          {
            type: "header",
            parameters: [
              { type: "text", parameter_name: "date", text: formatDateForMessage(first.date) },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", parameter_name: "num", text: String(sorted.length) },
              { type: "text", parameter_name: "branch", text: String(first.storeBranch) },
            ],
          },
        ]);
      } catch (err) {
        // Error instances don't have enumerable own properties, so logging
        // `err` directly serializes to "{}" in Cloud Logging — log .message
        // explicitly so the real Graph API rejection reason is visible.
        logger.error("Failed to send morning header to worker. Aborting worker deliveries.", {
          workerId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      // Send each delivery item template
      let sentDeliveries = 0;
      for (const delivery of sorted) {
        try {
          await sendTemplate(first.workerPhone, DELIVERY_ITEM_TEMPLATE, language, [
            {
              type: "header",
              parameters: [
                {
                  type: "text",
                  parameter_name: "delivery_id",
                  text: String(delivery.id),
                },
              ],
            },
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  parameter_name: "driver_name",
                  text: String(delivery.driverName),
                },
                {
                  type: "text",
                  parameter_name: "truck_plate",
                  // licensePlate is optional and usually blank (current Excel
                  // template has no such column) — WhatsApp rejects template
                  // text params with an empty string (#131008), so fall back
                  // to a placeholder, same as the dashboard's "—" display.
                  text: delivery.licensePlate || "—",
                },
                {
                  type: "text",
                  parameter_name: "box_num",
                  text: String(delivery.boxCount) || "—",
                },
                {
                  type: "text",
                  parameter_name: "branch_type",
                  text: String(delivery.storeBranch) || "—",
                },
              ],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: 0,
              parameters: [
                {
                  type: "payload",
                  payload: `delivery_id: ${String(delivery.id)},status: in_progress`,
                },
              ],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: 1,
              parameters: [
                {
                  type: "payload",
                  payload: `delivery_id: ${String(delivery.id)},status:issue`,
                },
              ],
            },
          ]);

          // update delivery status to "sent" in the database
          await db.collection("deliveries").doc(delivery.id).update({ status: "sent" });

          sentDeliveries++;
        } catch (deliveryErr) {
          logger.error("Failed to send delivery item template", {
            workerId,
            deliveryId: delivery.id,
            error: deliveryErr instanceof Error ? deliveryErr.message : String(deliveryErr),
          });
        }
      }

      return { workerId, sentDeliveries, total: sorted.length };
    },
  );

  const results = await Promise.allSettled(workerPromises);

  let successfulWorkers = 0;
  let failedWorkers = 0;

  for (const result of results) {
    if (result.status === "fulfilled") successfulWorkers++;
    else failedWorkers++;
  }

  return { totalWorkers: byWorker.size, successfulWorkers, failedWorkers };
}

/**
 * Production Trigger (Cron)
 */
export const morningPush = onSchedule(
  {
    schedule: "0 5 * * *",
    timeZone: "Asia/Jerusalem",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const deliveries = await getTodaysPendingDeliveries();
    const stats = await executeMorningPush(deliveries);
    logger.info("Production morning push complete", stats);
  },
);

/**
 * Manual Trigger (Dashboard button)
 * Runs the real production logic — today's actual pending deliveries for
 * the calling user's own company — on demand, instead of waiting for the
 * 5am cron. Scoped to the caller's company via their `users/{email}`
 * profile so one company can't trigger sends for another's deliveries.
 */
export const triggerMorningPush = onCall(
  {
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (request) => {
    const email = request.auth?.token.email?.toLowerCase();
    if (!email) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const userSnap = await db.collection("users").doc(email).get();
    const profile = userSnap.data() as { company?: string; active?: boolean } | undefined;
    if (!userSnap.exists || !profile?.active || !profile.company) {
      throw new HttpsError("permission-denied", "Your account doesn't have access.");
    }

    const deliveries = await getAllPendingDeliveries(profile.company);
    const stats = await executeMorningPush(deliveries);
    logger.info("Manual morning push triggered", { company: profile.company, ...stats });
    return stats;
  },
);

/**
 * Testing Trigger (HTTP)
 * Injects mock data and routes messages to a specific phone number.
 */
export const testMorningPush = onRequest(
  {
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (req, res) => {
    // Require explicit phone number in query to prevent accidental spam
    const testPhone = req.query.phone;
    if (!testPhone || typeof testPhone !== "string") {
      res.status(400).send("Missing 'phone' query parameter. Usage: ?phone=9725XXXXXXXX");
      return;
    }

    // Generate Mock Delivery Data
    const mockDeliveries: Array<DeliveryDoc & { id: string }> = [
      {
        id: "MOCK-001",
        company: "atss",
        workerId: "W-999",
        workerName: "QA Tester",
        workerPhone: testPhone,
        driverName: "Dan Cohen",
        licensePlate: "123-45-678",
        boxCount: 15,
        storeBranch: "Golf Kids",
        address: "Dizengoff 50, Tel Aviv",
        expectedTime: "08:30",
        date: new Date().toISOString().split("T")[0],
        status: "pending",
        importId: "TEST-IMPORT",
      },
      {
        id: "MOCK-002",
        company: "atss",
        workerId: "W-999",
        workerName: "QA Tester",
        workerPhone: testPhone,
        driverName: "Yossi Levi",
        licensePlate: "987-65-432",
        boxCount: 4,
        storeBranch: "Intima",
        address: "Herzl 12, Haifa",
        expectedTime: "11:00",
        date: new Date().toISOString().split("T")[0],
        status: "pending",
        importId: "TEST-IMPORT",
      },
    ];

    logger.info("Running test morning push with mock data", { testPhone });

    try {
      const stats = await executeMorningPush(mockDeliveries, testPhone);
      res.status(200).send(`Test completed successfully. Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      logger.error("Test function failed", { error });
      res.status(500).send("Test failed. Check Firebase logs.");
    }
  },
);
