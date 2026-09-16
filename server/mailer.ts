import { db } from './store';

export interface EmailAlertRecord {
  id: string;
  recipientEmail: string;
  recipientName: string;
  studentRoll: string;
  alertType: 'LOW_ATTENDANCE' | 'CURFEW_BREACH' | 'OUTPASS_DECISION';
  subject: string;
  content: string;
  timestamp: string;
  status: 'SENT' | 'QUEUED';
}

const defaultEmailLogs: EmailAlertRecord[] = [
  {
    id: 'em-001',
    recipientEmail: 'parent.reddy@example.com',
    recipientName: 'Mr. V. Reddy (Guardian)',
    studentRoll: 'CS21B031',
    alertType: 'LOW_ATTENDANCE',
    subject: 'URGENT: Academic Attendance Shortage Alert for Sneha Reddy (CS21B031)',
    content: 'Student attendance in CS302 (Database Systems) has fallen to 58.3% (below the 75% examination eligibility threshold). Kindly ensure compliance.',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'SENT',
  },
  {
    id: 'em-002',
    recipientEmail: 'parent.verma@example.com',
    recipientName: 'Mr. K. Verma (Guardian)',
    studentRoll: 'EC21B012',
    alertType: 'CURFEW_BREACH',
    subject: 'CAMPUS ALERT: Curfew Non-Compliance Detected - Rohit Verma (EC21B012)',
    content: 'Student was not verified inside Hostel Block A, Room 204 during the 09:30 PM roll call and has no approved outpass on file. Chief Warden notified.',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    status: 'SENT',
  }
];

export async function sendEmailAlert(params: {
  recipientEmail: string;
  recipientName: string;
  studentRoll: string;
  alertType: 'LOW_ATTENDANCE' | 'CURFEW_BREACH' | 'OUTPASS_DECISION';
  subject: string;
  content: string;
}): Promise<EmailAlertRecord> {
  const record: EmailAlertRecord = {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...params,
    timestamp: new Date().toISOString(),
    status: 'SENT',
  };

  if (db && Array.isArray(db.emailLogs)) {
    db.emailLogs.unshift(record);
    db.save();
  }
  console.log(`[ALERT DISPATCHED] To: ${params.recipientEmail} | Subject: ${params.subject}`);
  return record;
}

export function getEmailLogs(): EmailAlertRecord[] {
  if (db && Array.isArray(db.emailLogs) && db.emailLogs.length > 0) {
    return db.emailLogs;
  }
  return defaultEmailLogs;
}
