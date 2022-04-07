const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { XeroClient } = require("xero-node");

const app = express();

app.use(cors());
app.use(express.json());

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
  httpTimeout: 10000,
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
    console.log("error", err);
    res.send(null);
  }
});

app.get("/api/refresh-token", async (req, res) => {
  try {
    console.log("get token initiated");
    const refresh_token = req.headers.refresh_token;
    console.log("refresh otkn", refresh_token, clientId, clientSecret);
    const newXeroClient = new XeroClient();

    const newTokenSet = await newXeroClient.refreshWithRefreshToken(
      clientId,
      clientSecret,
      refresh_token
    );
    res.send(newTokenSet);
  } catch (err) {
    console.log("Failure getting refresh token", err);
    res.send(null);
  }
});

app.get("/api/contacts-accounts", async (req, res) => {
  try {
    const access_token = req.headers.authorization.split("Bearer ")[1];
    const tenants = await axios.get("https://api.xero.com/connections", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    if (!tenants.data) return res.send("No tenants available");
    const tenant = tenants.data[0].tenantId;

    const headers = {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Xero-Tenant-Id": tenant,
      },
    };
    const [contacts, accounts] = await Promise.all([
      axios.get(
        "https://api.xero.com/api.xro/2.0/Contacts?where=IsCustomer%3Dtrue&order=Name%20ASC",
        headers
      ),
      axios.get(
        "https://api.xero.com/api.xro/2.0/Accounts?order=Name%20ASC",
        headersI
      ),
    ]);

    res.status(200).send({
      contacts: contacts.data.Contacts,
      accounts: accounts.data.Accounts,
    });
  } catch (ex) {
    res.status(401).send(ex.response.data);
  }
});

app.post("/api/invoices", async (req, res) => {
  //
  try {
    const access_token = req.headers.authorization.split("Bearer ")[1];
    const tenants = await axios.get("https://api.xero.com/connections", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!tenants.data) return res.send("No tenants available");
    const tenant = tenants.data[0].tenantId;

    const headers = {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Xero-Tenant-Id": tenant,
      },
    };
    var unitprice = req.body.unitprice;
    var description = req.body.description;
    var to = req.body.to;
    var qty = req.body.qty;
    var crtdt = req.body.crtdt;
    var duedt = req.body.duedt;
    var account = req.body.account;

    var itms = [
      {
        Description: description,
        Quantity: qty,
        UnitAmount: unitprice,
        AccountCode: account,
      },
    ];
    var inv = {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { Name: to },
          Date: crtdt,
          DueDate: duedt,
          LineAmountTypes: "Exclusive",
          LineItems: itms,
        },
      ],
    };

    const invoices = await axios.post(
      "https://api.xero.com/api.xro/2.0/Invoices",
      inv,
      headers
    );

    res.status(200).send(invoices.data);
  } catch (ex) {
    res.status(401).send(ex.response.data);
  }
});

// const port = 3000;
// app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// module.export = app;
module.exports.handler = serverless(app);
