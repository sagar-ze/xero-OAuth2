const serverless = require("serverless-http");
const express = require("express");
const jwtDecode = require("jwt-decode");
const request = require("request");
const { XeroClient, Invoice, Phone } = require("xero-node");

const session = require("express-session");

const app = express();

app.use(express.static(__dirname + "/build"));

app.use(
  session({
    secret: "something crazy",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const authenticationData = (req, res) => {
  return {
    decodedIdToken: req.session.decodedIdToken,
    decodedAccessToken: req.session.decodedAccessToken,
    tokenSet: req.session.tokenSet,
    allTenants: req.session.allTenants,
    activeTenant: req.session.activeTenant,
  };
};

const encodeBody = (params) => {
  var formBody = [];
  for (var property in params) {
    var encodedKey = encodeURIComponent(property);
    var encodedValue = encodeURIComponent(params[property]);
    formBody.push(encodedKey + "=" + encodedValue);
  }
  return formBody.join("&");
};

// app.get("/", (req, res) => {
// request(
//   {
//     method: "POST",
//     uri: "https://identity.xero.com/connect/token",
//     headers: {
//       authorization:
//         "Basic " +
//         Buffer.from(client_id + ":" + client_secret).toString("base64"),
//       "Content-Type": "application/x-www-form-urlencoded",
//     },
//     body: encodeBody({ grant_type: "client_credentials", scopes }),
//   },
//   (error, response, body) => {
//     if (error) {
//       console.log(error.body);
//     } else {
//       if (
//         response.statusCode &&
//         response.statusCode >= 200 &&
//         response.statusCode <= 299
//       ) {
//         console.log({ response: response, body: body });
//         // resolve({ response: response, body: body });
//       } else {
//         console.log(body);
//         // console.log("response", response);
//         // reject({ response: response, body: body });
//       }
//     }
//   }
// );
//   res.send(`<a href='/connect'>Connect to Xero</a>`);
// });

const getXeroConfig = (client_id, client_secret) => {
  const redirectUrl = ["http://localhost:8080"];
  const scopes =
    "openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access";

  return new XeroClient({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUris: [redirectUrl],
    scopes: scopes.split(" "),
  });
};

app.get("/api", async (req, res) => {
  try {
    console.log("req.query", req.query);
    const { client_id, client_secret } = req.query;
    const xero = getXeroConfig(client_id, client_secret);
    
    const consentUrl = await xero.buildConsentUrl();
    console.log(consentUrl);
    res.send(consentUrl);
  } catch (err) {
    res.send("Sorry, something went wrong");
  }
});

app.get("/callback", async (req, res) => {
  try {
    const tokenSet = await xero.apiCallback(req.url);
    console.log("token set", tokenSet);
    // cd;
    // await xero.updateTenants();
    res.send(tokenSet);
    return;
    const decodedIdToken = jwtDecode(tokenSet.id_token);
    const decodedAccessToken = jwtDecode(tokenSet.access_token);

    // req.session.decodedIdToken = decodedIdToken;
    // req.session.decodedAccessToken = decodedAccessToken;
    // req.session.tokenSet = tokenSet;
    // req.session.allTenants = xero.tenants;
    // // XeroClient is sorting tenants behind the scenes so that most recent / active connection is at index 0
    // req.session.activeTenant = xero.tenants[0];

    // const authData = authenticationData(req, res);
    // console.log(xero.tenants[0]);
    // const res = await xero.accountingApi.getContacts(xero.tenants[0].tenantId);
    // console.log("res", res.body);
  } catch (err) {
    console.log(err, "error");
    res.send("Sorry, something went wrong");
  }
});

app.get("/organisation", async (req, res) => {
  try {
    const tokenSet = await xero.readTokenSet();
    console.log(tokenSet.expired() ? "expired" : "valid");
    console.log("########", req.session);
    const response = await xero.accountingApi.getOrganisations(
      req.session.activeTenant.tenantId
    );
    res.send(`Hello, ${response.body.organisations[0].name}`);
  } catch (err) {
    res.send("Sorry, something went wrong");
  }
});

app.get("/invoice", async (req, res) => {
  try {
    const contacts = await xero.accountingApi.getContacts(
      req.session.activeTenant.tenantId
    );
    console.log("contacts: ", contacts.body.contacts);
    const where = 'Status=="ACTIVE" AND Type=="SALES"';
    const accounts = await xero.accountingApi.getAccounts(
      req.session.activeTenant.tenantId,
      null,
      where
    );
    console.log("accounts: ", accounts.body.accounts);
    const contact = {
      contactID: contacts.body.contacts[0].contactID,
    };
    const lineItem = {
      accountID: accounts.body.accounts[0].accountID,
      description: "consulting",
      quantity: 1.0,
      unitAmount: 10.0,
    };
    const invoice = {
      lineItems: [lineItem],
      contact: contact,
      dueDate: "2021-09-25",
      date: "2021-09-24",
      type: Invoice.TypeEnum.ACCREC,
    };
    const invoices = {
      invoices: [invoice],
    };
    const response = await xero.accountingApi.createInvoices(
      req.session.activeTenant.tenantId,
      invoices
    );
    console.log("invoices: ", response.body.invoices);
    res.json(response.body.invoices);
  } catch (err) {
    res.json(err);
  }
});

app.get("/contact", async (req, res) => {
  try {
    const contact = {
      name: "Bruce Banner",
      emailAddress: "hulk@avengers.com",
      phones: [
        {
          phoneNumber: "555-555-5555",
          phoneType: Phone.PhoneTypeEnum.MOBILE,
        },
      ],
    };
    const contacts = {
      contacts: [contact],
    };
    const response = await xero.accountingApi.createContacts(
      req.session.activeTenant.tenantId,
      contacts
    );
    console.log("contacts: ", response.body.contacts);
    res.json(response.body.contacts);
  } catch (err) {
    res.json(err);
  }
});
const port = 3000;
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

module.export = app;
