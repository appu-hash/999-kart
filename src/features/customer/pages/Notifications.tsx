import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CircleCheck,
  Clock3,
  Package,
  RefreshCw,
  ShoppingBag,
  Ticket,
  Truck,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./Notifications.css";

type NotificationType =
  | "order"
  | "payment"
  | "shipping"
  | "return"
  | "support"
  | "account"
  | "general";

interface StoreNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "order":
      return <ShoppingBag size={19} />;
    case "payment":
      return <CircleCheck size={19} />;
    case "shipping":
      return <Truck size={19} />;
    case "return":
      return <RefreshCw size={19} />;
    case "support":
      return <Ticket size={19} />;
    default:
      return <Bell size={19} />;
  }
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat("en-IN", {
    ...(sameDay ? {} : { day: "numeric", month: "short", year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Please sign in to view your notifications.");
      setNotifications([]);
      setUserId(null);
      setLoading(false);
      return;
    }

    setUserId(authData.user.id);
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id, user_id, title, message, type, link, is_read, created_at")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(
        queryError.message.includes("notifications")
          ? "The notifications table is not set up yet. Apply the supplied notifications SQL in your Supabase project."
          : queryError.message
      );
      setNotifications([]);
    } else {
      setNotifications((data ?? []) as StoreNotification[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`customer-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const visibleNotifications =
    filter === "unread"
      ? notifications.filter((item) => !item.is_read)
      : notifications;

  async function markAsRead(notification: StoreNotification) {
    if (notification.is_read) {
      if (notification.link) navigate(notification.link);
      return;
    }

    setBusyId(notification.id);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id)
      .eq("user_id", userId);

    if (updateError) {
      setError(updateError.message);
      setBusyId(null);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );
    setBusyId(null);
    if (notification.link) navigate(notification.link);
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    setBusyId("all");
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
    }
    setBusyId(null);
  }

  return (
    <main className="notifications-page">
      <div className="notifications-shell">
        <div className="notifications-topline">
          <Link to="/" className="notifications-back-link">
            <ArrowLeft size={17} /> Continue shopping
          </Link>
          <span className="notifications-brand">999<span>+</span> KART</span>
        </div>

        <section className="notifications-heading">
          <div className="notifications-heading-icon"><Bell size={25} /></div>
          <div>
            <p className="notifications-eyebrow">YOUR ACCOUNT</p>
            <h1>Notifications</h1>
            <p>Order updates, delivery alerts and account activity, all in one place.</p>
          </div>
        </section>

        {error && (
          <div className="notifications-alert" role="alert">
            {error}
            {!userId && (
              <Link to="/account">Sign in</Link>
            )}
          </div>
        )}

        <section className="notifications-panel">
          <div className="notifications-toolbar">
            <div className="notifications-tabs" role="tablist" aria-label="Notification filter">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All <span>{notifications.length}</span>
              </button>
              <button
                type="button"
                className={filter === "unread" ? "active" : ""}
                onClick={() => setFilter("unread")}
              >
                Unread <span>{unreadCount}</span>
              </button>
            </div>

            <button
              type="button"
              className="notifications-mark-all"
              onClick={markAllAsRead}
              disabled={unreadCount === 0 || busyId === "all"}
            >
              <CheckCheck size={16} />
              {busyId === "all" ? "Updating..." : "Mark all as read"}
            </button>
          </div>

          {loading ? (
            <div className="notifications-state">
              <span className="notifications-spinner" />
              <p>Loading your notifications...</p>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="notifications-state notifications-empty">
              <span className="notifications-empty-icon"><Bell size={30} /></span>
              <h2>{filter === "unread" ? "You're all caught up" : "No notifications yet"}</h2>
              <p>
                {filter === "unread"
                  ? "There are no unread updates right now."
                  : "When your order, delivery, return or support ticket changes, updates will appear here."}
              </p>
              <Link to="/shop" className="notifications-shop-button">
                <Package size={16} /> Explore products
              </Link>
            </div>
          ) : (
            <div className="notifications-list">
              {visibleNotifications.map((notification) => (
                <article
                  className={`notification-card ${notification.is_read ? "is-read" : "is-unread"}`}
                  key={notification.id}
                >
                  <div className={`notification-card-icon type-${notification.type}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <button
                    type="button"
                    className="notification-card-content"
                    onClick={() => void markAsRead(notification)}
                    disabled={busyId === notification.id}
                  >
                    <span className="notification-card-title">
                      {notification.title}
                      {!notification.is_read && <span className="notification-unread-dot" />}
                    </span>
                    <span className="notification-card-message">{notification.message}</span>
                    <span className="notification-card-time">
                      <Clock3 size={13} /> {formatNotificationDate(notification.created_at)}
                    </span>
                  </button>
                  {!notification.is_read && (
                    <button
                      type="button"
                      className="notification-read-action"
                      title="Mark as read"
                      aria-label={`Mark ${notification.title} as read`}
                      onClick={() => void markAsRead({ ...notification, link: null })}
                      disabled={busyId === notification.id}
                    >
                      <CheckCheck size={17} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="notifications-footnote">
          <ShieldCheckIcon /> Your notifications are private to your account.
        </p>
      </div>
    </main>
  );
}

function ShieldCheckIcon() {
  return <span className="notifications-security-mark" aria-hidden="true">✓</span>;
}
