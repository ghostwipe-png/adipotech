-- Table for tracking user subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    paystack_customer_code TEXT UNIQUE,
    paystack_subscription_code TEXT UNIQUE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'free', -- 'free', 'active', 'past_due', 'suspended', 'cancelled'
    current_period_end DATETIME,
    grace_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for webhook logs to prevent replay attacks and debug payment issues
CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY, -- Paystack event ID
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);