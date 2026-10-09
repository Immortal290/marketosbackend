export const PROVIDERS: Record<string, any> = {
  mailchimp: {
    id: "mailchimp",
    fields: [
      { key: "apiKey", regex: /^[a-f0-9]{32}-[a-z]{2,3}\d{1,2}$/ },
      { key: "audienceId", regex: /^[a-f0-9]{8,12}$/ },
    ],
    async verify({ apiKey, audienceId }: any) {
      const dc = apiKey.split("-")[1];
      const headers = { Authorization: "Basic " + Buffer.from("x:" + apiKey).toString("base64") };
      const ping = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, { headers });
      if (!ping.ok) throw new Error("Mailchimp rejected this API key");
      const list = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}`, { headers });
      if (!list.ok) throw new Error("Audience ID not found in this account");
      const data = await list.json();
      return { accountLabel: data.name };
    },
  },

  hubspot: {
    id: "hubspot",
    fields: [
      { key: "portalId", regex: /^\d{6,10}$/ },
      { key: "token", regex: /^pat-[a-z0-9]+-[a-f0-9-]{36}$/ },
    ],
    async verify({ portalId, token }: any) {
      const r = await fetch("https://api.hubapi.com/account-info/v3/details", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("HubSpot rejected this token");
      const d = await r.json();
      if (String(d.portalId) !== String(portalId)) throw new Error("Token belongs to a different portal");
      return { accountLabel: `Portal ${d.portalId}` };
    },
  },

  meta: {
    id: "meta",
    fields: [
      { key: "adAccountId", regex: /^act_\d{5,20}$/ },
      { key: "pixelId", regex: /^\d{10,20}$/ },
      { key: "token", regex: /^EA[A-Za-z0-9]{20,}$/ },
    ],
    async verify({ adAccountId, pixelId, token }: any) {
      const q = (path: string, f: string) => fetch(`https://graph.facebook.com/v21.0/${path}?fields=${f}&access_token=${token}`);
      const acc = await q(adAccountId, "name,account_status");
      if (!acc.ok) throw new Error("Token has no access to this ad account");
      const px = await q(pixelId, "name");
      if (!px.ok) throw new Error("Pixel ID not found or not accessible");
      const data = await acc.json();
      return { accountLabel: data.name };
    },
  },

  linkedin: {
    id: "linkedin",
    fields: [
      { key: "adAccountId", regex: /^\d{5,15}$/ },
      { key: "companyPageId", regex: /^\d{5,15}$/ },
      { key: "insightPartnerId", regex: /^\d{5,15}$/ },
      { key: "token", regex: /^AQV[a-zA-Z0-9_-]{10,}$/ },
    ],
    async verify({ adAccountId, token }: any) {
      const r = await fetch(`https://api.linkedin.com/rest/adAccounts/${adAccountId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202312",
          "X-Restli-Protocol-Version": "2.0.0"
        }
      });
      if (!r.ok) throw new Error("LinkedIn token invalid or expired");
      const data = await r.json();
      return { accountLabel: data.name || `Ad Account ${adAccountId}` };
    },
  },

  ga4: {
    id: "ga4",
    fields: [
      { key: "propertyId", regex: /^\d{5,15}$/ },
      { key: "serviceAccount", regex: /"private_key":/ },
    ],
    async verify({ propertyId, serviceAccount }: any) {
      let parsed;
      try {
        parsed = JSON.parse(serviceAccount);
      } catch(e) {
        throw new Error("Invalid JSON for service account");
      }
      if (!parsed.client_email) throw new Error("Invalid service account JSON");
      return { accountLabel: `Property ${propertyId}` };
    },
  },

  google_ads: {
    id: "google_ads",
    fields: [
      { key: "customerId", regex: /^\d{3}-\d{3}-\d{4}$/ },
      { key: "developerToken", regex: /^.{10,30}$/ },
      { key: "clientId", regex: /^.+apps\.googleusercontent\.com$/ },
      { key: "clientSecret", regex: /^GOCSPX-.+$/ },
      { key: "refreshToken", regex: /^1\/\/.+$/ },
    ],
    async verify({ customerId }: any) {
      return { accountLabel: `Account ${customerId}` };
    },
  }
};
