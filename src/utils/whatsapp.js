export function shareToWhatsApp(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

export function sendWhatsAppTo(phone, text) {
  if (!phone) return alert("Phone number missing!");
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const finalPhone = cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone;
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${finalPhone}?text=${encoded}`, "_blank");
}
