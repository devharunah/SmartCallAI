import type { WorkflowGraph } from "./schema";

// The graph every new restaurant starts with. Owners edit it on the canvas at
// /dashboard/workflow; "Reset to default" brings this back.

export const DEFAULT_WORKFLOW: WorkflowGraph = {
  nodes: [
    { id: "start", type: "start", title: "Start", data: {} },
    {
      id: "greeting",
      type: "agent",
      title: "Greeting",
      data: {
        prompt:
          "Welcome the customer warmly in one or two short sentences and ask what they'd like today. If their first message already asks for something, move straight to it instead of greeting at length.",
        tools: ["searchMenu", "checkHours"],
      },
    },
    {
      id: "closed",
      type: "agent",
      title: "Closed hours",
      data: {
        prompt:
          "The restaurant is closed right now. Say so kindly in one or two sentences and give the opening hours from checkHours. If they ask for the menu, call sendMenu. Do not take orders.",
        tools: ["checkHours", "searchMenu", "sendMenu"],
      },
    },
    {
      id: "send_menu",
      type: "send_menu",
      title: "Send menu",
      data: {
        say: {
          eng: "Here's our menu. What would you like to order?",
          lug: "Menu yaffe yiino. Oyagala kulya ki?",
        },
      },
    },
    {
      id: "take_order",
      type: "agent",
      title: "Take order",
      data: {
        prompt: [
          "Help the customer build their order.",
          "- Add every item that is clear straight away with addToCart (exact itemId and quantity), then ask only about what is unclear. Only offer items on the menu.",
          "- A word matches the item whose \"also called\" list contains it (for example \"rolex\" is Classic Rolex). Mention the other option only in passing; don't make the customer choose.",
          "- If an item is sold out or unclear, say so and suggest the closest match.",
          "- After adding items, briefly say what's in the cart and ask if they want anything else. A drink suggestion is fine once.",
          "- Ask whether it's pickup or delivery. For delivery, ask for the area and a landmark, then call setFulfillment.",
          "- Never state totals yourself; the confirmation step shows the prices.",
        ].join("\n"),
        tools: ["searchMenu", "addToCart", "removeFromCart", "viewCart", "setFulfillment", "sendMenu", "checkHours"],
      },
    },
    {
      id: "faq",
      type: "agent",
      title: "Questions",
      data: {
        prompt:
          "Answer the customer's question about the restaurant: menu items, prices, opening hours, delivery areas and fee, and payment (cash or mobile money on delivery). Use the tools for facts. Then ask if they'd like to order.",
        tools: ["searchMenu", "checkHours", "sendMenu"],
      },
    },
    { id: "confirm", type: "confirm", title: "Confirm order", data: {} },
    { id: "place_order", type: "place_order", title: "Place order", data: {} },
    {
      id: "order_placed",
      type: "agent",
      title: "After the order",
      data: {
        prompt:
          "The customer's order has been placed and the kitchen can see it. Answer follow-up questions about it briefly. Payment is cash or mobile money on delivery or pickup. If they want to order more, move to taking a new order.",
        tools: ["checkHours", "searchMenu"],
      },
    },
    { id: "handoff", type: "handoff", title: "Talk to a person", data: {} },
  ],
  edges: [
    { id: "e-start-closed", source: "start", target: "closed", kind: "expr", condition: "isOpen == false" },
    { id: "e-start-greeting", source: "start", target: "greeting", kind: "always" },
    { id: "e-closed-open", source: "closed", target: "greeting", kind: "expr", condition: "isOpen == true" },
    { id: "e-greeting-menu", source: "greeting", target: "send_menu", kind: "llm", condition: "The customer wants to see the menu or asks what food is available" },
    { id: "e-greeting-order", source: "greeting", target: "take_order", kind: "llm", condition: "The customer names food or drinks they want to order" },
    { id: "e-greeting-faq", source: "greeting", target: "faq", kind: "llm", condition: "The customer asks about location, hours, delivery or payment" },
    { id: "e-menu-order", source: "send_menu", target: "take_order", kind: "always" },
    {
      id: "e-order-confirm",
      source: "take_order",
      target: "confirm",
      kind: "llm",
      condition: "The customer has finished choosing, the cart has items, and pickup or delivery (with area) has been set",
    },
    { id: "e-order-faq", source: "take_order", target: "faq", kind: "llm", condition: "The customer asks a question that isn't about choosing items" },
    { id: "e-faq-order", source: "faq", target: "take_order", kind: "llm", condition: "The customer wants to order or change their order" },
    { id: "e-faq-menu", source: "faq", target: "send_menu", kind: "llm", condition: "The customer wants to see the menu" },
    { id: "e-confirm-yes", source: "confirm", target: "place_order", kind: "success", condition: "Customer says yes" },
    { id: "e-confirm-change", source: "confirm", target: "take_order", kind: "failure", condition: "Customer wants changes" },
    { id: "e-placed", source: "place_order", target: "order_placed", kind: "success" },
    { id: "e-place-failed", source: "place_order", target: "take_order", kind: "failure" },
    { id: "e-again", source: "order_placed", target: "take_order", kind: "llm", condition: "The customer wants to order something else" },
  ],
};
