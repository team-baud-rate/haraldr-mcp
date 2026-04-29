import { apiRequest } from "../api.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').OrderDetailResponse} OrderDetailResponse */

/** @type {Tool} */
export const confirmPayment = {
  definition: {
    name: "confirm_payment",
    description:
      "Verify whether a previously created domain order has been paid, and report whether the domain has been registered. Call this after the user has completed Stripe Checkout. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["orderId"],
      properties: {
        orderId: {
          type: "string",
          description: "The order id returned by order_domain.",
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Look up the order's current status and translate it into a
   * user-facing message describing whether payment cleared, registration
   * succeeded, or further action is required.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const orderId = args.orderId;
    if (typeof orderId !== "string" || orderId.length === 0) {
      throw new Error("orderId is required");
    }
    const { data } = await apiRequest(
      `/api/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        requireAuth: true,
      },
    );
    const payload = /** @type {OrderDetailResponse | undefined} */ (data);
    const order = payload?.order;
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    switch (order.status) {
      case "pending": {
        const url = payload?.checkoutUrl;
        return url
          ? `No payment received yet for ${order.fqdn}. Open this URL to pay: ${url}`
          : `No payment received yet for ${order.fqdn}.`;
      }
      case "paid":
        return `Payment received for ${order.fqdn}. Registration is in progress; run confirm_payment again in a moment.`;
      case "registered":
        return `Done — ${order.fqdn} is registered (Openprovider id ${order.openproviderDomainId ?? "unknown"}).`;
      case "failed":
        return `Order ${order.id} failed: ${order.failureReason ?? "unknown reason"}. Contact support to retry.`;
      default:
        return `Order ${order.id} has unexpected status "${order.status}".`;
    }
  },
};
