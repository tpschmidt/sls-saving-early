import {Body, Controller, Get, Headers, HttpException, Post} from '@nestjs/common'
import {SSM} from "aws-sdk"
import * as moment from 'moment-timezone'
import {Moment} from 'moment-timezone'
import {StateResponseDto} from "./dto/state-response.dto"
import {LastPayoutResponseDto} from "./dto/last-payout-response.dto"
import {PaymentRequestDto} from "./dto/payment-request.dto"
import {PaymentState} from "./dto/payment-state"
import {Constants} from "./constants";
import Twitter = require('twit');

@Controller()
export class AppController {

    public static readonly TIMESTAMP_FORMAT = 'YYYYMMDDHHmmss'
    public static readonly LOCAL_TIMEZONE = 'Europe/Berlin'

    private ssm: SSM = new SSM({ region: process.env.AWS_REGION })
    private client = new Twitter({
        consumer_key: process.env.TWITTER_CONSUMER_API_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_API_SECRET_KEY,
        access_token: process.env.TWITTER_API_ACCESS_TOKEN,
        access_token_secret: process.env.TWITTER_API_ACCESS_SECRET,
        timeout_ms: 60 * 1000,
        strictSSL: true,
    });

    @Post('internal/tweet-failure')
    async tweetIfMissed(@Headers('x-internal-router-secret') secret: string) {
        if (secret !== Constants.INTERNAL_ROUTER_SECRET) {
            console.log(`Invalid invoke`);
            return
        }
        console.log(`Checking if last confirmation was missed`);
        const { judgementTime, lastTweetPosted, lastPayouts, lastConfirmation, priceToday } = await this.getParameters()
        const state = AppController.getPaymentState(lastPayouts, lastConfirmation, judgementTime)
        const todayMidnight = moment(moment().format('DD/MM/YYYY'), 'DD/MM/YYYY')
        if (state === 'PAYOUT_AVAILABLE' && lastTweetPosted.isBefore(todayMidnight)) {
            console.log(`State is PAYOUT_AVAILABLE and there was no tweet today. Sending tweet [state=${state}, `
                + `lastTweetPosted=${lastTweetPosted.tz(AppController.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}]`)
            return new Promise<any>(resolve => {
                const status = `I horribly failed to get up early today because I'm super lazy 🙋‍♂️. `
                    + `The first to notice this will receive ${priceToday}€ via PayPal at https://${process.env.DOMAIN_NAME} 💸`
                this.ssm.putParameter({
                    Name: `/${process.env.APP_NAME}/last-tweet`,
                    Value: moment.tz('UTC').format(AppController.TIMESTAMP_FORMAT),
                    Overwrite: true
                }).promise()
                    .then(_ => {
                        this.client.post('statuses/update', { status }, (error, response, _) => {
                            if (error) console.log(`Error: ${error}`);
                            console.log(response);
                            resolve(response)
                        })
                    })
            })
        } else {
            console.log(`State is not PAYOUT_AVAILABLE or last tweet was already sent today [state=${state}, `
                + `lastTweetPosted=${lastTweetPosted.tz(AppController.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}]`)
        }
    }

    @Get('api/state')
    async checkState(@Headers('x-api-key') apiKey: string): Promise<StateResponseDto> {
        if (apiKey !== process.env.API_SECRET) throw new HttpException('invalid x-api-key', 401)
        const { judgementTime, priceToday, lastPayouts, lastConfirmation } = await this.getParameters()
        const paymentState = AppController.getPaymentState(lastPayouts, lastConfirmation, judgementTime)
        console.log(`State calculated [judgementTime=${judgementTime.tz(AppController.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}, `
            + `lastConfirmation=${lastConfirmation.tz(AppController.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}, `
            + `priceToday=${priceToday}]`)
        return {
            lastConfirmation: lastConfirmation.tz('UTC').format(AppController.TIMESTAMP_FORMAT),
            judgementTimeToday: judgementTime.tz('UTC').format(AppController.TIMESTAMP_FORMAT),
            paymentState,
            priceToday,
            lastPayouts: lastPayouts.map(lp => {
                lp.paypalAddress = undefined
                return lp
            })
        }
    }

    @Post('api/request-payment')
    async requestPayment(@Headers('x-api-key') apiKey: string,
                         @Body() request: PaymentRequestDto) {
        const { judgementTime, priceToday, lastPayouts, lastConfirmation } = await this.getParameters()
        const paymentState = AppController.getPaymentState(lastPayouts, lastConfirmation, judgementTime)
        if (paymentState !== 'PAYOUT_AVAILABLE') {
            throw new HttpException('No payment slot available', 401)
        }
        lastPayouts.push({
            confirmed: false,
            timestamp: moment().tz('UTC').format(AppController.TIMESTAMP_FORMAT),
            paypalAddress: request.paypalAddress,
            name: request.name,
            value: priceToday
        })
        await this.ssm.putParameter({
            Name: `/${process.env.APP_NAME}/last-payouts`,
            Value: JSON.stringify(lastPayouts),
            Overwrite: true
        }).promise()
    }

    private static getPaymentState(lastPayouts: LastPayoutResponseDto[], lastConfirmation: Moment, judgementTime: Moment): PaymentState {
        const todayMidnight = moment(moment().format('DD/MM/YYYY'), 'DD/MM/YYYY')
        const winnerForToday = !!lastPayouts.find(lp => moment(lp.timestamp, AppController.TIMESTAMP_FORMAT).isAfter(todayMidnight))
        const isBeforeJudgement = moment().utc().isBefore(judgementTime)
        const successfullySkipped = lastConfirmation.isAfter(todayMidnight)
            && judgementTime.isAfter(lastConfirmation)
        console.log(`Payment state checked [lastConfirmation=${lastConfirmation.tz(this.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}, `
            + `judgementTime=${judgementTime.tz(this.LOCAL_TIMEZONE).format(AppController.TIMESTAMP_FORMAT)}, `
            + `winnerForToday=${winnerForToday}, isBeforeJudgement=${isBeforeJudgement}, successfullySkipped=${successfullySkipped}]`)
        switch (true) {
            case successfullySkipped:
                return 'PAYOUT_SKIPPED_TODAY'
            case isBeforeJudgement:
                return 'PAYOUT_POSSIBLE'
            case !winnerForToday:
                return 'PAYOUT_AVAILABLE'
            case winnerForToday:
                return 'PAYOUT_ALREADY_PROCESSED_TODAY'
        }
    }

    private async getParameters(): Promise<{judgementTime: Moment, lastConfirmation: Moment, priceToday: number, lastPayouts: LastPayoutResponseDto[], lastTweetPosted: Moment}> {
        const judgementTime: Moment = moment.tz(process.env.JUDGMENT_TIME_UTC, 'HH:mm', 'UTC')
        const parameters: SSM.GetParametersByPathResult = await this.ssm.getParametersByPath({Path: `/${process.env.APP_NAME}`}).promise()
        const lastConfirmation: Moment  = moment.tz(parameters.Parameters.filter(p => p.Name.endsWith('last-confirmation-time'))[0].Value, AppController.TIMESTAMP_FORMAT, 'UTC')
        const lastTweetPosted: Moment  = moment.tz(parameters.Parameters.filter(p => p.Name.endsWith('last-tweet'))[0].Value, AppController.TIMESTAMP_FORMAT, 'UTC')
        const lastPayouts: LastPayoutResponseDto[] = JSON.parse(parameters.Parameters.filter(p => p.Name.endsWith('last-payouts'))[0].Value)
        const priceTodayParam: SSM.Parameter = parameters.Parameters.filter(p => p.Name.endsWith('price-today'))[0]
        let priceToday = Number(priceTodayParam.Value)
        if (isNaN(Number(priceTodayParam.Value)) || !AppController.isToday(priceTodayParam.LastModifiedDate)) {
            priceToday = AppController.randomPrice(process.env.MIN_PRICE, process.env.MAX_PRICE)
            await this.ssm.putParameter({
                Name: priceTodayParam.Name,
                Value: `${priceToday}`,
                Overwrite: true
            }).promise()
            console.log(`New price calculated & put to SSM [priceToday=${priceToday}]`)
        }
        return { judgementTime, lastConfirmation, lastPayouts, priceToday, lastTweetPosted }
    }

    private static isToday(someDate) {
        const today = new Date()
        return someDate.getDate() == today.getDate() &&
            someDate.getMonth() == today.getMonth() &&
            someDate.getFullYear() == today.getFullYear()
    }

    private static randomPrice(min, max) {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(Math.random() * (max - min + 1)) + min
    }


}
