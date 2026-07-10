import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ActivityMaster,
  ActivityMasterEntity,
  Proposal,
  Invoice,
  Payment,
} from "@/lib/db-types";

export type EntityType = "Channel" | "Opportunity" | "Proposal" | "Engagement" | "Invoice";

export const ENTITY_FK: Record<EntityType, keyof Activity> = {
  Channel: "channel_id",
  Opportunity: "opp_id",
  Proposal: "proposal_id",
  Engagement: "engagement_id",
  Invoice: "invoice_id",
};

export type ActivityRow = Activity & {
  ActivityMaster: Pick<
    ActivityMaster,
    "id" | "name" | "category" | "changes_stage" | "target_stage"
  > | null;
};

export const organizationsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Organization")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const contactsQuery = queryOptions({
  queryKey: ["contacts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Contact")
      .select("*, Organization(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const opportunitiesQuery = queryOptions({
  queryKey: ["opportunities"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Opportunity")
      .select("*, Organization(name), Channel(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const opportunitiesMinimalQuery = queryOptions({
  queryKey: ["opportunities", "minimal"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Opportunity")
      .select("id, title, Organization(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const channelsQuery = queryOptions({
  queryKey: ["channels"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Channel")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const channelQuery = (id: number) =>
  queryOptions({
    queryKey: ["channel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Channel")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Channel not found");
      return data;
    },
  });

export const proposalsQuery = queryOptions({
  queryKey: ["proposals"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Proposal")
      .select("*, Opportunity(id, title, Organization(name))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const proposalQuery = (id: number) =>
  queryOptions({
    queryKey: ["proposal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Proposal")
        .select("*, Opportunity(id, title, Organization(name))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Proposal not found");
      return data;
    },
  });

export const engagementsQuery = queryOptions({
  queryKey: ["engagements"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Engagement")
      .select("*, Proposal(id, title, opp_id, Opportunity(id, title, Organization(name)))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const engagementQuery = (id: number) =>
  queryOptions({
    queryKey: ["engagement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Engagement")
        .select("*, Proposal(id, title, opp_id, Opportunity(id, title, Organization(name)))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Engagement not found");
      return data;
    },
  });

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("Invoice")
      .select("*, Engagement(id, title)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const invoiceQuery = (id: number) =>
  queryOptions({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Invoice")
        .select("*, Engagement(id, title)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Invoice not found");
      return data;
    },
  });

export const opportunityQuery = (oppId: number) =>
  queryOptions({
    queryKey: ["opportunity", oppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Opportunity")
        .select("*, Organization(id, name), Channel(id, name)")
        .eq("id", oppId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Opportunity not found");
      return data;
    },
  });

// ---------- Activities ----------

export const activityMastersQuery = queryOptions({
  queryKey: ["activity-masters"],
  queryFn: async () => {
    const [masters, mappings] = await Promise.all([
      supabase
        .from("ActivityMaster")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("ActivityMasterEntity").select("*"),
    ]);
    if (masters.error) throw masters.error;
    if (mappings.error) throw mappings.error;
    return {
      masters: masters.data as ActivityMaster[],
      mappings: mappings.data as ActivityMasterEntity[],
    };
  },
});

export const activitiesForEntityQuery = (entityType: EntityType, parentId: number) =>
  queryOptions({
    queryKey: ["activities", entityType, parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Activity")
        .select("*, ActivityMaster(id, name, category, changes_stage, target_stage)")
        .eq(ENTITY_FK[entityType], parentId)
        .order("activity_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

// Global timeline: all user activities + derived proposal / invoice / payment events.
export const globalTimelineQuery = queryOptions({
  queryKey: ["timeline", "global"],
  queryFn: async () => {
    const [acts, props, invs, pays] = await Promise.all([
      supabase
        .from("Activity")
        .select("*, ActivityMaster(id, name, category, changes_stage, target_stage)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("Proposal")
        .select("id, title, opp_id, status, sent_date, created_at, updated_at, Opportunity(id, title, Organization(name))")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("Invoice")
        .select("id, invoice_no, status, invoice_date, engagement_id, created_at, updated_at, Engagement(id, title)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("Payment")
        .select("id, invoice_id, amount, payment_date, mode, created_at, Invoice(id, invoice_no, engagement_id, Engagement(id, title))")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (acts.error) throw acts.error;
    if (props.error) throw props.error;
    if (invs.error) throw invs.error;
    if (pays.error) throw pays.error;
    return {
      activities: (acts.data ?? []) as ActivityRow[],
      proposals: (props.data ?? []) as Array<
        Pick<Proposal, "id" | "title" | "opp_id" | "status" | "sent_date" | "created_at" | "updated_at"> & {
          Opportunity: { id: number; title: string | null; Organization: { name: string | null } | null } | null;
        }
      >,
      invoices: (invs.data ?? []) as Array<
        Pick<Invoice, "id" | "invoice_no" | "status" | "invoice_date" | "engagement_id" | "created_at" | "updated_at"> & {
          Engagement: { id: number; title: string | null } | null;
        }
      >,
      payments: (pays.data ?? []) as Array<
        Pick<Payment, "id" | "invoice_id" | "amount" | "payment_date" | "mode" | "created_at"> & {
          Invoice:
            | {
                id: number;
                invoice_no: number | null;
                engagement_id: number | null;
                Engagement: { id: number; title: string | null } | null;
              }
            | null;
        }
      >,
    };
  },
});

export const dashboardCountsQuery = queryOptions({
  queryKey: ["dashboard-counts"],
  queryFn: async () => {
    const [orgs, contacts, opps] = await Promise.all([
      supabase.from("Organization").select("id", { count: "exact", head: true }),
      supabase.from("Contact").select("id", { count: "exact", head: true }),
      supabase.from("Opportunity").select("id, expected_value, stage, status"),
    ]);
    const oppRows = opps.data ?? [];
    const openOpps = oppRows.filter((o) => {
      const s = (o.stage ?? "").toLowerCase();
      return s !== "won" && s !== "lost" && s !== "closed";
    });
    const pipeline = openOpps.reduce(
      (sum, o) => sum + Number(o.expected_value ?? 0),
      0,
    );
    return {
      organizations: orgs.count ?? 0,
      contacts: contacts.count ?? 0,
      openOpportunities: openOpps.length,
      pipelineValue: pipeline,
    };
  },
});
