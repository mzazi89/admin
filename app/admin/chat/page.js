'use client';

import { PageHeader } from '@/components/ui';
import SupportInbox from '@/components/SupportInbox';

// MZAZI ADMIN — support inbox (also embedded on /admin/inquiries).
export default function AdminChat() {
  return (
    <div>
      <PageHeader title="Support chat" description="Direct messages from the app and the website." />
      <SupportInbox />
    </div>
  );
}
