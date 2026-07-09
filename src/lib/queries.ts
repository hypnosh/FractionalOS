import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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

export const activitiesForOppQuery = (oppId: number) =>
  queryOptions({
    queryKey: ["activities", "opp", oppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Activity")
        .select("*")
        .eq("opp_id", oppId)
        .order("activity_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
