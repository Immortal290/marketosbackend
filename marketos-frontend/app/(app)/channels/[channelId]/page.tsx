import { notFound } from "next/navigation";
import { ChannelOnboarding, ChannelConfig } from "@/components/ui/ChannelOnboarding";

const channelsData: Record<string, ChannelConfig> = {
  "linkedin": {
    id: "linkedin",
    name: "LinkedIn",
    description: "Connect your LinkedIn Ads and Company Page to automate B2B campaigns and track professional audience engagement.",
    accent: "cyan",
    fields: [
      { id: "clientId", label: "Client ID", placeholder: "e.g. 78xxxxxxxx" },
      { id: "clientSecret", label: "Client Secret", placeholder: "e.g. yTxxxxxxxxxxxx", type: "password" },
      { id: "adAccountId", label: "Ad Account ID", placeholder: "e.g. 50XXXXXX" }
    ]
  },
  "google-ads": {
    id: "google-ads",
    name: "Google Ads",
    description: "Integrate Google Ads to sync search and display campaigns, monitor ROAS, and use AI to automatically adjust bids.",
    accent: "yellow",
    fields: [
      { id: "developerToken", label: "Developer Token", placeholder: "e.g. aB1cD2eF3gH4iJ5kL6mN" },
      { id: "clientId", label: "Client ID", placeholder: "e.g. 123-456-7890.apps.googleusercontent.com" },
      { id: "clientSecret", label: "Client Secret", placeholder: "e.g. GOCSPX-xxxxx", type: "password" },
      { id: "loginCustomerId", label: "Login Customer ID", placeholder: "e.g. 123-456-7890" }
    ]
  },
  "meta-ads": {
    id: "meta-ads",
    name: "Meta Ads (Facebook & Instagram)",
    description: "Connect your Meta Business Manager to sync Facebook and Instagram campaigns, creatives, and audience data.",
    accent: "pink",
    fields: [
      { id: "appId", label: "App ID", placeholder: "e.g. 123456789012345" },
      { id: "appSecret", label: "App Secret", placeholder: "e.g. 8aXXXXXXXXXXXXXXXXXXXX", type: "password" },
      { id: "adAccountId", label: "Ad Account ID (act_)", placeholder: "e.g. act_123456789" }
    ]
  },
  "twitter": {
    id: "twitter",
    name: "Twitter / X",
    description: "Connect your Twitter Ads account to monitor social engagement, trending topics, and promoted tweet performance.",
    accent: "lime",
    fields: [
      { id: "apiKey", label: "API Key", placeholder: "e.g. XXXXXXXXXXXXXXXXXXXXX" },
      { id: "apiSecret", label: "API Key Secret", placeholder: "e.g. XXXXXXXXXXXXXXXXXXXXX", type: "password" },
      { id: "bearerToken", label: "Bearer Token", placeholder: "e.g. AAAAAAAAAAAAAAAAAAAAA", type: "password" }
    ]
  },
  "whatsapp": {
    id: "whatsapp",
    name: "WhatsApp Business API",
    description: "Connect your WhatsApp Business account to send automated messages, alerts, and handle customer queries.",
    accent: "yellow",
    fields: [
      { id: "phoneNumberId", label: "Phone Number ID", placeholder: "e.g. 10XXXXXX" },
      { id: "whatsappBusinessAccountId", label: "WhatsApp Business Account ID", placeholder: "e.g. 11XXXXXX" },
      { id: "accessToken", label: "System User Access Token", placeholder: "e.g. EAXXXXXXXX", type: "password" }
    ]
  },
  "email": {
    id: "email",
    name: "Email Integration (SMTP/API)",
    description: "Connect your Email provider (SendGrid, Mailgun, Amazon SES) to send transactional and marketing emails.",
    accent: "cyan",
    fields: [
      { id: "provider", label: "Provider (SendGrid, Mailgun, etc)", placeholder: "e.g. SendGrid" },
      { id: "apiKey", label: "API Key", placeholder: "e.g. SG.xxxxxxxxxx", type: "password" },
      { id: "senderEmail", label: "Default Sender Email", placeholder: "e.g. hello@yourcompany.com" }
    ]
  },
  "sms": {
    id: "sms",
    name: "SMS Integration (Twilio/MessageBird)",
    description: "Connect your SMS provider to send order updates, promotions, and critical alerts.",
    accent: "pink",
    fields: [
      { id: "accountSid", label: "Account SID", placeholder: "e.g. ACxxxxxxxxxx" },
      { id: "authToken", label: "Auth Token", placeholder: "e.g. xxxxxxxxxx", type: "password" },
      { id: "fromNumber", label: "Sender Phone Number", placeholder: "e.g. +1234567890" }
    ]
  },
  "phone": {
    id: "phone",
    name: "Phone / Voice API",
    description: "Connect your Voice API provider to handle automated voice calls and call tracking.",
    accent: "lime",
    fields: [
      { id: "accountSid", label: "Account SID", placeholder: "e.g. ACxxxxxxxxxx" },
      { id: "authToken", label: "Auth Token", placeholder: "e.g. xxxxxxxxxx", type: "password" },
      { id: "webhookUrl", label: "Voice Webhook URL", placeholder: "e.g. https://api.yourcompany.com/voice" }
    ]
  }
};

export default function ChannelPage({ params }: { params: { channelId: string } }) {
  const channel = channelsData[params.channelId];

  if (!channel) {
    notFound();
  }

  return (
    <div className="flex w-full flex-1 flex-col py-8">
      <ChannelOnboarding channel={channel} />
    </div>
  );
}
