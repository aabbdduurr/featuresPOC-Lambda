// describe how to setup lambda.
// create a new lambda function in AWS console., also s3 bucket.
// create a new role for lambda function to access s3 bucket. write, read, delete, list.
// cors configuration in s3 bucket and lambda function to allow access from localhost or any other domain.
// use apid gateway if you want
// good ideas to setup logging and monitoring via cloudwatch.
// use aws cli to deploy lambda function.

# Toggle Management - Lambda Function

This is a messy lambda function that lets you manage featues, which are stored in a s3 bucket.

## Setup

1. Create a new lambda function in AWS console.
2. Create a new s3 bucket.
3. Create a new role for lambda function to access s3 bucket. write, read, delete, list.
4. CORS configuration in s3 bucket and lambda function to allow access from localhost or any other domain.
5. Use apid gateway if you want.
6. Cloudwatch for logging and monitoring.
7. Use aws cli to deploy lambda function.

## Usage

1. Create Platforms

```bash
curl --location '<LAMBDA_ENDPOINT>' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjp7ImVtYWlsIjoiYWJkdXIucmFobWFuQGRhem4uY29tIn19.JaoRe9I2OrDoqbS7fhmaFVYedBZtXlU2xk1k1kRyP5c' \
--data '{
  "action": "add-platform",
  "newPlatforms": ["LRDS"]
}'
```

2. Create Segments

```bash
curl --location '<LAMBDA_ENDPOINT>' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
  "action": "create-segment",
  "segmentName": "country",
  "segmentDescription": "Country",
  "segmentValues": ["UK", "US"]
}'
```

3. Run the Management interface

https://github.com/aabbdduurr/featuresPOC-Management

4. Run the Client interface to test the features and run the simulation

https://github.com/aabbdduurr/featuresPOC-Client

## License

Use it as you like. No restrictions.
