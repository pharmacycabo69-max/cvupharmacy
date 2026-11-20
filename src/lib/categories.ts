import fs from "node:fs";
import path from "node:path";

/**
 * Tienda y categorías de producto.
 *
 * 1. Paginación: la copia solo trae la página 1 de /shop/ y de cada categoría; /page/2/ y siguientes daban 404
 *    (205 páginas en la tienda, 135 categorías afectadas). Se generan a partir de data/category-index.json
 *    (scraper/build_category_index.mjs) usando la página 1 como plantilla.
 * 2. Título y meta description con intención local para las 211 categorías (antes: "Pain Relief Archives", sin descripción).
 * 3. Guía de compra con preguntas frecuentes (FAQPage) debajo de los productos en las categorías clave.
 */

const ROOT = path.join(process.cwd(), "mirror");
const PER_PAGE = 16;
const WHATSAPP = "5216242261023";

type Item = [slug: string, name: string, thumb: string, priceCents: number, inStock: 0 | 1];
type Index = { p: Record<string, Item>; c: Record<string, number[]> };
let index: Index | null = null;
const getIndex = (): Index =>
  (index ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "category-index.json"), "utf-8")));

const decode = (s: string) =>
  s.replace(/&#0?38;|&amp;/g, "&").replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- paginación ---------- */

function card(id: number, it: Item, i: number): string {
  const [slug, rawName, thumb, price, inStock] = it;
  const name = esc(decode(rawName));
  const pos = i % 4 === 0 ? " first" : i % 4 === 3 ? " last" : "";
  const href = `/product/${encodeURI(slug)}/`;
  const priceHtml = price > 0
    ? `<span class="price"><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no">&#36;</span>${(price / 100).toFixed(2)}</bdi></span></span>`
    : "";
  const button = inStock && price > 0
    ? `<a href="?add-to-cart=${id}" data-quantity="1" class="button product_type_simple add_to_cart_button ajax_add_to_cart" data-product_id="${id}" data-product_sku="" aria-label="Add to cart: &ldquo;${name}&rdquo;" rel="nofollow" role="button">Add to cart</a>`
    : `<a href="${href}" data-quantity="1" class="button product_type_simple" data-product_id="${id}" aria-label="Read more about &ldquo;${name}&rdquo;" rel="nofollow">Read more</a>`;
  return (
    `<li class="product type-product post-${id} status-publish${pos} ${inStock ? "instock" : "outofstock"} has-post-thumbnail product-type-simple${inStock && price > 0 ? " purchasable" : ""}">` +
    `<a href="${href}" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">` +
    (thumb ? `<img width="300" height="300" src="${esc(thumb)}" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="${name}" loading="lazy" decoding="async" />` : "") +
    `<h2 class="woocommerce-loop-product__title">${name}</h2>${priceHtml}</a>${button}</li>\n`
  );
}

function pagination(base: string, page: number, pages: number): string {
  const url = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...nums].sort((a, b) => a - b);
  let out = "", prev = 0;
  if (page > 1) out += `<li><a class="prev page-numbers" href="${url(page - 1)}" aria-label="Previous page">&larr;</a></li>`;
  for (const n of sorted) {
    if (n - prev > 1) out += `<li><span class="page-numbers dots">&hellip;</span></li>`;
    out += n === page
      ? `<li><span aria-label="Page ${n}" aria-current="page" class="page-numbers current">${n}</span></li>`
      : `<li><a aria-label="Page ${n}" class="page-numbers" href="${url(n)}">${n}</a></li>`;
    prev = n;
  }
  if (page < pages) out += `<li><a class="next page-numbers" href="${url(page + 1)}" aria-label="Next page">&rarr;</a></li>`;
  return `<nav class="woocommerce-pagination" aria-label="Product Pagination"><ul class='page-numbers'>${out}</ul></nav>`;
}

/**
 * HTML de /shop/page/N/ o /product-category/<ruta>/page/N/ (N ≥ 2), construido sobre la página 1.
 * Devuelve null si la ruta no es una página de listado o el número de página no existe.
 */
export function listingPage(pathname: string): string | null {
  const m = /^\/(shop|product-category\/([a-z0-9\/-]+?))\/page\/(\d+)\/?$/i.exec(decodeURIComponent(pathname));
  if (!m) return null;
  const base = `/${m[1]}/`;
  const cat = m[2] ?? "";
  const page = parseInt(m[3], 10);
  const file = path.join(ROOT, ...m[1].split("/"), "index.html");
  if (page < 2 || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return null;

  const { p, c } = getIndex();
  const html = fs.readFileSync(file, "utf-8");
  const onPage1 = new Set([...html.matchAll(/<li class="product type-product post-(\d+)/g)].map((x) => +x[1]));
  const all = c[cat] ?? [];
  const rest = all.filter((id) => !onPage1.has(id) && p[id]);
  const pages = 1 + Math.ceil(rest.length / PER_PAGE);
  if (page > pages) return null;
  const items = rest.slice((page - 2) * PER_PAGE, (page - 1) * PER_PAGE);
  const total = onPage1.size + rest.length;
  const from = onPage1.size + (page - 2) * PER_PAGE + 1;

  return html
    // las rutas relativas de la plantilla ("../../wp-content/…") apuntan a la página 1
    .replace(/<head([^>]*)>/i, (h) => `${h}<base href="${base}">`)
    .replace(/<ul class="products columns-4">[\s\S]*?<\/ul>/, () =>
      `<ul class="products columns-4">\n${items.map((id, i) => card(id, p[id], i)).join("")}</ul>`)
    .replace(/Showing (?:1&ndash;\d+ of \d+|all \d+) results/, `Showing ${from}&ndash;${from + items.length - 1} of ${total} results`)
    .replace(/<nav class="woocommerce-pagination"[\s\S]*?<\/nav>/, () => pagination(base, page, pages));
}

/* ---------- SEO de la tienda y las categorías ---------- */

type Guide = { intro: string; needs: string[]; faq: [string, string][]; doctor?: boolean };

// Guías por categoría principal: lo que busca un turista en Cabo. Sin dosis ni consejos médicos concretos.
const GUIDES: Record<string, Guide> = {
  "sun-care": {
    intro: "The Baja sun is stronger than most visitors expect, even on cloudy or windy days. We deliver sunscreen, after-sun gels and lip protection to your hotel, villa or boat, so you don't pay resort gift-shop prices or lose beach time looking for a store.",
    needs: ["High-SPF and water-resistant sunscreen for beach and boat days", "Aloe vera and after-sun gels for sunburn", "SPF lip balm and face sunscreen", "Mineral, reef-friendly options for snorkeling"],
    faq: [
      ["Can you deliver sunscreen to the beach or a boat?", "We deliver to hotels, villas and marinas in Los Cabos. For a yacht or charter, send us the marina and slip on WhatsApp and we will coordinate the drop-off."],
      ["What should I use for a bad sunburn?", "Cool showers, aloe vera gel and plenty of water help mild sunburn. If you have blisters over a large area, fever, chills or feel dizzy, talk to a doctor; our licensed doctor can see you by video or at your hotel."],
      ["Do you sell reef-safe sunscreen?", "Yes. Ask us on WhatsApp and we will tell you which mineral sunscreens we have in stock today."],
    ],
    doctor: true,
  },
  "pain-relief": {
    intro: "Headache after a long flight, sore muscles after a hike or a sprain on the beach: we deliver over-the-counter pain and fever relief to your hotel or villa in Los Cabos, day and night. Many brands you know from home are sold in Mexico under the same active ingredient.",
    needs: ["Acetaminophen (paracetamol), ibuprofen, naproxen and aspirin", "Topical gels and patches for muscle and joint pain", "Effervescent tablets for fast relief", "Fever relief for adults and children"],
    faq: [
      ["Are Mexican pain relievers the same as in the U.S.?", "Brand names often differ, but the active ingredients are the same. Tell us the product you use at home and our English-speaking team will suggest the equivalent."],
      ["Can you deliver at night?", "Yes, our delivery service runs 24/7. Message us on WhatsApp and we confirm the ETA before you pay."],
      ["When should I see a doctor instead?", "If pain is severe, follows a fall or injury, or comes with high fever, see a doctor. Our licensed doctor can assess you by video or in your room."],
    ],
    doctor: true,
  },
  digestive: {
    intro: "A change of food, water and schedule is the most common reason travelers feel unwell in Cabo. We deliver rehydration salts, anti-diarrheal and antacid products to your hotel or villa, so you can rest instead of searching for a pharmacy.",
    needs: ["Oral rehydration salts and electrolyte drinks", "Anti-diarrheal and stomach-settling products", "Antacids and heartburn relief", "Probiotics and gentle stomach care"],
    faq: [
      ["What helps with traveler's diarrhea?", "Staying hydrated is the priority: oral rehydration salts or electrolyte drinks replace what you lose. If symptoms last more than two days, or you have a fever, blood in the stool or severe pain, see a doctor."],
      ["Can I buy antibiotics without a prescription in Mexico?", "No. Antibiotics require a prescription in Mexico. Our licensed doctor can assess you by video or at your hotel and prescribe them if they are appropriate."],
      ["How fast can you deliver?", "In Cabo San Lucas and the Tourist Corridor delivery usually takes under 60 minutes, 24/7. We confirm the ETA on WhatsApp before you pay."],
    ],
    doctor: true,
  },
  "cold-flu": {
    intro: "Air conditioning, long flights and late nights add up. We deliver cold, flu and allergy relief to your hotel or villa in Los Cabos, around the clock, with an English-speaking team that helps you find the equivalent of what you use at home.",
    needs: ["Cold and flu relief, day and night formulas", "Antihistamines for allergies", "Cough syrups and throat lozenges", "Thermometers and nasal care"],
    faq: [
      ["Can you help me find my usual cold medicine?", "Yes. Send us the name or a photo of the product you use at home and we will suggest the Mexican equivalent with the same active ingredients."],
      ["Do I need a prescription for antibiotics?", "Yes, antibiotics require a prescription in Mexico. Our licensed doctor can see you by video or at your hotel."],
      ["Do you deliver at night?", "Yes, delivery runs 24/7 across Cabo San Lucas, the Tourist Corridor and San José del Cabo."],
    ],
    doctor: true,
  },
  "first-aid": {
    intro: "Coral cuts, scraped knees, blisters from new sandals and jellyfish stings are part of many Cabo vacations. We deliver first-aid supplies to your hotel, villa or boat so small injuries stay small.",
    needs: ["Bandages, gauze and medical tape", "Antiseptics and wound-care creams", "Blister care and elastic bandages", "Complete first-aid kits for excursions"],
    faq: [
      ["What should I do after a jellyfish or stingray sting?", "Leave the water, rinse with sea water and seek medical help, especially for stingray injuries, which are usually treated with hot water and need a doctor's assessment. Our doctor can visit your hotel."],
      ["Can you deliver a first-aid kit before an excursion?", "Yes. Order the night before or early morning and we deliver to your hotel lobby or marina."],
      ["Do you deliver to Airbnbs and villas?", "Yes. Send us the address or a map pin and the name of the person receiving the order."],
    ],
    doctor: true,
  },
  "baby-kids": {
    intro: "Traveling with children means something always gets left at home. We deliver diapers, baby formula, children's medicine, sunscreen and snacks to your hotel or villa in Los Cabos, so parents don't need to leave the resort with a tired child.",
    needs: ["Diapers, wipes and swim diapers", "Children's fever and pain relief", "Kids' sunscreen and after-sun care", "Baby formula, food and bottles"],
    faq: [
      ["Do you have the same baby formula brands as in the U.S.?", "Many international brands are sold in Mexico. Tell us the brand and stage you use and we will confirm availability or suggest the closest equivalent."],
      ["What if my child has a fever?", "Children's fever relief is available over the counter. If the fever is high, lasts more than a day or your child seems very unwell, see a doctor; our licensed doctor can see your child at the hotel or by video."],
      ["Can you deliver at night?", "Yes, our delivery service runs 24/7."],
    ],
    doctor: true,
  },
  "travel-essentials": {
    intro: "Forgot your charger, toothbrush or motion-sickness tablets? We deliver the travel basics people leave at home to any hotel, villa or yacht in Los Cabos, usually faster than a taxi ride to the nearest store.",
    needs: ["Travel-size toiletries", "Motion-sickness relief for boat trips", "Chargers and travel accessories", "Ear plugs, eye masks and sleep aids"],
    faq: [
      ["Can you bring something that isn't on the website?", "Often, yes. Message us on WhatsApp with what you need and we will tell you if we can get it."],
      ["Do you deliver to the airport?", "Ask us on WhatsApp; we confirm what is possible depending on your flight time and terminal."],
      ["How do I pay?", "Prices are in US dollars. Pay by card online, or by card or cash on delivery."],
    ],
  },
  "personal-care": {
    intro: "Toiletries, deodorant, shaving and feminine care delivered to your hotel or villa in Los Cabos. No need to pay resort shop prices or leave the pool to find a store.",
    needs: ["Deodorant, soap and body care", "Shaving and grooming", "Feminine hygiene", "Contact lens solution and travel-size products"],
    faq: [
      ["Do you carry U.S. brands?", "Many international brands are available in Mexico. If you don't see yours, ask us on WhatsApp for the closest option."],
      ["Is there a minimum order?", "Message us with your order and we confirm the total and any delivery fee before you pay."],
      ["Do you deliver 24/7?", "Yes, delivery runs day and night across Los Cabos."],
    ],
  },
  "vitamins-supplements": {
    intro: "Keep your routine while you travel. We deliver vitamins, electrolytes, collagen, probiotics and other supplements to your hotel or villa in Los Cabos, often at better prices than resort shops.",
    needs: ["Electrolytes and hydration support for hot days", "Vitamin C, D and B complex", "Probiotics for digestion", "Collagen, magnesium and sports nutrition"],
    faq: [
      ["Are supplements in Mexico the same as at home?", "Many international brands are sold here. Send us the label of your usual product and we suggest the closest equivalent."],
      ["What is good for heat and dehydration?", "Electrolyte drinks or oral rehydration salts plus water and shade. If you feel dizzy, confused or stop sweating, get medical help; our doctor and IV therapy team can come to your hotel."],
      ["Can you deliver today?", "Yes, delivery runs 24/7 and usually arrives in under 60 minutes in Cabo San Lucas."],
    ],
  },
  "skin-care": {
    intro: "Sun, salt water and air conditioning are hard on skin. We deliver moisturizers, facial sunscreen, acne care and dermatological brands to your hotel or villa in Los Cabos.",
    needs: ["Moisturizers and hydrating serums", "Facial sunscreen", "Acne and sensitive-skin care", "Dermatological brands found in Mexican pharmacies"],
    faq: [
      ["Do you have dermatologist brands?", "Yes, we carry several dermatological brands sold in Mexican pharmacies. Ask us on WhatsApp for a specific product."],
      ["What helps with heat rash?", "Cool showers, loose clothing and staying out of the heat usually help. If the rash spreads, blisters or comes with fever, see a doctor."],
      ["Do you deliver to villas and Airbnbs?", "Yes, anywhere in Cabo San Lucas, the Tourist Corridor and San José del Cabo."],
    ],
  },
  "oral-care": {
    intro: "Toothbrushes, toothpaste, floss and mouthwash delivered to your room. The most commonly forgotten items, brought to your hotel or villa in Los Cabos.",
    needs: ["Toothbrushes and toothpaste", "Mouthwash and floss", "Sensitive-teeth care", "Denture and orthodontic care"],
    faq: [
      ["Can you deliver just a toothbrush?", "Yes. Message us on WhatsApp and we confirm the total before you pay."],
      ["What if I have tooth pain?", "Over-the-counter pain relief can help in the short term, but tooth pain needs a dentist. Ask us and we can point you to dental care in Cabo."],
      ["Do you deliver 24/7?", "Yes, day and night."],
    ],
  },
  "dental-care": {
    intro: "Dental care products delivered to your hotel or villa in Los Cabos, including sensitive-teeth care and products for after dental treatment, a common reason visitors come to Cabo.",
    needs: ["Sensitive-teeth toothpaste", "Soft and specialty toothbrushes", "Mouth rinses", "Orthodontic and denture care"],
    faq: [
      ["I had dental work in Cabo. Can you deliver what my dentist recommended?", "Yes. Send us a photo of the recommendation and we will prepare it. Prescription medicines need the dentist's prescription."],
      ["Can you deliver at night?", "Yes, our delivery service runs 24/7."],
      ["How do I pay?", "Card online, or card or cash on delivery. Prices are in USD."],
    ],
  },
  "diabetic-care": {
    intro: "Lost or forgotten diabetes supplies can ruin a trip. We deliver glucose meters, test strips, lancets and diabetic care products to your hotel or villa in Los Cabos.",
    needs: ["Glucose meters and test strips", "Lancets and alcohol pads", "Glucose tablets and snacks for lows", "Foot and skin care"],
    faq: [
      ["Can I get insulin in Cabo?", "Insulin is sold in Mexican pharmacies, but brands and pens may differ from home and a prescription may be needed. Message us with your exact product and we confirm availability; our doctor can help with a prescription."],
      ["Do your test strips fit my meter?", "Strips are meter-specific. Send us a photo of your meter and we confirm compatible strips."],
      ["How quickly can you deliver?", "Delivery runs 24/7 and usually arrives in under 60 minutes in Cabo San Lucas."],
    ],
    doctor: true,
  },
  "vision-care": {
    intro: "Contact lens solution, eye drops and reading glasses delivered to your hotel in Los Cabos. Sun, wind and chlorine make dry, irritated eyes common on vacation.",
    needs: ["Contact lens solution and cases", "Lubricating and allergy eye drops", "Reading glasses", "Eye care for sun and chlorine irritation"],
    faq: [
      ["Do you sell contact lenses?", "Ask us on WhatsApp with your prescription details and we confirm what is available."],
      ["What helps with red, irritated eyes?", "Lubricating drops and rest from sun and pool water usually help. If you have pain, discharge or changes in vision, see a doctor."],
      ["Do you deliver 24/7?", "Yes."],
    ],
  },
  "wellness-recovery": {
    intro: "Recover after long beach days, golf, fishing trips or a big night out. We deliver electrolytes, recovery products and wellness essentials to your hotel or villa in Los Cabos, and our team can arrange IV hydration at your hotel.",
    needs: ["Electrolytes and rehydration", "Muscle recovery and massage products", "Sleep and relaxation aids", "Hangover recovery essentials"],
    faq: [
      ["Can you deliver hangover recovery in the morning?", "Yes, delivery runs 24/7. For faster rehydration, ask about IV therapy at your hotel."],
      ["Do you offer IV therapy?", "Yes, licensed nurses come to your hotel or villa. See our IV therapy page or message us on WhatsApp."],
      ["How do I pay?", "Card online, or card or cash on delivery."],
    ],
    doctor: true,
  },
  "medical-equipment": {
    intro: "Mobility aids, blood pressure monitors, nebulizers and medical supplies delivered to your hotel or villa in Los Cabos, for travelers who need them during their stay.",
    needs: ["Blood pressure monitors and thermometers", "Wheelchairs, walkers and canes", "Nebulizers and respiratory care", "Bathroom safety and ostomy supplies"],
    faq: [
      ["Can you deliver mobility equipment to my hotel?", "Yes. Message us on WhatsApp with what you need and your hotel; we confirm availability and delivery time."],
      ["Do you rent equipment?", "Ask us on WhatsApp; we confirm what is available for your dates."],
      ["Do you deliver to San José del Cabo?", "Yes, across Cabo San Lucas, the Tourist Corridor and San José del Cabo."],
    ],
  },
  "orthopedic-support": {
    intro: "Twisted ankle on the beach, sore knee after a hike or back pain after a long flight: we deliver braces, supports and compression products to your hotel or villa in Los Cabos.",
    needs: ["Ankle, knee and wrist braces", "Back and posture supports", "Compression socks for flights", "Cold and heat therapy"],
    faq: [
      ["Which size should I order?", "Send us your measurements or usual size on WhatsApp and we help you choose."],
      ["When should I see a doctor for an injury?", "If you can't put weight on it, there is strong swelling or deformity, or the pain is severe, see a doctor. Our doctor can visit your hotel."],
      ["Do you deliver 24/7?", "Yes."],
    ],
    doctor: true,
  },
  "health-pharmacy": {
    intro: "Everyday health products from our licensed pharmacy at Plaza Gali, Cabo San Lucas Marina, delivered to your hotel, villa or yacht with an English-speaking team.",
    needs: ["Over-the-counter medicines", "Health monitoring", "Allergy and stomach care", "Personal health essentials"],
    faq: [
      ["Can I visit the pharmacy in person?", "Yes. We are at Plaza Gali, Local 048, Blvd. Paseo de la Marina 869, Cabo San Lucas. Store hours are 8:00 AM to 6:00 PM; delivery runs 24/7."],
      ["Do I need a prescription?", "Over-the-counter products don't. Prescription medicines, including antibiotics, need a prescription in Mexico; our doctor can help."],
      ["Do you speak English?", "Yes, our team speaks English and Spanish."],
    ],
    doctor: true,
  },
  "hair-care": {
    intro: "Shampoo, conditioner and hair treatments for sun, salt and chlorine, delivered to your hotel or villa in Los Cabos.",
    needs: ["Shampoo and conditioner", "Sun and chlorine protection for hair", "Styling products", "Anti-frizz treatments for humidity"],
    faq: [
      ["Do you carry salon brands?", "We carry a range of brands; ask us on WhatsApp for a specific product."],
      ["Can you deliver travel sizes?", "Ask us and we confirm what is in stock."],
      ["Do you deliver 24/7?", "Yes."],
    ],
  },
  "pet-supplies": {
    intro: "Traveling to Cabo with your dog or cat? We deliver pet food, flea and tick protection and pet care products to your hotel, villa or Airbnb in Los Cabos.",
    needs: ["Dog and cat food", "Flea, tick and parasite protection", "Pet hygiene and grooming", "Accessories for travel"],
    faq: [
      ["Do you have veterinary medicines?", "Some pet products are available over the counter; for anything else, ask us on WhatsApp and we will advise."],
      ["Can you deliver to a pet-friendly Airbnb?", "Yes, send us the address or a map pin."],
      ["Do you deliver 24/7?", "Yes."],
    ],
  },
};

const wa = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

const GUIDE_CSS =
  "<style id=\"cvu-cg-css\">" +
  ".cvu-cg{max-width:1080px;margin:40px auto 56px;padding:0 16px;color:#1a2b45;font-size:16px;line-height:1.7}" +
  ".cvu-cg h2{font-size:clamp(22px,2.6vw,28px);line-height:1.25;margin:36px 0 12px;color:#0f2540}" +
  ".cvu-cg p{margin:0 0 12px}.cvu-cg ul.cvu-cg-needs{margin:0 0 8px;padding-left:20px}.cvu-cg ul.cvu-cg-needs li{margin:4px 0}" +
  ".cvu-cg a{color:#0f5ea8;font-weight:600}" +
  ".cvu-cg details{border-bottom:1px solid #e3e9f1;padding:12px 0}.cvu-cg summary{cursor:pointer;font-weight:700;color:#0f2540}.cvu-cg details p{margin:8px 0 0}" +
  ".cvu-cg-cta{margin-top:28px;padding:20px;border-radius:14px;background:#f2f7fc;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}" +
  ".cvu-cg-cta p{margin:0;font-weight:600}.cvu-cg-cta a{display:inline-flex;padding:11px 18px;border-radius:999px;background:#1ebe5d;color:#fff!important;text-decoration:none}" +
  "</style>";

/**
 * Título, descripción y guía de la tienda o de una categoría (`pathname` con barra final; puede incluir /page/N/).
 * Devuelve el HTML con la guía insertada y el título/descripción a aplicar, o null si no es una página de listado.
 */
export function categorySeo(html: string, pathname: string): { html: string; title: string; desc: string } | null {
  const m = /^\/(?:product-category\/([^?#]+?)|shop)\/(?:page\/(\d+)\/)?$/.exec(decodeURIComponent(pathname));
  if (!m) return null;
  const cat = m[1] ?? "";
  const page = m[2] ? parseInt(m[2], 10) : 1;
  const h1 = /<h1 class="woocommerce-products-header__title page-title">([^<]*)<\/h1>/.exec(html)?.[1];
  const name = cat ? decode(h1 || "").trim() : "Pharmacy Products";
  if (!name) return null;
  const total = (getIndex().c[cat] ?? []).length;
  const suffix = page > 1 ? ` – Page ${page}` : "";

  let title = `${name} Delivery in Cabo San Lucas${suffix} | CVU Pharmacy`;
  if (title.length > 65) title = `${name} Delivery in Cabo San Lucas${suffix}`;
  if (title.length > 65) title = `${name} – Cabo Delivery${suffix}`;
  if (!cat) title = `Shop Pharmacy Products Online – Cabo San Lucas Delivery${suffix}`;
  const desc = `Shop ${total ? total.toLocaleString("en-US") + " " : ""}${cat ? name.toLowerCase() : "pharmacy"} products with delivery to your hotel, villa or yacht in Cabo San Lucas, usually in under 60 minutes. English-speaking pharmacy, 24/7 delivery.`;

  const guide = page === 1 ? GUIDES[cat] : undefined;
  if (!guide) return { html, title, desc };
  const n = esc(name);
  const section =
    GUIDE_CSS +
    `<section class="cvu-cg" aria-label="${n} buying guide">` +
    `<h2>${n} delivered to your hotel in Cabo</h2><p>${esc(guide.intro)}</p>` +
    `<h2>What travelers usually need</h2><ul class="cvu-cg-needs">${guide.needs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
    (guide.doctor
      ? `<p>Not sure what you need? Our licensed, English-speaking doctor can help by <a href="/video-consultation/">video consultation</a> or with a <a href="/home-doctor/">visit to your hotel</a>.</p>`
      : "") +
    `<h2>Frequently asked questions</h2>` +
    guide.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("") +
    `<div class="cvu-cg-cta"><p>Can't find it? Our pharmacy team answers on WhatsApp 24/7.</p>` +
    `<a href="${esc(wa(`Hi CVU Pharmacy! I'm looking for ${name.toLowerCase()} products.`))}" target="_blank" rel="noopener">Ask on WhatsApp</a></div>` +
    `</section>`;
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return {
    title,
    desc,
    html: html
      .replace(/<\/main>/, () => section + "</main>")
      .replace("</head>", () => `<script type="application/ld+json">${JSON.stringify(faq).replace(/</g, "\\u003c")}</script></head>`),
  };
}
