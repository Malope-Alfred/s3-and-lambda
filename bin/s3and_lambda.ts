#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3AndLambdaStack } from '../lib/s3and_lambda-stack';

const app = new cdk.App();
new S3AndLambdaStack(app, 'S3AndLambdaStack-dev', {
  stackName: 'grad-s3-and-lambda',
  env: { 
    account: process.env.CDK_DEPLOY_ACCOUNT, 
    region: process.env.CDK_DEPLOY_REGION
  },
  tags: {
    Name: "Grad-s3-and-lambda",
    Environment: "dev",
    Project: "Grad Project",
    ManagedBy: "Alfred.Malope@bbd.co.za",
  },
  envSuffix: "dev",
  deployRegion: 'af-south-1',
});