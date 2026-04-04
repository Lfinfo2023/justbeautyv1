export const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const escapeIcsText = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const renderMailShell = ({ title, eyebrow, intro, details, closing, cta, logoUrl }) => `
  <div style="margin:0;padding:32px;background:#f8f1ec;font-family:Georgia,'Times New Roman',serif;color:#453530;">
    <div style="max-width:640px;margin:0 auto;background:#fffaf7;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(91,67,57,0.12);border:1px solid #efddd2;">
      <div style="padding:28px 36px;background:linear-gradient(135deg,#ead2c5 0%,#f7ece6 100%);">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Just Beauty" style="width:68px;height:68px;border-radius:999px;object-fit:cover;border:1px solid #efddd2;display:block;margin-bottom:16px;" />` : ""}
        <div style="font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:#8d6e63;margin-bottom:12px;">${escapeHtml(eyebrow)}</div>
        <div style="font-size:34px;line-height:1.15;color:#4d382f;font-weight:700;">${escapeHtml(title)}</div>
      </div>
      <div style="padding:32px 36px;">
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#5d4941;">${escapeHtml(intro)}</p>
        <div style="background:#fbf4ef;border:1px solid #efddd2;border-radius:18px;padding:18px 20px;margin:0 0 24px;">
          ${details.map((detail) => `<div style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#5b4339;"><strong style="color:#4d382f;">${escapeHtml(detail.label)}:</strong> ${escapeHtml(detail.value)}</div>`).join("")}
        </div>
        ${cta ? `<div style="margin:0 0 24px;">${cta}</div>` : ""}
        <p style="margin:0;font-size:15px;line-height:1.8;color:#6f5a52;">${escapeHtml(closing)}</p>
      </div>
    </div>
  </div>
`;

export const renderActionPage = ({ title, message, actionLabel }) => `
  <!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin:0; font-family: Georgia, "Times New Roman", serif; background:#f8f1ec; color:#453530; }
        .wrap { max-width:720px; margin:48px auto; padding:0 20px; }
        .card { background:#fffaf7; border:1px solid #efddd2; border-radius:28px; overflow:hidden; box-shadow:0 12px 40px rgba(91,67,57,0.12); }
        .hero { padding:28px 36px; background:linear-gradient(135deg,#ead2c5 0%,#f7ece6 100%); }
        .eyebrow { font-size:12px; letter-spacing:.35em; text-transform:uppercase; color:#8d6e63; margin-bottom:12px; }
        .title { font-size:34px; line-height:1.15; color:#4d382f; font-weight:700; }
        .body { padding:32px 36px; }
        .message { font-size:17px; line-height:1.8; color:#5d4941; margin:0 0 24px; }
        .cta { display:inline-block; text-decoration:none; background:#b67d6c; color:#fffaf7; padding:14px 20px; border-radius:999px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="hero">
            <div class="eyebrow">Just Beauty</div>
            <div class="title">${escapeHtml(title)}</div>
          </div>
          <div class="body">
            <p class="message">${escapeHtml(message)}</p>
            <a class="cta" href="${escapeHtml(actionLabel.href)}">${escapeHtml(actionLabel.label)}</a>
          </div>
        </div>
      </div>
    </body>
  </html>
`;
