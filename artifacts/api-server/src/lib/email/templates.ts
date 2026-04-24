export function renderNewsletterHtml(opts: {
  userName: string;
  period: string;
  narrative: string;
  dashboardUrl: string;
}): string {
  const { userName, period, narrative, dashboardUrl } = opts;
  const paragraphs = narrative
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6;">${p}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Ritual Progress — ${period}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">The Ritual AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px 0;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#888888;">${period}</p>
              <h1 style="margin:0 0 28px 0;font-size:24px;font-weight:700;line-height:1.2;">Your progress report${userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
              <hr style="border:none;border-top:1px solid #e8e8e8;margin:0 0 28px 0;">
              <div style="font-size:15px;color:#1a1a1a;">
                ${paragraphs}
              </div>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
                <tr>
                  <td style="background:#1a1a1a;border-radius:6px;padding:14px 28px;">
                    <a href="${dashboardUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.3px;">View full dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f5f4f2;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.5;">
                You are receiving this because you have an active Ritual AI account.<br>
                Reply to this email to update your goals or log a check-in.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderMagicLinkHtml(opts: {
  reviewUrl: string;
  date: string;
}): string {
  const { reviewUrl, date } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your review link</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">The Ritual AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;">Review your progress for ${date}</h1>
              <p style="margin:0 0 28px 0;font-size:15px;color:#555555;line-height:1.6;">Click the button below to open your secure review dashboard. This link is valid for 7 days.</p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#1a1a1a;border-radius:6px;padding:14px 28px;">
                    <a href="${reviewUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.3px;">Open review</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:12px;color:#888888;">Or copy this URL: ${reviewUrl}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
