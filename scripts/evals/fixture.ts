import type { ModelMessage } from "ai";
import type { Conversation } from "../../lib/chat/types";
import type { Menu, Restaurant } from "../../lib/restaurants/types";

// In-memory copy of the demo restaurant (matches the seed in 0003_restaurants.sql)
// so evals can run the workflow without a database.

export const restaurant: Restaurant = {
  id: "r", ownerId: null, name: "Mama Rose Kitchen", slug: "mama-rose-kitchen", currency: "UGX", timezone: "Africa/Kampala",
  defaultLanguage: "lug", hours: { open: "00:00", close: "00:00" },
  delivery: { pickup: true, delivery: true, fee: 3000, areas: ["Kololo", "Nakasero", "Kamwokya", "Ntinda", "Bukoto", "Wandegeya", "Kisementi"] },
  greeting: null, whatsappPhoneNumberId: null,
};

let n = 0;
const it = (name: string, price: number, aliases: string[], nameLg: string | null = null) => ({
  id: `item-${++n}`, categoryId: null, name, nameLg, description: null, price, available: true, imagePath: null, aliases, position: n,
});

export const menu: Menu = {
  categories: [],
  items: [
    it("Classic Rolex", 5000, ["rolex", "rolexes"]),
    it("Rolex Special", 8000, ["special rolex", "rolex special"]),
    it("Chapati", 1000, ["chapo", "chapati", "kyapati"], "Kyapati"),
    it("Katogo (beef)", 10000, ["katogo"], "Katogo w'ennyama"),
    it("Chicken Luwombo", 25000, ["luwombo", "chicken luwombo", "enkoko"], "Luwombo w'enkoko"),
    it("Beef Luwombo", 22000, ["beef luwombo"], "Luwombo w'ennyama"),
    it("Matooke & groundnut sauce", 9000, ["matooke", "binyebwa", "ebinyeebwa"], "Matooke n'ebinyeebwa"),
    it("Beef pilau", 12000, ["pilau", "pilawo"], "Pilawo"),
    it("Posho & beans", 6000, ["posho", "kawunga", "beans", "bijanjaalo"], "Kawunga n'ebijanjaalo"),
    it("Grilled tilapia", 30000, ["fish", "tilapia", "ngege", "kyennyanja"], "Ekyennyanja"),
    it("Muchomo (goat)", 15000, ["muchomo", "goat", "mbuzi"], "Mucomo w'embuzi"),
    it("Chips", 5000, ["chips", "fries"]),
    it("Fresh passion juice", 4000, ["juice", "passion", "passion juice"], "Omubisi gwa passion"),
    it("Soda (300ml)", 2000, ["soda", "coke", "fanta", "sprite"]),
    it("African tea", 2000, ["tea", "chai", "caayi", "african tea"], "Caayi"),
    it("Water (500ml)", 1500, ["water", "amazzi"], "Amazzi"),
  ],
};

export function newConversation(): Conversation {
  return {
    id: "c", restaurantId: "r", channel: "web", customerId: "eval", customerName: null, language: "lug", messages: [] as ModelMessage[],
    displayLog: [], currentNode: "take_order", cart: { items: [] }, misses: 0, status: "active", aiPaused: false, consentShown: true,
    lastCustomerAt: null, updatedAt: "",
  };
}
