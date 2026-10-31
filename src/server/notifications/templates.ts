import type { NotificationType } from "@/server/modules/repairs/state-machine";

/**
 * Customer-safe message templates (FR-NOTIF-06: no internal notes, minimal personal data).
 * `{reference}` etc. are filled from the event payload. Hindi copy is a first draft for review.
 * WhatsApp will need provider-approved templates; these strings are the source text for them.
 */
type Template = { title: string; body: string };
type Locale = "en" | "hi";

export const TEMPLATES: Record<NotificationType, Record<Locale, Template>> = {
  "booking.submitted": {
    en: { title: "Booking {reference} received", body: "We have received your repair booking. Our team will confirm it shortly." },
    hi: { title: "बुकिंग {reference} प्राप्त हुई", body: "हमें आपकी रिपेयर बुकिंग मिल गई है। हमारी टीम जल्द ही इसकी पुष्टि करेगी।" },
  },
  "booking.confirmed": {
    en: { title: "Booking {reference} confirmed", body: "Your repair booking is confirmed. {slot}" },
    hi: { title: "बुकिंग {reference} की पुष्टि हुई", body: "आपकी रिपेयर बुकिंग की पुष्टि हो गई है। {slot}" },
  },
  "booking.declined": {
    en: { title: "Booking {reference} could not be accepted", body: "Reason: {reason}" },
    hi: { title: "बुकिंग {reference} स्वीकार नहीं की जा सकी", body: "कारण: {reason}" },
  },
  "booking.needs_info": {
    en: { title: "More details needed for {reference}", body: "{reason} Please reply from your bookings page." },
    hi: { title: "{reference} के लिए अधिक जानकारी चाहिए", body: "{reason} कृपया अपने बुकिंग पेज से जवाब दें।" },
  },
  "booking.rescheduled": {
    en: { title: "Booking {reference} rescheduled", body: "New appointment: {slot}. Reason: {reason}" },
    hi: { title: "बुकिंग {reference} का समय बदला गया", body: "नया समय: {slot}। कारण: {reason}" },
  },
  "booking.cancelled": {
    en: { title: "Booking {reference} cancelled", body: "Your repair booking has been cancelled." },
    hi: { title: "बुकिंग {reference} रद्द की गई", body: "आपकी रिपेयर बुकिंग रद्द कर दी गई है।" },
  },
  "job.device_received": {
    en: { title: "We have your device ({reference})", body: "Your device has been received and will be inspected next." },
    hi: { title: "आपका डिवाइस हमें मिल गया ({reference})", body: "आपका डिवाइस प्राप्त हो गया है, अब इसकी जाँच की जाएगी।" },
  },
  "job.repair_started": {
    en: { title: "Repair started ({reference})", body: "Our technician has started work on your device." },
    hi: { title: "रिपेयर शुरू ({reference})", body: "हमारे तकनीशियन ने आपके डिवाइस पर काम शुरू कर दिया है।" },
  },
  "job.on_hold": {
    en: { title: "Repair on hold ({reference})", body: "{reason}" },
    hi: { title: "रिपेयर रोकी गई ({reference})", body: "{reason}" },
  },
  "job.ready_for_return": {
    en: { title: "Your device is ready ({reference})", body: "Your device is ready to be returned. We will coordinate the handover." },
    hi: { title: "आपका डिवाइस तैयार है ({reference})", body: "आपका डिवाइस वापसी के लिए तैयार है। हम हैंडओवर का समन्वय करेंगे।" },
  },
  "job.completed": {
    en: { title: "Repair {reference} completed", body: "Your device has been handed over. Thank you for choosing Technentium." },
    hi: { title: "रिपेयर {reference} पूरी हुई", body: "आपका डिवाइस सौंप दिया गया है। Technentium चुनने के लिए धन्यवाद।" },
  },
  "quote.sent": {
    en: { title: "Quote ready for {reference}", body: "Total {total}. Please review and approve or decline by {expires}." },
    hi: { title: "{reference} के लिए कोटेशन तैयार", body: "कुल {total}। कृपया {expires} तक समीक्षा करके स्वीकार या अस्वीकार करें।" },
  },
  "quote.reminder": {
    en: { title: "Reminder: quote for {reference}", body: "Your quote expires on {expires}. Please approve or decline." },
    hi: { title: "रिमाइंडर: {reference} का कोटेशन", body: "आपका कोटेशन {expires} को समाप्त होगा। कृपया स्वीकार या अस्वीकार करें।" },
  },
  "quote.approved": {
    en: { title: "Quote approved ({reference})", body: "Thank you. We will begin the repair." },
    hi: { title: "कोटेशन स्वीकृत ({reference})", body: "धन्यवाद। हम रिपेयर शुरू करेंगे।" },
  },
  "quote.declined": {
    en: { title: "Quote declined ({reference})", body: "No repair work will be done. We will arrange the return of your device." },
    hi: { title: "कोटेशन अस्वीकृत ({reference})", body: "कोई रिपेयर नहीं की जाएगी। हम आपके डिवाइस की वापसी की व्यवस्था करेंगे।" },
  },
  "quote.expired": {
    en: { title: "Quote expired ({reference})", body: "We did not receive a decision in time. Our team will contact you." },
    hi: { title: "कोटेशन समाप्त ({reference})", body: "हमें समय पर निर्णय नहीं मिला। हमारी टीम आपसे संपर्क करेगी।" },
  },
  "order.submitted": {
    en: { title: "Order request {reference} received", body: "This is a request, not a confirmed or paid order. We will check availability and shipping, then confirm with you." },
    hi: { title: "ऑर्डर अनुरोध {reference} प्राप्त हुआ", body: "यह एक अनुरोध है, पुष्टि या भुगतान किया गया ऑर्डर नहीं। हम उपलब्धता और शिपिंग जाँचकर आपसे पुष्टि करेंगे।" },
  },
  "order.confirmed": {
    en: { title: "Order {reference} confirmed", body: "Your order is confirmed. Total: {total}. {reason}" },
    hi: { title: "ऑर्डर {reference} की पुष्टि हुई", body: "आपके ऑर्डर की पुष्टि हो गई है। कुल: {total}। {reason}" },
  },
  "order.declined": {
    en: { title: "Order request {reference} could not be accepted", body: "Reason: {reason}" },
    hi: { title: "ऑर्डर अनुरोध {reference} स्वीकार नहीं किया जा सका", body: "कारण: {reason}" },
  },
  "order.shipped": {
    en: { title: "Order {reference} shipped", body: "Your order is on its way. {reason}" },
    hi: { title: "ऑर्डर {reference} भेज दिया गया", body: "आपका ऑर्डर रास्ते में है। {reason}" },
  },
  "order.completed": {
    en: { title: "Order {reference} completed", body: "Your order is complete. Thank you for choosing Technentium." },
    hi: { title: "ऑर्डर {reference} पूरा हुआ", body: "आपका ऑर्डर पूरा हो गया है। Technentium चुनने के लिए धन्यवाद।" },
  },
  "order.cancelled": {
    en: { title: "Order request {reference} cancelled", body: "{reason}" },
    hi: { title: "ऑर्डर अनुरोध {reference} रद्द किया गया", body: "{reason}" },
  },
  "order.updated": {
    en: { title: "Update on order {reference}", body: "{reason}" },
    hi: { title: "ऑर्डर {reference} पर अपडेट", body: "{reason}" },
  },
  "custom.submitted": {
    en: { title: "Design request {reference} received", body: "Our team will review your design and confirm feasibility and price." },
    hi: { title: "डिज़ाइन अनुरोध {reference} प्राप्त हुआ", body: "हमारी टीम आपके डिज़ाइन की समीक्षा करके संभावना और कीमत की पुष्टि करेगी।" },
  },
  "custom.needs_info": {
    en: { title: "More details needed for {reference}", body: "{reason} Please reply from your design requests page." },
    hi: { title: "{reference} के लिए अधिक जानकारी चाहिए", body: "{reason} कृपया अपने डिज़ाइन अनुरोध पेज से जवाब दें।" },
  },
  "custom.quote_shared": {
    en: { title: "Price shared for {reference}", body: "Price: {total}. {reason}" },
    hi: { title: "{reference} के लिए कीमत भेजी गई", body: "कीमत: {total}। {reason}" },
  },
  "custom.updated": {
    en: { title: "Update on design request {reference}", body: "Status: {status}. {reason}" },
    hi: { title: "डिज़ाइन अनुरोध {reference} पर अपडेट", body: "स्थिति: {status}। {reason}" },
  },
  "custom.completed": {
    en: { title: "Your custom design {reference} is ready", body: "{reason}" },
    hi: { title: "आपका कस्टम डिज़ाइन {reference} तैयार है", body: "{reason}" },
  },
  "custom.declined": {
    en: { title: "Design request {reference} could not be accepted", body: "Reason: {reason}" },
    hi: { title: "डिज़ाइन अनुरोध {reference} स्वीकार नहीं किया जा सका", body: "कारण: {reason}" },
  },
};

export function render(type: NotificationType, locale: string, params: Record<string, string>): Template {
  const t = TEMPLATES[type][locale === "hi" ? "hi" : "en"];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "").trim();
  return { title: fill(t.title), body: fill(t.body) };
}
