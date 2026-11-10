'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type NotificationCategory =
  | 'STUDENT'
  | 'TEACHER'
  | 'ATTENDANCE'
  | 'FEE'
  | 'ACADEMIC'
  | 'ADMIN';

export interface NotificationItem {
  id: string;
  instituteId: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  cleanLink: string;
  category: NotificationCategory;
  eventType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface UseTeacherNotificationsOptions {
  pollingIntervalMs?: number;
  initialLimit?: number;
}

export function useTeacherNotifications(
  options: UseTeacherNotificationsOptions = {},
) {
  const { pollingIntervalMs = 30000, initialLimit = 15 } = options;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [byCategory, setByCategory] = useState<Record<NotificationCategory, number>>({
    STUDENT: 0,
    TEACHER: 0,
    ATTENDANCE: 0,
    FEE: 0,
    ACADEMIC: 0,
    ADMIN: 0,
  });

  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [limit, setLimit] = useState<number>(initialLimit);

  const [category, setCategory] = useState<'ALL' | NotificationCategory>('ALL');
  const [status, setStatus] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [search, setSearch] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers/notifications/unread-count', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (isMountedRef.current) {
        setUnreadCount(data.unreadCount ?? 0);
        if (data.byCategory) {
          setByCategory(data.byCategory);
        }
      }
    } catch {
      // Background poll failure is silent
    }
  }, []);

  const fetchNotifications = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          category,
          status,
        });
        if (search.trim()) {
          queryParams.set('search', search.trim());
        }

        const res = await fetch(
          `/api/teachers/notifications?${queryParams.toString()}`,
          { credentials: 'same-origin', headers: { Accept: 'application/json' } },
        );

        if (!res.ok) {
          throw new Error(`Failed to load notifications (${res.status})`);
        }

        const json = await res.json();
        if (isMountedRef.current) {
          setNotifications(json.data || []);
          setUnreadCount(json.unreadCount ?? 0);
          if (json.byCategory) setByCategory(json.byCategory);
          if (json.meta) {
            setTotal(json.meta.total || 0);
            setTotalPages(json.meta.totalPages || 1);
          }
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message || 'Error loading notifications');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, limit, category, status, search],
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchNotifications]);

  // Periodic Polling
  useEffect(() => {
    if (!pollingIntervalMs || pollingIntervalMs <= 0) return;
    const timer = setInterval(() => {
      fetchUnreadCount();
      // Silently refresh notification list if on page 1 and no search
      if (page === 1 && !search.trim()) {
        fetchNotifications(true);
      }
    }, pollingIntervalMs);

    return () => clearInterval(timer);
  }, [pollingIntervalMs, fetchUnreadCount, fetchNotifications, page, search]);

  // Listen to cross-component notification update events
  useEffect(() => {
    const handleSync = () => {
      fetchNotifications(true);
      fetchUnreadCount();
    };
    window.addEventListener('bible-lms:notifications-updated', handleSync);
    return () => {
      window.removeEventListener('bible-lms:notifications-updated', handleSync);
    };
  }, [fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch(`/api/teachers/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {
      // Fallback refresh on failure
      fetchNotifications(true);
    }
  };

  const markAllAsRead = async (selectedCategory?: NotificationCategory) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        !selectedCategory || n.category === selectedCategory
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n,
      ),
    );
    if (!selectedCategory || selectedCategory === category) {
      setUnreadCount(0);
    }

    try {
      const res = await fetch('/api/teachers/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory || 'ALL' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {
      fetchNotifications(true);
    }
  };

  return {
    notifications,
    unreadCount,
    byCategory,
    total,
    page,
    totalPages,
    limit,
    category,
    status,
    search,
    loading,
    refreshing,
    error,
    setPage,
    setLimit,
    setCategory,
    setStatus,
    setSearch,
    markAsRead,
    markAllAsRead,
    refresh: () => fetchNotifications(false),
  };
}

