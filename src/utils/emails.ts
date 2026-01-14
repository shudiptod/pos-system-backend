import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to: string, subject: string, html: string) => {
    if (!process.env.RESEND_API_KEY) {
        console.error("Resend API Key missing");
        return;
    }

    try {
        const data = await resend.emails.send({
            from: 'Gajitto <no-reply@gajittobd.com>', // You need to verify a domain on Resend
            to,
            subject,
            html,
        });
        return data;
    } catch (error) {
        console.error("Failed to send email:", error);
        // Don't throw error to prevent crashing the whole request if email fails
    }
};