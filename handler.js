"use strict";

const AWS = require("aws-sdk");
const { promisify } = require("util");

const returnFromLambda = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Content-Type": "text/html",
  },
  body,
});

const db = new AWS.DynamoDB.DocumentClient();
const dbPut = promisify(db.put).bind(db);
const dbGet = promisify(db.get).bind(db);

const sum = (a, b) => a + b;

const sumFromOneTo = (n) =>
  Array.from({ length: n }, (_, i) => i + 1).reduce(sum, 0);

const html = (body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Sum positive ints 1..n</title>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300&display=swap" rel="stylesheet">
</head>
<style>
* { font-family: Oswald, sans-serif; }
h1 { size: 200%; }
</style>
<body>
  <h1>Sum positive ints 1..n</h1>
  ${body}
</body>
</html>
`;

module.exports.calculate = async (event) => {
  if (
    !event.queryStringParameters ||
    !event.queryStringParameters.len ||
    !Number.isInteger(parseInt(event.queryStringParameters.len, 10)) ||
    parseInt(event.queryStringParameters.len, 10) <= 0
  ) {
    return returnFromLambda(
      403,
      html(
        `<h3>Invalid params...</h3>
        <p>{BASE_URL}/dev/api/calculate?len=POSITIVE_INT</p>
        <p>Example: {BASE_URL}/dev/api/calculate?len=199999999</p>`
      )
    );
  }
  const len = parseInt(event.queryStringParameters.len, 10);
  const getParams = {
    TableName: "sumtable",
    Key: {
      id: JSON.stringify({ len }),
    },
  };
  const startStamp1 = new Date().getTime();
  const response = await dbGet(getParams);
  if (response.Item) {
    const endStamp1 = new Date().getTime();
    return returnFromLambda(
      200,
      html(
        `<h3>Result (fetched entry from db)</h3>
        <p>1..${event.queryStringParameters.len} summed is ${
          response.Item.result
        }</p>
        <p>Calculation time: ${response.Item.calcTime} ms.</p>
        <p>Time to fetch from DB: ${endStamp1 - startStamp1} ms.</p>`
      )
    );
  }
  const startStamp2 = new Date().getTime();
  const newResult = sumFromOneTo(len);
  const endStamp2 = new Date().getTime();
  const putParams = {
    TableName: "sumtable",
    Item: {
      id: JSON.stringify({ len }),
      result: newResult,
      calcTime: endStamp2 - startStamp2,
    },
  };
  await dbPut(putParams);
  return returnFromLambda(
    200,
    html(
      `<h3>Result (new entry in DB)</h3>
      <p>1..${event.queryStringParameters.len} summed is ${newResult}</p>
      <p>Calculation time: ${endStamp2 - startStamp2} ms.</p>
      <p><em>The next time the result is not calculated but grabbed from the database.</em></p>
      <p><button onclick="location.reload()">Click me to grab from db.</button></p>
      `
    )
  );
};
