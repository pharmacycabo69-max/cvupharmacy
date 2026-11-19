/**
 * Contenido ampliado para las páginas "Pharmacy delivery to <hotel>".
 *
 * Las páginas originales eran solo un encabezado (150–400 palabras), demasiado poco para posicionar.
 * Aquí se añade, debajo del encabezado, una guía por hotel: cómo funciona la entrega, qué se pide más,
 * la zona de reparto con enlaces a los hoteles vecinos, atención médica, preguntas frecuentes y llamada a la acción.
 * El texto varía por zona y por hotel; no se inventan tiempos exactos ni distancias.
 */

type Zone = "medano" | "pacific" | "corridor" | "sjd" | "eastcape";

const HOTELS: Record<string, { name: string; zone: Zone }> = {
  "pharmacy-delivery-bahia-hotel-beach-house-cabo": { name: "Bahia Hotel & Beach House", zone: "medano" },
  "pharmacy-delivery-breathless-cabo-san-lucas": { name: "Breathless Cabo San Lucas", zone: "medano" },
  "pharmacy-delivery-cabo-villas-beach-resort": { name: "Cabo Villas Beach Resort & Spa", zone: "medano" },
  "pharmacy-delivery-casa-dorada-los-cabos": { name: "Casa Dorada Los Cabos", zone: "medano" },
  "pharmacy-delivery-me-cabo-melia": { name: "ME Cabo by Meliá", zone: "medano" },
  "pharmacy-delivery-riu-santa-fe-cabo": { name: "Riu Santa Fe", zone: "medano" },
  "pharmacy-delivery-riu-palace-cabo-san-lucas": { name: "Riu Palace Cabo San Lucas", zone: "medano" },
  "pharmacy-delivery-pueblo-bonito-pacifica": { name: "Pueblo Bonito Pacifica", zone: "pacific" },
  "pharmacy-delivery-pueblo-bonito-sunset-beach": { name: "Pueblo Bonito Sunset Beach", zone: "pacific" },
  "pharmacy-delivery-waldorf-astoria-pedregal-cabo": { name: "Waldorf Astoria Los Cabos Pedregal", zone: "pacific" },
  "pharmacy-delivery-sandos-finisterra-cabo": { name: "Sandos Finisterra", zone: "pacific" },
  "pharmacy-delivery-nobu-hotel-los-cabos": { name: "Nobu Hotel Los Cabos", zone: "pacific" },
  "pharmacy-delivery-hard-rock-hotel-los-cabos": { name: "Hard Rock Hotel Los Cabos", zone: "pacific" },
  "pharmacy-delivery-the-cape-thompson-hotel-cabo": { name: "The Cape, a Thompson Hotel", zone: "corridor" },
  "pharmacy-delivery-garza-blanca-cabo": { name: "Garza Blanca Resort & Spa Los Cabos", zone: "corridor" },
  "pharmacy-delivery-esperanza-auberge-cabo": { name: "Esperanza, Auberge Resorts", zone: "corridor" },
  "pharmacy-delivery-hacienda-del-mar-cabo": { name: "Hacienda del Mar Los Cabos", zone: "corridor" },
  "pharmacy-delivery-montage-los-cabos": { name: "Montage Los Cabos", zone: "corridor" },
  "pharmacy-delivery-chileno-bay-resort-cabo": { name: "Chileno Bay Resort & Residences", zone: "corridor" },
  "pharmacy-delivery-grand-velas-los-cabos": { name: "Grand Velas Los Cabos", zone: "corridor" },
  "pharmacy-delivery-solaz-marriott-los-cabos": { name: "Solaz, a Luxury Collection Resort", zone: "corridor" },
  "pharmacy-delivery-dreams-los-cabos": { name: "Dreams Los Cabos", zone: "corridor" },
  "pharmacy-delivery-le-blanc-spa-resort-cabo": { name: "Le Blanc Spa Resort Los Cabos", zone: "corridor" },
  "pharmacy-delivery-hilton-los-cabos": { name: "Hilton Los Cabos", zone: "corridor" },
  "pharmacy-delivery-las-ventanas-al-paraiso-cabo": { name: "Las Ventanas al Paraíso", zone: "corridor" },
  "pharmacy-delivery-zoetry-casa-del-mar-cabo": { name: "Zoëtry Casa del Mar", zone: "corridor" },
  "pharmacy-delivery-paradisus-los-cabos": { name: "Paradisus Los Cabos", zone: "corridor" },
  "pharmacy-delivery-marquis-los-cabos": { name: "Marquis Los Cabos", zone: "corridor" },
  "pharmacy-delivery-westin-los-cabos": { name: "The Westin Los Cabos", zone: "corridor" },
  "pharmacy-delivery-one-only-palmilla-cabo": { name: "One&Only Palmilla", zone: "corridor" },
  "pharmacy-delivery-cabo-azul-resort": { name: "Cabo Azul Resort", zone: "sjd" },
  "pharmacy-delivery-hyatt-ziva-los-cabos": { name: "Hyatt Ziva Los Cabos", zone: "sjd" },
  "pharmacy-delivery-jw-marriott-los-cabos": { name: "JW Marriott Los Cabos", zone: "sjd" },
  "pharmacy-delivery-secrets-puerto-los-cabos": { name: "Secrets Puerto Los Cabos", zone: "sjd" },
  "pharmacy-delivery-four-seasons-costa-palmas": { name: "Four Seasons Resort Los Cabos at Costa Palmas", zone: "eastcape" },
};

const ZONES: Record<Zone, { label: string; area: string; delivery: string; tip: string; orders: string[] }> = {
  medano: {
    label: "Medano Beach, Cabo San Lucas",
    area: "Medano Beach is the busiest stretch of sand in Cabo San Lucas, a short drive from our pharmacy at Plaza Gali on the Marina.",
    delivery: "Because the resort sits so close to our Marina store, Medano Beach orders are among the quickest we deliver — usually well within our under-60-minute window.",
    tip: "Long beach days, boat trips to the Arch and late nights downtown are the classic Medano combination: guests here most often ask for after-sun care, electrolytes, hangover relief and motion-sickness tablets.",
    orders: ["sun-care", "digestive", "pain-relief", "travel-essentials"],
  },
  pacific: {
    label: "the Pacific side of Cabo San Lucas",
    area: "The Pacific-side resorts sit just west of downtown Cabo San Lucas, on the open-ocean beaches toward Pedregal and Diamante.",
    delivery: "We drive to the Pacific side around the clock; it is a short trip from the Marina, and we confirm the ETA on WhatsApp before you pay.",
    tip: "The Pacific coast brings strong sun and wind: reef-safe sunscreen, lip balm, eye drops and first-aid supplies for scrapes are the most common requests from guests here.",
    orders: ["sun-care", "first-aid", "personal-care", "cold-flu"],
  },
  corridor: {
    label: "the Tourist Corridor",
    area: "The Tourist Corridor is the stretch of coastal highway between Cabo San Lucas and San José del Cabo, home to most of the luxury resorts in Los Cabos.",
    delivery: "Our drivers cover the whole corridor 24/7. Corridor deliveries usually arrive within the hour; we confirm the exact ETA on WhatsApp before you pay.",
    tip: "Corridor resorts are spread out and far from town, so a pharmacy run means a taxi both ways. Guests here usually order a full kit at once: pain relief, stomach care, allergy medicine and sun care.",
    orders: ["pain-relief", "digestive", "cold-flu", "sun-care"],
  },
  sjd: {
    label: "San José del Cabo",
    area: "San José del Cabo is the quieter, historic side of Los Cabos, with its hotel zone along the beach and the Puerto Los Cabos marina just to the east.",
    delivery: "We deliver to San José del Cabo day and night. It is farther from our Marina store than Cabo San Lucas, so we always confirm the ETA on WhatsApp before you pay.",
    tip: "Many San José guests arrive straight from the airport, so the most common requests are the things left at home: travel-size toiletries, chargers, children's medicine and allergy relief.",
    orders: ["travel-essentials", "baby-kids", "cold-flu", "personal-care"],
  },
  eastcape: {
    label: "the East Cape",
    area: "The East Cape is the remote coastline north-east of San José del Cabo — beautiful, quiet and a long way from the nearest pharmacy.",
    delivery: "The East Cape is outside our usual delivery radius, so delivery takes longer than in Cabo San Lucas. Message us first: we confirm availability, price and ETA on WhatsApp before you pay, and we recommend one well-planned order.",
    tip: "Because a pharmacy run from the East Cape takes a big part of the day, guests usually order everything they may need for the whole stay at once: first aid, pain relief, stomach care and sun care.",
    orders: ["first-aid", "pain-relief", "digestive", "sun-care"],
  },
};

const CATEGORIES: Record<string, string> = {
  "sun-care": "Sunscreen & after-sun care",
  "pain-relief": "Pain & fever relief",
  digestive: "Stomach & traveler's diarrhea",
  "cold-flu": "Cold, flu & allergy",
  "first-aid": "First aid & wound care",
  "baby-kids": "Baby & kids",
  "travel-essentials": "Travel essentials",
  "personal-care": "Personal care & toiletries",
};

const WHATSAPP = "5216242261023";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS =
  "<style id=\"cvu-hz-css\">" +
  ".cvu-hz{max-width:1080px;margin:0 auto;padding:56px 16px 72px;color:#1a2b45;font-size:16.5px;line-height:1.7}" +
  ".cvu-hz h2{font-size:clamp(24px,3vw,32px);line-height:1.2;margin:48px 0 14px;color:#001a3d;letter-spacing:-.01em}" +
  ".cvu-hz h2:first-child{margin-top:0}.cvu-hz h3{font-size:18px;margin:0 0 6px;color:#001a3d}" +
  ".cvu-hz p{margin:0 0 14px}.cvu-hz a{color:#004a8d;font-weight:600}" +
  ".cvu-hz-steps{list-style:none;padding:0;margin:20px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;counter-reset:s}" +
  ".cvu-hz-steps li{background:#f3f8fc;border:1px solid #dbe8f4;border-radius:14px;padding:18px 18px 16px;counter-increment:s}" +
  ".cvu-hz-steps li:before{content:counter(s);display:inline-flex;width:28px;height:28px;border-radius:50%;background:#004a8d;color:#fff;font-weight:700;align-items:center;justify-content:center;margin-bottom:8px}" +
  ".cvu-hz-cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:18px 0 0;padding:0;list-style:none}" +
  ".cvu-hz-cats a{display:block;padding:14px 16px;border:1px solid #dbe8f4;border-radius:12px;text-decoration:none;background:#fff}" +
  ".cvu-hz-cats a:hover{border-color:#004a8d}" +
  ".cvu-hz-near{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;padding:0;list-style:none}" +
  ".cvu-hz-near a{display:inline-block;padding:7px 12px;border-radius:999px;background:#eef4fa;text-decoration:none;font-size:14.5px}" +
  ".cvu-hz-faq details{border-bottom:1px solid #dbe8f4;padding:14px 0}.cvu-hz-faq summary{cursor:pointer;font-weight:700;color:#001a3d}" +
  ".cvu-hz-faq details p{margin:10px 0 0}" +
  ".cvu-hz-cta{margin-top:48px;padding:28px 24px;border-radius:18px;background:#002c5f;color:#fff;text-align:center}" +
  ".cvu-hz-cta h2{color:#fff;margin:0 0 8px}.cvu-hz-cta p{color:rgba(255,255,255,.88)}" +
  ".cvu-hz-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}" +
  ".cvu-hz-btns a{display:inline-flex;align-items:center;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:700}" +
  ".cvu-hz-wa{background:#1ebe5d;color:#fff!important}.cvu-hz-shop{background:#fff;color:#002c5f!important}" +
  "</style>";

/** Sección ampliada para una página de hotel, o null si la ruta no es de hotel. */
export function hotelSection(path: string): { html: string; faq: object } | null {
  const slug = path.replace(/^\/|\/$/g, "");
  const hotel = HOTELS[slug];
  if (!hotel) return null;
  const z = ZONES[hotel.zone];
  const n = esc(hotel.name);
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi CVU Pharmacy! I'm staying at ${hotel.name} and need a delivery.`)}`;
  const neighbors = Object.entries(HOTELS).filter(([s, h]) => h.zone === hotel.zone && s !== slug);

  const faqs: [string, string][] = [
    [`Do you deliver to ${hotel.name} at night?`,
      `Yes. Our delivery service runs 24/7, including nights, weekends and holidays. Message us on WhatsApp at +52 624 226 1023 and we will confirm the ETA before you pay.`],
    [`How does the delivery reach my room at ${hotel.name}?`,
      `Send us your name as it appears on the reservation and your room or villa number. Our driver coordinates with the front desk, concierge or security, and the order is handed to you or left with the front desk if you prefer.`],
    [`Can you bring prescription medicine to ${hotel.name}?`,
      `Over-the-counter products can be ordered right away. Medicines that require a prescription in Mexico need one; if you don't have a Mexican prescription, our licensed doctor can assess you by video or in your room and prescribe what is appropriate.`],
    [`How do I pay?`,
      `Prices are in US dollars. You can pay by card online when you order, or by card or cash on delivery.`],
  ];

  const html =
    CSS +
    `<section class="cvu-hz" aria-label="Pharmacy delivery guide for ${n}">` +
    `<h2>How pharmacy delivery to ${n} works</h2>` +
    `<p>CVU Pharmacy is an English-speaking pharmacy in Cabo San Lucas. Instead of leaving ${n} to look for a farmacia, ` +
    `you tell us what you need and we bring it to the resort. ${z.delivery}</p>` +
    `<ol class="cvu-hz-steps">` +
    `<li><h3>Tell us what you need</h3>Order online or send a WhatsApp message with the products, your name and room number at ${n}.</li>` +
    `<li><h3>We confirm price and ETA</h3>A real person replies in English or Spanish, confirms availability and the total in USD, and suggests an equivalent if a brand isn't available in Mexico.</li>` +
    `<li><h3>Delivered to the resort</h3>Our driver brings the order to ${n} and coordinates with the front desk or concierge so it reaches you.</li>` +
    `</ol>` +
    `<h2>What ${n} guests order most</h2>` +
    `<p>${z.tip}</p>` +
    `<ul class="cvu-hz-cats">` +
    z.orders.map((c) => `<li><a href="/product-category/${c}/">${CATEGORIES[c]}</a></li>`).join("") +
    `<li><a href="/shop/">Browse all pharmacy products</a></li></ul>` +
    `<h2>Delivery area: ${esc(z.label)}</h2>` +
    `<p>${z.area} ${n} is one of the resorts we deliver to every week.</p>` +
    (neighbors.length
      ? `<p>We also deliver to these nearby resorts:</p><ul class="cvu-hz-near">` +
        neighbors.map(([s, h]) => `<li><a href="/${s}/">${esc(h.name)}</a></li>`).join("") + `</ul>`
      : "") +
    `<h2>Need a doctor at ${n}?</h2>` +
    `<p>If you are feeling unwell, medicine alone may not be enough. Our licensed, English-speaking doctor can see you without leaving the resort: ` +
    `book a <a href="/video-consultation/">video consultation</a>, request a <a href="/home-doctor/">house-call doctor</a> to your room, ` +
    `arrange <a href="/nurse-care/">in-suite nurse care</a>, or get <a href="/iv-therapy/">IV hydration therapy</a> at the hotel.</p>` +
    `<h2>Frequently asked questions</h2><div class="cvu-hz-faq">` +
    faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("") +
    `</div>` +
    `<div class="cvu-hz-cta"><h2>Staying at ${n}?</h2>` +
    `<p>Message us now and we will confirm your order and delivery time in minutes.</p>` +
    `<div class="cvu-hz-btns"><a class="cvu-hz-wa" href="${esc(wa)}" target="_blank" rel="noopener">Order on WhatsApp</a>` +
    `<a class="cvu-hz-shop" href="/shop/">Shop online</a></div></div>` +
    `</section>`;

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return { html, faq };
}
