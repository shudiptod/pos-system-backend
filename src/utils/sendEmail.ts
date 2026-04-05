import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOrderConfirmationEmail = async (
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    totalAmount: string,
    paymentMethod: string
) => {
    try {
        if (!customerEmail) return; 

        await resend.emails.send({
            from: "Your Store <hello@optiforgelabs.com>",
            to: [customerEmail],
            subject: `Order Confirmation - #${orderNumber}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>Thank you for your order, ${customerName}!</h2>
                    <p>Your order <strong>#${orderNumber}</strong> has been successfully placed.</p>
                    <p><strong>Total Amount:</strong> ৳${totalAmount}</p>
                    <p><strong>Payment Method:</strong> ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
                    <hr />
                    <p>We will notify you once your order is shipped.</p>
                </div>
            `,
        });
        console.log(`Order email sent to ${customerEmail}`);
    } catch (error) {
        console.error("Failed to send Resend email:", error);
    }
};