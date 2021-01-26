#!/usr/bin/env bash

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" ; pwd -P)

APP_NAME=sls-saving-early
BUCKET_NAME=saving-early-prod-app

RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# [infra] check which changes would be done by terraform at apply ¡GREEN!
function plan() {
  pushd "$1" > /dev/null
    terraform init
    terraform plan ${@:2}
    TERRAFORM_SUCCESS=$?
  popd > /dev/null
}

# [infra]destroy all terraform resources (for this account or environment, depends on your subdirectory) ¡RED!
function destroy() {
  target=$1
  if [[ -z "${target}" ]]; then
    echo "Usage: $0 destroy [target]" 2>&1
    exit 1
  fi

  # terraform init -upgrade && terraform destroy
}

function apply() {
  pushd "$1" > /dev/null
    terraform init -upgrade
    terraform apply -auto-approve ${@:2}
    TERRAFORM_SUCCESS=$?
  popd > /dev/null
}

# [infra] plan account changes ¡GREEN!
function goal_plan-account() {
    account=$1

    if [[ -z "${account}" ]] || [[ "${account}" != "preview" ]] && [[ "${account}" != "prod" ]]; then
        echo "Usage: $0 plan-account [preview|prod]"
        exit 1
    fi

    _get-logged-in-account-id

    plan "${SCRIPT_DIR}/infra/accounts/${account}"
}
# [infra] apply infrastructure at account level ¡RED!
function goal_apply-account() {
    account=$1

    if [[ -z "${account}" ]] || [[ "${account}" != "preview" ]] && [[ "${account}" != "prod" ]]; then
        echo "Usage: $0 apply-account [preview|prod]"
        exit 1
    fi

    _get-logged-in-account-id

    start_time="$(date -u +%s)"

    apply "${SCRIPT_DIR}/infra/accounts/${account}"

    end_time="$(date -u +%s)"
    elapsed="$((end_time-start_time))"
    echo -e "[${BLUE}INFO${NC}] Apply took ${ORANGE}$elapsed${NC} seconds to finish 🚀"
}

function goal_setup-yarn() {
    if [[ ! -d node_modules ]];then
      echo -e "[${BLUE}INFO${NC}] Installing node dependencies"
      yarn
    else
      echo -e "[${BLUE}INFO${NC}] node_modules already there. Nothing to install"
    fi
}

function goal_deploy-sls() {
    _get-logged-in-account-id

    start_time="$(date -u +%s)"

    ./node_modules/.bin/serverless deploy -v

    end_time="$(date -u +%s)"
    elapsed="$((end_time-start_time))"
    echo -e "[${BLUE}INFO${NC}] Apply took ${ORANGE}$elapsed${NC} seconds to finish 🚀"
}

function _get-logged-in-account-id() {
  set +e
  STS_ACCOUNT_ID=$(aws sts get-caller-identity | jq -r '.Account')
  set -e
  if [[ -n ${STS_ACCOUNT_ID} ]]; then
    echo -e "[${BLUE}INFO${NC}] AWS Session is valid [accountId=${ORANGE}${STS_ACCOUNT_ID}${NC}]"
    export ACCOUNT_ID="${STS_ACCOUNT_ID}"
  else
    echo -e "[${RED}ERROR${NC}] Not logged into AWS"
    exit 1
  fi
}

function goal_package-layer {
    start_time="$(date -u +%s)"

    echo -e "[${BLUE}INFO${NC}] Packaging layer"
    mkdir -p deploy
    rm -rf tmp/common
    mkdir -p tmp/common/nodejs
    cp package.json tmp/common/nodejs
    pushd tmp/common/nodejs 2>&1>/dev/null
        yarn install --production
    popd 2>&1>/dev/null
    echo -e "[${BLUE}INFO${NC}] Creating deployment ZIP file"
    pushd tmp/common 2>&1>/dev/null
        rm nodejs/package.json
        zip -r ../../deploy/common.zip . 2>&1>/dev/null
    popd 2>&1>/dev/null
    if [[ ! -f deploy/common.zip ]];then
        echo -e "[${RED}ERROR${NC}] Packaging failed! Distribution package ZIP file could not be found."
        exit 1
    fi
    echo -e "[${BLUE}INFO${NC}] New deployment distribution is ${ORANGE}$(du -h deploy/common.zip | cut -f1)${NC}"
    end_time="$(date -u +%s)"
    elapsed="$((end_time-start_time))"
    echo -e "[${BLUE}INFO${NC}] Packaging ${GREEN}successfully finished${NC} in ${ORANGE}$elapsed${NC} seconds 🚀"
}

function goal_package() {
  mkdir -p deploy

  if [[ -z $1 ]];then
    _package api &
    _package tweetit &
    wait
  else
    _package "$1"
  fi
}

function _package() {
  pushd "lambdas/$1" 2>&1>/dev/null
      yarn run build
      yarn run archive
  popd 2>&1>/dev/null
}

function goal_deploy-lambdas() {
  goal_deploy-lambda api &
  goal_deploy-lambda tweetit &
  wait
}

function goal_deploy-lambda() {
  FUNCTION=$1

  _package "${FUNCTION}"

  start_time="$(date -u +%s)"

  aws lambda update-function-code --function-name "${APP_NAME}-${FUNCTION}" \
    --region eu-central-1 \
    --zip-file fileb:"//deploy/${FUNCTION}.zip" 2>&1> /dev/null

  end_time="$(date -u +%s)"
  elapsed="$((end_time-start_time))"
  echo -e "[${BLUE}INFO${NC}] Deployment of function ${ORANGE}${FUNCTION}${NC} finished in $elapsed seconds."
}

function goal_deploy-app() {
    _get-logged-in-account-id

    pushd app 2>&1>/dev/null
        yarn run build --prod
        echo -e "[${BLUE}INFO${NC}] Uploading app to bucket ${ORANGE}${BUCKET_NAME}${NC}..."
        aws s3 sync dist/web s3://${BUCKET_NAME} --sse --delete --cache-control no-cache --exact-timestamps --exclude "index.html" --region eu-central-1 2>&1
        aws s3 cp dist/web/index.html s3://${BUCKET_NAME} --sse --cache-control "max-age=0" --region eu-central-1 2>&1
        echo -e "[${BLUE}INFO${NC}] Upload of app to bucket ${ORANGE}${BUCKET_NAME}${NC} completed"
    popd 2>&1>/dev/null
}

function goal_confirm() {
    aws ssm put-parameter --name /${APP_NAME}/last-confirmation-time --overwrite --region=eu-central-1 --value "$(date +%s)" --output text
}

# ----------------------------------------------------------------------------------------------------------------------
# HELPER ---------------------------------------------------------------------------------------------------------------

if type -t "goal_${1:-}" &>/dev/null; then
  goal_"${1:-}" "${@:2}"
else
  echo "usage: $0 <goal>

goal:
    deploy-sls                        -- deploy your lambda functions
    deploy-app                        -- deploy web app
    deploy-lambda                     -- deploy your lambda functions
"
  exit 1
fi
