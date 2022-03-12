const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { XeroClient } = require("xero-node");

const app = express();

app.use(cors());

const redirectUrl = process.env.redirectUrl;
const clientId = process.env.clientId;
const clientSecret = process.env.clientSecret;
const scopes =
  "openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access";

const xero = new XeroClient({
  clientId,
  clientSecret,
  redirectUris: [redirectUrl.split(",")].flat(),
  scopes: scopes.split(" "),
});

app.get("/api/auth", async (req, res) => {
  try {
    const consentUrl = await xero.buildConsentUrl();
    res.send(consentUrl);
  } catch (err) {
    res.send(null);
  }
});

app.get("/api/token", async (req, res) => {
  try {
    let url = req.url.split("/api/token");
    url = "/" + url[1];
    const tokenSet = await xero.apiCallback(url);
    res.send(tokenSet);
  } catch (err) {
    res.send(null);
  }
});

app.get("/api/refresh-token", async (req, res) => {
  try {
    console.log(req.headers);
    const refresh_token = req.headers.refresh_token;

    const newXeroClient = new XeroClient();
    const newTokenSet = await newXeroClient.refreshWithRefreshToken(
      clientId,
      clientSecret,
      refresh_token
    );
    console.log(newTokenSet);
    res.send(newTokenSet);
  } catch (err) {
    console.log("Failure getting refresh token", err);
    res.send(null);
  }
});

app.get("/api/contacts", async (req, res) => {
  try {
    const access_token = req.headers.authorization.split("Bearer ")[1];
    const tenants = await axios.get("https://api.xero.com/connections", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    if (!tenants.data) return res.send("No tenants available");
    const tenant = tenants.data[0].tenantId;

    const contacts = await axios.get(
      "https://api.xero.com/api.xro/2.0/Contacts",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Xero-Tenant-Id": tenant,
        },
      }
    );
    res.status(200).send(contacts.data.Contacts);
  } catch (ex) {
    console.log("Something went wrong", ex);
    res.send(null);
  }
});

app.get("/api/accounts", async (req, res) => {
  try {
    const access_token = req.headers.authorization.split("Bearer ")[1];
    const tenants = await axios.get("https://api.xero.com/connections", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    if (!tenants.data) return res.send("No tenants available");
    const tenant = tenants.data[0].tenantId;

    const accounts = await axios.get(
      "https://api.xero.com/api.xro/2.0/Accounts",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Xero-Tenant-Id": tenant,
        },
      }
    );
    res.status(200).send(accounts.data.Accounts);
  } catch (ex) {
    console.log("Something went wrong on accounts", ex);
    res.send(null);
  }
});
// const port = 3000;
// app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// module.export = app;
module.exports.handler = serverless(app);
