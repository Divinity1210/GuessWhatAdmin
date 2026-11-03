import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "*, profiles(id, username, full_name, phone, state), ticket_messages(id, sender_id, body, is_internal, created_at, profiles(username, role))"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tickets = (data ?? []).map((t) => {
      const sortedMsgs = [...(t.ticket_messages ?? [])].sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return {
        ...t,
        ticket_messages: sortedMsgs,
      };
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load tickets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { ticketId, body, status } = await req.json();

    if (!ticketId || !body?.trim()) {
      return NextResponse.json(
        { error: "Ticket ID and message body are required" },
        { status: 400 }
      );
    }

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, status")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const { data: staffProfile } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["super_admin", "support", "moderator"])
      .limit(1)
      .maybeSingle();

    const senderId = staffProfile?.id ?? ticket.user_id;
    const cleanReply = body.trim();

    const { data: msg, error: msgErr } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: senderId,
        body: `[Support Team]: ${cleanReply}`,
      })
      .select()
      .single();

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const nextStatus = status || "pending";
    await supabase
      .from("support_tickets")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    // Automatically notify the player in their Inbox (`notifications` table)
    if (ticket.user_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: `Support Reply: ${ticket.subject}`,
        body: cleanReply,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    await supabase.from("audit_logs").insert({
      actor_id: senderId,
      action: "admin_support_reply",
      target_table: "support_tickets",
      target_id: ticketId,
      detail: {
        subject: ticket.subject,
        status: nextStatus,
        notified_user_id: ticket.user_id,
      },
    });

    return NextResponse.json({ ok: true, message: msg });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reply to ticket" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { ticketId, status } = await req.json();

    if (!ticketId || !status) {
      return NextResponse.json(
        { error: "ticketId and status are required" },
        { status: 400 }
      );
    }

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("id, user_id, subject")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (ticket?.user_id && status === "resolved") {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: `Ticket Resolved: ${ticket.subject}`,
        body: "Your support request has been marked as resolved by the GuessWhat Support Desk. Reply anytime if you need further help!",
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update ticket status" },
      { status: 500 }
    );
  }
}
