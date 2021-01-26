export type PaymentState =
    'PAYOUT_ALREADY_PROCESSED_TODAY' | // payout already processed for today: there is a winner
    'PAYOUT_SKIPPED_TODAY' | // payout skipped for today: confirmation was possible
    'PAYOUT_POSSIBLE' | // it's pre judgement time and no confirmation yet
    'PAYOUT_AVAILABLE' // we're pre-judgement time and there's no confirmation yet!
