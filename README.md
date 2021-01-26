# Get up early... or burn some money 🔥

Switching from working 100% on-site to fully remote really does not help to get up early.
This project will help... or make me homeless. 🤷‍♂️

![](app/src/assets/fry.png)
  
## What this?
This is some small weekend project build with Terraform & Serverless Framework around AWS Lambda with a Twitter API integration.

Main purpose was besides having some coding fun is to punish me regularly if I miss to get up early in the morning, which I do basically every day since march 2020.

* each day I have to check in before the judgement time is reached, else a tweet will be send with a link to the subdomain
* the price is rolled randomly each day and will be between `min_price` & `max_price` (for me it's $1 & $25).
* if I miss to check in, the first one to visit the subdomain & submitting his PayPal address will receive the price (this step is manual! 🙃)

![](app/src/assets/this-is-fine.jpg)

## How to set up ⛴
Create a `config.json` file on root and fill out the needed details (have a look on the `sample.config.json`):

* `domain_name` - certificate name in ACM (us-west-1), add the certificate name here.
* `app_name` - the name of the app, which will also be your subdomain
* `aws_account_id` - your AWS account id. this is just to make sure not to apply your infra to some work account 🤷‍♂️
* `api_secret` - common secret between client & API
* `judgement_time_utc` - UTC timestamp as `hh:mm` at which you want to be ready for work
* `min_price` - minimum suffering for your PayPal account
* `max_price` - max suffering
* `twitter_consumer_api_key` - your consumer API key which you'll find in your Developer Dashboard @ Twitter
* `twitter_consumer_api_key_secret` - API key Secret for Consumer Key
* `twitter_api_access_token` - Access Token of your Twitter App
* `twitter_api_access_secret` - Secret Token of your Twitter App
* `twitter_api_bearer_token` - Bearer Token for your Twitter App

Also you need to add your `environment.prod.ts` / `environment.ts` to `app/src/environments` with `apiSecret` (secret from config) as well as `backend` (URL to backend)

After setting up the details you can do 
1. `./go apply-account prod` to create the needed infra for the frontend
2. `./go deploy-app` to deploy the static frontend
3. `./go deploy-sls` to deploy the CloudFormation stack for the API
4. `sls create_domain` to create the backend custom domain name in API Gateway

With `./go confirm` you can check in each day before judgement time is over, so you don't have to pay your friends anything! 🙋‍♂️

## Side Notes 💫
Weekend project most probably containing a lot of bugs and nasty code. Also, I'm no frontend expert, so this is really rudimentary. Be kind 🙀🤗
