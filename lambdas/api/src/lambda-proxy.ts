import {Server} from 'http'
import {Context} from 'aws-lambda'
import * as serverlessExpress from 'aws-serverless-express'
import * as express from 'express'
import {Express} from 'express'
import * as moment from 'moment'
import {NestFactory} from "@nestjs/core"
import {AppModule} from "./app.module"
import {ExpressAdapter} from "@nestjs/platform-express"
import {ValidationPipe} from "@nestjs/common";
import {Constants} from "./constants";

const current = moment()
let lambdaProxy: Server

function isCloudWatchTrigger(event: any): boolean {
    return event?.resources?.length > 0
        && new RegExp(`arn:aws:events:${process.env.AWS_REGION}:${process.env.ACCOUNT_ID}:rule\/.*`, 'g').test(event.resources[0])
}

function createExpressProxyEvent(path: string, httpMethod: string): any {
    return {
        path,
        headers: {
            'Content-Type': 'application/json',
            'x-internal-router-secret': Constants.INTERNAL_ROUTER_SECRET,
        },
        body: JSON.stringify({}),
        httpMethod,
    }
}


async function bootstrap() {
    const expressServer: Express = express()
    const nestApp = expressServer ? await NestFactory.create(AppModule, new ExpressAdapter(expressServer)) : await NestFactory.create(AppModule)
    nestApp.useGlobalPipes(new ValidationPipe());
    await nestApp.init()
    return serverlessExpress.createServer(expressServer, null, null)
}

// @ts-ignore
bootstrap().then(server => {
    // tslint:disable-next-line:no-console
    console.log(`Server initialized [elapsed=${moment().diff(current, 'milliseconds')}ms]`)
    lambdaProxy = server
})

function waitForServer(event: any, context: any) {
    setImmediate(() => {
        if (!lambdaProxy) {
            waitForServer(event, context)
        } else {
            serverlessExpress.proxy(lambdaProxy, event, context as any)
        }
    })
}

export const handler = (event: any, context: Context) => {
    event.path = event.path ? event.path : event.rawPath
    event.httpMethod = event.httpMethod ? event.httpMethod : event.requestContext?.http?.method
    if (isCloudWatchTrigger(event)) {
        console.log(`Lambda invoked by CloudWatch`)
        event = createExpressProxyEvent('/internal/tweet-failure', 'POST')
    }
    if (lambdaProxy) {
        serverlessExpress.proxy(lambdaProxy, event, context as any)
    } else {
        waitForServer(event, context)
    }
}
