const APP_URL = "https://hkm-festival-app.web.app";
const APP_FOOTER = `

━━━━━━━━━━━━━━━━
_Sent from HKM Festival App_

Open App:
${APP_URL}

Hare Krishna`;

export function shareToWhatsApp(text) {
  const finalText = text + APP_FOOTER;
  const encoded = encodeURIComponent(finalText);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

export function sendWhatsAppTo(phone, text) {
  if (!phone) return alert("Phone number missing!");
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const finalPhone = cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone;
  const finalText = text + APP_FOOTER;
  const encoded = encodeURIComponent(finalText);
  window.open(`https://wa.me/${finalPhone}?text=${encoded}`, "_blank");
}
