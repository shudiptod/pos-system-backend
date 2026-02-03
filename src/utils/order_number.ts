// utils/order-id.ts

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No confusing chars (0, O, 1, I, L)

export function generateOrderNumber(): string {
    const now = new Date();

    // 1. Get YY (Year)
    const year = now.getFullYear().toString().slice(-2);

    // 2. Get DDD (Day of Year)
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now.valueOf() - start.valueOf()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const dayString = dayOfYear.toString().padStart(3, '0');

    // 3. Get XXXX (Random 4 chars)
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
        randomPart += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }

    // Format: 26034-XJ92 (Year 26, Day 034)
    return `${year}${dayString}-${randomPart}`;
}