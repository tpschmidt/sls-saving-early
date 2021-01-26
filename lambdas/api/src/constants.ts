import * as crypto from 'crypto'

export class Constants {

    public static readonly INTERNAL_ROUTER_SECRET = crypto.randomBytes(20).toString('hex')

}
