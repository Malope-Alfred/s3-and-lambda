import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as events from "aws-cdk-lib/aws-events";
import * as target from "aws-cdk-lib/aws-events-targets";
import * as kms from "aws-cdk-lib/aws-kms";

interface ExtendedStackProps extends StackProps {
  readonly stackName: string,
  readonly envSuffix: string,
  readonly deployRegion: string,
}

export class S3AndLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const AlfredS3BucketKey = new kms.Key(this, 'AlfredS3AndLambdaKmsKey', {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      alias: `${props.stackName}-bucket`,
    });
  
    AlfredS3BucketKey.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AccountRootPrincipal()],
      actions: [
        'kms:Encrypt',
        'kms:Decrypt',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
        'kms:DescribeKey'
      ],
      resources: ['*'],
    }));
  
    const bucketName = `alfred-bbd-grad-2025-s3-${props.envSuffix}`;

    new s3.Bucket(this, bucketName,{
      bucketName: bucketName,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: AlfredS3BucketKey,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      enforceSSL: true
    });

    const lambdaKmsPermission = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey*',
        'kms:DescribeKey'
      ],
      resources: [AlfredS3BucketKey.keyArn],
    });


    const AlfredS3AndLambdaExecutionRole = new iam.Role(this, 'AlfredS3AndLambdaExecutionRole', {
      roleName: `${props.stackName}-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    AlfredS3AndLambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "cloudwatch:PutMetricData",
          "lambda:InvokeFunction",
          "ec2:CreateNetworkInterface",
          "ec2:DeleteNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "s3:PutObject",
        ],
        resources: ['*'],
      })
    );

    AlfredS3AndLambdaExecutionRole.addToPolicy(lambdaKmsPermission);

    const AlfredS3AndLambda = new NodejsFunction(this, 'AlfredS3AndLambda', {
      functionName: props.stackName,
      entry: 'src/lambda/main.ts',
      handler: 'lambdaHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      role: AlfredS3AndLambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      logRetention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      memorySize: 1024,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        REGION: props.deployRegion,
        DEPLOY_ENV: props.envSuffix,
        BUCKET_NAME: bucketName,
      },
    });

    const rule = new events.Rule(this,`s3-and-lambda-rule`,{
      schedule: events.Schedule.expression('cron(0 14 ? * MON-FRI *)'), // Run at 16:00 South African Standard Time, Monday to Friday
    });

    rule.addTarget(new target.LambdaFunction(AlfredS3AndLambda));
    
  }
}
