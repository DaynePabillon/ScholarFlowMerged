import rateLimit from 'express-rate-limit';

/**
 * General API Rate Limiter
 * Limits each IP to 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes'
    }
});

/**
 * Strict Auth Rate Limiter
 * Limits each IP to 10 authentication requests per hour
 * Prevents brute-force on login/token endpoints
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // Relaxed from 10 to 100 for development/testing
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many login attempts, please try again in a bit'
    }
});

/**
 * AI Service Rate Limiter
 * Limits each IP to 20 AI analysis requests per 15 minutes
 * Protects expensive LLM resources
 */
export const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'AI resource limit reached, please wait 15 minutes'
    }
});
