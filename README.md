# Palo Alto Networks Nat Rule Updater

##### A Lambda function for keeping Palo Alto Networks Nat rule destination IP addresses in sync with Elastic Load Balancer VIPs.
  
The updater uses tagging and naming conventions to determine which rules need to be updated.  A tag is added to each ELB which corresponds to the name of the NAT rule in the Palo Alto Networks firewall.  When the updater function executes, it will retrieve a list of all ELBs in the AWS account using the defined tag. The current IP of each ELB is then compared to the current NAT destination IP.  If the two values do not match the destination IP is updated in the firewall.  Once all the ELBs have been processed, and if there were any changes to the NAT rules, A commit is executed on the firewall.

#### Installation:

A cloudformation template is provided in the project to facilitate installation of the function.  The template will create the following AWS resources:
* NatRuleLambda
  * Lambda function for processing.
* NatRuleLambdaRole
  * IAM Role for Lambda function execution
* NatUpdateTimerRule
  * Event Rule for triggering Lambda function one 1 minute cycle.
* NatRuleLambdaInvokePermission
  * IAM permissions for timer to execute Lambda function.
  
  
The following parameters are required for executing the Cloudformation template:
* PaloIp
  * The IP address for the firewall management interface.
* PaloAdmin
  * The username for the firewall admin account.
* ElbTag
  * The tag name applied to ELBs that will be included in the process.
* S3Bucket
  * The name of the S3 bucket where the lambda zip file is stored.
* S3Key
  * The name of the lambda zip file.
  
  
#### Important:
  Once the Cloudformation stack has been created, you will need to add an environment variable called "pw" to the Lambda function.  This is the password used to connect to the firewall.  This variable must be encrypted.  For instructions on how to create an encrypted environment variable please refer to:
  
  http://docs.aws.amazon.com/lambda/latest/dg/env_variables.html
 
 
 #### Notes:
  * The zip file deployed to s3 only needs to include the lib and node_modules directories.
  * The firewall management interface needs to have port 22 open for the Lambda function to communicate.
  * There are two Cloudformation templates provided.  The base template deploys the Lambda function inside the VPC.  This a preferred installation for security reasons.  If you wish to install the Lambda outside the VPC you can use the modified version provided.
  