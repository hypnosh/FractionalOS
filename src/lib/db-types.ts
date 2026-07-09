// Hand-written types matching the external Supabase project schema.
// Table names are PascalCase singular; ids are bigint (number).

export type Organization = {
  id: number;
  created_at: string;
  name: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
};

export type Contact = {
  id: number;
  created_at: string;
  org_id: number | null;
  name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

export type Channel = {
  id: number;
  created_at: string;
  name: string | null;
  type: string | null;
  notes: string | null;
};

export type Opportunity = {
  id: number;
  created_at: string;
  org_id: number | null;
  channel_id: number | null;
  title: string | null;
  stage: string | null;
  status: string | null;
  expected_value: number | null;
  probability: number | null;
  opened_date: string | null;
  expected_close_date: string | null;
  notes: string | null;
};

export type Task = {
  id: number;
  created_at: string;
  opp_id: number | null;
  assigned_to: string | null;
  title: string | null;
  due_date: string | null;
  status: string | null;
  notes: string | null;
};

export type Activity = {
  id: number;
  created_at: string;
  opp_id: number | null;
  contact_id: number | null;
  activity_type: string | null;
  activity_date: string | null;
  summary: string | null;
  details: string | null;
};

export type Engagement = {
  id: number;
  created_at: string;
  opp_id: number | null;
  proposal_id: number | null;
  title: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: string | null;
  delivery_status: string | null;
  actual_value: number | null;
  notes: string | null;
  updated_at: string | null;
};

export type Invoice = {
  id: number;
  created_at: string;
  proposal_id: number | null;
  engagement_id: number | null;
  invoice_no: number | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  tax_percent: number | null;
  tax_amount: number | null;
  discount: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
  terms: string | null;
  notes: string | null;
  invoice_document: string | null;
  updated_at: string | null;
};

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type Db = {
  public: {
    Tables: {
      Organization: Row<Organization>;
      Contact: Row<Contact>;
      Channel: Row<Channel>;
      Opportunity: Row<Opportunity>;
      Task: Row<Task>;
      Activity: Row<Activity>;
      Engagement: Row<Engagement>;
      Invoice: Row<Invoice>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
