# Email Service Integration Guide

## Overview
The Admin Panel has email campaign functionality that currently logs to Firestore. This guide shows how to integrate with real email services.

## Recommended Services

### 1. **SendGrid** (Recommended)
- **Free Tier**: 100 emails/day
- **Easy Integration**: Simple API
- **Cost**: $19.95/month for 50,000 emails

### 2. **AWS SES (Simple Email Service)**
- **Free Tier**: 62,000 emails/month (if sending from EC2)
- **Cost**: $0.10 per 1,000 emails after free tier
- **Requires**: AWS account setup

### 3. **Mailgun**
- **Free Tier**: 5,000 emails/month for 3 months
- **Cost**: $35/month for 50,000 emails

---

## Implementation Steps

### Option 1: Firebase Cloud Functions + SendGrid

#### Step 1: Install Dependencies
```bash
cd functions
npm install @sendgrid/mail
```

#### Step 2: Add SendGrid API Key to Firebase
```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
```

#### Step 3: Create Cloud Function (`functions/src/index.ts`)
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

admin.initializeApp();
sgMail.setApiKey(functions.config().sendgrid.key);

export const sendEmailCampaign = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (userDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Must be admin');
  }

  const { subject, body, recipientType } = data;

  // Get recipient emails
  const usersSnapshot = await admin.firestore().collection('users').get();
  let recipients: string[] = [];

  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    if (recipientType === 'all' || 
        (recipientType === 'active' && userData.isActive) ||
        (recipientType === 'admins' && userData.role === 'admin')) {
      if (userData.email) recipients.push(userData.email);
    }
  });

  // Send emails in batches (SendGrid limit: 1000 per batch)
  const batchSize = 1000;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const msg = {
      to: batch,
      from: 'noreply@yourdomain.com', // Your verified sender
      subject: subject,
      html: body,
    };

    try {
      await sgMail.sendMultiple(msg);
    } catch (error) {
      console.error('Error sending batch:', error);
    }
  }

  // Log to Firestore
  await admin.firestore().collection('email_campaigns').add({
    subject,
    body,
    recipientType,
    recipientCount: recipients.length,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentBy: context.auth.uid,
    status: 'sent'
  });

  return { success: true, recipientCount: recipients.length };
});
```

#### Step 4: Update Admin Panel to Call Cloud Function

In `src/pages/AdminPanel.tsx`, replace the email campaign function:

```typescript
// Import at top
import { getFunctions, httpsCallable } from 'firebase/functions';

// In the component
const sendEmailCampaign = async () => {
  if (!emailCampaignSubject.trim() || !emailCampaignBody.trim()) {
    return toast.error("Subject and body are required");
  }

  try {
    const functions = getFunctions();
    const sendCampaign = httpsCallable(functions, 'sendEmailCampaign');
    
    const result = await sendCampaign({
      subject: emailCampaignSubject,
      body: emailCampaignBody,
      recipientType: "all" // or get from selector
    });

    toast.success(`Email sent to ${(result.data as any).recipientCount} users`);
    setShowEmailDialog(false);
    setEmailCampaignSubject("");
    setEmailCampaignBody("");
  } catch (error) {
    toast.error("Failed to send campaign");
    console.error(error);
  }
};
```

#### Step 5: Deploy Cloud Function
```bash
firebase deploy --only functions
```

---

### Option 2: AWS SES Integration

#### Step 1: Install AWS SDK
```bash
cd functions
npm install @aws-sdk/client-ses
```

#### Step 2: Create IAM User with SES Permissions
1. Go to AWS IAM Console
2. Create user with `AmazonSESFullAccess` policy
3. Generate access keys

#### Step 3: Store Credentials in Firebase Config
```bash
firebase functions:config:set aws.access_key="YOUR_ACCESS_KEY"
firebase functions:config:set aws.secret_key="YOUR_SECRET_KEY"
firebase functions:config:set aws.region="us-east-1"
```

#### Step 4: Create Cloud Function
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: functions.config().aws.region,
  credentials: {
    accessKeyId: functions.config().aws.access_key,
    secretAccessKey: functions.config().aws.secret_key,
  },
});

export const sendEmailCampaignSES = functions.https.onCall(async (data, context) => {
  // Similar auth checks as SendGrid example...

  for (const email of recipients) {
    const params = {
      Source: 'noreply@yourdomain.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: body } }
      }
    };

    try {
      await sesClient.send(new SendEmailCommand(params));
    } catch (error) {
      console.error(`Failed to send to ${email}:`, error);
    }
  }

  return { success: true, recipientCount: recipients.length };
});
```

---

## Email Templates

Create rich HTML email templates in `functions/src/emailTemplates.ts`:

```typescript
export const campaignTemplate = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; background: #f9f9f9; }
    .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 StudySync</h1>
    </div>
    <div class="content">
      ${body}
    </div>
    <div class="footer">
      <p>© 2024 StudySync. All rights reserved.</p>
      <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
`;
```

---

## Testing

### Test in Development
```typescript
// Use a test email service like Ethereal
import nodemailer from 'nodemailer';

const testAccount = await nodemailer.createTestAccount();
const transporter = nodemailer.createTransporter({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: { user: testAccount.user, pass: testAccount.pass }
});
```

### Production Checklist
- [ ] Verify sender email/domain
- [ ] Set up SPF/DKIM records
- [ ] Test with small batch first
- [ ] Implement rate limiting
- [ ] Add unsubscribe functionality
- [ ] Monitor bounce rates
- [ ] Set up email analytics

---

## Security Best Practices

1. **Never expose API keys in frontend**
2. **Use Firebase Cloud Functions** for server-side email sending
3. **Validate admin permissions** before sending
4. **Rate limit** email campaigns (e.g., max 1 per hour)
5. **Log all campaigns** to audit trail
6. **Implement unsubscribe** mechanism
7. **Sanitize email content** to prevent XSS

---

## Cost Estimation

### SendGrid
- 0-100 emails/day: **Free**
- Up to 50K emails/month: **$19.95/month**
- Up to 100K emails/month: **$89.95/month**

### AWS SES
- First 62,000 emails/month: **Free** (from EC2)
- Beyond free tier: **$0.10 per 1,000 emails**
- Example: 100K emails = **~$3.80/month**

### Mailgun
- First 5,000 emails: **Free** (3 months)
- Up to 50K emails/month: **$35/month**

## Recommendation
**Use AWS SES** for cost-effectiveness if you're comfortable with AWS, or **SendGrid** for ease of use.
