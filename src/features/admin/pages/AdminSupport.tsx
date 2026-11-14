
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  MessageCircle,
  Search,
  Send,
  RefreshCw,
} from "lucide-react";

import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminSupport.css";

interface Ticket {
  id: string;
  ticket_number: number;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const statuses = [
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
  "closed",
];

const formatTitle = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [busy, setBusy] = useState(false);

  const [notice, setNotice] = useState("");

  // Load all support tickets
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setNotice("");

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, ticket_number, user_id, subject, category, priority, status, created_at, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setNotice(error.message);
      setTickets([]);
    } else {
      const loadedTickets = (data || []) as Ticket[];
      setTickets(loadedTickets);

      // Keep the selected ticket updated after refreshing.
      if (selected) {
        const updatedSelected = loadedTickets.find(
          (ticket) => ticket.id === selected.id
        );

        if (updatedSelected) {
          setSelected(updatedSelected);
        } else {
          setSelected(null);
          setReplies([]);
        }
      }
    }

    setLoading(false);
  }, [selected]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // Load conversation for selected ticket
  async function chooseTicket(ticket: Ticket) {
    setSelected(ticket);
    setReplies([]);
    setNotice("");
    setLoadingConversation(true);

    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("id, ticket_id, sender_role, message, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
    } else {
      setReplies((data || []) as Reply[]);
    }

    setLoadingConversation(false);
  }

  // Update ticket status
  async function updateStatus(status: string) {
    if (!selected) return;

    setBusy(true);
    setNotice("");

    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", selected.id);

    if (error) {
      setNotice(error.message);
    } else {
      setSelected((previous) =>
        previous ? { ...previous, status } : previous
      );

      await loadTickets();
      setNotice("Ticket status updated successfully.");
    }

    setBusy(false);
  }

  // Send admin reply
  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected || !reply.trim() || busy) return;

    setBusy(true);
    setNotice("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setNotice(authError?.message || "Please sign in again.");
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: selected.id,
        user_id: user.id,
        sender_role: "admin",
        message: reply.trim(),
      });

    if (error) {
      setNotice(error.message);
    } else {
      setReply("");
      await chooseTicket(selected);
      await loadTickets();
      setNotice("Your reply has been sent.");
    }

    setBusy(false);
  }

  // Search and filter tickets
  const visibleTickets = tickets.filter((ticket) => {
    const matchesFilter =
      filter === "all" || ticket.status === filter;

    const searchText = search.toLowerCase();

    const matchesSearch =
      !searchText ||
      `${ticket.ticket_number} ${ticket.subject} ${ticket.category} ${ticket.user_id}`
        .toLowerCase()
        .includes(searchText);

    return matchesFilter && matchesSearch;
  });

  return (
    <AdminLayout title="Customer Support">
      <div className="as-page">
        <main className="as-main">
          {/* Ticket List */}
          <aside className="as-list">
            <div className="as-list-title">
              <div>
                <h2>Support Tickets</h2>
                <p>Manage customer conversations</p>
              </div>

              <span>{tickets.length}</span>
            </div>

            <label className="as-search">
              <Search size={17} />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets..."
              />
            </label>

            <select
              className="as-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All Tickets</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatTitle(status)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="as-refresh"
              onClick={() => void loadTickets()}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh Tickets
            </button>

            <div className="as-ticket-list">
              {loading ? (
                <p className="as-message">Loading tickets...</p>
              ) : visibleTickets.length === 0 ? (
                <p className="as-message">No tickets found.</p>
              ) : (
                visibleTickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className={
                      selected?.id === ticket.id
                        ? "as-ticket active"
                        : "as-ticket"
                    }
                    onClick={() => void chooseTicket(ticket)}
                  >
                    <b>{ticket.subject}</b>

                    <small>
                      #{ticket.ticket_number} · {formatTitle(ticket.category)}
                    </small>

                    <span>
                      {formatTitle(ticket.status)} ·{" "}
                      {formatTitle(ticket.priority)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Ticket Conversation */}
          <section className="as-detail">
            {selected ? (
              <>
                <div className="as-detail-head">
                  <div>
                    <small>
                      Ticket #{selected.ticket_number} ·{" "}
                      {formatTitle(selected.category)} ·{" "}
                      {formatTitle(selected.priority)}
                    </small>

                    <h2>{selected.subject}</h2>
                  </div>

                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(event) =>
                      void updateStatus(event.target.value)
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {formatTitle(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="as-thread">
                  {loadingConversation ? (
                    <p className="as-message">
                      Loading conversation...
                    </p>
                  ) : replies.length === 0 ? (
                    <p className="as-message">
                      No messages in this ticket yet.
                    </p>
                  ) : (
                    replies.map((item) => (
                      <article
                        key={item.id}
                        className={
                          item.sender_role === "admin"
                            ? "admin"
                            : "customer"
                        }
                      >
                        <small>
                          {item.sender_role === "admin"
                            ? "Support Team"
                            : "Customer"}
                          {" · "}
                          {new Date(item.created_at).toLocaleString("en-IN")}
                        </small>

                        <p>{item.message}</p>
                      </article>
                    ))
                  )}
                </div>

                {!["resolved", "closed"].includes(selected.status) && (
                  <form
                    className="as-reply-form"
                    onSubmit={sendReply}
                  >
                    <textarea
                      required
                      rows={3}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write your reply to the customer..."
                    />

                    <button
                      type="submit"
                      disabled={busy || !reply.trim()}
                    >
                      <Send size={16} />
                      {busy ? "Sending..." : "Send Reply"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="as-empty">
                <MessageCircle size={38} />

                <h2>Select a Support Ticket</h2>

                <p>
                  Choose a ticket from the left panel to read the
                  conversation and respond to the customer.
                </p>
              </div>
            )}

            {notice && (
              <p className="as-notice" role="status">
                {notice}
              </p>
            )}
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}
