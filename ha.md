## [Palo Alto Networks High Availability Solution](#ha)
  <p>The high availability solution uses three lambda functions to maintain a hot standby firewall, monitor the active firewall for status, and failover to the standby if the active firewall fails a status check.</p> 
  <p>The first function, palo-export-config, exports the current configuration file from the active firewall and saves it to an S3 bucket.  It also modifies the file to change configuration values for use in the standby firewall by performing a find and replace for configuration values that match the pre-defined manifest values.</p>
  <p>The second function, palo-status-check, monitors the status of the active firewall instance.  The function uses a trigger for regular execution.  If a status check failure occurs a second check is performed.  If the second check fails the function calls the failover function.</p>
  <p>The third function, palo-execute-failover, performs a failover by re-assigning elastic ip addresses to the appropriate network interface and updating any route configurations being used.</p>
  
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
    
 #### Notes:
   * The zip file deployed to s3 only needs to include the lib and node_modules directories.
   * The firewall management interface needs to have port 22 open for the Lambda function to communicate.
   
    