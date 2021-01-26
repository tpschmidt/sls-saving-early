import {IsEmail} from "class-validator";

export class PaymentRequestDto {
    name?: string
    @IsEmail()
    paypalAddress: string
}
