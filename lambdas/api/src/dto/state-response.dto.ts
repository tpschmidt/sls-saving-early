import {LastPayoutResponseDto} from "./last-payout-response.dto";
import {PaymentState} from "./payment-state";

export class StateResponseDto {


    /**
     * Confirmation timestamp.
     */
    lastConfirmation: string

    /**
     * Validation whether there is a payment available or not not.
     */
    paymentState: PaymentState

    /**
     * Judgment time. After this time there no confirmation possible anymore. Game is lost :)
     */
    judgementTimeToday: string

    /**
     * Price of today.
     */
    priceToday: number

    /**
     * Last payed out penalties.
     */
    lastPayouts: LastPayoutResponseDto[]
}
