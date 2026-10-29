"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  CircleCheck,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  business_id: string;
  user_id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getIcon(type: Notification["type"]) {
  switch (type) {
    case "success":
      return <CircleCheck className="h-5 w-5 text-green-600" />;

    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;

    case "error":
      return <XCircle className="h-5 w-5 text-red-600" />;

    default:
      return <Info className="h-5 w-5 text-blue-600" />;
  }
}

function getIconBackground(type: Notification["type"]) {
  switch (type) {
    case "success":
      return "bg-green-50";

    case "warning":
      return "bg-amber-50";

    case "error":
      return "bg-red-50";

    default:
      return "bg-blue-50";
  }
}

export default function NotificationsPage() {
  const supabase = createClient();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to view notifications.");
        setLoading(false);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        setError("No business was found for your account.");
        setLoading(false);
        return;
      }

      setBusinessId(membership.business_id);

      const { data, error: notificationsError } = await supabase
        .from("notifications")
        .select("*")
        .eq("business_id", membership.business_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (notificationsError) {
        throw notificationsError;
      }

      setNotifications((data || []) as Notification[]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    setError("");

    try {
      const { error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });

      if (error) {
        throw error;
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : notification
        )
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark notification as read."
      );
    }
  }

  async function markAllAsRead() {
    if (!businessId) return;

    setMarkingAll(true);
    setError("");

    try {
      const { error } = await supabase.rpc(
        "mark_all_notifications_read",
        {
          p_business_id: businessId,
        }
      );

      if (error) {
        throw error;
      }

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || now,
        }))
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                  <Bell className="h-5 w-5 text-indigo-600" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Notifications
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Stay updated with important activity in your business.
                  </p>
                </div>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={markingAll}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" />
                {markingAll ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total notifications
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {notifications.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Unread
            </p>

            <p className="mt-2 text-3xl font-bold text-indigo-600">
              {unreadCount}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Notifications */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse gap-4 border-b border-slate-100 pb-5 last:border-0"
                >
                  <div className="h-11 w-11 rounded-xl bg-slate-200" />

                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="h-3 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/4 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Bell className="h-7 w-7 text-slate-400" />
              </div>

              <h2 className="mt-5 text-lg font-semibold text-slate-900">
                No notifications yet
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Important updates about your business will appear here.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-b border-slate-100 p-5 transition last:border-b-0 ${
                    notification.is_read
                      ? "bg-white"
                      : "bg-indigo-50/40"
                  }`}
                >
                  <div className="flex gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getIconBackground(
                        notification.type
                      )}`}
                    >
                      {getIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {notification.title}
                            </h3>

                            {!notification.is_read && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                New
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {notification.message}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-slate-400">
                          {formatDate(notification.created_at)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {notification.action_url && (
                          <Link
                            href={notification.action_url}
                            onClick={() => {
                              if (!notification.is_read) {
                                markAsRead(notification.id);
                              }
                            }}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            View details
                          </Link>
                        )}

                        {!notification.is_read && (
                          <button
                            type="button"
                            onClick={() =>
                              markAsRead(notification.id)
                            }
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
                          >
                            <Check className="h-4 w-4" />
                            Mark as read
                          </button>
                        )}

                        {notification.is_read && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <CheckCheck className="h-4 w-4" />
                            Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}