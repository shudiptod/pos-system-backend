// Colors matching your Dark/Green theme
const THEME = {
    bg: "#111111",           // Main dark background
    card: "#1a1a1a",         // Slightly lighter card bg
    text: "#ffffff",
    textMuted: "#a1a1aa",
    accent: "#22c55e",       // Your 'brand-green' (Adjust hex if needed)
    border: "#333333"
};

export const getOrderConfirmationEmail = (order: any) => {
    // 1. Generate Items HTML
    const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid ${THEME.border};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="60" valign="top">
              <img src="${item.image}" alt="${item.name}" width="60" height="60" style="border-radius: 8px; object-fit: cover; background-color: #333;" />
            </td>
            <td style="padding-left: 16px; vertical-align: middle;">
              <p style="margin: 0; color: ${THEME.text}; font-size: 14px; font-weight: 600;">${item.name}</p>
              <p style="margin: 4px 0 0; color: ${THEME.textMuted}; font-size: 12px;">${item.variantName || 'Standard'}</p>
            </td>
            <td align="right" style="vertical-align: middle; white-space: nowrap;">
              <p style="margin: 0; color: ${THEME.text}; font-size: 14px;">${item.quantity} x ৳${item.price}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

    // 2. Return Full HTML
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${THEME.bg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${THEME.bg}; padding: 40px 0;">
    <tr>
      <td align="center">
        
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${THEME.card}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://via.placeholder.com/150x50/22c55e/ffffff?text=MMH+STATION" alt="MMH Station 25" style="height: 40px; margin-bottom: 20px;" />
              <h1 style="margin: 0; color: ${THEME.text}; font-size: 24px; letter-spacing: -0.5px;">Thanks for your order!</h1>
              <p style="margin: 10px 0 0; color: ${THEME.textMuted}; font-size: 16px;">Order #${order.id.slice(0, 8).toUpperCase()}</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 0 40px;">
              <div style="height: 2px; width: 100%; background-color: ${THEME.accent}; border-radius: 2px;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-top: 10px; color: ${THEME.textMuted}; font-size: 14px;">Subtotal</td>
                  <td align="right" style="padding-top: 10px; color: ${THEME.text}; font-size: 14px;">৳${order.subtotal}</td>
                </tr>
                <tr>
                  <td style="padding-top: 10px; color: ${THEME.textMuted}; font-size: 14px;">Shipping</td>
                  <td align="right" style="padding-top: 10px; color: ${THEME.text}; font-size: 14px;">৳${order.shippingCost}</td>
                </tr>
                <tr>
                  <td style="padding-top: 20px; border-top: 2px solid ${THEME.border}; margin-top: 10px; color: ${THEME.text}; font-size: 18px; font-weight: bold;">Total</td>
                  <td align="right" style="padding-top: 20px; border-top: 2px solid ${THEME.border}; margin-top: 10px; color: ${THEME.accent}; font-size: 24px; font-weight: bold;">৳${order.total}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #222222; padding: 30px 40px;">
              <h3 style="margin: 0 0 15px; color: ${THEME.text}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Shipping To</h3>
              <p style="margin: 0; color: ${THEME.textMuted}; font-size: 14px; line-height: 1.6;">
                ${order.customerName}<br>
                ${order.address}<br>
                ${order.phone}
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 40px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}" style="display: inline-block; background-color: ${THEME.accent}; color: #000000; padding: 14px 32px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 50px;">
                Track Your Order
              </a>
            </td>
          </tr>

          <tr>
            <td style="background-color: ${THEME.bg}; padding: 30px 40px; text-align: center; border-top: 1px solid ${THEME.border};">
              <p style="margin: 0; color: ${THEME.textMuted}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} MMH Station 25. All rights reserved.<br>
                Dhaka, Bangladesh
              </p>
              <div style="margin-top: 15px;">
                <a href="#" style="color: ${THEME.textMuted}; margin: 0 10px; text-decoration: none; font-size: 12px;">Facebook</a>
                <a href="#" style="color: ${THEME.textMuted}; margin: 0 10px; text-decoration: none; font-size: 12px;">Instagram</a>
              </div>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};