'use strict';

const { MAX_AWS_REQUEST_TRY } = require('../../utils');
const {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const cognito = new CognitoIdentityProviderClient({ maxAttempts: MAX_AWS_REQUEST_TRY });

const customSenderSources = ['CustomSMSSender', 'CustomEmailSender'];
const KMSKeyID = 'KMSKeyID';

function getUpdateConfigFromCurrentSetup(currentSetup) {
  const updatedConfig = Object.assign({}, currentSetup);

  delete updatedConfig.Id;
  delete updatedConfig.Name;
  delete updatedConfig.Status;
  delete updatedConfig.LastModifiedDate;
  delete updatedConfig.CreationDate;
  delete updatedConfig.SchemaAttributes;
  delete updatedConfig.AliasAttributes;
  delete updatedConfig.UsernameAttributes;
  delete updatedConfig.EstimatedNumberOfUsers;
  delete updatedConfig.SmsConfigurationFailure;
  delete updatedConfig.EmailConfigurationFailure;
  delete updatedConfig.Domain;
  delete updatedConfig.CustomDomain;
  delete updatedConfig.UsernameConfiguration;
  delete updatedConfig.Arn;

  updatedConfig.Policies.PasswordPolicy.TemporaryPasswordValidityDays =
    updatedConfig.AdminCreateUserConfig.UnusedAccountValidityDays;
  delete updatedConfig.AdminCreateUserConfig.UnusedAccountValidityDays;

  return updatedConfig;
}

async function findUserPoolByName(config) {
  const { userPoolName, region } = config;

  cognito.config.region = () => region;

  async function recursiveFind(nextToken) {
    const payload = { MaxResults: 60 };
    if (nextToken) payload.NextToken = nextToken;

    return cognito.send(new ListUserPoolsCommand(payload)).then((result) => {
      const matches = result.UserPools.filter((pool) => pool.Name === userPoolName);
      if (matches.length) return matches[0];
      if (result.NextToken) return recursiveFind(result.NextToken);
      return null;
    });
  }

  return recursiveFind();
}

async function getConfiguration(config) {
  const { region } = config;

  cognito.config.region = () => region;

  return findUserPoolByName(config)
    .then((userPool) => cognito.send(new DescribeUserPoolCommand({ UserPoolId: userPool.Id })))
    .then((response) => response.UserPool);
}

async function updateConfiguration(config) {
  const { lambdaArn, userPoolConfigs, region } = config;

  cognito.config.region = () => region;

  return getConfiguration(config).then((userPool) => {
    const UserPoolId = userPool.Id;
    let { LambdaConfig } = userPool;

    LambdaConfig = removeExistingLambdas(LambdaConfig, lambdaArn);

    userPoolConfigs.forEach((poolConfig) => {
      if (customSenderSources.includes(poolConfig.Trigger)) {
        LambdaConfig[poolConfig.Trigger] = {
          LambdaArn: lambdaArn,
          LambdaVersion: poolConfig.LambdaVersion,
        };
        LambdaConfig.KMSKeyID = poolConfig.KMSKeyID;
      } else {
        LambdaConfig[poolConfig.Trigger] = lambdaArn;
      }
    });

    const updatedConfig = getUpdateConfigFromCurrentSetup(userPool);
    Object.assign(updatedConfig, {
      UserPoolId,
      LambdaConfig,
    });

    return cognito.send(new UpdateUserPoolCommand(updatedConfig));
  });
}

async function removeConfiguration(config) {
  const { lambdaArn, region } = config;

  cognito.config.region = () => region;

  return getConfiguration(config).then((userPool) => {
    const UserPoolId = userPool.Id;
    let { LambdaConfig } = userPool;

    LambdaConfig = removeExistingLambdas(LambdaConfig, lambdaArn);

    const updatedConfig = getUpdateConfigFromCurrentSetup(userPool);
    Object.assign(updatedConfig, {
      UserPoolId,
      LambdaConfig,
    });

    return cognito.send(new UpdateUserPoolCommand(updatedConfig));
  });
}

function removeExistingLambdas(lambdaConfig, lambdaArn) {
  const res = Object.fromEntries(
    Object.entries(lambdaConfig).filter(([key, value]) => {
      return (
        !(customSenderSources.includes(key) && value.LambdaArn === lambdaArn) &&
        value !== lambdaArn
      );
    })
  );

  if (KMSKeyID in res && customSenderSources.every((source) => !(source in res))) {
    delete res[KMSKeyID];
  }

  return res;
}

module.exports = {
  findUserPoolByName,
  updateConfiguration,
  removeConfiguration,
};
