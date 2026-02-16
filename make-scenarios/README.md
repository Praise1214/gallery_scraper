# Art Gallery Outreach - Make.com Automation

This folder contains Make.com scenario blueprints for automated gallery outreach using Brevo as the email provider.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    APIFY SCRAPER                                │
│  Scrapes gallery contacts → Pushes to Google Sheets             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS (CRM)                          │
│  Columns: gallery_name, email, website, phone, address,         │
│           city, state, status, sequence_step, unsubscribe, etc. │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              MAKE.COM AUTOMATION SCENARIOS                       │
├─────────────────────────────────────────────────────────────────┤
│  A: Queue Builder    │ Daily 6 AM - marks eligible → "queued"   │
│  B: Send Worker      │ Every 15 min - sends emails via Brevo    │
│  E: Bounce Handler   │ Webhook - handles bounces/unsubscribes   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        BREVO                                     │
│  Transactional email API with webhook for delivery events        │
└─────────────────────────────────────────────────────────────────┘
```

## Scenario Files

| File | Description |
|------|-------------|
| `scenario-a-queue-builder.json` | Runs daily, finds eligible galleries, marks as "queued" |
| `scenario-b-send-worker-brevo.json` | Processes queue, sends personalized emails via Brevo |
| `scenario-e-bounce-handler.json` | Webhook handler for bounces, complaints, unsubscribes |
| `email-templates.html` | HTML email templates with merge fields |

## Setup Instructions

### 1. Google Sheets Setup

Create a new Google Sheet with these columns:

| Column | Description |
|--------|-------------|
| gallery_name | Gallery name |
| email | Primary email address |
| all_emails | All emails found (comma-separated) |
| website | Gallery website URL |
| phone | Primary phone number |
| all_phones | All phones found (comma-separated) |
| address | Full address |
| city | City name |
| state | State abbreviation |
| source_url | Where the contact was found |
| scraped_at | Timestamp when scraped |
| status | Current status (empty, queued, sent, bounced, etc.) |
| sequence_step | Current email sequence step (0, 1, 2, 3) |
| last_contact_date | When last email was sent |
| response_date | When gallery responded |
| unsubscribe | TRUE/FALSE |
| do_not_contact | TRUE/FALSE |
| notes | Any notes about the contact |

### 2. Brevo Setup

1. Create a Brevo account at [brevo.com](https://brevo.com)
2. Verify your sender email address
3. Get your API key: **Settings > SMTP & API > API Keys**
4. Set up webhook (after importing Scenario E):
   - Go to **Settings > Webhooks**
   - Add new webhook with Make.com URL
   - Select events: hard_bounce, soft_bounce, spam, unsubscribed, blocked, invalid_email

### 3. Make.com Setup

1. Import each scenario JSON into Make.com
2. Connect your Google account for Sheets access
3. Configure variables in each scenario:
   - `YOUR_SPREADSHEET_ID` - from your Google Sheets URL
   - `brevo_api_key` - your Brevo API key
   - `sender_email` - your verified sender email
   - `sender_name` - display name for emails

### 4. Apify Scraper Configuration

Update your `input-example.json` with Google Sheets export:

```json
{
  "googleSheetsExport": true,
  "googleSpreadsheetId": "YOUR_SPREADSHEET_ID",
  "googleSheetName": "Galleries",
  "googleClientEmail": "your-service-account@project.iam.gserviceaccount.com",
  "googlePrivateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

## Email Warmup Schedule

**CRITICAL:** Start with low volume to build sender reputation!

| Week | Daily Limit | Batch Size | Notes |
|------|-------------|------------|-------|
| 1 | 10 | 2 | Monitor deliverability closely |
| 2 | 25 | 5 | Check for bounces/complaints |
| 3 | 50 | 10 | Review open rates |
| 4 | 100 | 15 | Scale if metrics are good |
| Ongoing | 200+ | 20+ | Adjust based on performance |

## Status Flow

```
(empty) → queued → sent → [responded/no_response]
                 ↓
           [bounced/spam_complaint/unsubscribed/invalid_email]
```

## Safety Features

1. **Do Not Contact Flag**: Automatically set for bounces, complaints, unsubscribes
2. **Unsubscribe Flag**: Respected in queue builder filter
3. **Rate Limiting**: Configurable delay between sends
4. **Business Hours Only**: Send worker only runs 6 AM - 6 PM
5. **Soft Bounce Handling**: Keeps contacts for retry (doesn't mark as do_not_contact)

## Compliance Notes

- All templates include unsubscribe links (CAN-SPAM requirement)
- Include physical mailing address in emails (CAN-SPAM requirement)
- Honor unsubscribe requests immediately
- Never contact spam complainants again
- Keep records of consent and opt-outs

## Troubleshooting

### Emails Not Sending
- Check Brevo API key is correct
- Verify sender email is verified in Brevo
- Check daily/monthly Brevo limits
- Review Make.com execution logs

### High Bounce Rate
- Reduce sending speed
- Verify email addresses before sending (consider email verification service)
- Check if your domain has proper SPF/DKIM/DMARC records

### Spam Complaints
- Stop sending immediately
- Review email content
- Ensure clear unsubscribe link
- Consider more targeted audience
