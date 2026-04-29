import { apiRequest } from "../api.js";

export const orderDomain = {
  definition: {
    name: "order_domain",
    description:
      "Order a domain for $15. Creates a Stripe Checkout Session and returns a payment URL the user must open in a browser. After paying, the user should tell you they've paid; call confirm_payment with the returned order id to verify and finalize registration. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: {
          type: "string",
          description: "Full domain to order, e.g. example.com.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler({ domain } = {}) {
    if (typeof domain !== "string" || domain.length === 0) {
      throw new Error("domain is required");
    }
    const normalized = domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    const dotIndex = normalized.indexOf(".");
    if (dotIndex < 1 || dotIndex === normalized.length - 1) {
      throw new Error(`Invalid domain "${domain}". Use a full domain like example.com.`);
    }
    const label = normalized.slice(0, dotIndex);
    const tld = normalized.slice(dotIndex + 1);

    const { data } = await apiRequest("/api/orders", {
      method: "POST",
      body: { domain: label, tld },
      requireAuth: true,
    });

    const order = data?.order;
    const checkoutUrl = data?.checkoutUrl;
    if (!order || !checkoutUrl) {
      throw new Error("Order created but no Stripe Checkout URL was returned.");
    }

    const amount = formatAmount(order.amountCents, order.currency);
    return [
      `Order ${order.id} created for ${order.fqdn} (${amount}).`,
      "",
      "To pay, open this URL in your browser:",
      checkoutUrl,
      "",
      `When you've completed payment, run confirm_payment with orderId="${order.id}".`,
    ].join("\n");
  },
};

function formatAmount(cents, currency) {
  if (typeof cents !== "number") return "";
  const dollars = (cents / 100).toFixed(2);
  return `${(currency || "usd").toUpperCase()} ${dollars}`;
}
