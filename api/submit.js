// Vercel Serverless Function — يستقبل طلب الـ onboarding ويرسل إيميل عبر Resend
// كل القيم الحساسة من Environment Variables (إعدادات Vercel) — لا تُكتب في الكود أبداً.

const { Resend } = require('resend');

// خريطة أسماء المنصات للعرض في الإيميل
const PLATFORM_LABELS = {
  wordpress: 'WordPress',
  salla: 'سلة',
  zid: 'زد',
  shopify: 'شوبيفاي',
  other: 'منصة أخرى',
};

module.exports = async (req, res) => {
  // نقبل POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { field, platform, other_platform, site_url, phone, email } = body;

    // تحقق من الحقول المطلوبة
    if (!field || !platform || !site_url || !phone || !email) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const platformLabel = PLATFORM_LABELS[platform] || platform;
    const platformLine = platform === 'other' && other_platform
      ? `${platformLabel} (${other_platform})`
      : platformLabel;

    // محتوى الإيميل
    const html = `
      <div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;max-width:560px;margin:auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
        <div style="background:#07091c;color:#d4aa4e;padding:20px 24px;font-size:20px;font-weight:bold;">📩 طلب جديد — مقالاتي SEO</div>
        <div style="padding:24px;color:#222;font-size:15px;line-height:2;">
          <p style="margin:0 0 16px;color:#666;">وصلك طلب جديد، تواصل مع العميل بأسرع وقت:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#888;width:130px;">المجال</td><td style="padding:8px 0;font-weight:bold;">${esc(field)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;">المنصة</td><td style="padding:8px 0;font-weight:bold;">${esc(platformLine)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;">رابط الموقع</td><td style="padding:8px 0;font-weight:bold;"><a href="${esc(site_url)}" style="color:#d4aa4e;">${esc(site_url)}</a></td></tr>
            <tr><td style="padding:8px 0;color:#888;">الجوال (واتساب)</td><td style="padding:8px 0;font-weight:bold;"><a href="https://wa.me/${waNumber(phone)}" style="color:#d4aa4e;">${esc(phone)}</a></td></tr>
            <tr><td style="padding:8px 0;color:#888;">البريد</td><td style="padding:8px 0;font-weight:bold;"><a href="mailto:${esc(email)}" style="color:#d4aa4e;">${esc(email)}</a></td></tr>
          </table>
        </div>
      </div>`;

    const text = `طلب جديد — مقالاتي SEO\n\nالمجال: ${field}\nالمنصة: ${platformLine}\nرابط الموقع: ${site_url}\nالجوال: ${phone}\nالبريد: ${email}`;

    const { error } = await resend.emails.send({
      // FROM_EMAIL لازم يكون من دومين موثّق في Resend، أو onboarding@resend.dev للتجربة
      from: process.env.FROM_EMAIL || 'مقالاتي SEO <onboarding@resend.dev>',
      to: process.env.NOTIFY_EMAIL,        // إيميل الاستقبال (وين توصلك الطلبات)
      replyTo: email,                       // الرد يروح مباشرة للعميل
      subject: `📩 طلب جديد: ${field}`,
      text,
      html,
    });

    if (error) {
      console.error('resend error:', error);
      return res.status(500).json({ error: 'فشل الإرسال' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send error:', err);
    return res.status(500).json({ error: 'فشل الإرسال' });
  }
};

// تنظيف النص من HTML
function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// تحويل رقم الجوال لصيغة واتساب (إزالة غير الأرقام، تحويل 05 → 9665)
function waNumber(p = '') {
  let n = String(p).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('05')) n = '966' + n.slice(1);
  else if (n.startsWith('5') && n.length === 9) n = '966' + n;
  return n;
}
