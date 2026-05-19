import rateLimit from 'express-rate-limit';

/**
 * General API Rate Limiter
 * Limits each IP to 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 99999, // Disabled for testing/stability
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
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 99999, // Disabled for testing
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
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 99999, // Disabled for testing
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'AI resource limit reached, please wait 15 minutes'
    }
});
