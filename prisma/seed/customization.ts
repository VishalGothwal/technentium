import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Sample design catalogue and finish/coverage options (illustrative prices — confirm with the Owner).
 * Option slugs are referenced by the preview renderer (finish: matte/gloss/metallic/carbon/leather;
 * coverage: back/camera/sides/full). Idempotent: safe to re-run.
 */

type DesignSeed = {
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  collection: string;
  style: { pattern: string; palette: string[]; density: number; angle: number };
  basePricePaise: number;
  featured?: boolean;
};

const DESIGNS: DesignSeed[] = [
  { slug: "midnight-mono", nameEn: "Midnight Mono", nameHi: "मिडनाइट मोनो", descriptionEn: "A deep, quiet black that lets your device's lines speak.", descriptionHi: "गहरा, शांत काला रंग जो आपके डिवाइस की बनावट को उभारता है।", collection: "minimal", style: { pattern: "solid", palette: ["#14161c", "#2b2f3a"], density: 5, angle: 45 }, basePricePaise: 49900 },
  { slug: "chalk-grid", nameEn: "Chalk Grid", nameHi: "चॉक ग्रिड", descriptionEn: "Architectural grid lines with a few bold blocks of colour.", descriptionHi: "आर्किटेक्चरल ग्रिड लाइनें और कुछ रंगीन ब्लॉक।", collection: "minimal", style: { pattern: "grid", palette: ["#f4f1ea", "#d8d2c4", "#e4572e", "#29335c", "#f3a712"], density: 4, angle: 0 }, basePricePaise: 59900, featured: true },
  { slug: "paper-dots", nameEn: "Paper Dots", nameHi: "पेपर डॉट्स", descriptionEn: "Soft halftone dots fading across warm paper.", descriptionHi: "गर्म कागज़ पर धीरे-धीरे फीके होते हाफ़टोन डॉट्स।", collection: "minimal", style: { pattern: "dots", palette: ["#f7f3ec", "#1f2933"], density: 6, angle: 0 }, basePricePaise: 54900 },
  { slug: "monsoon-waves", nameEn: "Monsoon Waves", nameHi: "मानसून लहरें", descriptionEn: "Rolling teal waves inspired by the first rains.", descriptionHi: "पहली बारिश से प्रेरित लहराती नीली-हरी लहरें।", collection: "nature", style: { pattern: "waves", palette: ["#0b3c49", "#1b998b", "#2ec4b6", "#cbf3f0", "#147d74"], density: 5, angle: 0 }, basePricePaise: 64900, featured: true },
  { slug: "aravalli-contours", nameEn: "Aravalli Contours", nameHi: "अरावली कंटूर", descriptionEn: "Topographic lines tracing the hills around Jaipur.", descriptionHi: "जयपुर के आसपास की पहाड़ियों की टोपोग्राफ़िक रेखाएँ।", collection: "nature", style: { pattern: "topo", palette: ["#2d2a26", "#c08552", "#e6b89c", "#8c5e3c"], density: 4, angle: 0 }, basePricePaise: 64900, featured: true },
  { slug: "forest-floor", nameEn: "Forest Floor", nameHi: "फ़ॉरेस्ट फ़्लोर", descriptionEn: "Layered greens like moss after the monsoon.", descriptionHi: "मानसून के बाद काई जैसी हरी परतें।", collection: "nature", style: { pattern: "blobs", palette: ["#1b2d1f", "#386641", "#6a994e", "#a7c957", "#2f3e46"], density: 6, angle: 0 }, basePricePaise: 59900 },
  { slug: "pink-city-terrazzo", nameEn: "Pink City Terrazzo", nameHi: "पिंक सिटी टेराज़ो", descriptionEn: "Terrazzo chips in sandstone pink, saffron and indigo.", descriptionHi: "बलुआ पत्थर गुलाबी, केसरिया और नील रंग के टेराज़ो टुकड़े।", collection: "abstract", style: { pattern: "terrazzo", palette: ["#f2d0c4", "#d1495b", "#edae49", "#00798c", "#30638e"], density: 5, angle: 0 }, basePricePaise: 69900, featured: true },
  { slug: "neon-blobs", nameEn: "Neon Bloom", nameHi: "नियॉन ब्लूम", descriptionEn: "Electric colour fields melting into each other.", descriptionHi: "एक-दूसरे में घुलते चमकीले रंग।", collection: "abstract", style: { pattern: "blobs", palette: ["#120c2c", "#ff006e", "#8338ec", "#3a86ff", "#ffbe0b"], density: 7, angle: 0 }, basePricePaise: 69900, featured: true },
  { slug: "bauhaus-checks", nameEn: "Bauhaus Checks", nameHi: "बाउहाउस चेक्स", descriptionEn: "Tilted checkerboard in primary colours.", descriptionHi: "प्राथमिक रंगों में तिरछा चेकरबोर्ड।", collection: "abstract", style: { pattern: "checker", palette: ["#f1faee", "#e63946", "#1d3557", "#f4a261"], density: 3, angle: 18 }, basePricePaise: 59900 },
  { slug: "sunset-gradient", nameEn: "Thar Sunset", nameHi: "थार सनसेट", descriptionEn: "A desert sunset from saffron to violet.", descriptionHi: "केसरिया से बैंगनी तक रेगिस्तान का सूर्यास्त।", collection: "gradient", style: { pattern: "gradient", palette: ["#ff9e00", "#ff4d6d", "#7b2cbf", "#240046"], density: 5, angle: 120 }, basePricePaise: 54900, featured: true },
  { slug: "aurora-gradient", nameEn: "Aurora", nameHi: "ऑरोरा", descriptionEn: "Cool northern-light gradient in mint and blue.", descriptionHi: "मिंट और नीले रंग का ठंडा ग्रेडिएंट।", collection: "gradient", style: { pattern: "gradient", palette: ["#03045e", "#0077b6", "#00b4d8", "#90e0ef", "#caf0f8"], density: 5, angle: 200 }, basePricePaise: 54900 },
  { slug: "peach-fuzz", nameEn: "Peach Fuzz", nameHi: "पीच फ़ज़", descriptionEn: "Soft peach to cream, calm and warm.", descriptionHi: "हल्का पीच से क्रीम, शांत और गर्म।", collection: "gradient", style: { pattern: "gradient", palette: ["#ffb4a2", "#ffcdb2", "#fff1e6"], density: 5, angle: 60 }, basePricePaise: 49900 },
  { slug: "type-wall", nameEn: "Type Wall", nameHi: "टाइप वॉल", descriptionEn: "Bold repeating letters for a poster-like back.", descriptionHi: "पोस्टर जैसे लुक के लिए दोहराए गए बोल्ड अक्षर।", collection: "typography", style: { pattern: "letters", palette: ["#111111", "#f5f5f5", "#ffd400"], density: 4, angle: 0 }, basePricePaise: 64900 },
  { slug: "signal-stripes", nameEn: "Signal Stripes", nameHi: "सिग्नल स्ट्राइप्स", descriptionEn: "Racing stripes on a diagonal.", descriptionHi: "तिरछी रेसिंग धारियाँ।", collection: "retro", style: { pattern: "stripes", palette: ["#fefae0", "#bc6c25", "#dda15e", "#283618"], density: 4, angle: 35 }, basePricePaise: 59900 },
  { slug: "retro-sunburst", nameEn: "Retro Sunburst", nameHi: "रेट्रो सनबर्स्ट", descriptionEn: "Seventies sunrise with warm rays.", descriptionHi: "गर्म किरणों के साथ सत्तर के दशक का सूर्योदय।", collection: "retro", style: { pattern: "sunburst", palette: ["#fff3b0", "#e09f3e", "#f5d491", "#9e2a2b", "#540b0e"], density: 5, angle: 0 }, basePricePaise: 64900, featured: true },
  { slug: "disco-chevron", nameEn: "Disco Chevron", nameHi: "डिस्को शेवरॉन", descriptionEn: "Zig-zag bands with a dance-floor attitude.", descriptionHi: "डांस-फ़्लोर अंदाज़ वाली ज़िग-ज़ैग पट्टियाँ।", collection: "retro", style: { pattern: "chevron", palette: ["#22223b", "#f2e9e4", "#c9ada7", "#9a8c98", "#ff8fab"], density: 5, angle: 0 }, basePricePaise: 59900 },
];

const FINISHES = [
  { slug: "matte", nameEn: "Matte", nameHi: "मैट", descriptionEn: "Soft-touch, fingerprint resistant.", descriptionHi: "मुलायम, उंगलियों के निशान कम।", priceDeltaPaise: 0 },
  { slug: "gloss", nameEn: "Gloss", nameHi: "ग्लॉस", descriptionEn: "Vivid colours with a glassy shine.", descriptionHi: "चमकदार, गहरे रंग।", priceDeltaPaise: 0 },
  { slug: "metallic", nameEn: "Metallic", nameHi: "मेटैलिक", descriptionEn: "Brushed metal sheen.", descriptionHi: "ब्रश्ड मेटल जैसी चमक।", priceDeltaPaise: 15000 },
  { slug: "carbon", nameEn: "Carbon fibre texture", nameHi: "कार्बन फ़ाइबर टेक्सचर", descriptionEn: "Raised weave texture with extra grip.", descriptionHi: "बेहतर पकड़ के लिए उभरा बुनावट टेक्सचर।", priceDeltaPaise: 20000 },
  { slug: "leather", nameEn: "Leather texture", nameHi: "लेदर टेक्सचर", descriptionEn: "Grained, warm leather-like feel.", descriptionHi: "चमड़े जैसा दानेदार, गर्म एहसास।", priceDeltaPaise: 30000 },
];

const COVERAGES = [
  { slug: "back", nameEn: "Back only", nameHi: "केवल पीछे", descriptionEn: "Covers the back panel.", descriptionHi: "पीछे का पैनल कवर करता है।", priceDeltaPaise: 0 },
  { slug: "camera", nameEn: "Back + camera ring", nameHi: "पीछे + कैमरा रिंग", descriptionEn: "Adds a wrap around the camera bump.", descriptionHi: "कैमरा बम्प के चारों ओर भी कवर।", priceDeltaPaise: 9900 },
  { slug: "sides", nameEn: "Back + sides", nameHi: "पीछे + किनारे", descriptionEn: "Wraps the edges for a seamless look.", descriptionHi: "बिना जोड़ के लुक के लिए किनारे भी कवर।", priceDeltaPaise: 19900 },
  { slug: "full", nameEn: "Full wrap", nameHi: "फ़ुल रैप", descriptionEn: "Back, sides and camera ring.", descriptionHi: "पीछे, किनारे और कैमरा रिंग।", priceDeltaPaise: 34900 },
];

export async function seedCustomization(db: PrismaClient) {
  let order = 0;
  for (const d of DESIGNS) {
    const data = { ...d, featured: d.featured ?? false, sortOrder: order++ };
    // Only create: once the Owner edits a design in the admin, re-seeding must not overwrite it.
    await db.design.upsert({ where: { slug: d.slug }, create: data, update: {} });
  }
  for (const [kind, list] of [["FINISH", FINISHES], ["COVERAGE", COVERAGES]] as const) {
    let o = 0;
    for (const opt of list) {
      await db.designOption.upsert({ where: { kind_slug: { kind, slug: opt.slug } }, create: { ...opt, kind, sortOrder: o++ }, update: {} });
    }
  }
}
