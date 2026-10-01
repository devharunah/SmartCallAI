import type { Language } from "../restaurants/types";

// Fixed customer-facing text in both languages. Anything with prices, totals or
// order references comes from here, never from the LLM.
// The Luganda strings still need review by a native speaker before launch.

const STRINGS = {
  consent: {
    eng: "👋 You're chatting with {name}'s AI assistant. We save this chat to prepare your order. Reply \"person\" any time to talk to our staff.",
    lug: "👋 Oyogera ne AI ya {name}. Emboozi eno tugitereka okukola order yo. Wandiika \"omuntu\" essaawa yonna okwogera n'omukozi waffe.",
  },
  confirmHeader: { eng: "Please confirm your order:", lug: "Kakasa order yo:" },
  deliveryLine: { eng: "Delivery to {area}", lug: "Okutuusa e {area}" },
  pickupLine: { eng: "Pickup at {name}", lug: "Ojja kukima ku {name}" },
  totalLine: { eng: "Total", lug: "Omugatte" },
  payOnDelivery: {
    eng: "Pay cash or mobile money when it arrives.",
    lug: "Osasula ssente enkalu oba mobile money ng'etuuse.",
  },
  payOnPickup: {
    eng: "Pay cash or mobile money when you collect.",
    lug: "Osasula ssente enkalu oba mobile money ng'okima.",
  },
  confirmYes: { eng: "Yes, place order", lug: "Yee, kakasa" },
  confirmChange: { eng: "Change something", lug: "Kyusa" },
  confirmPrompt: { eng: "Shall I place it?", lug: "Ngiweereze?" },
  orderPlaced: {
    eng: "✅ Order {ref} placed! Total {total}. The kitchen has it now and we'll message you when it's ready.",
    lug: "✅ Order {ref} etuuse! Omugatte {total}. Effumbiro lifunye order yo, tujja kukutegeeza nga yeetegese.",
  },
  handoff: {
    eng: "I've asked a member of our staff to take over. They'll reply here shortly.",
    lug: "Nsabye omu ku bakozi baffe akuyambe. Ajja kukuddamu wano mu bbanga ttono.",
  },
  voiceNotUnderstood: {
    eng: "Sorry, I couldn't make out that voice note. Could you type it instead?",
    lug: "Nsonyiwa, sisobodde kuwulira bulungi voice note eyo. Osobola okuwandiika?",
  },
  somethingWrong: {
    eng: "Sorry, something went wrong on our side. Please try again in a moment.",
    lug: "Nsonyiwa, waliwo ekitagenze bulungi. Gezaako nate oluvannyuma lw'akaseera.",
  },
  emptyCart: {
    eng: "Your order is empty. What would you like?",
    lug: "Tonnalonda kintu. Oyagala kulya ki?",
  },
  needFulfillment: {
    eng: "Is this for pickup or delivery? For delivery, tell me your area and a landmark.",
    lug: "Ojja kukima oba tukuleetere? Bw'oba oyagala tukuleetere, mbuulira ekitundu n'akabonero kw'obeera.",
  },
  itemGone: {
    eng: "Sorry, {item} is no longer available, so I've taken it off your order.",
    lug: "Nsonyiwa, {item} kiweddeyo, kale nkiggye ku order yo.",
  },
  menuCaption: { eng: "{name} menu", lug: "Menu ya {name}" },
  status_accepted: { eng: "👍 Your order {ref} has been accepted.", lug: "👍 Order yo {ref} ekkiriziddwa." },
  status_preparing: { eng: "👩‍🍳 We're preparing your order {ref}.", lug: "👩‍🍳 Tuli mu kufumba order yo {ref}." },
  status_ready_pickup: { eng: "🍽️ Order {ref} is ready for pickup!", lug: "🍽️ Order {ref} yeetegese, jjangu ogikime!" },
  status_ready_delivery: { eng: "🛵 Order {ref} is on its way to you!", lug: "🛵 Order {ref} eri mu kkubo ejja gy'oli!" },
  status_completed: { eng: "Thank you! Enjoy your meal 😊", lug: "Webale nnyo! Olye bulungi 😊" },
  status_cancelled: {
    eng: "Sorry, order {ref} was cancelled. Reply here if you have any questions.",
    lug: "Nsonyiwa, order {ref} esaziddwamu. Tuwandiikire wano bw'oba olina ekibuuzo.",
  },
} as const satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Language, vars: Record<string, string | number> = {}): string {
  return STRINGS[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

// Common Luganda words that rarely appear in English messages. Food names
// (rolex, katogo, matooke) are shared by both languages, so they don't count.
const LUGANDA_WORDS = new Set([
  "oli", "otya", "mpa", "mpaako", "njagala", "nyagala", "njagalayo", "webale", "weebale", "nnyo", "ssebo", "nnyabo",
  "kale", "yee", "nedda", "bambi", "nze", "ggwe", "ffe", "bwe", "nga", "ndeetera", "ndetera", "ntwalira", "emmere",
  "ssente", "sente", "olwaleero", "kati", "wano", "eyo", "bbiri", "ssatu", "emu", "nnya", "ttaano", "osiibye",
  "wasuze", "gyendi", "ogamba", "ki", "kiki", "meka", "wa", "mwe", "tulina", "mulina", "mumpe", "ndi", "omuntu",
  "ku", "mu", "ne", "era", "naye", "kubanga", "mbeera", "ntuusa", "ntuusize", "bulungi", "nsaba", "musobola",
  "nnoonya", "nyongera", "ggyako", "kyusa", "okulya", "kunywa", "ebyokunywa", "caayi", "amazzi", "leero",
]);
const ENGLISH_WORDS = new Set([
  "the", "i", "want", "please", "can", "you", "and", "with", "my", "is", "what", "how", "have", "send", "some",
  "would", "like", "need", "get", "me", "for", "to", "of", "your", "do", "are", "thanks", "thank", "yes", "no",
  "much", "many", "price", "there", "this", "that", "it", "bring", "deliver", "take", "order", "a", "an", "one",
  "two", "three", "four", "five", "hello", "hey", "please", "plus", "also", "ok", "okay", "sure", "what", "when", "where",
]);

/**
 * Cheap guess at the customer's language from one message. Returns null when
 * the message is too short or mixed to tell, so the conversation keeps its
 * current language.
 */
export function detectLanguage(text: string): Language | null {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  let lug = 0;
  let eng = 0;
  for (const w of words) {
    if (LUGANDA_WORDS.has(w)) lug++;
    else if (ENGLISH_WORDS.has(w)) eng++;
    // Luganda verb prefixes: n-jagala, o-kulya, tu-lina...
    else if (/^(nj|ny|okw?|oku|tw|tu|mu|ba|ki|nn|ss|gg|bb|tt)[a-z]{3,}$/.test(w) && /[aeiou]$/.test(w)) lug += 0.5;
  }
  if (lug >= 1 && lug >= eng) return "lug";
  if (lug < 1 && (eng >= 2 || (eng >= 1 && words.length >= 3))) return "eng";
  return null;
}
